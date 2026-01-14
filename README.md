# 🎵 Klangkiste

**Klangkiste** ist eine DIY-Kinder-Audiobox mit serverseitiger Verwaltung und vollständiger Offline-Fähigkeit.  
Das Ziel ist eine robuste, kindgerechte Box mit einem klaren Prinzip: **Tag auflegen, Inhalt hören** – während Eltern alles komfortabel über eine einfache Web-Oberfläche verwalten können. 🧸✨

Im Mittelpunkt stehen dabei Offenheit, Kontrolle und Langlebigkeit: keine Cloud-Zwänge, keine geschlossenen Ökosysteme, keine versteckten Abhängigkeiten.

---

## 🧭 Vision

Klangkiste soll eine Audiobox sein, die Kindern einen einfachen,
bildschirmfreien Zugang zu Medien ermöglicht – und Eltern gleichzeitig
volle Kontrolle über Inhalte, Daten und Technik gibt.

Das Projekt setzt bewusst auf:
- lokale Medien statt Cloud-Zwang
- offene Standards statt geschlossener Ökosysteme
- langlebige, reparierbare Technik
- klare Trennung zwischen kindlicher Nutzung und elterlicher Verwaltung

Klangkiste ist kein Produkt, das ersetzt werden soll –
sondern ein System, das mitwachsen darf.

--- 

## 🚀 Aktueller Funktionsumfang

### 🎫 NFC-Workflow (simuliert)
- Tags auflegen und erkennen  
- Speicherung von Tag-IDs in der Datenbank  
- Zuordnung von Tags zu Medienordnern  

### ▶️ Playback-Steuerung (simuliert)
- Play / Pause  
- Next / Previous  
- Stop  
- Lautstärkeregelung  

### 🎧 Medien & Streaming
- Spotify-Anbindung (OAuth-Token-Flow vorhanden, Playback-Integration vorbereitet)  
- Webradio-Start über Tags (Workflow vorgesehen)  
- Eigene Medienverwaltung ohne Cloud-Abhängigkeit  

### 📂 Medienverwaltung
- Anzeige der Ordnerstruktur  
- Upload eigener Inhalte  
- Umbenennen, Verschieben und Löschen von Medien  

### 🧩 Box- & Tag-Management
- Pairing und Unpairing von Boxen  
- Live-Box-Status und gezielte Commands pro Box  
- Tag-Verwaltung (Alias, Zuordnung, Sperren pro Box)  

- **Import lokaler Tags & Ökosystem-Transfer**  
  - Tags können aus einem **fremden Ökosystem** übernommen werden, z. B. wenn eine Box temporär mit einem externen Server (anderer Haushalt) verbunden ist.  
  - Medien, die dort über fremde Tags abgespielt werden, werden **lokal auf der Box gespeichert**.  
  - Auf Wunsch lassen sich diese Inhalte anschließend **in das eigene Ökosystem zurückführen**.  
  - Dabei **können** passende **eigene Tags erzeugt** und den importierten Medien zugeordnet werden.  
  - So können Inhalte bewusst „mitgenommen“ werden – ohne dauerhafte Bindung an fremde Server oder Strukturen.  

- **Tag-Matrix** mit Whitelist- und Block-Logik pro Box  

### 📴 Offline-Logik (simuliert)
- Box arbeitet mit lokalem Cache  
- Server synchronisiert sich automatisch nach Wiederverbindung  

### 📦 Multi-Box-Support
- Mehrere Boxen gleichzeitig (z. B. `box` + `box2`)  
- Geeignet für Familien-Setups und Multi-Box-Tests  

---

## 🛠️ Geplante Erweiterungen

- 🔌 Echte NFC-Hardware-Integration (Lesen & Schreiben von Tags)  
- 🔊 Reale Audio-Ausgabe auf der Box (statt Simulation)  
- 📶 Robuste Setup-Flows für WLAN, Updates und Fehlerdiagnose  
- 🎨 GUI-Feinschliff (Mobile-Flows, Accessibility, klare Nutzerführung)  
- 📦 Vereinfachte Installation für Familien (fertiges Image / Installer)  
- 🌍 Anbindung externer Server inkl. Rückführung externer Medien  
- 🏷️ Optionale automatische Tag-Erstellung für importierte Inhalte  

---

## 🔍 Abgrenzung zu gängigen Audioboxen

Klangkiste verfolgt bewusst einen anderen Ansatz als viele kommerzielle Audioboxen:

- ❌ Keine proprietären Cloud-Bindungen  
- 📁 Eigene Medien und offene Ordnerstrukturen statt geschlossener Ökosysteme  
- 🔄 Flexible Server-Anbindung mit kontrollierter Rückführung von Inhalten  
- 🧮 Fein steuerbare **Tag-Matrix pro Box**, ideal für Mehrbox-Setups  
- 🔎 Volle Transparenz durch offene APIs und lokale Datenhaltung  

---

## 📍 Projektstatus

**Phase 1.x**  
Lokale Entwicklung ohne Hardware  
(Mock-Boxen, API, GUI)

---

## 🗂️ Repository-Struktur

```text
box/            Box-Software (Python, NFC / Playback / Resume, Box-API)
box2/           Zweite Box-Instanz für Multi-Box-Tests
gui/backend/    Backend (Node.js + SQLite, Box- & Medienverwaltung)
gui/frontend/   Control-Panel (React + Vite)
docs/           Dev-Playbook, API-Verträge, Tests
```

---

## ⚡ Quickstart (lokal)

### Alles starten
```bash
./dev.sh
```

### Setup-Web-GUI (Box)
http://127.0.0.1:9000/setup

### Backend prüfen
curl http://127.0.0.1:5001/api/boxes

### Frontend öffnen
http://127.0.0.1:5174

### 🌐 Ports (Default)

| Dienst                | Port |
| --------------------- | ---- |
| Backend API           | 5001 |
| Frontend GUI          | 5174 |
| Box API               | 8000 |
| Setup UI              | 9000 |
| Box2 API (optional)   | 8001 |
| Box2 Setup (optional) | 9001 |

---

### 🧠 Entwicklungsprinzipien
- Box und GUI/Backend teilen keinen Code
- Kommunikation ausschließlich über JSON-basierte APIs
- Die Box ist Single Source of Truth für Playback und State
- Der Server verwaltet Tags, Medien und Boxen

### ⚙️ Technischer Überblick
- Start über ./dev.sh
- Frontend → Backend (/api)
- Backend → Boxen (HTTP)
- NFC und Playback aktuell simuliert
- Reale Hardware-Integration folgt

### 📚 Dokumentation
- docs/README.md – Einstieg und Dev-Playbook
- docs/dev-workflow.md – Start/Stop, Ports, Logs
- docs/api.md – API-Vertrag

---

🎶 Klangkiste steht für Freiheit, Kontrolle und kindgerechte Einfachheit –
ein offenes Audiobox-Projekt zum Mitbauen, Verstehen und Erweitern.

