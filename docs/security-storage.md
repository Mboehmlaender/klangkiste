# Security & Storage

## Purpose
Explain where data lives, what is encrypted, and how keys are derived.

## Prerequisites
- Box running at least once to create `box/data/`

## Step-by-step
1) Start the box:
```
python3 box/main.py run
```
2) Inspect data files:
```
ls -la box/data
```

## Data layout
```
box/data/
├── box.json      # box_id, settings, tags (plaintext)
├── state.json    # resume, wifi state (plaintext)
├── media/        # audio files
└── secrets.enc   # encrypted secrets (JSON inside)
```

## What is plaintext
- box_id
- box name
- volume
- resume positions
- playback state
- media paths
- UI state

## What is encrypted
- WiFi profiles
- Spotify tokens
- Server tokens (future)

## Key derivation
- Key = PBKDF2-HMAC-SHA256(box_id + STATIC_SALT)
- Key is never stored on disk
- secrets.enc is not portable between boxes

## Reset behavior
- WiFi reset: removes only wifi_profiles from secrets.enc
- Factory reset: delete `box/data/box.json`, `box/data/state.json`, `box/data/secrets.enc`

## Checklist
- ✅ `secrets.enc` exists after WiFi/Spotify set
- ✅ `box.json` contains `box_id`
- ✅ No secrets appear in `/status`

## Troubleshooting
- secrets.enc not created:
  - Ensure you ran `wifi_add_profile` or `spotify_set_tokens`.
- secrets.enc unreadable after reset:
  - Factory reset creates a new box_id and new key.
