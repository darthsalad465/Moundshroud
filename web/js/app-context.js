// What the AI can see of Moundshroud itself: the page in front of the user, and the app's own source files.
// Used by the main chat and by the buddy in the corner, so both can answer "what am I looking at?" and
// "how does this part of the app work?" from the real thing instead of guessing.
(() => {
  /* the app's own object is a top-level const, not a property of window, so it has to be reached by name */
  const App = () => { try { return typeof A !== 'undefined' ? A : (window.A || {}); } catch (e) { return window.A || {}; } };
  const api = (p, b) => fetch(p, { method: b === undefined ? 'GET' : 'POST', body: b === undefined ? undefined : JSON.stringify(b) }).then(r => r.ok ? r.json() : null).catch(() => null);

  /* ---------- the page the user is on ---------- */
  const skip = 'script,style,svg,canvas,noscript,#cmpc,#cmp,.acb,.tour,.prebar,[data-private]';   // [data-private]: the password vault and mail are never shown to the AI
  const vis = el => {
    if (!el || !el.getBoundingClientRect) return false;
    let n = el;
    for (let i = 0; i < 8 && n && n.nodeType === 1; i++, n = n.parentElement) {
      const st = getComputedStyle(n);
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  function textOf(panel, cap) {
    const out = []; let size = 0;
    try {
      const w = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, null); let n;
      while ((n = w.nextNode()) && size < cap) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim(); if (!t) continue;
        const p = n.parentElement; if (!p || p.closest(skip)) continue;
        if (!vis(p)) continue;
        out.push(t); size += t.length + 1;
      }
    } catch (e) { }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').slice(0, cap);
  }
  function controls(panel) {
    const out = [];
    panel.querySelectorAll('button,a.btn,input,select,textarea').forEach(el => {
      if (!vis(el) || out.length > 60) return;
      let t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t && el.tagName === 'INPUT') t = el.type === 'checkbox' || el.type === 'radio' ? (el.checked ? 'ticked: ' : 'not ticked: ') + (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : el.id || 'option') : (el.placeholder || el.id || '');
      if (!t && el.tagName === 'SELECT' && el.selectedIndex >= 0) t = 'chosen: ' + el.options[el.selectedIndex].textContent.trim();
      if (t) out.push(t.replace(/\s+/g, ' ').slice(0, 70));
    });
    return out.slice(0, 45);
  }
  function page() {
    const app = App(), id = app.cur || '', tabs = app.tabs || {};
    const panel = document.getElementById('p-' + id) || document.querySelector('.panel.on') || document.body;
    /* any inner tabs / sub-pages that are open, so the AI knows which one is on screen */
    const inner = [...panel.querySelectorAll('[role=tab][aria-selected=true],.tab.on,.seg button.on,.chip.on')].map(e => (e.textContent || '').trim()).filter(Boolean).slice(0, 6);
    /* the tab's own name, or the page's heading if the tabs are not registered yet */
    let label = (tabs[id] && tabs[id].label) || '';
    if (!label) { const h = [...panel.querySelectorAll('h1,h2,.big,.hd b,.head b')].find(e => vis(e) && (e.textContent || '').trim()); label = h ? h.textContent.trim().slice(0, 40) : (id || 'Moundshroud'); }
    /* a page shown inside the app (the reader, a library page) is part of what is on screen too */
    let framed = '';
    panel.querySelectorAll('iframe').forEach(f => { if (f.lf) { if (f._text && f.style.display !== 'none') framed += '\n' + f._text.replace(/\n{3,}/g, '\n\n').slice(0, 20000); return; } try { const d = f.contentDocument; if (d && d.body) framed += '\n' + (d.body.innerText || d.body.textContent || '').replace(/\n{3,}/g, '\n\n').slice(0, 2600); } catch (e) { } });
    return { label, inner, text: (textOf(panel, 5200) + framed).slice(0, 6500), controls: controls(panel) };
  }
  /* a compact block for the model's system prompt */
  function pagePrompt(cap) {
    const p = page(); const t = p.text ? p.text.slice(0, cap || 1800) : '';
    let s = 'The user is looking at the "' + p.label + '" tab of Moundshroud' + (p.inner.length ? ', sub-page: ' + p.inner.join(' > ') : '') + '.';
    if (t) s += ' What is on that page right now (read from the screen):\n"""\n' + t + '\n"""';
    if (p.controls.length) s += '\nButtons and fields visible on it: ' + p.controls.slice(0, 22).join(' | ');
    return s;
  }

  /* ---------- the app's own files ---------- */
  let cached = 0, ticks = 0;
  const source = async (q, n) => { try { return await api('/api/app/search', { q: String(q || ''), n: n || 12, files: 3 }); } catch (e) { return null; } };
  const read = async (p, max) => { try { return await api('/api/app/file', { path: String(p || ''), max: max || 9000 }); } catch (e) { return null; } };
  /* Does the message ask about Moundshroud itself rather than about the world? Deliberately narrow: an app name, an
     app-only word, or a question about a control on screen. A general question ("how does the immune system work?") never
     matches, so its answer is not buried in the app's code. */
  const SELF = /(\bmoundshroud\b|\bthis app\b|\bthe app\b|\byour code\b|\bthe code\b|\bsource code\b|\bwhich file\b|\bwhat file\b|\bin the (code|app|program)\b|\bwhat (does|do) (this|that) (button|tab|setting|slider|toggle|box|menu|page) do\b|\bis there a (way|setting|button|option|shortcut)\b|\bwhere (do|can) i (change|find|turn|set|open)\b)/i;
  const ONLY = /\b(premoves?|buddy|companion|board settings|chess trainer|self-?test|offline library|stock up|command palette|interface style|appearance|quick actions|hotkeys?|shortcuts?)\b/i;
  const ASKS = /\b(how|where|what|which|does|do|work|works|change|turn|find|open|set|mean|means)\b/i;
  const CTRL = /\b(settings?|button|tab|section|toggle|slider|feature|option|menu|checkbox)\b/i;
  const about = t => {
    const s = String(t || '');
    if (SELF.test(s)) return true;
    if (ONLY.test(s) && ASKS.test(s)) return true;
    return CTRL.test(s) && ASKS.test(s) && /\b(app|moundshroud|in here|on this page|on screen|this page|the screen)\b/i.test(s);
  };
  /* the source snippets worth putting in front of the model for a question about the app */
  const context = async q => { const r = await source(q, 12); return r && r.context ? r.context : ''; };

  window.AppCtx = { page, pagePrompt, about, source, read, context, visible: vis, controls };
})();
