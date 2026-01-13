PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS boxes (
  box_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  state TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  firmware_version TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  api_token TEXT,
  last_ip TEXT,
  api_port INTEGER,
  setup_port INTEGER,
  alias TEXT,
  media_root TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  uid TEXT PRIMARY KEY,
  label TEXT,
  alias TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  written_at INTEGER,
  media_path TEXT
);

CREATE TABLE IF NOT EXISTS box_tags (
  box_id TEXT NOT NULL,
  tag_uid TEXT NOT NULL,
  media_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (box_id, tag_uid),
  FOREIGN KEY (box_id) REFERENCES boxes(box_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_uid) REFERENCES tags(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS box_tag_blocks (
  box_id TEXT NOT NULL,
  tag_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (box_id, tag_uid),
  FOREIGN KEY (box_id) REFERENCES boxes(box_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_uid) REFERENCES tags(uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS box_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  box_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (box_id) REFERENCES boxes(box_id) ON DELETE CASCADE
);
