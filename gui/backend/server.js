import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parseFile } from 'music-metadata';
import { fileURLToPath } from 'url';
import { all, ensureSchema, get, run } from './db/index.js';

const PORT = Number(process.env.PORT || 5001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIA_ROOT = path.join(__dirname, 'media');
const BOX_MEDIA_ROOT = process.env.KLANGKISTE_BOX_MEDIA_ROOT
  ? path.resolve(process.env.KLANGKISTE_BOX_MEDIA_ROOT)
  : path.resolve(__dirname, '..', '..', 'box', 'media');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '100mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
});

const BOX_ID_RE = /^klangkiste-[a-z0-9]{10}$/;
const FINGERPRINT_RE = /^[a-f0-9]{64}$/;
const TAG_UID_RE = /^(?:[a-z0-9]{10}|TAG_[a-z0-9]{8})$/;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeIp(ip) {
  if (!ip) return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateTagUid() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < 10; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function serializePayload(payload) {
  try {
    return JSON.stringify(payload || {});
  } catch (error) {
    return '{}';
  }
}

async function enqueueJob(boxId, jobType, payload, lastError = null) {
  const payloadJson = serializePayload(payload);
  const existing = await get(
    'SELECT id FROM box_jobs WHERE box_id = ? AND job_type = ? AND payload_json = ? AND status = ?',
    [boxId, jobType, payloadJson, 'PENDING']
  );
  if (existing) {
    return existing.id;
  }
  const now = nowSeconds();
  const result = await run(
    `INSERT INTO box_jobs (box_id, job_type, payload_json, status, attempts, last_error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [boxId, jobType, payloadJson, 'PENDING', 0, lastError, now, now]
  );
  return result.lastID;
}

async function markJobFailed(jobId, errorMessage) {
  const now = nowSeconds();
  await run(
    `UPDATE box_jobs
     SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE id = ?`,
    ['FAILED', errorMessage, now, jobId]
  );
}

async function deleteJob(jobId) {
  await run('DELETE FROM box_jobs WHERE id = ?', [jobId]);
}

async function sendTagRemove(box, uid) {
  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/command`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': box.api_token,
    },
    body: JSON.stringify({
      command: 'tag_remove',
      payload: { uid },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`box rejected: ${detail}`);
  }
}

async function sendTagBlock(box, uid) {
  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/command`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': box.api_token,
    },
    body: JSON.stringify({
      command: 'tag_block',
      payload: { uid },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`box rejected: ${detail}`);
  }
}

async function sendTagUnblock(box, uid) {
  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/command`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': box.api_token,
    },
    body: JSON.stringify({
      command: 'tag_unblock',
      payload: { uid },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`box rejected: ${detail}`);
  }
}

async function sendTagAssign(box, uid, mediaPath) {
  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/command`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Token': box.api_token,
    },
    body: JSON.stringify({
      command: 'tag_assign',
      payload: { uid, media_path: `media/${uid}` },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`box rejected: ${detail}`);
  }
}

async function performTagAssign(box, uid, mediaPath) {
  const resolved = resolveMediaPath(mediaPath);
  if (resolved.error) {
    throw new Error(resolved.error);
  }
  const absoluteMedia = resolved.absolute;
  const baseRoot = box.media_root || BOX_MEDIA_ROOT;
  const target = path.join(baseRoot, uid);
  copyRecursive(absoluteMedia, target);
  await sendTagAssign(box, uid, mediaPath);
}

async function processBoxJobs(box) {
  if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
    return;
  }
  const jobs = await all(
    'SELECT id, job_type, payload_json FROM box_jobs WHERE box_id = ? AND status IN (?, ?) ORDER BY created_at ASC',
    [box.box_id, 'PENDING', 'FAILED']
  );
  for (const job of jobs) {
    let payload = {};
    try {
      payload = JSON.parse(job.payload_json || '{}');
    } catch (error) {
      payload = {};
    }
    try {
      if (job.job_type === 'tag_remove') {
        if (payload.uid) {
          await sendTagRemove(box, payload.uid);
        }
      } else if (job.job_type === 'unpair') {
        const boxIp = normalizeIp(box.last_ip);
        const apiPort = box.api_port || 8000;
        const url = `http://${boxIp}:${apiPort}/command`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Token': box.api_token,
          },
          body: JSON.stringify({ command: 'unpair', payload: {} }),
        });
      } else if (job.job_type === 'sync_blocked') {
        const blocked = await fetchBlockedTagsFromBox(box);
        if (blocked) {
          await replaceBlockedTags(box.box_id, blocked);
        }
      } else if (job.job_type === 'tag_block') {
        if (payload.uid) {
          await sendTagBlock(box, payload.uid);
        }
      } else if (job.job_type === 'tag_unblock') {
        if (payload.uid) {
          await sendTagUnblock(box, payload.uid);
        }
      } else if (job.job_type === 'tag_assign') {
        if (payload.uid) {
          const tagRow = await get('SELECT media_path FROM tags WHERE uid = ?', [
            payload.uid,
          ]);
          if (!tagRow || !tagRow.media_path) {
            throw new Error('tag has no media_path');
          }
          await performTagAssign(box, payload.uid, tagRow.media_path);
        }
      }
      await deleteJob(job.id);
    } catch (error) {
      await markJobFailed(job.id, error.message || 'job failed');
    }
  }
}

async function syncTagToBoxes(uid, mediaPath) {
  const assignments = await all(
    `SELECT box_id FROM box_tags WHERE tag_uid = ?
     AND box_id NOT IN (SELECT box_id FROM box_tag_blocks WHERE tag_uid = ?)`,
    [uid, uid]
  );
  for (const assignment of assignments) {
    const boxId = assignment.box_id;
    let box = null;
    try {
      box = await getBoxById(boxId);
    } catch (error) {
      console.error('sync box lookup error:', error);
      await enqueueJob(boxId, 'tag_assign', { uid, media_path: mediaPath }, 'db error');
      continue;
    }
    if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
      await enqueueJob(boxId, 'tag_assign', { uid, media_path: mediaPath }, 'box not ready');
      continue;
    }
    try {
      await performTagAssign(box, uid, mediaPath);
    } catch (error) {
      await enqueueJob(
        boxId,
        'tag_assign',
        { uid, media_path: mediaPath },
        error.message || 'box unreachable'
      );
    }
  }
}

async function syncTagRemovalToBoxes(uid) {
  const assignments = await all('SELECT box_id FROM box_tags WHERE tag_uid = ?', [
    uid,
  ]);
  for (const assignment of assignments) {
    const boxId = assignment.box_id;
    let box = null;
    try {
      box = await getBoxById(boxId);
    } catch (error) {
      console.error('sync remove box lookup error:', error);
      await enqueueJob(boxId, 'tag_remove', { uid }, 'db error');
      continue;
    }
    if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
      await enqueueJob(boxId, 'tag_remove', { uid }, 'box not ready');
      continue;
    }
    try {
      await sendTagRemove(box, uid);
    } catch (error) {
      await enqueueJob(
        boxId,
        'tag_remove',
        { uid },
        error.message || 'box unreachable'
      );
    }
  }
}

async function fetchBlockedTagsFromBox(box) {
  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/status`;
  const response = await fetch(url, {
    headers: {
      'X-API-Token': box.api_token,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`box rejected: ${detail}`);
  }
  const data = await response.json();
  const blocked = Array.isArray(data.blocked_tags) ? data.blocked_tags : [];
  return blocked.filter((uid) => TAG_UID_RE.test(String(uid)));
}

async function replaceBlockedTags(boxId, blocked) {
  await run('DELETE FROM box_tag_blocks WHERE box_id = ?', [boxId]);
  const now = nowSeconds();
  for (const uid of blocked) {
    await run(
      'INSERT OR IGNORE INTO box_tag_blocks (box_id, tag_uid, created_at) VALUES (?, ?, ?)',
      [boxId, uid, now]
    );
  }
}

async function syncTagBlockToBoxes(uid, boxId) {
  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('sync block box lookup error:', error);
    await enqueueJob(boxId, 'tag_block', { uid }, 'db error');
    return;
  }
  if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
    await enqueueJob(boxId, 'tag_block', { uid }, 'box not ready');
    return;
  }
  try {
    await sendTagBlock(box, uid);
  } catch (error) {
    await enqueueJob(boxId, 'tag_block', { uid }, error.message || 'box unreachable');
  }
}

async function syncTagUnblockToBoxes(uid, boxId) {
  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('sync unblock box lookup error:', error);
    await enqueueJob(boxId, 'tag_unblock', { uid }, 'db error');
    return;
  }
  if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
    await enqueueJob(boxId, 'tag_unblock', { uid }, 'box not ready');
    return;
  }
  try {
    await sendTagUnblock(box, uid);
  } catch (error) {
    await enqueueJob(
      boxId,
      'tag_unblock',
      { uid },
      error.message || 'box unreachable'
    );
  }
}

async function ensureTagAssignments() {
  await run(
    `UPDATE box_tags
     SET media_path = (
       SELECT media_path FROM tags WHERE tags.uid = box_tags.tag_uid
     )
     WHERE tag_uid IN (SELECT uid FROM tags)`
  );
}

async function assignAllTagsToBox(box) {
  if (!box) return;
  const tags = await all('SELECT uid, media_path FROM tags WHERE media_path IS NOT NULL');
  if (tags.length === 0) return;
  const blockedRows = await all(
    'SELECT tag_uid FROM box_tag_blocks WHERE box_id = ?',
    [box.box_id]
  );
  const blockedSet = new Set(blockedRows.map((row) => row.tag_uid));
  const existingRows = await all(
    'SELECT tag_uid FROM box_tags WHERE box_id = ?',
    [box.box_id]
  );
  const existingSet = new Set(existingRows.map((row) => row.tag_uid));
  const now = nowSeconds();

  for (const tag of tags) {
    if (blockedSet.has(tag.uid)) continue;
    if (existingSet.has(tag.uid)) continue;
    await run(
      'INSERT OR IGNORE INTO box_tags (box_id, tag_uid, media_path, created_at) VALUES (?, ?, ?, ?)',
      [box.box_id, tag.uid, `media/${tag.uid}`, now]
    );
    if (box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
      await enqueueJob(box.box_id, 'tag_assign', { uid: tag.uid }, 'box not ready');
      continue;
    }
    try {
      await performTagAssign(box, tag.uid, tag.media_path);
    } catch (error) {
      await enqueueJob(
        box.box_id,
        'tag_assign',
        { uid: tag.uid, media_path: tag.media_path },
        error.message || 'box unreachable'
      );
    }
  }
}

function ensureMediaSeed() {
  const seed = [
    'grimm_volume_1/disc_a',
    'grimm_volume_1/disc_b',
    'grimm_volume_2',
    'dragon_tales/chapter_1',
    'dragon_tales/chapter_2',
    'lullabies_set',
    'party_hits/side_a',
  ];
  if (!fs.existsSync(MEDIA_ROOT)) {
    fs.mkdirSync(MEDIA_ROOT, { recursive: true });
  }
  for (const folder of seed) {
    const dir = path.join(MEDIA_ROOT, folder);
    fs.mkdirSync(dir, { recursive: true });
    const placeholder = path.join(dir, 'track_01.mp3');
    if (!fs.existsSync(placeholder)) {
      fs.writeFileSync(placeholder, '');
    }
  }
}

async function ensureTagMediaColumn() {
  const columns = await all('PRAGMA table_info(tags)');
  const hasColumn = columns.some((column) => column.name === 'media_path');
  if (!hasColumn) {
    await run('ALTER TABLE tags ADD COLUMN media_path TEXT');
  }
  const hasAlias = columns.some((column) => column.name === 'alias');
  if (!hasAlias) {
    await run('ALTER TABLE tags ADD COLUMN alias TEXT');
  }
  await run(
    `UPDATE tags
     SET media_path = (
       SELECT media_path FROM box_tags WHERE box_tags.tag_uid = tags.uid LIMIT 1
     )
     WHERE media_path IS NULL`
  );
}

async function ensureTagBlockTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS box_tag_blocks (
      box_id TEXT NOT NULL,
      tag_uid TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (box_id, tag_uid),
      FOREIGN KEY (box_id) REFERENCES boxes(box_id) ON DELETE CASCADE,
      FOREIGN KEY (tag_uid) REFERENCES tags(uid) ON DELETE CASCADE
    )`
  );
}

async function ensureBoxAliasColumn() {
  const columns = await all('PRAGMA table_info(boxes)');
  const hasAlias = columns.some((column) => column.name === 'alias');
  if (!hasAlias) {
    await run('ALTER TABLE boxes ADD COLUMN alias TEXT');
  }
}

async function ensureBoxPortColumns() {
  const columns = await all('PRAGMA table_info(boxes)');
  const hasApiPort = columns.some((column) => column.name === 'api_port');
  if (!hasApiPort) {
    await run('ALTER TABLE boxes ADD COLUMN api_port INTEGER');
  }
  const hasSetupPort = columns.some((column) => column.name === 'setup_port');
  if (!hasSetupPort) {
    await run('ALTER TABLE boxes ADD COLUMN setup_port INTEGER');
  }
}

async function ensureBoxMediaRootColumn() {
  const columns = await all('PRAGMA table_info(boxes)');
  const hasMediaRoot = columns.some((column) => column.name === 'media_root');
  if (!hasMediaRoot) {
    await run('ALTER TABLE boxes ADD COLUMN media_root TEXT');
  }
}

async function buildMediaTree(root) {
  let freeBytes = null;
  try {
    const stats = fs.statfsSync(root);
    freeBytes = stats.bsize * stats.bfree;
  } catch (error) {
    freeBytes = null;
  }

  async function fileMeta(filePath, fileName) {
    let size = 0;
    try {
      size = fs.statSync(filePath).size;
    } catch (error) {
      size = 0;
    }
    let title = path.parse(fileName).name;
    let artist = '';
    let duration = null;
    try {
      const metadata = await parseFile(filePath, { duration: true });
      if (metadata.common?.title) title = metadata.common.title;
      if (metadata.common?.artist) artist = metadata.common.artist;
      if (typeof metadata.format?.duration === 'number') {
        duration = Math.round(metadata.format.duration);
      }
    } catch (error) {
      // ignore metadata errors
    }
    return {
      title,
      artist,
      duration,
      size,
    };
  }

  async function walk(current, base) {
    const rel = path.relative(base, current);
    const node = {
      name: rel ? path.basename(current) : 'media',
      type: 'folder',
      path: rel ? rel.split(path.sep).join('/') : '',
      children: [],
      size: 0,
    };
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      return node;
    }
    const folders = entries.filter((entry) => entry.isDirectory());
    const files = entries.filter((entry) => entry.isFile());
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      node.children.push(await walk(path.join(current, folder.name), base));
    }
    const fileNodes = await Promise.all(
      files.map(async (file) => {
        const absolute = path.join(current, file.name);
        const metadata = await fileMeta(absolute, file.name);
        return {
          name: file.name,
          type: 'file',
          path: path.join(node.path, file.name).split(path.sep).join('/'),
          ...metadata,
        };
      })
    );
    node.children.push(...fileNodes);
    node.size = node.children.reduce((sum, child) => sum + (child.size || 0), 0);
    return node;
  }
  const tree = await walk(root, root);
  tree.free_bytes = freeBytes;
  return tree;
}

function normalizeRelativePath(input) {
  if (!input) return '';
  const raw = String(input).replace(/\\/g, '/');
  if (raw.startsWith('/')) return null;
  const normalized = path.posix.normalize(raw);
  if (normalized.startsWith('..')) return null;
  if (normalized === '.') return '';
  return normalized;
}

function resolveMediaTarget(input) {
  const rel = normalizeRelativePath(input);
  if (rel === null) {
    return { error: 'invalid path' };
  }
  return { rel, absolute: path.join(MEDIA_ROOT, rel) };
}

function resolveMediaPath(mediaPath) {
  if (typeof mediaPath !== 'string' || !mediaPath) {
    return { error: 'media_path required' };
  }
  if (mediaPath.includes('/') || mediaPath.includes('\\')) {
    return { error: 'media_path must be top-level folder' };
  }
  const absolute = path.join(MEDIA_ROOT, mediaPath);
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isDirectory()) {
      return { error: 'media_path must be folder' };
    }
  } catch (error) {
    return { error: 'media_path not found' };
  }
  return { absolute, mediaPath };
}

function copyRecursive(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function getBoxById(boxId) {
  return get('SELECT * FROM boxes WHERE box_id = ?', [boxId]);
}

async function upsertBox({
  box_id,
  fingerprint,
  firmware_version,
  capabilities_json,
  last_ip,
  api_port,
  setup_port,
  media_root,
}) {
  const existing = await getBoxById(box_id);
  const now = nowSeconds();

  if (!existing) {
    await run(
      `INSERT INTO boxes (
        box_id,
        fingerprint,
        state,
        first_seen,
        last_seen,
        firmware_version,
        capabilities_json,
        api_token,
        last_ip,
        api_port,
        setup_port,
        media_root
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        box_id,
        fingerprint,
        'UNPAIRED',
        now,
        now,
        firmware_version,
        capabilities_json,
        last_ip,
        api_port,
        setup_port,
        media_root,
      ]
    );
    return;
  }

  const nextState = existing.state === 'PAIRED' ? 'PAIRED' : 'UNPAIRED';

  await run(
    `UPDATE boxes
     SET fingerprint = ?,
         state = ?,
         last_seen = ?,
         firmware_version = ?,
         capabilities_json = ?,
         last_ip = ?,
         api_port = ?,
         setup_port = ?,
         media_root = ?
     WHERE box_id = ?`,
    [
      fingerprint,
      nextState,
      now,
      firmware_version,
      capabilities_json,
      last_ip,
      api_port,
      setup_port,
      media_root,
      box_id,
    ]
  );
}

app.get('/api/boxes', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM boxes ORDER BY last_seen DESC');
    res.json({ boxes: rows });
  } catch (error) {
    console.error('db list error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.get('/api/media-tree', async (req, res) => {
  try {
    const tree = await buildMediaTree(MEDIA_ROOT);
    res.json(tree);
  } catch (error) {
    console.error('media tree error:', error);
    res.status(500).json({ detail: 'media tree failed' });
  }
});

app.post('/api/media/folder', (req, res) => {
  const { parent_path, name } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ detail: 'name required' });
  }
  if (name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ detail: 'invalid name' });
  }
  const target = resolveMediaTarget(parent_path || '');
  if (target.error) {
    return res.status(400).json({ detail: target.error });
  }
  try {
    fs.mkdirSync(path.join(target.absolute, name.trim()), { recursive: true });
    res.json({ ok: true });
  } catch (error) {
    console.error('media folder error:', error);
    res.status(500).json({ detail: 'mkdir failed' });
  }
});

app.post('/api/media/delete', (req, res) => {
  const { path: relPath } = req.body || {};
  const target = resolveMediaTarget(relPath || '');
  if (target.error || !target.rel) {
    return res.status(400).json({ detail: target.error || 'invalid path' });
  }
  try {
    fs.rmSync(target.absolute, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (error) {
    console.error('media delete error:', error);
    res.status(500).json({ detail: 'delete failed' });
  }
});

app.post('/api/media/rename', (req, res) => {
  const { path: relPath, name } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ detail: 'name required' });
  }
  if (name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ detail: 'invalid name' });
  }
  const target = resolveMediaTarget(relPath || '');
  if (target.error || !target.rel) {
    return res.status(400).json({ detail: target.error || 'invalid path' });
  }
  const parent = path.dirname(target.absolute);
  try {
    fs.renameSync(target.absolute, path.join(parent, name.trim()));
    res.json({ ok: true });
  } catch (error) {
    console.error('media rename error:', error);
    res.status(500).json({ detail: 'rename failed' });
  }
});

app.post('/api/media/move', (req, res) => {
  const { path: relPath, target_parent } = req.body || {};
  const source = resolveMediaTarget(relPath || '');
  if (source.error || !source.rel) {
    return res.status(400).json({ detail: source.error || 'invalid path' });
  }
  const target = resolveMediaTarget(target_parent || '');
  if (target.error) {
    return res.status(400).json({ detail: target.error });
  }
  const name = path.basename(source.absolute);
  try {
    fs.renameSync(source.absolute, path.join(target.absolute, name));
    res.json({ ok: true });
  } catch (error) {
    console.error('media move error:', error);
    res.status(500).json({ detail: 'move failed' });
  }
});

app.post('/api/media/upload', upload.array('files'), (req, res) => {
  const { target_path } = req.body || {};
  const target = resolveMediaTarget(target_path || '');
  if (target.error) {
    return res.status(400).json({ detail: target.error });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ detail: 'no files' });
  }
  try {
    fs.mkdirSync(target.absolute, { recursive: true });
    for (const file of req.files) {
      const rawName = path.basename(file.originalname);
      const safeName = Buffer.from(rawName, 'latin1').toString('utf8');
      fs.writeFileSync(path.join(target.absolute, safeName), file.buffer);
    }
    res.json({ ok: true, count: req.files.length });
  } catch (error) {
    console.error('media upload error:', error);
    res.status(500).json({ detail: 'upload failed' });
  }
});

app.post('/api/boxes/announce', async (req, res) => {
  const payload = req.body || {};
  const { box_id, fingerprint, firmware_version, capabilities } = payload;
  const api_port = Number(payload.api_port || 8000);
  const setup_port = Number(payload.setup_port || 9000);
  const media_root =
    typeof payload.media_root === 'string' ? payload.media_root.trim() : null;

  console.log('announce payload:', JSON.stringify(payload));

  if (!BOX_ID_RE.test(String(box_id || ''))) {
    console.error('announce invalid box_id:', box_id);
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  if (typeof fingerprint !== 'string' || !FINGERPRINT_RE.test(fingerprint)) {
    console.error('announce invalid fingerprint:', fingerprint);
    return res.status(400).json({ detail: 'invalid fingerprint' });
  }

  if (!Number.isInteger(api_port) || api_port <= 0 || api_port > 65535) {
    return res.status(400).json({ detail: 'invalid api_port' });
  }
  if (!Number.isInteger(setup_port) || setup_port <= 0 || setup_port > 65535) {
    return res.status(400).json({ detail: 'invalid setup_port' });
  }

  const last_ip = normalizeIp(req.ip);
  const fw = String(firmware_version || '0.0.0');
  const capabilities_json = JSON.stringify(capabilities || {});

  let updated = null;
  try {
    await upsertBox({
      box_id,
      fingerprint,
      firmware_version: fw,
      capabilities_json,
      last_ip,
      api_port,
      setup_port,
      media_root,
    });
    updated = await getBoxById(box_id);
    await processBoxJobs(updated);
    const forceUnpair = !updated || updated.state !== 'PAIRED' || !updated.api_token;
    res.json({ ok: true, force_unpair: forceUnpair });
  } catch (error) {
    console.error('announce error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/boxes/poll-pairing', async (req, res) => {
  const { box_id } = req.body || {};
  if (!BOX_ID_RE.test(String(box_id || ''))) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(box_id);
  } catch (error) {
    console.error('poll error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }

  if (box.state === 'PAIRED' && box.api_token) {
    return res.json({ paired: true, api_token: box.api_token });
  }

  res.json({ paired: false });
});

app.post('/api/boxes/pair', async (req, res) => {
  const { box_id } = req.body || {};
  if (!BOX_ID_RE.test(String(box_id || ''))) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(box_id);
  } catch (error) {
    console.error('pair lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }

  const apiToken = box.api_token || generateToken();
  try {
    await run('UPDATE boxes SET state = ?, api_token = ? WHERE box_id = ?', [
      'PAIRED',
      apiToken,
      box_id,
    ]);
  } catch (error) {
    console.error('pair update error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  try {
    const updated = await getBoxById(box_id);
    await processBoxJobs(updated);
    if (updated) {
      await enqueueJob(updated.box_id, 'sync_blocked', {}, 'pair sync');
    }
  } catch (error) {
    console.error('pair tag assign error:', error);
  }

  res.json({ ok: true, api_token: apiToken });
});

app.get('/api/boxes/:box_id/status', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('status lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }
  if (box.state !== 'PAIRED') {
    return res.status(403).json({ detail: 'pairing required' });
  }
  if (!box.last_ip) {
    return res.status(502).json({ detail: 'box has no known IP' });
  }

  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/status`;

  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();
    res.status(response.status).type('application/json').send(text);
  } catch (error) {
    res.status(502).json({ detail: 'box unreachable' });
  }
});

app.post('/api/boxes/:box_id/resolve-tag', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  const token = req.get('X-API-Token') || '';
  if (!token) {
    return res.status(403).json({ detail: 'missing api token' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('resolve tag lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box || box.api_token !== token) {
    return res.status(403).json({ detail: 'invalid api token' });
  }

  const { uid } = req.body || {};
  if (!TAG_UID_RE.test(String(uid || ''))) {
    return res.status(400).json({ detail: 'invalid uid' });
  }

  const blocked = await get(
    'SELECT 1 FROM box_tag_blocks WHERE box_id = ? AND tag_uid = ?',
    [boxId, uid]
  );
  if (blocked) {
    return res.status(403).json({ detail: 'tag_blocked' });
  }

  let tagRow = null;
  try {
    tagRow = await get('SELECT uid, media_path FROM tags WHERE uid = ?', [uid]);
  } catch (error) {
    console.error('resolve tag error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!tagRow) {
    return res.status(404).json({ detail: 'unknown tag' });
  }
  if (!tagRow.media_path) {
    return res.status(409).json({ detail: 'tag has no media_path' });
  }

  try {
    await run(
      'INSERT OR IGNORE INTO box_tags (box_id, tag_uid, media_path, created_at) VALUES (?, ?, ?, ?)',
      [boxId, uid, tagRow.media_path, nowSeconds()]
    );
    await run('UPDATE box_tags SET media_path = ? WHERE box_id = ? AND tag_uid = ?', [
      tagRow.media_path,
      boxId,
      uid,
    ]);
    await run('UPDATE tags SET status = ? WHERE uid = ?', ['ASSIGNED', uid]);
  } catch (error) {
    console.error('resolve tag persist error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  res.json({ ok: true, media_path: tagRow.media_path });
});

app.post('/api/boxes/:box_id/command', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('command lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }
  if (box.state !== 'PAIRED') {
    return res.status(403).json({ detail: 'pairing required' });
  }
  if (!box.api_token) {
    return res.status(403).json({ detail: 'missing api token' });
  }
  if (!box.last_ip) {
    return res.status(502).json({ detail: 'box has no known IP' });
  }

  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/command`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': box.api_token,
      },
      body: JSON.stringify(req.body || {}),
    });
    const text = await response.text();
    res.status(response.status).type('application/json').send(text);
  } catch (error) {
    res.status(502).json({ detail: 'box unreachable' });
  }
});

app.post('/api/boxes/:box_id/media-sync', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  const token = req.get('X-API-Token') || '';
  if (!token) {
    return res.status(403).json({ detail: 'missing api token' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('media sync lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box || box.api_token !== token) {
    return res.status(403).json({ detail: 'invalid api token' });
  }

  const { uid } = req.body || {};
  if (!TAG_UID_RE.test(String(uid || ''))) {
    return res.status(400).json({ detail: 'invalid uid' });
  }

  let tagRow = null;
  try {
    tagRow = await get('SELECT media_path FROM tags WHERE uid = ?', [uid]);
  } catch (error) {
    console.error('media sync tag lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!tagRow || !tagRow.media_path) {
    return res.status(404).json({ detail: 'tag has no media_path' });
  }

  const resolved = resolveMediaPath(tagRow.media_path);
  if (resolved.error) {
    return res.status(400).json({ detail: resolved.error });
  }
  try {
    const baseRoot = box.media_root || BOX_MEDIA_ROOT;
    copyRecursive(resolved.absolute, path.join(baseRoot, uid));
    return res.json({ ok: true });
  } catch (error) {
    console.error('media sync copy error:', error);
    return res.status(500).json({ detail: 'media copy failed' });
  }
});

app.post('/api/boxes/:box_id/media-import', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  const token = req.get('X-API-Token') || '';
  if (!token) {
    return res.status(403).json({ detail: 'missing api token' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('media import lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box || box.api_token !== token) {
    return res.status(403).json({ detail: 'invalid api token' });
  }

  const { target_folder, rel_path, content_base64 } = req.body || {};
  if (typeof target_folder !== 'string' || !target_folder.trim()) {
    return res.status(400).json({ detail: 'target_folder required' });
  }
  if (target_folder.includes('/') || target_folder.includes('\\')) {
    return res.status(400).json({ detail: 'invalid target_folder' });
  }
  if (typeof rel_path !== 'string' || !rel_path.trim()) {
    return res.status(400).json({ detail: 'rel_path required' });
  }
  const normalized = path.posix.normalize(rel_path);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    return res.status(400).json({ detail: 'invalid rel_path' });
  }
  if (typeof content_base64 !== 'string' || !content_base64) {
    return res.status(400).json({ detail: 'content required' });
  }

  const baseRoot = path.join(MEDIA_ROOT, target_folder.trim());
  const targetPath = path.join(baseRoot, normalized);
  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const buffer = Buffer.from(content_base64, 'base64');
    fs.writeFileSync(targetPath, buffer);
    res.json({ ok: true });
  } catch (error) {
    console.error('media import error:', error);
    res.status(500).json({ detail: 'import failed' });
  }
});

app.get('/api/boxes/:box_id/tags', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  try {
    const rows = await all(
      `SELECT bt.tag_uid, t.media_path, t.label, t.status, t.written_at
       FROM box_tags bt
       JOIN tags t ON t.uid = bt.tag_uid
       WHERE bt.box_id = ?
       ORDER BY bt.created_at ASC`,
      [boxId]
    );
    res.json({ tags: rows });
  } catch (error) {
    console.error('box tags error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.get('/api/boxes/:box_id/local-tags', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('local tags lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }
  if (box.state !== 'PAIRED') {
    return res.status(403).json({ detail: 'pairing required' });
  }
  if (!box.last_ip || !box.api_token) {
    return res.status(502).json({ detail: 'box not reachable' });
  }

  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/local-tags`;
  try {
    const response = await fetch(url, {
      headers: {
        'X-API-Token': box.api_token,
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ detail });
    }
    const data = await response.json();
    const boxTags = Array.isArray(data.tags) ? data.tags : [];
    const dbTags = await all('SELECT uid FROM tags');
    const dbSet = new Set(dbTags.map((row) => row.uid));
    const filtered = boxTags
      .map((tag) => ({ ...tag, known_in_db: dbSet.has(tag.uid) }))
      .filter((tag) => !tag.known_in_db);
    res.json({ tags: filtered });
  } catch (error) {
    console.error('local tags fetch error:', error);
    res.status(502).json({ detail: 'box unreachable' });
  }
});

app.get('/api/boxes/:box_id/tag-blocks', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  try {
    const rows = await all(
      'SELECT tag_uid FROM box_tag_blocks WHERE box_id = ? ORDER BY created_at ASC',
      [boxId]
    );
    res.json({ blocked: rows.map((row) => row.tag_uid) });
  } catch (error) {
    console.error('tag blocks error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/boxes/:box_id/tag-blocks', async (req, res) => {
  const boxId = req.params.box_id;
  const { uid, blocked } = req.body || {};
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  if (!TAG_UID_RE.test(String(uid || ''))) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  const shouldBlock = Boolean(blocked);
  const tagRow = await get('SELECT uid, media_path FROM tags WHERE uid = ?', [uid]);
  if (!tagRow) {
    return res.status(404).json({ detail: 'unknown tag' });
  }

  try {
    if (shouldBlock) {
      await run(
        'INSERT OR IGNORE INTO box_tag_blocks (box_id, tag_uid, created_at) VALUES (?, ?, ?)',
        [boxId, uid, nowSeconds()]
      );
      await run('DELETE FROM box_tags WHERE box_id = ? AND tag_uid = ?', [boxId, uid]);
    } else {
      await run('DELETE FROM box_tag_blocks WHERE box_id = ? AND tag_uid = ?', [
        boxId,
        uid,
      ]);
      if (tagRow.media_path) {
        await run(
          'INSERT OR IGNORE INTO box_tags (box_id, tag_uid, media_path, created_at) VALUES (?, ?, ?, ?)',
          [boxId, uid, `media/${uid}`, nowSeconds()]
        );
      }
    }
  } catch (error) {
    console.error('tag block update error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  try {
    if (shouldBlock) {
      await syncTagBlockToBoxes(uid, boxId);
    } else if (tagRow.media_path) {
      await syncTagUnblockToBoxes(uid, boxId);
    }
  } catch (error) {
    console.error('tag block sync error:', error);
  }

  res.json({ ok: true, blocked: shouldBlock });
});

app.get('/api/tags', async (req, res) => {
  try {
    const rows = await all(
      'SELECT uid, label, alias, status, created_at, written_at, media_path FROM tags ORDER BY created_at DESC'
    );
    res.json({ tags: rows });
  } catch (error) {
    console.error('tags list error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/boxes/:box_id/alias', async (req, res) => {
  const boxId = req.params.box_id;
  const { alias } = req.body || {};
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  if (alias !== null && alias !== undefined && typeof alias !== 'string') {
    return res.status(400).json({ detail: 'invalid alias' });
  }
  const value = typeof alias === 'string' ? alias.trim() : null;
  try {
    await run('UPDATE boxes SET alias = ? WHERE box_id = ?', [value || null, boxId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('box alias error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/tags/:uid/alias', async (req, res) => {
  const uid = req.params.uid;
  const { alias } = req.body || {};
  if (!TAG_UID_RE.test(uid)) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  if (alias !== null && alias !== undefined && typeof alias !== 'string') {
    return res.status(400).json({ detail: 'invalid alias' });
  }
  const value = typeof alias === 'string' ? alias.trim() : null;
  try {
    await run('UPDATE tags SET alias = ? WHERE uid = ?', [value || null, uid]);
    res.json({ ok: true });
  } catch (error) {
    console.error('tag alias error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/tags/generate', async (req, res) => {
  const { label } = req.body || {};
  const now = nowSeconds();
  let uid = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    uid = generateTagUid();
    const existing = await get('SELECT uid FROM tags WHERE uid = ?', [uid]);
    if (!existing) break;
  }
  if (!uid) {
    return res.status(500).json({ detail: 'could not generate uid' });
  }
  try {
    await run(
      'INSERT INTO tags (uid, label, status, created_at, written_at) VALUES (?, ?, ?, ?, NULL)',
      [uid, typeof label === 'string' ? label : null, 'NEW', now]
    );
    res.json({ uid });
  } catch (error) {
    console.error('tag generate error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/tags/claim', async (req, res) => {
  const { uid: requestedUid, label } = req.body || {};
  const now = nowSeconds();
  let uid = '';
  if (typeof requestedUid === 'string' && requestedUid) {
    if (!TAG_UID_RE.test(requestedUid)) {
      return res.status(400).json({ detail: 'invalid uid' });
    }
    const existing = await get('SELECT uid FROM tags WHERE uid = ?', [requestedUid]);
    if (existing) {
      return res.status(409).json({ detail: 'uid already exists' });
    }
    uid = requestedUid;
  } else {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      uid = generateTagUid();
      const existing = await get('SELECT uid FROM tags WHERE uid = ?', [uid]);
      if (!existing) break;
    }
    if (!uid) {
      return res.status(500).json({ detail: 'could not generate uid' });
    }
  }
  try {
    await run(
      'INSERT INTO tags (uid, label, status, created_at, written_at) VALUES (?, ?, ?, ?, ?)',
      [uid, typeof label === 'string' ? label : null, 'WRITTEN', now, now]
    );
    res.json({ uid });
  } catch (error) {
    console.error('tag claim error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/tags/:uid/write', async (req, res) => {
  const uid = req.params.uid;
  if (!TAG_UID_RE.test(uid)) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  const existing = await get('SELECT uid FROM tags WHERE uid = ?', [uid]);
  if (!existing) {
    return res.status(404).json({ detail: 'unknown tag' });
  }
  const now = nowSeconds();
  try {
    await run('UPDATE tags SET status = ?, written_at = ? WHERE uid = ?', [
      'WRITTEN',
      now,
      uid,
    ]);
    res.json({ ok: true });
  } catch (error) {
    console.error('tag write error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/tags/:uid/media', async (req, res) => {
  const uid = req.params.uid;
  if (!TAG_UID_RE.test(uid)) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  const { media_path } = req.body || {};
  const trimmedPath =
    typeof media_path === 'string' ? media_path.trim() : '';
  const isClearing = !trimmedPath;
  let resolved = null;
  if (!isClearing) {
    resolved = resolveMediaPath(trimmedPath);
    if (resolved.error) {
      return res.status(400).json({ detail: resolved.error });
    }
  }
  const existing = await get('SELECT uid FROM tags WHERE uid = ?', [uid]);
  if (!existing) {
    return res.status(404).json({ detail: 'unknown tag' });
  }
  try {
    await run('UPDATE tags SET media_path = ? WHERE uid = ?', [
      isClearing ? null : resolved.mediaPath,
      uid,
    ]);
    if (isClearing) {
      await run('DELETE FROM box_tags WHERE tag_uid = ?', [uid]);
      await run('DELETE FROM box_tag_blocks WHERE tag_uid = ?', [uid]);
    } else {
      await run('UPDATE box_tags SET media_path = ? WHERE tag_uid = ?', [
        resolved.mediaPath,
        uid,
      ]);
    }
  } catch (error) {
    console.error('tag media update error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  try {
    if (isClearing) {
      await syncTagRemovalToBoxes(uid);
    } else {
      await syncTagToBoxes(uid, resolved.mediaPath);
    }
  } catch (error) {
    console.error('tag media sync error:', error);
  }
  res.json({ ok: true, cleared: isClearing });
});

app.post('/api/boxes/:box_id/pull-tag', async (req, res) => {
  const boxId = req.params.box_id;
  const { uid, target_folder } = req.body || {};
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }
  if (!TAG_UID_RE.test(String(uid || ''))) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  if (typeof target_folder !== 'string' || !target_folder.trim()) {
    return res.status(400).json({ detail: 'target_folder required' });
  }
  if (target_folder.includes('/') || target_folder.includes('\\')) {
    return res.status(400).json({ detail: 'invalid target_folder' });
  }

  const targetPath = path.join(MEDIA_ROOT, target_folder.trim());
  if (fs.existsSync(targetPath)) {
    return res.status(409).json({ detail: 'target_folder exists' });
  }

  let box = null;
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('pull tag lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
    return res.status(502).json({ detail: 'box not reachable' });
  }

  const boxIp = normalizeIp(box.last_ip);
  const apiPort = box.api_port || 8000;
  const url = `http://${boxIp}:${apiPort}/command`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': box.api_token,
      },
      body: JSON.stringify({
        command: 'export_tag',
        payload: { uid, target_folder: target_folder.trim() },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({ detail });
    }
  } catch (error) {
    console.error('pull tag export error:', error);
    return res.status(502).json({ detail: 'box unreachable' });
  }

  const now = nowSeconds();
  try {
    await run(
      'INSERT OR IGNORE INTO tags (uid, label, status, created_at, written_at, media_path) VALUES (?, ?, ?, ?, NULL, ?)',
      [uid, null, 'IMPORTED', now, target_folder.trim()]
    );
    await run('UPDATE tags SET media_path = ?, status = ? WHERE uid = ?', [
      target_folder.trim(),
      'IMPORTED',
      uid,
    ]);
  } catch (error) {
    console.error('pull tag persist error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  res.json({ ok: true });
});

app.post('/api/tags/:uid/assign', async (req, res) => {
  const uid = req.params.uid;
  const { box_id } = req.body || {};
  if (!TAG_UID_RE.test(uid)) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  if (!BOX_ID_RE.test(String(box_id || ''))) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(box_id);
  } catch (error) {
    console.error('assign lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }

  let tagRow = null;
  try {
    tagRow = await get('SELECT uid, media_path FROM tags WHERE uid = ?', [uid]);
  } catch (error) {
    console.error('assign tag lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!tagRow) {
    return res.status(404).json({ detail: 'unknown tag' });
  }
  if (!tagRow.media_path) {
    return res.status(409).json({ detail: 'tag has no media_path' });
  }

  let queued = false;
  let queueError = null;
  if (box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
    queued = true;
    queueError = 'box not ready';
  } else {
    try {
      await performTagAssign(box, uid, tagRow.media_path);
    } catch (error) {
      queued = true;
      queueError = error.message || 'box unreachable';
    }
  }

  try {
    await run(
      'INSERT OR REPLACE INTO box_tags (box_id, tag_uid, media_path, created_at) VALUES (?, ?, ?, ?)',
      [box_id, uid, tagRow.media_path, nowSeconds()]
    );
    await run('UPDATE tags SET status = ? WHERE uid = ?', ['ASSIGNED', uid]);
    if (queued) {
      await enqueueJob(
        box_id,
        'tag_assign',
        { uid, media_path: tagRow.media_path },
        queueError
      );
      return res.json({ ok: true, queued: true });
    }
    res.json({ ok: true, queued: false });
  } catch (error) {
    console.error('assign persist error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/tags/:uid/unassign', async (req, res) => {
  const uid = req.params.uid;
  const { box_id } = req.body || {};
  if (!TAG_UID_RE.test(uid)) {
    return res.status(400).json({ detail: 'invalid uid' });
  }
  if (!BOX_ID_RE.test(String(box_id || ''))) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  try {
    box = await getBoxById(box_id);
  } catch (error) {
    console.error('unassign lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }

  let queued = false;
  let queueError = null;
  if (box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
    queued = true;
    queueError = 'box not ready';
  } else {
    try {
      await sendTagRemove(box, uid);
    } catch (error) {
      queued = true;
      queueError = error.message || 'box unreachable';
    }
  }

  try {
    await run('DELETE FROM box_tags WHERE box_id = ? AND tag_uid = ?', [box_id, uid]);
    await run('DELETE FROM box_tag_blocks WHERE box_id = ? AND tag_uid = ?', [
      box_id,
      uid,
    ]);
    await run('UPDATE tags SET status = ? WHERE uid = ?', ['WRITTEN', uid]);
    if (queued) {
      await enqueueJob(box_id, 'tag_remove', { uid }, queueError);
      return res.json({ ok: true, queued: true });
    }
    res.json({ ok: true, queued: false });
  } catch (error) {
    console.error('unassign persist error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.delete('/api/tags/:uid', async (req, res) => {
  const uid = req.params.uid;
  if (!TAG_UID_RE.test(uid)) {
    return res.status(400).json({ detail: 'invalid uid' });
  }

  let existing = null;
  try {
    existing = await get('SELECT uid FROM tags WHERE uid = ?', [uid]);
  } catch (error) {
    console.error('tag delete lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  if (!existing) {
    return res.status(404).json({ detail: 'unknown tag' });
  }

  let assignments = [];
  let allBoxes = [];
  try {
    assignments = await all('SELECT box_id FROM box_tags WHERE tag_uid = ?', [
      uid,
    ]);
    allBoxes = await all('SELECT box_id FROM boxes');
  } catch (error) {
    console.error('tag delete assignments error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  const targetBoxes = new Set([
    ...assignments.map((row) => row.box_id),
    ...allBoxes.map((row) => row.box_id),
  ]);

  for (const boxId of targetBoxes) {
    let box = null;
    try {
      box = await getBoxById(boxId);
    } catch (error) {
      console.error('tag delete box lookup error:', error);
      return res.status(500).json({ detail: 'db error' });
    }
    if (!box || box.state !== 'PAIRED' || !box.api_token || !box.last_ip) {
      try {
        await enqueueJob(boxId, 'tag_remove', { uid }, 'box not ready');
      } catch (error) {
        console.error('tag delete queue error:', error);
      }
      continue;
    }
    try {
      await sendTagRemove(box, uid);
    } catch (error) {
      console.error('tag delete notify error:', error);
      try {
        await enqueueJob(boxId, 'tag_remove', { uid }, error.message || 'box unreachable');
      } catch (enqueueError) {
        console.error('tag delete queue error:', enqueueError);
      }
    }
  }

  try {
    await run('DELETE FROM box_tags WHERE tag_uid = ?', [uid]);
    await run('DELETE FROM box_tag_blocks WHERE tag_uid = ?', [uid]);
    await run('DELETE FROM tags WHERE uid = ?', [uid]);
    res.json({ ok: true });
  } catch (error) {
    console.error('tag delete error:', error);
    res.status(500).json({ detail: 'db error' });
  }
});

app.post('/api/boxes/:box_id/unpair', async (req, res) => {
  const boxId = req.params.box_id;
  if (!BOX_ID_RE.test(boxId)) {
    return res.status(400).json({ detail: 'invalid box_id' });
  }

  let box = null;
  let assignedTags = [];
  try {
    box = await getBoxById(boxId);
  } catch (error) {
    console.error('unpair lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }
  if (!box) {
    return res.status(404).json({ detail: 'unknown box' });
  }

  try {
    assignedTags = await all('SELECT tag_uid FROM box_tags WHERE box_id = ?', [
      boxId,
    ]);
  } catch (error) {
    console.error('unpair tags lookup error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  let queued = false;
  let queueError = null;
  if (box.api_token && box.last_ip && box.state === 'PAIRED') {
    const boxIp = normalizeIp(box.last_ip);
    const apiPort = box.api_port || 8000;
    const url = `http://${boxIp}:${apiPort}/command`;
    try {
      for (const row of assignedTags) {
        if (!row.tag_uid) continue;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Token': box.api_token,
          },
          body: JSON.stringify({
            command: 'tag_remove',
            payload: { uid: row.tag_uid },
          }),
        });
      }
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': box.api_token,
        },
        body: JSON.stringify({ command: 'unpair', payload: {} }),
      });
    } catch (error) {
      queued = true;
      queueError = error.message || 'box unreachable';
      console.error('unpair notify error:', error);
    }
  } else {
    queued = true;
    queueError = 'box not ready';
  }

  try {
    await run('UPDATE boxes SET state = ?, api_token = NULL WHERE box_id = ?', [
      'UNPAIRED',
      boxId,
    ]);
    await run('DELETE FROM box_tags WHERE box_id = ?', [boxId]);
    await run('DELETE FROM box_tag_blocks WHERE box_id = ?', [boxId]);
    if (queued) {
      for (const row of assignedTags) {
        if (!row.tag_uid) continue;
        await enqueueJob(boxId, 'tag_remove', { uid: row.tag_uid }, queueError);
      }
      await enqueueJob(boxId, 'unpair', {}, queueError);
    }
  } catch (error) {
    console.error('unpair update error:', error);
    return res.status(500).json({ detail: 'db error' });
  }

  res.json({ ok: true, queued });
});

ensureSchema()
  .then(() => ensureTagMediaColumn())
  .then(() => ensureTagBlockTable())
  .then(() => ensureBoxAliasColumn())
  .then(() => ensureBoxPortColumns())
  .then(() => ensureBoxMediaRootColumn())
  .then(() => ensureTagAssignments())
  .then(() => {
    ensureMediaSeed();
    app.listen(PORT, () => {
      console.log(`Klangkiste Backend listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database schema failed:', error);
    process.exit(1);
  });
