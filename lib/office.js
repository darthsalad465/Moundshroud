// LibreOffice integration: creates Word / Excel / PowerPoint / PDF files, converts between formats, and reads old formats (.doc .xls .ppt .odt ...).
// LibreOffice runs headless with its own private profile, so it never disturbs a LibreOffice window you have open.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const U = require('./util');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), TMP = path.join(DATA, 'tmp'), PREV = path.join(DATA, 'previews');
const SO = ['C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe', path.join(process.env.LOCALAPPDATA || '', 'Programs', 'LibreOffice', 'program', 'soffice.exe')].find(p => fs.existsSync(p)) || null;
const PY = path.join(ROOT, 'pyenv', 'Scripts', 'python.exe'), PPTX = path.join(ROOT, 'py', 'mkpptx.py'), XLSX = path.join(ROOT, 'py', 'mkxlsx.py');
const PROFILE = 'file:///' + path.join(DATA, 'lo-profile').replace(/\\/g, '/');
function docsDir() { const h = os.homedir(), od = path.join(h, 'OneDrive', 'Documents'); return fs.existsSync(od) ? od : path.join(h, 'Documents'); }
const OUT = path.join(docsDir(), 'Moundshroud Documents');

let chain = Promise.resolve(), used = false;         // LibreOffice handles one conversion at a time
/* when Moundshroud closes, stop only the headless LibreOffice that Moundshroud started (identified by its private profile), never one you have open */
function stop() { if (!used) return; try { cp.spawnSync('powershell.exe', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'soffice*' -and $_.CommandLine -like '*lo-profile*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore', windowsHide: true, timeout: 8000 }); } catch (e) {} }
function soffice(args, ms = 120000) {
  const job = chain.then(() => new Promise(res => {
    if (!SO) return res({ ok: false, err: 'LibreOffice is not installed' }); used = true;
    cp.execFile(SO, ['-env:UserInstallation=' + PROFILE, '--headless', '--norestore', '--nolockcheck', ...args], { timeout: ms, windowsHide: true }, (e, out, err) => res({ ok: !e, err: e ? String(err || e.message).slice(0, 200) : '' }));
  }));
  chain = job.catch(() => {}); return job;
}
const rm = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} };
const safe = s => String(s || 'Document').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Document';
function uniq(dir, stem, ext) { let p = path.join(dir, stem + ext), n = 2; while (fs.existsSync(p)) p = path.join(dir, stem + ' (' + n++ + ')' + ext); return p; }
const FILTER = { docx: 'docx:MS Word 2007 XML', xlsx: 'xlsx:Calc MS Excel 2007 XML', pptx: 'pptx:Impress MS PowerPoint 2007 XML', pdf: 'pdf', odt: 'odt', ods: 'ods', odp: 'odp', txt: 'txt:Text', csv: 'csv', html: 'html', rtf: 'rtf', png: 'png' };

/* convert one file; returns the path of the result or null */
async function convert(inFile, to, outDir, infilter) {
  fs.mkdirSync(outDir, { recursive: true });
  const args = []; if (infilter) args.push('--infilter=' + infilter);
  args.push('--convert-to', FILTER[to] || to, '--outdir', outDir, inFile);
  const r = await soffice(args); const out = path.join(outDir, path.basename(inFile, path.extname(inFile)) + '.' + to);
  return r.ok && fs.existsSync(out) ? out : (r.err ? (() => { throw new Error(r.err); })() : null);
}

/* ---------- markdown -> html (for Word documents) ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, '$1<i>$2</i>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?;:]|$)/g, '$1<i>$2</i>');
function mdToHtml(md) {
  const lines = String(md).replace(/\r/g, '').replace(/^```\w*\n?|```\s*$/gm, '').split('\n'); let h = '', list = null, i = 0;
  const close = () => { if (list) { h += '</' + list + '>'; list = null; } };
  while (i < lines.length) {
    const ln = lines[i]; let m;
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      close(); const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()); const head = cells(ln); i += 2; const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      h += '<table border="1" cellpadding="4" cellspacing="0"><tr>' + head.map(c => '<th>' + inl(c) + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</table><p></p>'; continue;
    }
    if ((m = ln.match(/^(#{1,4})\s+(.*)/))) { close(); h += '<h' + m[1].length + '>' + inl(m[2]) + '</h' + m[1].length + '>'; }
    else if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); h += '<ul>'; list = 'ul'; } h += '<li>' + inl(m[1]) + '</li>'; }
    else if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); h += '<ol>'; list = 'ol'; } h += '<li>' + inl(m[1]) + '</li>'; }
    else if (/^\s*(---+|\*\*\*+)\s*$/.test(ln)) { close(); h += '<hr>'; }
    else if (ln.trim() === '') close();
    else { close(); h += '<p>' + inl(ln) + '</p>'; }
    i++;
  }
  close(); return '<html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1,h2,h3,h4{font-family:Calibri,Arial,sans-serif}h1{font-size:22pt}h2{font-size:16pt}h3{font-size:13pt}</style></head><body>' + h + '</body></html>';
}
function tableToCsv(text) {            // accepts a code-fenced CSV, plain CSV, or a markdown table
  let t = String(text).replace(/\r/g, '').replace(/^```\w*\n?|```\s*$/gm, '').trim();
  if (/^\s*\|/.test(t)) t = t.split('\n').filter(l => !/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l)).map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => '"' + c.trim().replace(/"/g, '""') + '"').join(',')).join('\n');
  return t + '\n';
}

/* ---------- create a document ---------- */
async function create({ kind, title, content }) {
  if (!SO) return { error: 'LibreOffice is not installed on this PC.' };
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
  const stem = safe(title), work = path.join(TMP, 'doc' + Date.now()); fs.mkdirSync(work, { recursive: true });
  try {
    let out;
    if (kind === 'word' || kind === 'pdf') {
      const f = path.join(work, 'src.html'); fs.writeFileSync(f, mdToHtml(content), 'utf8');
      const docx = await convert(f, 'docx', work, 'HTML (StarWriter)'); if (!docx) throw new Error('Word conversion failed');
      if (kind === 'pdf') { const pdf = await convert(docx, 'pdf', work); if (!pdf) throw new Error('PDF conversion failed'); out = uniq(OUT, stem, '.pdf'); fs.copyFileSync(pdf, out); }
      else { out = uniq(OUT, stem, '.docx'); fs.copyFileSync(docx, out); }
    } else if (kind === 'sheet') {
      if (!fs.existsSync(PY)) throw new Error('The Excel writer is not installed');
      const spec = typeof content === 'string' ? JSON.parse(content) : content; if (!spec.title) spec.title = title;
      out = uniq(OUT, stem, '.xlsx'); spec.out = out; const jf = path.join(work, 'spec.json'); fs.writeFileSync(jf, JSON.stringify(spec), 'utf8');
      await new Promise((res, rej) => cp.execFile(PY, ['-I', XLSX, jf], { timeout: 60000, windowsHide: true }, (e, so, se) => e ? rej(new Error(String(se || e.message).slice(-200))) : res()));
    } else if (kind === 'slides') {
      if (!fs.existsSync(PY)) throw new Error('The PowerPoint writer is not installed'); const spec = typeof content === 'string' ? JSON.parse(content) : content;
      out = uniq(OUT, stem, '.pptx'); spec.out = out; const jf = path.join(work, 'spec.json'); fs.writeFileSync(jf, JSON.stringify(spec), 'utf8');
      await new Promise((res, rej) => cp.execFile(PY, ['-I', PPTX, jf], { timeout: 60000, windowsHide: true }, (e, so, se) => e ? rej(new Error(String(se || e.message).slice(-200))) : res()));
    } else return { error: 'unknown kind' };
    let preview = null; try { fs.mkdirSync(PREV, { recursive: true }); const p = await convert(out, 'png', work); if (p) { preview = path.join(PREV, path.basename(out) + '.png'); fs.copyFileSync(p, preview); } } catch (e) {}
    return { path: out, name: path.basename(out), preview };
  } catch (e) { return { error: String(e.message || e) }; }
  finally { rm(work); }
}

/* ---------- convert an uploaded file ---------- */
async function convertUpload(name, buf, to) {
  if (!SO) return { error: 'LibreOffice is not installed on this PC.' }; if (!FILTER[to]) return { error: 'unsupported format' };
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
  const work = path.join(TMP, 'cv' + Date.now()), ext = path.extname(String(name)).replace(/[^.\w]/g, '') || '.txt', stem = safe(path.basename(String(name), path.extname(String(name))));
  fs.mkdirSync(work, { recursive: true }); const src = path.join(work, 'input' + ext); fs.writeFileSync(src, buf);
  try { const o = await convert(src, to, work); if (!o) return { error: 'LibreOffice could not convert that file' }; const dest = uniq(OUT, stem, '.' + to); fs.copyFileSync(o, dest); return { path: dest, name: path.basename(dest) }; }
  catch (e) { return { error: String(e.message || e) }; } finally { rm(work); }
}

/* ---------- reading old formats ---------- */
const LEGACY = { '.doc': 'docx', '.dot': 'docx', '.odt': 'docx', '.rtf': 'docx', '.wpd': 'docx', '.xls': 'xlsx', '.ods': 'xlsx', '.ppt': 'pptx', '.pps': 'pptx', '.odp': 'pptx' };
async function readLegacy(file) {
  const to = LEGACY[path.extname(file).toLowerCase()]; if (!to) throw new Error('unsupported'); fs.mkdirSync(TMP, { recursive: true });
  const work = path.join(TMP, 'lg' + Date.now() + Math.random().toString(36).slice(2, 5)); fs.mkdirSync(work, { recursive: true });
  try { const o = await convert(file, to, work); if (!o) throw new Error('could not read ' + path.basename(file)); return U.extractOffice(o, '.' + to); } finally { rm(work); }
}

function list() {
  try { return fs.readdirSync(OUT).filter(f => /\.(docx|xlsx|pptx|pdf|odt|ods|odp|csv|txt)$/i.test(f)).map(f => { const s = fs.statSync(path.join(OUT, f)); return { name: f, path: path.join(OUT, f), size: s.size, mtime: Math.floor(s.mtimeMs) }; }).sort((a, b) => b.mtime - a.mtime).slice(0, 40); } catch (e) { return []; }
}
function openIn(file) { cp.spawn(SO, [file], { detached: true, stdio: 'ignore' }).unref(); }

module.exports = { SO, PY, markUsed: () => { used = true; }, stop, available: () => !!SO, version: () => SO ? 'LibreOffice' : '', OUT, PREV, create, convert, convertUpload, readLegacy, LEGACY, list, openIn, mdToHtml, tableToCsv };
