# Moundshroud

*Version 1.3.0*

A private assistant that runs entirely on your own Windows PC. It answers questions with a local AI model, holds offline libraries (Wikipedia, medical, survival, how-to, classic books), and bundles tools for study, languages, music, chess and games, the night sky, weather, a calendar, a kitchen, a garden, a lab, a timeline and a private budget. Nothing is sent to the internet unless you choose to download something.

## What it needs
| | |
|---|---|
| Windows | 10 or 11, 64-bit |
| [Node.js](https://nodejs.org) | a current version (developed and tested on Node 24; the server has no other dependencies) |
| [Ollama](https://ollama.com) | for the local AI models (for example `qwen3.5:9b`, with `qwen3.5:2b` for low-power mode) |
| Microsoft Edge | opens the Moundshroud window (it is already part of Windows) |
| Disk | about 100 MB for the app; the offline libraries and AI models are separate downloads (tens of GB) |
| Optional | LibreOffice (documents), a GPU for faster AI |

## Starting Moundshroud
* Press **Ctrl+Alt+A** anywhere in Windows, or run `open-moundshroud.ps1`, or use the Desktop / Start menu shortcut.
* The tray program `assistant-listener.exe` (built from `Listener.cs`) provides the hotkeys, reminder pop-ups and the 8:00 AM verse notification. It starts with Moundshroud.
* Closing the Moundshroud window stops the server a few minutes later. The tray program stays so reminders still arrive.

## Hotkeys
Ctrl+Alt+A open Moundshroud · Q ask about selected text · W look it up in Wikipedia · D define a word · S copy text from the screen · N quick note or reminder · V talk to Moundshroud · C clipboard history · E emergency cards.

Inside Moundshroud: **Ctrl+K** opens the command palette (search everything, or run any command), **Ctrl+N** new chat, **Alt+1** to **Alt+9** jump to an area, **Ctrl+,** Settings, **F1** the guide, **?** the full list of shortcuts, **Esc** closes or steps back. Every shortcut is listed in **Settings > Shortcuts & about**, and the list is built from the same place the keys are, so the two cannot disagree.

## The tabs
Today · News · Chat · Browser · Calendar · Knowledge (Library, My Files, Notes, Mail) · Learn (Study, Languages, Studio, Sky, Lab, Timeline, Cyber) · Tools · Prepare · Life (Kitchen, Garden, Money, Journal) · Fun (Entertainment, Music, Photos) · Spiritual · App map · Guide.

**Tools › Agent** opens a free coding helper that runs on this PC: Claude Code's tools driven by the Gemma 4 model in Ollama, in a window of its own, working in a folder you choose. It expects its launcher in `%USERPROFILE%\gemma-agent` (set `MOUNDSHROUD_AGENT_DIR` to use another folder) and shows what is missing if it is not set up. Ctrl+K › *Open the coding agent* jumps to it.

**New in 1.3.0**
* **Passwords** (Tools): an encrypted password vault (AES-256-GCM, key from your master password by PBKDF2 with 600,000 rounds, all done in the window). Generator, check-up for weak and reused passwords, import from browsers and other managers, earlier versions kept. Copied passwords are wiped from the clipboard after 30 seconds and from Moundshroud’s clipboard history. The AI never sees the page.
* **Photos**: your pictures by month, searchable in plain words once the local AI has described them (“dog in the snow”, “birthday 2024”). Files are only read, never moved. OneDrive files that are only in the cloud are not downloaded unless you open one.
* **Mail**: read your email over IMAP (Gmail, Yahoo, iCloud, Fastmail, Proton Mail through Bridge and others), with scripts, forms and tracking pictures blocked, scam warnings, an AI inbox brief, summaries and help writing replies. Moundshroud never sends email: drafts go to your account’s Drafts folder. The password is protected by Windows for your account only.
* **The AI remembers you**: say “remember that…” in Chat; Ctrl+K › *What the AI remembers about me* shows and deletes it all. The AI can also find photos and start email drafts.
* **♞ Lichess** (Chess): real games against real people on your own free Lichess account, through Lichess’s official Board API. While a game is being played, every engine, hint and analysis tool in Moundshroud is locked, as Lichess’s fair-play rules require.
* **News › Research**, **Tor Browser** from the Browser tab, working **Meeting notes** transcripts, and animations that no longer switch off because of a Windows performance setting. **Settings > Appearance > Grouped top bar** switches back to one flat row. The **Guide** tab explains every page, and **F1** opens it anywhere.

**Spiritual** holds the Bible in two translations, traditional prayers, the Rosary, the liturgical calendar and devotional classics, plus five devotional pages: a **holy hour**, the **Stations of the Cross**, the **Chaplet of Divine Mercy** (and the Seven Sorrows), a simplified **Liturgy of the Hours** built from the Bible files on your PC, and a **saints calendar** with a nine-day novena tracker. **Settings > Appearance** offers 43 colour themes and 29 interface styles, including a devotional set (Vespers, Iconostasis, Catacomb, Rose Window, Illuminated, Stained Glass, Monastic and more); any theme works with any style.

## Look and feel
Switching areas is a cross-fade: the page you are leaving fades and lifts out while the next fades in, and the first few cards on it settle into place behind. A thin line runs along the top of the window while the app is fetching something slow. Messages (copied, saved, failed) stack in the bottom corner with an icon, a colour and a bar showing how long each has left. **Settings > Appearance > Motion** chooses **Full**, **Subtle** or **Off**: *Off* leaves the app perfectly still while colours and highlights still tell you what is happening, and the app’s own Motion setting decides (Windows’ performance setting no longer switches animations off). Any of the 43 colour themes and 29 interface styles can be combined, and changing either one fades rather than jumps.

## Claude and the Respan Gateway
Every Claude request Moundshroud makes - chat, the buddy, quizzes, documents, the chess coach, and **Test it** in Settings - goes through the [Respan Gateway](https://github.com/respanai/respan-gateway?utm_source=freebuff&utm_medium=paid&utm_campaign=respan-gateway&bfcid=bfc_1.eyJpZCI6ImMwZWU0YmM5LTNkZTAtNDA2ZS04YTU4LTU5MTFkMDgwZjkxMiIsImMiOiIyMDM2ODZkZS1mMzg0LTQ4NTQtYmViNC1hYzBiYWRmNmM1NTUiLCJrIjoiM2IxMGE4YmUtNzgyOS00MmJhLWFmNmEtYmI0YWUxZTRhY2Y4IiwiaWF0IjoxNzkzODIwNTU1fQ.x926rcSBqpt1Jalqxe-fPvgRSl30NPkOyw9dcMPIvRk), an open-source gateway that runs quietly on this PC.

* **Nothing to sign up for.** The gateway is open source (MIT) and spends the Anthropic key you already saved in Settings. No Respan account, no Respan key, no credits, and nothing is traced or sent anywhere else. Your key reaches the gateway in its memory for the length of a request; it is never written into the gateway's own files.
* **One local door.** It listens on `127.0.0.1` only, starts the first time a Claude model is used, and stops with Moundshroud. Because it speaks the same Anthropic API, the request Moundshroud sends is byte for byte the one it always sent - so routing, retries and a request log now have one place to live, without any other part of the app changing.
* **It is optional.** With it not installed, or not started, Claude answers straight from Anthropic exactly as before, and `/api/cloud` says `gateway: off` (or why it failed).
* **Installing it:** Python 3.10 or newer is needed (the app's `pyenv` is fine), then one command:
  ```
  powershell -ExecutionPolicy Bypass -File install-gateway.ps1
  ```
  It makes a private environment in `.venv` and installs `respan-gateway==0.3.0` (wheels only, no build). Close Moundshroud first and open it again afterwards: it looks for the gateway when it starts.
* **By hand:** `.\\.venv\\Scripts\\python.exe -m respan_gateway` serves it on `http://127.0.0.1:8080` (`/ui/` there shows the live request log); Ctrl+C stops it. Moundshroud starts its own copy when it needs one, on a free port, so there is nothing to keep running. `.\\install-gateway.ps1` is the restart command after a Python change.
* **What was checked here:** `node tests\run.js` sends one Claude request and one streamed request through the gateway to a pretend Anthropic server on this PC (`tests\gateway-test.js`). It passed: the reply came back through the gateway, the stream arrived as the chat window reads it, the provider saw the real key the gateway holds rather than the caller's placeholder, and the app fell back to Anthropic's own address when the gateway was taken away. **No live Anthropic request was made or verified** during that check - that happens the next time you chat with a Claude model, in this PC's normal app.

## Your data and backups
* Everything you create is stored on this PC: notes in `Documents\Assistant Notes`, server data in `data\`, and the rest in the Moundshroud window's own browser storage (`edge-profile\`).
* **Settings > Back up everything** makes one zip with all of it (choose where to save it, for example an external drive). **Restore from a backup** puts it back. Imported songs, offline libraries and AI models are not in the backup.
* **Your progress also copies itself.** A few seconds after Moundshroud starts, and once a day at most, a dated copy of everything above goes to `Documents\Moundshroud Backups` (`progress-YYYY-MM-DD`): the notes, every data file, and the window's browser storage where ratings, the journal, favourites, Bible notes, reading plans, playlists and preferences live. The newest 10 are kept and each carries a `READ-ME-FIRST.txt` in plain words. **Prepare > Ready** shows when the last copy was made and has a *Copy it now* button.
* **If Moundshroud will not start at all**, the copies are still usable by hand. In the app folder: `\.\restore-progress.ps1 -List` (see the copies), `-Backup` (make a fresh one), `-Name latest` (put one back, or `-Name before-restore-...` to undo a restore). The script needs no internet and no running app; it saves what is there now before it changes anything. It restores window progress only when Moundshroud is closed, and says so if it is open.
* `snapshot.ps1` saves a dated zip of the *program* before changes; `restore-snapshot.ps1` rolls back (see `SNAPSHOTS.txt`).
* **Ask Moundshroud Everything** (Today page) searches your own data. The journal and money data are private and only read while you tick them.

## Checking that everything works
**Settings > Run a self-test** opens every tab and page, then checks the data files and local services. Run it after installing or updating. Anything marked with a red cross is explained in the line next to it; "needs a restart of Moundshroud" means close all Moundshroud windows and open it again.

## Folder map
`server.js` and `lib\` the local server · `web\` the app (`web\js\` one file per feature, `web\data\` Bibles, recipes, star data, `web\music\` songs) · `Listener.cs` the tray program source · `py\` helper scripts for documents · `nomad\library\` the offline libraries (Kiwix `.zim` files — anything already on the PC is used as it is, never downloaded twice) · `engines\stockfish\` the chess engine (if it is ever missing, **Prepare > Stock up** downloads the official Stockfish release again and checks it against the published fingerprint) · `data\` your server-side data (not shipped).

## Sharing Moundshroud with a friend
Run `.\make-release.ps1 -Verify`. It writes two zips to `releases\`, each under Discord's free 10 MB limit: `Moundshroud-<version>-part1-program.zip` (the program and setup) and `Moundshroud-<version>-part2-data.zip` (Bibles, recipes, star data). It also writes `MESSAGE-FOR-DISCORD.txt` (a ready-to-paste note with the steps and checksums) and `SHA256.txt`. **No personal data, no libraries, no music, no AI models, and no pre-built `.exe`** go in. `-Verify` then acts as the friend: unpacks both parts together, runs the setup (no installs or downloads) and starts the result.

The friend unzips both into one folder and double-clicks **`Setup-Moundshroud.bat`**. It offers to install Node.js and Ollama (through winget), downloads an AI model they choose, fetches the 17 MB kiwix library tool from download.kiwix.org, builds the hotkey helper from `Listener.cs` on their own PC with the compiler that ships with Windows, makes the shortcuts and starts Moundshroud. It can be run again safely. `START-HERE.txt` in the package has the same steps in plain words.

## Licences and credits
Moundshroud’s own code is released under the **MIT License** (see `LICENSE`). The bundled and downloadable content below keeps its own terms.

Bible texts: World English Bible and Douay-Rheims (public domain). Music: Kevin MacLeod (CC BY 4.0) and public-domain classical recordings. Star data: d3-celestial by Olaf Frohn (BSD-3-Clause; see `web\data\sky-LICENSE.txt`). Fonts: Atkinson Hyperlegible (Braille Institute of America), Pixelify Sans and Silkscreen, all under the SIL Open Font License 1.1 (`web\fonts\OFL-*.txt`). Rhyming dictionary: the CMU Pronouncing Dictionary, Carnegie Mellon University (BSD-style licence; `data\cmudict-LICENSE.txt`). Chess engine: Stockfish (GPL-3.0; licence beside the program). Cookbooks, classics and the offline libraries keep their own public-domain or Creative Commons terms.

## For developers
* `node tests/run.js` runs the automated checks (about 120: the chess engine, the news and markets code, the vault, photos, the mail client against a pretend mail server, the release rules and more). Run it before every release.
* `install-gateway.ps1` adds the Respan Gateway (`.venv`, `respan-gateway==0.3.0`, the same pin as `requirements.txt`); `lib/gateway.js` starts it for Claude requests and `py/gatewayworker.py` is the worker it starts. `node tests\run.js` checks the whole path against a pretend Anthropic server on this PC, and says so plainly and carries on if the gateway is not installed.
* `.make-release.ps1 -Verify` builds the two release zips and installs them into a folder with spaces, an accented letter and an apostrophe in its name to prove setup still works there.
* The server has no npm dependencies: `node server.js` with Node 24 is all it needs. `MOUNDSHROUD_PORT` runs a second copy on another port for testing (it uses the same `data` folder, so test with care).
* `.gitignore` lists only the program’s own files; personal data, downloads, the browser profile, snapshots and releases can never be committed.

## Known limits
* The AI answers are only as good as the local model; Ask Moundshroud Everything always shows its sources.
* The Sky › Weather page uses only your own barometer readings; the News front page can show a live forecast for one place you choose (from Open-Meteo, while internet access is on). Garden dates are estimates from your latitude unless you enter your own frost dates.
* The recipe shopping-list builder reads old running-text recipes, so it is approximate.
* The PC has no compass sensor: the Compass page uses a dial you turn yourself.
* Windows may hide the toast part of notifications if Focus Assist is on; the verse card on screen still appears.
