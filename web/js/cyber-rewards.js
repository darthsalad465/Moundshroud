// Cyber Desktop > the Surplus Vault. A shop on the fake internet where the practice bank's money buys things
// that are not just paint: apps that appear on this desktop, cosmetics for the shell itself, and the one
// expensive purchase that ends the fake pop-up virus for good. Everything here is invented, toytown content
// in this page; nothing is real, downloaded or contacted.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bank = () => (typeof A !== 'undefined' && A && A.cyberBank) || null;
  const money = n => (bank() ? bank().money(n) : '$' + Number(n || 0).toFixed(2));
  const api = () => (A.cyberDesktop && A.cyberDesktop.api) || {};
  const pad = n => String(n).padStart(2, '0');
  const el = (body, html) => { body.innerHTML = '<div class="cd-content cd-vault">' + html + '</div>'; return body.firstElementChild; };
  const val = (root, sel) => { const n = root.querySelector(sel); return n ? n.value : ''; };
  const copy = text => {
    try { navigator.clipboard.writeText(String(text)); A.toast && A.toast('Copied.'); }
    catch (e) { A.toast && A.toast('Copy is not available in this window.'); }
  };

  /* ---------------------------------------------------------------- unlockable apps -----------------------
     Each one is a real, small tool that runs in this window. They are locked until the Vault is paid for them. */
  const APPS = [
    {
      id: 'clock', glyph: '⏰', name: 'Clock & World Time', price: 180,
      blurb: 'Local time, the date, and seven world clocks derived from your own clock.',
      run(body) {
        const root = el(body, '<h2>Clock &amp; World Time</h2><p class="mute">Seven cities, computed from this machine’s clock.</p>' +
          '<div class="v-clock-main"><b data-now>—</b><span data-day></span></div><div class="v-rows" data-zones></div>');
        const zones = [['UTC', 0], ['London', 1], ['Berlin', 2], ['New York', -4], ['Denver', -6], ['Tokyo', 9], ['Sydney', 11]];
        const paint = () => {
          const now = new Date();
          const utc = now.getTime() + now.getTimezoneOffset() * 60000;
          root.querySelector('[data-now]').textContent = now.toLocaleTimeString();
          root.querySelector('[data-day]').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          root.querySelector('[data-zones]').innerHTML = zones.map(([name, off]) => {
            const d = new Date(utc + off * 3600000);
            return '<div class="v-row-item"><span>' + esc(name) + '</span><b>' +
              esc(d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })) +
              '</b><small>' + esc(d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })) + '</small></div>';
          }).join('');
        };
        paint();
        const timer = setInterval(paint, 1000);
        return () => clearInterval(timer);
      }
    },
    {
      id: 'stopwatch', glyph: '⏱', name: 'Stopwatch', price: 220,
      blurb: 'Start, pause, lap and reset. Hundredths, not guesses.',
      run(body) {
        const root = el(body, '<h2>Stopwatch</h2><p class="mute">Timing that keeps running while you look at something else.</p>' +
          '<div class="v-big" data-time>0:00.00</div><div class="v-row"><button type="button" class="cd-primary" data-go>Start</button>' +
          '<button type="button" data-lap>Lap</button><button type="button" data-reset>Reset</button></div><ol class="v-list" data-laps></ol>');
        const show = () => {
          const s = elapsed / 1000;
          return Math.floor(s / 60) + ':' + pad(Math.floor(s % 60)) + '.' + pad(Math.floor((elapsed % 1000) / 10));
        };
        let elapsed = 0, timer = null;
        const paint = () => { root.querySelector('[data-time]').textContent = show(); };
        const go = root.querySelector('[data-go]');
        go.onclick = () => {
          if (timer) { clearInterval(timer); timer = null; go.textContent = 'Start'; return; }
          go.textContent = 'Pause';
          const base = Date.now() - elapsed;
          timer = setInterval(() => { elapsed = Date.now() - base; paint(); }, 40);
        };
        root.querySelector('[data-lap]').onclick = () => {
          const row = document.createElement('li');
          row.textContent = show();
          root.querySelector('[data-laps]').append(row);
        };
        root.querySelector('[data-reset]').onclick = () => {
          clearInterval(timer); timer = null; elapsed = 0; go.textContent = 'Start';
          paint(); root.querySelector('[data-laps]').replaceChildren();
        };
        paint();
        return () => clearInterval(timer);
      }
    },
    {
      id: 'countdown', glyph: '⏳', name: 'Countdown', price: 260,
      blurb: 'A timer that says when it is done, so you can look away.',
      run(body) {
        const root = el(body, '<h2>Countdown</h2><div class="v-row"><label class="v-field">Minutes' +
          '<input type="number" min="0" max="600" value="5" data-min></label><label class="v-field">Seconds' +
          '<input type="number" min="0" max="59" value="0" data-sec></label></div>' +
          '<div class="v-big" data-left>5:00</div><div class="v-row"><button type="button" class="cd-primary" data-go>Start</button>' +
          '<button type="button" data-reset>Reset</button></div><p class="mute" data-say></p>');
        const say = root.querySelector('[data-say]');
        let end = 0, timer = null;
        const total = () => (Math.max(0, Number(val(root, '[data-min]')) || 0) * 60 + Math.max(0, Number(val(root, '[data-sec]')) || 0)) * 1000;
        const show = ms => {
          const s = Math.max(0, Math.ceil(ms / 1000));
          root.querySelector('[data-left]').textContent = Math.floor(s / 60) + ':' + pad(s % 60);
        };
        show(total());
        root.querySelector('[data-go]').onclick = () => {
          if (timer) { clearInterval(timer); timer = null; say.textContent = 'Paused.'; return; }
          if (total() <= 0) { say.textContent = 'Set a time first.'; return; }
          end = Date.now() + total();
          say.textContent = 'Counting down.';
          timer = setInterval(() => {
            const left = end - Date.now();
            show(left);
            if (left <= 0) {
              clearInterval(timer); timer = null;
              say.textContent = 'Time is up.';
              A.toast && A.toast('Countdown finished.');
            }
          }, 200);
        };
        root.querySelector('[data-reset]').onclick = () => {
          clearInterval(timer); timer = null; say.textContent = ''; show(total());
        };
        return () => clearInterval(timer);
      }
    },
    {
      id: 'calendar', glyph: '🗓', name: 'Calendar', price: 320,
      blurb: 'A month at a glance, Monday first, with today marked.',
      run(body) {
        const root = el(body, '<h2>Calendar</h2><div class="v-row v-between"><button type="button" data-prev>←</button>' +
          '<b data-month></b><button type="button" data-next>→</button></div><div class="v-cal" data-grid></div>');
        const at = new Date();
        at.setDate(1);
        const paint = () => {
          root.querySelector('[data-month]').textContent = at.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
          const days = new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate();
          const lead = (new Date(at.getFullYear(), at.getMonth(), 1).getDay() + 6) % 7;
          const today = new Date();
          const isThis = today.getFullYear() === at.getFullYear() && today.getMonth() === at.getMonth();
          let html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => '<b>' + d + '</b>').join('');
          for (let i = 0; i < lead; i++) html += '<i></i>';
          for (let d = 1; d <= days; d++) html += '<span' + (isThis && d === today.getDate() ? ' class="on"' : '') + '>' + d + '</span>';
          root.querySelector('[data-grid]').innerHTML = html;
        };
        root.querySelector('[data-prev]').onclick = () => { at.setMonth(at.getMonth() - 1); paint(); };
        root.querySelector('[data-next]').onclick = () => { at.setMonth(at.getMonth() + 1); paint(); };
        paint();
      }
    },
    {
      id: 'base64', glyph: '🔡', name: 'Base64 Codec', price: 140,
      blurb: 'Encode and decode text without mangling the accented letters.',
      run(body) {
        const root = el(body, '<h2>Base64 Codec</h2><p class="mute">UTF-8 in, UTF-8 out.</p>' +
          '<textarea rows="6" data-in placeholder="Type or paste text, or Base64…"></textarea>' +
          '<div class="v-row"><button type="button" class="cd-primary" data-encode>Encode</button>' +
          '<button type="button" data-decode>Decode</button><button type="button" data-copy>Copy result</button></div>' +
          '<textarea rows="6" data-out readonly aria-label="Result"></textarea>');
        const input = root.querySelector('[data-in]'), output = root.querySelector('[data-out]');
        root.querySelector('[data-encode]').onclick = () => {
          try {
            const bytes = new TextEncoder().encode(input.value);
            let raw = '';
            for (const byte of bytes) raw += String.fromCharCode(byte);
            output.value = btoa(raw);
          } catch (e) { output.value = 'Could not encode that text.'; }
        };
        root.querySelector('[data-decode]').onclick = () => {
          try {
            const raw = atob(input.value.replace(/\s+/g, ''));
            output.value = new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
          } catch (e) { output.value = 'That is not valid Base64.'; }
        };
        root.querySelector('[data-copy]').onclick = () => copy(output.value);
      }
    },
    {
      id: 'hexdump', glyph: '🧱', name: 'Hex Dump', price: 200,
      blurb: 'Turn text into offsets, hex bytes and an ASCII gutter.',
      run(body) {
        const root = el(body, '<h2>Hex Dump</h2><p class="mute">Sixteen bytes a row, the way a file viewer lays it out.</p>' +
          '<textarea rows="5" data-in placeholder="Type text to dump…"></textarea>' +
          '<div class="v-row"><button type="button" class="cd-primary" data-go>Dump</button><button type="button" data-copy>Copy</button></div>' +
          '<pre class="v-pre" data-out></pre>');
        const dump = () => {
          const bytes = new TextEncoder().encode(val(root, '[data-in]'));
          const lines = [];
          for (let i = 0; i < bytes.length; i += 16) {
            const slice = bytes.slice(i, i + 16);
            const hex = [...slice].map(b => pad(b.toString(16)).toUpperCase()).join(' ').padEnd(47, ' ');
            const text = [...slice].map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
            lines.push(i.toString(16).padStart(8, '0') + '  ' + hex + '  |' + text + '|');
          }
          root.querySelector('[data-out]').textContent = lines.length ? lines.join('\n') : '(nothing to dump)';
        };
        root.querySelector('[data-go]').onclick = dump;
        root.querySelector('[data-copy]').onclick = () => copy(root.querySelector('[data-out]').textContent);
        dump();
      }
    },
    {
      id: 'casetool', glyph: '🔠', name: 'Case Converter', price: 120,
      blurb: 'Title, sentence, upper, lower, kebab, snake and camel.',
      run(body) {
        const root = el(body, '<h2>Case Converter</h2><textarea rows="4" data-in placeholder="Paste a line…"></textarea>' +
          '<div class="v-row v-wrap"><button type="button" data-case="upper">UPPER</button><button type="button" data-case="lower">lower</button>' +
          '<button type="button" data-case="title">Title Case</button><button type="button" data-case="sentence">Sentence</button>' +
          '<button type="button" data-case="kebab">kebab-case</button><button type="button" data-case="snake">snake_case</button>' +
          '<button type="button" data-case="camel">camelCase</button><button type="button" data-copy>Copy</button></div>' +
          '<textarea rows="4" data-out readonly aria-label="Result"></textarea>');
        const words = s => s.trim().split(/\s+/).filter(Boolean);
        const forms = {
          upper: s => s.toUpperCase(),
          lower: s => s.toLowerCase(),
          title: s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()),
          sentence: s => s.toLowerCase().replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, c => c.toUpperCase()),
          kebab: s => words(s).map(w => w.toLowerCase()).join('-'),
          snake: s => words(s).map(w => w.toLowerCase()).join('_'),
          camel: s => words(s).map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
        };
        root.querySelectorAll('[data-case]').forEach(button => {
          button.onclick = () => { root.querySelector('[data-out]').value = forms[button.dataset.case](val(root, '[data-in]')); };
        });
        root.querySelector('[data-copy]').onclick = () => copy(val(root, '[data-out]'));
      }
    },
    {
      id: 'jsonfmt', glyph: '🧾', name: 'JSON Formatter', price: 240,
      blurb: 'Pretty-print, minify, and see exactly where the comma went wrong.',
      run(body) {
        const root = el(body, '<h2>JSON Formatter</h2><textarea rows="8" data-in placeholder=\'{"paste":"some JSON"}\'></textarea>' +
          '<div class="v-row"><button type="button" class="cd-primary" data-pretty>Pretty-print</button>' +
          '<button type="button" data-minify>Minify</button><button type="button" data-copy>Copy</button></div>' +
          '<pre class="v-pre" data-out></pre><p class="v-error" data-error role="alert"></p>');
        const run = minify => {
          const out = root.querySelector('[data-out]'), err = root.querySelector('[data-error]');
          try {
            const data = JSON.parse(val(root, '[data-in]'));
            out.textContent = minify ? JSON.stringify(data) : JSON.stringify(data, null, 2);
            err.textContent = '';
          } catch (e) {
            out.textContent = '';
            err.textContent = 'That is not valid JSON: ' + (e && e.message ? e.message : 'unknown error');
          }
        };
        root.querySelector('[data-pretty]').onclick = () => run(false);
        root.querySelector('[data-minify]').onclick = () => run(true);
        root.querySelector('[data-copy]').onclick = () => copy(root.querySelector('[data-out]').textContent);
      }
    },
    {
      id: 'textstats', glyph: '📊', name: 'Text Stats', price: 160,
      blurb: 'Characters, words, lines, sentences, reading time and the words you repeat.',
      run(body) {
        const root = el(body, '<h2>Text Stats</h2><textarea rows="8" data-in placeholder="Paste the text…"></textarea>' +
          '<div class="v-stats" data-stats></div><h3>Most used words</h3><ol class="v-list" data-top></ol>');
        const paint = () => {
          const text = val(root, '[data-in]');
          const words = text.toLowerCase().match(/[a-z0-9'’-]+/g) || [];
          const sentences = (text.match(/[.!?]+/g) || []).length;
          const counts = new Map();
          for (const word of words) if (word.length > 2) counts.set(word, (counts.get(word) || 0) + 1);
          const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
          const rows = [['Characters', text.length], ['Words', words.length], ['Lines', text ? text.split('\n').length : 0],
            ['Sentences', sentences], ['Reading time', Math.max(words.length ? 1 : 0, Math.round(words.length / 220)) + ' min']];
          root.querySelector('[data-stats]').innerHTML = rows.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + v + '</b></div>').join('');
          root.querySelector('[data-top]').innerHTML = top.length
            ? top.map(([word, n]) => '<li>' + esc(word) + ' <small>×' + n + '</small></li>').join('')
            : '<li class="mute">Nothing yet.</li>';
        };
        root.querySelector('[data-in]').addEventListener('input', paint);
        paint();
      }
    },
    {
      id: 'passforge', glyph: '🔑', name: 'Password Forge', price: 400,
      blurb: 'Random passwords from the browser’s own random source, not a pattern.',
      run(body) {
        const root = el(body, '<h2>Password Forge</h2><p class="mute">Generated here, never sent anywhere. For practice accounts only.</p>' +
          '<label class="v-field">Length <input type="number" min="8" max="64" value="20" data-len></label>' +
          '<div class="v-checks"><label><input type="checkbox" data-set="upper" checked> A–Z</label>' +
          '<label><input type="checkbox" data-set="lower" checked> a–z</label><label><input type="checkbox" data-set="digits" checked> 0–9</label>' +
          '<label><input type="checkbox" data-set="signs" checked> symbols</label></div>' +
          '<div class="v-out" data-out></div><div class="v-row"><button type="button" class="cd-primary" data-go>Generate</button>' +
          '<button type="button" data-copy>Copy</button></div>');
        const sets = { upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower: 'abcdefghijkmnopqrstuvwxyz', digits: '23456789', signs: '!@#$%^&*-_=+?' };
        const make = () => {
          let pool = '';
          for (const key of Object.keys(sets)) if (root.querySelector('[data-set="' + key + '"]').checked) pool += sets[key];
          if (!pool) pool = sets.lower;
          const len = Math.max(8, Math.min(64, Number(val(root, '[data-len]')) || 20));
          const bytes = new Uint32Array(len);
          crypto.getRandomValues(bytes);
          let out = '';
          for (const n of bytes) out += pool[n % pool.length];
          root.querySelector('[data-out]').textContent = out;
        };
        root.querySelector('[data-go]').onclick = make;
        root.querySelector('[data-copy]').onclick = () => copy(root.querySelector('[data-out]').textContent);
        make();
      }
    },
    {
      id: 'passmeter', glyph: '💪', name: 'Password Strength', price: 280,
      blurb: 'How many guesses a password really costs, and why length beats symbols.',
      run(body) {
        const root = el(body, '<h2>Password Strength</h2><p class="mute">Nothing is stored or sent: type a throwaway password, not a real one.</p>' +
          '<label class="v-field">Password <input type="password" data-in autocomplete="off"></label>' +
          '<div class="v-big" data-score>—</div><div class="v-meter"><i data-fill></i></div>' +
          '<div class="v-stats" data-notes></div>');
        const paint = () => {
          const text = val(root, '[data-in]');
          let pool = 0;
          if (/[a-z]/.test(text)) pool += 26;
          if (/[A-Z]/.test(text)) pool += 26;
          if (/[0-9]/.test(text)) pool += 10;
          if (/[^A-Za-z0-9]/.test(text)) pool += 32;
          if (/\s/.test(text)) pool += 1;
          const bits = text.length && pool ? Math.round(text.length * Math.log2(pool)) : 0;
          const verdict = bits >= 100 ? 'Very strong' : bits >= 75 ? 'Strong' : bits >= 50 ? 'Fair' : bits >= 30 ? 'Weak' : text ? 'Very weak' : '—';
          root.querySelector('[data-score]').textContent = verdict + (text ? ' · ' + bits + ' bits' : '');
          root.querySelector('[data-fill]').style.width = Math.min(100, bits) + '%';
          const notes = [
            ['Length', text.length + ' characters'],
            ['Character pool', pool + ' possible characters'],
            ['Guesses at 10 billion/s', bits ? text.length ? 'about ' + (Math.pow(2, bits - 1) / 1e10 > 3.2e7 ? 'centuries' : Math.max(1, Math.round(Math.pow(2, bits - 1) / 1e10 / 86400)) + ' days') : '—' : '—'],
            ['Repeated characters', /(.)\1{2,}/.test(text) ? 'yes — that shortens it' : 'no']
          ];
          root.querySelector('[data-notes]').innerHTML = notes.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(String(v)) + '</b></div>').join('');
        };
        root.querySelector('[data-in]').addEventListener('input', paint);
        paint();
      }
    },
    {
      id: 'ids', glyph: '🎲', name: 'ID & Dice', price: 150,
      blurb: 'UUIDs, dice of every shape, and a coin that is not weighted.',
      run(body) {
        const root = el(body, '<h2>ID &amp; Dice</h2><div class="v-row"><button type="button" class="cd-primary" data-uuid>New UUID</button>' +
          '<label class="v-field">Sides <input type="number" min="2" max="100" value="20" data-sides></label>' +
          '<button type="button" data-roll>Roll</button><button type="button" data-coin>Coin flip</button></div>' +
          '<div class="v-big" data-out>—</div><ul class="v-list" data-log></ul>');
        const out = root.querySelector('[data-out]'), log = root.querySelector('[data-log]');
        const say = text => {
          out.textContent = text;
          const row = document.createElement('li');
          row.textContent = text;
          log.prepend(row);
          while (log.children.length > 8) log.lastElementChild.remove();
        };
        root.querySelector('[data-uuid]').onclick = () => {
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = [...bytes].map(b => pad(b.toString(16))).join('');
          say(hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20));
        };
        root.querySelector('[data-roll]').onclick = () => {
          const sides = Math.max(2, Math.min(100, Number(val(root, '[data-sides]')) || 20));
          const n = crypto.getRandomValues(new Uint32Array(1))[0] % sides + 1;
          say('d' + sides + ' → ' + n);
        };
        root.querySelector('[data-coin]').onclick = () => say(crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? 'Heads' : 'Tails');
      }
    },
  ];
  APPS.push(
    {
      id: 'picker', glyph: '🎟', name: 'Lucky Draw', price: 130,
      blurb: 'One name out of a list, fairly, so nobody has to be the volunteer.',
      run(body) {
        const root = el(body, '<h2>Lucky Draw</h2><p class="mute">One entry per line.</p>' +
          '<textarea rows="6" data-in placeholder="ada&#10;grace&#10;alan"></textarea>' +
          '<div class="v-row"><button type="button" class="cd-primary" data-go>Draw one</button></div><div class="v-big" data-out>—</div>');
        root.querySelector('[data-go]').onclick = () => {
          const names = val(root, '[data-in]').split('\n').map(s => s.trim()).filter(Boolean);
          if (!names.length) { root.querySelector('[data-out]').textContent = 'Add some names first.'; return; }
          root.querySelector('[data-out]').textContent = names[crypto.getRandomValues(new Uint32Array(1))[0] % names.length];
        };
      }
    },
    {
      id: 'units', glyph: '📐', name: 'Unit Converter', price: 210,
      blurb: 'Length, mass, volume, speed and temperature in one box.',
      run(body) {
        const root = el(body, '<h2>Unit Converter</h2><div class="v-row"><label class="v-field">Kind<select data-kind>' +
          '<option value="length">Length</option><option value="mass">Mass</option><option value="volume">Volume</option>' +
          '<option value="speed">Speed</option><option value="temp">Temperature</option></select></label>' +
          '<label class="v-field">Value<input type="number" value="1" step="any" data-value></label></div>' +
          '<div class="v-row"><label class="v-field">From<select data-from></select></label>' +
          '<label class="v-field">To<select data-to></select></label></div><div class="v-big" data-out>—</div>');
        const table = {
          length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
          mass: { kg: 1, g: 0.001, t: 1000, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318 },
          volume: { l: 1, ml: 0.001, gal: 3.785411784, qt: 0.946352946, pt: 0.473176473, cup: 0.2365882365 },
          speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 0.514444 }
        };
        const kind = root.querySelector('[data-kind]'), from = root.querySelector('[data-from]'), to = root.querySelector('[data-to]');
        const toC = (n, unit) => unit === 'C' ? n : unit === 'F' ? (n - 32) * 5 / 9 : n - 273.15;
        const fromC = (n, unit) => unit === 'C' ? n : unit === 'F' ? n * 9 / 5 + 32 : n + 273.15;
        const convert = () => {
          const n = Number(val(root, '[data-value]'));
          if (!Number.isFinite(n)) { root.querySelector('[data-out]').textContent = '—'; return; }
          const out = kind.value === 'temp'
            ? fromC(toC(n, from.value), to.value)
            : n * table[kind.value][from.value] / table[kind.value][to.value];
          root.querySelector('[data-out]').textContent = Number(out.toPrecision(8)).toLocaleString() + ' ' + to.value;
        };
        const fill = () => {
          const list = kind.value === 'temp' ? ['C', 'F', 'K'] : Object.keys(table[kind.value]);
          const options = list.map(u => '<option>' + esc(u) + '</option>').join('');
          from.innerHTML = options;
          to.innerHTML = options;
          if (list.length > 1) to.selectedIndex = 1;
          convert();
        };
        kind.onchange = fill;
        root.querySelector('[data-value]').addEventListener('input', convert);
        from.onchange = convert;
        to.onchange = convert;
        fill();
      }
    },
    {
      id: 'bases', glyph: '🔢', name: 'Number Bases', price: 170,
      blurb: 'Decimal, binary, octal and hex, all kept in step as you type.',
      run(body) {
        const root = el(body, '<h2>Number Bases</h2><label class="v-field">Decimal<input type="number" value="255" data-in></label>' +
          '<div class="v-stats" data-out></div>');
        const paint = () => {
          const n = Math.trunc(Number(val(root, '[data-in]')));
          const rows = Number.isFinite(n)
            ? [['Binary', (n >>> 0).toString(2)], ['Octal', (n >>> 0).toString(8)], ['Hex', (n >>> 0).toString(16).toUpperCase()],
               ['Padded hex', '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0')],
               ['Word', n >= 0 && n <= 0xffff ? '0x' + n.toString(16).padStart(4, '0') : '—']]
            : [['Value', 'not a whole number']];
          root.querySelector('[data-out]').innerHTML = rows.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(String(v)) + '</b></div>').join('');
        };
        root.querySelector('[data-in]').addEventListener('input', paint);
        paint();
      }
    },
    {
      id: 'ascii', glyph: '🔤', name: 'ASCII Table', price: 110,
      blurb: 'Printable ASCII with its codes, searchable.',
      run(body) {
        const root = el(body, '<h2>ASCII Table</h2><input type="search" data-filter placeholder="Filter by character or code">' +
          '<div class="v-ascii" data-grid></div>');
        const cells = [];
        for (let code = 32; code <= 126; code++) cells.push([code, String.fromCharCode(code)]);
        root.querySelector('[data-grid]').innerHTML = cells.map(([code, char]) =>
          '<div class="v-ascii-cell" data-text="' + esc(char + ' ' + code + ' 0x' + code.toString(16)) + '"><b>' +
          esc(char === ' ' ? '␠' : char) + '</b><small>' + code + '</small><i>0x' + code.toString(16) + '</i></div>').join('');
        root.querySelector('[data-filter]').addEventListener('input', event => {
          const want = event.target.value.trim().toLowerCase();
          root.querySelectorAll('.v-ascii-cell').forEach(cell => {
            cell.hidden = !!want && !cell.dataset.text.toLowerCase().includes(want);
          });
        });
      }
    },
    {
      id: 'ports', glyph: '🔌', name: 'Port Reference', price: 230,
      blurb: 'The ports a scan report keeps mentioning, and what belongs on them.',
      run(body) {
        const root = el(body, '<h2>Port Reference</h2><input type="search" data-filter placeholder="Filter ports">' +
          '<table class="v-table"><thead><tr><th>Port</th><th>Service</th><th>Notes</th></tr></thead><tbody data-body></tbody></table>');
        const rows = [
          ['20/21', 'FTP', 'Cleartext file transfer; anonymous logins are a classic finding'],
          ['22', 'SSH', 'Encrypted shell; key auth beats passwords'],
          ['23', 'Telnet', 'Cleartext shell. Old, and still found in labs'],
          ['25', 'SMTP', 'Mail relay; open relays get abused'],
          ['53', 'DNS', 'Name resolution; zone transfers leak the map'],
          ['80', 'HTTP', 'The web, unencrypted'],
          ['110', 'POP3', 'Mail download, cleartext unless wrapped in TLS'],
          ['123', 'NTP', 'Clock sync; amplification abuse'],
          ['143', 'IMAP', 'Mailbox access'],
          ['161', 'SNMP', 'Device management; "public" community string is a gift'],
          ['389', 'LDAP', 'Directory lookups; anonymous binds leak users'],
          ['443', 'HTTPS', 'The web with TLS'],
          ['445', 'SMB', 'Windows file sharing; famous for ransomware'],
          ['993/995', 'IMAPS / POP3S', 'Mail over TLS'],
          ['1433', 'MSSQL', 'Microsoft SQL Server'],
          ['1521', 'Oracle', 'Oracle database listener'],
          ['2049', 'NFS', 'Network file system exports'],
          ['3000', 'Dev server', 'React and Node development servers left facing the world'],
          ['3306', 'MySQL', 'Database; never expose it by choice'],
          ['3389', 'RDP', 'Remote Desktop; brute-force magnet'],
          ['5432', 'PostgreSQL', 'Database'],
          ['5900', 'VNC', 'Remote screen, often with no password'],
          ['6379', 'Redis', 'Cache; unauthenticated instances are common'],
          ['8080/8443', 'HTTP(S) alt', 'Proxies, Tomcat, Jenkins, admin panels'],
          ['9200', 'Elasticsearch', 'Search index; open by default in old builds'],
          ['27017', 'MongoDB', 'Database; old versions allowed anonymous reads']
        ];
        const list = root.querySelector('[data-body]');
        const paint = filter => {
          const want = String(filter || '').toLowerCase();
          list.innerHTML = rows
            .filter(([port, name, note]) => !want || (port + ' ' + name + ' ' + note).toLowerCase().includes(want))
            .map(([port, name, note]) => '<tr><td><code>' + esc(port) + '</code></td><td>' + esc(name) + '</td><td>' + esc(note) + '</td></tr>')
            .join('');
        };
        root.querySelector('[data-filter]').addEventListener('input', event => paint(event.target.value));
        paint('');
      }
    },
    {
      id: 'httpcodes', glyph: '📡', name: 'HTTP Status', price: 190,
      blurb: 'What a status line means, and what it usually reveals.',
      run(body) {
        const root = el(body, '<h2>HTTP Status</h2><table class="v-table"><thead><tr><th>Code</th><th>Name</th><th>What it tells you</th></tr></thead><tbody data-body></tbody></table>');
        const rows = [
          ['100', 'Continue', 'Request headers okay, send the body'],
          ['200', 'OK', 'The normal answer'],
          ['201', 'Created', 'A POST made something'],
          ['204', 'No Content', 'Worked, and there is nothing to show'],
          ['301', 'Moved Permanently', 'Cached redirect; the old path dies eventually'],
          ['302', 'Found', 'Temporary redirect, often after signing in'],
          ['304', 'Not Modified', 'Your cache is still good'],
          ['400', 'Bad Request', 'Malformed input was refused'],
          ['401', 'Unauthorized', 'You are not signed in'],
          ['403', 'Forbidden', 'Signed in, but not allowed — deliberately different from 404'],
          ['404', 'Not Found', 'Nothing here, or the server is hiding it'],
          ['405', 'Method Not Allowed', 'Right path, wrong verb'],
          ['409', 'Conflict', 'State clashed with the request'],
          ['418', 'I’m a Teapot', 'A joke that became a standard'],
          ['429', 'Too Many Requests', 'Rate limited'],
          ['500', 'Internal Server Error', 'The server broke — and might say too much'],
          ['502', 'Bad Gateway', 'The proxy could not reach the app'],
          ['503', 'Service Unavailable', 'Down, overloaded, or blocked'],
          ['504', 'Gateway Timeout', 'The proxy waited too long'],
          ['511', 'Network Auth Required', 'A captive portal wants a login']
        ];
        root.querySelector('[data-body]').innerHTML = rows.map(([code, name, note]) =>
          '<tr><td><code>' + code + '</code></td><td>' + esc(name) + '</td><td>' + esc(note) + '</td></tr>').join('');
      }
    },
    {
      id: 'cidr', glyph: '🧮', name: 'CIDR Calculator', price: 450,
      blurb: 'Network, broadcast and usable range from any address and prefix.',
      run(body) {
        const root = el(body, '<h2>CIDR Calculator</h2><label class="v-field">Address and prefix' +
          '<input data-in value="10.20.30.21/24" spellcheck="false"></label><div class="v-stats" data-out></div>' +
          '<p class="v-error" data-error role="alert"></p>');
        const paint = () => {
          const out = root.querySelector('[data-out]'), err = root.querySelector('[data-error]');
          const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/.exec(val(root, '[data-in]').trim());
          const ip = m && [1, 2, 3, 4].every(i => Number(m[i]) <= 255)
            ? [1, 2, 3, 4].reduce((n, i) => n * 256 + Number(m[i]), 0) : null;
          const bits = m && m[5] !== undefined ? Number(m[5]) : 32;
          if (ip == null || bits < 0 || bits > 32) {
            out.innerHTML = '';
            err.textContent = 'Write an address like 10.0.0.0/24 (prefix 0–32).';
            return;
          }
          err.textContent = '';
          const size = Math.pow(2, 32 - bits);
          const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
          const net = (ip & mask) >>> 0, last = (net + size - 1) >>> 0;
          const show = n => [24, 16, 8, 0].map(shift => (n >>> shift) & 255).join('.');
          const rows = [
            ['Network', show(net) + '/' + bits],
            ['Mask', show(mask)],
            ['Wildcard', show(~mask >>> 0)],
            ['Broadcast', show(last)],
            ['First host', bits >= 31 ? show(net) : show(net + 1)],
            ['Last host', bits >= 31 ? show(last) : show(last - 1)],
            ['Addresses', size.toLocaleString()],
            ['Usable hosts', (bits >= 31 ? size : Math.max(0, size - 2)).toLocaleString()],
            ['Private range', /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(show(net)) ? 'yes (RFC 1918)' : 'no']
          ];
          out.innerHTML = rows.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('');
        };
        root.querySelector('[data-in]').addEventListener('input', paint);
        paint();
      }
    },
    {
      id: 'shortcuts', glyph: '⌨', name: 'Shortcut Sheet', price: 140,
      blurb: 'The keyboard moves worth knowing in Windows and the browser.',
      run(body) {
        const root = el(body, '<h2>Shortcut Sheet</h2><table class="v-table"><thead><tr><th>Keys</th><th>Does</th></tr></thead><tbody data-body></tbody></table>');
        const rows = [
          ['Win + L', 'Lock the machine'], ['Win + E', 'Open File Explorer'], ['Win + R', 'Run a command'],
          ['Win + Shift + S', 'Snip a region of the screen'], ['Win + Tab', 'Task view'], ['Alt + Tab', 'Switch windows'],
          ['Ctrl + Shift + Esc', 'Task Manager'], ['Ctrl + C / V / X', 'Copy, paste, cut'], ['Ctrl + Z / Y', 'Undo, redo'],
          ['Ctrl + F', 'Find on this page'], ['Ctrl + Shift + T', 'Reopen the tab you just closed'], ['Ctrl + L', 'Jump to the address bar'],
          ['Ctrl + Shift + I', 'Developer tools'], ['F5 / Ctrl + R', 'Reload'], ['Shift + F5', 'Reload without the cache'],
          ['Ctrl + + / −', 'Zoom the page'], ['Ctrl + 0', 'Reset the zoom'], ['Alt + ←', 'Back']
        ];
        root.querySelector('[data-body]').innerHTML = rows.map(([keys, does]) =>
          '<tr><td><code>' + esc(keys) + '</code></td><td>' + esc(does) + '</td></tr>').join('');
      }
    },
    {
      id: 'palette', glyph: '🎨', name: 'Palette Studio', price: 380,
      blurb: 'Pick a colour and get a usable set of shades with their hex codes.',
      run(body) {
        const root = el(body, '<h2>Palette Studio</h2><div class="v-row"><label class="v-field">Base colour' +
          '<input type="color" value="#4f9dff" data-color></label><button type="button" class="cd-primary" data-go>Build a palette</button></div>' +
          '<div class="v-swatches" data-out></div><p class="mute">Click a swatch to copy its hex code.</p>');
        const hexOf = (r, g, b) => '#' + [r, g, b]
          .map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
        const build = () => {
          const text = val(root, '[data-color]').replace('#', '');
          const [r, g, b] = [0, 2, 4].map(i => parseInt(text.slice(i, i + 2), 16) || 0);
          const rows = [
            ['Tint 80%', hexOf(r + (255 - r) * .8, g + (255 - g) * .8, b + (255 - b) * .8)],
            ['Tint 55%', hexOf(r + (255 - r) * .55, g + (255 - g) * .55, b + (255 - b) * .55)],
            ['Base', hexOf(r, g, b)],
            ['Shade 25%', hexOf(r * .75, g * .75, b * .75)],
            ['Shade 50%', hexOf(r * .5, g * .5, b * .5)],
            ['Complement', hexOf(255 - r, 255 - g, 255 - b)]
          ];
          root.querySelector('[data-out]').innerHTML = rows.map(([name, hex]) =>
            '<button type="button" class="v-swatch" data-hex="' + hex + '" style="background:' + hex + '"><b>' + esc(name) +
            '</b><span>' + hex.toUpperCase() + '</span></button>').join('');
          root.querySelectorAll('[data-hex]').forEach(swatch => {
            swatch.onclick = () => copy(swatch.dataset.hex.toUpperCase());
          });
        };
        root.querySelector('[data-go]').onclick = build;
        root.querySelector('[data-color]').addEventListener('input', build);
        build();
      }
    },
    {
      id: 'hashit', glyph: '#️⃣', name: 'Hash It', price: 520,
      blurb: 'SHA-1, SHA-256 and SHA-512 of any text, computed in this window.',
      run(body) {
        const root = el(body, '<h2>Hash It</h2><textarea rows="4" data-in placeholder="Type text to hash…"></textarea>' +
          '<div class="v-row"><select data-algo><option value="SHA-256">SHA-256</option>' +
          '<option value="SHA-1">SHA-1</option><option value="SHA-512">SHA-512</option></select>' +
          '<button type="button" class="cd-primary" data-go>Hash</button><button type="button" data-copy>Copy</button></div>' +
          '<pre class="v-pre" data-out></pre><p class="v-error" data-error role="alert"></p>');
        const go = async () => {
          const out = root.querySelector('[data-out]'), err = root.querySelector('[data-error]');
          err.textContent = '';
          try {
            const bytes = new TextEncoder().encode(val(root, '[data-in]'));
            const digest = await crypto.subtle.digest(val(root, '[data-algo]'), bytes);
            out.textContent = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
          } catch (e) {
            out.textContent = '';
            err.textContent = 'Hashing is unavailable here: ' + (e && e.message ? e.message : 'blocked');
          }
        };
        root.querySelector('[data-go]').onclick = go;
        root.querySelector('[data-copy]').onclick = () => copy(root.querySelector('[data-out]').textContent);
        go();
      }
    },
    {
      id: 'paint', glyph: '🖌', name: 'Paint', price: 600,
      blurb: 'A canvas and a brush, with nothing to save over your files.',
      run(body) {
        const root = el(body, '<h2>Paint</h2><div class="v-row"><input type="color" value="#9edcff" data-color aria-label="Brush colour">' +
          '<label class="v-field">Size<input type="number" min="1" max="40" value="4" data-size></label>' +
          '<button type="button" data-clear>Clear</button><span class="mute">Draw with the mouse or a finger.</span></div>' +
          '<canvas class="v-canvas" width="900" height="470" data-canvas></canvas>');
        const canvas = root.querySelector('[data-canvas]');
        const ctx = canvas.getContext('2d');
        const clear = () => {
          ctx.fillStyle = '#0a1524';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        };
        clear();
        let drawing = false, last = null;
        const point = event => {
          const box = canvas.getBoundingClientRect();
          return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height };
        };
        canvas.addEventListener('pointerdown', event => {
          drawing = true;
          last = point(event);
          if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointermove', event => {
          if (!drawing) return;
          const at = point(event);
          ctx.strokeStyle = val(root, '[data-color]');
          ctx.lineWidth = Math.max(1, Math.min(40, Number(val(root, '[data-size]')) || 4));
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(at.x, at.y);
          ctx.stroke();
          last = at;
        });
        const stop = () => { drawing = false; last = null; };
        canvas.addEventListener('pointerup', stop);
        canvas.addEventListener('pointercancel', stop);
        root.querySelector('[data-clear]').onclick = clear;
        return stop;
      }
    },
    {
      id: 'synth', glyph: '🎹', name: 'Tone Pad', price: 340,
      blurb: 'Eight notes from the browser’s own audio, for a sound check.',
      run(body) {
        const root = el(body, '<h2>Tone Pad</h2><p class="mute">Press a pad. Nothing records, and nothing plays once the window closes.</p>' +
          '<div class="v-pads" data-pads></div><p class="v-error" data-error role="alert"></p>');
        let context = null;
        const notes = [['C4', 261.63], ['D4', 293.66], ['E4', 329.63], ['F4', 349.23], ['G4', 392], ['A4', 440], ['B4', 493.88], ['C5', 523.25]];
        root.querySelector('[data-pads]').innerHTML = notes.map(([name], i) =>
          '<button type="button" class="v-pad" data-note="' + i + '"><b>' + name + '</b><small>pad ' + (i + 1) + '</small></button>').join('');
        const play = (frequency, button) => {
          try {
            const Audio = window.AudioContext || window.webkitAudioContext;
            context = context || new Audio();
            const osc = context.createOscillator(), gain = context.createGain();
            osc.type = 'sine';
            osc.frequency.value = frequency;
            gain.gain.value = .0001;
            osc.connect(gain).connect(context.destination);
            const now = context.currentTime;
            gain.gain.exponentialRampToValueAtTime(.18, now + .02);
            gain.gain.exponentialRampToValueAtTime(.0001, now + .7);
            osc.start(now);
            osc.stop(now + .75);
            button.classList.add('on');
            setTimeout(() => button.classList.remove('on'), 700);
          } catch (e) {
            root.querySelector('[data-error]').textContent = 'The browser would not start audio here: ' + (e && e.message ? e.message : 'blocked');
          }
        };
        root.querySelectorAll('[data-note]').forEach(button => {
          button.onclick = () => play(notes[Number(button.dataset.note)][1], button);
        });
        return () => { try { context && context.close(); } catch (e) { } };
      }
    },
    {
      id: 'markdown', glyph: '📝', name: 'Markdown Preview', price: 360,
      blurb: 'Headings, lists, bold, code and links, with the plain text beside it.',
      run(body) {
        const root = el(body, '<h2>Markdown Preview</h2><div class="v-split"><textarea rows="14" data-in spellcheck="false" placeholder="# Title&#10;&#10;- a point&#10;- **bold** and `code`"></textarea>' +
          '<div class="v-preview" data-out></div></div>');
        const render = text => {
          const lines = esc(text).split('\n');
          let html = '', inList = false;
          for (const line of lines) {
            const item = /^\s*[-*]\s+(.*)$/.exec(line);
            if (item) {
              if (!inList) { html += '<ul>'; inList = true; }
              html += '<li>' + item[1] + '</li>';
              continue;
            }
            if (inList) { html += '</ul>'; inList = false; }
            const head = /^(#{1,4})\s+(.*)$/.exec(line);
            if (head) { const level = head[1].length + 1; html += '<h' + level + '>' + head[2] + '</h' + level + '>'; continue; }
            if (/^\s*&gt;\s?/.test(line)) { html += '<blockquote>' + line.replace(/^\s*&gt;\s?/, '') + '</blockquote>'; continue; }
            if (/^\s*---\s*$/.test(line)) { html += '<hr>'; continue; }
            html += line.trim() ? '<p>' + line + '</p>' : '';
          }
          if (inList) html += '</ul>';
          return html
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
        };
        const paint = () => {
          root.querySelector('[data-out]').innerHTML = render(val(root, '[data-in]')) || '<p class="mute">The preview appears here.</p>';
        };
        root.querySelector('[data-in]').addEventListener('input', paint);
        paint();
      }
    },
    {
      id: 'tasks', glyph: '✅', name: 'Task Board', price: 300,
      blurb: 'Tick things off while you work. Kept for this session only.',
      run(body) {
        const root = el(body, '<h2>Task Board</h2><form class="v-row" data-form><input data-new placeholder="Add a task and press Enter" maxlength="120">' +
          '<button type="submit" class="cd-primary">Add</button></form><div class="v-tasks" data-list></div><p class="mute" data-say></p>');
        const tasks = [];
        const paint = () => {
          root.querySelector('[data-list]').innerHTML = tasks.length
            ? tasks.map((task, i) => '<label class="v-task' + (task.done ? ' done' : '') + '"><input type="checkbox" data-i="' + i + '"' +
                (task.done ? ' checked' : '') + '><span>' + esc(task.text) + '</span><button type="button" data-del="' + i +
                '" aria-label="Delete">✕</button></label>').join('')
            : '<p class="mute">Nothing on the board.</p>';
          root.querySelector('[data-say]').textContent = tasks.length
            ? tasks.filter(t => !t.done).length + ' of ' + tasks.length + ' still open.' : '';
        };
        root.querySelector('[data-form]').addEventListener('submit', event => {
          event.preventDefault();
          const field = root.querySelector('[data-new]');
          const text = field.value.trim();
          if (!text) return;
          tasks.push({ text, done: false });
          field.value = '';
          paint();
        });
        root.querySelector('[data-list]').addEventListener('click', event => {
          const del = event.target.closest('[data-del]');
          if (!del) return;
          tasks.splice(Number(del.dataset.del), 1);
          paint();
        });
        root.querySelector('[data-list]').addEventListener('change', event => {
          const box = event.target.closest('[data-i]');
          if (!box) return;
          tasks[Number(box.dataset.i)].done = box.checked;
          paint();
        });
        paint();
      }
    },
    {
      id: 'tip', glyph: '🍽', name: 'Bill Splitter', price: 100,
      blurb: 'Tip and per-person totals without arguing over the arithmetic.',
      run(body) {
        const root = el(body, '<h2>Bill Splitter</h2><div class="v-row"><label class="v-field">Bill' +
          '<input type="number" min="0" step=".01" value="80" data-bill></label>' +
          '<label class="v-field">Tip %<input type="number" min="0" max="50" value="15" data-tip></label>' +
          '<label class="v-field">People<input type="number" min="1" max="50" value="2" data-people></label></div>' +
          '<div class="v-stats" data-out></div>');
        const paint = () => {
          const bill = Math.max(0, Number(val(root, '[data-bill]')) || 0);
          const tip = Math.max(0, Number(val(root, '[data-tip]')) || 0);
          const people = Math.max(1, Math.round(Number(val(root, '[data-people]')) || 1));
          const tipMoney = bill * tip / 100;
          const rows = [['Bill', money(bill)], ['Tip', money(tipMoney)], ['Total', money(bill + tipMoney)],
            ['Each', money((bill + tipMoney) / people)], ['People', String(people)]];
          root.querySelector('[data-out]').innerHTML = rows.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('');
        };
        root.querySelectorAll('input').forEach(input => input.addEventListener('input', paint));
        paint();
      }
    },
    {
      id: 'budget', glyph: '💰', name: 'Budget Sheet', price: 420,
      blurb: 'Add up what comes in and what goes out, and see what is left.',
      run(body) {
        const root = el(body, '<h2>Budget Sheet</h2><p class="mute">Practice figures only: nothing here touches the practice bank.</p>' +
          '<div class="v-split"><div><h3>Money in</h3><div data-in></div><button type="button" data-add="in">Add a line</button></div>' +
          '<div><h3>Money out</h3><div data-out></div><button type="button" data-add="out">Add a line</button></div></div>' +
          '<div class="v-stats" data-total></div>');
        const blank = side => {
          const row = document.createElement('div');
          row.className = 'v-row';
          row.innerHTML = '<input placeholder="Label" data-label maxlength="40"><input type="number" min="0" step=".01" value="0" data-amount>' +
            '<button type="button" aria-label="Remove">✕</button>';
          row.querySelector('button').onclick = () => { row.remove(); paint(); };
          row.querySelectorAll('input').forEach(input => input.addEventListener('input', paint));
          root.querySelector('[data-' + side + ']').append(row);
        };
        const sum = side => [...root.querySelectorAll('[data-' + side + '] [data-amount]')]
          .reduce((n, input) => n + (Number(input.value) || 0), 0);
        const paint = () => {
          const income = sum('in'), spend = sum('out');
          const rows = [['Money in', money(income)], ['Money out', money(spend)], ['Left over', money(income - spend)]];
          root.querySelector('[data-total]').innerHTML = rows.map(([k, v]) => '<div><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('');
        };
        root.querySelectorAll('[data-add]').forEach(button => {
          button.onclick = () => { blank(button.dataset.add); paint(); };
        });
        blank('in');
        blank('out');
        paint();
      }
    },
    {
      id: 'fortune', glyph: '🔮', name: 'Fortune Teller', price: 90,
      blurb: 'A yes, a no, or something unhelpfully in between.',
      run(body) {
        const root = el(body, '<h2>Fortune Teller</h2><p class="mute">Not a security control. Do not deploy it.</p>' +
          '<div class="v-big" data-out>———</div><div class="v-row"><button type="button" class="cd-primary" data-go>Ask</button></div>');
        const answers = ['Yes, and sooner than you think.', 'No. Try again after a coffee.', 'Ask the log file.',
          'The answer is in the third line.', 'Probably — but back up first.', 'Not today.', 'It depends who is on call.',
          'Signs point to “read the documentation”.', 'You already know the answer.', 'Roll back and ask again.'];
        root.querySelector('[data-go]').onclick = () => {
          root.querySelector('[data-out]').textContent = answers[Math.floor(Math.random() * answers.length)];
        };
      }
    },
    {
      id: 'wordclock', glyph: '🕰', name: 'Word Clock', price: 240,
      blurb: 'The time written out in words, rounded to five minutes.',
      run(body) {
        const root = el(body, '<h2>Word Clock</h2><div class="v-big" data-out>—</div><p class="mute" data-small></p>');
        const words = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
        const paint = () => {
          const now = new Date();
          let hour = now.getHours() % 12;
          let minutes = Math.round(now.getMinutes() / 5) * 5;
          if (minutes === 60) { minutes = 0; hour = (hour + 1) % 12; }
          const next = (hour + 1) % 12;
          const phrase = minutes === 0 ? words[hour] + ' o’clock'
            : minutes === 15 ? 'quarter past ' + words[hour]
              : minutes === 30 ? 'half past ' + words[hour]
                : minutes === 45 ? 'quarter to ' + words[next]
                  : minutes < 30 ? words[minutes / 5] + ' past ' + words[hour]
                    : words[(60 - minutes) / 5] + ' to ' + words[next];
          root.querySelector('[data-out]').textContent = phrase.charAt(0).toUpperCase() + phrase.slice(1) + '.';
          root.querySelector('[data-small]').textContent = now.toLocaleTimeString() + ' · ' + now.toLocaleDateString();
        };
        paint();
        const timer = setInterval(paint, 15000);
        return () => clearInterval(timer);
      }
    },
    {
      id: 'binaryclock', glyph: '⏲', name: 'Binary Clock', price: 200,
      blurb: 'Hours, minutes and seconds as six columns of lights.',
      run(body) {
        const root = el(body, '<h2>Binary Clock</h2><p class="mute">Two columns per unit: tens, then ones.</p>' +
          '<div class="v-binary" data-out></div><div class="v-big" data-text>—</div>');
        const paint = () => {
          const now = new Date();
          const parts = [now.getHours(), now.getMinutes(), now.getSeconds()];
          const digits = parts.reduce((all, n) => all.concat([Math.floor(n / 10), n % 10]), []);
          root.querySelector('[data-out]').innerHTML = digits.map(d =>
            '<div class="v-bin-col">' + [3, 2, 1, 0].map(bit => '<i class="' + ((d >> bit) & 1 ? 'on' : '') + '"></i>').join('') +
            '<small>' + d + '</small></div>').join('');
          root.querySelector('[data-text]').textContent = parts.map(pad).join(':');
        };
        paint();
        const timer = setInterval(paint, 500);
        return () => clearInterval(timer);
      }
    },
    {
      id: 'emoji', glyph: '😀', name: 'Glyph Picker', price: 80,
      blurb: 'Click a glyph to copy it, for notes and commit messages.',
      run(body) {
        const root = el(body, '<h2>Glyph Picker</h2><input type="search" data-filter placeholder="Filter glyphs">' +
          '<div class="v-emojis" data-out></div><p class="mute" data-say>Click one to copy it.</p>');
        const glyphs = ('😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😎 🤓 🧐 😕 🙁 😮 😱 🤔 🤨 😐 😴 🤯 🥳 🤖 👻 💀 👽 🐍 🦊 🐙 🦉 🐝 🌵 🌲 🌊 🌈 ⚡ 🔥 ❄ 💧 🍀 🍄 🌙 ⭐ ☀ 🌩 🧭 🧪 🔬 🔭 🛰 💻 🖥 ⌨ 🖱 💾 📀 📡 🔌 🔋 🧲 🔧 🔨 ⚙ 🗝 🔐 🔒 🛡 🚨 🧯 🧰 📦 📬 ✉ 📮 🗂 📌 📎 ✏ ✒ 🖊 📐 📏 🧮 💡 🕯 🧊 🧬 ⚗ 🔍 🎯 🚀 🧿 🪐 🛠 🕵 🦠 💉 🩺 🩹 💊 🧼 🧽 🪣 🧴 🍕 🍜 ☕').split(' ');
        const out = root.querySelector('[data-out]');
        out.innerHTML = glyphs.map(g => '<button type="button" class="v-emoji" data-g="' + g + '">' + g + '</button>').join('');
        out.addEventListener('click', event => {
          const button = event.target.closest('[data-g]');
          if (!button) return;
          copy(button.dataset.g);
          root.querySelector('[data-say]').textContent = button.dataset.g + ' copied.';
        });
        root.querySelector('[data-filter]').addEventListener('input', event => {
          const want = event.target.value.trim();
          out.querySelectorAll('[data-g]').forEach(button => { button.hidden = !!want && !button.dataset.g.includes(want); });
        });
      }
    },
    {
      id: 'diff', glyph: '🔍', name: 'Text Diff', price: 340,
      blurb: 'Two versions side by side, with the lines that changed marked.',
      run(body) {
        const root = el(body, '<h2>Text Diff</h2><div class="v-split"><textarea rows="10" data-a placeholder="Original text"></textarea>' +
          '<textarea rows="10" data-b placeholder="Changed text"></textarea></div>' +
          '<div class="v-row"><button type="button" class="cd-primary" data-go>Compare</button><span class="mute" data-say></span></div>' +
          '<pre class="v-pre" data-out></pre>');
        const compare = () => {
          const a = val(root, '[data-a]').split('\n').slice(0, 300);
          const b = val(root, '[data-b]').split('\n').slice(0, 300);
          const n = a.length, m = b.length;
          const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
          for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
              table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
            }
          }
          const lines = [];
          let i = 0, j = 0, added = 0, removed = 0;
          while (i < n || j < m) {
            if (i < n && j < m && a[i] === b[j]) { lines.push('  ' + a[i]); i++; j++; continue; }
            if (j < m && (i === n || table[i][j + 1] >= table[i + 1][j])) { lines.push('+ ' + b[j]); added++; j++; continue; }
            lines.push('- ' + a[i]);
            removed++;
            i++;
          }
          root.querySelector('[data-out]').textContent = lines.join('\n') || '(both sides are empty)';
          root.querySelector('[data-say]').textContent = added + ' added, ' + removed + ' removed';
        };
        root.querySelector('[data-go]').onclick = compare;
        compare();
      }
    },
    {
      id: 'cipher', glyph: '🔐', name: 'Classic Ciphers', price: 300,
      blurb: 'Caesar and Vigenère, both ways, to see how weak they are.',
      run(body) {
        const root = el(body, '<h2>Classic Ciphers</h2><div class="v-row"><label class="v-field">Cipher<select data-kind>' +
          '<option value="caesar">Caesar</option><option value="vigenere">Vigenère</option></select></label>' +
          '<label class="v-field">Shift<select data-shift>' +
          Array.from({ length: 26 }, (_, i) => '<option value="' + i + '"' + (i === 3 ? ' selected' : '') + '>' + i + '</option>').join('') +
          '</select></label><label class="v-field">Key (Vigenère)<input data-key value="LEMON" maxlength="24" style="text-transform:uppercase"></label></div>' +
          '<textarea rows="5" data-in placeholder="Type plaintext…"></textarea>' +
          '<div class="v-row"><button type="button" class="cd-primary" data-go>Encrypt</button><button type="button" data-back>Decrypt</button></div>' +
          '<textarea rows="5" data-out readonly aria-label="Result"></textarea>');
        const shiftChar = (char, delta) => {
          const code = char.charCodeAt(0);
          const lower = code >= 97 && code <= 122, upper = code >= 65 && code <= 90;
          if (!lower && !upper) return char;
          const base = lower ? 97 : 65;
          return String.fromCharCode(base + ((code - base + delta) % 26 + 26) % 26);
        };
        const run = (text, decrypt) => {
          if (val(root, '[data-kind]') === 'caesar') {
            const shift = Number(val(root, '[data-shift]')) * (decrypt ? -1 : 1);
            return [...text].map(c => shiftChar(c, shift)).join('');
          }
          const key = (val(root, '[data-key]') || 'LEMON').toUpperCase().replace(/[^A-Z]/g, '') || 'LEMON';
          let index = 0;
          return [...text].map(c => {
            const code = c.charCodeAt(0);
            if (!((code >= 65 && code <= 90) || (code >= 97 && code <= 122))) return c;
            const delta = key.charCodeAt(index % key.length) - 65;
            index++;
            return shiftChar(c, decrypt ? -delta : delta);
          }).join('');
        };
        root.querySelector('[data-go]').onclick = () => { root.querySelector('[data-out]').value = run(val(root, '[data-in]'), false); };
        root.querySelector('[data-back]').onclick = () => { root.querySelector('[data-out]').value = run(val(root, '[data-in]'), true); };
        const kind = root.querySelector('[data-kind]');
        const sync = () => {
          root.querySelector('[data-shift]').parentElement.style.display = kind.value === 'caesar' ? '' : 'none';
          root.querySelector('[data-key]').parentElement.style.display = kind.value === 'vigenere' ? '' : 'none';
        };
        kind.onchange = sync;
        sync();
      }
    }
  );
  /* ---------------------------------------------------------------- cosmetics ------------------------------
     Palettes the desktop already knows how to wear, plus three things the free wallpapers never could: an overlay
     on the screen, a different dock, and the name on the machine. */
  const WALLPAPERS = [
    ['wp-neon-alley', 'Neon Alley', 900, 'Rain-lit backstreet: cyan above, magenta under the lid.', '#04101c', '#123a5c', '#2a86c9', '#6ff2ff'],
    ['wp-copper-dusk', 'Copper Dusk', 1200, 'Warm metal at the end of the day, without the scan lines.', '#1a0f0a', '#5a2d17', '#b4642a', '#ffc48a'],
    ['wp-arctic-scan', 'Arctic Scan', 1500, 'Cold, bright and clean. Easiest on the eyes at 3am.', '#061520', '#0f3f57', '#3aa7c9', '#d8fbff'],
    ['wp-deep-signal', 'Deep Signal', 1800, 'A carrier wave under a navy sky.', '#050a18', '#14275a', '#3d5fd0', '#a9c2ff'],
    ['wp-molten', 'Molten', 2100, 'Lava behind glass. Loud, and it knows it.', '#1c0606', '#5a1410', '#c93a1f', '#ffb08a'],
    ['wp-tidewater', 'Tidewater', 2400, 'Shallow water and long reflections.', '#041616', '#0b3b3d', '#1f8b8b', '#9ff0e0'],
    ['wp-static-bloom', 'Static Bloom', 2700, 'A violet signal that never quite resolves.', '#160a1e', '#3f1a5c', '#8a3ec9', '#e3b0ff'],
    ['wp-midnight-jade', 'Midnight Jade', 3000, 'Green depth, very little light.', '#04140e', '#0f3a26', '#2f8a54', '#a8f0c0'],
    ['wp-signal-orange', 'Signal Orange', 3300, 'High-visibility dusk. Hard to miss a window on it.', '#170d05', '#4a2208', '#c96a12', '#ffd0a0'],
    ['wp-ghost-town', 'Ghost Town', 3600, 'Grey streets after everyone has gone home.', '#0e0e12', '#2a2a34', '#6a6a7a', '#d8d8e8'],
    ['wp-vaporwave', 'Vaporwave', 3900, 'Pink grid, purple haze, no apologies.', '#1a0a26', '#52227a', '#b04ad8', '#ffb8f0'],
    ['wp-biolume', 'Biolume', 4200, 'Something in the water is glowing.', '#030f14', '#0a3540', '#1f9aa8', '#b8fff4'],
    ['wp-dust-storm', 'Dust Storm', 4500, 'Sand, distance and a low sun.', '#1a1408', '#4a3614', '#a0822a', '#ffe0a0'],
    ['wp-polar-night', 'Polar Night', 4800, 'Blue hour that lasts all day.', '#050a14', '#0e1c38', '#3a6ab0', '#cfe4ff'],
    ['wp-redshift', 'Redshift', 5100, 'Everything moving away from you at speed.', '#150408', '#4a0c18', '#b01f38', '#ffb0b8'],
    ['wp-glasshouse', 'Glasshouse', 5400, 'Green light through panes and leaves.', '#06120c', '#143a1c', '#4a9a3a', '#d8ffb0'],
    ['wp-terminal-green', 'Terminal Green', 5700, 'The wallpaper a terminal should have.', '#020a04', '#08240f', '#16a034', '#9dffb0'],
    ['wp-harbour-fog', 'Harbour Fog', 6000, 'A grey morning, a long quay, no traffic yet.', '#0c1216', '#24343c', '#4a7a8a', '#d0ecf4']
  ];
  const ACCENTS = [
    ['ac-ice', 'Ice', 400, '#9edcff', 'The default accent, bought outright so it can be switched from the shop.'],
    ['ac-amber', 'Amber', 500, '#ffd387', 'Warm highlight for the dock and focus rings.'],
    ['ac-mint', 'Mint', 600, '#8ef0b0', 'Fresh green that reads well on the jade wallpapers.'],
    ['ac-violet', 'Violet', 700, '#d8baff', 'Soft purple, close to the free Violet wallpaper.'],
    ['ac-rose', 'Rose', 800, '#ff9fb0', 'A gentler red than the free Signal red.'],
    ['ac-lime', 'Lime', 900, '#d4ff7a', 'Acid green. Loud on purpose.'],
    ['ac-cyan', 'Cyan', 1000, '#5ef2ff', 'Bright, cold and very visible on dark screens.'],
    ['ac-coral', 'Coral', 1100, '#ff8a6a', 'Warm and a little loud. Good with Molten.'],
    ['ac-steel', 'Steel', 1200, '#b8c8d8', 'Quiet metal for a quiet desktop.'],
    ['ac-gold', 'Gold Leaf', 1500, '#f2c14e', 'The expensive one, because it looks expensive.']
  ];
  const FRAMES = [
    ['fr-scan', 'CRT Scanlines', 900, 'scan', 'Faint horizontal lines over every window, like an old monitor.'],
    ['fr-grid', 'Blueprint Grid', 1200, 'grid', 'A drafting grid across the desktop, behind the icons.'],
    ['fr-vignette', 'Vignette', 1500, 'vignette', 'Darkens the corners so the middle of the screen carries the light.'],
    ['fr-crt', 'Old Monitor', 1800, 'crt', 'Scanlines, a green cast and rounded darkness in one.'],
    ['fr-grain', 'Film Grain', 2100, 'grain', 'A fine texture that makes flat gradients look photographed.'],
    ['fr-blueprint', 'Drafting Table', 2400, 'blueprint', 'A bold blue grid with a border, as if the desktop were a technical drawing.'],
    ['fr-midnight', 'Midnight Fade', 2700, 'midnight', 'Dark bands top and bottom, so the dock and the panel frame the view.'],
    ['fr-ember', 'Ember Corner', 3000, 'ember', 'A slow orange glow in the bottom right, like a fire off-screen.']
  ];
  const DOCKS = [
    ['dk-pill', 'Pill Dock', 600, 'pill', 'Rounded ends, more air around the icons.'],
    ['dk-boxed', 'Boxed Dock', 900, 'boxed', 'Square corners and a hard outline, like a rack unit.'],
    ['dk-minimal', 'Minimal Dock', 1200, 'minimal', 'No border and no shadow: just the icons on the wallpaper.'],
    ['dk-glow', 'Glow Dock', 1500, 'glow', 'The dock takes the accent colour and lights up.'],
    ['dk-wide', 'Wide Dock', 1800, 'wide', 'Wider spacing, for touchscreens and tired eyes.']
  ];
  const NAMEPLATES = [
    ['np-01', 'MOUNDSHROUD-01', 300, 'MOUNDSHROUD-01', 'The name the practice machine shows in its corner widget.'],
    ['np-02', 'PRACTICE-LAB', 400, 'PRACTICE-LAB', 'Because it is one.'],
    ['np-03', 'guest@vault', 500, 'guest@vault', 'A hostname that says where you shop.'],
    ['np-04', 'THE WAREHOUSE', 700, 'THE WAREHOUSE', 'For a desktop that is mostly shelves of tools.'],
    ['np-05', 'NIGHT SHIFT', 900, 'NIGHT SHIFT', 'For the hours this app is actually used.'],
    ['np-06', 'RED TEAM DESK', 1200, 'RED TEAM DESK', 'Nothing on this machine is a real target. Say it anyway.']
  ];

  const COSMETICS = []
    .concat(WALLPAPERS.map(([id, name, price, note, night, horizon, glow, beam]) => ({
      kind: 'wallpaper', id, name, price, note, blurb: note, value: id, palette: { night, horizon, glow, beam }
    })))
    .concat(ACCENTS.map(([id, name, price, value, note]) => ({ kind: 'accent', id, name, price, note, blurb: note, value })))
    .concat(FRAMES.map(([id, name, price, value, note]) => ({ kind: 'frame', id, name, price, note, blurb: note, value })))
    .concat(DOCKS.map(([id, name, price, value, note]) => ({ kind: 'dock', id, name, price, note, blurb: note, value })))
    .concat(NAMEPLATES.map(([id, name, price, value, note]) => ({ kind: 'nameplate', id, name, price, note, blurb: note, value })));

  /* the injected stylesheet: wallpapers are the same four variables the free ones use, and the frames, docks and
     nameplates are new hooks on the shell that only exist while the matching unlock is owned */
  const style = document.createElement('style');
  style.id = 'cd-vault-css';
  style.textContent = [
    ...COSMETICS.filter(item => item.kind === 'wallpaper').map(item =>
      '.cd-screen[data-theme="' + item.id + '"],.cd-wallpapers [data-theme="' + item.id + '"]{--night:' + item.palette.night +
      ';--horizon:' + item.palette.horizon + ';--glow:' + item.palette.glow + ';--beam:' + item.palette.beam + '}'),
    '.cd-shell[data-frame] .cd-desktop::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:0}',
    '.cd-shell[data-frame="scan"] .cd-desktop::after{background:repeating-linear-gradient(rgba(0,0,0,.22) 0 1px,transparent 1px 3px)}',
    '.cd-shell[data-frame="grid"] .cd-desktop::after{background-image:linear-gradient(rgba(154,220,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(154,220,255,.09) 1px,transparent 1px);background-size:40px 40px}',
    '.cd-shell[data-frame="vignette"] .cd-desktop::after{box-shadow:inset 0 0 150px 45px rgba(0,0,0,.62)}',
    '.cd-shell[data-frame="crt"] .cd-desktop::after{background:repeating-linear-gradient(rgba(120,255,190,.05) 0 1px,transparent 1px 2px),radial-gradient(ellipse at center,transparent 58%,rgba(0,0,0,.5))}',
    '.cd-shell[data-frame="grain"] .cd-desktop::after{background-image:repeating-radial-gradient(circle at 30% 40%,rgba(255,255,255,.055) 0 1px,transparent 1px 2px);background-size:3px 3px;opacity:.55}',
    '.cd-shell[data-frame="blueprint"] .cd-desktop::after{background-image:linear-gradient(rgba(90,170,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(90,170,255,.12) 1px,transparent 1px);background-size:24px 24px;box-shadow:inset 0 0 0 1px rgba(90,170,255,.35)}',
    '.cd-shell[data-frame="midnight"] .cd-desktop::after{background:linear-gradient(180deg,rgba(4,8,18,.55),transparent 38%,transparent 62%,rgba(4,8,18,.62))}',
    '.cd-shell[data-frame="ember"] .cd-desktop::after{background:radial-gradient(ellipse at 82% 104%,rgba(255,140,60,.2),transparent 58%)}',
    '.cd-shell[data-dockshape="pill"] .cd-dock{border-radius:999px;padding:5px 16px}',
    '.cd-shell[data-dockshape="boxed"] .cd-dock{border-radius:4px;box-shadow:0 0 0 3px rgba(158,220,255,.14)}',
    '.cd-shell[data-dockshape="minimal"] .cd-dock{border:0;background:#050b14cc;box-shadow:none}',
    '.cd-shell[data-dockshape="glow"] .cd-dock{border-color:var(--acc);box-shadow:0 0 24px color-mix(in srgb,var(--acc) 45%,transparent)}',
    '.cd-shell[data-dockshape="wide"] .cd-dock{max-width:calc(100% - 40px);gap:10px;padding:6px 18px}'
  ].join('\n');
  document.head.append(style);

  /* ---------------------------------------------------------------- the catalogue ------------------------- */
  const ANTIVIRUS = {
    kind: 'antivirus', id: 'shield', name: 'MoundShroud Shield Pro', price: 12000, glyph: '🛡',
    blurb: 'Blocks every fake scam pop-up on the whole fake internet, permanently, without a single scan.'
  };
  const CATALOG = new Map();
  for (const app of APPS) CATALOG.set(app.id, { kind: 'app', id: app.id, name: app.name, price: app.price, blurb: app.blurb, glyph: app.glyph });
  for (const item of COSMETICS) CATALOG.set(item.id, item);
  CATALOG.set(ANTIVIRUS.id, ANTIVIRUS);
  const BY_KIND = kind => [...CATALOG.values()].filter(item => item.kind === kind);

  const keyOf = item => 'vault:' + item.kind + ':' + item.id;
  const owns = item => { const b = bank(); return !!(item && b && b.owns && b.owns(keyOf(item))); };
  const balance = () => (bank() ? bank().balance : 0);
  const tagOf = item => ({
    app: 'app', wallpaper: 'wallpaper', accent: 'accent', frame: 'screen', dock: 'dock', nameplate: 'nameplate', antivirus: 'protection'
  })[item.kind] || item.kind;

  let watchers = [];
  const fire = () => { for (const fn of watchers.slice()) { try { fn(); } catch (e) { /* a closed window cannot break a purchase */ } } };

  function buy(id) {
    const item = CATALOG.get(id);
    const b = bank();
    if (!item) return { ok: false, reason: 'unknown' };
    if (!b) return { ok: false, reason: 'nobank' };
    if (b.owns(keyOf(item))) return { ok: true, already: true };
    if (b.balance < item.price) {
      return { ok: false, reason: 'short', short: Math.round((item.price - b.balance) * 100) / 100 };
    }
    if (!b.buy(keyOf(item), item.price, 'Surplus Vault · ' + item.name)) return { ok: false, reason: 'short' };
    fire();
    return { ok: true };
  }

  function use(id) {
    const item = CATALOG.get(id);
    if (!item || !owns(item)) return false;
    const a = api();
    if (item.kind === 'app') { if (a.open) a.open(item.id); return true; }
    if (item.kind === 'wallpaper') { if (a.wallpaper) a.wallpaper(item.value); return true; }
    if (item.kind === 'accent') { if (a.accent) a.accent(item.value); return true; }
    if (item.kind === 'frame') { if (a.setFrame) a.setFrame(item.value); return true; }
    if (item.kind === 'dock') { if (a.setDock) a.setDock(item.value); return true; }
    if (item.kind === 'nameplate') { if (a.setNameplate) a.setNameplate(item.value); return true; }
    return false;
  }

  /* ---------------------------------------------------------------- what the desktop asks ------------------ */
  function entries() {
    const out = {};
    for (const app of APPS) out[app.id] = [app.glyph, app.name];
    return out;
  }
  function locked(id) {
    return APPS.some(app => app.id === id) && !owns(CATALOG.get(id));
  }
  function render(id, body) {
    const app = APPS.find(entry => entry.id === id);
    if (!app) return null;
    if (locked(id)) {
      el(body, '<h2>Not installed</h2><p>This one is still on the shelf at the Surplus Vault: ' + esc(money(app.price)) + '.</p>');
      return null;
    }
    try {
      return app.run(body) || null;
    } catch (error) {
      el(body, '<h2>That app could not start</h2><p class="mute">' + esc(String(error && error.message || error)) + '</p>');
      return null;
    }
  }
  const blocks = () => owns(ANTIVIRUS);

  /* ---------------------------------------------------------------- the website --------------------------- */
  const esc2 = esc;
  const purse = () => {
    const b = bank();
    return '<div class="card" style="text-align:right;min-width:210px"><small>In the practice account</small>' +
      '<div class="price" style="font-size:26px;margin:2px 0">' + money(b ? b.balance : 0) + '</div>' +
      '<small>' + money(b ? b.earnedTotal : 0) + ' earned overall</small></div>';
  };
  const head = (kicker, title, lede) => '<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;justify-content:space-between;margin-bottom:20px">' +
    '<div style="flex:1 1 420px"><span class="badge">Surplus Vault</span><h1 style="margin:10px 0 8px">' + esc2(title) + '</h1>' +
    '<p class="lede" style="margin:0">' + lede + '</p></div>' + purse() + '</div>';
  const tabs = active => '<div class="hero-row" style="margin:0 0 20px">' +
    [['/', 'Everything'], ['/apps', 'Apps (' + BY_KIND('app').length + ')'],
      ['/cosmetics', 'Cosmetics (' + COSMETICS.length + ')'], ['/antivirus', 'Antivirus'], ['/owned', 'What you own']]
      .map(([href, label]) => '<a class="' + (href === active ? 'btn' : 'btn-ghost') + '" href="' + href + '">' + esc2(label) + '</a>')
      .join('') + '</div>';

  const cardFor = (item, useWord) => {
    const owned = owns(item);
    const short = Math.max(0, Math.round((item.price - balance()) * 100) / 100);
    return '<div class="card" style="margin-bottom:10px;display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;align-items:flex-start">' +
      '<div style="flex:1 1 260px"><b>' + esc2((item.glyph ? item.glyph + ' ' : '') + item.name) +
      ' <span class="badge">' + esc2(tagOf(item)) + '</span></b>' +
      '<p class="mute" style="margin:6px 0 0">' + esc2(item.blurb) + '</p></div>' +
      '<div style="text-align:right;min-width:172px">' + (owned
        ? '<span class="badge">Owned</span><div style="margin-top:8px">' +
          (item.kind === 'antivirus' ? '<span class="mute">Watching every site</span>' : '<a class="btn-ghost" href="/use/' + item.id + '">' + esc2(useWord || 'Use it') + '</a>') + '</div>'
        : '<div class="price">' + money(item.price) + '</div><a class="' + (short > 0 ? 'btn-ghost' : 'btn') + '" href="/buy/' +
          item.id + '">Unlock · ' + money(item.price) + '</a>' +
          (short > 0 ? '<div class="mute" style="font-size:12px;margin-top:4px">' + money(short) + ' to go</div>' : '')) +
      '</div></div>';
  };

  const trappedCount = () => {
    try { return A.cyberWeb && A.cyberWeb.trapped ? A.cyberWeb.trapped().length : 0; } catch (error) { return 0; }
  };

  function homePage() {
    const all = [...CATALOG.values()], owned = all.filter(owns).length;
    const appsOwned = BY_KIND('app').filter(owns).length;
    return head('vault', 'Everything your practice money is for',
      'Eighty-odd unlocks, all paid for with the money the exercises already paid you. Apps install themselves on the Cyber Desktop, ' +
      'cosmetics repaint it, and one expensive shield ends the fake pop-up virus on every site of this invented internet. ' +
      'Nothing here is a real product, a download or a payment.') +
      tabs('/') +
      '<div class="grid-2" style="margin-bottom:22px">' +
        '<div class="card"><h3>🖥 Apps — ' + BY_KIND('app').length + ' of them</h3><p class="mute">Real tools that appear in Applications and on the taskbar once bought: clocks, codecs, a palette studio, a paint canvas and more.</p>' +
          '<div class="hero-row"><a class="btn" href="/apps">Browse the apps</a><span class="mute">' + appsOwned + ' owned</span></div></div>' +
        '<div class="card"><h3>🎨 Cosmetics — ' + COSMETICS.length + '</h3><p class="mute">Eighteen wallpapers, ten accents, screen overlays, dock shapes and the name on the machine.</p>' +
          '<div class="hero-row"><a class="btn" href="/cosmetics">Browse cosmetics</a></div></div>' +
        '<div class="card" style="border-color:#9edcff66"><h3>🛡 Antivirus</h3><p class="mute">MoundShroud Shield Pro is the end-game purchase: it blocks all ' + trappedCount() +
          ' fake scam pop-up traps on this internet before a single window opens.</p><div class="hero-row"><a class="btn" href="/antivirus">See the shield</a></div></div>' +
        '<div class="card"><h3>🧾 Your shelf</h3><p class="mute">' + owned + ' of ' + all.length + ' unlocks owned. Spending here moves money out of the balance; “earned overall” in the Bank never goes down.</p>' +
          '<div class="hero-row"><a class="btn-ghost" href="/owned">What you own</a></div></div>' +
      '</div>' +
      '<h2>Cheapest way in</h2>' + ['passforge', 'base64', 'ascii', 'emoji'].map(id => cardFor(CATALOG.get(id), 'Open it'))
        .join('') +
      '<p class="mute" style="margin-top:18px">Money comes from the work you already do: puzzles, fake-site findings, closed cases, reported phishing, ' +
      'team drills and terminal wins all pay into the same account. The Bank app lists every rate.</p>';
  }

  function appsPage() {
    const apps = BY_KIND('app').sort((a, b) => a.price - b.price);
    return head('vault', 'Apps for the desktop',
      'Each unlock adds a working tool to the Cyber Desktop’s Applications menu and taskbar. They run in this page, offline, and they cost nothing but practice money.') +
      tabs('/apps') + apps.map(item => cardFor(item, 'Open it')).join('');
  }

  function cosmeticsPage() {
    const group = (kind, title, note) => {
      const list = BY_KIND(kind).sort((a, b) => a.price - b.price);
      return '<h2>' + esc2(title) + '</h2><p class="mute">' + esc2(note) + '</p>' + list.map(item => cardFor(item)).join('');
    };
    return head('vault', 'Paint for the shell',
      'Wallpapers, accents and three things the free shop never sold: an overlay on the screen, a different taskbar and the name on the machine.') +
      tabs('/cosmetics') +
      group('wallpaper', 'Wallpapers (' + BY_KIND('wallpaper').length + ')', 'The same four palette variables the free wallpapers use, with different colours. Bought ones appear in Settings › Wallpaper.') +
      group('accent', 'Accents (' + BY_KIND('accent').length + ')', 'The highlight colour for the dock, focus rings and highlights.') +
      group('frame', 'Screen overlays (' + BY_KIND('frame').length + ')', 'A texture over the desktop only: windows stay perfectly readable.') +
      group('dock', 'Taskbar shapes (' + BY_KIND('dock').length + ')', 'Reshapes the dock without changing what is pinned to it.') +
      group('nameplate', 'Machine names (' + BY_KIND('nameplate').length + ')', 'What the corner widget calls this practice machine.');
  }

  function antivirusPage() {
    const owned = owns(ANTIVIRUS);
    const trapped = trappedCount();
    const short = Math.max(0, Math.round((ANTIVIRUS.price - balance()) * 100) / 100);
    return head('vault', 'Shield Pro',
      'The expensive one. ' + trapped + ' sites on this fake internet are booby-trapped with the fake pop-up virus, and this switch turns every one of them off.') +
      tabs('/antivirus') +
      '<div class="hero"><span class="badge">' + (owned ? 'Installed' : 'Grind item') + '</span>' +
      '<h2 style="margin:10px 0 6px">' + ANTIVIRUS.glyph + ' ' + esc2(ANTIVIRUS.name) + '</h2>' +
      '<p class="lede">Open any trapped site — a giveaway, a casino, a “your PC is infected” page — and the desktop fills with pop-ups that ' +
      'pretend to be antivirus. Shield Pro blocks the whole class of them before the first window opens. No scan, no dismissal, no exceptions.</p>' +
      '<table style="margin:14px 0"><tr><th>Protection</th><td>' + (owned ? 'Active · every trapped site is blocked' : 'Not installed') + '</td></tr>' +
      '<tr><th>Traps in the catalogue</th><td>' + trapped + ' sites right now, and more are generated as you browse</td></tr>' +
      '<tr><th>Price</th><td>' + money(ANTIVIRUS.price) + '</td></tr>' +
      '<tr><th>In your account</th><td>' + money(balance()) + (short > 0 ? ' · ' + money(short) + ' to go' : ' · enough to buy it') + '</td></tr></table>' +
      (owned ? '<div class="hero-row"><a class="btn-ghost" href="/">Back to the vault</a></div>'
        : '<div class="hero-row"><a class="' + (short > 0 ? 'btn-ghost' : 'btn') + '" href="/buy/' + ANTIVIRUS.id + '">Unlock · ' + money(ANTIVIRUS.price) + '</a>' +
          '<a class="btn-ghost" href="/cosmetics">Spend it on paint instead</a></div>') +
      '</div>' +
      '<h2>How to actually earn it</h2>' +
      '<table><tr><th>Work</th><th>Pays</th></tr>' +
      '<tr><td>A fake site fully owned (access, leaked .env and backup)</td><td>$250 · $350 on finance</td></tr>' +
      '<tr><td>A breach target fully owned</td><td>$400 · $700 finance</td></tr>' +
      '<tr><td>Every vulnerability found on a simulated site</td><td>$60</td></tr>' +
      '<tr><td>An email website mission</td><td>$50–$270</td></tr>' +
      '<tr><td>A puzzle, a case, a reported phish</td><td>$14–$60</td></tr></table>' +
      '<p class="mute">That is the grind: a dozen owned sites and a handful of drills is most of the way there. Until then the honest ' +
      'anti-malware window still cleans any outbreak for free — it is slower, and it is the lesson.</p>';
  }

  function ownedPage() {
    const owned = [...CATALOG.values()].filter(owns);
    if (!owned.length) {
      return head('vault', 'Nothing owned yet', 'The shelf is full and your account is not. Start with a cheap app; the expensive things will still be here.') +
        tabs('/owned') + '<div class="hero-row"><a class="btn" href="/apps">Browse the apps</a><a class="btn-ghost" href="/">Back to the vault</a></div>';
    }
    return head('vault', 'On your shelf', 'Everything below is already paid for. Cosmetics can be put on again at any time; apps open from the desktop.') +
      tabs('/owned') + owned.map(item => cardFor(item)).join('');
  }

  function buyPage(id) {
    const item = CATALOG.get(id);
    if (!item) return { title: 'Nothing there', inner: '<h1>404</h1><p class="lede">There is nothing under that number on the shelf.</p><p><a class="btn" href="/">Back to the vault</a></p>', status: 404 };
    const result = buy(id);
    if (!result.ok) {
      const short = result.short || 0;
      return {
        title: item.name,
        status: 200,
        inner: '<div class="hero"><span class="badge">Not enough yet</span><h1 style="margin-top:10px">' + esc2(item.name) + '</h1>' +
          '<p class="lede">It costs ' + money(item.price) + ' and the account holds ' + money(balance()) + '. That is ' + money(short) +
          ' short. The Shelf does not do credit: earn it in the labs and come back.</p>' +
          '<div class="hero-row"><a class="btn" href="/antivirus">Where the money goes</a><a class="btn-ghost" href="/">Back to the vault</a></div></div>'
      };
    }
    const action = item.kind === 'app' ? '<a class="btn" href="/open/' + item.id + '">Open it on the desktop</a>'
      : item.kind === 'antivirus' ? '<a class="btn" href="/">Back to the vault</a>'
        : '<a class="btn" href="/use/' + item.id + '">Wear it on the desktop</a>';
    return {
      title: item.name,
      status: 200,
      inner: '<div class="hero"><span class="badge">' + (result.already ? 'Already yours' : 'Paid · ' + money(item.price)) + '</span>' +
        '<h1 style="margin-top:10px">' + esc2((item.glyph ? item.glyph + ' ' : '') + item.name) + '</h1>' +
        '<p class="lede">' + (result.already ? 'You already owned this one, so nothing was charged.' :
          item.kind === 'antivirus' ? 'The shield is active. Every fake scam trap on this internet is blocked from now on.'
            : 'The money left the practice account and the unlock is on your shelf. Nothing was downloaded: this is a switch inside the desktop.') + '</p>' +
        '<div class="hero-row">' + action + '<a class="btn-ghost" href="/owned">See what you own</a></div></div>'
    };
  }

  function usePage(id) {
    const item = CATALOG.get(id);
    if (!item) return { title: 'Nothing there', inner: '<h1>404</h1><p class="lede">There is nothing under that number on the shelf.</p>', status: 404 };
    if (!owns(item)) {
      return { title: item.name, status: 200, inner: '<div class="hero"><span class="badge">Not owned</span><h1 style="margin-top:10px">' + esc2(item.name) +
        '</h1><p class="lede">This one is still on the shelf at ' + money(item.price) + '.</p><div class="hero-row"><a class="btn" href="/buy/' +
        item.id + '">Unlock it</a></div></div>' };
    }
    const applied = use(id);
    return {
      title: item.name,
      status: 200,
      inner: '<div class="hero"><span class="badge">' + (applied ? 'On the desktop' : 'Owned') + '</span>' +
        '<h1 style="margin-top:10px">' + esc2((item.glyph ? item.glyph + ' ' : '') + item.name) + '</h1>' +
        '<p class="lede">' + (applied ? 'It is applied on the Cyber Desktop now. You can change it again from Settings at any time.'
          : 'The desktop is not open, so this was saved on your shelf. Open the Cyber Desktop and use it from Settings, or come back here.') + '</p>' +
        '<div class="hero-row"><a class="btn-ghost" href="/owned">Back to your shelf</a><a class="btn-ghost" href="/cosmetics">Keep shopping</a></div></div>'
    };
  }

  /* every path the shop answers: the shelf, the three sections, buying, wearing and opening */
  function page(path) {
    const clean = String(path || '/').split('?')[0].replace(/\/+$/, '') || '/';
    const action = /^\/(buy|use|open)\/([a-z0-9-]+)$/i.exec(clean);
    if (action) {
      const id = action[2].toLowerCase();
      if (action[1].toLowerCase() === 'buy') return buyPage(id);
      if (action[1].toLowerCase() === 'open') {
        const item = CATALOG.get(id);
        const result = usePage(id);
        if (item && item.kind === 'app' && owns(item)) use(id);
        return result;
      }
      return usePage(id);
    }
    if (clean === '/apps') return { title: 'Apps', status: 200, inner: appsPage() };
    if (clean === '/cosmetics') return { title: 'Cosmetics', status: 200, inner: cosmeticsPage() };
    if (clean === '/antivirus' || clean === '/shield') return { title: 'Shield Pro', status: 200, inner: antivirusPage() };
    if (clean === '/owned') return { title: 'What you own', status: 200, inner: ownedPage() };
    if (clean === '/' || clean === '/index.html') return { title: 'Surplus Vault', status: 200, inner: homePage() };
    return { title: 'Surplus Vault', status: 200, inner: homePage() };
  }

  A.cyberRewards = {
    page, entries, locked, render, blocks, buy, use, owns,
    item: id => CATALOG.get(id) || null,
    all: () => [...CATALOG.values()],
    apps: () => BY_KIND('app'),
    cosmetics: () => COSMETICS.slice(),
    antivirus: blocks,
    antivirusPrice: ANTIVIRUS.price,
    /* the owned wallpapers the desktop's Settings should list beside the free four */
    vaultWallpapers: () => WALLPAPERS.filter(([id]) => owns(CATALOG.get(id))).map(([id, name]) => [id, name]),
    /* the desktop registers one refresher, so a purchase appears in Applications without a reload */
    watch: fn => { watchers = typeof fn === 'function' ? [fn] : []; }
  };
})();
