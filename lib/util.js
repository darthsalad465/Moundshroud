// Shared helpers: JSON stores, zip reading (docx/pptx/xlsx), text extraction.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

function atomicWrite(file, data) {
  const tmp = file + '.tmp' + process.pid;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function readJson(file, dflt) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return dflt; } }
function writeJson(file, v) { atomicWrite(file, JSON.stringify(v)); }

const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return ' '; } })
  .replace(/&#(\d+);/g, (m, d) => { try { return String.fromCodePoint(+d); } catch (e) { return ' '; } }).replace(/&amp;/g, '&');

function htmlToText(h) {
  h = h.replace(/<(script|style|table|sup|figure)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|h\d|li|tr)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return ent(h).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}
function htmlToTextKeepTables(h) {
  h = h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|h\d|li|tr)>|<br\s*\/?>/gi, '\n').replace(/<\/t[dh]>/gi, ' | ').replace(/<[^>]+>/g, ' ');
  return ent(h).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}

/* ---- minimal zip reader ---- */
function zipEntries(buf) {
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) throw new Error('not a zip');
  const total = buf.readUInt16LE(i + 10); let p = buf.readUInt32LE(i + 16); const out = {};
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    out[buf.toString('utf8', p + 46, p + 46 + nlen).replace(/\\/g, '/')] = { method, csize, lho };
    p += 46 + nlen + elen + clen;
  }
  return out;
}
function zipRead(buf, e) {
  const nlen = buf.readUInt16LE(e.lho + 26), elen = buf.readUInt16LE(e.lho + 28), start = e.lho + 30 + nlen + elen;
  const data = buf.subarray(start, start + e.csize);
  return e.method === 0 ? data : zlib.inflateRawSync(data);
}

/* ---- text out of office files: returns [{page, text}] ---- */
function extractOffice(file, ext) {
  const buf = fs.readFileSync(file), z = zipEntries(buf), pages = [];
  if (ext === '.docx') {
    const e = z['word/document.xml']; if (!e) return pages;
    let x = zipRead(buf, e).toString('utf8');
    x = x.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '');
    pages.push({ page: 0, text: ent(x) });
  } else if (ext === '.pptx') {
    const names = Object.keys(z).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    names.forEach((n, i) => { const x = zipRead(buf, z[n]).toString('utf8'); const t = (x.match(/<a:t>[^<]*<\/a:t>/g) || []).map(s => ent(s.replace(/<[^>]+>/g, ''))).join('\n'); if (t.trim()) pages.push({ page: i + 1, text: t }); });
  } else if (ext === '.xlsx') {
    const e = z['xl/sharedStrings.xml']; if (e) { const x = zipRead(buf, e).toString('utf8'); pages.push({ page: 0, text: (x.match(/<t[^>]*>[^<]*<\/t>/g) || []).map(s => ent(s.replace(/<[^>]+>/g, ''))).join('\n') }); }
  }
  return pages;
}

module.exports = { atomicWrite, readJson, writeJson, ent, htmlToText, htmlToTextKeepTables, zipEntries, zipRead, extractOffice };

