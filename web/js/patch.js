// Small edits to code the AI already wrote: A.patch.parse() reads the edits out of a model reply, A.patch.apply() puts
// them into the file. Studio > Game maker and Studio > Game Studio use this when the AI fixes a bug, so it debugs the
// code it wrote instead of writing the whole game again. An edit is { find, replace, file? }: "find" is a short exact
// copy of the code that is wrong, "replace" what it becomes. A reply the model garbles is tried every way it might read.
(() => {
  const norm = s => String(s == null ? '' : s).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();

  /* the edits out of a reply: a JSON object ({"edits":[...]}), a JSON array, or FIND/REPLACE blocks */
  function parse(reply) {
    const t = String(reply || '');
    const pieces = [];
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t); if (fence) pieces.push(fence[1]);
    let a = t.indexOf('{'), z = t.lastIndexOf('}'); if (a >= 0 && z > a) pieces.push(t.slice(a, z + 1));
    a = t.indexOf('['); z = t.lastIndexOf(']'); if (a >= 0 && z > a) pieces.push(t.slice(a, z + 1));
    for (const p of pieces) {
      let j;
      try { j = JSON.parse(p); } catch (e) { try { j = JSON.parse(p.replace(/,\s*([}\]])/g, '$1')); } catch (x) { continue; } }   // a trailing comma is the commonest slip
      const arr = Array.isArray(j) ? j : (j && Array.isArray(j.edits) ? j.edits : (j && typeof j.find === 'string' ? [j] : null));
      if (arr && arr.length) { const out = clean(arr); if (out.length) return out; }
    }
    /* blocks, for a model that cannot hold JSON together: === FIND === / === REPLACE === */
    const parts = t.split(/(?:^|\n)\s*(?:===+\s*FIND\s*===+|<<<\s*FIND\s*>>>)\s*\n/i).slice(1);
    const blocks = [];
    for (const part of parts) {
      const sp = part.split(/(?:^|\n)\s*(?:===+\s*REPLACE\s*===+|<<<\s*REPLACE\s*>>>)\s*\n/i);
      if (sp.length < 2) continue;
      const find = sp[0].replace(/^\s*\n/, '').replace(/\n\s*$/, '');
      const replace = sp[1].split(/(?:^|\n)\s*(?:===+\s*(?:FIND|END)\s*===+|<<<\s*END\s*>>>)/i)[0].replace(/^\s*\n/, '').replace(/\n\s*$/, '');
      if (find.trim()) blocks.push({ find, replace });
    }
    return blocks.length ? clean(blocks) : null;
  }

  function clean(list) {
    return list.filter(e => e && typeof e === 'object' && typeof e.find === 'string' && e.find.trim() && (typeof e.replace === 'string' || e.replace == null))
      .map(e => ({ file: typeof e.file === 'string' ? e.file.replace(/^res:\/\//, '').trim() : '', find: e.find.replace(/^\n/, '').replace(/\n$/, ''), replace: String(e.replace == null ? '' : e.replace).replace(/^\n/, '').replace(/\n$/, '') }));
  }

  /* put one edit into the text: the exact spot first, then the same lines with different spacing or indentation */
  function one(text, e) {
    const find = String(e.find || '');
    if (!find.trim()) return null;
    const at = text.indexOf(find);
    if (at >= 0) return text.slice(0, at) + e.replace + text.slice(at + find.length);
    const fLines = find.split('\n');
    while (fLines.length && !fLines[0].trim()) fLines.shift();
    while (fLines.length && !fLines[fLines.length - 1].trim()) fLines.pop();
    if (!fLines.length) return null;
    const key = fLines.map(norm), src = text.split('\n'), flat = src.map(norm);
    for (let s = 0; s + key.length <= flat.length; s++) {
      let k = 0; while (k < key.length && flat[s + k] === key[k]) k++;
      if (k < key.length) continue;
      const indent = (src[s].match(/^[ \t]*/) || [''])[0], rep = e.replace.split('\n');
      const lines = rep.map((l, i) => (i === 0 || !l.trim()) ? l : indent + l.replace(/^[ \t]*/, ''));
      return src.slice(0, s).concat(lines, src.slice(s + key.length)).join('\n');
    }
    return null;
  }

  /* the file with every edit that fits applied; the ones that do not fit are reported, never guessed at */
  function apply(src, edits) {
    let text = String(src == null ? '' : src);
    const used = [], missed = [];
    for (const e of edits || []) {
      const r = one(text, e);
      if (r == null) missed.push(e); else { text = r; used.push(e); }
    }
    return { text, applied: used.length, used, missed };
  }

  /* the same for a project of files: an edit says which file it belongs to; one without a file goes to the file it fits */
  function applyFiles(files, edits) {
    const out = {}; for (const k of Object.keys(files || {})) out[k] = String(files[k]);
    const changed = [], missed = [];
    for (const e of edits || []) {
      const want = String(e.file || '').replace(/^res:\/\//, '').replace(/^\/+/, '');   // the model may write res://player.gd
      const pool = want ? (out[want] != null ? [want] : Object.keys(out).filter(p => p === want || p.endsWith('/' + want))) : Object.keys(out);
      let hit = '';
      if (pool.length) { for (const p of pool) { const r = one(out[p], e); if (r != null) { out[p] = r; hit = p; break; } } }
      if (hit) { if (!changed.includes(hit)) changed.push(hit); } else missed.push(e);
    }
    return { files: out, changed, missed };
  }
  /* how many lines an edit really changed, for the message after it */
  const lines = (a, b) => String(b || '').split('\n').length - String(a || '').split('\n').length;

  A.patch = { parse, apply, applyFiles, lines };
})();
