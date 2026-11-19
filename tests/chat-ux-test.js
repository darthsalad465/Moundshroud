// Automated regression checks for Moundshroud's Chat UI, Main Chat sidebar, zero native Windows popups,
// app-wide right-click context menu, and interactive Studio/Tools tutorial.
const fs = require('fs');
const path = require('path');

function countRawDialogs(src) {
  let i = 0, n = src.length, hits = 0;
  let prevMeaningful = '';
  const isIdStart = c => /[A-Za-z_$]/.test(c);
  const isId = c => /[A-Za-z0-9_$]/.test(c);
  const toks = [];
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { i += 2; while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'" || c === '"') { const q = c; i++; while (i < n && src[i] !== q) { i += src[i] === '\\' ? 2 : 1; } i++; toks.push({ t: 's', v: '' }); prevMeaningful = 's'; continue; }
    if (c === '`') { i++; let d = 0; while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '$' && src[i + 1] === '{') { d++; i += 2; continue; } if (d > 0 && src[i] === '}') { d--; i++; continue; } if (d === 0 && src[i] === '`') { i++; break; } i++; } toks.push({ t: 's', v: '' }); prevMeaningful = 's'; continue; }
    if (c === '/' && (!prevMeaningful || prevMeaningful === 'p' || prevMeaningful === 'k')) {
      i++; let ic = false;
      while (i < n) { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '[') ic = true; else if (src[i] === ']') ic = false; else if (src[i] === '/' && !ic) { i++; break; } else if (src[i] === '\n') break; i++; }
      while (i < n && /[gimsuvy]/.test(src[i])) i++;
      toks.push({ t: 'r', v: '' }); prevMeaningful = 'r'; continue;
    }
    if (isIdStart(c)) {
      const st = i++; while (i < n && isId(src[i])) i++;
      const v = src.slice(st, i);
      toks.push({ t: 'i', v });
      prevMeaningful = ['return', 'case', 'throw', 'in', 'of', 'typeof', 'void', 'delete', 'new', 'else', 'do', 'yield', 'await'].includes(v) ? 'k' : 'i';
      continue;
    }
    if (/[0-9]/.test(c)) { while (i < n && /[0-9a-zA-Z._]/.test(src[i])) i++; toks.push({ t: 'n', v: '' }); prevMeaningful = 'n'; continue; }
    const two = src.slice(i, i + 2);
    if (two === '?.') { toks.push({ t: 'p', v: '?.' }); prevMeaningful = 'p'; i += 2; continue; }
    toks.push({ t: 'p', v: c });
    prevMeaningful = ')]}'.includes(c) ? 'c' : 'p';
    i++;
  }
  for (let k = 0; k < toks.length - 1; k++) {
    const cur = toks[k], nxt = toks[k + 1], prv = toks[k - 1];
    if (cur.t === 'i' && (cur.v === 'confirm' || cur.v === 'prompt' || cur.v === 'alert') && nxt.t === 'p' && nxt.v === '(') {
      if (prv && prv.t === 'p' && (prv.v === '.' || prv.v === '?.')) {
        const p2 = toks[k - 2];
        if (!(p2 && p2.t === 'i' && p2.v === 'window')) continue;
      }
      if (prv && prv.t === 'i' && prv.v === 'function') continue;
      hits++;
    }
  }
  return hits;
}

async function run(ok) {
  const ROOT = path.join(__dirname, '..');
  const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const html = rd('web/index.html');
  const core = rd('web/js/core.js');
  const chat = rd('web/js/chat.js');
  const css = rd('web/chat-ui.css');
  const ctxm = rd('web/js/context-menu.js');
  const rtut = rd('web/js/repo-tutorial.js');

  console.log('Chat UX, in-app modals, right-click menu & interactive tutorial');
  ok('chat-ui.css is linked in web/index.html', html.includes('/web/chat-ui.css'));
  ok('chat-ui.css has balanced braces', (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
  ok('Main Chat has Agent-style sidebar elements in index.html (collapsed by default)', html.includes('id="chatx" class="chx sidehide"') && html.includes('id="chside"') && html.includes('id="chlist"') && html.includes('id="chsq"') && html.includes('id="chnew"') && html.includes('id="chclr"'));
  ok('chat.js renders grouped history sidebar with pin, rename, export & delete', /function renderSidebar\(/.test(chat) && /togglePin:\s*togglePinChat/.test(chat) && /rename:\s*renameChat/.test(chat) && /confirmRemove:\s*confirmRemoveChat/.test(chat) && /exportMd:\s*exportChatMd/.test(chat));

  ok('core.js provides Moundshroud A.confirm, A.prompt, A.alert modals', /A\.confirm\s*=/.test(core) && /A\.prompt\s*=/.test(core) && /A\.alert\s*=/.test(core));
  ok('core.js intercepts window.alert and window.Notification to block OS popups', /window\.alert\s*=/.test(core) && /window\.Notification\s*=\s*InAppNotification/.test(core));

  const jsDir = path.join(ROOT, 'web', 'js');
  const offenders = [];
  for (const f of fs.readdirSync(jsDir)) {
    if (!f.endsWith('.js') || f === 'core.js') continue;
    const cnt = countRawDialogs(fs.readFileSync(path.join(jsDir, f), 'utf8'));
    if (cnt > 0) offenders.push(f + ':' + cnt);
  }
  ok('zero raw browser/Windows confirm/prompt/alert calls across all web/js modules (incl. Chess)', offenders.length === 0, offenders.join(', '));

  ok('context-menu.js is linked in index.html and exposes A.ctxMenu', html.includes('/web/js/context-menu.js') && /A\.ctxMenu\s*=/.test(ctxm));
  ok('context-menu.js respects specialized right-click zones (3D Brain, Chess, canvases)', /#brn-cv/.test(ctxm) && /\.acb/.test(ctxm) && /canvas/.test(ctxm) && /e\.defaultPrevented/.test(ctxm));

  ok('repo-tutorial.js is linked in index.html and exposes A.repoTutorial', html.includes('/web/js/repo-tutorial.js') && /A\.repoTutorial\s*=/.test(rtut));
  const newRepoFiles = ['web/js/heretic.js', 'web/js/studio-photoshop.js', 'web/js/studio-medialab.js', 'web/js/studio-modelsuite.js', 'web/js/markitdown.js'];
  ok('all 5 new Studio/Tools sections wire the interactive Guide button', newRepoFiles.every(f => /repoTutorial/.test(rd(f))));
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  });
}
