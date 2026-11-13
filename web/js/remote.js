// Settings › Phone access: the page that switches the phone server (lib/remote.js) on and off, sets the PIN, shows the
// address to open on the phone, and explains how to switch the PC on from far away (Wake-on-LAN, or a smart plug).
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function render(box) {
    if (!box) return;
    let s; try { s = await A.api('/api/remote'); } catch (e) { box.textContent = 'Could not reach Moundshroud.'; return; }
    const opt = (v, t, dis) => '<label class="chk" style="display:block;margin:4px 0"><input type="radio" name="rmmode" value="' + v + '"' + (s.mode === v ? ' checked' : '') + (dis ? ' disabled' : '') + '> ' + t + '</label>';
    const ts = s.tailscale.ip ? 'Tailscale address ' + s.tailscale.ip : s.tailscale.installed ? 'Tailscale is installed but not connected: open it from the tray and sign in' : 'Tailscale is not installed (free from tailscale.com; you make the account)';
    box.innerHTML = '<div style="line-height:1.55">' +
      '<div class="small mute" style="margin-bottom:10px">Talk to Moundshroud\'s AI and agents from your phone: chat, make pictures, approve the agent\'s commands, see routine results. Off until you switch it on. Your phone opens a page served by this PC; nothing goes through anyone else\'s server.</div>' +
      (s.listening.length ? '<div class="card" style="margin:0 0 10px;border-color:var(--ok)"><b>On.</b> Open this on your phone' + (s.listening.length > 1 ? ' (either one)' : '') + ':' + s.listening.map(l => '<div style="font-size:18px;margin:6px 0"><b>' + esc(l.url) + '</b> <span class="small mute">' + (l.kind === 'lan' ? 'at home (same Wi-Fi)' : 'anywhere (Tailscale on the phone)') + '</span> <button class="ib" data-copy="' + esc(l.url) + '">Copy</button>' + (l.error ? '<div class="small bad">' + esc(l.error) + '</div>' : '') + '</div>').join('') + '<div class="small mute">Then add it to the home screen (Share › Add to Home Screen) for an app icon.</div></div>' : '') +
      '<div class="card" style="margin:0 0 10px"><b>1. PIN</b> ' + (s.hasPin ? '<span class="small mute">· set</span>' : '<span class="small bad">· not set yet</span>') + '<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap"><input id="rmpin" type="password" inputmode="numeric" maxlength="12" placeholder="6 to 12 digits" style="width:160px"><button class="ib" id="rmpinb">' + (s.hasPin ? 'Change PIN' : 'Set PIN') + '</button><span class="small mute" id="rmpinm"></span></div><div class="small mute" style="margin-top:4px">Changing the PIN signs every phone out. 5 wrong tries lock that phone out for 15 minutes.</div></div>' +
      '<div class="card" style="margin:0 0 10px"><b>2. Where the phone can reach it from</b>' +
      opt('off', 'Off') + opt('lan', '🏠 Home Wi-Fi only <span class="small mute">(' + (s.lan.ip ? 'this PC is ' + esc(s.lan.ip) : 'no home network found') + ')</span>', !s.hasPin) +
      opt('tailscale', '🌐 Anywhere, with Tailscale <span class="small mute">(' + esc(ts) + ')</span>', !s.hasPin) + opt('both', '🏠 + 🌐 Both', !s.hasPin) +
      '<div class="small mute" style="margin-top:4px">Port <input id="rmport" type="number" value="' + s.port + '" style="width:90px"> <span id="rmmsg"></span></div></div>' +
      '<div class="card small" style="margin:0 0 10px"><b>Good to know</b><ul style="margin:4px 0 0;padding-left:18px">' +
      '<li>The first time, Windows asks whether Node.js may use the network. Tick <b>Private networks</b> only.</li>' +
      '<li>Home Wi-Fi: the connection is not encrypted inside your home network, so use it only on a network you trust. Tailscale encrypts everything end to end.</li>' +
      '<li>For Tailscale away from home: install Tailscale on the phone too and sign in with the same account.</li>' +
      '<li>While phone access is on, Moundshroud keeps running in the background after you close its window. <b>Quit</b> in the tray icon menu stops it. Switch on <b>Start with Windows</b> in that menu so it is ready after a restart.</li>' +
      '<li>The PC must be on and awake. If it sleeps, the phone cannot reach it (see below).</li>' +
      '<li>' + s.phones + ' phone' + (s.phones === 1 ? ' is' : 's are') + ' signed in. <button class="ib" id="rmforget">Sign out all phones</button></li></ul></div>' +
      '<details class="card small" style="margin:0"><summary><b>Switching the PC on from far away</b></summary><div style="margin-top:6px">' +
      '<p>An AI cannot live in the BIOS: the BIOS is a tiny chip that only starts the PC, with no room or power for a model. When the PC is off, nothing on it runs. Two things <i>can</i> switch it on for you:</p>' +
      '<p><b>A. Smart plug (simplest, works over Wi-Fi):</b> in the BIOS set <i>Restore on AC power loss</i> (or <i>AC Recovery</i>) to <b>Power On</b>. Plug the PC into a smart plug. Switching the plug off and on from its phone app starts the PC. Only do this when the PC is already shut down.</p>' +
      '<p><b>B. Wake-on-LAN (needs an Ethernet cable):</b> 1) In the BIOS, enable <i>Wake on LAN</i> / <i>Power on by PCI-E</i>. 2) In Windows Device Manager › Network adapters › your Ethernet adapter › Properties › Power Management, tick <i>Allow this device to wake the computer</i> and <i>Only allow a magic packet</i>; on the Advanced tab enable <i>Wake on Magic Packet</i>. 3) Turn off Fast Startup (Control Panel › Power Options › Choose what the power buttons do). 4) Something on your home network must send the wake-up packet: many routers have a Wake-on-LAN page in their app, or an always-on device (an old phone or a Raspberry Pi with Tailscale) can. Most Wi-Fi adapters cannot be woken this way.</p>' +
      '<p>Moundshroud cannot change BIOS or Windows power settings for you: those are yours to set.</p>' +
      (s.adapters.length ? '<p>This PC\'s network adapters (a wake-up app asks for the MAC address of the Ethernet one):</p><ul>' + s.adapters.map(a => '<li>' + esc(a.name) + ': MAC <b>' + esc(a.mac) + '</b>, address ' + esc(a.ip) + '</li>').join('') + '</ul>' : '') +
      '</div></details></div>';
    const $ = id => box.querySelector('#' + id);
    box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => A.copy(b.dataset.copy));
    $('rmpinb').onclick = async () => { const r = await A.api('/api/remote/pin', { pin: $('rmpin').value }); if (!r.ok) { $('rmpinm').textContent = r.error; return; } A.toast('PIN saved'); render(box); };
    box.querySelectorAll('[name=rmmode]').forEach(x => x.onchange = async () => { $('rmmsg').textContent = 'Switching…'; const r = await A.api('/api/remote/config', { mode: x.value }); if (!r.ok) { $('rmmsg').textContent = r.error; return; } render(box); });
    $('rmport').onchange = async () => { const r = await A.api('/api/remote/config', { port: +$('rmport').value }); if (!r.ok) $('rmmsg').textContent = r.error; else render(box); };
    $('rmforget').onclick = async () => { if (!confirm('Sign every phone out? They will need the PIN again.')) return; await A.api('/api/remote/forget', {}); render(box); };
  }
  A.remotePage = render;
})();
