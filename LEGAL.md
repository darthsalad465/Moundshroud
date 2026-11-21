# Legal notice, content and privacy

Moundshroud is a local, offline-first desktop app with a set of simulated terminals. This page states plainly what is
real and what is invented, and what the app does with your data.

## Everything in the sandboxes is fiction

The terminal playground, Scenario Lab, Puzzle Studio, the Labyrinth, Terminal Ops, Live Fire, Remote Access, the
Cyber Academy lessons and the app shell are **simulations**. Every item below is generated or invented, and none of it
describes a real person, company, agency, device or event:

- names, usernames, job titles, email addresses and chat handles
- phone numbers, postal addresses, IP addresses, hostnames and MAC addresses
- passwords, passphrases, "leaked" documents, secrets, HR files, medical notes, legal memos and case files
- network captures, logs, tickets, dashboards and incident reports

Any resemblance to a real person or organisation is coincidental. The "confessions" and embarrassing notes in the deep
sandbox lore are written fiction, not scraped data.

## Nothing is hacked, scanned or sent

The terminals are JavaScript simulations of a filesystem and a shell. They do not:

- open sockets, send packets, resolve DNS, or contact any host
- connect to, scan, exploit or fingerprint a real machine or network
- run a real program, container or service
- create real credentials, hashes of real secrets, or working malware

Network commands (`ping`, `curl`, `nmap`, `ssh`, `nc`, `traceroute`, …) print fabricated output. In the app shell they
report only what your own browser can observe locally — platform, CPU count, screen size, language, time zone, online
state — and the active tools are deliberately inert. No offensive-security content here is operational: nothing you
type can be aimed at a system that exists.

## Your data stays on your computer

- The app server listens on loopback. Chats, notes, files and settings live in the app's `data/` folder or in your
  browser's local storage.
- The app shell keeps every edit you make in your own browser (`localStorage`). It never writes to the app's source
  files, so one person's shell session cannot change the app for anyone else.
- Nothing is uploaded, sold or shared by the app itself. Optional online features are off unless you switch them on,
  and the 🔒 Privacy section of Settings lists exactly what each one sends.

## Third-party code

Bundled libraries keep their own licences and attribution under `web/vendor/`. Their copyright notices are part of the
distribution and must not be removed. Moundshroud's own code is under the MIT licence in `LICENSE`.

## Using this responsibly

The cyber-security lessons teach recognition, procedure and defensive reasoning inside a fake environment. Do not use
them as instructions against systems you do not own or have written permission to test. If you want to practise for
real, use a legal range you control (an isolated VM, a purpose-built training platform, or a written engagement scope).
