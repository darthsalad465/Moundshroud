// Embeddings from the local Ollama engine: this is what turns keyword search into "find the page that means this",
// and it runs entirely on this PC (no cloud, no extra program). lib/docs.js does the storing and searching; this file
// only talks to Ollama: which embedding model is installed, downloading one, and turning text into vectors.
const http = require('http');

const HOST = process.env.OLLAMA_HOST || '127.0.0.1', PORT = +process.env.OLLAMA_PORT || 11434;
const PREFERRED = ['nomic-embed-text', 'mxbai-embed-large', 'bge-m3', 'snowflake-arctic-embed', 'all-minilm', 'embeddinggemma'];

/* one small JSON request to Ollama; nothing here needs a key */
function ask(path, body, timeout) {
  return new Promise(resolve => {
    const data = body == null ? null : JSON.stringify(body);
    const req = http.request({ host: HOST, port: PORT, path, method: data ? 'POST' : 'GET', timeout: timeout || 120000, headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {} }, r => {
      let b = ''; r.setEncoding('utf8');
      r.on('data', c => { b += c; if (b.length > 4e6) req.destroy(); });
      r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { resolve({ error: 'bad answer from the AI engine' }); } });
      r.on('error', () => resolve({ error: 'the AI engine stopped answering' }));
    });
    req.on('error', e => resolve({ error: String(e.message || e) }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'the AI engine did not answer in time' }); });
    if (data) req.write(data);
    req.end();
  });
}

const list = async () => { const j = await ask('/api/tags', null, 4000); return Array.isArray(j.models) ? j.models.map(m => String(m.name || '')) : []; };
const base = n => String(n).split(':')[0].toLowerCase();

/* the best embedding model this PC already has, or null */
let cache = { at: 0, name: null };
async function pickModel(force) {
  if (!force && cache.name && Date.now() - cache.at < 60000) return cache.name;
  const names = await list();
  let found = null;
  for (const want of PREFERRED) { const hit = names.find(n => base(n) === want); if (hit) { found = hit; break; } }
  if (!found) found = names.find(n => /embed|minilm|bge|mxbai/i.test(n)) || null;
  cache = { at: Date.now(), name: found };
  return found;
}

/* nomic-embed-text is trained with these two prefixes: documents and questions are worded differently on purpose */
const prefix = m => /nomic-embed/i.test(String(m || '')) ? { doc: 'search_document: ', q: 'search_query: ' } : { doc: '', q: '' };

/* text -> vectors; /api/embed takes a batch, older engines only take one at a time */
async function embed(texts, model) {
  if (!texts.length) return [];
  const m = model || await pickModel();
  if (!m) throw new Error('No embedding model is installed.');
  const r = await ask('/api/embed', { model: m, input: texts }, 180000);
  if (Array.isArray(r.embeddings)) return r.embeddings;
  if (r.error === 'bad answer from the AI engine' || !r.embeddings) {          // older Ollama: one by one
    const out = [];
    for (const t of texts) {
      const one = await ask('/api/embeddings', { model: m, prompt: t }, 120000);
      if (!Array.isArray(one.embedding)) throw new Error('The embedding model did not answer.');
      out.push(one.embedding);
    }
    return out;
  }
  throw new Error('The embedding model did not answer.');
}

/* downloading an embedding model, with progress (Ollama streams one JSON line per step) */
const pullJob = { running: false, model: '', pct: 0, said: '', error: '', startedAt: 0, finishedAt: 0 };
function pull(name) {
  if (pullJob.running) return { error: 'A model is already downloading.' };
  const model = String(name || '').trim() || 'nomic-embed-text';
  Object.assign(pullJob, { running: true, model, pct: 0, said: 'Starting the download…', error: '', startedAt: Date.now(), finishedAt: 0 });
  const data = JSON.stringify({ model, stream: true });
  const req = http.request({ host: HOST, port: PORT, path: '/api/pull', method: 'POST', timeout: 0, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, r => {
    let buf = ''; r.setEncoding('utf8');
    r.on('data', c => {
      buf += c; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
        let j; try { j = JSON.parse(line); } catch (e) { continue; }
        if (j.error) { pullJob.error = String(j.error).slice(0, 160); continue; }
        if (j.total) pullJob.pct = Math.min(99, Math.round((j.completed || 0) / j.total * 100));
        if (j.status) pullJob.said = String(j.status).slice(0, 90);
      }
    });
    r.on('end', () => {
      pullJob.running = false; pullJob.finishedAt = Date.now();
      if (!pullJob.error) { pullJob.pct = 100; pullJob.said = 'Ready.'; cache = { at: 0, name: null }; try { require('./lmstudio-sync').syncAll(); } catch (e) { } }
    });
  });
  req.on('error', e => { pullJob.running = false; pullJob.error = String(e.message || e); pullJob.finishedAt = Date.now(); });
  req.write(data); req.end();
  return { ok: true, job: pullJob };
}

const status = () => ({ job: pullJob, preferred: PREFERRED[0] });

module.exports = { pickModel, embed, pull, status, list, prefix, PREFERRED };
