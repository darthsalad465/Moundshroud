// PC commands from chat: "open spotify", "volume 30", "mute", "lock my screen". Always asks you to confirm first.
(() => {
  function match(t) {
    t = (t || '').trim().replace(/[.!]+$/, ''); let m;
    if (/^(please\s+)?(lock)( my| the)?( screen| pc| computer| laptop)?$/i.test(t)) return { kind: 'lock' };
    if (/^(please\s+)?(un)?mute( the)?( sound| volume| audio| pc| computer)?$/i.test(t)) return { kind: /un/i.test(t) ? 'unmute' : 'mute' };
    if ((m = t.match(/^(?:please\s+)?(?:set |turn |put )?(?:the )?(?:volume|sound)(?: to| at)?\s+(\d{1,3})\s*%?$/i))) return { kind: 'volume', mode: 'set', value: Math.min(100, +m[1]) };
    if ((m = t.match(/^(?:please\s+)?(?:turn |make )?(?:the )?(?:volume|sound)?\s*(up|down)(?:\s+(?:a bit|a little|by (\d{1,2}))%?)?$/i)) && /volume|sound|louder|quieter/i.test(t)) return { kind: 'volume', mode: m[1].toLowerCase(), value: m[2] ? +m[2] : 10 };
    if (/^(please\s+)?(turn it up|louder|volume up)$/i.test(t)) return { kind: 'volume', mode: 'up', value: 10 };
    if (/^(please\s+)?(turn it down|quieter|volume down)$/i.test(t)) return { kind: 'volume', mode: 'down', value: 10 };
    if ((m = t.match(/^(?:please\s+)?(?:open|launch|start|run)\s+(?!the\b|my\b|a\b|an\b|this\b|that\b|library\b|notes?\b|chat\b|study\b)([\w .&+'-]{2,40})$/i))) return { kind: 'app', name: m[1].trim() };
    return null;
  }
  function confirm(title, body, yes) {
    return new Promise(res => {
      A.dlg('<div class="hd"><b>' + esc(title) + '</b></div><div class="bd"><div style="margin:2px 0 14px">' + body + '</div><div class="row"><span class="sp"></span><button class="ib" id="pcn">Cancel</button><button class="pri" id="pcy">' + esc(yes) + '</button></div></div>');
      $('pcy').focus(); $('pcy').onclick = () => { A.closeDlg(); res(true); }; $('pcn').onclick = () => { A.closeDlg(); res(false); };
    });
  }
  const post = b => A.api('/api/pc', b);
  async function ask(c, say) {
    if (c.kind === 'app') {
      const r = await A.api('/api/pc/find?name=' + encodeURIComponent(c.name)); const ms = r.matches || [];
      if (!ms.length) return say('assistant', 'I could not find an app called **' + c.name + '** in your Start menu.');
      let pick = ms[0];
      if (ms.length > 1 && ms[0].Name.toLowerCase() !== c.name.toLowerCase()) {
        const choice = await new Promise(res => { A.dlg('<div class="hd"><b>Which one?</b></div><div class="bd">' + ms.map((a, i) => '<div class="hit" data-i="' + i + '"><b>' + esc(a.Name) + '</b></div>').join('') + '<div class="row" style="margin-top:8px"><span class="sp"></span><button class="ib" id="pcn">Cancel</button></div></div>'); $('dlg').onclick = e => { const h = e.target.closest('.hit'); if (h) { A.closeDlg(); res(ms[+h.dataset.i]); } }; $('pcn').onclick = () => { A.closeDlg(); res(null); }; });
        if (!choice) return say('assistant', 'Okay, I will leave it.'); pick = choice;
      } else if (!(await confirm('Open ' + pick.Name + '?', 'Moundshroud will launch <b>' + esc(pick.Name) + '</b> on this PC.', 'Open'))) return say('assistant', 'Okay, cancelled.');
      const o = await post({ do: 'open', id: pick.AppID }); return say('assistant', o.ok ? 'Opening **' + pick.Name + '**.' : 'That did not work: ' + (o.error || 'unknown error'));
    }
    if (c.kind === 'lock') { if (!(await confirm('Lock this PC?', 'Your screen will lock now. You will need your password or PIN.', 'Lock'))) return say('assistant', 'Okay, cancelled.'); await post({ do: 'lock' }); return say('assistant', 'Locking.'); }
    const label = c.kind === 'mute' ? 'Mute the sound?' : c.kind === 'unmute' ? 'Unmute the sound?' : c.mode === 'set' ? 'Set the volume to ' + c.value + '%?' : 'Turn the volume ' + c.mode + '?';
    if (!(await confirm(label, 'This changes your PC speaker volume.', 'Do it'))) return say('assistant', 'Okay, cancelled.');
    const o = await post({ do: 'volume', mode: c.kind === 'volume' ? c.mode : c.kind, value: c.value });
    say('assistant', o.error ? o.error : (o.muted ? 'Muted.' : 'Volume is now **' + o.level + '%**.'));
  }
  A.pc = { match, ask };
})();
