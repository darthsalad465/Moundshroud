// Websites you ask Moundshroud to read: every page is saved as Markdown in data\webpages\<site>\ and added to the
// files index (lib/docs.js), so the assistant can answer questions about them later with the internet switched off.
const fs = require('fs'), path = require('path');
const net = require('./net'), docs = require('./docs');

const ROOT = path.join(__dirname, '..'), DIR = process.env.MOUNDSHROUD_WEB_DIR || path.join(ROOT, 'data', 'webpages');
const status = { running: false, url: '', host: '', done: 0, total: 0, saved: 0, error: '', startedAt: 0, finishedAt: 0 };

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'page';
const hosts = () => { try { return fs.readdirSync(DIR, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch (e) { return []; } };

/* what is saved: one folder per site, one Markdown file per page */
function list() {
  return hosts().map(h => {
    const d = path.join(DIR, h); let files = [];
    try { files = fs.readdirSync(d).filter(f => /\.md$/i.test(f)); } catch (e) { }
    let bytes = 0;
    for (const f of files) { try { bytes += fs.statSync(path.join(d, f)).size; } catch (e) { } }
    return { host: h, pages: files.length, bytes, dir: d };
  }).sort((a, b) => b.pages - a.pages);
}

/* the saved pages are a normal folder in the files index, so Chat's "Use my files", the Search tab and this page all see them */
function ensureSource() { try { docs.addSource(DIR); } catch (e) { } }

function save(page) {
  const u = new URL(page.url), dir = path.join(DIR, slug(u.hostname));
  fs.mkdirSync(dir, { recursive: true });
  const name = slug(u.pathname === '/' ? 'index' : u.pathname);
  const p = path.join(dir, name + '.md');
  fs.writeFileSync(p, '# ' + page.title + '\n\n> ' + page.url + '\n\n' + page.markdown + '\n');
  return p;
}

async function run(url, opts) {
  Object.assign(status, { running: true, url, host: '', done: 0, total: 0, saved: 0, error: '', startedAt: Date.now(), finishedAt: 0 });
  try {
    const r = await net.crawl(url, opts);
    if (r.error) throw new Error(r.error);
    status.host = r.host; status.total = r.pages.length; status.skipped = (r.skipped || []).length;
    if (!r.pages.length) throw new Error('No readable pages were found on that site' + ((r.skipped || [])[0] ? ' (' + (r.skipped[0].why || '') + ').' : '.'));
    ensureSource();
    for (const pg of r.pages) {
      try { save(pg); status.saved++; } catch (e) { }
      status.done++;
      await new Promise(res => setImmediate(res));
    }
    docs.reindex().catch(() => { });        // reads the new files into the index in the background
  } catch (e) { status.error = String((e && e.message) || e).slice(0, 220); }
  status.running = false; status.finishedAt = Date.now();
  return status;
}

function start(url, opts) {
  if (status.running) return { error: 'Moundshroud is still reading the last site. Give it a moment.' };
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return { error: 'Type a web address starting with http:// or https://' };
  run(u, opts || {}).catch(() => { });
  return { ok: true, status };
}

function remove(host) {
  const name = slug(host);
  if (!hosts().includes(name)) return { error: 'That site is not saved.' };
  try { fs.rmSync(path.join(DIR, name), { recursive: true, force: true }); } catch (e) { return { error: String(e.message).slice(0, 160) }; }
  docs.reindex().catch(() => { });          // drops the vanished files from the index
  return { ok: true, sites: list() };
}

module.exports = { start, run, list, remove, status, DIR, ensureSource };
