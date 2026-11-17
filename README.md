# Moundshroud

A private, offline-first AI assistant for Windows that runs entirely on your PC. It answers with local LLMs via Ollama, optionally connects to free cloud providers (22+ providers, 311+ models via [awesome-freellm-apis](https://github.com/lucasdorazio/awesome-freellm-apis)), and bundles a vast suite of tools: offline libraries (Wikipedia, medical, survival, how-to, classic books, chess books), study system (flashcards, quizzes, guides), languages, music (composer, 500+ free songs, recorder), chess (play, analysis, career, daily, clubs, Lichess), games (30+ offline + puzzle maker), cyber course/lab, personal finance, kitchen/garden planners, journal, timeline, sky chart, weather, document tools, scanner, meeting notes, clipboard history, password vault, converter, AI art/music/video, Godot game studio, storybook/comic creator, and more. Nothing leaves your computer unless you explicitly enable it (internet search, cloud AI, Lichess, mail, downloads).

## Requirements
| | |
|---|---|
| **OS** | Windows 10/11, 64-bit |
| **Node.js** | Current LTS (tested on Node 24) — zero npm dependencies |
| **Ollama** | For local models (e.g., `qwen3.5:9b`, `qwen3.5:2b` for low-power) |
| **Microsoft Edge** | Used for the app window (built into Windows) |
| **Disk** | ~100 MB app; libraries/models are separate downloads (tens of GB) |
| **Optional** | LibreOffice (documents), GPU (faster AI), winget (auto-setup) |

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
| `Alt+1`–`Alt+9` | Jump to tab group |
| `F1` | Guide |
| `Esc` | Stop reply / close panel / go back to Today / close app |

## Tabs (in order, grouped by the sidebar menus)

### 🏠 Today (`home`)
Dashboard with weather, calendar, reminders, quick actions, recent notes, and system status.

---

### 🏢 Office
| Tab | Icon | Description |
|-----|------|-------------|
| **Library** | 📚 | Offline Wikipedia (Kiwix), Project Gutenberg classics, chess books, medical/survival/how-to libraries, Bible texts. Virtual-scrolled, searchable, with bookmarks and holographic book view. |
| **My Files** | 🗂️ | File browser for your indexed folders (notes, documents, photos, downloads). Open, search, preview PDFs/images/text. |
| **Notes** | 📝 | Rich notes with folders, tags, pinning, search, Markdown export, and AI-assisted writing. |
| **Mail** | ✉️ | IMAP client (Gmail, Yahoo, iCloud, Fastmail, Proton via Bridge). Scripts/tracking blocked, scam warnings, AI inbox brief, summaries, reply drafts → your Drafts folder. Moundshroud never sends. |
| **Documents** | 📄 | LibreOffice integration: create/edit/convert documents, spreadsheets, presentations. Version history, export to PDF. |
| **Office Files** | 📂 | Quick access to recent LibreOffice files. |
| **Calculator** | 🧮 | Scientific, programmer, conversion, tip/percent, date/time, smart math modes. |
| **Scanner** | 📷 | Scan documents/photos from WIA/TWAIN devices (Windows built-in). Multi-page PDF, OCR. |
| **Meeting Notes** | 🎙️ | Record, transcribe (local Whisper), summarize, extract action items. Speaker diarization. |
| **Reminders** | ⏰ | One-time, recurring (daily/weekly/monthly/yearly), countdown, snooze, 8 AM verse card. |
| **Clipboard** | 📋 | History (text/images/files), search, pin, sync across restarts. Optional auto-clear. |

---

### 🎒 Education
| Tab | Icon | Description |
|-----|------|-------------|
| **Study** | 🎓 | Flashcards (spaced repetition), quizzes, study guides, progress tracking, import/export. |
| **Languages** | 🌍 | Translate (local + cloud), phrasebook, vocabulary builder, conjugation tables. |
| **Writing** | ✍️ | AI-assisted writing: outlines, drafts, critique, style rewrite, continue, summarize. |
| **Practice** | 🎤 | Coding exercises with sandboxed execution, graded by AI. Multiple languages. |
| **Teach Me** | 🧑‍🎓 | Socratic tutor mode: AI guides you to the answer with questions. |
| **Sky** | 🔭 | Interactive star chart (d3-celestial), planets, constellations, deep-sky objects, time travel, telescope FOV. |
| **Lab** | 🔬 | Science tools: periodic table, unit converter, chemistry calculator, physics formulas, biology reference. |

---

### 🏡 Personal
| Tab | Icon | Description |
|-----|------|-------------|
| **Kitchen** | 🍳 | Meal planner (weekly), pantry inventory (barcode scan), 8,000+ recipes (offline), shopping list auto-generated from plan. |
| **Garden** | 🌱 | Bed planner, planting calendar (latitude-aware or custom frost dates), harvest log, companion planting, pest/disease guide. |
| **Money** | 💰 | Private budget: accounts, categories, recurring, CSV import/export, savings goals, reports, charts. No cloud sync. |
| **Journal** | 📓 | Daily entries, mood tracker, streaks, tags, search, export, AI insights (local). |
| **Albums** | 📚 | Photo albums with AI descriptions ("dog in snow", "birthday 2024"), month view, search by content, EXIF, map view. Files read-only; OneDrive cloud-only files not downloaded unless opened. |

---

### 🎉 Entertainment
| Tab | Icon | Description |
|-----|------|-------------|
| **Games** | 🎭 | 30+ offline games: chess, solitaire, minesweeper, 2048, snake, tetris, puzzles, trivia, word games, card games, puzzle maker, storyteller, ambience. |
| **Music** | 🎼 | Composer (score editor, 55 instruments, MIDI/WAV export), 500+ free classical songs, imports, recorder, playlist, music theory tools. |
| **Radio** | 📻 | Live radio stations (Radio Browser API), favorites, search by country/genre/language, record to file. |
| **TV** | 📺 | VLC links for live TV, YouTube search/play (no API key), watch later queue. |
| **Photos** | 🖼️ | Full photo library: timeline, map, AI search, face grouping, duplicates, favorites, EXIF editor, export. |

---

### 🛡️ Cyber
| Tab | Icon | Description |
|-----|------|-------------|
| **Cyber Course** | 🛡️ | 11 modules (networking, crypto, web, reversing, forensics, OSINT, malware, wireless, cloud, cert prep), hands-on labs, progress tracking, certificate. |
| **Cyber Lab** | 🛡️ | Live tools: DNS, WHOIS, port scan, TLS cert, headers, fingerprint, subdomains, traceroute, IP info, hash ID/crack/make, packet capture. |
| **Passwords** | 🔐 | Encrypted vault (AES-256-GCM, PBKDF2 600k rounds), generator, weak/reused check, browser import (Chrome/Edge/Firefox), version history, clipboard wipe after 30s, AI never sees the page. |
| **Code Breaker** | 🔓 | Classical ciphers (Caesar, Vigenère, Playfair, Rail Fence, Columnar, Bacon, Polybius, XOR, Affine, Substitution), auto-crack with English scoring, missions. |
| **CyberChef** | 🍳 | Embedded CyberChef (Apache-2.0) for encoding, encryption, compression, parsing, recipes. |
| **Hacker Games** | 🎮 | 6 games: packet capture, buffer overflow, SQL injection, XSS, crypto challenges, CTF-style. |

---

### 🎨 Studio
| Tab | Icon | Description |
|-----|------|-------------|
| **Composer** | 🎼 | Full score editor (55 instruments), MIDI/WAV export, playback, music theory tools. |
| **Game Maker** | 🎮 | Visual game builder: sprites, tiles, events, export to HTML5. |
| **Game Studio** | 🎮 | **Godot 4 in-app**: create/edit/run Godot projects (GDScript/C#), scene tree, inspector, debugger, live preview. |
| **Storybook & Comic** | 📖 | Multi-page layout, panels, speech bubbles, character poses, backgrounds, export to PDF/HTML. |
| **AI Art / Music / Video** | 🎨 | SDXL-Turbo (images), MusicGen (music), text-to-video (local models), prompt library, history. |

---

### 🛟 Prepare
| Tab | Icon | Description |
|-----|------|-------------|
| **Readiness** | 🛟 | System check: backups, supplies, skills, documents, comms, power, water, food, meds, shelter, defense. Score + gaps. |
| **First Aid** | 🩹 | Offline guide: CPR, bleeding, burns, fractures, choking, poisoning, bites, heat/cold, psychological. Printable cards. |
| **Plans** | 📋 | Family emergency plan, bug-out bag, vehicle kit, home defense, comms plan, rendezvous points. Templates + custom. |
| **Supplies** | 📦 | Inventory with quantities, expiration tracking, categories (food, water, meds, tools, ammo, comms), low-stock alerts. |
| **Emergency Cards** | 🆘 | Printable wallet cards: medical info, contacts, allergies, blood type, meds, ICE. QR code for digital version. |
| **Radio / Morse** | 📡 | Ham radio reference (bands, calling frequencies, phonetic alphabet, Q-codes), Morse trainer (learn/practice/decode), CW keyer. |
| **Downloads** | ⬇️ | One-click offline packs: Wikipedia, medical, survival, maps, books, software (Ollama, kiwix-tools, Stockfish, Tor, Piper, Whisper, yt-dlp). |
| **Printable Binder** | 📄 | Auto-generates a complete preparedness binder (PDF) from your data: plans, supplies, contacts, medical, skills, maps. |

---

### ✝️ Spiritual
| Tab | Icon | Description |
|-----|------|-------------|
| **Bible** | 📖 | Two translations (WEB modern + Douay-Rheims), search, cross-refs, parallel view, reading plans, bookmarks, notes, audio. |
| **Prayers** | 🙏 | Traditional prayers (Rosary, Divine Mercy, Stations, Angelus, Memorare, more), customizable, audio. |
| **Liturgical Calendar** | 📅 | Daily readings, saints, feasts/fasts, seasons, color, 9-day novena tracker, patron saints. |
| **Devotional Classics** | 📚 | Complete texts: Imitation of Christ, Dark Night of the Soul, Introduction to the Devout Life, Practice of the Presence, Cloud of Unknowing, more. |
| **Holy Hour** | ⏳ | Guided Eucharistic adoration with scripture, silence, prayer, examination. Timer, journal. |
| **Stations of the Cross** | ✝️ | 14 stations with art, meditations, prayers, audio. Franciscan + traditional versions. |
| **Divine Mercy / Seven Sorrows** | 💙 | Chaplet, novena, image, promises, audio. Seven Sorrows Rosary with meditations. |
| **Liturgy of the Hours** | 🕊️ | Simplified from local Bible files: Office of Readings, Morning, Daytime, Evening, Night. Psalter, canticles, intercessions. |
| **Saints Calendar** | 👼 | Daily saint, bio, patronage, prayer, novena tracker (9 days), custom feast days. |

---

### 🗺️ Guide & Tools
| Tab | Icon | Description |
|-----|------|-------------|
| **App Map** | 🗺️ | Full app structure: every tab, section, how-to, reference sheet, shortcuts, settings, data, downloads, running parts, code files, server addresses. Searchable. |
| **Guide** | ✨ | Searchable manual, 1-minute tour, full narrated presentation, holographic book view, changelog (collapsible by date), what's new. |
| **Tools** | 🧰 | Converter (audio/video/image/archive/document), batch rename, hash, base64, QR, UUID, color picker, regex tester, cron builder, unit converter, more. |
| **Health** | 🛟 | Medical reference (offline): conditions, medications, first aid, anatomy, symptoms, drug interactions, ICD-10, printable cards. |
| **Calendar** | 📅 | Month/week/day view, reminders integration, recurring events, import/export ICS, weather overlay. |
| **Timeline** | 🏛️ | Historical timeline: world history, science, art, personal events. Zoom, search, add your own eras/events. |
| **Editor** | ✏️ | Code editor (Monaco) for app files: syntax highlighting, tabs, search/replace, git diff, run tests. Opens `web/js/` by default. |

---

## New in 1.3.0
- **Free LLMs** (Settings → AI & power): 22+ providers, 311+ models via [awesome-freellm-apis](https://github.com/lucasdorazio/awesome-freellm-apis) — Groq, NVIDIA NIM, Google Gemini, OpenRouter, Mistral, Cohere, Cloudflare, ModelScope, OVHcloud, Ollama Cloud, Glhf.chat, Chutes.ai, LLM7.io, Z.ai, Gonka, Agnes, Aion Labs, SiliconFlow, Grok, OpenCode Zen, and more. Auto-updated from GitHub (6-hour cache) with local fallback in `data/refs/freellm/status.json`.
- **No API Key Required**: Glhf.chat (unlimited Llama/Mixtral), Chutes.ai (DeepSeek R1), OVHcloud AI (anonymous EU-hosted) — just pick a provider and model, no signup. Uses `rejectUnauthorized: false` for SSL cert issues on these providers.
- **Free frontier pool** (Settings → AI & power): auto-fallback across working free routes, shows live status and daily usage.
- **Push to GitHub** (Settings → Backup & data): commit & push changes to your remote (**author copy only** — button hidden on public clones via `.author-copy` marker).
- **Shareable app zip** (Settings → Backup & data): portable zip of the current version (code only, no personal data). Excludes browser profiles, snapshots, releases, locked files.
- **Passwords** (Tools): Encrypted vault (AES-256-GCM, PBKDF2 600k rounds), generator, weak/reused check, browser import, version history, clipboard wipe after 30s, AI never sees the page.
- **Photos**: Month view, AI descriptions ("dog in snow", "birthday 2024"), files read-only, OneDrive cloud-only files not downloaded unless opened.
- **Mail**: IMAP (Gmail, Yahoo, iCloud, Fastmail, Proton via Bridge), scripts/tracking blocked, scam warnings, AI inbox brief, summaries, reply help — drafts go to your Drafts folder, Moundshroud never sends.
- **AI Memory**: Say "remember that..." in Chat; `Ctrl+K → What the AI remembers about me` to view/delete; AI can find photos and start email drafts.
- **Lichess** (Chess): Real games on your free Lichess account via official Board API; all engines/hints locked during play per fair-play rules.
- **News → Research**, **Tor Browser** (Browser tab), working **Meeting Notes** transcripts, animations respect app Motion setting (not Windows).
- **Settings → Appearance → Grouped top bar** toggles flat/sidebar layout.

---

## Spiritual (Detail)
Bible in two translations (modern WEB + Douay-Rheims), traditional prayers, Rosary, liturgical calendar, devotional classics, plus five devotional pages: holy hour, Stations of the Cross, Divine Mercy chaplet (and Seven Sorrows), simplified Liturgy of the Hours (from local Bible files), saints calendar with 9-day novena tracker.  
43 color themes + 29 interface styles (including devotional set: Vespers, Iconostasis, Catacomb, Rose Window, Illuminated, Stained Glass, Monastic). Any theme works with any style.

## Look & Feel
- Cross-fade tab transitions with card settle-in animation
- Top-bar progress line for slow fetches
- Toast stack (bottom-right) with icons, colors, timeout bars
- Motion setting: **Full** / **Subtle** / **Off** (app controls it, not Windows)
- 43 color themes × 29 styles, all combinable, fade on change
- Adaptive polling (`A.every` with visibility/focus tracking), idle callbacks, debounce/throttle, memoization, virtual lists/grids, lazy images, performance monitor

---

## AI Backends
### Local (Ollama)
Runs entirely on your PC. Models like `qwen3.5:9b`, `qwen3.5:2b` (low-power), `llama3.1:8b`, `nemotron3:8b`, `gemma2:9b`, `phi3:3.8b`. No internet needed. Model memory configurable.

### Cloud (Settings → AI & power)
- **Anthropic (Claude)**: Your own API key; routes via local [Respan Gateway](https://github.com/respanai/respan-gateway) (MIT/Apache-2.0) — no sign-up, local-only, optional. Without it, direct to Anthropic; `/api/cloud` shows `gateway: off`.
- **Free LLM providers** (OpenAI-compatible): 22+ providers with free tiers. Keys encrypted via Windows DPAPI in `data/cloud.json` (per-provider under `providers.{id}.keyBlob`). Recommended models per provider shown in dropdown; custom model ID entry supported. Tool calling passed through automatically.
- **No-key providers**: Glhf.chat, Chutes.ai, OVHcloud AI Endpoints (anonymous) — zero setup. SSL verification relaxed for these.
- **Local-model check**: Chat checks Ollama `/api/tags` before routing to cloud (fixes "jaahas uncensored model" Ollama model that stopped working).

---

## Data & Backups
- **Local only**: Notes → `Documents\Assistant Notes`, server data → `data\`, browser storage → `edge-profile\`
- **Full backup**: Settings → Back up everything → one zip (choose location, e.g., external drive); Restore puts it back; imported songs/libraries/models not included
- **Progress copies**: Auto-dated zip every start + daily to `Documents\Moundshroud Backups\progress-YYYY-MM-DD` (notes, data files, browser storage — ratings, journal, favorites, Bible notes, reading plans, playlists, preferences); newest 10 kept with `READ-ME-FIRST.txt`
- **Emergency restore**: `.\restore-progress.ps1 -List` / `-Backup` / `-Name latest` / `-Name before-restore-...` — works with app closed, no internet needed
- **Program snapshots**: `snapshot.ps1` / `restore-snapshot.ps1` (see `SNAPSHOTS.txt`)

---

## Self-Test
Settings → Run a self-test — opens every tab/page, checks data files and local services. Run after install/update. Red crosses explained inline; "needs restart" = close all windows and reopen.

---

## Folder Map
```
server.js, lib\        → local server (zero npm deps)
web\                   → app (web\js\ = one file/feature, web\data\ = Bibles, recipes, stars)
Listener.cs            → tray program source (C#, compiles to assistant-listener.exe)
py\                    → document helpers (LibreOffice automation)
nomad\library\         → offline Kiwix .zim files (never downloaded twice)
engines\stockfish\     → chess engine (auto-downloads official release + verifies fingerprint)
data\                  → your server data (not shipped — encrypted keys, settings, caches)
releases\              → built release zips (not committed)
.chlaude\              → Kilo agent config (not committed)
```

---

## Sharing with a Friend
`.\make-release.ps1 -Verify` creates two zips under Discord's 10 MB limit in `releases\`:
- `Moundshroud-<ver>-part1-program.zip` (program + setup)
- `Moundshroud-<ver>-part2-data.zip` (Bibles, recipes, star data)
- `MESSAGE-FOR-DISCORD.txt` (ready-to-paste note with steps + checksums)
- `SHA256.txt`

**No personal data, libraries, music, AI models, or pre-built `.exe`.** Friend unzips both, runs `Setup-Moundshroud.bat` (offers Node.js/Ollama via winget, downloads chosen model, fetches kiwix-tools, compiles hotkey helper, makes shortcuts, starts app). `START-HERE.txt` has same steps.

---

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

---

## For Developers
- `node tests/run.js` — 120+ automated checks (chess, news, markets, vault, photos, mail, release rules). Run before every release.
- `install-gateway.ps1` — adds Respan Gateway (`.venv`, `respan-gateway==0.3.0`); `lib/gateway.js` starts it; `py/gatewayworker.py` is the worker
- `make-release.ps1 -Verify` — builds zips, installs to folder with spaces/accents/apostrophe to prove setup works
- Server has **zero npm deps**: `node server.js` with Node 24 is all it needs
- `MOUNDSHROUD_PORT` runs second copy on another port (same `data` folder — test carefully)
- `.gitignore` allowlists only program files; personal data/downloads/browser profile/snapshots/releases never committed
- Tab scripts lazy-loaded on demand via `web/js/lazy.js` (preload on hover/idle); all 200+ JS files now lazy
- Virtual scrolling on long lists (classics, chess books, money, notes, study decks/cards, tools repos/clipboard)
- API endpoints: `/api/about`, `/api/is-author`, `/api/cloud/*`, `/api/git/push`, `/api/app/share`, `/api/free/*`, `/api/net/*`, `/api/lichess/*`, `/api/mail/*`, `/api/photos/*`, `/api/notes/*`, `/api/study/*`, `/api/cards/*`, `/api/reminders/*`, `/api/budget/*`, `/api/journal/*`, `/api/albums/*`, `/api/chess/*`, `/api/cyber/*`, `/api/studio/*`, `/api/prepare/*`, `/api/faith/*`, `/api/tools/*`, `/api/convert/*`, `/api/vault/*`, `/api/brain/*`, `/api/forge/*`, `/api/practice/*`, `/api/finetune/*`, `/api/modellab/*`, `/api/artex/*`, `/api/office/*`, `/api/convlib/*`, `/api/search`, `/api/web/search`, `/api/prep/*`, `/api/inv/*`, `/api/tor/*`, `/api/ocr`, `/api/transcribe`, `/api/quick`, `/api/sys`, `/api/extract`, `/api/backup`, `/api/restore`, `/api/autocommit`, `/api/unload`, `/api/embed`, `/api/art/flux`, `/api/modelcaps`, `/api/file`, `/api/rhyme`, `/api/thesaurus`, `/api/harness/kind`, `/api/wake`, `/api/problems`, `/api/safe`, `/api/clip/*`, `/api/kv/*`, `/api/pc/*`, `/api/convlib/*`, `/api/office/*`, `/api/juiceshop/*`, `/api/cyber/*`, `/api/storybook/*`, `/api/forge/*`, `/api/practice/*`, `/api/finetune/*`, `/api/modellab/*`, `/api/artex/*`, and more.

---

## Known Limits
- AI quality = local model quality; Ask Moundshroud Everything always shows sources
- Sky → Weather uses only your barometer; News front page shows live forecast for one place (Open-Meteo, internet on)
- Garden dates = latitude estimates unless you enter frost dates
- Recipe shopping lists = approximate (old running-text recipes)
- No compass sensor → Compass page uses manual dial
- Windows Focus Assist may hide toast part; verse card on screen still appears
- Lichess fair-play: all engines/hints locked during live games
- Mail never sends; drafts only go to your Drafts folder
- Passwords vault: AI never sees the page content
- Offline libraries require Kiwix .zim downloads (first run downloads index only; full .zim on demand)