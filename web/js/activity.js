// What the app is doing right now, from any page, and how long everything took.
// A job says A.act.begin('Writing the game', { tab: 'studio', go: () => A.studio.go('games') }), calls op.say('part 2 of 3')
// while it works and op.end(true) when it is done. One-off work is A.act.mark(kind, label, ms, { tab, ok, note }).
// The ⏱ button in the top bar shows the job that is running with its seconds; clicking it lists everything running and
// the last 150 things that finished with their times, and each row jumps to the page it belongs to.
(() => {
  const KEEP = 150, KEY = 'actlog';
  const now = () => Date.now();
  let log = [], ops = [], seq = 0, timer = 0;
  try { const j = JSON.parse(ls.get(KEY, '[]')); if (Array.isArray(j)) log = j.filter(x => x && typeof x.at === 'number' && x.label).slice(-KEEP); } catch (e) { log = []; }

  /* 840 ms, 4.2 s, 47 s, 2 m 05 s: enough detail to see what is slow without a stopwatch */
  const fmt = ms => {
    ms = Math.max(0, Math.round(+ms || 0));
    if (ms < 1000) return ms + ' ms';
    if (ms < 10000) return (ms / 1000).toFixed(1) + ' s';
    if (ms < 60000) return Math.round(ms / 1000) + ' s';
    const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000);
    return m + ' m ' + (s < 10 ? '0' : '') + s + ' s';
  };
  const ago = t => { const s = (now() - t) / 1000; return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  const KIND = { ai: '🤖', game: '🎮', chat: '💬', art: '🎨', page: '📄', net: '↔', calc: '🧮', other: '•' };
  const save = () => { try { ls.set(KEY, JSON.stringify(log.slice(-KEEP))); } catch (e) { } };

  const rec = e => { log.push(e); if (log.length > KEEP) log = log.slice(-KEEP); save(); paint(); };
  const short = (s, n) => { s = String(s || ''); return s.length > (n || 42) ? s.slice(0, (n || 42) - 1) + '…' : s; };

  /* ---------- the clock ---------- */
  function begin(label, opts) {
    opts = opts || {};
    const op = {
      id: ++seq, label: String(label || 'Working'), kind: opts.kind || 'ai', tab: opts.tab || '', go: opts.go || null,
      at: now(), phase: String(opts.phase || ''), done: false,
      /* what it is doing right now, e.g. "writing part 2 of 3, 14 kB" */
      say(t) { if (!op.done) { op.phase = String(t == null ? '' : t); paint(); } return op; },
      /* the job finished: ok false is stopped or failed, note is kept with the time */
      end(ok, note) {
        if (op.done) return op; op.done = true;
        const i = ops.indexOf(op); if (i >= 0) ops.splice(i, 1);
        rec({ label: op.label, kind: op.kind, tab: op.tab, at: op.at, ms: now() - op.at, ok: ok !== false, note: [op.phase, note].filter(Boolean).join(' · ') });
        return op;
      }
    };
    ops.push(op); paint(); return op;
  }
  /* work that has already finished: a page opening, an API call, a picture */
  const mark = (kind, label, ms, opts) => {
    opts = opts || {};
    rec({ label: String(label || kind), kind: kind || 'other', tab: opts.tab || '', at: opts.at || (now() - (ms || 0)), ms: Math.max(0, +ms || 0), ok: opts.ok !== false, note: opts.note || '' });
  };
  /* time a piece of work: A.act.time('net', 'Loading mail', () => fetch(...)) */
  const time = async (kind, label, fn, opts) => {
    const t0 = now(); try { const r = await fn(); mark(kind, label, now() - t0, Object.assign({ ok: true }, opts)); return r; }
    catch (e) { mark(kind, label, now() - t0, Object.assign({ ok: false, note: String(e && e.message || e).slice(0, 80) }, opts)); throw e; }
  };

  /* ---------- the button and its list ---------- */
  let open = false;
  function jump(tab, go) {
    try { A.closePop(); } catch (e) { }
    open = false;
    if (go) { try { go(); return; } catch (e) { } }
    if (tab) { try { A.showTab(tab); } catch (e) { } }
  }
  const rowLive = o => '<div class="actp-r on"><i class="actsp"></i><b>' + esc(short(o.label, 34)) + '</b><span class="actp-s">' + fmt(now() - o.at) + '</span>' + (o.phase ? '<div class="actp-p">' + esc(short(o.phase, 70)) + '</div>' : '') + '</div>';
  const rowDone = (e, i) => '<button class="actp-r" type="button" data-i="' + i + '"><span class="actp-k">' + (KIND[e.kind] || KIND.other) + '</span><b>' + esc(short(e.label, 34)) + '</b><span class="actp-s' + (e.ok ? '' : ' bad') + '">' + fmt(e.ms) + '</span><div class="actp-p">' + esc([e.ok ? '' : 'stopped or failed', e.note, ago(e.at)].filter(Boolean).join(' · ')).slice(0, 90) + '</div></button>';
  function popHtml() {
    const L = log.slice(-16).reverse();
    const ai = log.filter(e => e.kind === 'ai' || e.kind === 'chat' || e.kind === 'game' || e.kind === 'art');
    const med = k => { const a = ai.filter(e => e.ok).map(e => e.ms).sort((x, y) => x - y); return a.length ? fmt(a[Math.floor(a.length / 2)]) : '—'; };
    return '<div class="actp-h">Running now' + (ops.length > 1 ? ' (' + ops.length + ')' : '') + '</div>' +
      (ops.length ? ops.slice().reverse().map(rowLive).join('') : '<div class="actp-none">Nothing. Everything below is finished.</div>') +
      '<div class="actp-h">Just finished <button class="actp-clr" type="button">Clear</button></div>' +
      (L.length ? L.map((e, i) => rowDone(e, i)).join('') : '<div class="actp-none">Nothing timed yet. Chat, the game maker, pictures and page openings are all timed.</div>') +
      '<div class="actp-f">' + ai.length + ' AI jobs timed · the middle one took ' + med() + ' · kept: last ' + log.length + ' things</div>';
  }
  function showPop() {
    const b = $('act'); if (!b) return;
    const p = A.pop(b, popHtml(), 'right');
    p.classList.add('actp');
    open = true;
    p.onclick = ev => {
      const c = ev.target.closest('.actp-clr');
      if (c) { log = []; save(); p.innerHTML = popHtml(); return; }
      const r = ev.target.closest('[data-i]'); if (!r) return;
      const L = log.slice(-16).reverse(), e = L[+r.dataset.i]; if (!e) return;
      jump(e.tab);
    };
  }
  function paint() {
    const b = $('act'); if (!b) return;
    const live = ops.length ? ops[ops.length - 1] : null;
    b.classList.toggle('busy', !!live);
    if (live) b.innerHTML = '<i class="actsp"></i><span class="actlb"></span><span class="actt">' + fmt(now() - live.at) + '</span>';
    else b.innerHTML = '⏱';
    const lb = b.querySelector('.actlb'); if (lb) lb.textContent = short(live.label, 26);
    b.title = live ? live.label + (live.phase ? ' · ' + live.phase : '') + ' · ' + fmt(now() - live.at) : 'What the app has been doing, and how long everything took';
    if (ops.length && !timer) timer = setInterval(paint, 500);
    if (!ops.length && timer) { clearInterval(timer); timer = 0; }
    /* the open list keeps counting too, so a job's seconds move while you look at it */
    if (open) { const p = $('pop'); if (p && p.classList.contains('actp') && p.style.display === 'block') p.innerHTML = popHtml(); else open = false; }
  }

  A.act = { begin, mark, time, fmt, ago, jump, get running() { return ops.slice(); }, get log() { return log.slice(); }, clear() { log = []; save(); paint(); } };
  document.addEventListener('DOMContentLoaded', () => { const b = $('act'); if (b && !b._wired) { b._wired = 1; b.onclick = showPop; } }, { once: true });
  /* the header exists before this runs (scripts are deferred), so wire it right away too */
  const b = $('act'); if (b && !b._wired) { b._wired = 1; b.onclick = showPop; }
})();
