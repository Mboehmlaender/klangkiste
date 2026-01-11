# Klangkiste Box CLI

This document lists all currently available CLI interactions (Phase 1a).

## Commands

### status
Show the current runtime status.

Example:
```
python box/main.py status
```

### simulate-nfc <uid>
Simulate NFC tag detection. Resolves the UID to a playback object from `box/config/box_config.json` and starts playback.

Example:
```
python box/main.py simulate-nfc CHIP_1
```

### simulate-nfc-off <uid>
Simulate NFC tag removal. Stops playback and stores progress for that UID.

Example:
```
python box/main.py simulate-nfc-off CHIP_1
```

### tick <seconds>
Simulate playback time progression. Advances position and moves to next file when a file ends.

Example:
```
python box/main.py tick 90
```

### run
Start an interactive session that keeps state in memory. Use `help` inside the session for available commands.

Example:
```
python box/main.py run
```
