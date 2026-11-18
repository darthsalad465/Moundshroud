// Models from Hugging Face, in the only shape Ollama can take from there: one .gguf file.
// /pull in Moundshroud Code looks the repo up, picks exactly one .gguf (never safetensors, .bin, a split file or
// anything else), downloads it into data\gguf, checks that it really says GGUF, and asks Ollama to make a model of it.
// Nothing else in the repo is downloaded, and nothing leaves this PC afterwards.
const fs = require('fs'), path = require('path'), cp = require('child_process');

const ROOT = path.join(__dirname, '..'), STORE = path.join(ROOT, 'data', 'gguf');
const API = 'https://huggingface.co/api/models/';
const UA = 'Moundshroud/1.0 (offline app; GGUF only)';
/* the sizes people actually use, best first: Q4_K_M is the usual balance of quality and memory */
const QUANTS = ['Q4_K_M', 'Q4_K_S', 'Q4_0', 'IQ4_XS', 'Q5_K_M', 'Q3_K_M', 'Q3_K_S', 'Q2_K', 'Q6_K', 'Q8_0'];

/* ---- what was asked for: a repo, a repo and a size, a file inside a repo, or a hugginface.co address ---- */
function norm(repo, file, quant) {
  const bits = String(repo || '').replace(/^\/+|\/+$/g, '').split('/');
  if (bits.length !== 2) return null;
  const [owner, name] = bits;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(owner)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(name)) return null;
  return { repo: owner + '/' + name, file: String(file || ''), quant: String(quant || '').trim() };
}
function parse(input) {
  let s = String(input == null ? '' : input).trim();
  if (!s) return null;
  const url = /^https?:\/\/(?:www\.)?huggingface\.co\/([^/\s?#]+)\/([^/\s?#]+)(?:\/(?:resolve|blob|tree)\/[^/\s]+\/([^?#\s]+\.gguf))?/i.exec(s);
  if (url) return norm(url[1] + '/' + url[2], url[3] ? decodeURIComponent(url[3]) : '', '');
  s = s.replace(/^hf\.co\//i, '').replace(/^huggingface\.co\//i, '');
  let quant = '';
  const q = /^(.*?):([A-Za-z0-9_]+)$/.exec(s);            // repo:Q4_K_M — a repo name never holds a colon
  if (q) { quant = q[2]; s = q[1]; }
  let file = '';
  const bits = s.split('/');
  if (bits.length > 2 && /\.gguf$/i.test(s)) { file = bits.slice(2).join('/'); s = bits.slice(0, 2).join('/'); }
  return norm(s, file, quant);
}

/* ---- which .gguf files a repo holds ---- */
const isGguf = f => /\.gguf$/i.test(String(f || ''));
const isSplit = f => /-\d{5}-of-\d{5}\.gguf$/i.test(String(f || ''));   // one part of a split file is useless alone
const quantOf = f => {
  const m = /(?:^|[-_.])((?:IQ|Q)\d(?:_[A-Z0-9]+)*|BF16|FP16|FP32|F64|F16|F32)(?=\.gguf$)/i.exec(String(f || ''));
  return m ? m[1].toUpperCase() : '';
};
function ggufs(siblings) {
  const out = [];
  for (const x of siblings || []) {
    const f = String((x && x.rfilename) || x || '');
    if (!isGguf(f) || isSplit(f)) continue;
    out.push({ file: f, base: f.split('/').pop(), quant: quantOf(f), size: +((x && x.size) || 0) });
  }
  return out;
}
/* the one to take: the size that was asked for, else the usual best, else the smallest */
function best(list, want) {
  const all = (list || []).filter(x => x && x.file);
  if (!all.length) return null;
  const w = String(want || '').trim();
  if (w) {
    if (/^smallest$/i.test(w)) return all.slice().sort((a, b) => (a.size || 1e15) - (b.size || 1e15))[0];
    const key = w.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const hit = all.find(x => x.quant.replace(/[^A-Z0-9]/g, '') === key)
      || all.find(x => x.base.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(key));
    if (hit) return hit;
  }
  for (const q of QUANTS) { const hit = all.find(x => x.quant === q); if (hit) return hit; }
  return all.slice().sort((a, b) => (a.size || 1e15) - (b.size || 1e15))[0];
}
/* the name Ollama will know it by: the repo's own name, plus the size, all lowercase letters */
function nameOf(repo, quant) {
  const last = String(repo || '').split('/').pop().toLowerCase().replace(/\.gguf$/, '').replace(/-gguf$/, '');
  const q = String(quant || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (last + (q ? '-' + q : ''))
    .replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 110);
}

/* ---- talking to Hugging Face ---- */
async function list(repo) {
  const url = API + repo.split('/').map(encodeURIComponent).join('/') + '?blobs=true';
  let res;
  try { res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } }); }
  catch (e) { return { ok: false, error: 'Hugging Face could not be reached: ' + String((e && e.message) || e) }; }
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'Hugging Face will not show ' + repo + ' (it is gated or needs signing in), so it cannot be pulled here.' };
  if (res.status === 404) return { ok: false, error: 'There is no Hugging Face model at ' + repo + '.' };
  if (!res.ok) return { ok: false, error: 'Hugging Face answered ' + res.status + ' for ' + repo + '.' };
  let j;
  try { j = await res.json(); } catch (e) { return { ok: false, error: 'Hugging Face sent an answer that could not be read.' }; }
  const files = ggufs(j && j.siblings);
  if (!files.length) return { ok: false, error: 'That repo holds no GGUF file, so Ollama cannot use it. Look for a repo with -GGUF in its name.' };
  return { ok: true, files };
}

const mb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : (n || 0) + ' B';

/* one file, written straight to disk; onPct(got, total) is called as it arrives */
async function download(repo, file, onPct) {
  try { fs.mkdirSync(STORE, { recursive: true }); } catch (e) { }
  const url = 'https://huggingface.co/' + repo.split('/').map(encodeURIComponent).join('/')
    + '/resolve/main/' + file.split('/').map(encodeURIComponent).join('/');
  const dest = path.join(STORE, path.basename(file)), part = dest + '.part';
  let res;
  try { res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' }); }
  catch (e) { return { ok: false, error: 'Hugging Face could not be reached: ' + String((e && e.message) || e) }; }
  if (!res.ok || !res.body) return { ok: false, error: 'Hugging Face answered ' + res.status + ' for ' + path.basename(file) + '.' };
  const total = +res.headers.get('content-length') || 0;
  const out = fs.createWriteStream(part);
  let got = 0, last = 0, failed = '';
  try {
    for await (const chunk of res.body) {
      got += chunk.length;
      if (!out.write(Buffer.from(chunk))) await new Promise(r => out.once('drain', r));
      if (Date.now() - last > 150) { last = Date.now(); if (onPct) try { onPct(got, total); } catch (e) { } }
    }
    await new Promise((r, j) => out.end(e => (e ? j(e) : r())));
  } catch (e) { failed = String((e && e.message) || e); }
  const drop = () => { try { fs.unlinkSync(part); } catch (e) { } };
  if (failed) { drop(); return { ok: false, error: 'The download stopped part way: ' + failed }; }
  if (got < 262144) { drop(); return { ok: false, error: 'That file is too small to be a model (' + mb(got) + ').' }; }
  /* it has to really be GGUF: a web page that answered 200 must not become a model */
  let head = '';
  try { const fd = fs.openSync(part, 'r'); const b = Buffer.alloc(4); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); head = b.toString('latin1'); } catch (e) { }
  if (head !== 'GGUF') { drop(); return { ok: false, error: 'That file is not a GGUF model, so it was thrown away.' }; }
  try { fs.renameSync(part, dest); } catch (e) { drop(); return { ok: false, error: 'The model could not be kept: ' + e.message }; }
  return { ok: true, path: dest, bytes: got, total: total || got };
}

/* ---- Ollama, on this PC ---- */
function exe() {
  const name = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  const dirs = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if (process.platform === 'win32') dirs.push(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama'));
  for (const d of dirs) { try { const p = path.join(d, name); if (fs.existsSync(p)) return p; } catch (e) { } }
  return name;
}
function run(args, ms) {
  return new Promise(done => {
    let out = '', err = '', child;
    try { child = cp.spawn(exe(), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { return done({ ok: false, code: -1, out: '', error: String(e.message || e) }); }
    child.stdout.on('data', b => { out = (out + b.toString('utf8')).slice(-6000); });
    child.stderr.on('data', b => { err = (err + b.toString('utf8')).slice(-6000); });
    const k = setTimeout(() => {
      try { cp.spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { }
      done({ ok: false, code: -1, out, error: 'Ollama took too long to make the model.' });
    }, ms || 20 * 60000);
    child.on('error', e => { clearTimeout(k); done({ ok: false, code: -1, out, error: 'Ollama could not be started (' + String(e.message || e) + '). Is it installed?' }); });
    child.on('close', code => { clearTimeout(k); done({ ok: code === 0, code, out: (out + '\n' + err).trim() }); });
  });
}
/* Ollama learns a new model from a Modelfile that points at the one file */
function modelfile(file) { return 'FROM "' + String(file).replace(/\\/g, '/') + '"\n'; }
async function create(name, file) {
  const mf = path.join(STORE, name + '.Modelfile');
  try { fs.writeFileSync(mf, modelfile(file)); } catch (e) { return { ok: false, error: 'The model file could not be read: ' + e.message }; }
  const r = await run(['create', name, '-f', mf]);
  try { fs.unlinkSync(mf); } catch (e) { }
  if (!r.ok) return { ok: false, error: 'Ollama could not make the model: ' + String(r.error || r.out || 'it said nothing').split(/\r?\n/).filter(Boolean).slice(-3).join(' ') };
  return { ok: true, name };
}

/* ---- the whole errand ---- */
async function pull(target, opts) {
  const o = opts || {};
  const say = t => { if (o.onNote) try { o.onNote(t); } catch (e) { } };
  const t = typeof target === 'string' ? parse(target) : target;
  if (!t) return { ok: false, error: 'That is not a Hugging Face repo. Example: /pull bartowski/SmolLM2-135M-Instruct-GGUF:Q4_K_M' };
  say('looking for GGUF files in ' + t.repo);
  const found = await list(t.repo);
  if (!found.ok) return found;
  let pick = null;
  if (t.file) {
    const want = path.basename(t.file).toLowerCase();
    pick = found.files.find(f => f.base.toLowerCase() === want) || found.files.find(f => f.file.toLowerCase() === t.file.toLowerCase());
  }
  if (!pick) pick = best(found.files, t.quant);
  if (!pick) return { ok: false, error: 'There is no .gguf file to take from ' + t.repo + '.' };
  const name = nameOf(t.repo, pick.quant);
  say('downloading ' + pick.base + (pick.size ? '  ·  ' + mb(pick.size) : ''));
  const d = await download(t.repo, pick.file, o.onPct);
  if (!d.ok) return d;
  say('asking Ollama to make ' + name + '  ·  ' + mb(d.bytes));
  const c = await create(name, d.path);
  if (!c.ok) return c;
  return { ok: true, name, repo: t.repo, file: pick.file, quant: pick.quant || 'GGUF', path: d.path, bytes: d.bytes, size: pick.size || d.bytes };
}

module.exports = { parse, ggufs, best, quantOf, nameOf, list, download, create, modelfile, pull, mb, STORE, QUANTS, isSplit, isGguf };
