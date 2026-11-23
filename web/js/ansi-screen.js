/* A small terminal screen for program output. Programs that animate — a matrix rain, a progress bar, a spinner, a
   splash screen — print ANSI escape codes: clear the screen, move the cursor home, colour the next character, overwrite
   the same line with \r. Printing those bytes into a <pre> shows escape soup, and printing only the final buffer shows a
   finished frame with nothing that moved. This keeps a real grid of cells and applies those codes the way a terminal
   does, so every chunk of output can be drawn as the frame it represents, at any moment, in any browser.

   AnsiScreen(cols, rows) · feed(text) · html() · text() · sawControl */
(function () {
  if (window.AnsiScreen) return;
  const esc = c => String(c).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const BASIC = ['#1b1b1b', '#c0392b', '#27ae60', '#b8860b', '#2f6fb5', '#8e44ad', '#1f8a8a', '#c9c9c9'];
  const BRIGHT = ['#555', '#ff6b5e', '#4ee08b', '#ffd166', '#5aa9ff', '#c98bff', '#42d6d6', '#ffffff'];
  const colour = (n, bright) => {
    if (n == null) return '';
    if (n < 8) return (bright ? BRIGHT : BASIC)[n];
    if (n < 16) return BRIGHT[n - 8];
    if (n >= 16 && n <= 231) {
      const i = n - 16, r = Math.floor(i / 36), g = Math.floor((i % 36) / 6), b = i % 6;
      const v = x => (x ? 55 + x * 40 : 0);
      return 'rgb(' + v(r) + ',' + v(g) + ',' + v(b) + ')';
    }
    if (n >= 232) { const v = 8 + (n - 232) * 10; return 'rgb(' + v + ',' + v + ',' + v + ')'; }
    return '';
  };

  class Screen {
    constructor(cols, rows) {
      this.cols = Math.max(20, Math.min(400, cols || 100));
      this.rows = Math.max(4, Math.min(200, rows || 30));
      this.grid = [];
      this.x = 0; this.y = 0;
      this.attr = Screen.blank();
      this.saved = { x: 0, y: 0 };
      this.pending = '';
      this.sawControl = false;
      this.blank();
    }
    static blank() { return { fg: null, bg: null, bold: false, dim: false, underline: false, inverse: false }; }
    blank() {
      this.grid = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => ({ ch: ' ', ...Screen.blank() })));
    }
    scroll() {
      this.grid.shift();
      this.grid.push(Array.from({ length: this.cols }, () => ({ ch: ' ', ...Screen.blank() })));
      this.y = this.rows - 1;
    }
    newline() { this.x = 0; this.y++; if (this.y >= this.rows) this.scroll(); }
    put(ch) {
      if (this.x >= this.cols) this.newline();
      const cell = this.grid[this.y][this.x];
      cell.ch = ch;
      cell.fg = this.attr.fg; cell.bg = this.attr.bg; cell.bold = this.attr.bold; cell.dim = this.attr.dim;
      cell.underline = this.attr.underline; cell.inverse = this.attr.inverse;
      this.x++;
      if (this.x >= this.cols) this.newline();
    }
    sgr(params) {
      const ps = params.length ? params : [0];
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p === 0) this.attr = Screen.blank();
        else if (p === 1) this.attr.bold = true;
        else if (p === 2) this.attr.dim = true;
        else if (p === 4) this.attr.underline = true;
        else if (p === 7) this.attr.inverse = true;
        else if (p === 22) { this.attr.bold = false; this.attr.dim = false; }
        else if (p === 24) this.attr.underline = false;
        else if (p === 27) this.attr.inverse = false;
        else if (p >= 30 && p <= 37) this.attr.fg = p - 30;
        else if (p === 39) this.attr.fg = null;
        else if (p >= 40 && p <= 47) this.attr.bg = p - 40;
        else if (p === 49) this.attr.bg = null;
        else if (p >= 90 && p <= 97) this.attr.fg = 8 + (p - 90);
        else if (p >= 100 && p <= 107) this.attr.bg = 8 + (p - 100);
        else if ((p === 38 || p === 48) && ps[i + 1] === 5) { const n = ps[i + 2] | 0; if (p === 38) this.attr.fg = n; else this.attr.bg = n; i += 2; }
        else if ((p === 38 || p === 48) && ps[i + 1] === 2) { const n = this.rgb(ps.slice(i + 2, i + 5)); if (p === 38) this.attr.fg = n; else this.attr.bg = n; i += 4; }
      }
    }
    rgb(list) { this._rgb = list.map(v => Math.max(0, Math.min(255, Number(v) || 0))); return this._rgb; }
    csi(raw) {
      const m = /^([0-9;?:]*)([\x40-\x7e])/.exec(raw);
      if (!m) return; /* incomplete or unknown: drop it */
      const nums = m[1].replace(/[?:]/g, '').split(';').map(v => (v === '' ? NaN : Number(v)));
      const n = k => (Number.isFinite(nums[k]) ? nums[k] : NaN);
      const arg = k => (Number.isFinite(n(k)) ? n(k) : 1);
      const code = m[2];
      this.sawControl = true;
      if (code === 'A') this.y = Math.max(0, this.y - arg(0));
      else if (code === 'B') this.y = Math.min(this.rows - 1, this.y + arg(0));
      else if (code === 'C') this.x = Math.min(this.cols - 1, this.x + arg(0));
      else if (code === 'D') this.x = Math.max(0, this.x - arg(0));
      else if (code === 'E') { this.x = 0; this.y = Math.min(this.rows - 1, this.y + arg(0)); }
      else if (code === 'F') { this.x = 0; this.y = Math.max(0, this.y - arg(0)); }
      else if (code === 'G') this.x = Math.min(this.cols - 1, Math.max(0, arg(0) - 1));
      else if (code === 'H' || code === 'f') {
        this.y = Math.max(0, Math.min(this.rows - 1, (Number.isFinite(n(0)) ? n(0) : 1) - 1));
        this.x = Math.max(0, Math.min(this.cols - 1, (Number.isFinite(n(1)) ? n(1) : 1) - 1));
      } else if (code === 'J') {
        const mode = Number.isFinite(n(0)) ? n(0) : 0;
        if (mode === 2 || mode === 3) { this.blank(); this.x = 0; this.y = 0; }
        else if (mode === 0) {
          for (let c = this.x; c < this.cols; c++) this.grid[this.y][c] = { ch: ' ', ...Screen.blank() };
          for (let r = this.y + 1; r < this.rows; r++) this.grid[r] = Array.from({ length: this.cols }, () => ({ ch: ' ', ...Screen.blank() }));
        } else if (mode === 1) {
          for (let r = 0; r < this.y; r++) this.grid[r] = Array.from({ length: this.cols }, () => ({ ch: ' ', ...Screen.blank() }));
          for (let c = 0; c <= this.x && c < this.cols; c++) this.grid[this.y][c] = { ch: ' ', ...Screen.blank() };
        }
      } else if (code === 'K') {
        const mode = Number.isFinite(n(0)) ? n(0) : 0;
        const from = mode === 0 ? this.x : 0, to = mode === 1 ? this.x : this.cols - 1;
        for (let c = from; c <= to && c < this.cols; c++) this.grid[this.y][c] = { ch: ' ', ...Screen.blank() };
      } else if (code === 'm') this.sgr(nums.filter(v => Number.isFinite(v)).map(v => v));
      else if (code === 's') { this.saved = { x: this.x, y: this.y }; }
      else if (code === 'u') { this.x = this.saved.x; this.y = this.saved.y; }
      else if (code === 'h' || code === 'l') { /* private modes: ignore */ }
      else if (code === 'd') this.y = Math.max(0, Math.min(this.rows - 1, arg(0) - 1));
      else if (code === '@' || code === 'P') { /* insert/delete characters: rare in animations, ignore */ }
    }
    feed(chunk) {
      if (chunk == null) return this;
      const s = this.pending + String(chunk);
      this.pending = '';
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\x1b') {
          this.sawControl = true;
          const rest = s.slice(i + 1);
          if (rest[0] === '[') {
            const m = /^\[[0-9;?:]*[\x40-\x7e]/.exec(rest);
            if (!m) { this.pending = s.slice(i); break; } /* the rest arrives in the next chunk */
            this.csi(m[0].slice(1));
            i += m[0].length;
          } else if (rest[0] === ']') {
            /* OSC title etc.: ends with BEL or ST */
            const end = rest.search(/\x07|\x1b\\/);
            if (end < 0) { this.pending = s.slice(i); break; }
            i += end + (rest[end] === '\x07' ? 1 : 2);
          } else if (rest.length) { i += 1; }
          else { this.pending = s.slice(i); break; }
          continue;
        }
        if (ch === '\r') { this.x = 0; continue; }
        if (ch === '\n') { this.newline(); continue; }
        if (ch === '\b') { this.x = Math.max(0, this.x - 1); continue; }
        if (ch === '\t') { this.x = Math.min(this.cols - 1, (Math.floor(this.x / 8) + 1) * 8); continue; }
        if (ch === '\x00' || ch === '\x07' || ch === '\x0b' || ch === '\x0c') continue;
        this.put(ch);
      }
      return this;
    }
    html() {
      /* trim trailing blank rows so the pane is not mostly empty space */
      let last = this.rows - 1;
      while (last > 0 && this.grid[last].every(c => c.ch === ' ')) last--;
      const out = [];
      for (let r = 0; r <= last; r++) {
        const row = this.grid[r];
        let run = '', style = '', html = '';
        const flush = () => { if (run) html += style ? '<span style="' + style + '">' + esc(run) + '</span>' : esc(run); run = ''; };
        for (let c = 0; c < this.cols; c++) {
          const cell = row[c];
          const next = this.styleOf(cell);
          if (next !== style) { flush(); style = next; }
          run += cell.ch;
        }
        flush();
        out.push(html.replace(/ +$/, ''));
      }
      return out.join('\n');
    }
    styleOf(cell) {
      if (cell.ch === ' ') return '';
      let fg = cell.fg, bg = cell.bg;
      if (cell.inverse) { const t = fg == null ? null : fg; fg = bg == null ? 7 : bg; bg = t == null ? 0 : t; }
      const parts = [];
      if (typeof fg === 'number') parts.push('color:' + colour(fg, fg >= 8 && fg < 16));
      else if (Array.isArray(fg)) parts.push('color:rgb(' + fg.join(',') + ')');
      if (typeof bg === 'number') parts.push('background:' + colour(bg, bg >= 8 && bg < 16));
      else if (Array.isArray(bg)) parts.push('background:rgb(' + bg.join(',') + ')');
      if (cell.bold) parts.push('font-weight:700');
      if (cell.dim) parts.push('opacity:.7');
      if (cell.underline) parts.push('text-decoration:underline');
      return parts.join(';');
    }
    text() {
      let last = this.rows - 1;
      while (last > 0 && this.grid[last].every(c => c.ch === ' ')) last--;
      return this.grid.slice(0, last + 1).map(row => row.map(c => c.ch).join('').replace(/ +$/, '')).join('\n');
    }
  }

  window.AnsiScreen = {
    Screen,
    /* does this text contain terminal control codes at all? */
    hasControl: s => /\x1b\[|\x1b\]|\r(?!\n)|\x08/.test(String(s || ''))
  };
})();
