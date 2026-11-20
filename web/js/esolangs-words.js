// Coding › Playground: interpreters for word-based esoteric languages, written for Moundshroud: INTERCAL (C-INTERCAL
// without the system library), the Shakespeare Programming Language, Chef, LOLCODE 1.2, ArnoldC, Rockstar (core),
// Emojicode (printing, numbers, variables, conditions and loops; no classes) and Whenever. They add themselves to
// Esolangs.L from web/js/esolangs.js and use the same io object, so they run in the Playground's worker and in the tests.
(function (root) {
  'use strict';
  const E = root.Esolangs, L = E.L, chr = E.chr;
  const fail = m => { throw new Error(m); };

  /* =================== INTERCAL =================== */
  L.intercal = (code, io) => {
    const src = code.replace(/\r/g, '');
    const re = /(?:\((\d+)\)\s*)?\b(PLEASE\s+DO|PLEASE|DO)\b/g, heads = [];
    let m; while ((m = re.exec(src))) heads.push({ at: m.index, end: m.index + m[0].length, label: m[1] ? +m[1] : 0, polite: /PLEASE/.test(m[2]) });
    if (!heads.length) fail('ICL000I An INTERCAL program is a list of statements that start with DO or PLEASE.');
    const st = heads.map((h, k) => {
      let body = src.slice(h.end, k + 1 < heads.length ? heads[k + 1].at : src.length).replace(/\s+/g, ' ').trim(), off = false, chance = 100;
      let mm = /^(NOT|N'T)\b\s*/.exec(body); if (mm) { off = true; body = body.slice(mm[0].length); }
      mm = /^%\s*(\d+)\s*/.exec(body); if (mm) { chance = +mm[1]; body = body.slice(mm[0].length); }
      return { label: h.label, polite: h.polite, off, chance, text: body, s: parseStmt(body) };
    });
    const polite = st.filter(s => s.polite).length;
    if (st.length >= 5 && polite * 5 < st.length) fail('ICL079I PROGRAMMER IS INSUFFICIENTLY POLITE');
    if (st.length >= 5 && polite * 3 > st.length) fail('ICL099I PROGRAMMER IS OVERLY POLITE');
    const labels = new Map(); st.forEach((s, i) => { if (s.label) { if (labels.has(s.label)) fail('ICL182I YOU MUST LIKE THIS LABEL A LOT! (' + s.label + ')'); labels.set(s.label, i); } });
    const comeFrom = new Map(); st.forEach((s, i) => { if (s.s && s.s.k === 'comefrom') comeFrom.set(s.s.label, i); });
    const vars = new Map(), stash = new Map(), ignored = new Set(), next = [];
    let lastOut = 0, lastIn = 0;
    const gerunds = { CALCULATING: 'calc', NEXTING: 'next', RESUMING: 'resume', FORGETTING: 'forget', STASHING: 'stash', RETRIEVING: 'retrieve', IGNORING: 'ignore', REMEMBERING: 'remember', ABSTAINING: 'abstain', REINSTATING: 'reinstate', 'COMING FROM': 'comefrom', 'READING OUT': 'readout', 'WRITING IN': 'writein' };
    const name = v => v.t + v.n;
    const get = v => {
      if (v.t === ',' || v.t === ';') { const a = vars.get(name(v)); if (!a || !a.dims) fail('ICL241I VARIABLES MAY NOT BE STORED IN WEST HYPERSPACE (' + name(v) + ' has no size)'); const ix = v.sub.map(ev); const k = flat(a, ix); return a.data[k]; }
      return vars.get(name(v)) || 0;
    };
    const flat = (a, ix) => { if (ix.length !== a.dims.length) fail('ICL241I wrong number of subscripts'); let k = 0; ix.forEach((x, d) => { if (x < 1 || x > a.dims[d]) fail('ICL241I subscript ' + x + ' is out of range'); k = k * a.dims[d] + (x - 1); }); return k; };
    const width = e => e.k === 'mingle' ? 32 : e.k === 'sel' ? width(e.b) : e.k === 'un' ? width(e.e) : e.k === 'var' ? (e.v.t === ':' || e.v.t === ';' ? 32 : 16) : (e.k === 'num' ? 16 : 16);
    const unary = (op, x, w) => { const mask = w === 32 ? 0xFFFFFFFF : 0xFFFF; const y = ((x >>> 1) | ((x & 1) << (w - 1))) >>> 0; const r = op === '&' ? x & y : op === 'V' ? x | y : x ^ y; return (r & mask) >>> 0; };
    const ev = e => {
      switch (e.k) {
        case 'num': return e.n;
        case 'var': return get(e.v);
        case 'un': return unary(e.op, ev(e.e), width(e.e));
        case 'mingle': { const a = ev(e.a), b = ev(e.b); if (a > 0xFFFF || b > 0xFFFF) fail('ICL533I YOU WANT MAYBE WE SHOULD IMPLEMENT 64-BIT VARIABLES? (mingle needs 16-bit values)'); let r = 0; for (let i = 15; i >= 0; i--) r = r * 4 + ((a >> i) & 1) * 2 + ((b >> i) & 1); return r >>> 0; }
        case 'sel': { const a = ev(e.a), b = ev(e.b); let r = 0, bit = 0; for (let i = 31; i >= 0; i--) if ((b >>> i) & 1) { r = r * 2 + ((a >>> i) & 1); bit++; } return r >>> 0; }
      }
    };
    const set = (v, x) => {
      if (ignored.has(name(v))) return;
      if (v.t === '.') { if (x > 0xFFFF) fail('ICL275I DON\'T BYTE OFF MORE THAN YOU CAN CHEW (' + x + ' is too big for ' + name(v) + ')'); vars.set(name(v), x); }
      else if (v.t === ':') vars.set(name(v), x >>> 0);
      else { const a = vars.get(name(v)); if (!a || !a.dims) fail('ICL241I ' + name(v) + ' has no size yet'); const k = flat(a, v.sub.map(ev)); if (v.t === ',' && x > 0xFFFF) fail('ICL275I value too big for ' + name(v)); a.data[k] = x; }
    };
    const roman = n => {
      if (n === 0) return '_\n';
      const r = x => { const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, c] of t) while (x >= v) { s += c; x -= v; } return s; };
      if (n < 4000) return r(n) + '\n';
      const hi = r(Math.floor(n / 1000)), lo = r(n % 1000);
      return '_'.repeat(hi.length) + '\n' + hi + lo + '\n';
    };
    const rev8 = b => { let r = 0; for (let i = 0; i < 8; i++) r = (r << 1) | ((b >> i) & 1); return r; };
    const digits = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    let pc = 0;
    for (;;) {
      io.tick();
      if (pc >= st.length) fail('ICL633I PROGRAM FELL OFF THE EDGE');
      const S = st[pc], s = S.s; let to = pc + 1;
      const kind = s ? s.k : 'bad';
      if (!S.off && Math.random() * 100 < S.chance) {
        if (!s) fail('ICL000I ' + S.text);
        switch (s.k) {
          case 'calc': set(s.v, ev(s.e)); break;
          case 'dim': { const dims = s.dims.map(ev); if (dims.some(d => d < 1)) fail('ICL240I ERROR HANDLER PRINTED SNIDE REMARK (array size must be at least 1)'); if (!ignored.has(name(s.v))) vars.set(name(s.v), { dims, data: new Array(dims.reduce((a, b) => a * b, 1)).fill(0) }); break; }
          case 'next': { if (!labels.has(s.label)) fail('ICL129I PROGRAM HAS GOTTEN LOST (no label ' + s.label + ')'); if (next.length >= 80) fail('ICL123I PROGRAM HAS DISAPPEARED INTO THE BLACK LAGOON'); next.push(pc + 1); to = labels.get(s.label); break; }
          case 'resume': { const n = ev(s.e); if (!n) fail('ICL621I ERROR TYPE 621 ENCOUNTERED'); if (n > next.length) fail('ICL632I THE NEXT STACK RUPTURES. ALL DIE. OH, THE EMBARRASSMENT!'); let r = 0; for (let i = 0; i < n; i++) r = next.pop(); to = r; break; }
          case 'forget': { const n = ev(s.e); next.length = Math.max(0, next.length - n); break; }
          case 'stash': s.vs.forEach(v => { const k = name(v), val = vars.get(k); if (!stash.has(k)) stash.set(k, []); stash.get(k).push(val && val.dims ? { dims: val.dims.slice(), data: val.data.slice() } : val || 0); }); break;
          case 'retrieve': s.vs.forEach(v => { const k = name(v), a = stash.get(k); if (!a || !a.length) fail('ICL436I THROW STICK BEFORE RETRIEVING! (' + k + ')'); vars.set(k, a.pop()); }); break;
          case 'ignore': s.vs.forEach(v => ignored.add(name(v))); break;
          case 'remember': s.vs.forEach(v => ignored.delete(name(v))); break;
          case 'abstain': case 'reinstate': {
            const off = s.k === 'abstain';
            if (s.label) { if (!labels.has(s.label)) fail('ICL139I I WASN\'T PLANNING TO GO THERE ANYWAY (no label ' + s.label + ')'); st[labels.get(s.label)].off = off; }
            else st.forEach(x => { if (x.s && s.ger.includes(x.s.k === 'dim' ? 'calc' : x.s.k)) x.off = off; });
            break;
          }
          case 'giveup': return;
          case 'readout': s.es.forEach(e => {
            if (e.k === 'var' && (e.v.t === ',' || e.v.t === ';') && !e.v.sub.length) {
              const a = vars.get(name(e.v)); if (!a || !a.dims) fail('ICL241I ' + name(e.v) + ' has no size');
              a.data.forEach(x => { const c = rev8(((rev8(lastOut) - x) % 256 + 256) % 256); io.byte(c); lastOut = c; });
            } else io.out(roman(ev(e)));
          }); break;
          case 'writein': s.vs.forEach(v => {
            if ((v.t === ',' || v.t === ';') && !v.sub.length) {
              const a = vars.get(name(v)); if (!a || !a.dims) fail('ICL241I ' + name(v) + ' has no size');
              for (let i = 0; i < a.data.length; i++) { const c = io.getb(); if (c < 0) { a.data[i] = 256; continue; } a.data[i] = ((rev8(c) - rev8(lastIn)) % 256 + 256) % 256; lastIn = c; }
              return;
            }
            const line = io.getline(); if (line === null) fail('ICL562I I DO NOT COMPUTE (no input left)');
            const ws = line.trim().toUpperCase().split(/\s+/).filter(Boolean); let n = 0;
            ws.forEach(w => { let d = digits.indexOf(w); if (w === 'OH') d = 0; if (w === 'NINER') d = 9; if (d < 0) fail('ICL579I WHAT BASE AND/OR LANGUAGE INCLUDES ' + w + '?'); n = n * 10 + d; });
            set(v, n);
          }); break;
          case 'comefrom': break;
        }
      }
      void kind;
      if (S.label && comeFrom.has(S.label) && !st[comeFrom.get(S.label)].off && to === pc + 1) to = comeFrom.get(S.label);
      pc = to;
    }

    function parseStmt(t) {
      let i = 0;
      const ws = () => { while (t[i] === ' ') i++; };
      const word = w => { ws(); if (t.slice(i, i + w.length).toUpperCase() === w) { i += w.length; return true; } return false; };
      const num = () => { ws(); const m = /^\d+/.exec(t.slice(i)); if (!m) return null; i += m[0].length; return +m[0]; };
      const variable = () => {
        ws(); const c = t[i]; if (!'.:,;'.includes(c) || !c) return null; i++;
        const n = num(); if (n === null) return null;
        const v = { t: c, n, sub: [] };
        if ((c === ',' || c === ';') && word('SUB')) { for (;;) { const save = i; const e = operand(true); if (!e) { i = save; break; } v.sub.push(e); } }
        return v;
      };
      const UN = '&V?';
      const operand = inSub => {
        ws(); const c = t[i];
        if (c === "'" || c === '"') {
          i++; let u = null; ws(); if (UN.includes(t[i]) && t[i]) u = t[i++];
          const e = expr(c); ws(); if (t[i] !== c) return null; i++;
          return u ? { k: 'un', op: u, e } : e;
        }
        if (c === '#') { i++; let u = null; if (UN.includes(t[i]) && t[i]) u = t[i++]; const n = num(); if (n === null || n > 65535) return null; const e = { k: 'num', n }; return u ? { k: 'un', op: u, e } : e; }
        if ('.:,;'.includes(c) && c) {
          const save = i; i++; let u = null; if (UN.includes(t[i]) && t[i]) u = t[i++];
          const n = num(); if (n === null) { i = save; return null; }
          const v = { t: c, n, sub: [] };
          if ((c === ',' || c === ';') && !inSub && word('SUB')) { for (;;) { const s2 = i; const e = operand(true); if (!e) { i = s2; break; } v.sub.push(e); } }
          const e = { k: 'var', v }; return u ? { k: 'un', op: u, e } : e;
        }
        return null;
      };
      const expr = () => {
        let a = operand(); if (!a) return null;
        for (;;) { ws(); const c = t[i]; if (c === '$' || c === '¢' || c === '~') { i++; const b = operand(); if (!b) return null; a = { k: c === '~' ? 'sel' : 'mingle', a, b }; } else break; }
        return a;
      };
      const end = () => { ws(); return i >= t.length; };
      const list = () => { const vs = []; do { const v = variable(); if (!v) return null; vs.push(v); } while (word('+')); return vs; };
      const save0 = i;
      if (word('(')) { const n = num(); if (n !== null && word(')') && word('NEXT') && end()) return { k: 'next', label: n }; }
      i = save0;
      if (word('COME FROM')) { if (word('(')) { const n = num(); if (n !== null && word(')') && end()) return { k: 'comefrom', label: n }; } return null; }
      if (word('RESUME')) { const e = expr(); return e && end() ? { k: 'resume', e } : null; }
      if (word('FORGET')) { const e = expr(); return e && end() ? { k: 'forget', e } : null; }
      if (word('STASH')) { const vs = list(); return vs && end() ? { k: 'stash', vs } : null; }
      if (word('RETRIEVE')) { const vs = list(); return vs && end() ? { k: 'retrieve', vs } : null; }
      if (word('IGNORE')) { const vs = list(); return vs && end() ? { k: 'ignore', vs } : null; }
      if (word('REMEMBER')) { const vs = list(); return vs && end() ? { k: 'remember', vs } : null; }
      if (word('GIVE UP')) return end() ? { k: 'giveup' } : null;
      if (word('READ OUT')) { const es = []; do { const e = operand(); if (!e) return null; es.push(e); } while (word('+')); return end() ? { k: 'readout', es } : null; }
      if (word('WRITE IN')) { const vs = list(); return vs && end() ? { k: 'writein', vs } : null; }
      for (const k of ['ABSTAIN FROM', 'REINSTATE']) if (word(k)) {
        const kk = k === 'REINSTATE' ? 'reinstate' : 'abstain';
        if (word('(')) { const n = num(); return n !== null && word(')') && end() ? { k: kk, label: n } : null; }
        const ger = []; do { ws(); const g = Object.keys(gerunds).find(x => t.slice(i, i + x.length).toUpperCase() === x); if (!g) return null; i += g.length; ger.push(gerunds[g]); } while (word('+'));
        return end() ? { k: kk, ger } : null;
      }
      i = save0;
      const v = variable();
      if (v && word('<-')) {
        if ((v.t === ',' || v.t === ';') && !v.sub.length) { const dims = []; do { const e = operand(); if (!e) return null; dims.push(e); } while (word('BY')); return end() ? { k: 'dim', v, dims } : null; }
        const e = expr(); return e && end() ? { k: 'calc', v, e } : null;
      }
      return null;
    }
  };

  /* =================== Shakespeare Programming Language =================== */
  const SPL = {
    pos: 'heaven king lord angel flower happiness joy plum hero rose kingdom pony',
    neu: 'animal aunt brother cat chihuahua cousin cow daughter door face father fellow granddaughter grandfather grandmother grandson hair hamster horse lamp lantern mistletoe moon morning mother nephew niece nose purse road roman sister sky son squirrel thing town tree uncle wind',
    neg: 'hell microsoft bastard beggar blister codpiece coward curse death devil draught famine flirt-gill goat hate hog hound leech lie pig plague starvation toad war wolf',
    padj: 'amazing beautiful blossoming bold brave charming clearest cunning cute delicious embroidered fair fine gentle golden good handsome happy healthy honest lovely loving mighty noble peaceful pretty prompt proud reddest rich smooth sunny sweet sweetest trustworthy warm',
    nadj: 'big black blue bluest bottomless furry green hard huge large little normal old purple red rural small tiny white yellow',
    gadj: 'bad cowardly cursed damned dirty disgusting distasteful dusty evil fat fat-kidneyed fatherless foul hairy half-witted horrible horrid infected lying miserable misused oozing rotten smelly snotty sorry stinking stuffed stupid vile villainous worried',
  };
  const set = s => new Set(s.split(' '));
  const SPOS = set(SPL.pos + ' summer\'s-day'), SNEU = set(SPL.neu + ' stone-wall'), SNEG = set(SPL.neg), SADJ = set(SPL.padj + ' ' + SPL.nadj + ' ' + SPL.gadj);
  const ROMAN = s => { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let n = 0; s = s.toUpperCase(); for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n; };
  L.spl = (code, io) => {
    let text = code.replace(/\r/g, '');
    const dot = text.indexOf('.'); if (dot < 0) fail('A play starts with its title, ending in a full stop.');
    text = text.slice(dot + 1);
    const firstAct = text.search(/\bAct\s+[IVXLCDM]+\s*:/i); if (firstAct < 0) fail('The play needs at least one "Act I:".');
    const cast = new Map();
    text.slice(0, firstAct).split('.').forEach(p => { const c = p.indexOf(','); if (c > 0) { const nm = p.slice(0, c).trim().replace(/\s+/g, ' '); if (nm) cast.set(nm.toLowerCase(), { name: nm, v: 0, st: [] }); } });
    if (!cast.size) fail('List the characters before Act I, as "Name, description."');
    const names = [...cast.keys()].sort((a, b) => b.length - a.length);
    const body = text.slice(firstAct);
    /* acts and scenes, then events: enter/exit/line */
    const acts = [], events = [];
    const tokRe = /\b(Act|Scene)\s+([IVXLCDM]+)\s*:[^.!?]*[.!?]|\[([^\]]*)\]|([A-Za-z][A-Za-z' -]*?)\s*:/gi;
    let m, last = 0, speaker = null;
    const flushLine = upto => { if (speaker !== null) { const t = body.slice(last, upto).trim(); if (t) events.push({ k: 'line', who: speaker, text: t }); } };
    while ((m = tokRe.exec(body))) {
      if (m[4] && !cast.has(m[4].trim().replace(/\s+/g, ' ').toLowerCase())) continue;
      flushLine(m.index); speaker = null;
      if (m[1]) {
        if (/^act$/i.test(m[1])) acts.push({ n: ROMAN(m[2]), scenes: [], at: events.length });
        else { if (!acts.length) fail('A scene appears before any act.'); acts[acts.length - 1].scenes.push({ n: ROMAN(m[2]), at: events.length }); }
      } else if (m[3] !== undefined) {
        const d = m[3].trim(), mm = /^(enter|exit|exeunt)\b\s*(.*)$/i.exec(d);
        if (mm) events.push({ k: mm[1].toLowerCase(), who: who(mm[2]) });
      } else speaker = m[4].trim().replace(/\s+/g, ' ').toLowerCase();
      last = tokRe.lastIndex;
    }
    flushLine(body.length);
    function who(s) { const out = []; s = ' ' + s.replace(/,|\band\b/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase() + ' '; for (const nm of names) if (s.includes(' ' + nm + ' ')) { out.push(nm); s = s.replace(' ' + nm + ' ', ' '); } if (s.trim()) fail('Unknown character in a stage direction: ' + s.trim() + '.'); return out; }
    const stage = new Set(); let flag = null, actIx = 0;
    const listener = sp => { const others = [...stage].filter(x => x !== sp); if (others.length !== 1) fail('"' + cast.get(sp).name + '" speaks to "you", but ' + (others.length ? 'more than one other character is' : 'nobody else is') + ' on stage.'); return others[0]; };
    const value = (tk, sp) => {
      let i = 0;
      const peek = () => tk[i], next = () => tk[i++];
      const is = (...w) => w.every((x, k) => tk[i + k] === x);
      const val = () => {
        if (i >= tk.length) fail('A value is missing.');
        for (const nm of names) { const w = nm.split(' '); if (w.every((x, k) => tk[i + k] === x)) { i += w.length; return cast.get(nm).v; } }
        const t = next();
        if (t === 'me' || t === 'myself' || t === 'i') return cast.get(sp).v;
        if (t === 'you' || t === 'yourself' || t === 'thee' || t === 'thou') return cast.get(listener(sp)).v;
        if (t === 'nothing' || t === 'zero') return 0;
        if (t === 'twice') return 2 * val();
        if (/^-?\d+$/.test(t)) return +t;
        if (t === 'the') {
          if (is('sum', 'of')) { i += 2; const a = val(); if (next() !== 'and') fail('"the sum of" needs "and".'); return a + val(); }
          if (is('difference', 'between')) { i += 2; const a = val(); if (next() !== 'and') fail('"the difference between" needs "and".'); return a - val(); }
          if (is('product', 'of')) { i += 2; const a = val(); if (next() !== 'and') fail('"the product of" needs "and".'); return a * val(); }
          if (is('quotient', 'between')) { i += 2; const a = val(); if (next() !== 'and') fail('"the quotient between" needs "and".'); const b = val(); if (!b) fail('Division by zero.'); return Math.trunc(a / b); }
          if (is('remainder', 'of', 'the', 'quotient', 'between')) { i += 5; const a = val(); if (next() !== 'and') fail('"the remainder of the quotient between" needs "and".'); const b = val(); if (!b) fail('Division by zero.'); return a % b; }
          if (is('square', 'root', 'of')) { i += 3; return Math.floor(Math.sqrt(Math.abs(val()))); }
          if (is('square', 'of')) { i += 2; const a = val(); return a * a; }
          if (is('cube', 'of')) { i += 2; const a = val(); return a * a * a; }
          if (is('factorial', 'of')) { i += 2; let a = val(), r = 1; while (a > 1) r *= a--; return r; }
        }
        let k = 0;
        if (!/^(a|an|the|my|your|his|her|their|our|thy|mine)$/.test(t)) i--;
        while (i < tk.length && SADJ.has(peek())) { i++; k++; }
        let n = next(); if (n === undefined) fail('A noun is missing.');
        if ((n === 'summer\'s' && peek() === 'day') || (n === 'stone' && peek() === 'wall')) n += '-' + next();
        if (SPOS.has(n) || SNEU.has(n)) return 2 ** k;
        if (SNEG.has(n)) return -(2 ** k);
        fail('"' + n + '" is not a word the Shakespeare language knows (nouns like king, flower, cat or pig).');
      };
      const v = val();
      if (i < tk.length) fail('Unexpected words after a value: "' + tk.slice(i).join(' ') + '".');
      return v;
    };
    const words = s => s.toLowerCase().replace(/[,;]/g, ' ').trim().split(/\s+/).filter(Boolean);
    const jump = (kind, n) => {
      if (kind === 'act') { const a = acts.findIndex(x => x.n === n); if (a < 0) fail('There is no Act ' + n + '.'); actIx = a; return acts[a].at; }
      const sc = acts[actIx].scenes.find(x => x.n === n); if (!sc) fail('There is no Scene ' + n + ' in this act.'); return sc.at;
    };
    const sentence = (s, sp) => {
      s = s.trim(); if (!s) return null;
      const mark = s.slice(-1), t = s.replace(/[.!?]$/, '').trim(), lt = t.toLowerCase();
      let mm;
      if ((mm = /^if (so|not),\s*(.*)$/i.exec(t))) { if (flag === null) fail('"If ' + mm[1] + '" comes before any question.'); if ((mm[1].toLowerCase() === 'so') !== flag) return null; return sentence(mm[2] + mark, sp); }
      if (mark === '?') {
        mm = /^(?:am i|are you|art thou|is [a-z' -]+?|are [a-z' -]+?)\s+(not\s+)?(as \S+ as|more \S+ than|less \S+ than|better than|bigger than|fresher than|friendlier than|nicer than|jollier than|worse than|punier than|smaller than)\s+(.+)$/i.exec(lt);
        if (!mm) fail('A question the play cannot follow: "' + s + '"');
        const head = lt.slice(0, lt.length - mm[0].length + lt.indexOf(mm[0]) * 0).replace(/^(am i|are you|art thou)\b.*$/, '$1');
        let left;
        if (/^am i/.test(lt)) left = cast.get(sp).v; else if (/^(are you|art thou)/.test(lt)) left = cast.get(listener(sp)).v;
        else { const sub = /^(?:is|are)\s+(.+?)\s+(?:not\s+)?(?:as \S+ as|more \S+ than|less \S+ than|better than|bigger than|fresher than|friendlier than|nicer than|jollier than|worse than|punier than|smaller than)\s/.exec(lt + ' '); left = value(words(sub[1]), sp); }
        void head;
        const right = value(words(mm[3]), sp), c = mm[2];
        let r = /^as/.test(c) ? left === right : /^(more|better|bigger|fresher|friendlier|nicer|jollier)/.test(c) ? left > right : left < right;
        if (mm[1]) r = !r; flag = r; return null;
      }
      if ((mm = /^(?:let us|we shall|we must)\s+(?:proceed|return)\s+to\s+(act|scene)\s+([ivxlcdm]+)$/i.exec(t))) return jump(mm[1].toLowerCase(), ROMAN(mm[2]));
      if (/^speak (your|thy) mind$/i.test(t)) { io.out(chr(cast.get(listener(sp)).v)); return null; }
      if (/^open (your|thy) heart$/i.test(t)) { io.out(String(cast.get(listener(sp)).v)); return null; }
      if (/^listen to (your|thy) heart$/i.test(t)) { const n = io.getn(); cast.get(listener(sp)).v = n === null ? 0 : n; return null; }
      if (/^open (your|thy) mind$/i.test(t)) { cast.get(listener(sp)).v = io.getc(); return null; }
      if ((mm = /^remember (.+)$/i.exec(t))) { cast.get(listener(sp)).st.push(value(words(mm[1]), sp)); return null; }
      if (/^recall\b/i.test(t)) { const c = cast.get(listener(sp)); if (!c.st.length) fail(c.name + ' has nothing to recall.'); c.v = c.st.pop(); return null; }
      if ((mm = /^(?:you|thou)\s+(?:are|art)?\s*(?:as \S+ as\s+)?(.+)$/i.exec(t))) { cast.get(listener(sp)).v = value(words(mm[1]), sp); return null; }
      fail('A line the play cannot follow: "' + s + '"');
    };
    for (let ev = 0; ev < events.length;) {
      io.tick();
      const e = events[ev++];
      if (acts[actIx + 1] && ev > acts[actIx + 1].at) actIx++;
      if (e.k === 'enter') { e.who.forEach(w => { if (stage.has(w)) fail(cast.get(w).name + ' is already on stage.'); stage.add(w); }); continue; }
      if (e.k === 'exit') { e.who.forEach(w => stage.delete(w)); continue; }
      if (e.k === 'exeunt') { if (e.who.length) e.who.forEach(w => stage.delete(w)); else stage.clear(); continue; }
      if (!stage.has(e.who)) fail(cast.get(e.who).name + ' speaks but is not on stage.');
      const parts = e.text.match(/[^.!?]+[.!?]/g) || [];
      let jumped = null;
      for (const p of parts) { const r = sentence(p, e.who); if (r !== null && r !== undefined) { jumped = r; break; } }
      if (jumped !== null) { ev = jumped; actIx = acts.reduce((a, x, k) => x.at <= jumped ? k : a, 0); }
    }
  };

  /* =================== Chef =================== */
  L.chef = (code, io) => {
    const recipes = new Map(); let main = null;
    const chunks = code.replace(/\r/g, '').split(/\n\s*\n/).map(c => c.trim()).filter(Boolean);
    let cur = null;
    for (const ch of chunks) {
      const first = ch.split('\n')[0];
      if (/^ingredients\.?$/i.test(first)) { if (!cur) fail('Ingredients come after a recipe title.'); cur.ing = ch.split('\n').slice(1).map(parseIng); continue; }
      if (/^method\.?$/i.test(first)) { if (!cur) fail('The method comes after a recipe title.'); cur.method = ch.split('\n').slice(1).join(' ').split('.').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean); continue; }
      if (/^(cooking time|pre-heat oven)/i.test(first)) continue;
      if (/^serves\s+\d+/i.test(first)) { if (cur) cur.serves = +/\d+/.exec(first)[0]; continue; }
      if (cur && !cur.method && !cur.ing && !/\.$/.test(first)) continue;
      if (/\.$/.test(first) && (!cur || cur.method)) { cur = { title: first.replace(/\.$/, '').trim(), ing: [], method: null, serves: 0 }; recipes.set(cur.title.toLowerCase(), cur); if (!main) main = cur; continue; }
    }
    if (!main || !main.method) fail('A recipe needs a title, an "Ingredients." list and a "Method." list.');
    function parseIng(l) {
      const mm = /^\s*(\d+)?\s*(?:(heaped|level)\s+)?(?:(g|kg|pinch|pinches|ml|l|dash|dashes|cup|cups|teaspoon|teaspoons|tablespoon|tablespoons)\s+)?(.+?)\s*$/i.exec(l);
      const unit = (mm[3] || '').toLowerCase();
      return { name: mm[4].toLowerCase(), v: mm[1] === undefined ? null : +mm[1], liquid: /^(ml|l|dash|dashes)$/.test(unit) };
    }
    const ord = s => s ? parseInt(s, 10) : 1;
    const runRecipe = (r, bowls, dishes, depth) => {
      if (depth > 50) fail('Too many recipes inside recipes.');
      const ing = new Map(r.ing.map(x => [x.name, { v: x.v, liquid: x.liquid }]));
      const bowl = n => { while (bowls.length < n) bowls.push([]); return bowls[n - 1]; };
      const dish = n => { while (dishes.length < n) dishes.push([]); return dishes[n - 1]; };
      const I = n => { const x = ing.get(n.toLowerCase().trim()); if (!x) fail('"' + n + '" is not in the ingredients of ' + r.title + '.'); return x; };
      const val = n => { const x = I(n); if (x.v === null) fail('"' + n + '" has no amount yet.'); return x.v; };
      const top = b => { if (!b.length) fail('The mixing bowl is empty.'); return b[b.length - 1]; };
      const M = r.method, loops = [];
      const verbOf = s => s.toLowerCase().replace(/e?d$/, '').replace(/(.)\1$/, '$1').replace(/i$/, 'y');
      const stem = w => w.toLowerCase().replace(/e$/, '').replace(/(.)\1$/, '$1').replace(/y$/, 'i');
      for (let pc = 0; pc < M.length; pc++) {
        io.tick();
        const s = M[pc]; let m;
        const B = '(?:\\s+(?:to|into|from)\\s+(?:the\\s+)?(?:(\\d+)(?:st|nd|rd|th)\\s+)?mixing bowl)?';
        if ((m = /^take (.+) from (?:the )?refrigerator$/i.exec(s))) { const n = io.getn(); I(m[1]).v = n === null ? 0 : n; }
        else if ((m = new RegExp('^put (.+?) into (?:the )?(?:(\\d+)(?:st|nd|rd|th) )?mixing bowl$', 'i').exec(s))) { const x = I(m[1]); bowl(ord(m[2])).push({ v: val(m[1]), liquid: x.liquid }); }
        else if ((m = new RegExp('^fold (.+?) into (?:the )?(?:(\\d+)(?:st|nd|rd|th) )?mixing bowl$', 'i').exec(s))) { const b = bowl(ord(m[2])); if (!b.length) fail('Cannot fold from an empty bowl.'); const t = b.pop(); I(m[1]).v = t.v; }
        else if ((m = new RegExp('^add dry ingredients' + B + '$', 'i').exec(s))) { let sum = 0; ing.forEach(x => { if (!x.liquid && x.v !== null) sum += x.v; }); bowl(ord(m[1])).push({ v: sum, liquid: false }); }
        else if ((m = new RegExp('^(add|remove|combine|divide) (.+?)' + B + '$', 'i').exec(s))) { const b = bowl(ord(m[3])), t = top(b), v = val(m[2]), op = m[1].toLowerCase(); if (op === 'add') t.v += v; else if (op === 'remove') t.v -= v; else if (op === 'combine') t.v *= v; else { if (!v) fail('Division by zero.'); t.v = Math.trunc(t.v / v); } }
        else if ((m = /^liqu[ei]fy contents of (?:the )?(?:(\d+)(?:st|nd|rd|th) )?mixing bowl$/i.exec(s))) bowl(ord(m[1])).forEach(x => { x.liquid = true; });
        else if ((m = /^liqu[ei]fy (.+)$/i.exec(s))) I(m[1]).liquid = true;
        else if ((m = /^stir (?:(?:the )?(?:(\d+)(?:st|nd|rd|th) )?mixing bowl )?for (\d+) minutes?$/i.exec(s)) || (m = /^stir (.+?) into (?:the )?(?:(\d+)(?:st|nd|rd|th) )?mixing bowl$/i.exec(s))) {
          const byIng = /into/i.test(s), b = bowl(ord(byIng ? m[2] : m[1])), n = byIng ? val(m[1]) : +m[2];
          if (b.length) { const t = b.pop(), at = Math.max(0, b.length - n); b.splice(at, 0, t); }
        }
        else if ((m = /^mix (?:(?:the )?(?:(\d+)(?:st|nd|rd|th) )?mixing bowl )?well$/i.exec(s))) { const b = bowl(ord(m[1])); for (let k = b.length - 1; k > 0; k--) { const j = Math.random() * (k + 1) | 0; [b[k], b[j]] = [b[j], b[k]]; } }
        else if ((m = /^clean (?:the )?(?:(\d+)(?:st|nd|rd|th) )?mixing bowl$/i.exec(s))) bowl(ord(m[1])).length = 0;
        else if ((m = /^pour contents of (?:the )?(?:(\d+)(?:st|nd|rd|th) )?mixing bowl into (?:the )?(?:(\d+)(?:st|nd|rd|th) )?baking dish$/i.exec(s))) dish(ord(m[2])).push(...bowl(ord(m[1])).map(x => ({ ...x })));
        else if ((m = /^set aside$/i.exec(s))) { const lp = loops.pop(); if (!lp) fail('"Set aside" is not inside a loop.'); pc = lp.end; }
        else if ((m = /^serve with (.+)$/i.exec(s))) {
          const sub = recipes.get(m[1].toLowerCase().trim()); if (!sub) fail('There is no recipe called "' + m[1] + '".');
          const b2 = bowls.map(b => b.map(x => ({ ...x }))), d2 = dishes.map(d => d.map(x => ({ ...x })));
          runRecipe(sub, b2, d2, depth + 1);
          bowl(1).push(...(b2[0] || []));
        }
        else if ((m = /^refrigerate(?: for (\d+) hours?)?$/i.exec(s))) { if (m[1]) serve(dishes, +m[1]); return; }
        else if ((m = /^(\w+)(?: the (.+?))? until (\w+)$/i.exec(s))) {
          const lp = loops[loops.length - 1]; if (!lp || stem(lp.verb) !== stem(verbOf(m[3]))) fail('"' + s + '" does not close the loop "' + (lp ? lp.verb : '?') + '".');
          if (m[2]) I(m[2]).v--;
          pc = lp.start - 1; loops.pop();
        }
        else if ((m = /^(\w+) (?:the )?(.+)$/i.exec(s)) && ing.has(m[2].toLowerCase())) {
          if (val(m[2]) === 0) { let d = 0, k = pc + 1; for (; k < M.length; k++) { if (/ until \w+$/i.test(M[k])) { if (d === 0) break; d--; } else if (/^(\w+) (?:the )?(.+)$/i.test(M[k]) && ing.has(/^(\w+) (?:the )?(.+)$/i.exec(M[k])[2].toLowerCase()) && !/^(put|fold|add|remove|combine|divide|liqu[ei]fy|take|stir)\b/i.test(M[k])) d++; } pc = k; }
          else { let d = 0, k = pc + 1; for (; k < M.length; k++) { if (/ until \w+$/i.test(M[k])) { if (d === 0) break; d--; } else if (/^(\w+) (?:the )?(.+)$/i.test(M[k]) && ing.has(/^(\w+) (?:the )?(.+)$/i.exec(M[k])[2].toLowerCase()) && !/^(put|fold|add|remove|combine|divide|liqu[ei]fy|take|stir)\b/i.test(M[k])) d++; } loops.push({ verb: m[1], start: pc, end: k }); }
        }
        else fail('A method step Chef does not know: "' + s + '."');
      }
      if (r.serves) serve(dishes, r.serves);
    };
    function serve(dishes, n) { for (let k = 0; k < Math.min(n, dishes.length); k++) { const d = dishes[k]; for (let j = d.length - 1; j >= 0; j--) io.out(d[j].liquid ? chr(d[j].v) : d[j].v + ' '); } }
    runRecipe(main, [[]], [[]], 0);
  };

  /* =================== LOLCODE 1.2 =================== */
  L.lolcode = (code, io) => {
    const src = code.replace(/\r/g, '').replace(/\bOBTW\b[\s\S]*?\bTLDR\b/g, ' ');
    /* split into statements of tokens; strings are kept whole */
    const stmts = [];
    src.split('\n').forEach((line, ln) => {
      let cur = [], i = 0;
      const push = () => { if (cur.length) stmts.push({ t: cur, ln: ln + 1 }); cur = []; };
      while (i < line.length) {
        const c = line[i];
        if (c === ' ' || c === '\t') { i++; continue; }
        if (c === ',') { push(); i++; continue; }
        if (c === '"') { let j = i + 1, s = ''; while (j < line.length && line[j] !== '"') { if (line[j] === ':' && j + 1 < line.length) { s += line[j] + line[j + 1]; j += 2; } else s += line[j++]; } if (j >= line.length) fail('Line ' + (ln + 1) + ': a YARN has no closing quote.'); cur.push({ s }); i = j + 1; continue; }
        let j = i; while (j < line.length && !/[\s,"]/.test(line[j])) j++;
        const w = line.slice(i, j); i = j;
        if (w === 'BTW') break;
        cur.push(w);
      }
      push();
    });
    let k = 0;
    const peekW = (...ws) => { const t = stmts[k] && stmts[k].t; return t && ws.every((w, n) => t[n] === w); };
    if (!peekW('HAI')) fail('A LOLCODE program starts with HAI.');
    k++;
    const parseBlock = ends => {
      const out = [];
      while (k < stmts.length) {
        if (ends.some(e => peekW(...e.split(' ')))) return out;
        out.push(parseStmt());
      }
      if (ends.length && !ends.includes('KTHXBYE')) fail('A block is missing its end (' + ends.join(' or ') + ').');
      return out;
    };
    const parseStmt = () => {
      const S = stmts[k++], t = S.t, ln = S.ln;
      const at = (n, ...ws) => ws.every((w, i) => t[n + i] === w);
      if (at(0, 'I', 'HAS', 'A')) { const node = { k: 'decl', name: t[3], ln }; if (t[4] === 'ITZ') { if (t[5] === 'A') node.type = t[6]; else node.e = parseExpr(t, 5, ln).e; } return node; }
      if (t[0] === 'VISIBLE') { let rest = t.slice(1), nl = true; if (rest[rest.length - 1] === '!') { nl = false; rest = rest.slice(0, -1); } const es = []; let i = 0; while (i < rest.length) { if (rest[i] === 'AN') { i++; continue; } const r = parseExpr(rest, i, ln); es.push(r.e); i = r.i; } return { k: 'visible', es, nl, ln }; }
      if (t[0] === 'GIMMEH') return { k: 'gimmeh', name: t[1], ln };
      if (at(0, 'O', 'RLY?')) {
        if (!peekW('YA', 'RLY')) fail('Line ' + ln + ': O RLY? needs YA RLY.');
        k++; const yes = parseBlock(['MEBBE', 'NO WAI', 'OIC']), mebbe = [];
        while (peekW('MEBBE')) { const c = stmts[k++]; mebbe.push({ e: parseExpr(c.t, 1, c.ln).e, b: parseBlock(['MEBBE', 'NO WAI', 'OIC']) }); }
        let no = null; if (peekW('NO', 'WAI')) { k++; no = parseBlock(['OIC']); }
        k++; return { k: 'if', yes, mebbe, no, ln };
      }
      if (t[0] === 'WTF?') {
        const cases = []; let dflt = null;
        while (peekW('OMG')) { const c = stmts[k++]; cases.push({ v: parseExpr(c.t, 1, c.ln).e, b: parseBlock(['OMG', 'OMGWTF', 'OIC']) }); }
        if (peekW('OMGWTF')) { k++; dflt = parseBlock(['OIC']); }
        k++; return { k: 'switch', cases, dflt, ln };
      }
      if (at(0, 'IM', 'IN', 'YR')) {
        const node = { k: 'loop', label: t[3], ln }; let i = 4;
        if (t[i] === 'UPPIN' || t[i] === 'NERFIN') { node.step = t[i] === 'UPPIN' ? 1 : -1; if (t[i + 1] !== 'YR') fail('Line ' + ln + ': ' + t[i] + ' needs YR.'); node.var = t[i + 2]; i += 3; }
        if (t[i] === 'TIL' || t[i] === 'WILE') { node.til = t[i] === 'TIL'; node.cond = parseExpr(t, i + 1, ln).e; }
        node.body = parseBlock(['IM OUTTA YR ' + node.label]); k++; return node;
      }
      if (at(0, 'HOW', 'IZ', 'I')) {
        const node = { k: 'func', name: t[3], args: [], ln };
        for (let i = 4; i < t.length; i++) if (t[i] === 'YR') node.args.push(t[++i]);
        node.body = parseBlock(['IF U SAY SO']); k++; return node;
      }
      if (at(0, 'FOUND', 'YR')) return { k: 'return', e: parseExpr(t, 2, ln).e, ln };
      if (t[0] === 'GTFO') return { k: 'break', ln };
      if (t[0] === 'KTHXBYE') return { k: 'end', ln };
      if (t[1] === 'R') return { k: 'assign', name: t[0], e: parseExpr(t, 2, ln).e, ln };
      if (at(1, 'IS', 'NOW', 'A')) return { k: 'cast', name: t[0], type: t[4], ln };
      const r = parseExpr(t, 0, ln); return { k: 'expr', e: r.e, ln };
    };
    const BIN = { 'SUM OF': '+', 'DIFF OF': '-', 'PRODUKT OF': '*', 'QUOSHUNT OF': '/', 'MOD OF': '%', 'BIGGR OF': 'max', 'SMALLR OF': 'min', 'BOTH OF': 'and', 'EITHER OF': 'or', 'WON OF': 'xor', 'BOTH SAEM': '==', 'DIFFRINT': '!=' };
    const parseExpr = (t, i, ln) => {
      const w = t[i];
      if (w === undefined) fail('Line ' + ln + ': an expression is missing.');
      if (typeof w === 'object') return { e: { k: 'str', s: w.s }, i: i + 1 };
      const two = w + ' ' + t[i + 1];
      const op = BIN[two] ? two : BIN[w] ? w : null;
      if (op) {
        const a = parseExpr(t, i + op.split(' ').length, ln); let j = a.i; if (t[j] === 'AN') j++;
        const b = parseExpr(t, j, ln); return { e: { k: 'bin', op: BIN[op], a: a.e, b: b.e }, i: b.i };
      }
      if (w === 'NOT') { const a = parseExpr(t, i + 1, ln); return { e: { k: 'not', a: a.e }, i: a.i }; }
      if (two === 'ALL OF' || two === 'ANY OF' || w === 'SMOOSH') {
        let j = i + (w === 'SMOOSH' ? 1 : 2); const es = [];
        while (j < t.length && t[j] !== 'MKAY') { if (t[j] === 'AN') { j++; continue; } const r = parseExpr(t, j, ln); es.push(r.e); j = r.i; }
        if (t[j] === 'MKAY') j++;
        return { e: { k: w === 'SMOOSH' ? 'smoosh' : two === 'ALL OF' ? 'all' : 'any', es }, i: j };
      }
      if (w === 'MAEK') { const a = parseExpr(t, i + 1, ln); let j = a.i; if (t[j] === 'A') j++; return { e: { k: 'maek', a: a.e, type: t[j] }, i: j + 1 }; }
      if (w === 'I' && t[i + 1] === 'IZ') {
        const name = t[i + 2]; let j = i + 3; const args = [];
        while (j < t.length && t[j] !== 'MKAY') { if (t[j] === 'YR' || t[j] === 'AN') { j++; continue; } const r = parseExpr(t, j, ln); args.push(r.e); j = r.i; }
        if (t[j] === 'MKAY') j++;
        return { e: { k: 'call', name, args }, i: j };
      }
      if (/^-?\d+$/.test(w)) return { e: { k: 'num', v: parseInt(w, 10) }, i: i + 1 };
      if (/^-?\d*\.\d+$/.test(w)) return { e: { k: 'num', v: parseFloat(w), f: true }, i: i + 1 };
      if (w === 'WIN' || w === 'FAIL') return { e: { k: 'bool', v: w === 'WIN' }, i: i + 1 };
      if (w === 'NOOB') return { e: { k: 'noob' }, i: i + 1 };
      if (/^[A-Za-z_]\w*$/.test(w)) return { e: { k: 'var', name: w }, i: i + 1 };
      fail('Line ' + ln + ': "' + w + '" is not understood.');
    };
    const prog = parseBlock(['KTHXBYE']);
    /* values: {t:'NUMBR'|'NUMBAR'|'YARN'|'TROOF'|'NOOB', v} */
    const NOOB = { t: 'NOOB', v: null };
    const num = (x, ln) => {
      if (x.t === 'NUMBR' || x.t === 'NUMBAR') return x;
      if (x.t === 'TROOF') return { t: 'NUMBR', v: x.v ? 1 : 0 };
      if (x.t === 'YARN') { if (/^-?\d+$/.test(x.v.trim())) return { t: 'NUMBR', v: parseInt(x.v, 10) }; if (/^-?\d*\.\d+$/.test(x.v.trim())) return { t: 'NUMBAR', v: parseFloat(x.v) }; fail('Line ' + ln + ': "' + x.v + '" is not a number.'); }
      if (x.t === 'NOOB') fail('Line ' + ln + ': NOOB cannot be used as a number.');
      return x;
    };
    const troof = x => x.t === 'TROOF' ? x.v : x.t === 'NOOB' ? false : x.t === 'YARN' ? x.v !== '' : x.v !== 0;
    const yarn = x => x.t === 'YARN' ? x.v : x.t === 'NUMBAR' ? (Math.trunc(x.v * 100) / 100).toFixed(2) : x.t === 'NUMBR' ? String(x.v) : x.t === 'TROOF' ? (x.v ? 'WIN' : 'FAIL') : '';
    const cast = (x, type, ln) => {
      switch (type) {
        case 'TROOF': return { t: 'TROOF', v: troof(x) };
        case 'YARN': return { t: 'YARN', v: yarn(x) };
        case 'NUMBR': return x.t === 'NOOB' ? { t: 'NUMBR', v: 0 } : { t: 'NUMBR', v: Math.trunc(num(x, ln).v) };
        case 'NUMBAR': return x.t === 'NOOB' ? { t: 'NUMBAR', v: 0 } : { t: 'NUMBAR', v: num(x, ln).v };
        case 'NOOB': return NOOB;
      }
      fail('Line ' + ln + ': unknown type ' + type + '.');
    };
    const funcs = new Map();
    class Brk { } class Ret { constructor(v) { this.v = v; } }
    const interp = (s, sc) => s.replace(/:\)|:>|:o|:"|::|:\(([0-9A-Fa-f]+)\)|:\{(\w+)\}/g, (m, hex, vn) => m === ':)' ? '\n' : m === ':>' ? '\t' : m === ':o' ? '\x07' : m === ':"' ? '"' : m === '::' ? ':' : hex ? String.fromCodePoint(parseInt(hex, 16)) : yarn(look(sc, vn, 0)));
    const look = (sc, name, ln) => { for (let s = sc; s; s = s.up) if (s.v.has(name)) return s.v.get(name); fail('Line ' + ln + ': ' + name + ' has not been declared (I HAS A ' + name + ').'); };
    const setv = (sc, name, val, ln) => { for (let s = sc; s; s = s.up) if (s.v.has(name)) { s.v.set(name, val); return; } fail('Line ' + ln + ': ' + name + ' has not been declared.'); };
    const ev = (e, sc, ln) => {
      switch (e.k) {
        case 'str': return { t: 'YARN', v: interp(e.s, sc) };
        case 'num': return { t: e.f ? 'NUMBAR' : 'NUMBR', v: e.v };
        case 'bool': return { t: 'TROOF', v: e.v };
        case 'noob': return NOOB;
        case 'var': return e.name === 'IT' ? (sc.it || NOOB) : look(sc, e.name, ln);
        case 'not': return { t: 'TROOF', v: !troof(ev(e.a, sc, ln)) };
        case 'smoosh': return { t: 'YARN', v: e.es.map(x => yarn(ev(x, sc, ln))).join('') };
        case 'all': return { t: 'TROOF', v: e.es.every(x => troof(ev(x, sc, ln))) };
        case 'any': return { t: 'TROOF', v: e.es.some(x => troof(ev(x, sc, ln))) };
        case 'maek': return cast(ev(e.a, sc, ln), e.type, ln);
        case 'call': {
          const f = funcs.get(e.name); if (!f) fail('Line ' + ln + ': there is no function ' + e.name + '.');
          if (f.args.length !== e.args.length) fail('Line ' + ln + ': ' + e.name + ' takes ' + f.args.length + ' arguments.');
          const fs = { v: new Map(), up: global, it: NOOB }; f.args.forEach((a, n) => fs.v.set(a, ev(e.args[n], sc, ln)));
          try { runBlock(f.body, fs); } catch (x) { if (x instanceof Ret) return x.v; if (x instanceof Brk) return NOOB; throw x; }
          return fs.it || NOOB;
        }
        case 'bin': {
          const a = ev(e.a, sc, ln), b = ev(e.b, sc, ln);
          if (e.op === 'and') return { t: 'TROOF', v: troof(a) && troof(b) };
          if (e.op === 'or') return { t: 'TROOF', v: troof(a) || troof(b) };
          if (e.op === 'xor') return { t: 'TROOF', v: troof(a) !== troof(b) };
          if (e.op === '==' || e.op === '!=') {
            let same;
            if ((a.t === 'NUMBR' || a.t === 'NUMBAR') && (b.t === 'NUMBR' || b.t === 'NUMBAR')) same = a.v === b.v;
            else same = a.t === b.t && a.v === b.v;
            return { t: 'TROOF', v: e.op === '==' ? same : !same };
          }
          const x = num(a, ln), y = num(b, ln), fl = x.t === 'NUMBAR' || y.t === 'NUMBAR';
          let v;
          switch (e.op) {
            case '+': v = x.v + y.v; break; case '-': v = x.v - y.v; break; case '*': v = x.v * y.v; break;
            case '/': if (!y.v) fail('Line ' + ln + ': division by zero.'); v = fl ? x.v / y.v : Math.trunc(x.v / y.v); break;
            case '%': if (!y.v) fail('Line ' + ln + ': division by zero.'); v = x.v % y.v; break;
            case 'max': v = Math.max(x.v, y.v); break; case 'min': v = Math.min(x.v, y.v); break;
          }
          return { t: fl ? 'NUMBAR' : 'NUMBR', v };
        }
      }
    };
    const global = { v: new Map(), up: null, it: NOOB };
    const runBlock = (b, sc) => { for (const s of b) { io.tick(); runStmt(s, sc); } };
    class End { }
    const runStmt = (s, sc) => {
      const ln = s.ln;
      switch (s.k) {
        case 'decl': if (sc.v.has(s.name)) fail('Line ' + ln + ': ' + s.name + ' is already declared.'); sc.v.set(s.name, s.type ? cast(NOOB, s.type, ln) : s.e ? ev(s.e, sc, ln) : NOOB); break;
        case 'assign': setv(sc, s.name, ev(s.e, sc, ln), ln); break;
        case 'cast': setv(sc, s.name, cast(look(sc, s.name, ln), s.type, ln), ln); break;
        case 'visible': io.out(s.es.map(e => yarn(ev(e, sc, ln))).join('') + (s.nl ? '\n' : '')); break;
        case 'gimmeh': { const l = io.getline(); setv(sc, s.name, { t: 'YARN', v: l === null ? '' : l }, ln); break; }
        case 'expr': sc.it = ev(s.e, sc, ln); break;
        case 'if': {
          if (troof(sc.it || NOOB)) { runBlock(s.yes, sc); break; }
          for (const mb of s.mebbe) { sc.it = ev(mb.e, sc, ln); if (troof(sc.it)) { runBlock(mb.b, sc); return; } }
          if (s.no) runBlock(s.no, sc); break;
        }
        case 'switch': {
          const it = sc.it || NOOB; let hit = false;
          try {
            for (const c of s.cases) { if (!hit) { const v = ev(c.v, sc, ln); hit = yarn(v) === yarn(it) && (v.t === it.t || (/NUM/.test(v.t) && /NUM/.test(it.t))); } if (hit) runBlock(c.b, sc); }
            if (s.dflt) runBlock(s.dflt, sc);
          } catch (x) { if (!(x instanceof Brk)) throw x; }
          break;
        }
        case 'loop': {
          const ls = { v: new Map(), up: sc, it: sc.it };
          if (s.var && !(function has() { for (let q = sc; q; q = q.up) if (q.v.has(s.var)) return true; return false; })()) ls.v.set(s.var, { t: 'NUMBR', v: 0 });
          try {
            for (;;) {
              io.tick();
              if (s.cond) { const c = troof(ev(s.cond, ls, ln)); if (s.til ? c : !c) break; }
              const bs = { v: new Map(), up: ls, it: ls.it }; /* each pass gets fresh variables */
              runBlock(s.body, bs); ls.it = bs.it;
              if (s.var) { const cur = num(look(ls, s.var, ln), ln); setv(ls, s.var, { t: cur.t, v: cur.v + s.step }, ln); }
            }
          } catch (x) { if (!(x instanceof Brk)) throw x; }
          sc.it = ls.it; break;
        }
        case 'func': funcs.set(s.name, s); break;
        case 'return': throw new Ret(ev(s.e, sc, ln));
        case 'break': throw new Brk();
        case 'end': throw new End();
      }
    };
    prog.filter(s => s.k === 'func').forEach(s => funcs.set(s.name, s));
    try { runBlock(prog, global); } catch (x) { if (x instanceof End) return; if (x instanceof Brk || x instanceof Ret) return; throw x; }
  };

  /* =================== ArnoldC =================== */
  L.arnoldc = (code, io) => {
    const lines = code.replace(/\r/g, '').split('\n').map((l, n) => ({ s: l.trim(), n: n + 1 })).filter(l => l.s);
    const K = {
      main: 'IT\'S SHOWTIME', endMain: 'YOU HAVE BEEN TERMINATED', print: 'TALK TO THE HAND', decl: 'HEY CHRISTMAS TREE', init: 'YOU SET US UP',
      assign: 'GET TO THE CHOPPER', first: 'HERE IS MY INVITATION', endAssign: 'ENOUGH TALK', add: 'GET UP', sub: 'GET DOWN', mul: 'YOU\'RE FIRED',
      div: 'HE HAD TO SPLIT', mod: 'I LET HIM GO', eq: 'YOU ARE NOT YOU YOU ARE ME', gt: 'LET OFF SOME STEAM BENNET', or: 'CONSIDER THAT A DIVORCE',
      and: 'KNOCK KNOCK', if: 'BECAUSE I\'M GOING TO SAY PLEASE', else: 'BULLSHIT', endIf: 'YOU HAVE NO RESPECT FOR LOGIC', while: 'STICK AROUND', endWhile: 'CHILL',
      method: 'LISTEN TO ME VERY CAREFULLY', arg: 'I NEED YOUR CLOTHES YOUR BOOTS AND YOUR MOTORCYCLE', nonVoid: 'GIVE THESE PEOPLE AIR', ret: 'I\'LL BE BACK',
      endMethod: 'HASTA LA VISTA, BABY', call: 'DO IT NOW', callAssign: 'GET YOUR ASS TO MARS', read: 'I WANT TO ASK YOU A BUNCH OF QUESTIONS AND I WANT TO HAVE THEM ANSWERED IMMEDIATELY',
    };
    const starts = (l, k) => l.s === k || l.s.startsWith(k + ' ');
    const rest = (l, k) => l.s.slice(k.length).trim();
    let i = 0;
    const methods = new Map(); let main = null;
    const block = ends => {
      const out = [];
      while (i < lines.length) {
        const l = lines[i];
        if (ends.some(e => starts(l, e))) return out;
        i++;
        if (starts(l, K.print)) out.push({ k: 'print', v: rest(l, K.print), n: l.n });
        else if (starts(l, K.decl)) { const nx = lines[i]; if (!nx || !starts(nx, K.init)) fail('Line ' + l.n + ': ' + K.decl + ' needs ' + K.init + ' on the next line.'); i++; out.push({ k: 'decl', name: rest(l, K.decl), v: rest(nx, K.init), n: l.n }); }
        else if (starts(l, K.assign)) {
          const nx = lines[i]; if (!nx || !starts(nx, K.first)) fail('Line ' + l.n + ': ' + K.assign + ' needs ' + K.first + '.'); i++;
          const ops = [];
          while (i < lines.length && !starts(lines[i], K.endAssign)) { const o = lines[i++], op = ['add', 'sub', 'mul', 'div', 'mod', 'eq', 'gt', 'or', 'and'].find(x => starts(o, K[x])); if (!op) fail('Line ' + o.n + ': "' + o.s + '" is not an operation.'); ops.push([op, rest(o, K[op])]); }
          if (i >= lines.length) fail('Line ' + l.n + ': ' + K.assign + ' needs ' + K.endAssign + '.');
          i++; out.push({ k: 'assign', name: rest(l, K.assign), first: rest(nx, K.first), ops, n: l.n });
        }
        else if (starts(l, K.if)) { const yes = block([K.else, K.endIf]); let no = []; if (starts(lines[i], K.else)) { i++; no = block([K.endIf]); } i++; out.push({ k: 'if', c: rest(l, K.if), yes, no, n: l.n }); }
        else if (starts(l, K.while)) { const body = block([K.endWhile]); i++; out.push({ k: 'while', c: rest(l, K.while), body, n: l.n }); }
        else if (starts(l, K.callAssign)) { const nx = lines[i]; if (!nx || !starts(nx, K.call) && !starts(nx, K.read)) fail('Line ' + l.n + ': ' + K.callAssign + ' needs ' + K.call + ' or the input line next.'); i++; if (starts(nx, K.read)) out.push({ k: 'read', name: rest(l, K.callAssign), n: l.n }); else out.push({ k: 'call', name: rest(l, K.callAssign), call: rest(nx, K.call).split(/\s+/), n: l.n }); }
        else if (starts(l, K.call)) out.push({ k: 'call', call: rest(l, K.call).split(/\s+/), n: l.n });
        else if (starts(l, K.ret)) out.push({ k: 'ret', v: rest(l, K.ret), n: l.n });
        else fail('Line ' + l.n + ': "' + l.s + '" is not ArnoldC.');
      }
      if (ends.length) fail('A block is missing ' + ends.join(' or ') + '.');
      return out;
    };
    while (i < lines.length) {
      const l = lines[i++];
      if (starts(l, K.main)) { main = block([K.endMain]); i++; }
      else if (starts(l, K.method)) {
        const m = { name: rest(l, K.method), args: [], body: null };
        while (i < lines.length && (starts(lines[i], K.arg) || starts(lines[i], K.nonVoid))) { const a = lines[i++]; if (starts(a, K.arg)) m.args.push(rest(a, K.arg)); }
        m.body = block([K.endMethod]); i++; methods.set(m.name, m);
      } else fail('Line ' + l.n + ': code must be inside ' + K.main + ' or a method.');
    }
    if (!main) fail('An ArnoldC program needs ' + K.main + ' and ' + K.endMain + '.');
    class Ret { constructor(v) { this.v = v; } }
    const val = (s, env, n) => {
      if (s === '@I LIED') return 0; if (s === '@NO PROBLEMO') return 1;
      if (/^-?\d+$/.test(s)) return parseInt(s, 10);
      if (env.has(s)) return env.get(s);
      fail('Line ' + n + ': ' + s + ' is not a number or a variable.');
    };
    const call = (name, args, n) => {
      const m = methods.get(name); if (!m) fail('Line ' + n + ': there is no method ' + name + '.');
      const env = new Map(); m.args.forEach((a, k) => env.set(a, args[k] || 0));
      try { run(m.body, env); } catch (x) { if (x instanceof Ret) return x.v; throw x; }
      return 0;
    };
    const run = (b, env) => {
      for (const s of b) {
        io.tick();
        switch (s.k) {
          case 'print': { const m = /^"(.*)"$/.exec(s.v); io.out((m ? m[1] : String(val(s.v, env, s.n))) + '\n'); break; }
          case 'decl': env.set(s.name, val(s.v, env, s.n)); break;
          case 'assign': {
            if (!env.has(s.name)) fail('Line ' + s.n + ': ' + s.name + ' was never declared.');
            let v = val(s.first, env, s.n);
            for (const [op, a] of s.ops) {
              const x = val(a, env, s.n);
              switch (op) {
                case 'add': v += x; break; case 'sub': v -= x; break; case 'mul': v *= x; break;
                case 'div': if (!x) fail('Line ' + s.n + ': division by zero.'); v = Math.trunc(v / x); break;
                case 'mod': if (!x) fail('Line ' + s.n + ': division by zero.'); v %= x; break;
                case 'eq': v = v === x ? 1 : 0; break; case 'gt': v = v > x ? 1 : 0; break;
                case 'or': v = v || x ? 1 : 0; break; case 'and': v = v && x ? 1 : 0; break;
              }
            }
            env.set(s.name, v); break;
          }
          case 'if': run(val(s.c, env, s.n) ? s.yes : s.no, env); break;
          case 'while': while (val(s.c, env, s.n)) { io.tick(); run(s.body, env); } break;
          case 'call': { const r = call(s.call[0], s.call.slice(1).map(a => val(a, env, s.n)), s.n); if (s.name) env.set(s.name, r); break; }
          case 'read': { const x = io.getn(); env.set(s.name, x === null ? 0 : x); break; }
          case 'ret': throw new Ret(s.v ? val(s.v, env, s.n) : 0);
        }
      }
    };
    try { run(main, new Map()); } catch (x) { if (!(x instanceof Ret)) throw x; }
  };

  /* =================== Rockstar (core) =================== */
  L.rockstar = (code, io) => {
    const raw = code.replace(/\r/g, '').replace(/\([^)]*\)/g, '').split('\n');
    const lines = raw.map((s, n) => ({ s: s.trim().replace(/[,.!?;]+$/, '').replace(/'s\b/g, ' is').replace(/\bain't\b/gi, 'is not').replace(/'/g, ''), n: n + 1 }));
    const KW = /^(if|while|until|else|say|shout|whisper|scream|put|let|build|knock|listen|give|return|break|continue|take|turn|and|or|nor|not|is|was|are|were|into|be|up|down|plus|with|minus|without|times|of|over|between|true|false|right|wrong|yes|no|lies|ok|nothing|nowhere|nobody|gone|null|mysterious|taking|takes|back|it|he|she|him|her|they|them|ze|hir|zie|zir|xe|xem|ve|ver)$/i;
    const PRON = /^(it|he|she|him|her|they|them|ze|hir|zie|zir|xe|xem|ve|ver)$/i;
    const MYST = { myst: 1 };
    let lastVar = null;
    const varName = (ws, i) => {
      const w = ws[i]; if (!w) return null;
      if (PRON.test(w)) { if (!lastVar) fail('A pronoun (' + w + ') is used before any variable.'); return { name: lastVar, len: 1 }; }
      if (/^(a|an|the|my|your|our)$/i.test(w) && ws[i + 1] && /^[a-z]+$/i.test(ws[i + 1])) return { name: (w + ' ' + ws[i + 1]).toLowerCase(), len: 2 };
      if (/^[A-Z][a-zA-Z]*$/.test(w) && !KW.test(w)) { let n = 1; while (ws[i + n] && /^[A-Z][a-zA-Z]*$/.test(ws[i + n]) && !KW.test(ws[i + n])) n++; return { name: ws.slice(i, i + n).join(' ').toLowerCase(), len: n }; }
      if (/^[a-z][a-zA-Z]*$/.test(w) && !KW.test(w)) return { name: w.toLowerCase(), len: 1 };
      return null;
    };
    const tok = s => { const out = []; const re = /"([^"]*)"|(-?\d+(?:\.\d+)?)|([A-Za-z][A-Za-z]*)|(,)/g; let m; while ((m = re.exec(s))) out.push(m[1] !== undefined ? { s: m[1] } : m[2] !== undefined ? { n: +m[2] } : m[4] ? ',' : m[3]); return out; };
    /* expression parser over tokens */
    const parseExpr = (t, i) => {
      const lower = x => typeof x === 'string' ? x.toLowerCase() : x;
      const primary = () => {
        const w = t[i];
        if (w === undefined) fail('An expression is missing.');
        if (typeof w === 'object') { i++; return w.s !== undefined ? { k: 'lit', v: w.s } : { k: 'lit', v: w.n }; }
        const lw = lower(w);
        if (/^(true|right|yes|ok)$/.test(lw)) { i++; return { k: 'lit', v: true }; }
        if (/^(false|wrong|no|lies)$/.test(lw)) { i++; return { k: 'lit', v: false }; }
        if (/^(nothing|nowhere|nobody|gone|null|empty)$/.test(lw)) { i++; return { k: 'lit', v: null }; }
        if (lw === 'mysterious') { i++; return { k: 'lit', v: MYST }; }
        if (lw === 'not') { i++; return { k: 'not', a: primary() }; }
        const v = varName(t, i); if (!v) fail('"' + w + '" is not a value or a variable.');
        i += v.len;
        if (lower(t[i]) === 'taking') { i++; const args = [comparison()]; while (t[i] === ',' || lower(t[i]) === 'and' && false) { i++; args.push(comparison()); } return { k: 'call', name: v.name, args }; }
        return { k: 'var', name: v.name };
      };
      const mul = () => { let a = primary(); for (;;) { const w = lower(t[i]); if (w === 'times' || w === 'of') { i++; a = { k: '*', a, b: primary() }; } else if (w === 'over' || w === 'between') { i++; a = { k: '/', a, b: primary() }; } else return a; } };
      const add = () => { let a = mul(); for (;;) { const w = lower(t[i]); if (w === 'plus' || w === 'with') { i++; a = { k: '+', a, b: mul() }; } else if (w === 'minus' || w === 'without') { i++; a = { k: '-', a, b: mul() }; } else return a; } };
      const comparison = () => {
        let a = add();
        for (;;) {
          const w = lower(t[i]);
          if (w !== 'is' && w !== 'was' && w !== 'are' && w !== 'were') return a;
          let j = i + 1, neg = false;
          if (lower(t[j]) === 'not') { neg = true; j++; }
          const w2 = lower(t[j]), w3 = lower(t[j + 1]);
          let op = '==';
          if (/^(higher|greater|bigger|stronger)$/.test(w2) && w3 === 'than') { op = '>'; j += 2; }
          else if (/^(lower|less|smaller|weaker)$/.test(w2) && w3 === 'than') { op = '<'; j += 2; }
          else if (w2 === 'as' && /^(high|great|big|strong)$/.test(w3) && lower(t[j + 2]) === 'as') { op = '>='; j += 3; }
          else if (w2 === 'as' && /^(low|little|small|weak)$/.test(w3) && lower(t[j + 2]) === 'as') { op = '<='; j += 3; }
          i = j; const b = add(); a = { k: op, a, b }; if (neg) a = { k: 'not', a };
        }
      };
      const logic = () => { let a = comparison(); for (;;) { const w = lower(t[i]); if (w === 'and' || w === 'or' || w === 'nor') { i++; a = { k: w, a, b: comparison() }; } else return a; } };
      const e = logic();
      return { e, i };
    };
    const expr = s => { const t = tok(s), r = parseExpr(t, 0); if (r.i < t.length) fail('Unexpected words: "' + t.slice(r.i).map(x => typeof x === 'object' ? (x.s !== undefined ? '"' + x.s + '"' : x.n) : x).join(' ') + '".'); return r.e; };
    const poetic = s => { const parts = s.split('.'); const dig = p => p.split(/\s+/).map(w => w.replace(/[^A-Za-z-]/g, '')).filter(Boolean).map(w => w.length % 10).join(''); const a = dig(parts[0]) || '0', b = parts.length > 1 ? dig(parts.slice(1).join(' ')) : ''; return parseFloat(a + (b ? '.' + b : '')); };
    /* statements */
    let k = 0;
    const block = () => {
      const out = [];
      while (k < lines.length) {
        const L0 = lines[k];
        if (!L0.s) { k++; if (out.length) return out; continue; }
        if (/^else$/i.test(L0.s)) return out;
        out.push(stmt());
      }
      return out;
    };
    const stmt = () => {
      const { s, n } = lines[k++]; let m;
      try {
        if ((m = /^(if|while|until)\s+(.+)$/i.exec(s))) {
          const c = expr(m[2]), body = blockUntilBlank(); let els = null;
          if (/^if$/i.test(m[1]) && lines[k] && /^else$/i.test(lines[k].s)) { k++; els = blockUntilBlank(); }
          return { k: m[1].toLowerCase(), c, body, els, n };
        }
        if ((m = /^(say|shout|whisper|scream)\s+(.+)$/i.exec(s))) return { k: 'say', e: expr(m[2]), n };
        if ((m = /^put\s+(.+)\s+into\s+(.+)$/i.exec(s))) return { k: 'set', v: target(m[2]), e: expr(m[1]), n };
        if ((m = /^let\s+(.+?)\s+be\s+(.+)$/i.exec(s))) return { k: 'set', v: target(m[1]), e: expr(m[2]), n };
        if ((m = /^build\s+(.+?)((?:\s*,?\s*up)+)$/i.exec(s))) return { k: 'inc', v: target(m[1]), by: (m[2].match(/up/gi) || []).length, n };
        if ((m = /^knock\s+(.+?)((?:\s*,?\s*down)+)$/i.exec(s))) return { k: 'inc', v: target(m[1]), by: -(m[2].match(/down/gi) || []).length, n };
        if ((m = /^turn\s+(up|down|round|around)\s+(.+)$/i.exec(s)) || (m = /^turn\s+(.+?)\s+(up|down|round|around)$/i.exec(s))) { const dir = /^(up|down|round|around)$/i.test(m[1]) ? m[1] : m[2], v = /^(up|down|round|around)$/i.test(m[1]) ? m[2] : m[1]; return { k: 'turn', dir: dir.toLowerCase(), v: target(v), n }; }
        if ((m = /^listen to\s+(.+)$/i.exec(s))) return { k: 'listen', v: target(m[1]), n };
        if (/^listen$/i.test(s)) return { k: 'listen', n };
        if ((m = /^(?:give back|return)\s+(.+)$/i.exec(s)) || (m = /^give\s+(.+)\s+back$/i.exec(s))) return { k: 'ret', e: expr(m[1]), n };
        if (/^(break|break it down)$/i.test(s)) return { k: 'break', n };
        if (/^(continue|take it to the top)$/i.test(s)) return { k: 'continue', n };
        if ((m = /^(.+?)\s+takes\s+(.+)$/i.exec(s))) { const name = target(m[1]); const args = m[2].split(/\s*(?:,|\band\b|&)\s*/i).filter(Boolean).map(a => target(a)); const body = blockUntilBlank(); return { k: 'func', name, args, body, n }; }
        if ((m = /^(.+?)\s+says\s(.*)$/i.exec(s))) return { k: 'set', v: target(m[1]), e: { k: 'lit', v: m[2] }, n };
        if ((m = /^(.+?)\s+(?:is|are|was|were)\s+(.+)$/i.exec(s))) {
          const v = target(m[1]), rhs = m[2];
          const t = tok(rhs), first = t[0];
          const literal = typeof first === 'object' || /^(true|right|yes|ok|false|wrong|no|lies|nothing|nowhere|nobody|gone|null|empty|mysterious)$/i.test(first);
          if (literal) return { k: 'set', v, e: expr(rhs), n };
          return { k: 'set', v, e: { k: 'lit', v: poetic(rhs) }, n };
        }
        return { k: 'expr', e: expr(s), n };
      } catch (x) { if (/^Line \d+/.test(x.message)) throw x; fail('Line ' + n + ': ' + x.message); }
    };
    const blockUntilBlank = () => { const out = []; while (k < lines.length && lines[k].s && !/^else$/i.test(lines[k].s)) out.push(stmt()); if (k < lines.length && !lines[k].s) k++; return out; };
    const target = s => { const t = tok(s.trim()), v = varName(t, 0); if (!v || v.len !== t.length) fail('"' + s.trim() + '" is not a variable name.'); lastVar = v.name; return v.name; };
    const prog = [];
    while (k < lines.length) { if (!lines[k].s) { k++; continue; } prog.push(stmt()); }
    /* run */
    const vars = new Map(), funcs = new Map();
    class Ret { constructor(v) { this.v = v; } } class Brk { } class Cont { }
    const show = v => v === null ? 'null' : v === MYST || v === undefined ? 'mysterious' : v === true ? 'true' : v === false ? 'false' : typeof v === 'number' ? String(+v.toFixed(10)) : String(v);
    const numv = v => v === null ? 0 : v === true ? 1 : v === false ? 0 : v;
    const truthy = v => !(v === null || v === false || v === 0 || v === '' || v === MYST || v === undefined);
    const ev = (e, sc) => {
      switch (e.k) {
        case 'lit': return e.v;
        case 'var': { lastVar = e.name; for (let s = sc; s; s = s.up) if (s.v.has(e.name)) return s.v.get(e.name); return MYST; }
        case 'not': return !truthy(ev(e.a, sc));
        case 'and': return truthy(ev(e.a, sc)) && truthy(ev(e.b, sc));
        case 'or': return truthy(ev(e.a, sc)) || truthy(ev(e.b, sc));
        case 'nor': return !(truthy(ev(e.a, sc)) || truthy(ev(e.b, sc)));
        case 'call': {
          const f = funcs.get(e.name); if (!f) fail(e.name + ' is not a function.');
          const fs = { v: new Map(), up: { v: vars, up: null } }; f.args.forEach((a, n) => fs.v.set(a, ev(e.args[n] || { k: 'lit', v: MYST }, sc)));
          try { runBlock(f.body, fs); } catch (x) { if (x instanceof Ret) return x.v; throw x; }
          return MYST;
        }
      }
      const a = ev(e.a, sc), b = ev(e.b, sc);
      switch (e.k) {
        case '+': return typeof a === 'string' || typeof b === 'string' ? show(a) + show(b) : numv(a) + numv(b);
        case '-': return numv(a) - numv(b);
        case '*': return typeof a === 'string' && typeof b === 'number' ? a.repeat(Math.max(0, b)) : numv(a) * numv(b);
        case '/': return numv(a) / numv(b);
        case '==': return typeof a === 'string' || typeof b === 'string' ? show(a) === show(b) : (a === b || numv(a) === numv(b)) && a !== MYST === (b !== MYST);
        case '>': return numv(a) > numv(b); case '<': return numv(a) < numv(b);
        case '>=': return numv(a) >= numv(b); case '<=': return numv(a) <= numv(b);
      }
    };
    const assign = (sc, name, v) => { for (let s = sc; s; s = s.up) if (s.v.has(name)) { s.v.set(name, v); return; } sc.v.set(name, v); };
    const lookup = (sc, name) => { for (let s = sc; s; s = s.up) if (s.v.has(name)) return s.v.get(name); return MYST; };
    const runBlock = (b, sc) => { for (const s of b) { io.tick(); runStmt(s, sc); } };
    const runStmt = (s, sc) => {
      try {
        switch (s.k) {
          case 'say': io.out(show(ev(s.e, sc)) + '\n'); break;
          case 'set': assign(sc, s.v, ev(s.e, sc)); break;
          case 'inc': assign(sc, s.v, numv(lookup(sc, s.v)) + s.by); break;
          case 'turn': { const v = numv(lookup(sc, s.v)); assign(sc, s.v, s.dir === 'up' ? Math.ceil(v) : s.dir === 'down' ? Math.floor(v) : Math.round(v)); break; }
          case 'listen': { const l = io.getline(); if (s.v) assign(sc, s.v, l === null ? null : /^-?\d+(\.\d+)?$/.test(l.trim()) ? +l : l); break; }
          case 'if': if (truthy(ev(s.c, sc))) runBlock(s.body, sc); else if (s.els) runBlock(s.els, sc); break;
          case 'while': case 'until':
            for (;;) { io.tick(); const c = truthy(ev(s.c, sc)); if (s.k === 'while' ? !c : c) break; try { runBlock(s.body, sc); } catch (x) { if (x instanceof Brk) break; if (x instanceof Cont) continue; throw x; } }
            break;
          case 'func': funcs.set(s.name, s); break;
          case 'ret': throw new Ret(ev(s.e, sc));
          case 'break': throw new Brk();
          case 'continue': throw new Cont();
          case 'expr': ev(s.e, sc); break;
        }
      } catch (x) { if (x instanceof Ret || x instanceof Brk || x instanceof Cont || /^Line \d+/.test(x.message) || x instanceof E.Stop) throw x; fail('Line ' + s.n + ': ' + x.message); }
    };
    try { runBlock(prog, { v: vars, up: null }); } catch (x) { if (x instanceof Ret) return; if (x instanceof Brk || x instanceof Cont) fail('break or continue outside a loop.'); throw x; }
  };

  /* =================== Emojicode (a small part of it) =================== */
  L.emojicode = (code, io) => {
    const VS = /️/g;
    const src = code.replace(/\r/g, '').replace(/💭🔜[\s\S]*?🔚💭/gu, ' ').replace(/💭[^\n]*/gu, ' ');
    const toks = []; let i = 0;
    const SYM = ['🖍🆕', '⬅️➕', '⬅️➖', '⬅️✖️', '⬅️➗', '▶️🙌', '◀️🙌', '🙅↪️', '🆕⏩', '⏩'].map(s => s.replace(VS, ''));
    const s2 = src.replace(VS, '');
    while (i < s2.length) {
      const c = s2[i];
      if (/\s/.test(c)) { i++; continue; }
      if (s2.startsWith('🔤', i)) { const e = s2.indexOf('🔤', i + 2); if (e < 0) fail('A 🔤 string has no closing 🔤.'); toks.push({ s: s2.slice(i + 2, e) }); i = e + 2; continue; }
      const sym = SYM.find(x => s2.startsWith(x, i)); if (sym) { toks.push(sym); i += sym.length; continue; }
      let m = /^-?\d+(\.\d+)?/.exec(s2.slice(i)); if (m) { toks.push({ n: +m[0] }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s2.slice(i)); if (m) { toks.push({ id: m[0] }); i += m[0].length; continue; }
      const cp = s2.codePointAt(i), ch = String.fromCodePoint(cp); toks.push(ch); i += ch.length;
    }
    let p = 0;
    const is = t => toks[p] === t, eat = t => { if (toks[p] !== t) fail('Expected ' + t + ' but found ' + show(toks[p]) + '.'); p++; };
    const show = t => t === undefined ? 'the end' : typeof t === 'object' ? (t.s !== undefined ? '🔤' + t.s + '🔤' : t.n !== undefined ? t.n : t.id) : t;
    while (p < toks.length && !is('🏁')) p++;
    if (!is('🏁')) fail('An Emojicode program starts at 🏁 🍇 ... 🍉.');
    p++;
    const block = () => { eat('🍇'); const out = []; while (!is('🍉')) { if (p >= toks.length) fail('A 🍇 block has no closing 🍉.'); out.push(stmt()); } p++; return out; };
    const BIN = { '➕': '+', '➖': '-', '✖': '*', '➗': '/', '🚮': '%', '▶': '>', '◀': '<', '▶🙌': '>=', '◀🙌': '<=', '🙌': '==', '🤝': '&&', '👐': '||', '+': '+', '-': '-', '*': '*', '/': '/', '%': '%', '>': '>', '<': '<', '==': '==' };
    const primary = () => {
      const t = toks[p];
      if (t && typeof t === 'object') { p++; if (t.s !== undefined) return { k: 'str', s: t.s }; if (t.n !== undefined) return { k: 'num', v: t.n }; return { k: 'var', name: t.id }; }
      if (t === '👍' || t === '👎') { p++; return { k: 'num', v: t === '👍' }; }
      if (t === '🤜') { p++; const e = expr(); eat('🤛'); return e; }
      if (t === '🔡') { p++; const e = expr(); eat('❗'); return { k: 'tostr', e }; }
      if (t === '❎') { p++; return { k: 'not', e: primary() }; }
      fail('Unexpected ' + show(t) + '.');
    };
    const expr = () => { let a = primary(); while (BIN[toks[p]]) { const op = BIN[toks[p++]]; a = { k: 'bin', op, a, b: primary() }; } return a; };
    const stmt = () => {
      const t = toks[p];
      if (t === '😀') { p++; const e = expr(); eat('❗'); return { k: 'print', e }; }
      if (t === '↪') { p++; const c = expr(); const yes = block(); const elifs = []; let no = null; for (;;) { if (is('🙅↪')) { p++; const c2 = expr(); elifs.push({ c: c2, b: block() }); } else if (is('🙅')) { p++; no = block(); break; } else break; } return { k: 'if', c, yes, elifs, no }; }
      if (t === '🔁') { p++; const c = expr(); return { k: 'while', c, body: block() }; }
      if (t === '🔂') { p++; const v = toks[p++]; if (!v || !v.id) fail('🔂 needs a variable name.'); if (is('🆕⏩')) p++; else eat('⏩'); const a = expr(), b = expr(); let step = null; if (!is('❗')) step = expr(); eat('❗'); return { k: 'for', v: v.id, a, b, step, body: block() }; }
      if (t === '🖍🆕') { p++; const v = toks[p++]; if (!v || !v.id) fail('🖍🆕 needs a variable name.'); eat('⬅'); return { k: 'let', name: v.id, e: expr() }; }
      if (t && t.id && ['⬅', '⬅➕', '⬅➖', '⬅✖', '⬅➗'].includes(toks[p + 1])) { p++; const op = toks[p++]; return { k: 'set', name: t.id, op: op.slice(1), e: expr() }; }
      const e = expr();
      if (is('➡')) { p++; const mut = is('🖍🆕'); if (mut) p++; const v = toks[p++]; if (!v || !v.id) fail('➡ needs a variable name.'); return { k: 'let', name: v.id, e, konst: !mut }; }
      fail('Unexpected ' + show(t) + '.');
    };
    const prog = block();
    const scope = [new Map()];
    const find = n => { for (let k = scope.length - 1; k >= 0; k--) if (scope[k].has(n)) return scope[k]; fail(n + ' has not been declared.'); };
    const str = v => typeof v === 'boolean' ? (v ? '👍' : '👎') : typeof v === 'number' ? String(v) : v;
    const interp = s => s.replace(/🧲([^🧲]+)🧲/gu, (_, n) => str(find(n.trim()).get(n.trim()).v));
    const ev = e => {
      switch (e.k) {
        case 'str': return interp(e.s);
        case 'num': return e.v;
        case 'var': return find(e.name).get(e.name).v;
        case 'tostr': return str(ev(e.e));
        case 'not': return !ev(e.e);
        case 'bin': {
          const a = ev(e.a), b = ev(e.b);
          switch (e.op) {
            case '+': return typeof a === 'string' ? a + str(b) : a + b; case '-': return a - b; case '*': return a * b;
            case '/': if (!b) fail('Division by zero.'); return Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b;
            case '%': return a % b; case '>': return a > b; case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b; case '==': return a === b;
            case '&&': return a && b; case '||': return a || b;
          }
        }
      }
    };
    const run = b => { scope.push(new Map()); try { for (const s of b) { io.tick(); one(s); } } finally { scope.pop(); } };
    const one = s => {
      switch (s.k) {
        case 'print': io.out(str(ev(s.e)) + '\n'); break;
        case 'let': scope[scope.length - 1].set(s.name, { v: ev(s.e), konst: !!s.konst }); break;
        case 'set': { const sc = find(s.name), cur = sc.get(s.name); if (cur.konst) fail(s.name + ' is a constant; declare it with 🖍🆕 to change it.'); const v = ev(s.e); cur.v = s.op === '' ? v : s.op === '➕' ? cur.v + v : s.op === '➖' ? cur.v - v : s.op === '✖' ? cur.v * v : Math.trunc(cur.v / v); break; }
        case 'if': if (ev(s.c)) run(s.yes); else { const hit = s.elifs.find(x => ev(x.c)); if (hit) run(hit.b); else if (s.no) run(s.no); } break;
        case 'while': while (ev(s.c)) { io.tick(); run(s.body); } break;
        case 'for': { const a = ev(s.a), b = ev(s.b), st = s.step ? ev(s.step) : (b >= a ? 1 : -1); if (!st) fail('The ⏩ step is 0.'); for (let x = a; st > 0 ? x < b : x > b; x += st) { io.tick(); scope.push(new Map([[s.v, { v: x, konst: true }]])); try { run(s.body); } finally { scope.pop(); } } break; }
      }
    };
    run(prog);
  };

  /* =================== Whenever: the lines run in any order =================== */
  L.whenever = (code, io) => {
    const lines = new Map();
    code.replace(/\r/g, '').split('\n').forEach(l => { const m = /^\s*(\d+)\s+(.*?);?\s*$/.exec(l); if (m) lines.set(+m[1], m[2]); });
    if (!lines.size) fail('Each line starts with its number, like: 1 print("Hello");');
    const todo = new Map(); lines.forEach((_, n) => todo.set(n, 1));
    const N = n => todo.get(n) || 0;
    const evalExpr = s => {
      let i = 0;
      const ws = () => { while (/\s/.test(s[i] || '')) i++; };
      const prim = () => {
        ws(); const c = s[i];
        if (c === '"') { const e = s.indexOf('"', i + 1); if (e < 0) fail('A string has no closing quote.'); const v = s.slice(i + 1, e); i = e + 1; return v; }
        if (c === '(') { i++; const v = or(); ws(); if (s[i] !== ')') fail('Missing ).'); i++; return v; }
        if (c === '!') { i++; return !prim(); }
        if (c === '-') { i++; return -prim(); }
        let m = /^N\s*\(/.exec(s.slice(i)); if (m) { i += m[0].length; const v = or(); ws(); if (s[i] !== ')') fail('Missing ) after N('); i++; return N(v); }
        m = /^read\s*\(\s*\)/.exec(s.slice(i)); if (m) { i += m[0].length; const n = io.getn(); return n === null ? 0 : n; }
        m = /^(true|false)/.exec(s.slice(i)); if (m) { i += m[0].length; return m[0] === 'true'; }
        m = /^\d+/.exec(s.slice(i)); if (m) { i += m[0].length; return +m[0]; }
        fail('Cannot read "' + s.slice(i) + '".');
      };
      const mul = () => { let a = prim(); for (;;) { ws(); const c = s[i]; if (c === '*' || c === '/' || c === '%') { i++; const b = prim(); a = c === '*' ? a * b : c === '/' ? Math.trunc(a / b) : a % b; } else return a; } };
      const add = () => { let a = mul(); for (;;) { ws(); const c = s[i]; if (c === '+' || (c === '-' && s[i + 1] !== '>')) { i++; const b = mul(); a = c === '+' ? (typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b) : a - b; } else return a; } };
      const cmp = () => { let a = add(); ws(); const m = /^(==|!=|<=|>=|<|>)/.exec(s.slice(i)); if (m) { i += m[0].length; const b = add(); a = m[0] === '==' ? a === b : m[0] === '!=' ? a !== b : m[0] === '<=' ? a <= b : m[0] === '>=' ? a >= b : m[0] === '<' ? a < b : a > b; } return a; };
      const and = () => { let a = cmp(); for (;;) { ws(); if (s.startsWith('&&', i)) { i += 2; const b = cmp(); a = a && b; } else return a; } };
      const or = () => { let a = and(); for (;;) { ws(); if (s.startsWith('||', i)) { i += 2; const b = and(); a = a || b; } else return a; } };
      const v = or(); ws(); if (i < s.length) fail('Unexpected "' + s.slice(i) + '".');
      return v;
    };
    const cond = (s, kw) => { const m = new RegExp('^' + kw + '\\s*\\(').exec(s); if (!m) return null; let d = 1, j = m[0].length; for (; j < s.length && d; j++) { if (s[j] === '(') d++; else if (s[j] === ')') d--; } return { c: s.slice(m[0].length, j - 1), rest: s.slice(j).trim() }; };
    const doStmt = s => {
      s = s.trim();
      let m = /^print\s*\(([\s\S]*)\)$/.exec(s);
      if (m) { const v = evalExpr(m[1]); io.out((v === true ? 'true' : v === false ? 'false' : String(v)) + '\n'); return; }
      const parts = s.split(',').map(x => x.trim()).filter(Boolean);
      for (const p of parts) {
        m = /^(-)?\s*(.+?)(?:\s*#\s*(.+))?$/.exec(p); if (!m) fail('Cannot read "' + p + '".');
        const n = evalExpr(m[2]), times = m[3] ? evalExpr(m[3]) : 1, by = (m[1] ? -1 : 1) * times;
        if (!lines.has(n)) fail('There is no line ' + n + '.');
        todo.set(n, Math.max(0, N(n) + by)); if (!todo.get(n)) todo.delete(n);
      }
    };
    for (;;) {
      io.tick();
      const keys = [...todo.keys()]; if (!keys.length) return;
      let total = 0; keys.forEach(k2 => { total += todo.get(k2); });
      let r = Math.random() * total, n = keys[0]; for (const k2 of keys) { r -= todo.get(k2); if (r < 0) { n = k2; break; } }
      let s = lines.get(n), keep = false, c;
      if ((c = cond(s, 'defer'))) { if (evalExpr(c.c)) continue; s = c.rest; }
      if ((c = cond(s, 'again'))) { keep = !!evalExpr(c.c); s = c.rest; }
      if (!keep) { todo.set(n, N(n) - 1); if (!todo.get(n)) todo.delete(n); }
      doStmt(s.replace(/;\s*$/, ''));
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.Esolangs;
