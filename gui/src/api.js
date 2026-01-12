// src/api.js

const API_BASE = import.meta.env.VITE_BOX_API_URL || "http://10.10.10.23:8000";
const API_TOKEN = import.meta.env.VITE_BOX_API_TOKEN || "";

export async function getStatus() {
  const response = await fetch(`${API_BASE}/status`);
  if (!response.ok) {
    throw new Error(`Status request failed (${response.status})`);
  }
  return await response.json();
}

export async function sendCommand(command, payload = {}) {
  console.log("GUI -> API", command, payload);
  const headers = { "Content-Type": "application/json" };
  if (API_TOKEN) {
    headers["X-API-Token"] = API_TOKEN;
  }
  const response = await fetch(`${API_BASE}/command`, {
    method: "POST",
    headers,
    body: JSON.stringify({ command, payload }),
  });
  if (!response.ok) {
    throw new Error(`Command request failed (${response.status})`);
  }
  return await response.json();
}
