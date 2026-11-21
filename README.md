# Moundshroud

**Install on Windows 10 or 11 (x64).** Download the `Moundshroud-Setup` executable from [GitHub Releases](https://github.com/darthsalad465/Moundshroud/releases/latest), run the setup wizard, then open **Moundshroud** from Start. You can remove it from Windows Settings under **Apps**. The installer includes the desktop window and server. Local AI chat requires Ollama and a downloaded model. The desktop edition omits ARTEX.

Moundshroud is a Windows desktop assistant that brings local AI, research tools, creative work, and everyday utilities into one app. It runs its interface in Microsoft Edge app mode and uses a small Node.js server on your own PC. With Ollama and a local model installed, AI chat can run on-device. Online services are optional and controlled through the app’s settings.

> **Launch tip:** If Moundshroud does not open on the first try, wait a few seconds and try launching it **two more times**. If it still will not open, run `Setup-Moundshroud.bat` again and follow the troubleshooting steps below.

<!-- BEGIN GENERATED APP REFERENCE -->
## Live app reference

- **App version:** 1.4.0
- **In-app Guide last updated:** 2026-11-21

### Main sections

- Today
- News
- Chat
- 3D Brain
- 3D Globe
- Browser
- Calendar
- Library
- My Files
- Notes
- Mail
- Documents
- Office files
- Calculator
- Scanner
- Meeting notes
- Reminders & timers
- Clipboard
- Study
- Languages
- Writing
- Practice
- Teach me
- Sky
- Lab
- Studio
- Cyber
- Tools
- Prepare
- Kitchen
- Garden
- Money
- Journal
- Albums
- Games
- Music
- Radio
- TV
- Photos
- Spiritual
- App map
- Guide
- Edit the app
- Coding

> This section is generated from the app version, navigation, and Guide metadata whenever a release is built or code is pushed to GitHub. Edit the surrounding README sections for setup, privacy, and feature explanations.
<!-- END GENERATED APP REFERENCE -->

## What’s included

Moundshroud opens to **Today**. Its main areas include:

- **Chat:** local-model chat, saved conversations, Agent, Swarm, Debate, and other assistant modes. Chat can search selected files and installed offline libraries. Optional web search and online models require you to enable internet access.
- **Research and work:** News, Browser, Library, Notes, Files, Mail, Documents, Office Files, Calendar, Reminders, Clipboard, Calculator, Scanner, and Meeting Notes.
- **Learning:** Study cards and quizzes, Languages, Writing, Practice, Teach Me, Lab, and the searchable Guide.
- **Maps and science:** interactive 3D Brain, 3D Globe, and Sky chart. The Globe includes offline map data plus optional online map tiles and live data layers.
- **Creative tools:** Studio, music tools, games, photos and albums, radio, TV, and story creation. Some generation tools require their optional model or engine to be installed.
- **Personal and preparedness:** Kitchen, Garden, Money, Journal, Health, Spiritual, and preparedness planning.
- **Development and utility:** Tools, App Map, Edit the app, and Coding. Edit the app works on Moundshroud’s own source files; Coding opens a folder you choose on this PC.

The exact tabs and available features can change by version. The in-app **Guide**, **App Map**, and **Settings → Run a self-test** are the best places to check what is available in your copy.

## Privacy and internet access

Moundshroud is designed to work offline, but not every feature is offline. Local chat uses Ollama and a model installed on this PC. Offline books and other large resources must be downloaded before they can be used. News refresh, web search, online AI providers, mail connections, Lichess, map tiles, live Globe layers, and downloads need internet access.

Internet features are controlled in Settings. Review each feature before enabling it: requests to an online provider may include the information needed for that feature. Moundshroud does not automatically upload your entire notes, files, or Password Vault to an AI provider. Content you submit, attach, or ask an AI feature to process may be sent to the selected online provider. The Password Vault is encrypted locally, and its contents are not shown to Chat.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- Node.js LTS. The server has no npm package-install step; the repository is tested with Node.js 24.
- Microsoft Edge for the app window.
- Ollama and at least one compatible local model for on-device AI. Setup can offer to install Ollama and download a small starter model.
- Enough disk space for the models and optional offline libraries you choose. These downloads can be many gigabytes.

LibreOffice and additional local engines enable some optional features. Setup can offer Kiwix, which is needed to read downloaded `.zim` offline books. Optional components can also be installed later from the relevant app section or setup scripts.

## Install and open

### Packaged release

1. Extract the program archive and the matching data archive into the **same folder**. Do not run Moundshroud from inside a ZIP file.
2. Run `Setup-Moundshroud.bat` and follow its prompts. It checks for Node.js and Ollama, can download a starter model and Kiwix, and creates a Moundshroud shortcut.
3. Open Moundshroud with the desktop or Start menu shortcut, or press **Ctrl+Alt+A**.
4. In the app, open **Settings → Run a self-test** to check the installation.
5. To add offline books and other optional resources, use **Prepare → Stock up** and check the size before downloading.

Setup is safe to run again: it checks what is already installed and offers to fill in missing components.

### Running from a source checkout

Install the requirements above, then open PowerShell in the project folder and run:

```powershell
.\open-moundshroud.ps1
```

That launcher starts the local server if needed and opens the app window. To start only the server for development, run `node server.js`; the default address is `http://127.0.0.1:47231`. The server listens on loopback. You can set `MOUNDSHROUD_PORT` to use another port.

## First steps

1. Open **Settings** to review privacy, internet access, appearance, and AI choices.
2. Confirm Ollama is running and that a model is installed. The installer’s small starter model is a good baseline; larger models need more memory and may run more slowly.
3. Run the self-test from **Settings → Backup & data** after setup or an update.
4. Make a backup in **Settings → Backup & data**. You can also check a backup archive there without restoring it.
5. Press **Ctrl+K** to search chats, notes, files, library content, app pages, and commands.
6. Press **F1** to open the Guide or use the walkthroughs in Settings.

## Useful keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Alt+A` | Open or hide Moundshroud from anywhere in Windows |
| `Ctrl+Alt+Q` | Ask about selected text |
| `Ctrl+Alt+W` | Look up selected text in the offline library |
| `Ctrl+Alt+D` | Define the selected word |
| `Ctrl+Alt+S` | Select an area of the screen and read its text |
| `Ctrl+Alt+N` | Create a quick note or reminder |
| `Ctrl+Alt+V` | Open voice mode |
| `Ctrl+Alt+C` | Open clipboard history, when enabled |
| `Ctrl+Alt+E` | Open emergency cards |
| `Ctrl+K` | Search the app and run commands |
| `Ctrl+N` | Start a new chat |
| `Alt+1`–`Alt+9` | Jump to a tab |
| `F1` | Open the Guide |
| `Esc` | Stop a reply or close the current dialog or panel |

The app’s Guide and Settings list additional shortcuts. Some system-wide shortcuts require the tray helper (`assistant-listener.exe`).

## Data, backups, and recovery

Moundshroud keeps its working data on this PC. The `data` folder stores server-side app data; the Edge app profile stores browser-side preferences and progress. Notes are kept in the location shown by the app. The app’s storage and privacy screens explain these locations and what is included in a backup.

- **Back up everything** creates a ZIP containing supported app data and browser settings. Save a copy somewhere separate, such as an external drive.
- **Check a backup** reads the archive and checks its contents without restoring or changing your current data.
- **Restore from a backup** replaces matching data from that backup. Review the confirmation carefully before proceeding.
- **Code snapshots** are for rolling back changes to the app itself. See `SNAPSHOTS.txt`; these are separate from personal-data backups.

AI models, downloaded libraries, and imported media can be large and may not be included in a full backup. Keep original copies of anything that cannot easily be downloaded again.

## Troubleshooting

### The app window does not appear

If it fails on the first launch, wait a few seconds and try again two more times. Then:

1. Run `Setup-Moundshroud.bat` again and read any messages it reports.
2. Confirm Node.js is installed and Ollama is running if you want local AI.
3. Open Moundshroud from its shortcut or run `open-moundshroud.ps1` from the project folder.
4. Once the app opens, run **Settings → Backup & data → Run a self-test** and review any failed checks.
5. If the problem remains, open **Settings → Problems & crash log** and save the relevant details before asking for help.

### Chat cannot answer

Confirm Ollama is running, a model is installed, and the selected model is available. Local AI quality and speed depend on the chosen model and the PC’s available memory. Online models require internet access and their own provider settings.

### Offline books are missing

Install Kiwix using setup, then download the books you want from **Prepare → Stock up**. The library index and the books themselves are separate downloads.

### Changes to app code are not visible

Changes under `web/` generally appear after reloading the app page. Changes to `server.js` or `lib/` require restarting Moundshroud. **Edit the app** keeps file versions and checks JavaScript syntax before saving; review proposed code before applying it.

## For developers

- `server.js` starts the loopback Node.js server.
- `web/` contains the interface and static assets; most feature code is under `web/js/`.
- `lib/` contains server-side features and local APIs.
- `tests/` contains the project’s automated checks. Run them with `node tests/run.js`; some integration checks require local services or network access.
- No `npm install` is needed for the core server.
- `data/`, browser profiles, downloaded models and libraries, snapshots, and release builds may contain personal or generated data. Review `.gitignore` and the files you plan to share before publishing a copy.
- `make-release.ps1` builds packaged releases. `Setup-Moundshroud.bat` runs `setup.ps1`.
- `node scripts/update-readme.js` refreshes the generated app reference in this README. The release builder runs it automatically, and GitHub Actions runs it after pushes.
- `scripts/check-github-safety.js` checks outgoing pushes and GitHub revisions for private-data paths and common credentials, including private keys and provider tokens. The local push hook is enabled in this checkout; after a fresh clone, run `.\scripts\install-git-safety.ps1` once from PowerShell. Pushes are blocked when the scan finds a problem. GitHub Actions repeats the scan on pushes and pull requests.
- For an additional GitHub-side block on exposed credentials, enable **Secret scanning** and **Push protection** in the repository’s **Settings → Security**. Require the **GitHub safety scan** check in branch protection for pull requests. The hosted scan is a second line of defense; the local hook is what prevents an ordinary push from uploading a flagged change.

## AI-generated code note

LLMs used to generate or modify code for Moundshroud are liable for bugs in the code they produce.

## License

Moundshroud’s source code is distributed under the MIT License; see [`LICENSE`](LICENSE). Downloaded models, libraries, engines, and other third-party components have their own licenses and terms. Check the terms for each component before redistributing it.
