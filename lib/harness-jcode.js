// The second in-app agent harness: jcode (github.com/1jehuang/jcode), driven by a model in Ollama. It speaks the
// Agent Client Protocol (JSON-RPC over stdin/stdout): this module starts `jcode acp`, turns its session updates into
// the same events the Agent tab already shows for Claude Code, and passes permission questions to the page.
// Same controls as lib/harness.js: start, send, answer, stop, state, show, clear.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const agent = require('./agent');
const bridge = require('./agentbridge');
const { savePhoto } = require('./harness');
const EXE = path.join(__dirname, '..', 'runtime', 'jcode', 'jcode.exe');
const MAX_EVENTS = 500, MAX_TEXT = 60000, ASK_TIMEOUT = 30 * 60000;
const SID = /^[A-Za-z0-9_-]{6,120}$/;
const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 40) + '\n... (the rest is not shown)' : s; };
const small = input => { const o = {}; if (input && typeof input === 'object') for (const k of Object.keys(input).slice(0, 20)) { const v = input[k]; o[k] = typeof v === 'string' ? cut(v, 6000) : (v == null || typeof v === 'number' || typeof v === 'boolean') ? v : cut(JSON.stringify(v), 2000); } return o; };
const installed = () => fs.existsSync(EXE);

/* the free pool answers at the bridge in the OpenAI shape, through a provider profile named below (see prepJcode) */
const FREE_PROFILE = 'moundshroud-free';
const argsFor = c => c.free
  ? ['acp', '--provider', 'openai-compatible', '--provider-profile', FREE_PROFILE, '-m', c.agentModel, '--no-selfdev']
  : ['acp', '--provider', 'ollama', '-m', c.agentModel, '--no-selfdev'];
const realSpawn = (c, dir) => cp.spawn(EXE, argsFor(c),
  { cwd: dir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: Object.assign({}, process.env, { JCODE_RUN_AUTO_POKE: '0', OLLAMA_HOST: 'http://127.0.0.1:11434' }, c.free ? { OPENAI_COMPAT_API_KEY: 'free-agent' } : {}) });
/* jcode keeps provider addresses in its own config, so the free profile is (re)pointed at the bridge each session */
function prepJcode(c, done) {
  if (!bridge.url()) return done({ ok: false, error: 'The free AI bridge is not running.' });
  let p; try {
    p = cp.spawn(EXE, ['provider', 'add', '--overwrite', '--base-url', bridge.url() + '/v1', '--model', c.agentModel, FREE_PROFILE], { windowsHide: true, stdio: 'ignore' });
  } catch (e) { return done({ ok: false, error: 'Could not set up the free model for jcode: ' + e.message }); }
  p.on('error', e => done({ ok: false, error: 'Could not set up the free model for jcode: ' + e.message }));
  p.on('close', code => done(code === 0 ? { ok: true } : { ok: false, error: 'jcode could not store the free model profile (exit ' + code + ').' }));
}
const realKill = p => { try { cp.spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { try { p.kill(); } catch (x) { } } };
/* makes the model's large-memory agent copy in Ollama (the same launcher step Claude Code uses; it needs no Claude) */
const realPrepare = c => new Promise(done => {
  if (!installed()) return done({ ok: false, error: 'jcode is not installed (looked for ' + EXE + ').' });
  if (c && c.free) return prepJcode(c, done);        /* the free pool needs no model made ready on this PC */
  const ps1 = path.join(agent.DIR, 'start-gemma-agent.ps1');
  if (!fs.existsSync(ps1)) return done({ ok: true });
  let pr; try { pr = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Model', c.model, '-AgentModel', c.agentModel, '-Ctx', String(c.ctx), '-PrepareOnly'], { windowsHide: true, stdio: 'ignore' }); }
  catch (e) { return done({ ok: false, error: 'Could not get the model ready: ' + e.message }); }
  const k = setTimeout(() => realKill(pr), 20 * 60000);
  pr.on('error', e => { clearTimeout(k); done({ ok: false, error: 'Could not get the model ready: ' + e.message }); });
  pr.on('close', code => { clearTimeout(k); done(code === 0 ? { ok: true } : { ok: false, error: 'The model could not be made ready.' }); });
});
/* the jcode background server that `acp` starts; stopped when Moundshroud closes */
function stopDaemon() { if (!installed()) return; try { cp.spawnSync(EXE, ['server', 'stop'], { stdio: 'ignore', windowsHide: true, timeout: 10000 }); } catch (e) { } }

function create(deps) {
  const d = Object.assign({ spawn: realSpawn, prepare: realPrepare, kill: realKill, save: () => { }, askTimeoutMs: ASK_TIMEOUT, unattended: false }, deps || {});
  const S = { running: false, busy: false, preparing: false, live: '', thinking: false, seq: 0, sessionId: '', model: '', ctx: 0, dir: '', guard: false, title: '', events: [], pending: new Map(), proc: null, stopped: false, buf: '', rid: 0, calls: new Map(), tools: new Map() };
  const push = e => { e.seq = ++S.seq; e.at = Date.now(); S.events.push(e); if (S.events.length > MAX_EVENTS) S.events.splice(0, S.events.length - MAX_EVENTS); return e; };
  const snapshot = () => ({ id: S.sessionId, title: S.title, dir: S.dir, model: S.model, ctx: S.ctx, guard: S.guard, harness: 'jcode', at: Date.now(), events: S.events.slice(-200) });
  const keep = () => { try { d.save(snapshot()); } catch (e) { } };
  const out = o => { try { return !!S.proc && S.proc.stdin.write(JSON.stringify(o) + '\n') !== undefined; } catch (e) { return false; } };
  const call = (method, params) => new Promise(res => { const id = ++S.rid; S.calls.set(id, res); if (!out({ jsonrpc: '2.0', id, method, params })) { S.calls.delete(id); res({ error: { message: 'jcode is not listening.' } }); } });
  const flush = () => { if (S.live.trim()) push({ kind: 'text', text: cut(S.live, MAX_TEXT) }); S.live = ''; S.thinking = false; };
  const UNATTENDED = 'Nobody is at the PC to approve this, so it was refused.';

  function state(since) {
    const n = +since || 0;
    return { harness: 'jcode', running: S.running, busy: S.busy, preparing: S.preparing, live: S.live, thinking: S.thinking, seq: S.seq, sessionId: S.sessionId, title: S.title, model: S.model, ctx: S.ctx, dir: S.dir, guard: S.guard,
      pending: [...S.pending.values()].map(p => ({ id: p.id, tool: p.tool, input: p.input, why: p.why })), events: S.events.filter(e => e.seq > n) };
  }
  function respond(p, allow, why) {
    clearTimeout(p.timer); S.pending.delete(p.id);
    const opt = (p.options || []).find(o => allow ? /^allow/.test(o.kind) && /once/.test(o.kind) : /^reject/.test(o.kind)) || (p.options || []).find(o => allow ? /^allow/.test(o.kind) : /^reject/.test(o.kind));
    out({ jsonrpc: '2.0', id: p.rpcId, result: { outcome: opt ? { outcome: 'selected', optionId: opt.optionId } : { outcome: 'cancelled' } } });
    push({ kind: 'answer', id: p.id, allow: !!allow, tool: p.tool, input: p.input, late: why === 'timeout', unattended: why === UNATTENDED });
  }
  function update(u) {
    const t = u.sessionUpdate;
    if (t === 'agent_message_chunk') { const c = u.content || {}; if (c.type === 'text') { S.thinking = false; S.live = (S.live + String(c.text || '')).slice(-MAX_TEXT); } return; }
    if (t === 'agent_thought_chunk') { S.thinking = true; return; }
    if (t === 'tool_call' || t === 'tool_call_update') {
      const id = String(u.toolCallId || ''); const tc = S.tools.get(id) || { shown: false, done: false }; S.tools.set(id, tc);
      if (u.title) tc.title = u.title; if (u.kind) tc.kind = u.kind; if (u.rawInput) tc.input = u.rawInput;
      if (!tc.shown && (tc.input || u.status === 'in_progress' || u.status === 'completed' || u.status === 'failed')) { flush(); tc.shown = true; push({ kind: 'tool', toolId: id, name: String(tc.title || tc.kind || 'tool'), input: small(tc.input || {}) }); }
      if (!tc.done && (u.status === 'completed' || u.status === 'failed')) {
        tc.done = true;
        const txt = (u.content || []).map(x => x && x.content && x.content.text || '').join('\n') || (u.rawOutput && (u.rawOutput.output || u.rawOutput.error)) || '';
        push({ kind: 'result', toolId: id, text: cut(txt, 8000), isError: u.status === 'failed' });
      }
    }
  }
  function message(m) {
    if (m.id != null && !m.method && S.calls.has(m.id)) { const r = S.calls.get(m.id); S.calls.delete(m.id); r(m); return; }
    if (m.method === 'session/update') { const p = m.params || {}; if (p.update) update(p.update); return; }
    if (m.method === 'session/request_permission') {
      const p0 = m.params || {}, tc = p0.toolCall || {};
      const p = { id: 'jp' + m.id, rpcId: m.id, tool: String(tc.title || tc.kind || 'tool'), input: small(tc.rawInput || {}), why: '', options: p0.options || [] };
      p.timer = setTimeout(() => { if (S.pending.has(p.id)) respond(p, false, 'timeout'); }, d.askTimeoutMs);
      S.pending.set(p.id, p); push({ kind: 'ask', id: p.id, tool: p.tool, input: p.input, why: p.why });
      if (d.unattended) respond(p, false, UNATTENDED);
      return;
    }
    if (m.method && m.id != null) out({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'not supported' } });   // file or terminal requests: jcode uses its own tools
  }
  function wire(proc) {
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', chunk => {
      if (S.proc !== proc) return;
      S.buf += chunk; let i;
      while ((i = S.buf.indexOf('\n')) >= 0) { const l = S.buf.slice(0, i).trim(); S.buf = S.buf.slice(i + 1); if (!l) continue; let m; try { m = JSON.parse(l); } catch (e) { continue; } message(m); }
      if (S.buf.length > 4e6) S.buf = '';
    });
    let err = ''; proc.stderr.on('data', x => { err = (err + x).slice(-600); });
    const ended = why => {
      if (S.proc !== proc) return;
      flush(); S.proc = null; S.running = false; S.busy = false; S.buf = '';
      S.pending.forEach(p => clearTimeout(p.timer)); S.pending.clear(); S.calls.forEach(r => r({ error: { message: 'jcode stopped.' } })); S.calls.clear();
      if (S.stopped) push({ kind: 'stopped' });
      else push({ kind: 'error', text: 'jcode stopped by itself. ' + (why || err.trim().split(/\r?\n/).filter(l => !/^Starting server/.test(l)).pop() || '').slice(0, 300) + ' Press Continue to pick the session up again.' });
      keep();
    };
    proc.on('error', e => ended(String(e.message || e)));
    proc.on('close', () => ended(''));
  }

  async function start(o) {
    const c = o && o.check; if (!c || !c.agentModel) return { ok: false, error: 'Choose a model first.' };
    if (S.preparing) return { ok: false, error: 'A session is already being started.' };
    if (S.proc) stop();
    S.preparing = true;
    if (c.free) {   /* the bridge has to be listening before jcode is given its address */
      try { await bridge.ensure(); } catch (e) { S.preparing = false; return { ok: false, error: 'The free AI bridge could not start: ' + String((e && e.message) || e) }; }
    }
    let r; try { r = await d.prepare(c); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    if (!r || !r.ok) { S.preparing = false; return { ok: false, error: (r && r.error) || 'The model could not be made ready.' }; }
    const resume = o.resume && SID.test(String(o.resume)) ? String(o.resume) : '';
    if (!resume) { S.events = []; S.sessionId = ''; S.title = ''; }
    let proc; try { proc = d.spawn(c, o.dir); } catch (e) { S.preparing = false; return { ok: false, error: 'Could not start jcode: ' + String(e.message || e) }; }
    Object.assign(S, { proc, running: true, busy: false, stopped: false, live: '', thinking: false, buf: '', model: c.model, ctx: c.ctx, dir: o.dir, guard: !!c.guard, tools: new Map() });
    wire(proc);
    const init = await call('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
    if (init.error) { S.preparing = false; stop(); return { ok: false, error: 'jcode did not start: ' + init.error.message }; }
    let ses = null;
    if (resume && init.result && init.result.agentCapabilities && init.result.agentCapabilities.loadSession) { ses = await call('session/load', { sessionId: resume, cwd: o.dir, mcpServers: [] }); if (!ses.error) S.sessionId = resume; }
    if (!S.sessionId) { ses = await call('session/new', { cwd: o.dir, mcpServers: [] }); if (ses.error || !ses.result) { S.preparing = false; stop(); return { ok: false, error: 'jcode could not open a session: ' + (ses.error ? ses.error.message : 'no reply') }; } S.sessionId = String(ses.result.sessionId || ''); }
    S.preparing = false;
    push({ kind: 'started', model: c.model, ctx: c.ctx, dir: o.dir, guard: !!c.guard, resumed: !!resume, harness: 'jcode' });
    return { ok: true };
  }
  function send(text, photo) {
    const t = String(text == null ? '' : text).trim();
    if (!S.running || !S.proc) return { ok: false, error: 'Start a session first.' };
    if (S.busy) return { ok: false, error: 'The agent is still working. Wait for it, or press Stop.' };
    if (!t) return { ok: false, error: 'Type a message first.' };
    if (t.length > 20000) return { ok: false, error: 'That message is too long (20,000 characters at most).' };
    const saved = savePhoto(S.dir, photo); if (!saved.ok) return saved;
    const full = saved.path ? t + '\n\n[The person attached a picture, saved at ' + saved.path + '. Open it if you can and use it as the reference for this task.]' : t;
    if (!S.title) S.title = t.replace(/\s+/g, ' ').slice(0, 80);
    S.busy = true; push(Object.assign({ kind: 'user', text: t }, saved.name ? { photo: saved.name } : {}));
    call('session/prompt', { sessionId: S.sessionId, prompt: [{ type: 'text', text: full }] }).then(r => {
      flush(); S.busy = false;
      const ok = !r.error && r.result && /end_turn|max_tokens|max_turn_requests/.test(String(r.result.stopReason || ''));
      push({ kind: 'done', ok: !r.error && r.result && r.result.stopReason !== 'refusal', text: ok ? '' : cut(r.error ? r.error.message : 'The turn ended: ' + (r.result && r.result.stopReason), 600) });
      keep();
    });
    return { ok: true };
  }
  function answer(id, allow) { const p = S.pending.get(String(id)); if (!p) return { ok: false, error: 'That question is no longer open.' }; respond(p, !!allow); return { ok: true }; }
  function stop() { if (!S.proc) return { ok: false, error: 'No session is running.' }; S.stopped = true; try { out({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: S.sessionId } }); } catch (e) { } try { d.kill(S.proc); } catch (e) { } return { ok: true }; }
  function show(rec) { if (S.proc) stop(); S.events = []; S.seq = 0; (rec.events || []).forEach(e => push(Object.assign({}, e))); Object.assign(S, { sessionId: rec.id || '', title: rec.title || '', model: rec.model || '', ctx: rec.ctx || 0, dir: rec.dir || '', guard: !!rec.guard, live: '', busy: false }); return { ok: true }; }
  function clear() { if (S.proc) stop(); Object.assign(S, { events: [], sessionId: '', title: '', live: '', busy: false }); return { ok: true }; }
  return { start, send, answer, stop, state, show, clear };
}
module.exports = { create, installed, stopDaemon, argsFor, FREE_PROFILE, EXE, SID };
