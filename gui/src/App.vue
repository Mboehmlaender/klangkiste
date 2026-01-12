<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { getStatus, sendCommand } from "./api.js";

const status = ref({});
const logs = ref([]);
const error = ref(null);
const apiBase = import.meta.env.VITE_BOX_API_URL || "http://10.10.10.23:8000";
let pollId = null;

async function refresh() {
  error.value = null;
  try {
    status.value = await getStatus();
  } catch (err) {
    error.value = err?.message || "Failed to fetch status";
  }
}

async function runCommand(command, payload = {}) {
  error.value = null;
  logs.value.unshift({
    at: new Date().toLocaleTimeString(),
    command,
    payload,
  });
  try {
    await sendCommand(command, payload);
    await refresh();
  } catch (err) {
    error.value = err?.message || "Failed to send command";
    logs.value.unshift({
      at: new Date().toLocaleTimeString(),
      command: "error",
      payload: { message: error.value },
    });
  }
}

onMounted(async () => {
  await refresh();
  pollId = setInterval(refresh, 1000);
});

onBeforeUnmount(() => {
  if (pollId) {
    clearInterval(pollId);
    pollId = null;
  }
});
</script>

<template>
  <h1>Klangkiste – Control Panel</h1>

  <p>API: {{ apiBase }}</p>
  <p v-if="error">Error: {{ error }}</p>
  <p v-if="status.playback_state?.last_error">
    last_error: {{ status.playback_state.last_error }}
  </p>
  <pre>{{ status }}</pre>
  <h2>GUI Log</h2>
  <pre>{{ logs }}</pre>

  <button @click="runCommand('play_pause')">Play / Pause</button>
  <button @click="runCommand('next')">Next</button>
  <button @click="runCommand('prev')">Prev</button>
  <button @click="runCommand('volume_up')">Vol +</button>
  <button @click="runCommand('volume_down')">Vol -</button>

  <hr />

  <button @click="runCommand('nfc_on', { uid: 'UID_1' })">
    NFC UID_1 ON
  </button>
  <button @click="runCommand('nfc_off', { uid: 'UID_1' })">
    NFC UID_1 OFF
  </button>

  <hr />
  <button @click="refresh">Refresh Status</button>
</template>
