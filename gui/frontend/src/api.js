const defaultHost =
  typeof window !== 'undefined' && window.location ? window.location.hostname : '127.0.0.1';
const API_BASE = import.meta.env.VITE_BACKEND_URL || `http://${defaultHost}:5001`;

async function readJson(response) {
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) };
  } catch (error) {
    return { ok: response.ok, status: response.status, data: { detail: text } };
  }
}

export async function getBoxes() {
  const response = await fetch(`${API_BASE}/api/boxes`);
  return readJson(response);
}

export async function pairBox(boxId) {
  const response = await fetch(`${API_BASE}/api/boxes/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ box_id: boxId }),
  });
  return readJson(response);
}

export async function getStatus(boxId) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/status`);
  return readJson(response);
}

export async function getMediaTree() {
  const response = await fetch(`${API_BASE}/api/media-tree`);
  return readJson(response);
}

export async function createMediaFolder(parentPath, name) {
  const response = await fetch(`${API_BASE}/api/media/folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_path: parentPath, name }),
  });
  return readJson(response);
}

export async function renameMedia(path, name) {
  const response = await fetch(`${API_BASE}/api/media/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, name }),
  });
  return readJson(response);
}

export async function moveMedia(path, targetParent) {
  const response = await fetch(`${API_BASE}/api/media/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, target_parent: targetParent }),
  });
  return readJson(response);
}

export async function deleteMedia(path) {
  const response = await fetch(`${API_BASE}/api/media/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return readJson(response);
}

export function uploadMedia(targetPath, files, onProgress) {
  const formData = new FormData();
  formData.append('target_path', targetPath);
  files.forEach((file) => {
    formData.append('files', file);
  });

  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/api/media/upload`);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    };
    request.onload = () => {
      try {
        const data = JSON.parse(request.responseText || '{}');
        resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, data });
      } catch (error) {
        resolve({
          ok: request.status >= 200 && request.status < 300,
          status: request.status,
          data: { detail: request.responseText || '' },
        });
      }
    };
    request.onerror = () => {
      resolve({ ok: false, status: 0, data: { detail: 'network error' } });
    };
    request.send(formData);
  });
}

export async function getTags() {
  const response = await fetch(`${API_BASE}/api/tags`);
  return readJson(response);
}

export async function generateTag(label) {
  const response = await fetch(`${API_BASE}/api/tags/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  return readJson(response);
}

export async function claimTag(uid, label) {
  const response = await fetch(`${API_BASE}/api/tags/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, label }),
  });
  return readJson(response);
}

export async function markTagWritten(uid) {
  const response = await fetch(`${API_BASE}/api/tags/${uid}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return readJson(response);
}

export async function getBoxTags(boxId) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/tags`);
  return readJson(response);
}

export async function getBoxLocalTags(boxId) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/local-tags`);
  return readJson(response);
}

export async function getTagBlocks(boxId) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/tag-blocks`);
  return readJson(response);
}

export async function setTagBlock(boxId, uid, blocked) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/tag-blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, blocked }),
  });
  return readJson(response);
}

export async function setBoxAlias(boxId, alias) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/alias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias }),
  });
  return readJson(response);
}

export async function setTagAlias(uid, alias) {
  const response = await fetch(`${API_BASE}/api/tags/${uid}/alias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias }),
  });
  return readJson(response);
}

export async function assignTag(uid, boxId) {
  const response = await fetch(`${API_BASE}/api/tags/${uid}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ box_id: boxId }),
  });
  return readJson(response);
}

export async function unassignTag(uid, boxId) {
  const response = await fetch(`${API_BASE}/api/tags/${uid}/unassign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ box_id: boxId }),
  });
  return readJson(response);
}

export async function deleteTag(uid) {
  const response = await fetch(`${API_BASE}/api/tags/${uid}`, {
    method: 'DELETE',
  });
  return readJson(response);
}

export async function setTagMedia(uid, mediaPath) {
  const response = await fetch(`${API_BASE}/api/tags/${uid}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_path: mediaPath }),
  });
  return readJson(response);
}

export async function pullTagFromBox(boxId, uid, targetFolder) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/pull-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, target_folder: targetFolder }),
  });
  return readJson(response);
}

export async function sendCommand(boxId, command, payload = {}) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, payload }),
  });
  return readJson(response);
}

export async function unpairBox(boxId) {
  const response = await fetch(`${API_BASE}/api/boxes/${boxId}/unpair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return readJson(response);
}
