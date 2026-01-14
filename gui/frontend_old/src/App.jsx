import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowRight,
  CaretDown,
  CaretRight,
  FloppyDisk,
  FileAudio,
  Folder,
  List,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import {
  getBoxes,
  getStatus,
  getMediaTree,
  createMediaFolder,
  renameMedia,
  moveMedia,
  deleteMedia,
  uploadMedia,
  getTags,
  getBoxTags,
  getBoxLocalTags,
  getTagBlocks,
  claimTag,
  markTagWritten,
  assignTag,
  unassignTag,
  deleteTag,
  setTagMedia,
  pullTagFromBox,
  setTagBlock,
  setBoxAlias,
  setTagAlias,
  pairBox,
  sendCommand,
  unpairBox,
} from './api.js';

const BOX_POLL_MS = 1500;
const STATUS_POLL_MS = 1000;

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
}

function parseCapabilities(raw) {
  if (!raw) return '-';
  try {
    const data = JSON.parse(raw);
    return Object.entries(data)
      .map(([key, value]) => `${key}:${value ? '1' : '0'}`)
      .join(' ');
  } catch (error) {
    return '-';
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '-';
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateTagId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let generated = '';
  for (let i = 0; i < 10; i += 1) {
    generated += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return generated;
}

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [nfcUid, setNfcUid] = useState('UID_1');
  const [mediaTree, setMediaTree] = useState(null);
  const [mediaError, setMediaError] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [activeModal, setActiveModal] = useState('');
  const [tagDeleteTarget, setTagDeleteTarget] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(() => new Set(['__root__']));
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [uploadAfterCreate, setUploadAfterCreate] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [activeUploadLabel, setActiveUploadLabel] = useState('');
  const transferTimerRef = useRef(null);
  const explorerRef = useRef(null);
  const modalRef = useRef(null);
  const uploadDropInputRef = useRef(null);
  const dragSelectRef = useRef(false);
  const lastDblClickRef = useRef(0);
  const lastAnchorRef = useRef('');
  const explorerInitRef = useRef(false);
  const expandedInitRef = useRef(false);
  const [tags, setTags] = useState([]);
  const [boxTags, setBoxTags] = useState([]);
  const [blockedByBox, setBlockedByBox] = useState({});
  const [dbTagMedia, setDbTagMedia] = useState({});
  const [localBoxTags, setLocalBoxTags] = useState([]);
  const [localBoxError, setLocalBoxError] = useState('');
  const [importTargetFolder, setImportTargetFolder] = useState('');
  const [importTargetUid, setImportTargetUid] = useState('');
  const [scanTagUid, setScanTagUid] = useState('');
  const [scanTagLabel, setScanTagLabel] = useState('');
  const [scanMediaPath, setScanMediaPath] = useState('');
  const [reuseTagUid, setReuseTagUid] = useState('');
  const lastNfcKeyRef = useRef('');
  const toastCounter = useRef(0);
  const [toasts, setToasts] = useState([]);
  const [tagAliasDrafts, setTagAliasDrafts] = useState({});
  const [boxAliasDrafts, setBoxAliasDrafts] = useState({});

  function addToast(type, message) {
    const id = `${Date.now()}-${toastCounter.current}`;
    toastCounter.current += 1;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }

  useEffect(() => {
    let active = true;

    async function refreshBoxes() {
      const response = await getBoxes();
      if (!active) return;
      if (!response.ok) {
        setError(response.data.detail || 'Fehler beim Laden der Boxen.');
        return;
      }
      setBoxes(response.data.boxes || []);
      setError('');
    }

    refreshBoxes();
    const handle = setInterval(refreshBoxes, BOX_POLL_MS);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    function handleOutside(event) {
      if (activeModal) return;
      if (!explorerRef.current) return;
      if (modalRef.current && modalRef.current.contains(event.target)) return;
      if (!explorerRef.current.contains(event.target)) {
        setSelectedPaths([]);
        setRenameName('');
      }
    }
    function handleMouseUp() {
      dragSelectRef.current = false;
    }
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [activeModal]);

  useEffect(() => {
    if (!selectedId) {
      setStatus(null);
      setMediaTree(null);
      setMediaError('');
      setSelectedPaths([]);
      setNewFolderName('');
      setRenameName('');
      setActiveModal('');
      setBoxTags([]);
      setDbTagMedia({});
      setScanTagUid('');
      setScanTagLabel('');
      setScanMediaPath('');
      setReuseTagUid('');
      setLocalBoxTags([]);
      setLocalBoxError('');
      return;
    }

    let active = true;

    async function refreshStatus() {
      const response = await getStatus(selectedId);
      if (!active) return;
      if (!response.ok) {
        setStatus({ error: response.data.detail || 'Status nicht verfuegbar.' });
        return;
      }
      setStatus(response.data);
    }

    refreshStatus();
    const handle = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, [selectedId]);

  useEffect(() => {
    let active = true;

    async function refreshMedia() {
      const response = await getMediaTree();
      if (!active) return;
      if (!response.ok) {
        setMediaError(response.data.detail || 'Medien nicht verfuegbar.');
        setMediaTree(null);
        return;
      }
      setMediaTree(response.data);
      setMediaError('');
    }

    refreshMedia();
    return () => {
      active = false;
    };
  }, []);

  function findPathChain(node, target, chain = []) {
    if (!node) return null;
    const currentPath = node.path || '';
    const nextChain = [...chain, currentPath];
    if (currentPath === target) {
      return nextChain;
    }
    if (!Array.isArray(node.children)) return null;
    for (const child of node.children) {
      if (child.type !== 'folder') continue;
      const result = findPathChain(child, target, nextChain);
      if (result) return result;
    }
    return null;
  }

  useEffect(() => {
    if (!mediaTree) return;
    const saved = localStorage.getItem('klangkiste_explorer_path');
    if (saved === null) return;
    const chain = findPathChain(mediaTree, saved);
    if (!chain) return;
    setCurrentPath(saved);
    if (!expandedInitRef.current) {
      const savedExpandedRaw = localStorage.getItem('klangkiste_explorer_expanded');
      let savedExpanded = [];
      if (savedExpandedRaw) {
        try {
          const parsed = JSON.parse(savedExpandedRaw);
          if (Array.isArray(parsed)) {
            savedExpanded = parsed;
          }
        } catch (error) {
          savedExpanded = [];
        }
      }
      const merged = new Set([
        ...savedExpanded,
        ...chain.map((p) => (p ? p : '__root__')),
      ]);
      setExpandedFolders(merged);
      expandedInitRef.current = true;
    }
    explorerInitRef.current = true;
  }, [mediaTree]);

  useEffect(() => {
    if (!explorerInitRef.current) return;
    localStorage.setItem('klangkiste_explorer_path', currentPath || '');
  }, [currentPath]);

  useEffect(() => {
    if (!expandedInitRef.current) return;
    localStorage.setItem(
      'klangkiste_explorer_expanded',
      JSON.stringify(Array.from(expandedFolders))
    );
  }, [expandedFolders]);

  useEffect(() => {
    const lastNfc = status?.last_nfc;
    if (!lastNfc || lastNfc.known || !lastNfc.uid) {
      return;
    }
    const key = `${status?.last_nfc_at ?? ''}:${lastNfc.uid ?? ''}`;
    if (lastNfcKeyRef.current === key) {
      return;
    }
    lastNfcKeyRef.current = key;
    setScanTagLabel('');
    setScanMediaPath('');
    const hasUid = Boolean(lastNfc.uid);
    const existsInDb = hasUid && tags.some((tag) => tag.uid === lastNfc.uid);
    if (existsInDb) {
      setScanTagUid(lastNfc.uid);
    } else {
      setScanTagUid(generateTagId());
    }
  }, [status, tags]);

  useEffect(() => {
    let active = true;

    async function refreshTags() {
      const response = await getTags();
      if (!active) return;
      if (!response.ok) {
        setError(response.data.detail || 'Tags nicht verfuegbar.');
        return;
      }
      setTags(response.data.tags || []);
    }

    refreshTags();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;

    async function refreshBoxTags() {
      const response = await getBoxTags(selectedId);
      if (!active) return;
      if (!response.ok) {
        setError(response.data.detail || 'Box-Tags nicht verfuegbar.');
        return;
      }
      setBoxTags(response.data.tags || []);
    }

    refreshBoxTags();
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;

    async function refreshLocalTags() {
      const response = await getBoxLocalTags(selectedId);
      if (!active) return;
      if (!response.ok) {
        setLocalBoxError(response.data.detail || 'Lokale Box-Tags nicht verfuegbar.');
        return;
      }
      setLocalBoxTags(response.data.tags || []);
      setLocalBoxError('');
    }

    refreshLocalTags();
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    let active = true;

    async function refreshBlocked() {
      if (!boxes.length) {
        setBlockedByBox({});
        return;
      }
      const results = await Promise.all(
        boxes.map(async (box) => {
          const response = await getTagBlocks(box.box_id);
          return { boxId: box.box_id, response };
        })
      );
      if (!active) return;
      const next = {};
      results.forEach(({ boxId, response }) => {
        if (response.ok) {
          next[boxId] = response.data.blocked || [];
        }
      });
      setBlockedByBox(next);
    }

    refreshBlocked();
    return () => {
      active = false;
    };
  }, [boxes]);

  const unpaired = useMemo(
    () => boxes.filter((box) => box.state === 'UNPAIRED'),
    [boxes]
  );
  const paired = useMemo(
    () => boxes.filter((box) => box.state === 'PAIRED'),
    [boxes]
  );

  const mediaTagCounts = useMemo(() => {
    const counts = {};
    tags.forEach((tag) => {
      const mediaPath = tag.media_path || '';
      if (!mediaPath) return;
      counts[mediaPath] = (counts[mediaPath] || 0) + 1;
    });
    return counts;
  }, [tags]);

  const topLevelFolders = useMemo(() => {
    if (!mediaTree || !Array.isArray(mediaTree.children)) return [];
    const folders = mediaTree.children.filter((child) => child.type === 'folder');
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return folders;
    return folders.filter((folder) => (folder.name || '').toLowerCase().includes(query));
  }, [mediaTree, sidebarQuery]);

  const filteredTree = useMemo(() => {
    if (!mediaTree) return null;
    return {
      ...mediaTree,
      children: topLevelFolders,
    };
  }, [mediaTree, topLevelFolders]);

  async function handlePair(boxId) {
    const response = await pairBox(boxId);
    if (!response.ok) {
      setError(response.data.detail || 'Pairing fehlgeschlagen.');
      addToast('error', response.data.detail || 'Pairing fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', `Box ${boxId} gepairt.`);
  }

  async function handleCommand(command, payload = {}) {
    if (!selectedId) {
      setError('Bitte zuerst eine gepairte Box auswaehlen.');
      addToast('error', 'Bitte zuerst eine gepairte Box auswaehlen.');
      return;
    }
    const response = await sendCommand(selectedId, command, payload);
    if (!response.ok) {
      setError(response.data.detail || 'Command fehlgeschlagen.');
      addToast('error', response.data.detail || 'Command fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', `Command ausgefuehrt: ${command}`);
  }

  async function handleUnpair(boxId) {
    const response = await unpairBox(boxId);
    if (!response.ok) {
      setError(response.data.detail || 'Unpair fehlgeschlagen.');
      addToast('error', response.data.detail || 'Unpair fehlgeschlagen.');
      return;
    }
    if (selectedId === boxId) {
      setSelectedId('');
      setStatus(null);
    }
    setError('');
    addToast('success', `Box ${boxId} entkoppelt.`);
  }

  async function handleMediaRefresh() {
    const response = await getMediaTree();
    if (!response.ok) {
      setMediaError(response.data.detail || 'Medien nicht verfuegbar.');
      addToast('error', response.data.detail || 'Medien nicht verfuegbar.');
      setMediaTree(null);
      return;
    }
    setMediaTree(response.data);
    setMediaError('');
    addToast('success', 'Medienliste aktualisiert.');
  }

  function getNodeByPath(node, targetPath) {
    if (!node) return null;
    if ((node.path || '') === targetPath) return node;
    if (!Array.isArray(node.children)) return null;
    for (const child of node.children) {
      const found = getNodeByPath(child, targetPath);
      if (found) return found;
    }
    return null;
  }

  function listChildren(node) {
    if (!node || !Array.isArray(node.children)) return [];
    const folders = node.children.filter((child) => child.type === 'folder');
    const files = node.children.filter((child) => child.type === 'file');
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files];
  }

  function buildBreadcrumb(pathValue) {
    if (!pathValue) return [];
    const parts = pathValue.split('/').filter(Boolean);
    const crumbs = [];
    let acc = '';
    parts.forEach((part) => {
      acc = acc ? `${acc}/${part}` : part;
      crumbs.push({ name: part, path: acc });
    });
    return crumbs;
  }

  function collectTopLevelFolders(node) {
    if (!node || !Array.isArray(node.children)) return [];
    return node.children
      .filter((child) => child.type === 'folder' && child.path)
      .map((child) => child.path);
  }

  function collectFolderPaths(node) {
    if (!node || node.type !== 'folder') return [];
    const paths = [];
    if (node.path) paths.push(node.path);
    if (!Array.isArray(node.children)) return paths;
    node.children.forEach((child) => {
      if (child.type === 'folder') {
        paths.push(...collectFolderPaths(child));
      }
    });
    return paths;
  }

  function isSelected(pathValue) {
    return selectedPaths.includes(pathValue);
  }

  async function handleCreateFolder() {
    if (!uploadAfterCreate && !newFolderName.trim()) {
      addToast('error', 'Ordnername fehlt.');
      return;
    }
    if (uploadAfterCreate && pendingUploadFiles.length === 0) {
      addToast('error', 'Bitte Audiodateien auswaehlen.');
      return;
    }

    const trimmedName = newFolderName.trim();
    const needsFolder = uploadAfterCreate && !trimmedName && !currentPath;
    if (needsFolder) {
      addToast('error', 'Bitte zuerst einen Ordner anlegen.');
      return;
    }

    let targetPath = currentPath;
    if (trimmedName) {
      const response = await createMediaFolder(currentPath, trimmedName);
      if (!response.ok) {
        addToast('error', response.data.detail || 'Ordner anlegen fehlgeschlagen.');
        return;
      }
      targetPath = currentPath ? `${currentPath}/${trimmedName}` : trimmedName;
      addToast('success', 'Ordner angelegt.');
      await handleMediaRefresh();
    }

    setNewFolderName('');
    if (uploadAfterCreate) {
      setActiveUploadLabel(`Upload: ${pendingUploadFiles.length} Datei(en)`);
      setUploadInProgress(true);
      setUploadProgress(0);
      const uploadResponse = await uploadMedia(
        targetPath,
        pendingUploadFiles,
        (percent) => setUploadProgress(percent)
      );
      if (!uploadResponse.ok) {
        addToast('error', uploadResponse.data.detail || 'Upload fehlgeschlagen.');
        setUploadInProgress(false);
        return;
      }
      setUploadInProgress(false);
      setActiveUploadLabel('');
      setUploadAfterCreate(false);
      setPendingUploadFiles([]);
      if (targetPath) {
        setCurrentPath(targetPath);
      }
      addToast('success', 'Upload abgeschlossen.');
      await handleMediaRefresh();
      setActiveModal('');
      return;
    }

    setActiveModal('');
  }

  async function handleRename() {
    if (selectedPaths.length !== 1) {
      addToast('error', 'Bitte zuerst einen Eintrag waehlen.');
      return;
    }
    if (!renameName.trim()) {
      addToast('error', 'Neuer Name fehlt.');
      return;
    }
    const response = await renameMedia(selectedPaths[0], renameName.trim());
    if (!response.ok) {
      addToast('error', response.data.detail || 'Umbenennen fehlgeschlagen.');
      return;
    }
    setActiveModal('');
    addToast('success', 'Umbenannt.');
    await handleMediaRefresh();
  }

  async function handleDeleteSelected() {
    if (selectedPaths.length === 0) {
      addToast('error', 'Bitte zuerst einen Eintrag waehlen.');
      return;
    }
    for (const pathValue of selectedPaths) {
      const response = await deleteMedia(pathValue);
      if (!response.ok) {
        addToast('error', response.data.detail || 'Loeschen fehlgeschlagen.');
        return;
      }
    }
    setSelectedPaths([]);
    setRenameName('');
    setActiveModal('');
    addToast('success', 'Geloescht.');
    await handleMediaRefresh();
  }

  async function handleMoveSelected() {
    if (selectedPaths.length === 0) {
      addToast('error', 'Bitte zuerst einen Eintrag waehlen.');
      return;
    }
    if (!moveTarget) {
      addToast('error', 'Bitte Zielordner waehlen.');
      return;
    }
    const isRootTarget = moveTarget === '__root__';
    if (isRootTarget) {
      const hasFile = selectedPaths.some((pathValue) => {
        const node = getNodeByPath(mediaTree, pathValue);
        return node && node.type === 'file';
      });
      if (hasFile) {
        addToast('error', 'Dateien duerfen nicht in den Root-Ordner.');
        return;
      }
    }
    for (const pathValue of selectedPaths) {
      const response = await moveMedia(pathValue, isRootTarget ? '' : moveTarget);
      if (!response.ok) {
        addToast('error', response.data.detail || 'Verschieben fehlgeschlagen.');
        return;
      }
    }
    setActiveModal('');
    addToast('success', 'Verschoben.');
    await handleMediaRefresh();
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!currentPath) {
      addToast('error', 'Bitte zuerst einen Ordner anlegen.');
      event.target.value = '';
      return;
    }
    if (!files.length) return;
    const audioFiles = files.filter((file) => file.type.startsWith('audio/'));
    if (!audioFiles.length) {
      addToast('error', 'Nur Audiodateien erlaubt.');
      return;
    }
    setActiveUploadLabel(`Upload: ${audioFiles.length} Datei(en)`);
    setUploadInProgress(true);
    setUploadProgress(0);
    const response = await uploadMedia(currentPath, audioFiles, (percent) =>
      setUploadProgress(percent)
    );
    if (!response.ok) {
      addToast('error', response.data.detail || 'Upload fehlgeschlagen.');
      setUploadInProgress(false);
      setActiveUploadLabel('');
      return;
    }
    setUploadInProgress(false);
    setActiveUploadLabel('');
    addToast('success', 'Upload abgeschlossen.');
    await handleMediaRefresh();
  }

  function handleSelect(item, event) {
    const itemPath = item.path || '';
    if (Date.now() - lastDblClickRef.current < 250) {
      return;
    }
    if (event && event.shiftKey && lastAnchorRef.current) {
      const node = getNodeByPath(mediaTree, currentPath);
      const visible = listChildren(node).map((child) => child.path || '');
      const start = visible.indexOf(lastAnchorRef.current);
      const end = visible.indexOf(itemPath);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelectedPaths(visible.slice(from, to + 1));
        lastAnchorRef.current = itemPath;
        return;
      }
    }
    if (event && (event.metaKey || event.ctrlKey)) {
      setSelectedPaths((prev) =>
        prev.includes(itemPath)
          ? prev.filter((p) => p !== itemPath)
          : [...prev, itemPath]
      );
      lastAnchorRef.current = itemPath;
      return;
    }
    setSelectedPaths([itemPath]);
    setRenameName(item.name || '');
    lastAnchorRef.current = itemPath;
  }

  function handleDragSelect(item) {
    if (!dragSelectRef.current) return;
    const itemPath = item.path || '';
    setSelectedPaths((prev) =>
      prev.includes(itemPath) ? prev : [...prev, itemPath]
    );
  }

  function handleOpen(item) {
    if (item.type !== 'folder') return;
    setCurrentPath(item.path || '');
    setSelectedPaths([]);
    setRenameName('');
    const key = item.path || '__root__';
    setExpandedFolders((prev) => new Set(prev).add(key));
  }

  function handleGoUp() {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const next = parts.join('/');
    setCurrentPath(next);
    setSelectedPaths([]);
    setRenameName('');
  }

  function toggleFolder(pathValue) {
    const key = pathValue || '__root__';
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function renderFolderTree(node, depth = 0) {
    if (!node || node.type !== 'folder') return null;
    const isActive = (node.path || '') === currentPath;
    const key = node.path || '__root__';
    const isExpanded = expandedFolders.has(key);
    const childFolders =
      Array.isArray(node.children) && node.children.filter((child) => child.type === 'folder');
    const hasChildren = childFolders && childFolders.length > 0;
    const tagCount = mediaTagCounts[node.path || ''] || 0;
    return (
      <div key={node.path || 'root'} className={`tree-node depth-${depth}`}>
        <div
          className={`tree-row folder ${isActive ? 'active' : ''}`}
          onClick={() => handleOpen(node)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleOpen(node);
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="tree-caret"
              onClick={(event) => {
                event.stopPropagation();
                toggleFolder(node.path || '');
              }}
              aria-label="Toggle"
            >
              {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
            </button>
          ) : (
            <span className="tree-caret disabled" aria-hidden="true" />
          )}
          <span className="tree-icon folder">
            <Folder size={16} weight="fill" />
          </span>
          <span className="tree-label">{node.name}</span>
          {tagCount > 0 && (
            <span className="tree-tag-count" aria-label={`Zugewiesene Tags: ${tagCount}`}>
              {tagCount}
            </span>
          )}
        </div>
        {isExpanded &&
          hasChildren &&
          childFolders.map((child) => renderFolderTree(child, depth + 1))}
      </div>
    );
  }

  async function handleClaimTagForScan() {
    const currentUid = scanTagUid.trim();
    const existing = tags.find((tag) => tag.uid === currentUid);
    if (existing) {
      if (existing.status === 'NEW') {
        const written = await markTagWritten(currentUid);
        if (!written.ok) {
          setError(written.data.detail || 'Tag schreiben fehlgeschlagen.');
          addToast('error', written.data.detail || 'Tag schreiben fehlgeschlagen.');
          return;
        }
      }
    } else {
      const response = await claimTag(currentUid, scanTagLabel.trim());
      if (!response.ok) {
        setError(response.data.detail || 'Tag schreiben fehlgeschlagen.');
        addToast('error', response.data.detail || 'Tag schreiben fehlgeschlagen.');
        return;
      }
      setScanTagUid(response.data.uid || '');
    }
    setError('');
    addToast('success', 'Tag geschrieben.');
    const shouldAssign =
      selectedId && status?.last_nfc?.known === false && scanMediaPath;
    if (shouldAssign) {
      const mediaSet = await setTagMedia(currentUid, scanMediaPath);
      if (!mediaSet.ok) {
        setError(mediaSet.data.detail || 'Medium setzen fehlgeschlagen.');
        addToast('error', mediaSet.data.detail || 'Medium setzen fehlgeschlagen.');
        return;
      }
      const assigned = await assignTag(currentUid, selectedId);
      if (!assigned.ok) {
        setError(assigned.data.detail || 'Zuordnung fehlgeschlagen.');
        addToast('error', assigned.data.detail || 'Zuordnung fehlgeschlagen.');
        return;
      }
      addToast('success', 'Tag zugeordnet.');
      setScanTagUid('');
      setScanTagLabel('');
      setScanMediaPath('');
    } else if (selectedId && status?.last_nfc?.known === false) {
      addToast('success', 'Tag gespeichert. Medium fehlt noch.');
    }
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
    if (selectedId) {
      const updatedBoxTags = await getBoxTags(selectedId);
      if (updatedBoxTags.ok) {
        setBoxTags(updatedBoxTags.data.tags || []);
      }
    }
  }

  async function handleReuseImportedTag() {
    if (!reuseTagUid) {
      setError('Bitte eine gespeicherte Tag-ID waehlen.');
      addToast('error', 'Bitte eine gespeicherte Tag-ID waehlen.');
      return;
    }
    if (!selectedId) {
      setError('Bitte zuerst eine Box auswaehlen.');
      addToast('error', 'Bitte zuerst eine Box auswaehlen.');
      return;
    }
    const tag = tags.find((entry) => entry.uid === reuseTagUid);
    if (!tag || !tag.media_path) {
      setError('Tag hat keine Medienzuordnung.');
      addToast('error', 'Tag hat keine Medienzuordnung.');
      return;
    }
    const response = await markTagWritten(reuseTagUid);
    if (!response.ok) {
      setError(response.data.detail || 'Tag schreiben fehlgeschlagen.');
      addToast('error', response.data.detail || 'Tag schreiben fehlgeschlagen.');
      return;
    }
    const assigned = await assignTag(reuseTagUid, selectedId);
    if (!assigned.ok) {
      setError(assigned.data.detail || 'Zuordnung fehlgeschlagen.');
      addToast('error', assigned.data.detail || 'Zuordnung fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', 'Tag geschrieben und zugeordnet.');
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
    const updatedBoxTags = await getBoxTags(selectedId);
    if (updatedBoxTags.ok) {
      setBoxTags(updatedBoxTags.data.tags || []);
    }
    setScanTagUid(reuseTagUid);
    setReuseTagUid('');
  }

  async function handleWriteTag(uid) {
    const response = await markTagWritten(uid);
    if (!response.ok) {
      setError(response.data.detail || 'Tag schreiben fehlgeschlagen.');
      addToast('error', response.data.detail || 'Tag schreiben fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', 'Tag geschrieben.');
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
  }

  async function handleAssignFromScan() {
    if (!selectedId) {
      setError('Bitte zuerst eine Box auswaehlen.');
      addToast('error', 'Bitte zuerst eine Box auswaehlen.');
      return;
    }
    if (!scanMediaPath) {
      setError('Bitte Medienordner waehlen.');
      addToast('error', 'Bitte Medienordner waehlen.');
      return;
    }
    const uid = scanTagUid.trim();
    if (!uid) {
      setError('Bitte zuerst eine Tag-ID schreiben.');
      addToast('error', 'Bitte zuerst eine Tag-ID schreiben.');
      return;
    }
    const existing = tags.find((tag) => tag.uid === uid);
    if (!existing) {
      setError('Tag-ID existiert nicht. Bitte zuerst schreiben.');
      addToast('error', 'Tag-ID existiert nicht. Bitte zuerst schreiben.');
      return;
    }

    const mediaSet = await setTagMedia(uid, scanMediaPath);
    if (!mediaSet.ok) {
      setError(mediaSet.data.detail || 'Medium setzen fehlgeschlagen.');
      addToast('error', mediaSet.data.detail || 'Medium setzen fehlgeschlagen.');
      return;
    }
    const assigned = await assignTag(uid, selectedId);
    if (!assigned.ok) {
      setError(assigned.data.detail || 'Zuordnung fehlgeschlagen.');
      addToast('error', assigned.data.detail || 'Zuordnung fehlgeschlagen.');
      return;
    }

    setError('');
    addToast('success', 'Tag zugeordnet.');
    setScanTagUid('');
    setScanTagLabel('');
    setScanMediaPath('');
    const updatedTags = await getTags();
    if (updatedTags.ok) {
      setTags(updatedTags.data.tags || []);
    }
    const updatedBoxTags = await getBoxTags(selectedId);
    if (updatedBoxTags.ok) {
      setBoxTags(updatedBoxTags.data.tags || []);
    }
  }

  async function handlePullTagFromBox() {
    if (!selectedId) {
      setError('Bitte zuerst eine Box auswaehlen.');
      addToast('error', 'Bitte zuerst eine Box auswaehlen.');
      return;
    }
    if (!importTargetUid) {
      setError('Kein Tag ausgewaehlt.');
      addToast('error', 'Kein Tag ausgewaehlt.');
      return;
    }
    if (!importTargetFolder.trim()) {
      setError('Bitte Ordnernamen eingeben.');
      addToast('error', 'Bitte Ordnernamen eingeben.');
      return;
    }
    if (uploadInProgress) {
      addToast('error', 'Es laeuft bereits ein Upload/Transfer.');
      return;
    }
    const startTransferProgress = () => {
      setActiveUploadLabel(`Uebertragung: ${importTargetFolder.trim()}`);
      setUploadInProgress(true);
      setUploadProgress(5);
      if (transferTimerRef.current) {
        clearInterval(transferTimerRef.current);
      }
      transferTimerRef.current = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
      }, 400);
    };
    const stopTransferProgress = (success) => {
      if (transferTimerRef.current) {
        clearInterval(transferTimerRef.current);
        transferTimerRef.current = null;
      }
      if (success) {
        setUploadProgress(100);
        setTimeout(() => {
          setUploadInProgress(false);
          setUploadProgress(0);
          setActiveUploadLabel('');
        }, 600);
        return;
      }
      setUploadInProgress(false);
      setUploadProgress(0);
      setActiveUploadLabel('');
    };
    startTransferProgress();
    const response = await pullTagFromBox(
      selectedId,
      importTargetUid,
      importTargetFolder.trim()
    );
    if (!response.ok) {
      setError(response.data.detail || 'Import fehlgeschlagen.');
      addToast('error', response.data.detail || 'Import fehlgeschlagen.');
      stopTransferProgress(false);
      return;
    }
    addToast('success', 'Medien vom Box-Tag uebertragen.');
    setImportTargetFolder('');
    setImportTargetUid('');
    setActiveModal('');
    stopTransferProgress(true);
    const updatedTags = await getTags();
    if (updatedTags.ok) {
      setTags(updatedTags.data.tags || []);
    }
    const updatedLocal = await getBoxLocalTags(selectedId);
    if (updatedLocal.ok) {
      setLocalBoxTags(updatedLocal.data.tags || []);
    }
    await handleMediaRefresh();
  }

  async function handleUnassignTag(uid) {
    if (!selectedId) return;
    const response = await unassignTag(uid, selectedId);
    if (!response.ok) {
      setError(response.data.detail || 'Zuordnung loeschen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Zuordnung loeschen fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', 'Zuordnung entfernt.');
    const updated = await getBoxTags(selectedId);
    if (updated.ok) {
      setBoxTags(updated.data.tags || []);
    }
  }

  async function handleDeleteTag(uid) {
    const response = await deleteTag(uid);
    if (!response.ok) {
      setError(response.data.detail || 'Tag loeschen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Tag loeschen fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', 'Tag geloescht.');
    const updatedTags = await getTags();
    if (updatedTags.ok) {
      setTags(updatedTags.data.tags || []);
    }
    if (selectedId) {
      const updatedBoxTags = await getBoxTags(selectedId);
      if (updatedBoxTags.ok) {
        setBoxTags(updatedBoxTags.data.tags || []);
      }
    }
    if (boxes.length) {
      const results = await Promise.all(
        boxes.map(async (box) => ({
          boxId: box.box_id,
          response: await getTagBlocks(box.box_id),
        }))
      );
      const next = {};
      results.forEach(({ boxId, response }) => {
        if (response.ok) {
          next[boxId] = response.data.blocked || [];
        }
      });
      setBlockedByBox(next);
    }
  }

  async function handleSetTagMedia(uid) {
    const mediaPath = dbTagMedia[uid] || '';
    const response = await setTagMedia(uid, mediaPath);
    if (!response.ok) {
      setError(response.data.detail || 'Medium setzen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Medium setzen fehlgeschlagen.');
      return;
    }
    let assigned = null;
    const lastNfcUid = status?.last_nfc?.uid || '';
    const shouldAssign =
      selectedId &&
      status?.last_nfc?.known === false &&
      ((lastNfcUid && lastNfcUid === uid) ||
        (!lastNfcUid && scanTagUid && scanTagUid === uid));
    if (shouldAssign) {
      assigned = await assignTag(uid, selectedId);
      if (!assigned.ok) {
        setError(assigned.data.detail || 'Zuordnung fehlgeschlagen.');
        addToast('error', assigned.data.detail || 'Zuordnung fehlgeschlagen.');
        return;
      }
    }
    setError('');
    if (!mediaPath) {
      addToast('success', 'Medium entfernt.');
    } else if (assigned) {
      addToast('success', 'Medium gespeichert und Tag zugeordnet.');
    } else {
      addToast('success', 'Medium gespeichert.');
    }
    const updatedTags = await getTags();
    if (updatedTags.ok) {
      setTags(updatedTags.data.tags || []);
    }
    if (selectedId) {
      const updatedBoxTags = await getBoxTags(selectedId);
      if (updatedBoxTags.ok) {
        setBoxTags(updatedBoxTags.data.tags || []);
      }
    }
    if (boxes.length) {
      const results = await Promise.all(
        boxes.map(async (box) => ({
          boxId: box.box_id,
          response: await getTagBlocks(box.box_id),
        }))
      );
      const next = {};
      results.forEach(({ boxId, response }) => {
        if (response.ok) {
          next[boxId] = response.data.blocked || [];
        }
      });
      setBlockedByBox(next);
    }
  }

  async function handleClearTagMedia(uid) {
    const response = await setTagMedia(uid, '');
    if (!response.ok) {
      setError(response.data.detail || 'Medium entfernen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Medium entfernen fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', 'Medium entfernt.');
    setDbTagMedia((prev) => ({ ...prev, [uid]: '' }));
    const updatedTags = await getTags();
    if (updatedTags.ok) {
      setTags(updatedTags.data.tags || []);
    }
    if (selectedId) {
      const updatedBoxTags = await getBoxTags(selectedId);
      if (updatedBoxTags.ok) {
        setBoxTags(updatedBoxTags.data.tags || []);
      }
    }
    if (boxes.length) {
      const results = await Promise.all(
        boxes.map(async (box) => ({
          boxId: box.box_id,
          response: await getTagBlocks(box.box_id),
        }))
      );
      const next = {};
      results.forEach(({ boxId, response }) => {
        if (response.ok) {
          next[boxId] = response.data.blocked || [];
        }
      });
      setBlockedByBox(next);
    }
  }

  async function handleToggleTagBlock(boxId, uid, nextBlocked) {
    const response = await setTagBlock(boxId, uid, nextBlocked);
    if (!response.ok) {
      addToast('error', response.data.detail || 'Tag-Sperre fehlgeschlagen.');
      return;
    }
    setBlockedByBox((prev) => {
      const current = new Set(prev[boxId] || []);
      if (nextBlocked) {
        current.add(uid);
      } else {
        current.delete(uid);
      }
      return { ...prev, [boxId]: Array.from(current) };
    });
    addToast(
      'success',
      nextBlocked ? 'Tag gesperrt.' : 'Tag freigegeben.'
    );
  }

  async function handleSaveTagAlias(uid) {
    const value = (tagAliasDrafts[uid] ?? '').trim();
    const response = await setTagAlias(uid, value || null);
    if (!response.ok) {
      addToast('error', response.data.detail || 'Tag-Alias speichern fehlgeschlagen.');
      return;
    }
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
    addToast('success', 'Tag-Alias gespeichert.');
  }

  async function handleSaveBoxAlias(boxId) {
    const value = (boxAliasDrafts[boxId] ?? '').trim();
    const response = await setBoxAlias(boxId, value || null);
    if (!response.ok) {
      addToast('error', response.data.detail || 'Box-Alias speichern fehlgeschlagen.');
      return;
    }
    const updated = await getBoxes();
    if (updated.ok) {
      setBoxes(updated.data.boxes || []);
    }
    addToast('success', 'Box-Alias gespeichert.');
  }

  const currentItems = mediaTree
    ? listChildren(getNodeByPath(mediaTree, currentPath))
    : [];
  const showMeta = currentItems.some((item) => item.type === 'file');
  const mediaBytes = mediaTree?.size ?? null;
  const freeBytes = mediaTree?.free_bytes ?? null;

  return (
    <div className="page">
      <header>
        <h1>Klangkiste Control Panel</h1>
        <p>Backend: {import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5001'}</p>
      </header>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        <div className="panel">
          <h2>Neue Boxen</h2>
          {unpaired.length === 0 && <p className="muted">Keine neuen Boxen.</p>}
          {unpaired.map((box) => (
            <div key={box.box_id} className="card">
              <div>
                <strong>{box.alias || box.box_id}</strong>
                <div className="meta">Zuletzt gesehen: {formatTime(box.last_seen)}</div>
                <div className="meta">Firmware: {box.firmware_version}</div>
                <div className="meta">ID: {box.box_id}</div>
              </div>
              <button onClick={() => handlePair(box.box_id)}>Pairen</button>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Gepairte Boxen</h2>
          {paired.length === 0 && <p className="muted">Noch keine gepairten Boxen.</p>}
          {paired.map((box) => (
            <div
              key={box.box_id}
              className={`card ${selectedId === box.box_id ? 'selected' : ''}`}
              onClick={() => setSelectedId(box.box_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setSelectedId(box.box_id);
              }}
            >
              <div>
                <strong>{box.alias || box.box_id}</strong>
                <div className="meta">Zuletzt gesehen: {formatTime(box.last_seen)}</div>
                <div className="meta">Capabilities: {parseCapabilities(box.capabilities_json)}</div>
                <div className="meta">ID: {box.box_id}</div>
              </div>
              <div className="stack">
                <input
                  className="alias-input"
                  placeholder="Alias"
                  value={
                    boxAliasDrafts[box.box_id] !== undefined
                      ? boxAliasDrafts[box.box_id]
                      : box.alias || ''
                  }
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    setBoxAliasDrafts((prev) => ({
                      ...prev,
                      [box.box_id]: event.target.value,
                    }));
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveBoxAlias(box.box_id);
                  }}
                  title="Alias speichern"
                >
                  <FloppyDisk size={16} />
                </button>
                <span className="pill">{box.state}</span>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleUnpair(box.box_id);
                  }}
                >
                  Unpair
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Live-Status</h2>
          {!selectedId && <p className="muted">Waehle eine gepairte Box aus.</p>}
          {selectedId && !status && <p className="muted">Status wird geladen...</p>}
          {status && status.error && <p className="error">{status.error}</p>}
          {status && !status.error && (
            <pre className="status">{JSON.stringify(status, null, 2)}</pre>
          )}
        </div>

        <div className="panel">
          <h2>Commands</h2>
          <div className="controls">
            <button onClick={() => handleCommand('play_pause')}>Play/Pause</button>
            <button onClick={() => handleCommand('next')}>Next</button>
            <button onClick={() => handleCommand('prev')}>Prev</button>
            <button onClick={() => handleCommand('vol_up')}>Vol +</button>
            <button onClick={() => handleCommand('vol_down')}>Vol -</button>
            <button onClick={() => handleCommand('stop')}>Stop</button>
          </div>
          <div className="controls">
            <input
              value={nfcUid}
              onChange={(event) => setNfcUid(event.target.value)}
              placeholder="UID_1"
            />
            <button onClick={() => handleCommand('nfc_on', { uid: nfcUid })}>
              NFC on
            </button>
            <button onClick={() => handleCommand('nfc_off', { uid: nfcUid })}>
              NFC off
            </button>
          </div>
          <p className="muted">
            Steuerung ist nur moeglich, wenn die Box gepairt ist.
          </p>
        </div>
      </section>

      {activeModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveModal('');
            setUploadAfterCreate(false);
            setPendingUploadFiles([]);
            setTagDeleteTarget('');
          }}
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            ref={modalRef}
          >
            {activeModal === 'new-folder' && (
              <>
                <h3>{uploadAfterCreate ? 'Upload vorbereiten' : 'Neuen Ordner anlegen'}</h3>
                <input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder={
                    uploadAfterCreate
                      ? 'Optionaler Ordnername (leer = aktueller Ordner)'
                      : 'Ordnername'
                  }
                />
                {uploadAfterCreate && (
                  <>
                    <div
                      className={`upload-dropzone ${uploadInProgress ? 'disabled' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (uploadInProgress) return;
                        uploadDropInputRef.current?.click();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') uploadDropInputRef.current?.click();
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (uploadInProgress) return;
                        const files = Array.from(event.dataTransfer.files || []);
                        const audioFiles = files.filter((file) =>
                          file.type.startsWith('audio/')
                        );
                        setPendingUploadFiles(audioFiles);
                        setActiveUploadLabel(
                          audioFiles.length
                            ? `Upload: ${audioFiles.length} Datei(en)`
                            : ''
                        );
                      }}
                    >
                      <div className="dropzone-title">Audiodateien auswaehlen</div>
                      <div className="dropzone-hint">
                        Datei hier ablegen oder klicken, um auszuwaehlen
                      </div>
                      {pendingUploadFiles.length > 0 && (
                        <div className="dropzone-files">
                          {pendingUploadFiles.map((file) => (
                            <div key={file.name}>{file.name}</div>
                          ))}
                        </div>
                      )}
                      <input
                        ref={uploadDropInputRef}
                        type="file"
                        multiple
                        accept="audio/*"
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          const audioFiles = files.filter((file) =>
                            file.type.startsWith('audio/')
                          );
                          setPendingUploadFiles(audioFiles);
                          setActiveUploadLabel(
                            audioFiles.length
                              ? `Upload: ${audioFiles.length} Datei(en)`
                              : ''
                          );
                        }}
                      />
                    </div>
                    <p className="muted">
                      Upload startet direkt. Ohne Ordnername landet er im aktuellen Ordner.
                    </p>
                    {uploadInProgress && (
                      <div className="upload-progress">
                        <div style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      setActiveModal('');
                      setUploadAfterCreate(false);
                      setPendingUploadFiles([]);
                      setActiveUploadLabel('');
                    }}
                  >
                    Abbrechen
                  </button>
                  <button type="button" onClick={handleCreateFolder} disabled={uploadInProgress}>
                    Anlegen
                  </button>
                </div>
              </>
            )}
            {activeModal === 'rename' && (
              <>
                <h3>Umbenennen</h3>
                <input
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  placeholder="Neuer Name"
                />
                <div className="modal-actions">
                  <button type="button" className="button-ghost" onClick={() => setActiveModal('')}>
                    Abbrechen
                  </button>
                  <button type="button" onClick={handleRename}>
                    Speichern
                  </button>
                </div>
              </>
            )}
            {activeModal === 'delete' && (
              <>
                <h3>Loeschen</h3>
                <p className="muted">
                  {selectedPaths.length} Eintrag(e) wirklich loeschen?
                </p>
                <div className="modal-actions">
                  <button type="button" className="button-ghost" onClick={() => setActiveModal('')}>
                    Abbrechen
                  </button>
                  <button type="button" onClick={handleDeleteSelected}>
                    Loeschen
                  </button>
                </div>
              </>
            )}
            {activeModal === 'move' && (
              <>
                <h3>Verschieben</h3>
                {selectedPaths.length > 0 &&
                  selectedPaths.every((pathValue) => {
                    const node = getNodeByPath(mediaTree, pathValue);
                    return node && node.type === 'file';
                  }) && (
                    <p className="muted">
                      Dateien duerfen nicht in den Root-Ordner verschoben werden.
                    </p>
                  )}
                <select
                  value={moveTarget}
                  onChange={(event) => setMoveTarget(event.target.value)}
                >
                  <option value="">Zielordner waehlen</option>
                  {selectedPaths.length > 0 &&
                  selectedPaths.every((pathValue) => {
                    const node = getNodeByPath(mediaTree, pathValue);
                    return node && node.type === 'folder';
                  }) ? (
                    <option value="__root__">media (Root)</option>
                  ) : null}
                  {collectFolderPaths(mediaTree)
                    .filter((pathValue) => pathValue && pathValue !== currentPath)
                    .map((folderPath) => (
                      <option key={folderPath} value={folderPath}>
                        {folderPath}
                      </option>
                    ))}
                </select>
                <div className="modal-actions">
                  <button type="button" className="button-ghost" onClick={() => setActiveModal('')}>
                    Abbrechen
                  </button>
                  <button type="button" onClick={handleMoveSelected}>
                    Verschieben
                  </button>
                </div>
              </>
            )}
      {activeModal === 'tag-delete' && (
              <>
                <h3>Tag entfernen</h3>
                <p className="muted">
                  Was moechtest du entfernen?
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      setActiveModal('');
                      setTagDeleteTarget('');
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={async () => {
                      if (!tagDeleteTarget) return;
                      await handleClearTagMedia(tagDeleteTarget);
                      setActiveModal('');
                      setTagDeleteTarget('');
                    }}
                  >
                    Medienzuweisung loeschen
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={async () => {
                      if (!tagDeleteTarget) return;
                      await handleDeleteTag(tagDeleteTarget);
                      setActiveModal('');
                      setTagDeleteTarget('');
                    }}
                  >
                    Tag loeschen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeModal === 'import-tag' && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card" ref={modalRef}>
            <div className="modal-header">
              <h3>Tag vom Box-Speicher uebertragen</h3>
            </div>
            <div className="modal-body">
              <label className="modal-label" htmlFor="import-folder">
                Neuer Ordnername auf dem Server
              </label>
              <input
                id="import-folder"
                value={importTargetFolder}
                onChange={(event) => setImportTargetFolder(event.target.value)}
                placeholder="z. B. grimm_volume_3"
              />
              {uploadInProgress && (
                <div className="upload-progress">
                  <div style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setActiveModal('');
                  setImportTargetFolder('');
                  setImportTargetUid('');
                }}
              >
                Abbrechen
              </button>
              <button type="button" onClick={handlePullTagFromBox}>
                Uebertragen
              </button>
            </div>
          </div>
        </div>
      )}

      {status?.last_nfc && status.last_nfc.known === false && status.last_nfc.uid && (
        <section className="panel">
          <h2>
            {tags.find((tag) => tag.uid === status.last_nfc.uid && !tag.media_path)
              ? 'Leerer Tag erkannt'
              : 'Neuer Tag erkannt'}
          </h2>
          <p className="muted">
            UID erkannt: <strong>{status.last_nfc.uid || '-'}</strong>
          </p>
          {tags.find((tag) => tag.uid === status.last_nfc.uid) && (
            <p className="muted">
              Dieser Tag ist bekannt, aber noch nicht zugewiesen.
            </p>
          )}
          {!tags.find((tag) => tag.uid === status.last_nfc.uid && !tag.media_path) && (
            <div className="controls">
              <input value={scanTagUid} readOnly placeholder="Neue Tag-ID (10 Zeichen)" />
              <input
                value={scanTagLabel}
                onChange={(event) => setScanTagLabel(event.target.value)}
                placeholder="Label (optional)"
              />
              <button type="button" className="button-ghost" onClick={handleClaimTagForScan}>
                ID zuweisen & schreiben
              </button>
            </div>
          )}
          {tags.some((tag) => tag.status === 'IMPORTED') && (
            <div className="controls">
              <select
                value={reuseTagUid}
                onChange={(event) => setReuseTagUid(event.target.value)}
              >
                <option value="" disabled>
                  Gespeicherte Tag-ID waehlen
                </option>
                {tags
                  .filter((tag) => tag.status === 'IMPORTED')
                  .map((tag) => (
                    <option key={tag.uid} value={tag.uid}>
                      {tag.alias ? `${tag.alias} (${tag.uid})` : tag.uid}
                    </option>
                  ))}
              </select>
              <button type="button" onClick={handleReuseImportedTag}>
                Vorhandene ID schreiben
              </button>
            </div>
          )}
          <div className="controls">
            <select
              value={scanMediaPath}
              onChange={(event) => setScanMediaPath(event.target.value)}
            >
              <option value="" disabled>
                Medienordner waehlen
              </option>
              {collectTopLevelFolders(mediaTree).map((folderPath) => (
                <option key={folderPath} value={folderPath}>
                  {folderPath}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssignFromScan}
              disabled={
                !tags.find(
                  (tag) => tag.uid === scanTagUid && tag.status !== 'NEW'
                )
              }
            >
              Medien zuordnen
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>Medien Explorer</h2>
          <button type="button" className="button-ghost" onClick={handleMediaRefresh}>
            Refresh
          </button>
        </div>
        {uploadInProgress && (
          <div className="upload-status">
            <span>{activeUploadLabel || 'Upload laeuft...'}</span>
            <div className="upload-progress">
              <div style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        <p className="muted">Ordnerverwaltung, Upload und Datei-Listen im Server-Medienordner.</p>
        {mediaError && <p className="error">{mediaError}</p>}
        {!mediaError && !mediaTree && <p className="muted">Medienliste wird geladen...</p>}
        {!mediaError && mediaTree && (
          <div className="explorer" ref={explorerRef}>
            <div className="explorer-sidebar">
              <div className="explorer-toolbar sidebar-toolbar">
                <input
                  className="sidebar-search"
                  type="search"
                  placeholder="Suchen..."
                  value={sidebarQuery}
                  onChange={(event) => setSidebarQuery(event.target.value)}
                  aria-label="Ordner suchen"
                />
              </div>
              <div className="sidebar-tree">
                {topLevelFolders.length === 0 && (
                  <div className="muted">Keine Ordner gefunden.</div>
                )}
                {filteredTree && renderFolderTree(filteredTree, 0)}
              </div>
            </div>
            <div className="explorer-main">
              <div className="explorer-toolbar">
                <button type="button" className="icon-button" onClick={handleGoUp} title="Hoch">
                  <ArrowUp size={16} />
                </button>
                <div className="explorer-path">
                  <span
                    className="breadcrumb-root path-link"
                    onClick={() => setCurrentPath('')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') setCurrentPath('');
                    }}
                  >
                    media
                  </span>
                  {buildBreadcrumb(currentPath).map((crumb) => (
                    <span
                      key={crumb.path}
                      className="path-link"
                      onClick={() => setCurrentPath(crumb.path)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') setCurrentPath(crumb.path);
                      }}
                    >
                      / {crumb.name}
                    </span>
                  ))}
                </div>
                <div className="toolbar-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setActiveModal('new-folder')}
                    title="Neuer Ordner"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setActiveModal('rename')}
                    title="Umbenennen"
                    disabled={selectedPaths.length !== 1}
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => setActiveModal('delete')}
                    title="Loeschen"
                    disabled={selectedPaths.length === 0}
                  >
                    <Trash size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setMoveTarget('');
                      setActiveModal('move');
                    }}
                    title="Verschieben"
                    disabled={selectedPaths.length === 0}
                  >
                    <ArrowRight size={16} />
                  </button>
                  <label
                    className="icon-button upload"
                    title="Upload"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setUploadAfterCreate(true);
                      setPendingUploadFiles([]);
                      setNewFolderName('');
                      setActiveModal('new-folder');
                    }}
                  >
                    <UploadSimple size={16} />
                  </label>
                </div>
              </div>
              <div className={`explorer-list ${showMeta ? 'has-meta' : ''}`}>
                <div className="explorer-row header">
                  <span>Name</span>
                  {showMeta ? (
                    <>
                      <span>Interpret</span>
                      <span>Titel</span>
                      <span>Länge</span>
                      <span>Größe</span>
                    </>
                  ) : (
                    <>
                      <span>Typ</span>
                      <span>Größe</span>
                    </>
                  )}
                </div>
                {currentItems.map((item) => (
                  <div
                    key={item.path || item.name}
                    className={`explorer-row ${
                      isSelected(item.path) ? 'selected' : ''
                    }`}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      if (event.metaKey || event.ctrlKey || event.shiftKey) {
                        return;
                      }
                      dragSelectRef.current = true;
                      handleSelect(item, event);
                    }}
                    onMouseEnter={() => handleDragSelect(item)}
                    onClick={(event) => handleSelect(item, event)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      lastDblClickRef.current = Date.now();
                      handleOpen(item);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleOpen(item);
                    }}
                  >
                    <span className="row-name">
                      <span className="row-icon">
                        {item.type === 'folder' ? (
                          <Folder size={16} weight="fill" />
                        ) : (
                          <FileAudio size={16} />
                        )}
                      </span>
                      {item.name}
                    </span>
                    {showMeta ? (
                      <>
                        <span>{item.type === 'folder' ? '-' : item.artist || '-'}</span>
                        <span>{item.type === 'folder' ? '-' : item.title || '-'}</span>
                        <span>
                          {item.type === 'folder' ? '-' : formatDuration(item.duration)}
                        </span>
                        <span>{formatSize(item.size)}</span>
                      </>
                    ) : (
                      <>
                        <span>{item.type === 'folder' ? 'Ordner' : 'Datei'}</span>
                        <span>{formatSize(item.size)}</span>
                      </>
                    )}
                  </div>
                ))}
                {selectedPaths.length > 0 && (
                  <div className="explorer-row footer">
                    <span />
                    {showMeta ? (
                      <>
                        <span />
                        <span />
                        <span />
                        <span className="footer-count">
                          {selectedPaths.length} ausgewaehlt
                        </span>
                      </>
                    ) : (
                      <>
                        <span />
                        <span className="footer-count">
                          {selectedPaths.length} ausgewaehlt
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="explorer-footer">
              <span>
                Medienordner: {formatSize(mediaBytes)} · Verfügbar:{' '}
                {formatSize(freeBytes)}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Tags nur auf dieser Box</h2>
        </div>
        {localBoxError && <p className="error">{localBoxError}</p>}
        {!localBoxError && localBoxTags.length === 0 && (
          <p className="muted">Keine lokalen Tags ohne Server-Zuordnung.</p>
        )}
        {localBoxTags.map((tag) => (
          <div key={tag.uid} className="box-tag-row">
            <div>
              <strong>{tag.uid}</strong>
              <div className="muted">
                Dateien: {tag.file_count} · {formatSize(tag.total_size)}
              </div>
              {tag.media_exists && tag.files?.length > 0 && (
                <ul className="file-list">
                  {tag.files.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              )}
              {!tag.media_exists && (
                <p className="muted">Keine Dateien im Box-Ordner gefunden.</p>
              )}
            </div>
            <div className="box-tag-actions">
              <button
                type="button"
                onClick={() => {
                  setImportTargetUid(tag.uid);
                  setActiveModal('import-tag');
                }}
                disabled={!tag.media_exists}
              >
                Auf Server uebertragen
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Tags (Datenbank)</h2>
          {tags.length === 0 && <p className="muted">Keine Tags vorhanden.</p>}
          {tags.map((tag) => (
            <div key={tag.uid} className="card compact">
              <div className="tag-row">
                <div className="tag-info">
                  <strong>
                    {tag.alias ? `${tag.alias} (${tag.uid})` : tag.uid}
                  </strong>
                  <div className="meta">Status: {tag.status}</div>
                  <div className="meta">Medium: {tag.media_path || '-'}</div>
                  {tag.label ? <div className="meta">Label: {tag.label}</div> : null}
                </div>
                <div className="stack stack-inline">
                  <input
                    className="alias-input"
                    placeholder="Alias"
                    value={
                      tagAliasDrafts[tag.uid] !== undefined
                        ? tagAliasDrafts[tag.uid]
                        : tag.alias || ''
                    }
                    onChange={(event) =>
                      setTagAliasDrafts((prev) => ({
                        ...prev,
                        [tag.uid]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => handleSaveTagAlias(tag.uid)}
                    title="Alias speichern"
                  >
                    <FloppyDisk size={16} />
                  </button>
                  <select
                    value={dbTagMedia[tag.uid] ?? tag.media_path ?? ''}
                    onChange={(event) =>
                      setDbTagMedia((prev) => ({
                        ...prev,
                        [tag.uid]: event.target.value,
                      }))
                    }
                  >
                    <option value="" disabled>
                      Medienordner waehlen
                    </option>
                    {collectTopLevelFolders(mediaTree).map((folderPath) => (
                      <option key={folderPath} value={folderPath}>
                        {folderPath}
                      </option>
                    ))}
                  </select>
                  {dbTagMedia[tag.uid] !== undefined &&
                  dbTagMedia[tag.uid] !== (tag.media_path ?? '') ? (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => handleSetTagMedia(tag.uid)}
                      disabled={!mediaTree}
                      title="Medium speichern"
                    >
                      <FloppyDisk size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => {
                      setTagDeleteTarget(tag.uid);
                      setActiveModal('tag-delete');
                    }}
                    title="Loeschen"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Tag-Matrix (Sperren)</h2>
        {paired.length === 0 && (
          <p className="muted">Keine gepairten Boxen vorhanden.</p>
        )}
        {tags.length === 0 && <p className="muted">Keine Tags vorhanden.</p>}
          {paired.length > 0 && tags.length > 0 && (
            <div className="tag-matrix">
              <div className="matrix-row header">
                <span className="matrix-cell label">Tag</span>
                {paired.map((box) => (
                  <span key={box.box_id} className="matrix-cell">
                    {box.alias || box.box_id}
                  </span>
                ))}
              </div>
              {tags.map((tag) => (
                <div key={tag.uid} className="matrix-row">
                  <span className="matrix-cell label">{tag.alias || tag.uid}</span>
                  {paired.map((box) => {
                    const blocked = (blockedByBox[box.box_id] || []).includes(tag.uid);
                  return (
                    <label key={box.box_id} className="matrix-cell toggle">
                      <input
                        type="checkbox"
                        checked={blocked}
                        onChange={(event) =>
                          handleToggleTagBlock(
                            box.box_id,
                            tag.uid,
                            event.target.checked
                          )
                        }
                      />
                      <span>{blocked ? 'Gesperrt' : 'OK'}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
