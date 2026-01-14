import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  CaretDown,
  CaretRight,
  FileAudio,
  FloppyDisk,
  Folder,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import { Avatar } from 'primereact/avatar';
import { Badge } from 'primereact/badge';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import {
  assignTag,
  claimTag,
  createMediaFolder,
  deleteMedia,
  deleteTag,
  getBoxes,
  getBoxLocalTags,
  getBoxTags,
  getMediaTree,
  getStatus,
  getTagBlocks,
  getTags,
  markTagWritten,
  moveMedia,
  pairBox,
  pullTagFromBox,
  renameMedia,
  sendCommand,
  setBoxAlias,
  setTagAlias,
  setTagBlock,
  setTagMedia,
  unassignTag,
  unpairBox,
  uploadMedia,
} from './api.js';

const BOX_POLL_MS = 1500;
const STATUS_POLL_MS = 1000;

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'pi pi-home' },
  { id: 'boxes', label: 'Boxen', icon: 'pi pi-box' },
  { id: 'media', label: 'Medien', icon: 'pi pi-folder-open' },
  { id: 'tags', label: 'Tags', icon: 'pi pi-tags' },
  { id: 'settings', label: 'Einstellungen', icon: 'pi pi-cog' },
];

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

function generateHardwareUid() {
  const bytes = [];
  for (let i = 0; i < 7; i += 1) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes
    .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="section-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="section-actions">{actions}</div>
    </div>
  );
}

function StatGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((card) => (
        <Card key={card.label} className="stat-card">
          <p className="stat-label">{card.label}</p>
          <div className="stat-value">{card.value}</div>
          <span className="stat-helper">{card.helper}</span>
        </Card>
      ))}
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [searchValue, setSearchValue] = useState('');
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
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [lastHardwareUid, setLastHardwareUid] = useState({ uid: '', hardwareUid: '' });
  const [simulatedNfc, setSimulatedNfc] = useState(null);

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
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('mouseup', handleMouseUp);
    };
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
    if (!lastNfc || !lastNfc.uid) {
      return;
    }
    if (!lastNfc.known) {
      const key = `${status?.last_nfc_at ?? ''}:${lastNfc.uid ?? ''}`;
      if (lastNfcKeyRef.current === key) {
        return;
      }
      lastNfcKeyRef.current = key;
      setScanTagLabel('');
      setScanMediaPath('');
      setScanTagUid(lastNfc.uid);
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

  const dashboardStats = useMemo(() => {
    const sizeLabel = mediaTree ? formatSize(mediaTree.size) : '-';
    const freeLabel = mediaTree ? formatSize(mediaTree.free_bytes) : '-';
    return [
      {
        label: 'Gepairte Boxen',
        value: paired.length,
        helper: `${unpaired.length} neu`,
      },
      {
        label: 'Tags gesamt',
        value: tags.length,
        helper: `${boxTags.length} auf Box`,
      },
      {
        label: 'Medien gesamt',
        value: sizeLabel,
        helper: `frei ${freeLabel}`,
      },
      {
        label: 'Letzter NFC',
        value: status?.last_nfc?.uid || '-',
        helper: status?.last_nfc_at ? formatTime(status.last_nfc_at) : '-',
      },
    ];
  }, [paired.length, unpaired.length, tags.length, boxTags.length, mediaTree, status]);

  async function handlePair(boxId) {
    const response = await pairBox(boxId);
    if (!response.ok) {
      setError(response.data.detail || 'Box pairing fehlgeschlagen.');
      addToast('error', response.data.detail || 'Box pairing fehlgeschlagen.');
      return;
    }
    addToast('success', 'Box gepairt.');
    const updated = await getBoxes();
    if (updated.ok) {
      setBoxes(updated.data.boxes || []);
    }
  }

  async function handleCommand(command, payload = {}) {
    if (!selectedId) {
      setError('Bitte zuerst eine Box auswaehlen.');
      addToast('error', 'Bitte zuerst eine Box auswaehlen.');
      return;
    }
    let nextPayload = payload;
    if (command === 'nfc_on' || command === 'nfc_off') {
      const rawUid = typeof payload?.uid === 'string' ? payload.uid.trim() : '';
      let uid = rawUid;
      if (!uid) {
        if (command === 'nfc_on') {
          setSimulatedNfc({
            uid: '',
            known: false,
            hardwareUid: generateHardwareUid(),
            at: Date.now(),
          });
          setScanTagLabel('');
          setScanMediaPath('');
          if (!scanTagUid) {
            setScanTagUid(generateTagId());
          }
          return;
        }
        setError('Bitte eine UID angeben.');
        addToast('error', 'Bitte eine UID angeben.');
        return;
      }
      nextPayload = { ...payload, uid };
      if (command === 'nfc_on') {
        setLastHardwareUid({ uid, hardwareUid: generateHardwareUid() });
        setSimulatedNfc(null);
      }
    }
    const response = await sendCommand(selectedId, command, nextPayload);
    if (!response.ok) {
      setError(response.data.detail || 'Command fehlgeschlagen.');
      addToast('error', response.data.detail || 'Command fehlgeschlagen.');
      return;
    }
    setError('');
    addToast('success', 'Command gesendet.');
  }

  async function handleUnpair(boxId) {
    const response = await unpairBox(boxId);
    if (!response.ok) {
      setError(response.data.detail || 'Unpair fehlgeschlagen.');
      addToast('error', response.data.detail || 'Unpair fehlgeschlagen.');
      return;
    }
    addToast('success', 'Box unpaired.');
    const updated = await getBoxes();
    if (updated.ok) {
      setBoxes(updated.data.boxes || []);
    }
  }

  async function handleMediaRefresh() {
    const response = await getMediaTree();
    if (!response.ok) {
      setMediaError(response.data.detail || 'Medien nicht verfuegbar.');
      setMediaTree(null);
      return;
    }
    setMediaTree(response.data);
    setMediaError('');
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
    if (!node) return [];
    if (!Array.isArray(node.children)) return [];
    return node.children;
  }

  function buildBreadcrumb(pathValue) {
    if (!pathValue) return [];
    const parts = pathValue.split('/').filter(Boolean);
    return parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join('/'),
    }));
  }

  function collectTopLevelFolders(node) {
    if (!node || !Array.isArray(node.children)) return [];
    return node.children
      .filter((child) => child.type === 'folder')
      .map((child) => child.path);
  }

  function collectFolderPaths(node) {
    if (!node || node.type !== 'folder') return [];
    const entries = [node.path || ''];
    if (!Array.isArray(node.children)) return entries;
    node.children.forEach((child) => {
      if (child.type !== 'folder') return;
      entries.push(...collectFolderPaths(child));
    });
    return entries;
  }

  function isSelected(pathValue) {
    return selectedPaths.includes(pathValue || '');
  }

  async function handleCreateFolder() {
    const trimmedName = newFolderName.trim();
    if (uploadAfterCreate && pendingUploadFiles.length > 0) {
      const targetPath = trimmedName ? `${currentPath}/${trimmedName}` : currentPath;
      setUploadInProgress(true);
      setActiveUploadLabel(
        pendingUploadFiles.length ? `Upload: ${pendingUploadFiles.length} Datei(en)` : ''
      );
      const uploadResponse = await uploadMedia(
        targetPath,
        pendingUploadFiles,
        (percent) => setUploadProgress(percent)
      );
      setUploadInProgress(false);
      setUploadProgress(0);
      if (!uploadResponse.ok) {
        setMediaError(uploadResponse.data.detail || 'Upload fehlgeschlagen.');
        addToast('error', uploadResponse.data.detail || 'Upload fehlgeschlagen.');
        return;
      }
      addToast('success', 'Upload abgeschlossen.');
      await handleMediaRefresh();
      setActiveModal('');
      setUploadAfterCreate(false);
      setPendingUploadFiles([]);
      setNewFolderName('');
      return;
    }

    if (!trimmedName && !uploadAfterCreate) {
      setMediaError('Bitte einen Ordnernamen angeben.');
      return;
    }

    const response = await createMediaFolder(currentPath, trimmedName);
    if (!response.ok) {
      setMediaError(response.data.detail || 'Ordner anlegen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Ordner anlegen fehlgeschlagen.');
      return;
    }
    addToast('success', 'Ordner angelegt.');
    setNewFolderName('');
    setActiveModal('');
    await handleMediaRefresh();
  }

  async function handleRename() {
    if (!selectedPaths.length) return;
    const response = await renameMedia(selectedPaths[0], renameName.trim());
    if (!response.ok) {
      setMediaError(response.data.detail || 'Umbenennen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Umbenennen fehlgeschlagen.');
      return;
    }
    addToast('success', 'Eintrag umbenannt.');
    setRenameName('');
    setActiveModal('');
    await handleMediaRefresh();
  }

  async function handleDeleteSelected() {
    if (!selectedPaths.length) return;
    for (const pathValue of selectedPaths) {
      const response = await deleteMedia(pathValue);
      if (!response.ok) {
        setMediaError(response.data.detail || 'Loeschen fehlgeschlagen.');
        addToast('error', response.data.detail || 'Loeschen fehlgeschlagen.');
        return;
      }
    }
    addToast('success', 'Eintraege geloescht.');
    setSelectedPaths([]);
    setActiveModal('');
    await handleMediaRefresh();
  }

  async function handleMoveSelected() {
    if (!selectedPaths.length) return;
    const pathValue = selectedPaths[0];
    const isRootTarget = moveTarget === '__root__' || moveTarget === '';
    const response = await moveMedia(pathValue, isRootTarget ? '' : moveTarget);
    if (!response.ok) {
      setMediaError(response.data.detail || 'Verschieben fehlgeschlagen.');
      addToast('error', response.data.detail || 'Verschieben fehlgeschlagen.');
      return;
    }
    addToast('success', 'Eintrag verschoben.');
    setMoveTarget('');
    setSelectedPaths([]);
    setActiveModal('');
    await handleMediaRefresh();
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    const audioFiles = files.filter((file) => file.type.startsWith('audio/'));
    if (!audioFiles.length) return;
    setUploadInProgress(true);
    setActiveUploadLabel(
      audioFiles.length ? `Upload: ${audioFiles.length} Datei(en)` : ''
    );
    const response = await uploadMedia(currentPath, audioFiles, (percent) =>
      setUploadProgress(percent)
    );
    setUploadInProgress(false);
    setUploadProgress(0);
    if (!response.ok) {
      setMediaError(response.data.detail || 'Upload fehlgeschlagen.');
      addToast('error', response.data.detail || 'Upload fehlgeschlagen.');
      return;
    }
    addToast('success', 'Upload abgeschlossen.');
    await handleMediaRefresh();
  }

  function handleSelect(item, event) {
    const itemPath = item.path || '';
    if (event.shiftKey && lastAnchorRef.current) {
      const items = listChildren(getNodeByPath(mediaTree, currentPath));
      const anchorIndex = items.findIndex((entry) => entry.path === lastAnchorRef.current);
      const currentIndex = items.findIndex((entry) => entry.path === itemPath);
      if (anchorIndex !== -1 && currentIndex !== -1) {
        const [start, end] = anchorIndex < currentIndex
          ? [anchorIndex, currentIndex]
          : [currentIndex, anchorIndex];
        const range = items.slice(start, end + 1).map((entry) => entry.path || '');
        setSelectedPaths(Array.from(new Set([...selectedPaths, ...range])));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedPaths((prev) =>
        prev.includes(itemPath)
          ? prev.filter((pathValue) => pathValue !== itemPath)
          : [...prev, itemPath]
      );
      lastAnchorRef.current = itemPath;
      return;
    }
    const now = Date.now();
    const isDoubleClick = now - lastDblClickRef.current < 250;
    if (!isDoubleClick) {
      setSelectedPaths([itemPath]);
      lastAnchorRef.current = itemPath;
    }
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
    addToast('success', 'Tag geschrieben.');
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
  }

  async function handleStoreTagOnly() {
    if (!activeNfc?.uid) {
      setError('Keine UID erkannt.');
      addToast('error', 'Keine UID erkannt.');
      return;
    }
    const existing = tags.find((tag) => tag.uid === activeNfc.uid);
    if (existing) {
      addToast('success', 'Tag ist bereits in der Datenbank.');
      return;
    }
    const response = await claimTag(activeNfc.uid, '');
    if (!response.ok) {
      setError(response.data.detail || 'Tag speichern fehlgeschlagen.');
      addToast('error', response.data.detail || 'Tag speichern fehlgeschlagen.');
      return;
    }
    addToast('success', 'Tag in der Datenbank gespeichert.');
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
  }

  async function handleAssignFromScan() {
    if (!scanMediaPath) {
      setError('Bitte zuerst einen Medienordner waehlen.');
      addToast('error', 'Bitte zuerst einen Medienordner waehlen.');
      return;
    }
    const uid = scanTagUid.trim();
    if (!uid) {
      setError('Bitte zuerst eine Tag-ID schreiben.');
      addToast('error', 'Bitte zuerst eine Tag-ID schreiben.');
      return;
    }
    const matching = tags.find((tag) => tag.uid === uid);
    if (!matching) {
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
    const response = await pullTagFromBox(
      selectedId,
      importTargetUid,
      importTargetFolder.trim()
    );
    if (!response.ok) {
      setError(response.data.detail || 'Import fehlgeschlagen.');
      addToast('error', response.data.detail || 'Import fehlgeschlagen.');
      return;
    }
    addToast('success', 'Medien vom Box-Tag uebertragen.');
    setImportTargetUid('');
    setImportTargetFolder('');
    setActiveModal('');
    const updated = await getTags();
    if (updated.ok) {
      setTags(updated.data.tags || []);
    }
    const updatedLocal = await getBoxLocalTags(selectedId);
    if (updatedLocal.ok) {
      setLocalBoxTags(updatedLocal.data.tags || []);
    }
    await handleMediaRefresh();
  }

  async function handleUnassignTag(uid) {
    const response = await unassignTag(uid, selectedId);
    if (!response.ok) {
      setError(response.data.detail || 'Tag loesen fehlgeschlagen.');
      addToast('error', response.data.detail || 'Tag loesen fehlgeschlagen.');
      return;
    }
    addToast('success', 'Tag getrennt.');
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
    const lastNfcUid = status?.last_nfc?.uid || '';
    const shouldAssign =
      selectedId &&
      status?.last_nfc?.known === false &&
      (lastNfcUid === uid || (!lastNfcUid && scanTagUid && scanTagUid === uid));
    if (shouldAssign) {
      const assigned = await assignTag(uid, selectedId);
      if (!assigned.ok) {
        setError(assigned.data.detail || 'Zuordnung fehlgeschlagen.');
        addToast('error', assigned.data.detail || 'Zuordnung fehlgeschlagen.');
        return;
      }
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

  const activeMeta = useMemo(
    () => NAV_ITEMS.find((item) => item.id === activeSection),
    [activeSection]
  );
  const activeNfc = useMemo(() => {
    if (status?.last_nfc && status.last_nfc.known === false) {
      return { ...status.last_nfc, at: status.last_nfc_at };
    }
    return simulatedNfc;
  }, [status, simulatedNfc]);
  const statusWithHardware = useMemo(() => {
    if (!status) return null;
    const hardwareUid =
      lastHardwareUid.uid === status?.last_nfc?.uid && lastHardwareUid.hardwareUid
        ? lastHardwareUid.hardwareUid
        : activeNfc?.hardwareUid || null;
    if (!status.last_nfc) return status;
    return {
      ...status,
      last_nfc: {
        ...status.last_nfc,
        hardware_uid: hardwareUid,
      },
    };
  }, [status, lastHardwareUid, activeNfc]);

  function renderSection() {
    if (activeSection === 'dashboard') {
      return (
        <div className="section-stack">
          <StatGrid items={dashboardStats} />
          <div className="split-grid">
            <Card className="wide-card">
              <h3>Live-Status</h3>
              {!selectedId && <p className="muted">Waehle eine gepairte Box aus.</p>}
              {selectedId && !status && <p className="muted">Status wird geladen...</p>}
              {status && status.error && <p className="error">{status.error}</p>}
              {status && !status.error && (
                <pre className="status">{JSON.stringify(statusWithHardware, null, 2)}</pre>
              )}
            </Card>
            <Card className="wide-card">
              <h3>Commands</h3>
              <div className="controls">
                <button type="button" onClick={() => handleCommand('play_pause')}>Play/Pause</button>
                <button type="button" onClick={() => handleCommand('next')}>Next</button>
                <button type="button" onClick={() => handleCommand('prev')}>Prev</button>
                <button type="button" onClick={() => handleCommand('vol_up')}>Vol +</button>
                <button type="button" onClick={() => handleCommand('vol_down')}>Vol -</button>
                <button type="button" onClick={() => handleCommand('stop')}>Stop</button>
              </div>
              <div className="controls">
                <input
                  value={nfcUid}
                  onChange={(event) => setNfcUid(event.target.value)}
                  placeholder="UID_1"
                />
                <button type="button" onClick={() => handleCommand('nfc_on', { uid: nfcUid })}>
                  NFC on
                </button>
                <button type="button" onClick={() => handleCommand('nfc_off', { uid: nfcUid })}>
                  NFC off
                </button>
              </div>
              <p className="muted">
                Steuerung ist nur moeglich, wenn die Box gepairt ist.
              </p>
            </Card>
          </div>
        </div>
      );
    }

    if (activeSection === 'boxes') {
      return (
        <div className="section-stack legacy">
          <div className="split-grid">
            <Card className="panel-card">
              <h3>Neue Boxen</h3>
              {unpaired.length === 0 && <p className="muted">Keine neuen Boxen.</p>}
              {unpaired.map((box) => (
                <div key={box.box_id} className="card">
                  <div>
                    <strong>{box.alias || box.box_id}</strong>
                    <div className="meta">Zuletzt gesehen: {formatTime(box.last_seen)}</div>
                    <div className="meta">Firmware: {box.firmware_version}</div>
                    <div className="meta">ID: {box.box_id}</div>
                  </div>
                  <button type="button" onClick={() => handlePair(box.box_id)}>Pairen</button>
                </div>
              ))}
            </Card>
            <Card className="panel-card">
              <h3>Gepairte Boxen</h3>
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
            </Card>
          </div>
        </div>
      );
    }

    if (activeSection === 'media') {
      return (
        <div className="section-stack legacy">
          <Card className="panel-card">
            <div className="panel-header">
              <h3>Medien Explorer</h3>
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
                          <span>Laenge</span>
                          <span>Groesse</span>
                        </>
                      ) : (
                        <>
                          <span>Typ</span>
                          <span>Groesse</span>
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
                    Medienordner: {formatSize(mediaBytes)} · Verfuegbar:{' '}
                    {formatSize(freeBytes)}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      );
    }

    if (activeSection === 'tags') {
      return (
        <div className="section-stack legacy">
          <Card className="panel-card">
            <div className="panel-header">
              <h3>Tags nur auf dieser Box</h3>
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
          </Card>

          <Card className="panel-card">
            <h3>Tags (Datenbank)</h3>
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
          </Card>

          <Card className="panel-card">
            <h3>Tag-Matrix (Sperren)</h3>
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
          </Card>
        </div>
      );
    }

    return (
      <div className="section-stack">
        <Card className="wide-card">
          <h3>System</h3>
          <p>Backend: {import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5001'}</p>
          <div className="settings-row">
            <span>Gepairte Boxen</span>
            <span>{paired.length}</span>
          </div>
          <div className="settings-row">
            <span>Tags</span>
            <span>{tags.length}</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">K</div>
          <div>
            <strong>Klangkiste</strong>
            <span>PrimeReact GUI</span>
          </div>
        </div>
        <div className="mobile-actions">
          <Button
            icon="pi pi-users"
            text
            rounded
            aria-label="Aktive Sessions"
            onClick={() => setShowSessionSheet(true)}
          />
        </div>
        <div className="topbar-search">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Suche nach Boxen, Tags oder Medien"
            />
          </span>
        </div>
        <div className="topbar-actions">
          <Tag value="Online" severity="success" rounded />
          <Button icon="pi pi-bell" text rounded aria-label="Benachrichtigungen" />
          <Avatar label="MK" shape="circle" className="user-avatar" />
        </div>
      </header>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-section">
            <p className="sidebar-title">Navigation</p>
            <div className="nav-list">
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  text
                  className={`nav-button${activeSection === item.id ? ' active' : ''}`}
                  onClick={() => setActiveSection(item.id)}
                />
              ))}
            </div>
          </div>
          <Divider />
          <div className="sidebar-section">
            <p className="sidebar-title">Quick Actions</p>
            <div className="button-stack">
              <Button label="NFC Tag erstellen" icon="pi pi-plus" className="p-button-sm" />
              <Button label="Upload starten" icon="pi pi-upload" outlined className="p-button-sm" />
              <Button label="Box koppeln" icon="pi pi-link" text className="p-button-sm" />
            </div>
          </div>
          <Divider />
          <div className="sidebar-section">
            <p className="sidebar-title">Aktive Sessions</p>
            {paired.length === 0 && (
              <p className="muted">Keine gepairten Boxen.</p>
            )}
            <div className="session-list">
              {paired.map((box) => {
                const isActive = selectedId === box.box_id;
                const label = (box.alias || box.box_id || '').slice(0, 2).toUpperCase();
                return (
                  <button
                    key={box.box_id}
                    type="button"
                    className={`session-card${isActive ? ' active' : ''}`}
                    onClick={() => setSelectedId(box.box_id)}
                    title={`Aktiv setzen: ${box.alias || box.box_id}`}
                  >
                    <Avatar label={label || 'BX'} shape="circle" />
                    <div>
                      <strong>{box.alias || box.box_id}</strong>
                      <span>{isActive ? 'Aktiv' : 'Bereit'}</span>
                    </div>
                    <Badge value={box.state === 'PAIRED' ? 'OK' : box.state} />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="content">
          <SectionHeader
            title={activeMeta?.label || 'Bereich'}
            subtitle="Live Daten und Steuerung der Klangkiste."
            actions={
              <>
                <Button label="Export" icon="pi pi-download" outlined className="p-button-sm" />
                <Button label="Neuer Flow" icon="pi pi-plus" className="p-button-sm" />
              </>
            }
          />
          {error && <div className="error">{error}</div>}
          {activeNfc && (
            <div className="legacy">
              <Card className="panel-card">
                <h3>
                  {activeNfc.uid &&
                  tags.find((tag) => tag.uid === activeNfc.uid && !tag.media_path)
                    ? 'Leerer Tag erkannt'
                    : 'Neuer Tag erkannt'}
                </h3>
                <p className="muted">
                  {activeNfc.uid ? (
                    <>
                      UID erkannt: <strong>{activeNfc.uid}</strong>
                    </>
                  ) : (
                    <>keine UID erkannt</>
                  )}
                </p>
                {activeNfc.uid &&
                lastHardwareUid.uid === activeNfc.uid &&
                lastHardwareUid.hardwareUid && (
                  <p className="muted">
                    Hardware-UID erkannt: <strong>{lastHardwareUid.hardwareUid}</strong>
                  </p>
                )}
                {!activeNfc.uid && activeNfc.hardwareUid && (
                  <p className="muted">
                    Hardware-UID erkannt: <strong>{activeNfc.hardwareUid}</strong>
                  </p>
                )}
                {activeNfc.uid && tags.find((tag) => tag.uid === activeNfc.uid) && (
                  <p className="muted">
                    Dieser Tag ist bekannt, aber noch nicht zugewiesen.
                  </p>
                )}
                {!activeNfc.uid ? (
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
                ) : null}
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
                {activeNfc.uid && activeNfc.known === false && (
                  <button type="button" className="button-ghost" onClick={handleStoreTagOnly}>
                    Nur in die DB uebernehmen
                  </button>
                )}
              </div>
            </Card>
          </div>
          )}
          {renderSection()}
        </main>

        <aside className="right-panel">
          <Card className="panel-card">
            <div className="card-title-row">
              <h3>Live Status</h3>
              <Tag value="Stable" severity="success" />
            </div>
            <p>System Health und wichtige Events.</p>
            <div className="status-row">
              <span>API</span>
              <Tag value="OK" severity="success" />
            </div>
            <div className="status-row">
              <span>Speicher</span>
              <Tag value={mediaTree ? formatSize(mediaTree.free_bytes) : '-'} severity="warning" />
            </div>
            <div className="status-row">
              <span>Letzter Sync</span>
              <span>{status?.last_sync_at ? formatTime(status.last_sync_at) : '-'}</span>
            </div>
            <div className="status-row">
              <span>Hardware-UID</span>
              <span>
                {lastHardwareUid.uid === status?.last_nfc?.uid && lastHardwareUid.hardwareUid
                  ? lastHardwareUid.hardwareUid
                  : activeNfc?.hardwareUid || '-'}
              </span>
            </div>
          </Card>
          <Card className="panel-card">
            <h3>Prioritaet</h3>
            <div className="panel-pill">Tag Serien planen</div>
            <div className="panel-pill">Box 02 koppeln</div>
            <div className="panel-pill">Uploads pruefen</div>
          </Card>
        </aside>
      </div>

      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeSection === item.id ? 'active' : ''}
            onClick={() => setActiveSection(item.id)}
          >
            <i className={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {activeModal === 'new-folder' && (
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
                </div>
                {pendingUploadFiles.length > 0 && (
                  <p className="muted">
                    {pendingUploadFiles.length} Datei(en) bereit.
                  </p>
                )}
                <input
                  type="file"
                  multiple
                  accept="audio/*"
                  ref={uploadDropInputRef}
                  style={{ display: 'none' }}
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
                  setTagDeleteTarget('');
                }}
              >
                Abbrechen
              </button>
              <button type="button" onClick={handleCreateFolder}>
                {uploadAfterCreate ? 'Upload starten' : 'Ordner anlegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'rename' && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveModal('');
            setRenameName('');
          }}
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            ref={modalRef}
          >
            <h3>Umbenennen</h3>
            <input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="Neuer Name"
            />
            <div className="modal-actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setActiveModal('');
                  setRenameName('');
                }}
              >
                Abbrechen
              </button>
              <button type="button" onClick={handleRename}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'delete' && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveModal('');
          }}
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            ref={modalRef}
          >
            <h3>Eintraege loeschen</h3>
            <p className="muted">{selectedPaths.length} Eintraege werden geloescht.</p>
            <div className="modal-actions">
              <button type="button" className="button-ghost" onClick={() => setActiveModal('')}>
                Abbrechen
              </button>
              <button type="button" onClick={handleDeleteSelected}>
                Loeschen
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'move' && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveModal('');
            setMoveTarget('');
          }}
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            ref={modalRef}
          >
            <h3>Verschieben</h3>
            <select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
              <option value="" disabled>
                Zielordner waehlen
              </option>
              <option value="__root__">media/</option>
              {collectFolderPaths(mediaTree).map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setActiveModal('');
                  setMoveTarget('');
                }}
              >
                Abbrechen
              </button>
              <button type="button" onClick={handleMoveSelected}>
                Verschieben
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'tag-delete' && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveModal('');
            setTagDeleteTarget('');
          }}
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            ref={modalRef}
          >
            <h3>Tag entfernen</h3>
            <p className="muted">Der Tag wird komplett geloescht.</p>
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
                onClick={async () => {
                  if (!tagDeleteTarget) return;
                  await handleClearTagMedia(tagDeleteTarget);
                  await handleDeleteTag(tagDeleteTarget);
                  setTagDeleteTarget('');
                  setActiveModal('');
                }}
              >
                Tag loeschen
              </button>
            </div>
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

      {showSessionSheet && (
        <div
          className="sheet-backdrop"
          onClick={() => setShowSessionSheet(false)}
        >
          <div
            className="sheet-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-header">
              <strong>Aktive Sessions</strong>
              <button type="button" className="icon-button" onClick={() => setShowSessionSheet(false)}>
                <i className="pi pi-times" />
              </button>
            </div>
            {paired.length === 0 && (
              <p className="muted">Keine gepairten Boxen.</p>
            )}
            <div className="session-list">
              {paired.map((box) => {
                const isActive = selectedId === box.box_id;
                const label = (box.alias || box.box_id || '').slice(0, 2).toUpperCase();
                return (
                  <button
                    key={box.box_id}
                    type="button"
                    className={`session-card${isActive ? ' active' : ''}`}
                    onClick={() => {
                      setSelectedId(box.box_id);
                      setShowSessionSheet(false);
                    }}
                  >
                    <Avatar label={label || 'BX'} shape="circle" />
                    <div>
                      <strong>{box.alias || box.box_id}</strong>
                      <span>{isActive ? 'Aktiv' : 'Bereit'}</span>
                    </div>
                    <Badge value={box.state === 'PAIRED' ? 'OK' : box.state} />
                  </button>
                );
              })}
            </div>
            <Divider />
            <div className="button-stack">
              <Button label="NFC Tag erstellen" icon="pi pi-plus" className="p-button-sm" />
              <Button label="Upload starten" icon="pi pi-upload" outlined className="p-button-sm" />
              <Button label="Box koppeln" icon="pi pi-link" text className="p-button-sm" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
