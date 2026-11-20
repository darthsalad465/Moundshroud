// Runs any GGUF model file straight from where it lies, with llama.cpp's own server: no copy into Ollama, no import.
// The server program comes from (first found): runtime\llama\llama-server.exe, LM Studio's bundled llama.cpp
// backends (newest CUDA build first, then the CPU build), or llama-server on the PATH. One model runs at a time on a
// local port; asking for another model stops the first. Chat goes through the server's OpenAI-style endpoint, with
// tool calls, streamed; the answer comes back in the same shape lib/harness-native.js uses for Ollama:
// { ok, text, calls, think }. Nothing leaves this PC.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.MOUNDSHROUD_LLAMA_PORT || 47321;
let child = null, current = '', starting = null;

function serverPath() {
  const own = path.join(ROOT, 'runtime', 'llama', 'llama-server.exe');
  if (fs.existsSync(own)) return own;
  const lm = path.join(os.homedir(), '.lmstudio', 'extensions', 'backends');
  try {
    /* LM Studio's own builds wrap llama.cpp for LM Studio (lmstudiocore.dll) and do not run on their own: they are skipped */
    const dirs = fs.readdirSync(lm).filter(d => /^llama\.cpp-win/i.test(d) && fs.existsSync(path.join(lm, d, 'llama-server.exe')) && !fs.existsSync(path.join(lm, d, 'lmstudiocore.dll')));
    const ver = d => (d.match(/(\d+)\.(\d+)\.(\d+)$/) || [0, 0, 0, 0]).slice(1).map(Number);
    const score = d => (/cuda12/i.test(d) ? 3 : /cuda/i.test(d) ? 2 : /vulkan/i.test(d) ? 1 : 0);
    dirs.sort((a, b) => score(b) - score(a) || ver(b)[0] - ver(a)[0] || ver(b)[1] - ver(a)[1] || ver(b)[2] - ver(a)[2]);
    if (dirs.length) return path.join(lm, dirs[0], 'llama-server.exe');
  } catch (e) { }
  try { const w = cp.execFileSync('where', ['llama-server'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)[0].trim(); if (w) return w; } catch (e) { }
  return '';
}
const available = () => !!serverPath();

function get(p, ms) {
  return new Promise(res => {
    const r = http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: ms || 3000 }, rs => { let b = ''; rs.on('data', c => b += c); rs.on('end', () => res({ status: rs.statusCode, body: b })); });
    r.on('error', () => res(null)); r.on('timeout', () => { r.destroy(); res(null); });
  });
}
function stop() {
  const c = child; child = null; current = ''; starting = null;
  if (c && c.pid) { try { cp.spawnSync('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { try { c.kill(); } catch (x) { } } }
}

/* starts the server on one GGUF file (or keeps it if that file is already running); { ok, error } */
function start(file, opts) {
  const o = opts || {};
  const want = path.resolve(String(file || ''));
  if (!fs.existsSync(want) || !/\.gguf$/i.test(want)) return Promise.resolve({ ok: false, error: 'There is no GGUF file at ' + want + '.' });
  if (child && current === want) return starting || Promise.resolve({ ok: true });
  stop();
  const exe = serverPath();
  if (!exe) return Promise.resolve({ ok: false, error: 'llama.cpp\'s server was not found. Put llama-server.exe in runtime\\llama, or install LM Studio, to run model files directly.' });
  const ctx = Math.max(2048, Math.min(131072, Math.round(+o.ctx || 16384)));
  /* one conversation at a time (-np 1): the whole memory window goes to it instead of being split four ways */
  /* the graphics card first (llama.cpp fits the model to its free memory itself); o.cpu runs on the processor alone */
  const args = ['-m', want, '--host', '127.0.0.1', '--port', String(PORT), '-c', String(ctx), '-np', '1', '--jinja', '--no-webui'].concat(o.cpu ? ['--device', 'none'] : []);
  const log = path.join(os.tmpdir(), 'moundshroud-llama.log');
  let fd; try { fd = fs.openSync(log, 'w'); } catch (e) { fd = 'ignore'; }
  try { child = cp.spawn(exe, args, { cwd: path.dirname(exe), windowsHide: true, stdio: ['ignore', fd, fd] }); }
  catch (e) { child = null; return Promise.resolve({ ok: false, error: 'llama.cpp\'s server could not start: ' + e.message }); }
  current = want;
  const me = child;
  starting = new Promise(async done => {
    let exited = false;
    me.on('exit', () => { exited = true; if (child === me) { child = null; current = ''; } });
    const t0 = Date.now(), until = t0 + (o.waitMs || 180000);
    const logLines = () => { try { return fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).length; } catch (e) { return 0; } };
    let stalled = false;
    while (Date.now() < until && !exited) {
      const h = await get('/health', 2000);
      if (h && h.status === 200) { starting = null; return done({ ok: true }); }
      /* the graphics card's driver can hang before the model even starts loading: after 25 seconds with no progress
         past the first line, the card is given up on */
      if (!o.cpu && Date.now() - t0 > 25000 && logLines() <= 1) { stalled = true; break; }
      await new Promise(r => setTimeout(r, 700));
    }
    let tail = ''; try { tail = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).slice(-4).join(' | '); } catch (e) { }
    if (!exited) stop();
    /* the graphics card stalled, was too full, or failed: the processor alone is tried next */
    if (!o.cpu) {
      const r = await start(want, Object.assign({}, o, { cpu: true, waitMs: 120000 }));
      return done(r.ok ? Object.assign(r, { note: 'running on the processor: the graphics card ' + (stalled ? 'did not respond' : 'had no room') + ', so this is slower' }) : r);
    }
    done({ ok: false, error: 'The model file did not start in llama.cpp.' + (tail ? ' It said: ' + tail.slice(0, 300) : '') });
  });
  return starting;
}

/* Ollama-style messages and tools -> one OpenAI-style streamed chat; returns { ok, text, calls, think } */
function chat(body, onText, onThink, ctl) {
  const msgs = (body.messages || []).map(m => {
    const o = { role: m.role, content: String(m.content || '') };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) o.tool_calls = m.tool_calls.map((c, i) => ({ id: c.id || 'call_' + i, type: 'function', function: { name: c.function.name, arguments: typeof c.function.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function.arguments || {}) } }));
    if (m.role === 'tool') { o.tool_call_id = m.tool_call_id || ''; }
    return o;
  });
  const req = { messages: msgs, stream: true, stream_options: { include_usage: true }, temperature: (body.options && body.options.temperature) != null ? body.options.temperature : 0.7 };
  if (body.options && body.options.num_predict) req.max_tokens = body.options.num_predict;
  if (Array.isArray(body.tools) && body.tools.length) req.tools = body.tools;
  const data = Buffer.from(JSON.stringify(req));
  return new Promise(done => {
    let text = '', think = '', buf = '', err = '', ptok = 0;
    const calls = [];
    const r = http.request({ host: '127.0.0.1', port: PORT, path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, res => {
      if (ctl) ctl.req = r;
      res.setEncoding('utf8');
      const take = line => {
        if (!line.startsWith('data:')) { if (line.trim().startsWith('{')) { try { const j = JSON.parse(line); if (j.error) err = String(j.error.message || j.error); } catch (e) { } } return; }
        const s = line.slice(5).trim(); if (!s || s === '[DONE]') return;
        let j; try { j = JSON.parse(s); } catch (e) { return; }
        if (j.error) { err = String(j.error.message || j.error); return; }
        /* how much of the memory the request filled: the usage line, or llama.cpp's own timings */
        if (j.usage && j.usage.prompt_tokens) ptok = +j.usage.prompt_tokens || ptok;
        else if (j.timings && j.timings.prompt_n) ptok = Math.max(ptok, +j.timings.prompt_n || 0);
        const d = (j.choices && j.choices[0] && j.choices[0].delta) || {};
        if (d.content) { text += d.content; if (onText) try { onText(text); } catch (e) { } }
        if (d.reasoning_content) { think += d.reasoning_content; if (onThink) try { onThink(think); } catch (e) { } }
        for (const tc of d.tool_calls || []) {
          const i = tc.index || 0;
          calls[i] = calls[i] || { id: tc.id || 'call_' + i, function: { name: '', arguments: '' } };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function && tc.function.name) calls[i].function.name += tc.function.name;
          if (tc.function && tc.function.arguments) calls[i].function.arguments += tc.function.arguments;
        }
      };
      res.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { take(buf.slice(0, i).trim()); buf = buf.slice(i + 1); } });
      res.on('end', () => {
        if (buf.trim()) take(buf.trim());
        if (!err && res.statusCode >= 400) err = 'llama.cpp answered with error ' + res.statusCode + '.';
        const out = calls.filter(Boolean).map(c => { let a = {}; try { a = JSON.parse(c.function.arguments || '{}'); } catch (e) { a = {}; } return { id: c.id, function: { name: c.function.name, arguments: a } }; });
        done(err ? { ok: false, error: err } : { ok: true, text, calls: out, think, promptTokens: ptok });
      });
    });
    r.on('error', e => done({ ok: false, error: 'llama.cpp is not answering: ' + e.message }));
    r.setTimeout(15 * 60000, () => { try { r.destroy(new Error('the model did not answer in time')); } catch (e) { } });
    r.end(data);
  });
}

module.exports = { serverPath, available, start, stop, chat, running: () => current, PORT };
/* the server is this program's child: it goes when this program goes */
process.on('exit', () => { try { stop(); } catch (e) { } });
