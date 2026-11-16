// Storybook PDF: Studio > Storybook & comic sends print-ready HTML and its pictures here, and LibreOffice turns
// it into a real PDF in Documents\Moundshroud Documents. Everything stays on this PC.
//   const sb = require('./lib/storybook'); await sb.pdf({ title, html, assets: [{ name, data }] })
// `data` is a data: URL (PNG, JPEG, WebP or GIF). `html` refers to each asset by its name, e.g. <img src="art-0.png">.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { pathToFileURL } = require('url');
const office = require('./office');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), TMP = path.join(DATA, 'tmp'), PREV = path.join(DATA, 'previews');
const MAX_ASSET = 12e6, MAX_TOTAL = 48e6, MAX_HTML = 2e6, MAX_ASSETS = 80;
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/* A real browser prints the pages exactly as they are drawn: backgrounds, page breaks, the cover, the lot.
   Chrome and Edge are already on Windows, so this needs no extra package. LibreOffice is the fallback. */
const BROWSERS = [
  process.env.MOUNDSHROUD_BROWSER,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
].filter(Boolean);
const BROWSER = BROWSERS.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
const browserAvailable = () => !!BROWSER;
function browserPdf(htmlFile, outFile, work) {
  if (!BROWSER) return Promise.resolve(null);
  const args = ['--headless', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync', '--metrics-recording-only',
    '--mute-audio', '--hide-scrollbars', '--allow-file-access-from-files',
    '--run-all-compositor-stages-before-draw', '--virtual-time-budget=3000',
    '--user-data-dir=' + path.join(work, 'browser-profile'), '--print-to-pdf=' + outFile,
    pathToFileURL(htmlFile).href];
  return new Promise(resolve => {
    try {
      cp.execFile(BROWSER, args, { timeout: 90000, windowsHide: true, maxBuffer: 4e6 }, e => {
        let ok = false;
        try { ok = !e && fs.statSync(outFile).size > 1000; } catch (er) { }
        resolve(ok ? outFile : null);
      });
    } catch (e) { resolve(null); }
  });
}

const safeStem = s => String(s || 'Storybook').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Storybook';
const safeName = (s, i) => {
  const base = path.basename(String(s || '')).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z0-9][\w.-]*$/i.test(base) && base.length <= 80 ? base : 'art-' + i + '.png';
};
const uniq = (dir, stem, ext) => { let p = path.join(dir, stem + ext), n = 2; while (fs.existsSync(p)) p = path.join(dir, stem + ' (' + n++ + ')' + ext); return p; };
const rm = p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { } };

/* a data: URL -> { ext, buf }, or null when it is not a picture we can write */
function decode(data) {
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(data || ''));
  if (!m) return null;
  const type = m[1].toLowerCase(), ext = EXT[type];
  if (!ext) return null;
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  return buf.length && buf.length <= MAX_ASSET ? { ext, buf } : null;
}

async function pdf({ title, html, assets } = {}) {
  const page = String(html == null ? '' : html);
  if (!page.trim()) return { error: 'There are no pages to export yet.' };
  if (Buffer.byteLength(page) > MAX_HTML) return { error: 'The book is too large to export as one PDF. Try fewer pages.' };
  const work = path.join(TMP, 'sb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  fs.mkdirSync(work, { recursive: true });
  try {
    /* write the pictures first, then point the HTML at the names actually used on disk */
    let outHtml = page, total = 0, map = [];
    const list = Array.isArray(assets) ? assets.slice(0, MAX_ASSETS) : [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i] || {}, pic = decode(a.data);
      if (!pic) continue;
      total += pic.buf.length; if (total > MAX_TOTAL) return { error: 'The pictures are too large to export as one PDF. Try fewer pages.' };
      const want = safeName(a.name, i), have = fs.readdirSync(work);
      let name = want; if (have.includes(name)) { const b = path.basename(want, path.extname(want)); let n = 2; while (have.includes(b + '-' + n + path.extname(want))) n++; name = b + '-' + n + path.extname(want); }
      fs.writeFileSync(path.join(work, name), pic.buf);
      map.push([String(a.name || ''), name]);
    }
    for (const [from, to] of map) if (from && from !== to) outHtml = outHtml.split(from).join(to);
    const htmlFile = path.join(work, 'book.html');
    fs.writeFileSync(htmlFile, outHtml, 'utf8');

    let made = await browserPdf(htmlFile, path.join(work, 'print.pdf'), work);
    if (!made) {
      if (!office.available()) return { error: 'No browser or LibreOffice was found to make the PDF. Use Print / Save as PDF instead.' };
      const docx = await office.convert(htmlFile, 'docx', work, 'HTML (StarWriter)');
      if (!docx) throw new Error('Word conversion failed');
      made = await office.convert(docx, 'pdf', work);
      if (!made) throw new Error('PDF conversion failed');
    }
    fs.mkdirSync(office.OUT, { recursive: true });
    const out = uniq(office.OUT, safeStem(title), '.pdf');
    fs.copyFileSync(made, out);

    let preview = null;
    try { fs.mkdirSync(PREV, { recursive: true }); const p = await office.convert(out, 'png', work); if (p) { preview = path.join(PREV, path.basename(out) + '.png'); fs.copyFileSync(p, preview); } } catch (e) { }
    return { path: out, name: path.basename(out), preview };
  } catch (e) {
    return { error: String((e && e.message) || e || 'The PDF could not be made.').slice(0, 240) };
  } finally { rm(work); }
}

module.exports = { pdf, decode, safeName, browserAvailable, BROWSER, MAX_ASSET, MAX_TOTAL, MAX_ASSETS };
