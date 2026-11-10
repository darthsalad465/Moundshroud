// The App map: Moundshroud described by itself. Everything here is read from the app's own files and the running
// parts each time it is asked for, so the map can never drift from what the app really is: every code file with the
// sentence at its top that says what it does, the sections inside each tab, the server's addresses, where each kind of
// data is kept and how big it is, and which helper programs are running.
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), os = require('os');

const ROOT = path.join(__dirname, '..');
const exists = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const size = p => { try { return fs.statSync(p).size; } catch (e) { return 0; } };

/* the opening comment of a file: what it is for, in its author's words */
/* the few files that do not open with a description of their own */
const KNOWN = { 'web/index.html': 'The page the window opens: the top bar, the tab bar, one empty panel per tab, and the list of every script the app loads.', 'web/style.css': 'The app’s look: colours, the top bar and tabs, cards, buttons, panels, the dark theme.', 'web/games/imperium/index.html': 'Imperium’s page: the game canvas, the HUD and panels, and the order its scripts load in.', 'web/games/middlewatch/index.html': 'Middlewatch’s page.', 'pc-volume.ps1': 'Reads and sets the Windows sound volume for the assistant.', 'py/mkpptx.py': 'Makes PowerPoint files for the documents feature.', 'py/mkxlsx.py': 'Makes Excel files for the documents feature.', 'py/pdfworker.py': 'Reads text out of PDF files.' };
function describe(text, rel) {
  if (rel && KNOWN[rel]) return KNOWN[rel];
  const t = text.replace(/^﻿/, '').replace(/^param\([^)]*\)\s*\r?\n/, '');
  const py = t.match(/^\s*"""([\s\S]*?)"""/); if (py) return py[1].replace(/\s+/g, ' ').trim().slice(0, 420);
  let m = t.match(/^\s*\/\*([\s\S]*?)\*\//) || null, lines = [];
  if (m && t.trim().startsWith('/*')) lines = m[1].split('\n');
  else { for (const l of t.split('\n')) { if (/^\s*(\/\/|#|<!--)/.test(l)) lines.push(l.replace(/^\s*(\/\/|#|<!--)\s?/, '').replace(/-->\s*$/, '')); else if (l.trim() && lines.length) break; else if (l.trim()) break; if (lines.length > 6) break; } }
  return lines.map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 420);
}
function files() {
  const out = [], want = (d, re, depth) => {
    let ents; try { ents = fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }); } catch (e) { return; }
    ents.forEach(e => {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) { if (depth > 0 && !/^(music|data|vendor|fonts|img|images|node_modules)$/i.test(e.name)) want(rel, re, depth - 1); return; }
      if (re.test(e.name)) { const r2 = rel.replace(/\\/g, '/'); out.push({ path: r2, bytes: size(path.join(ROOT, rel)), desc: describe(read(path.join(ROOT, rel)).slice(0, 4000), r2) }); }
    });
  };
  ['server.js', 'Listener.cs', 'setup.ps1', 'open-moundshroud.ps1', 'make-release.ps1', 'snapshot.ps1', 'restore-snapshot.ps1', 'restore-progress.ps1', 'install-art-model.ps1', 'install-music-model.ps1', 'install-gateway.ps1', 'ocr.ps1', 'pc-volume.ps1', 'cleanup-disk.ps1'].forEach(f => { if (exists(path.join(ROOT, f))) out.push({ path: f, bytes: size(path.join(ROOT, f)), desc: describe(read(path.join(ROOT, f)).slice(0, 4000), f) }); });
  want('lib', /\.js$/, 0); want('web/js', /\.js$/, 0); want('web', /\.(css|html)$/, 0); want('web/games', /\.(js|html)$/, 1); want('py', /\.py$/, 0); want('tests', /\.js$/, 0);
  return out;
}
/* the sections inside each tab: the lists of [id, 'label'] pairs each page file declares, next to the tab it registers */
function sections(fileList) {
  const out = [];
  fileList.filter(f => f.path.startsWith('web/js/')).forEach(f => {
    const t = read(path.join(ROOT, f.path)), reg = [...t.matchAll(/A\.registerTab\('(\w+)',\s*'([^']+)'/g)].map(m => ({ id: m[1], label: m[2] }));
    const lists = [];
    for (const m of t.matchAll(/const\s+(SUBS|TABS|CATS|SECS|SUB|SECTIONS_LIST|PAGES|MODES|AREAS)\s*=\s*\[((?:\s*\[[^\]]{1,120}\]\s*,?)+)\s*\]/g)) {
      const items = [...m[2].matchAll(/\[\s*'([\w-]+)'\s*,\s*'([^']{1,60})'/g)].map(x => ({ id: x[1], label: x[2] }));
      if (items.length >= 2) lists.push({ name: m[1], items });
    }
    if (reg.length || lists.length) out.push({ file: f.path, tabs: reg, lists });
  });
  return out;
}
/* every address the server answers, grouped under the comment headings in server.js */
function endpoints() {
  const src = read(path.join(ROOT, 'server.js')), out = []; let group = 'General';
  src.split('\n').forEach(l => {
    const h = l.match(/\/\*\s*-{2,}\s*(.+?)\s*-{2,}\s*\*\//); if (h) group = h[1].replace(/\s*\(.*$/, '').slice(0, 60);
    for (const m of l.matchAll(/url\s*===\s*'(\/api\/[^']+)'(?:\s*&&\s*req\.method\s*===\s*'(\w+)')?/g)) out.push({ group, path: m[1], method: m[2] || 'GET' });
    for (const m of l.matchAll(/url\.startsWith\('(\/api\/[^']+)'\)/g)) out.push({ group, path: m[1] + '…', method: 'ANY' });
  });
  const seen = new Set(); return out.filter(e => { const k = e.method + e.path; if (seen.has(k)) return false; seen.add(k); return true; });
}
/* where your things are kept */
const DATA_NOTES = { 'chats.json': 'Your chat history', 'news.json': 'The downloaded news (two weeks)', 'news-sources.json': 'Your News source choices', 'news-access.json': 'Which outlets can be read in the app', 'privacy.json': 'Your privacy choices', 'problems.log': 'The problem log (never sent anywhere)', 'clipboard.jsonl': 'Clipboard history (when switched on)', 'prep.json': 'Prepare: household, supplies, people, plans', 'cloud.json': 'Online AI (Claude) key and internet switch', 'markets': 'Downloaded market data', 'news-img': 'News pictures kept for offline reading', 'removed': 'What was removed in Stock up, so it can be put back' };
function dataFiles() {
  const d = path.join(ROOT, 'data'); let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { }
  return ents.map(e => { const p = path.join(d, e.name); let b = 0; if (e.isDirectory()) { try { const st = [p]; while (st.length) { const x = st.pop(); for (const n of fs.readdirSync(x, { withFileTypes: true })) { const q = path.join(x, n.name); if (n.isDirectory()) st.push(q); else b += size(q); } } } catch (er) { } } else b = size(p); return { name: e.name, dir: e.isDirectory(), bytes: b, note: DATA_NOTES[e.name] || (/^chess|^cb-/.test(e.name) ? 'Chess' : /^notes|^journal/.test(e.name) ? 'Notes and journal' : '') }; }).sort((a, b) => b.bytes - a.bytes);
}
/* which helper programs are running */
const portUp = (port, p) => new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: p || '/', timeout: 1200 }, x => { x.resume(); res(true); }); r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); }); });
async function services(port) {
  let kport = 0; try { kport = require('./kiwix').PORT; } catch (e) { }
  const list = cp.spawnSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).stdout || '';
  const running = n => new RegExp('"' + n.replace('.', '\\.') + '"', 'i').test(list);
  return [
    { name: 'Moundshroud server', what: 'Node.js, answering only this PC, serving the window and doing every job that needs the disk or the internet', where: 'server.js · http://127.0.0.1:' + port, up: true },
    { name: 'AI engine (Ollama)', what: 'Runs the local language models', where: 'http://127.0.0.1:11434', up: await portUp(11434, '/api/version') },
    { name: 'Library server (Kiwix)', what: 'Opens the offline books (started when a book is first opened)', where: 'http://127.0.0.1:' + kport + ' (shown under /wiki)', up: kport ? await portUp(kport, '/wiki/') : false },
    { name: 'Hotkey and tray helper', what: 'Ctrl+Alt shortcuts anywhere in Windows, the tray icon, starting Moundshroud', where: 'assistant-listener.exe (built from Listener.cs)', up: running('assistant-listener.exe') },
    { name: 'The window', what: 'Microsoft Edge in app mode with its own private profile', where: 'edge-profile', up: running('msedge.exe') },
    { name: 'Voice typing worker', what: 'whisper.cpp, started on the first use of the microphone', where: 'py/voiceworker.py', up: running('python.exe') },
    { name: 'Chess engine', what: 'Stockfish, started when chess needs it', where: 'engines/stockfish', up: running('stockfish.exe') }
  ];
}
async function build(port) {
  const fl = files();
  return {
    version: read(path.join(ROOT, 'VERSION')).trim(), root: ROOT, port, node: process.version, os: os.type() + ' ' + os.release(), cpus: os.cpus().length, ramGB: Math.round(os.totalmem() / 1073741824),
    files: fl, sections: sections(fl), endpoints: endpoints(), data: dataFiles(), services: await services(port),
    docs: [path.join(os.homedir(), 'Documents', 'Moundshroud Documents'), path.join(os.homedir(), 'Documents', 'Assistant Notes')].filter(exists)
  };
}
module.exports = { build };
