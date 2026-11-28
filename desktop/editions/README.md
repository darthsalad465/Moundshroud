# Moundshroud standalone editions

Six Windows x64 desktop apps with separate names, shortcuts, installations and Electron profiles.

| Edition | Workspace |
| --- | --- |
| Library | Library shelves, bookmarks, offline archives and the Browser workspace |
| Studio | Studio tools, photos and albums |
| Cyber | Local Deep Eye JSON review, baseline comparison and SHA-256 checks |
| Chess and Games | Chess, training, chess books and arcade games |
| Office | Documents, notes, office files, scanner and meetings |
| Media | Music, radio and TV |

## Optional content and engines

The setup executables include the desktop runtime and app code. Large downloads such as offline ZIM libraries, model weights, media collections and optional engines are separate.

- **Library.** Place the Kiwix tools under `resources/app-core/nomad/kiwix-tools` in the installation directory. Put ZIM files in `resources/app-core/nomad/library`, or set `MOUNDSHROUD_LIBDIR` to an existing ZIM folder before launch.
- **Studio.** Image and video generation use the `imggen` bundle, music generation uses `musicgen`, and local voices use `piper`. Those bundles go under `resources/app-core`. The Studio tools report engine availability.
- **Chess and Games.** Enhanced analysis uses `resources/app-core/engines/stockfish/stockfish.exe`. The offline chess books catalog uses `resources/app-core/nomad/chessbooks`.
- **Office.** Native document conversion needs LibreOffice. Camera and microphone use depends on Windows permissions.
- **Media.** Import local music from the Music workspace. Live radio and TV need an internet connection.

## Build

On Windows, install the desktop build dependencies with `npm ci --prefix desktop`. Run `node desktop/editions/build.cjs --test` for hidden-window startup tests and `node desktop/editions/build.cjs` to produce the installers.

Pass edition IDs to build or test a subset. Use `--source=<commit>` to pin the shared application source. The builder copies the committed shared runtime so uncommitted source, models, libraries and personal files stay out of the artifacts. The builds are unsigned.

Installers are written to `desktop/dist/editions/<edition>`. Run `desktop/editions/verify.ps1` to extract the actual installer payloads, launch each app in a hidden window and write a SHA-256 list. This requires 7-Zip.
