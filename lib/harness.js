// The in-app agent: Claude Code runs hidden, driven by a model in Ollama, and the Agent tab shows the conversation.
// This module starts that process, turns the stream it prints into the events the page shows, passes on what the
// user types, and holds every guarded command until the user allows or refuses it in the page.
// One session runs at a time, because this PC's graphics card holds one model at a time.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const agent = require('./agent');

const MAX_EVENTS = 500, MAX_TEXT = 60000, ASK_TIMEOUT = 30 * 60000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* what a tool was given, for the page: each long value (a whole file being written, say) is shortened */
const small = input => { const o = {}; if (input && typeof input === 'object') for (const k of Object.keys(input).slice(0, 20)) { const v = input[k]; o[k] = typeof v === 'string' ? cut(v, 6000) : (v == null || typeof v === 'number' || typeof v === 'boolean') ? v : cut(JSON.stringify(v), 2000); } return o; };
const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 40) + '\n... (the rest is not shown)' : s; };

/* the playbooks (agent\playbooks\core\*.md): short rule sheets written for small models (plan, debug, check, review,
   explain, documents, safe). They are added to every session's instructions, about 700 tokens in all. */
const PLAYBOOKS = path.join(__dirname, '..', 'agent', 'playbooks', 'core');
function playbooks() {
  let files = []; try { files = fs.readdirSync(PLAYBOOKS).filter(f => /\.md$/i.test(f)).sort(); } catch (e) { return ''; }
  const body = files.map(f => { try { return fs.readFileSync(path.join(PLAYBOOKS, f), 'utf8').trim(); } catch (e) { return ''; } }).filter(Boolean).join('\n\n');
  return body ? 'PLAYBOOKS. Follow the one that fits the task (several can apply).\n\n' + body.slice(0, 8000) : '';
}
/* the command line: no window, JSON in and out, and questions about permission sent to this app instead of a console */
function argsFor(c, opts) {
  const a = ['--bare', '--model', c.agentModel, '--permission-mode', 'acceptEdits', '--tools', 'Read,Write,Edit,Glob,Grep,Bash',
    '-p', '--verbose', '--input-format', 'stream-json', '--output-format', 'stream-json', '--include-partial-messages', '--permission-prompt-tool', 'stdio'];
  const pb = opts && opts.playbooks === false ? '' : playbooks(); if (pb) a.push('--append-system-prompt', pb);
  if (c.guard) a.push('--settings', c.guard);
  if (opts && UUID.test(String(opts.resume || ''))) a.push('--resume', String(opts.resume));
  return a;
}
/* the same settings the terminal launcher makes: Ollama instead of Anthropic, the agent's own empty config folder */
function envFor(c, base) {
  const e = Object.assign({}, base, {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:11434', ANTHROPIC_AUTH_TOKEN: 'ollama', ANTHROPIC_API_KEY: 'ollama', ANTHROPIC_MODEL: c.agentModel,
    ANTHROPIC_DEFAULT_OPUS_MODEL: c.agentModel, ANTHROPIC_DEFAULT_SONNET_MODEL: c.agentModel, ANTHROPIC_DEFAULT_HAIKU_MODEL: c.agentModel,
    CLAUDE_CONFIG_DIR: path.join(agent.DIR, 'config'), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(Math.min(64000, Math.floor((c.ctx || 32768) / 2))),
  });
  /* Claude Code tidies a long session only at 100,000 tokens or more, so that only helps the 128k memory */
  if ((c.ctx || 0) >= 131072) e.CLAUDE_CODE_AUTO_COMPACT_WINDOW = '120000'; else delete e.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  return e;
}

/* ---- what a real session uses; the tests pass their own ---- */
const realSpawn = (c, dir, opts) => cp.spawn(agent.claudePath(), argsFor(c, opts), { cwd: dir, env: envFor(c, process.env), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const realKill = p => { try { cp.spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { try { p.kill(); } catch (x) { } } };
/* wakes Ollama and makes the model's agent copy if it is missing: the launcher already knows how (-PrepareOnly) */
const realPrepare = c => new Promise(done => {
  const ps1 = path.join(agent.DIR, 'start-gemma-agent.ps1');
  if (!fs.existsSync(ps1)) return done({ ok: false, error: 'The agent is not set up on this PC yet (looked for ' + ps1 + ').' });
  if (!agent.claudePath()) return done({ ok: false, error: 'Claude Code is not installed, and the agent borrows its tools.' });
  let out = '', pr;
  try { pr = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Model', c.model, '-AgentModel', c.agentModel, '-Ctx', String(c.ctx), '-PrepareOnly'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return done({ ok: false, error: 'Could not get the model ready: ' + String(e.message || e) }); }
  const k = setTimeout(() => realKill(pr), 20 * 60000);
  pr.stdout.setEncoding('utf8'); pr.stdout.on('data', d => { out = (out + d).slice(-2000); });
  pr.on('error', e => { clearTimeout(k); done({ ok: false, error: 'Could not get the model ready: ' + e.message }); });
  pr.on('close', code => { clearTimeout(k); done(code === 0 ? { ok: true } : { ok: false, error: (out.trim().split(/\r?\n/).filter(l => /[a-z]/i.test(l)).pop() || 'The model could not be made ready.').slice(0, 300) }); });
});

function create(deps) {
  /* unattended (routines): nobody is there to answer, so every permission question is refused at once with a note saying so */
  const d = Object.assign({ spawn: realSpawn, prepare: realPrepare, kill: realKill, save: () => { }, askTimeoutMs: ASK_TIMEOUT, unattended: false, onEvent: null, tag: null }, deps || {});
  const S = { running: false, busy: false, preparing: false, live: '', thinking: false, seq: 0, sessionId: '', model: '', ctx: 0, dir: '', guard: false, title: '', events: [], pending: new Map(), proc: null, stopped: false, buf: '', check: null, tag: null };
  const push = e => { e.seq = ++S.seq; e.at = Date.now(); S.events.push(e); if (S.events.length > MAX_EVENTS) S.events.splice(0, S.events.length - MAX_EVENTS); if (d.onEvent) { try { d.onEvent(e); } catch (x) { } } return e; };
  const write = o => { try { return !!S.proc && S.proc.stdin.write(JSON.stringify(o) + '\n') !== undefined; } catch (e) { return false; } };
  const keep = () => { try { d.save(snapshot()); } catch (e) { } };
  const snapshot = () => Object.assign({ id: S.sessionId, title: S.title, dir: S.dir, model: S.model, ctx: S.ctx, guard: S.guard, at: Date.now(), events: S.events.slice(-200) }, S.tag ? { routine: S.tag } : {});
  const UNATTENDED = 'Nobody is at the PC to approve this, so it was refused. Carry on with what needs no approval, and at the end say what you would need permission for.';

  /* what the page shows; since = the last event number it already has */
  function state(since) {
    const n = +since || 0;
    return { running: S.running, busy: S.busy, preparing: S.preparing, live: S.live, thinking: S.thinking, seq: S.seq, sessionId: S.sessionId, title: S.title, model: S.model, ctx: S.ctx, dir: S.dir, guard: S.guard,
      pending: [...S.pending.values()].map(p => ({ id: p.id, tool: p.tool, input: p.input, why: p.why })), events: S.events.filter(e => e.seq > n) };
  }

  function respond(p, allow, why) {
    clearTimeout(p.timer); S.pending.delete(p.id);
    write({ type: 'control_response', response: { subtype: 'success', request_id: p.id, response: allow ? { behavior: 'allow', updatedInput: p.input } : { behavior: 'deny', message: why || 'The user refused this.' } } });
    push({ kind: 'answer', id: p.id, allow: !!allow, tool: p.tool, input: p.input, late: why === 'timeout', unattended: why === UNATTENDED });
  }

  /* one line of Claude Code's stream */
  function line(text) {
    let j; try { j = JSON.parse(text); } catch (e) { return; }
    if (!j || typeof j !== 'object') return;
    if (j.session_id && UUID.test(j.session_id)) S.sessionId = j.session_id;
    if (j.type === 'stream_event') {
      const dl = j.event && j.event.type === 'content_block_delta' && j.event.delta;
      if (dl && dl.type === 'text_delta') { S.thinking = false; S.live = (S.live + String(dl.text || '')).slice(-MAX_TEXT); }
      else if (dl && dl.type === 'thinking_delta') S.thinking = true;
      return;
    }
    if (j.type === 'assistant') {
      S.live = ''; S.thinking = false;
      for (const b of (j.message && j.message.content) || []) {
        if (b.type === 'text' && String(b.text || '').trim()) push({ kind: 'text', text: cut(b.text, MAX_TEXT) });
        else if (b.type === 'tool_use') push({ kind: 'tool', toolId: b.id, name: String(b.name || ''), input: small(b.input) });
      }
      return;
    }
    if (j.type === 'user') {
      const c = j.message && j.message.content;
      for (const b of Array.isArray(c) ? c : []) {
        if (b.type !== 'tool_result') continue;
        const t = Array.isArray(b.content) ? b.content.map(x => x && x.type === 'text' ? x.text : '').join('\n') : String(b.content == null ? '' : b.content);
        push({ kind: 'result', toolId: b.tool_use_id, text: cut(t, 8000), isError: !!b.is_error });
      }
      return;
    }
    if (j.type === 'control_request') {
      const r = j.request || {};
      if (r.subtype !== 'can_use_tool') { write({ type: 'control_response', response: { subtype: 'error', request_id: j.request_id, error: 'not supported' } }); return; }
      const p = { id: String(j.request_id), tool: String(r.tool_name || ''), input: r.input && typeof r.input === 'object' ? r.input : {}, why: String(r.decision_reason || r.description || '').slice(0, 300) };
      p.timer = setTimeout(() => { if (S.pending.has(p.id)) respond(p, false, 'timeout'); }, d.askTimeoutMs);
      S.pending.set(p.id, p); push({ kind: 'ask', id: p.id, tool: p.tool, input: p.input, why: p.why });
      if (d.unattended) respond(p, false, UNATTENDED);
      return;
    }
    if (j.type === 'result') {
      S.busy = false; S.live = ''; S.thinking = false;
      push({ kind: 'done', ok: j.subtype === 'success', text: j.subtype === 'success' ? '' : cut(j.result || j.subtype || 'The turn ended with an error.', 600) });
      keep();
    }
  }

  function wire(proc) {
    proc.stdout.setEncoding && proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', chunk => {
      if (S.proc !== proc) return;
      S.buf += chunk; let i;
      while ((i = S.buf.indexOf('\n')) >= 0) { const l = S.buf.slice(0, i).trim(); S.buf = S.buf.slice(i + 1); if (l) line(l); }
      if (S.buf.length > 4e6) S.buf = '';      // a line that never ends is thrown away
    });
    let err = ''; proc.stderr.on('data', x => { err = (err + x).slice(-600); });
    const ended = why => {
      if (S.proc !== proc) return;
      S.proc = null; S.running = false; S.busy = false; S.live = ''; S.thinking = false; S.buf = '';
      S.pending.forEach(p => clearTimeout(p.timer)); S.pending.clear();
      if (S.stopped) push({ kind: 'stopped' });
      else push({ kind: 'error', text: 'The agent stopped by itself. ' + (why || err.trim().split(/\r?\n/).pop() || '').slice(0, 300) + ' Press Continue to pick the session up again.' });
      keep();
    };
    proc.on('error', e => ended(String(e.message || e)));
    proc.on('close', () => ended(''));
  }

  /* starts a session (or picks an earlier one up with o.resume); o.check comes from agent.check, o.dir from safe-dir */
  async function start(o) {
    const c = o && o.check; if (!c || !c.agentModel) return { ok: false, error: 'Choose a model first.' };
    if (S.preparing) return { ok: false, error: 'A session is already being started.' };
    if (S.proc) stop();
    S.preparing = true;
    let r; try { r = await d.prepare(c); } catch (e) { r = { ok: false, error: String(e.message || e) }; }
    S.preparing = false;
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'The model could not be made ready.' };
    const resume = o.resume && UUID.test(String(o.resume)) ? String(o.resume) : '';
    if (!resume) { S.events = []; S.sessionId = ''; S.title = ''; S.tag = o.tag || null; } else S.sessionId = resume;
    let proc; try { proc = d.spawn(c, o.dir, { resume }); } catch (e) { return { ok: false, error: 'Could not start the agent: ' + String(e.message || e) }; }
    Object.assign(S, { proc, running: true, busy: false, stopped: false, live: '', thinking: false, buf: '', model: c.model, ctx: c.ctx, dir: o.dir, guard: !!c.guard, check: c });
    wire(proc);
    push({ kind: 'started', model: c.model, ctx: c.ctx, dir: o.dir, guard: !!c.guard, resumed: !!resume });
    return { ok: true };
  }

  function send(text) {
    const t = String(text == null ? '' : text).trim();
    if (!S.running || !S.proc) return { ok: false, error: 'Start a session first.' };
    if (S.busy) return { ok: false, error: 'The agent is still working. Wait for it, or press Stop.' };
    if (!t) return { ok: false, error: 'Type a message first.' };
    if (t.length > 20000) return { ok: false, error: 'That message is too long (20,000 characters at most).' };
    if (!write({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: t }] } })) return { ok: false, error: 'The agent is not listening. Start a new session.' };
    if (!S.title) S.title = S.tag && S.tag.name ? String(S.tag.name).slice(0, 80) : t.replace(/\s+/g, ' ').slice(0, 80);
    S.busy = true; push({ kind: 'user', text: t });
    return { ok: true };
  }

  function answer(id, allow) {
    const p = S.pending.get(String(id)); if (!p) return { ok: false, error: 'That question is no longer open.' };
    respond(p, !!allow); return { ok: true };
  }

  /* ends the process; the conversation stays on screen and can be continued */
  function stop() {
    if (!S.proc) return { ok: false, error: 'No session is running.' };
    S.stopped = true; const p = S.proc;
    try { d.kill(p); } catch (e) { }
    return { ok: true };
  }

  /* puts an earlier conversation back on screen; Continue then picks it up by its id */
  function show(rec) {
    if (S.proc) stop();
    S.events = []; S.seq = 0; (rec.events || []).forEach(e => push(Object.assign({}, e)));
    Object.assign(S, { sessionId: rec.id || '', title: rec.title || '', model: rec.model || '', ctx: rec.ctx || 0, dir: rec.dir || '', guard: !!rec.guard, live: '', busy: false, tag: rec.routine || null });
    return { ok: true };
  }

  /* puts the screen back to nothing, for a brand-new conversation that has not started yet */
  function clear() {
    if (S.proc) stop();
    Object.assign(S, { events: [], sessionId: '', title: '', tag: null, live: '', busy: false });
    return { ok: true };
  }

  return { start, send, answer, stop, state, show, clear };
}

/* ---- the conversations that were had: the last 60, kept in the data folder so they can be read again and continued ---- */
const KEEP = 60;
function store(dataDir) {
  const file = path.join(dataDir, 'agent-sessions.json');
  const read = () => { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j) ? j : []; } catch (e) { return []; } };
  return {
    list: () => read().map(s => ({ id: s.id, title: s.title, dir: s.dir, model: s.model, ctx: s.ctx, guard: s.guard, at: s.at, routine: s.routine || null, n: (s.events || []).filter(e => e.kind === 'user').length })),
    get: id => read().find(s => s.id === id) || null,
    save: rec => { if (!rec || !(UUID.test(String(rec.id || '')) || /^session_[A-Za-z0-9_]{4,120}$/.test(String(rec.id || '')))) return; /* Claude Code ids, or jcode's session_... ids */ const all = [rec].concat(read().filter(s => s.id !== rec.id)).slice(0, KEEP), t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(all)); fs.renameSync(t, file); },
    forget: id => { const all = read().filter(s => s.id !== id), t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(all)); fs.renameSync(t, file); },
  };
}

module.exports = { create, store, argsFor, envFor, playbooks, UUID };
