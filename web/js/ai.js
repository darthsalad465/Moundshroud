// Small shared helpers for features that talk to the local AI model: streaming a reply, and pulling JSON out of a reply.
(() => {
  const model = () => { const m = document.getElementById('model'); return m ? m.value : ''; };
  /* private material (what is on screen, your files and notes, what the AI remembers) never goes to Claude unless you
     allowed that kind in Settings › Privacy: the request is answered by a model on this PC instead */
  const isCloud = m => /^claude-/i.test(String(m || ''));
  const allowed = kind => { try { return ls.get('cl_ok_' + kind, '0') === '1'; } catch (e) { return false; } };
  let localCache = null;
  async function localModel() {
    if (localCache) return localCache;
    try {
      const r = await (await fetch('/api/models')).json();
      const def = A.modelOrder ? A.modelOrder.sync(r.defaultModel) : '';
      const raw = (r.models || []).filter(m => !m.cloud);
      const sorted = A.modelOrder ? A.modelOrder.sort(raw, def) : raw;
      const ms = sorted.map(m => m.name);
      const saved = ls.get('local_model', '');
      const defHit = def && sorted.find(m => A.modelOrder && A.modelOrder.matches(m, def));
      localCache = (defHit && defHit.name) || (ms.includes(saved) ? saved : (ms.find(m => !/embed/i.test(m)) || ''));
    } catch (e) { }
    return localCache || '';
  }
  async function pick(opts) { const m = opts.model || model(); if (opts.private && isCloud(m) && !allowed(opts.private)) { const l = await localModel(); if (l) return l; throw new Error('This uses private material, which is not sent to Claude, and no AI model is installed on this PC.'); } return m; }
  async function stream(messages, onText, signal, opts) {
    opts = opts || {};
    const route = opts.localOnly ? '/api/chat?surface=playground' : '/api/chat';
    const r = await fetch(route, { method: 'POST', signal, body: JSON.stringify({ model: await pick(opts), stream: true, think: false, keep_alive: '5m', options: { temperature: opts.temp == null ? .7 : opts.temp }, messages }) });
    if (opts.localOnly && !r.ok) throw new Error('Local chat unavailable');
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', all = '';
    for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln) continue; try { const j = JSON.parse(ln); if (j.message && j.message.content) { all += j.message.content; if (onText) onText(all); } } catch (e) { } } }
    return all;
  }
  /* the first JSON object or array found in a model reply, or null */
  function json(text) {
    if (!text) return null; const t = String(text).replace(/```(?:json)?/gi, ''); const a = t.search(/[\[{]/); if (a < 0) return null; const open = t[a], close = open === '{' ? '}' : ']'; let depth = 0, inStr = false, esc = false;
    for (let i = a; i < t.length; i++) { const c = t[i]; if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; } if (c === '"') inStr = true; else if (c === open) depth++; else if (c === close) { depth--; if (depth === 0) { try { return JSON.parse(t.slice(a, i + 1)); } catch (e) { return null; } } } }
    return null;
  }
  const once = async (messages, opts) => stream(messages, null, null, opts);
  const refreshModels = () => A.chat && A.chat.loadModels && A.chat.loadModels();
  A.ai = { stream, json, once, model, isCloud, allowed, localModel, refreshModels };
  if (A.on) A.on('default-model', () => { localCache = null; });
  /* remember the last model on this PC, so the private fallback uses the one you chose */
  document.addEventListener('change', e => { if (e.target && e.target.id === 'model' && !isCloud(e.target.value)) { try { ls.set('local_model', e.target.value); localCache = null; } catch (x) { } } });
})();
