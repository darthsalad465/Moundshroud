// Your own libraries for the Browser: pages you add by their source.
// Each import is kept as one HTML document under data\my-library, so the Browser can open it and show its source.
const fs = require('fs');
const path = require('path');

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* plain text or Markdown source becomes a readable page, keeping the text exactly as it was typed */
function textPage(title, text) {
  const looksHtml = /^\s*<(!doctype|html)/i.test(text);
  if (looksHtml) return text;
  const body = String(text).split(/\r?\n\r?\n/).map(block => {
    const line = block.trim();
    if (!line) return '';
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h && !line.includes('\n')) return '<h' + (h[1].length + 1) + '>' + esc(h[2]) + '</h' + (h[1].length + 1) + '>';
    return '<p>' + esc(line).replace(/\r?\n/g, '<br>') + '</p>';
  }).join('\n');
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title><style>body{max-width:820px;margin:0 auto;padding:32px 22px 70px;' +
    'font:17px/1.7 "Segoe UI",system-ui,sans-serif;color:#1b2230;background:#fbfaf7}pre{white-space:pre-wrap}' +
    'h1,h2,h3,h4,h5{line-height:1.25;margin:1.4em 0 .5em}header{border-bottom:1px solid #ddd8cc;padding-bottom:12px;margin-bottom:18px}' +
    'header small{color:#6b7385}</style></head><body><header><small>Imported library · ' + esc(title) + '</small></header>' + body + '</body></html>\n';
}

function create(DATA) {
  const DIR = path.join(DATA, 'my-library');
  const INDEX = path.join(DIR, 'index.json');
  const ensure = () => { try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) { } };
  function readIndex() {
    try { const list = JSON.parse(fs.readFileSync(INDEX, 'utf8')); return Array.isArray(list) ? list : []; }
    catch (e) { return []; }
  }
  const writeIndex = list => { ensure(); try { fs.writeFileSync(INDEX, JSON.stringify(list, null, 1)); } catch (e) { } };
  const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'library';
  const publicItem = ({ id, title, at, bytes, source }) => ({ id, title, at, bytes, source: !!source });

  function list() { return readIndex().map(publicItem).sort((a, b) => (b.at || 0) - (a.at || 0)); }

  function save(input) {
    ensure();
    const source = String((input && input.html) || '');
    if (!source.trim()) return { error: 'Add the page source first.' };
    if (source.length > 2_000_000) return { error: 'That library is too large. Keep the source under 2 MB.' };
    const title = String((input && input.title) || '').trim().slice(0, 120) || 'Imported library';
    const items = readIndex();
    let id = slug(title), n = 1;
    while (items.some(item => item.id === id)) id = slug(title) + '-' + (++n);
    const doc = textPage(title, source);
    try { fs.writeFileSync(path.join(DIR, id + '.html'), doc); }
    catch (e) { return { error: 'Could not save the library: ' + (e.message || e) }; }
    const entry = { id, title, at: Date.now(), bytes: Buffer.byteLength(doc), source: true };
    items.push(entry);
    writeIndex(items);
    return { ok: true, library: publicItem(entry) };
  }

  function remove(id) {
    const key = String(id || '');
    if (!/^[a-z0-9-]{1,60}$/i.test(key)) return { error: 'Unknown library' };
    const items = readIndex(), kept = items.filter(item => item.id !== key);
    if (kept.length === items.length) return { error: 'Unknown library' };
    try { fs.unlinkSync(path.join(DIR, key + '.html')); } catch (e) { }
    writeIndex(kept);
    return { ok: true };
  }

  function page(id) {
    const key = String(id || '');
    if (!/^[a-z0-9-]{1,60}$/i.test(key)) return null;
    const file = path.join(DIR, key + '.html');
    try { if (!fs.existsSync(file)) return null; return fs.readFileSync(file); }
    catch (e) { return null; }
  }

  return { list, save, remove, page };
}

module.exports = { create };
