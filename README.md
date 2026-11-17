# Moundshroud

A private assistant that runs entirely on your Windows PC. It answers with local AI models, holds offline libraries (Wikipedia, medical, survival, how-to, classic books), and bundles tools for study, languages, music, chess, games, the night sky, weather, calendar, kitchen, garden, lab, timeline, and a private budget. Nothing leaves your computer unless you choose to download something.

## Requirements
| | |
|---|---|
| **OS** | Windows 10/11, 64-bit |
| **Node.js** | Current LTS (tested on Node 24) — no other server dependencies |
| **Ollama** | For local models (e.g., `qwen3.5:9b`, `qwen3.5:2b` for low-power) |
| **Microsoft Edge** | Used for the app window (built into Windows) |
| **Disk** | ~100 MB app; libraries/models are separate downloads (tens of GB) |
| **Optional** | LibreOffice (documents), GPU (faster AI) |

## Quick Start
- **Hotkey**: `Ctrl+Alt+A` anywhere in Windows (also `open-moundshroud.ps1`, Desktop/Start shortcut)
- The tray program (`assistant-listener.exe`) handles hotkeys, reminders, and 8 AM verse notifications
- Closing the window stops the server after a few minutes; tray stays for reminders

## Key Hotkeys
| Key | Action |
|-----|--------|
| `Ctrl+Alt+A` | Open/hide Moundshroud |
| `Ctrl+Alt+Q` | Ask about selected text |
| `Ctrl+Alt+W` | Look up in offline library |
| `Ctrl+Alt+D` | Define selected word |
| `Ctrl+Alt+S` | Copy text from screen (images, videos, PDFs) |
| `Ctrl+Alt+N` | Quick note / reminder |
| `Ctrl+Alt+V` | Voice mode |
| `Ctrl+Alt+C` | Clipboard history |
| `Ctrl+Alt+E` | Emergency cards |
| `Ctrl+K` | Command palette (search everything) |
| `Ctrl+N` | New chat/note |
| `Alt+1`–`Alt+9` | Jump to tab |
| `F1` | Guide |
| `Esc` | Stop reply / close panel / close app |

## Tabs
**Office** — Library (Wikipedia, classics, chess books, Bible), My Files, Notes, Mail, Documents, Calculator, Scanner, Meeting Notes, Reminders, Clipboard, Converter  
**Education** — Study (flashcards, quizzes, guides), Languages (translate), Writing, Practice, Teach Me, Sky, Lab, Timeline  
**Personal** — Kitchen (meal planner, pantry, 8K recipes), Garden (planting, beds, harvest), Money (budget, savings, CSV), Journal (mood tracker, streaks), Albums  
**Entertainment** — Games (30 offline + puzzle maker, storyteller, trivia, ambience), Music (500+ free songs, imports, recorder), Photos (searchable by content), Radio (live stations), TV (VLC links, YouTube)  
**Studio** — Composer (score editor, 55 instruments, MIDI/WAV export), Game Maker, Game Studio (Godot in-app), Storybook & Comic, AI Art/Music/Video  
**Cyber** — Course (11 modules, cert), Cyber Lab, Passwords vault, Code Breaker, CyberChef, 6 hacker games  
**Prepare** — Readiness check, first aid, plans, supplies, emergency cards, radio/Morse, one-click downloads, printable binder  
**Spiritual** — Two Bibles, prayers, Rosary, liturgical calendar, devotional classics, holy hour, Stations of the Cross, Divine Mercy, Liturgy of the Hours, saints calendar  
**Guide** — Searchable manual, 1-minute tour, full presentation, holographic book view

## New in 1.3.0
- **Passwords** (Tools): Encrypted vault (AES-256-GCM, PBKDF2 600k rounds), generator, weak/reused check, browser import, version history, clipboard wipe after 30s, AI never sees the page
- **Photos**: Month view, AI descriptions ("dog in snow", "birthday 2024"), files read-only, OneDrive cloud-only files not downloaded unless opened
- **Mail**: IMAP (Gmail, Yahoo, iCloud, Fastmail, Proton via Bridge), scripts/tracking blocked, scam warnings, AI inbox brief, summaries, reply help — drafts go to your Drafts folder, Moundshroud never sends
- **AI Memory**: Say "remember that..." in Chat; `Ctrl+K → What the AI remembers about me` to view/delete; AI can find photos and start email drafts
- **Lichess** (Chess): Real games on your free Lichess account via official Board API; all engines/hints locked during play per fair-play rules
- **News → Research**, **Tor Browser** (Browser tab), working **Meeting Notes** transcripts, animations respect app Motion setting (not Windows)
- **Settings → Appearance → Grouped top bar** toggles flat/sidebar layout

## Spiritual
Bible in two translations (modern + Douay-Rheims), traditional prayers, Rosary, liturgical calendar, devotional classics, plus five devotional pages: holy hour, Stations of the Cross, Divine Mercy chaplet (and Seven Sorrows), simplified Liturgy of the Hours (from local Bible files), saints calendar with 9-day novena tracker.  
43 color themes + 29 interface styles (including devotional set: Vespers, Iconostasis, Catacomb, Rose Window, Illuminated, Stained Glass, Monastic). Any theme works with any style.

## Look & Feel
- Cross-fade tab transitions with card settle-in animation
- Top-bar progress line for slow fetches
- Toast stack (bottom-right) with icons, colors, timeout bars
- Motion setting: **Full** / **Subtle** / **Off** (app controls it, not Windows)
- 43 color themes × 29 styles, all combinable, fade on change

## Claude via Respan Gateway
All Claude requests (chat, buddy, quizzes, documents, chess coach, Settings test) route through the local [Respan Gateway](https://github.com/respanai/respan-gateway) (MIT/Apache-2.0):
- **No sign-up**: Uses your Anthropic key from Settings; no Respan account/key/credits; nothing traced
- **Local only**: Listens on `127.0.0.1`, starts on first Claude use, stops with Moundshroud
- **Drop-in**: Request is byte-for-byte identical; routing/retries/log in one place
- **Optional**: Without it, Claude answers direct from Anthropic; `/api/cloud` shows `gateway: off`
- **Install**: `powershell -ExecutionPolicy Bypass -File install-gateway.ps1` (creates `.venv`, installs `respan-gateway==0.3.0` wheels-only)
- **Manual**: `.venv\Scripts\python.exe -m respan_gateway` serves on `http://127.0.0.1:8080` (`/ui/` = request log); Moundshroud starts its own copy on a free port

## Data & Backups
- **Local only**: Notes → `Documents\Assistant Notes`, server data → `data\`, browser storage → `edge-profile\`
- **Full backup**: Settings → Back up everything → one zip (choose location, e.g., external drive); Restore puts it back; imported songs/libraries/models not included
- **Progress copies**: Auto-dated zip every start + daily to `Documents\Moundshroud Backups\progress-YYYY-MM-DD` (notes, data files, browser storage — ratings, journal, favorites, Bible notes, reading plans, playlists, preferences); newest 10 kept with `READ-ME-FIRST.txt`
- **Emergency restore**: `.\restore-progress.ps1 -List` / `-Backup` / `-Name latest` / `-Name before-restore-...` — works with app closed, no internet needed
- **Program snapshots**: `snapshot.ps1` / `restore-snapshot.ps1` (see `SNAPSHOTS.txt`)

## Self-Test
Settings → Run a self-test — opens every tab/page, checks data files and local services. Run after install/update. Red crosses explained inline; "needs restart" = close all windows and reopen.

## Folder Map
```
server.js, lib\        → local server
web\                   → app (web\js\ = one file/feature, web\data\ = Bibles, recipes, stars)
Listener.cs            → tray program source
py\                    → document helpers
nomad\library\         → offline Kiwix .zim files (never downloaded twice)
engines\stockfish\     → chess engine (auto-downloads official release + verifies fingerprint)
data\                  → your server data (not shipped)
```

## Sharing with a Friend
`.\make-release.ps1 -Verify` creates two zips under Discord's 10 MB limit in `releases\`:
- `Moundshroud-<ver>-part1-program.zip` (program + setup)
- `Moundshroud-<ver>-part2-data.zip` (Bibles, recipes, star data)
- `MESSAGE-FOR-DISCORD.txt` (ready-to-paste note with steps + checksums)
- `SHA256.txt`

**No personal data, libraries, music, AI models, or pre-built `.exe`.** Friend unzips both, runs `Setup-Moundshroud.bat` (offers Node.js/Ollama via winget, downloads chosen model, fetches kiwix-tools, compiles hotkey helper, makes shortcuts, starts app). `START-HERE.txt` has same steps.

## Licenses
Moundshroud code: **MIT** (see `LICENSE`). Third-party content keeps its own terms:

| Content | License |
|---------|---------|
| Bible texts (WEB, Douay-Rheims) | Public domain |
| Music (Kevin MacLeod, classical) | CC BY 4.0 / Public domain |
| Star data (d3-celestial) | BSD-3-Clause |
| Fonts (Atkinson Hyperlegible, Pixelify Sans, Silkscreen) | SIL OFL 1.1 |
| Rhyming dictionary (CMU) | BSD-style |
| Chess engine (Stockfish) | GPL-3.0 |
| Cookbooks, classics, libraries | Public domain / CC terms |

**Downloaded at runtime (not bundled):** Stockfish, kiwix-tools (GPL-3.0), CyberChef (Apache-2.0), Tor Browser (BSD/MIT), Piper voices (MIT/Apache/CC-BY), Whisper (MIT), Ollama models (various), SDXL-Turbo (OpenRAIL-M), MusicGen (CC-BY-NC/MIT), yt-dlp/ffmpeg (user supplies).

## For Developers
- `node tests/run.js` — 120+ automated checks (chess, news, markets, vault, photos, mail, release rules). Run before every release.
- `install-gateway.ps1` — adds Respan Gateway (`.venv`, `respan-gateway==0.3.0`); `lib/gateway.js` starts it; `py/gatewayworker.py` is the worker
- `make-release.ps1 -Verify` — builds zips, installs to folder with spaces/accents/apostrophe to prove setup works
- Server has **zero npm deps**: `node server.js` with Node 24 is all it needs
- `MOUNDSHROUD_PORT` runs second copy on another port (same `data` folder — test carefully)
- `.gitignore` allowlists only program files; personal data/downloads/browser profile/snapshots/releases never committed

## Known Limits
- AI quality = local model quality; Ask Moundshroud Everything always shows sources
- Sky → Weather uses only your barometer; News front page shows live forecast for one place (Open-Meteo, internet on)
- Garden dates = latitude estimates unless you enter frost dates
- Recipe shopping lists = approximate (old running-text recipes)
- No compass sensor → Compass page uses manual dial
- Windows Focus Assist may hide toast part; verse card on screen still appears