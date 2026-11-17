// Cyber > 🔬 Reverse engineering lab: open a program file (.exe, .dll, .sys, .elf, any binary) and take it apart
// right here on this PC — the format, the 32/64-bit target, the compile date, the sections and their entropy, the
// imports and exports it asks Windows/Linux for, every readable string, and a hex view. Nothing is uploaded and the
// file is never run: this only reads the bytes you pick.
(() => {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nb = n => Number(n).toLocaleString('en-US');
  const bs = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' bytes';

  /* ---------- the readers (plain functions, so the tests can check them without a browser) ---------- */
  const hex = n => '0x' + (n >>> 0).toString(16).padStart(8, '0');
  const strz = (buf, off, max) => {
    if (off < 0 || off >= buf.length) return '';
    let s = ''; const end = Math.min(buf.length, off + (max || 64));
    for (let i = off; i < end; i++) { const b = buf[i]; if (!b) break; if (b < 32 || b > 126) return s ? s : ''; s += String.fromCharCode(b); }
    return s;
  };
  /* Shannon entropy of a run of bytes: near 8 means it looks compressed or encrypted, near 0 means padding or text */
  function entropy(buf, from, len) {
    from = from || 0; len = len == null ? buf.length : len;
    if (!len) return 0;
    const seen = new Uint32Array(256);
    for (let i = 0; i < len; i++) seen[buf[from + i] & 255]++;
    let e = 0;
    for (let i = 0; i < 256; i++) if (seen[i]) { const p = seen[i] / len; e -= p * Math.log2(p); }
    return e;
  }
  const MACHINES = { 0x14c: 'x86 (Intel 386)', 0x8664: 'x86 (x64)', 0x1c0: 'ARM', 0xaa64: 'ARM (ARM64)', 0x1666: 'MIPS', 0x1f0: 'PowerPC' };
  const SUBSYS = { 1: 'driver (native)', 2: 'desktop program (windows)', 3: 'console program', 9: 'Windows CE', 10: 'EFI application' };

  /* PE (Windows .exe/.dll/.sys): headers, sections, imports, exports, .NET flag */
  function peInfo(buf) {
    if (buf.length < 0x40 || buf[0] !== 0x4d || buf[1] !== 0x5a) return null;               // 'MZ'
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const u16 = o => (o + 2 <= buf.length ? dv.getUint16(o, true) : 0), u32 = o => (o + 4 <= buf.length ? dv.getUint32(o, true) : 0);
    const peOff = u32(0x3c);
    if (peOff + 24 > buf.length || u32(peOff) !== 0x4550) return null;                       // 'PE\0\0'
    const coff = peOff + 4, machine = u16(coff), numSec = u16(coff + 2), stamp = u32(coff + 4), optSize = u16(coff + 16), chars = u16(coff + 18);
    const opt = coff + 20, magic = u16(opt), is64 = magic === 0x20b;
    const entry = u32(opt + 16), imageBase = u32(opt + (is64 ? 24 : 28));
    const subsystem = u16(opt + 68), numDirs = u32(opt + (is64 ? 108 : 92)), dirsOff = opt + (is64 ? 112 : 96);
    const dir = i => (i < numDirs && dirsOff + i * 8 + 8 <= buf.length ? { rva: u32(dirsOff + i * 8), size: u32(dirsOff + i * 8 + 4) } : { rva: 0, size: 0 });
    const sections = [];
    for (let i = 0; i < numSec; i++) {
      const o = opt + optSize + i * 40;
      if (o + 40 > buf.length) break;
      const rawSize = u32(o + 16), rawPtr = u32(o + 20);
      sections.push({ name: strz(buf, o, 8), vsize: u32(o + 8), va: u32(o + 12), rawSize, rawPtr, entropy: entropy(buf, Math.min(rawPtr, buf.length), Math.min(rawSize, buf.length - rawPtr)) });
    }
    const off = rva => { for (const s of sections) if (rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize)) return s.rawPtr + (rva - s.va); return 0; };
    /* the import table: which DLLs, and which function names inside each */
    const imports = [];
    const imp = dir(1);
    if (imp.rva) {
      let o = off(imp.rva);
      for (let guard = 0; o && o + 20 <= buf.length && guard < 400; guard++) {
        const nameRva = u32(o + 12), firstThunk = u32(o + 16), oft = u32(o);
        if (!nameRva && !firstThunk) break;
        const dll = strz(buf, off(nameRva), 64) || '?';
        const names = [];
        let t = off(oft || firstThunk);
        for (let k = 0; t && t + (is64 ? 8 : 4) <= buf.length && k < 4000; k++) {
          const v = is64 ? Number(dv.getBigUint64(t, true)) : u32(t);
          if (!v) break;
          if (is64 ? (v >> 63) : (v & 0x80000000)) names.push('#' + (v & 0xffff));
          else { const n = strz(buf, off(v >>> 0) + 2, 128); if (n) names.push(n); }
          t += is64 ? 8 : 4;
        }
        imports.push({ dll, names });
        o += 20;
      }
    }
    /* the export table: the functions this file offers to other programs */
    const exports = [];
    const exp = dir(0);
    if (exp.rva) {
      const e = off(exp.rva), numNames = u32(e + 24), namesRva = u32(e + 32);
      for (let i = 0; i < Math.min(numNames, 2000); i++) { const n = strz(buf, off(u32(off(namesRva) + i * 4)), 128); if (n) exports.push(n); }
    }
    const isDotNet = dir(14).size > 0;
    return {
      format: 'PE', bits: is64 ? 64 : 32, machine: MACHINES[machine] || hex(machine), subsystem: SUBSYS[subsystem] || ('type ' + subsystem),
      entry: imageBase + entry, imageBase, sections, imports, exports, isDotNet, timestamp: stamp ? new Date(stamp * 1000) : null,
      characteristics: chars
    };
  }

  /* ELF (Linux programs and libraries): class, machine, entry, sections */
  const ELF_MACH = { 3: '32-bit x86', 62: '64-bit x86 (x86-64)', 40: 'ARM', 183: '64-bit ARM (AArch64)', 243: 'RISC-V', 8: 'MIPS', 21: 'PowerPC', 22: 'PowerPC64' };
  function elfInfo(buf) {
    if (buf.length < 52 || buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) return null;   // '\177ELF'
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const is64 = buf[4] === 2, le = buf[5] !== 2;
    const u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
    const u64 = o => Number(dv.getBigUint64(o, le));
    const uptr = o => (is64 ? u64(o) : u32(o));
    const etype = u16(16), machine = u16(18), entry = uptr(24);
    const shoff = is64 ? u64(0x28) : u32(0x20), shentsize = u16(is64 ? 0x3a : 0x2e), shnum = u16(is64 ? 0x3c : 0x30), shstr = u16(is64 ? 0x3e : 0x32);
    const raw = [];
    for (let i = 0; i < shnum && shentsize; i++) {
      const o = shoff + i * shentsize; if (o + shentsize > buf.length) break;
      const nameOff = u32(o), type = u32(o + 4), addr = uptr(is64 ? o + 16 : o + 12), offset = uptr(is64 ? o + 24 : o + 16), size = uptr(is64 ? o + 32 : o + 20);
      raw.push({ nameOff, type, addr, offset, size });
    }
    const strtab = raw[shstr] || { offset: 0, size: 0 };
    const sections = raw.map(s => ({ name: s.nameOff ? strz(buf, strtab.offset + s.nameOff, 40) : '', type: s.type, addr: s.addr, size: s.size, entropy: entropy(buf, Math.min(s.offset, buf.length), Math.min(s.size, buf.length - s.offset)) })).filter(s => s.name || s.size);
    const interp = sections.find(s => s.name === '.interp');
    return {
      format: 'ELF', bits: is64 ? 64 : 32, endian: le ? 'little-endian' : 'big-endian', machine: ELF_MACH[machine] || ('type ' + machine),
      kind: { 1: 'relocatable object', 2: 'executable', 3: 'shared library', 4: 'core dump' }[etype] || ('type ' + etype),
      entry, sections, imports: [], exports: [], isDotNet: false, timestamp: null,
      interpreter: interp ? strz(buf, (raw.find(s => s.name === '.interp') || {}).offset || 0, 128) : ''
    };
  }

  /* every run of readable text in the file — where most of the clues live (error messages, URLs, API names) */
  function stringsOf(buf, min, cap) {
    min = min || 5; cap = cap || 40000;
    const out = []; let s = '', start = 0;
    for (let i = 0; i < buf.length && out.length < cap; i++) {
      const b = buf[i];
      if (b >= 32 && b <= 126) { if (!s) start = i; s += String.fromCharCode(b); }
      else { if (s.length >= min) out.push({ at: start, s }); s = ''; }
    }
    if (s.length >= min && out.length < cap) out.push({ at: start, s });
    return out;
  }

  const CLUES = ['VirtualAlloc', 'VirtualProtect', 'CreateRemoteThread', 'WriteProcessMemory', 'ReadProcessMemory', 'IsDebuggerPresent',
    'CheckRemoteDebuggerPresent', 'GetProcAddress', 'LoadLibrary', 'WinExec', 'ShellExecute', 'URLDownloadToFile', 'InternetOpen',
    'RegSetValue', 'RegCreateKey', 'CryptEncrypt', 'ws2_32', 'WSAStartup', 'socket', 'connect', 'CreateProcess', 'cmd.exe', 'powershell',
    '-enc', 'schtasks', 'net user', 'bcdedit', 'vssadmin', 'bitcoin', 'wallet', 'mimikatz', 'lsass', 'VMware', 'VirtualBox', 'vbox',
    'sandbox', 'Sleep', 'NtQueryInformationProcess', 'GetTickCount', 'UPX', 'pyinstaller', 'node.exe', 'electron'];
  const SENSITIVE = ['VirtualAlloc', 'VirtualProtect', 'CreateRemoteThread', 'WriteProcessMemory', 'IsDebuggerPresent', 'CheckRemoteDebuggerPresent',
    'URLDownloadToFile', 'WinExec', 'ShellExecute', 'RegSetValue', 'cmd.exe', 'powershell', '-enc', 'schtasks', 'vssadmin', 'lsass', 'mimikatz'];

  /* the whole picture: format, sections, imports, clues — what the lab shows at the top */
  function analyze(buf) {
    const pe = peInfo(buf), elf = elfInfo(buf);
    const info = pe || elf;
    let format = info ? info.format : 'unknown';
    if (!info) {
      if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) format = 'ELF';
      else if (buf[0] === 0xca && buf[1] === 0xfe && buf[2] === 0xba && buf[3] === 0xbe) format = 'Java class or Mach-O fat binary';
      else if (buf[0] === 0x50 && buf[1] === 0x4b) format = 'ZIP archive (or a .jar/.docx/.apk)';
      else if (buf[0] === 0x23 && buf[1] === 0x21) format = 'script with a #! line';
    }
    const strings = stringsOf(buf, 5, 40000);
    const text = strings.map(x => x.s);
    const clues = CLUES.map(k => ({ k, n: text.filter(s => s.indexOf(k) >= 0).length })).filter(x => x.n);
    const sensitive = clues.filter(c => SENSITIVE.indexOf(c.k) >= 0);
    const high = (info ? info.sections : []).filter(s => s.entropy > 7.2 && s.size > 4096).map(s => s.name);
    const notes = [];
    if (high.length) notes.push('High-entropy sections (' + high.join(', ') + '): the data there looks compressed or encrypted — a sign of packing or an embedded archive.');
    if (sensitive.length) notes.push('Calls usually seen in things that install themselves or hide from analysis: ' + sensitive.map(c => c.k).join(', ') + '.');
    if (info && info.isDotNet) notes.push('This is a .NET program: its real code can be opened with a .NET decompiler (ILSpy, dnSpy).');
    if (info && info.format === 'PE' && !info.imports.length) notes.push('No import table: the file is packed or the table was stripped, so the function names are hidden until it unpacks.');
    if (!notes.length) notes.push('Nothing suspicious jumped out of the headers and strings. That is not a guarantee — it only means the easy signs are absent.');
    return { format, info, strings, clues, sensitive, highEntropy: high, notes, size: buf.length, empty: !buf.length };
  }

  /* ---------- the page ---------- */
  const CSS = `.rev-zone{border:1px dashed var(--line);border-radius:12px;padding:18px;text-align:center;background:var(--panel2);cursor:pointer}
.rev-zone:hover,.rev-zone.over{border-color:var(--acc);background:var(--panel)}
.rev-tbl{border-collapse:collapse;width:100%;font-size:12.5px;margin-top:6px}.rev-tbl th,.rev-tbl td{border:1px solid var(--line);padding:3px 7px;text-align:left}
.rev-tbl th{background:var(--panel2);font-weight:600}.rev-tbl td.mono{font-family:Consolas,"Cascadia Mono",monospace}
.rev-hex{font-family:Consolas,"Cascadia Mono",monospace;font-size:12px;white-space:pre;overflow:auto;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px;line-height:1.45}
.rev-hex .o{color:var(--mute)}.rev-hex .a{color:var(--acc)}
.rev-kv{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:13px;margin:8px 0}.rev-kv b{color:var(--mute);font-weight:600}
.rev-str{max-height:260px;overflow:auto;font-family:Consolas,"Cascadia Mono",monospace;font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 8px;white-space:pre-wrap;word-break:break-all}
.rev-str div{padding:1px 0}.rev-str div:hover{background:var(--panel)}
.rev-str .hit{background:var(--acc);color:#fff}.rev-bad{color:var(--bad,#e5484d)}.rev-ok{color:var(--ok,#30a46c)}.rev-mute{color:var(--mute)}
.rev-note{border-left:3px solid var(--acc);padding:4px 10px;margin:6px 0;background:var(--panel2);font-size:12.5px;line-height:1.5}`;
  const inject = () => { if (!document.getElementById('cyberrev-css')) { const s = document.createElement('style'); s.id = 'cyberrev-css'; s.textContent = CSS; document.head.appendChild(s); } };
  const wrap = (el, inner) => { el.innerHTML = '<div class="lab"><div class="lab-wrap" style="max-width:1000px">' + inner + '</div></div>'; return el.querySelector('.lab-wrap'); };
  const MAXREAD = 8 * 1024 * 1024;      /* a very big file: the first 8 MB still shows every header, and keeps the page quick */

  function re(el) {
    inject();
    const w = wrap(el, '<h2>🔬 Reverse engineering lab</h2><div class="sub">Open a program — an <b>.exe</b>, <b>.dll</b>, <b>.sys</b>, <b>.elf</b>, <b>.so</b> or any binary file — and Moundshroud takes it apart on this PC: what kind of file it is, whether it is 32- or 64-bit, the sections inside and how scrambled each one looks, the Windows/Linux functions it asks for, every readable string, and a hex view. Nothing is uploaded, nothing is run.<br><br><b>Why bother:</b> this is the first, safe half of reverse engineering — reading a program without executing it. It is how people check whether a downloaded file is packed, what a program talks to, and what it is really made of.</div>' +
      '<div class="rev-zone" id="rev-drop"><b>📂 Drop a program file here</b><div class="small mute" style="margin-top:4px">or click to choose one — it is read on this PC and never sent anywhere</div><input type="file" id="rev-file" style="display:none"><div class="small" id="rev-name" style="margin-top:8px"></div></div>' +
      '<div id="rev-out" style="margin-top:14px"></div>' +
      '<div class="note" style="margin-top:14px">Only your own files: read programs you downloaded or wrote. Taking apart software you do not own may break its licence, and patching it to get round a payment is a crime.</div>');
    const out = w.querySelector('#rev-out'), nameEl = w.querySelector('#rev-name'), zone = w.querySelector('#rev-drop'), file = w.querySelector('#rev-file');
    let page = 0, last = null;
    const pick = () => file.click();
    zone.onclick = e => { if (e.target === file) return; pick(); };
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); };
    file.onchange = () => { if (file.files[0]) read(file.files[0]); };

    function read(f) {
      nameEl.innerHTML = esc(f.name) + ' <span class="rev-mute">· ' + bs(f.size) + '</span>';
      out.innerHTML = '<div class="rev-mute">Reading…</div>';
      const fr = new FileReader();
      fr.onerror = () => { out.innerHTML = '<div class="rev-bad">That file could not be read.</div>'; };
      fr.onload = () => { try { show(f.name, new Uint8Array(fr.result)); } catch (err) { out.innerHTML = '<div class="rev-bad">That file could not be taken apart: ' + esc(err.message) + '</div>'; } };
      fr.readAsArrayBuffer(f.slice(0, MAXREAD));
    }

    function show(fname, buf) {
      if (!buf.length) { out.innerHTML = '<div class="rev-bad">That file is empty.</div>'; return; }
      const a = analyze(buf); last = { buf, a }; page = 0;
      const info = a.info || {};
      const secs = info.sections || [];
      const rows = secs.map(s => '<tr><td>' + esc(s.name || '—') + '</td><td class="mono">' + (s.va != null ? hex(s.va) : hex(s.addr || 0)) + '</td><td class="mono">' + bs(s.rawSize != null ? s.rawSize : s.size || 0) + '</td><td class="mono">' + s.entropy.toFixed(2) + '</td><td>' + (s.entropy > 7.2 ? '<span class="rev-bad">packed or encrypted?</span>' : s.entropy > 6 ? 'compressed data?' : s.entropy < 1 ? 'empty or padding' : 'normal code/data') + '</td></tr>').join('');
      const imp = (info.imports || []).map(i => '<tr><td class="mono">' + esc(i.dll) + '</td><td class="mono" style="font-size:11.5px">' + i.names.slice(0, 14).map(esc).join(', ') + (i.names.length > 14 ? ' … (' + (i.names.length - 14) + ' more)' : '') + '</td></tr>').join('');
      out.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">' +
        '<div class="card"><h4 style="margin:0 0 4px">What it is</h4><div class="rev-kv">' +
        '<b>File</b><span>' + esc(fname) + '</span><b>Size</b><span>' + bs(a.size) + (a.size >= MAXREAD ? ' <span class="rev-mute">(first ' + bs(MAXREAD) + ' read)</span>' : '') + '</span>' +
        '<b>Format</b><span>' + esc(a.format) + (info.kind ? ' — ' + esc(info.kind) : '') + '</span>' +
        (info.bits ? '<b>Built for</b><span>' + info.bits + '-bit' + (info.machine ? ', ' + esc(info.machine) : '') + '</span>' : '') +
        (info.subsystem ? '<b>Kind</b><span>' + esc(info.subsystem) + '</span>' : '') +
        (info.timestamp ? '<b>Compiled</b><span>' + esc(info.timestamp.toISOString().slice(0, 10)) + ' <span class="rev-mute">(the date the compiler wrote in; it can be faked)</span></span>' : '') +
        (info.entry != null ? '<b>Entry point</b><span class="mono">' + hex(info.entry) + '</span>' : '') +
        (info.interpreter ? '<b>Loader</b><span class="mono">' + esc(info.interpreter) + '</span>' : '') +
        '<b>Strings</b><span>' + nb(a.strings.length) + ' readable runs</span>' +
        '</div></div>' +
        '<div class="card"><h4 style="margin:0 0 4px">What stands out</h4>' + a.notes.map(n => '<div class="rev-note">' + esc(n) + '</div>').join('') +
        (a.clues.length ? '<div style="margin-top:8px;font-size:12px">Names found inside: ' + a.clues.slice(0, 18).map(c => '<span class="ct-tag" style="display:inline-block;margin:2px 3px 0 0;padding:1px 6px;border:1px solid var(--line);border-radius:6px">' + esc(c.k) + (c.n > 1 ? ' ×' + c.n : '') + '</span>').join('') + '</div>' : '') +
        '</div></div>' +
        (secs.length ? '<h4 style="margin:16px 0 2px">Sections inside</h4><table class="rev-tbl"><tr><th>Section</th><th>Where</th><th>Size</th><th>Scramble (0–8)</th><th>Looks like</th></tr>' + rows + '</table>' : '') +
        (imp ? '<h4 style="margin:16px 0 2px">What it asks the system for (' + info.imports.length + ' libraries)</h4><table class="rev-tbl"><tr><th>Library</th><th>Functions</th></tr>' + imp + '</table>' : '') +
        ((info.exports || []).length ? '<h4 style="margin:16px 0 2px">What it offers (' + info.exports.length + ' exports)</h4><div class="rev-str" style="max-height:120px">' + info.exports.slice(0, 300).map(esc).join('<br>') + '</div>' : '') +
        '<h4 style="margin:16px 0 2px">Readable strings</h4><div class="row" style="gap:6px;margin-bottom:6px"><input id="rev-filter" placeholder="filter… (try: http, .dll, error, password)" style="flex:1;min-width:160px" spellcheck="false"><span class="small rev-mute" id="rev-count"></span></div>' +
        '<div class="rev-str" id="rev-strs"></div>' +
        '<h4 style="margin:16px 0 2px">Hex view</h4><div class="row" style="gap:6px;margin-bottom:6px"><button class="ib2" id="rev-prev">← earlier</button><button class="ib2" id="rev-next">later →</button><input id="rev-jump" placeholder="jump to offset (e.g. 0x400 or 1024)" style="width:220px" spellcheck="false"><span class="small rev-mute" id="rev-pos"></span></div><div class="rev-hex" id="rev-hex"></div>';

      const strs = out.querySelector('#rev-strs'), count = out.querySelector('#rev-count'), filter = out.querySelector('#rev-filter');
      const drawStrs = () => {
        const q = filter.value.trim().toLowerCase(), list = q ? a.strings.filter(x => x.s.toLowerCase().indexOf(q) >= 0) : a.strings;
        count.textContent = nb(list.length) + ' of ' + nb(a.strings.length);
        strs.innerHTML = list.slice(0, 600).map(x => '<div><span class="rev-mute">' + ('00000000' + x.at.toString(16)).slice(-8) + '</span>  ' + (q ? esc(x.s).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<span class="hit">$1</span>') : esc(x.s)) + '</div>').join('') + (list.length > 600 ? '<div class="rev-mute">…and ' + nb(list.length - 600) + ' more (type in the filter to narrow it down)</div>' : '');
      };
      filter.oninput = drawStrs; drawStrs();

      const hexEl = out.querySelector('#rev-hex'), pos = out.querySelector('#rev-pos');
      const drawHex = () => {
        const per = 512, from = page * per, to = Math.min(buf.length, from + per);
        let s = '';
        for (let o = from; o < to; o += 16) {
          const row = []; let asc = '';
          for (let i = 0; i < 16 && o + i < to; i++) { const b = buf[o + i]; row.push(('0' + b.toString(16)).slice(-2)); asc += b >= 32 && b < 127 ? esc(String.fromCharCode(b)) : '.'; }
          s += '<span class="o">' + ('00000000' + o.toString(16)).slice(-8) + '</span>  <span class="a">' + row.slice(0, 8).join(' ') + '</span>  ' + row.slice(8).join(' ') + '  |' + asc + '|\n';
        }
        hexEl.innerHTML = s; pos.textContent = bs(from) + ' – ' + bs(to) + ' of ' + bs(buf.length);
      };
      out.querySelector('#rev-prev').onclick = () => { if (page > 0) { page--; drawHex(); } };
      out.querySelector('#rev-next').onclick = () => { if ((page + 1) * 512 < buf.length) { page++; drawHex(); } };
      out.querySelector('#rev-jump').onkeydown = e => {
        if (e.key !== 'Enter') return;
        const v = e.target.value.trim(), n = /^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10);
        if (!isNaN(n) && n >= 0 && n < buf.length) { page = Math.floor(n / 512); drawHex(); } else A.notify && A.notify('warn', 'That offset is not inside the file.');
      };
      drawHex();
    }

    /* the AI in Chat can use this on a file too (web/js/actions.js) */
    A.cyberRev = { analyze: (bytes) => analyze(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)), last: () => last };
  }

  const API = { analyze, peInfo, elfInfo, stringsOf, entropy, hex };
  if (typeof A !== 'undefined') { A.cyberLabs = Object.assign(A.cyberLabs || {}, { re }); }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
