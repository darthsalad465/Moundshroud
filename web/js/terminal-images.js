/* Terminal pictures — every image file on a simulated machine is really drawn.
   The picture is deterministic: the same path on the same machine always returns the same image, and two
   different files never share one. What is drawn follows the file's own description, its machine and its
   owner, so a screenshot on a Windows box looks like Windows and a camera-roll photo looks like a photo.
   Nothing here loads a stored asset or reaches the network; it all comes from a seeded canvas. */
(() => {
  const A = typeof window !== 'undefined' ? (window.A || (window.A = {})) : null;
  if (!A) return;
  const W = 1280, H = 800;
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /* ---------------------------------------------------------------- seeded randomness */
  const hash = s => {
    let h = 2166136261 >>> 0;
    const t = String(s);
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0 || 1;
  };
  const rngOf = seed => {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  /* ---------------------------------------------------------------- people and places */
  const PEOPLE = ['Priya', 'Marcus', 'Elena', 'Tobias', 'Nadia', 'Sam', 'Ines', 'Rafael', 'Freya', 'Omar',
    'Bea', 'Jonas', 'Lucia', 'Hiro', 'Amara', 'Dmitri', 'Sofia', 'Callum', 'Yara', 'Ewan',
    'Mei', 'Anselm', 'Rosa', 'Kofi', 'Ingrid', 'Pavel', 'Talia', 'Bruno', 'Sanne', 'Ilias'];
  const BOSSES = ['Deborah', 'Gareth', 'Yvonne', 'Callum', 'Miriam', 'Otto', 'Rosalind', 'Vince'];
  const PLACES = ['the break room', 'the second floor', 'the server closet', 'the car park', 'the kitchen',
    'the meeting room', 'the stairwell', 'the print room', 'the loading bay', 'the hot-desking row'];

  /* the caption under the picture: what this file actually is */
  function captionFor(family, r, o) {
    const who = pick(r, PEOPLE), boss = pick(r, BOSSES);
    switch (family) {
      case 'chat': return pick(r, [
        'a chat with ' + who + ': the client got the wrong attachment',
        'a chat with ' + who + ': "please delete that photo of me asleep at the desk"',
        'a chat with ' + who + ' about ' + boss + ' (not meant for ' + boss + ')',
        'a group chat where someone admits the outage was their fault'
      ]);
      case 'mail': return pick(r, [
        'an unsent draft: "Re: resignation — ignore, I was tired"',
        'an email thread where ' + who + ' forwarded the whole argument to ' + boss + ' by accident',
        'an inbox with the rejection letters still unread',
        'a draft complaint about ' + boss + ', never sent'
      ]);
      case 'sheet': return pick(r, [
        'a payroll sheet: column D is headed "do not share"',
        'the salary comparison ' + who + ' built after the last review',
        'a stock sheet where every count is a guess',
        'a budget with one line highlighted in red'
      ]);
      case 'whiteboard': return pick(r, [
        'a whiteboard plan with "DO NOT PUT THIS IN WRITING" in the corner',
        'a whiteboard org chart with two names crossed out',
        'a whiteboard list: "who broke prod — see #incidents"',
        'a whiteboard covered in sticky notes about the migration'
      ]);
      case 'sticky': return pick(r, [
        'a sticky note under the keyboard: the guest wifi password',
        'a sticky note with a bank PIN and "do not tell ' + boss + '"',
        'a sticky note stuck to the monitor: a server password',
        'a sticky note with the alarm code'
      ]);
      case 'photo':
        return pick(r, [
          'a photo of ' + who + ' asleep at their desk at 02:40',
          'a photo of the desk in ' + pick(r, PLACES) + ' after the incident',
          'a photo of the messy stock room nobody wants audited',
          'a photo of a resignation letter half-written on a keyboard',
          'a photo of ' + boss + '\'s whiteboard, taken from the doorway'
        ]);
      case 'selfie': return pick(r, [
        'a tired selfie: "third coffee, still not deployed"',
        'a selfie taken in the bathroom mirror at the office party',
        'a selfie where the badge photo is clearly years out of date',
        'a selfie with the on-call pager still ringing'
      ]);
      case 'doc': return pick(r, [
        'a scanned disciplinary letter, stamped CONFIDENTIAL',
        'a scanned contract with the salary box circled',
        'a scanned ID document left in the printer tray',
        'a scanned resignation letter, unsigned'
      ]);
      case 'badge': return pick(r, [
        'a staff badge photo, taken in a hurry',
        'a badge photo where the lanyard is upside down',
        'a visitor badge for someone who never signed out'
      ]);
      case 'browser': return pick(r, [
        'the admin panel, still logged in as ' + who,
        'a support dashboard with the customer list open',
        'a login page with the password in the URL'
      ]);
      case 'phone': return pick(r, [
        'a lock screen full of messages from ' + who,
        'a lock screen with the on-call alert still up',
        'a lock screen showing a delivery notification for something embarrassing'
      ]);
      case 'code': return pick(r, [
        'an editor with the deploy script open',
        'an editor with a hard-coded admin password in the config',
        'an editor with a TODO: "remove before demo"',
        'an editor with a comment about ' + boss + ' that was never deleted'
      ]);
      case 'rack': return pick(r, [
        'a photo of the rack, one cable labelled "do not touch"',
        'a photo of the server room after the power cut',
        'a photo of the switch with a sticky note on it'
      ]);
      default: return 'a screenshot from the machine';
    }
  }

  /* which kind of picture this file is: the description decides first, the extension and machine after it */
  function familyOf(hint, path, ext, r) {
    const h = String(hint).toLowerCase(), p = String(path).toLowerCase();
    const has = re => re.test(h) || re.test(p);
    if (has(/whiteboard|white board|marker/)) return 'whiteboard';
    if (has(/spreadsheet|excel|\.xlsx|budget|payroll|salary/)) return 'sheet';
    if (has(/chat|whatsapp|slack|discord|telegram|signal|messages|dm /)) return 'chat';
    if (has(/mail|email|inbox|outlook|draft/)) return 'mail';
    if (has(/badge|staff card|visitor|passport|licen[cs]e|id card/)) return 'badge';
    if (has(/receipt|invoice|scanned|scan of|letter|contract/)) return 'doc';
    if (has(/selfie|portrait|me at|my face/)) return 'selfie';
    if (has(/router|rack|switch|server room|cable/)) return 'rack';
    if (has(/sticky|post-it|note under|taped to/)) return 'sticky';
    if (has(/browser|admin|dashboard|login page|web page|portal/)) return 'browser';
    if (has(/phone|lock ?screen|home screen/)) return 'phone';
    if (has(/terminal|console|shell|ssh|putty|xterm/)) return 'terminal';
    if (has(/code|editor|vscode|commit|diff|python|javascript/)) return 'code';
    if (has(/screenshot|screen shot|screencap/)) return pick(r, ['terminal', 'browser', 'chat', 'code']);
    if (ext === 'jpg' || ext === 'jpeg') return pick(r, ['photo', 'selfie', 'photo']);
    if (r() < 0.28) return pick(r, ['photo', 'selfie', 'rack', 'sticky', 'doc']);
    return pick(r, ['terminal', 'browser', 'sheet', 'chat', 'code']);
  }

  function model(opts) {
    opts = opts || {};
    const path = String(opts.path || 'picture.png');
    const host = String(opts.host || 'machine');
    const user = String(opts.user || 'moundshroud');
    const hint = String(opts.text || '');
    const ext = (path.match(/\.([A-Za-z0-9]+)$/) || [, 'png'])[1].toLowerCase();
    const seed = hash(String(opts.seed != null ? opts.seed : '') + '|' + host + '|' + path + '|' + hint);
    const choose = rngOf(seed);
    const family = familyOf(hint, path, ext, choose);
    const draw = rngOf(seed ^ 0x9E3779B9);
    const m = { path, host, user, hint, ext, seed, family, os: opts.os === 'windows' ? 'windows' : 'linux',
      r: draw, caption: '', title: '' };
    m.caption = captionFor(family, rngOf(seed ^ 0x51ED270B), m);
    return m;
  }

  /* ---------------------------------------------------------------- drawing helpers */
  const font = (ctx, size, weight, serial) => { ctx.font = (weight || '400') + ' ' + size + 'px ' + (serial || MONO); };
  const clip = (ctx, s, maxW) => {
    s = String(s);
    if (ctx.measureText(s).width <= maxW) return s;
    let out = s;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
    return out + '…';
  };
  const txt = (ctx, s, x, y, o) => {
    o = o || {};
    font(ctx, o.size || 18, o.weight, o.sans ? SANS : MONO);
    ctx.fillStyle = o.color || '#ffffff';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillText(o.max ? clip(ctx, s, o.max) : String(s), x, y);
    ctx.globalAlpha = 1;
  };
  const fill = (ctx, color, x, y, w, h, radius) => {
    ctx.fillStyle = color;
    if (!radius) { ctx.fillRect(x, y, w, h); return; }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  };
  const stroke = (ctx, color, x, y, w, h, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.strokeRect(x, y, w, h);
  };
  const wrap = (ctx, s, maxW) => {
    const words = String(s).split(/\s+/), lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };
  const bar = (ctx, x, y, w, h, color) => fill(ctx, color, x, y, w, h, h / 2);

  /* a desktop window, so a screenshot reads as a screenshot */
  function chrome(ctx, m, title, dark) {
    const x = 120, y = 90, w = W - 240, h = H - 200;
    const barColor = dark ? '#20262e' : '#e6e8ec';
    const bodyColor = dark ? '#0e1116' : '#ffffff';
    fill(ctx, dark ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.18)', x + 10, y + 14, w, h, 14);
    fill(ctx, bodyColor, x, y, w, h, 14);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, y + 46); ctx.lineTo(x, y + 14); ctx.quadraticCurveTo(x, y, x + 14, y);
    ctx.lineTo(x + w - 14, y); ctx.quadraticCurveTo(x + w, y, x + w, y + 14); ctx.lineTo(x + w, y + 46); ctx.closePath();
    ctx.fillStyle = barColor; ctx.fill();
    ctx.restore();
    bar(ctx, x + 20, y + 18, 12, 12, dark ? '#ff5f57' : '#ff5f57');
    bar(ctx, x + 40, y + 18, 12, 12, '#febc2e');
    bar(ctx, x + 60, y + 18, 12, 12, '#28c840');
    txt(ctx, title, x + 90, y + 30, { size: 16, color: dark ? '#a9b4c0' : '#4a5361', sans: true });
    return { x, y, w, h, body: y + 46 };
  }

  /* ---------------------------------------------------------------- the scenes */
  const SCENES = {};

  SCENES.terminal = (ctx, m) => {
    const r = m.r, win = chrome(ctx, m, m.user + '@' + m.host + ': ~', true);
    fill(ctx, '#0e1116', win.x, win.body, win.w, win.h - 46, 0);
    const lines = [];
    const cmds = [
      'git status', 'ls -la ~/secrets', './deploy.sh --prod', 'sudo systemctl restart nginx',
      'tail -n 200 /var/log/auth.log', 'ps aux | grep node', 'cat .env', 'ssh ' + m.user + '@10.14.20.21',
      'docker ps', 'curl -s localhost:8080/health', 'history | tail -n 12'
    ];
    const outs = [
      'On branch main — working tree clean',
      'Error: DEPLOY_KEY not set in this shell',
      'nginx.service: Failed with result \'exit-code\'',
      'Accepted password for ' + m.user + ' from 10.14.20.' + int(r, 2, 240),
      'DATABASE_URL=postgres://app:' + pick(r, ['hunter2', 'Summer2024!', 'letmein', 'admin123']) + '@db:5432/app',
      'total ' + int(r, 12, 90) + ' — drwx------ ' + int(r, 2, 8) + ' ' + m.user + ' ' + m.user,
      'Permission denied (publickey,password).'
    ];
    for (let i = 0; i < 9; i++) {
      const c = pick(r, cmds);
      lines.push(['$ ' + c, '#cfe9d6']);
      const n = int(r, 0, 2);
      for (let j = 0; j < n; j++) lines.push([pick(r, outs), r() < 0.3 ? '#ff8080' : '#8b98a5']);
    }
    let y = win.body + 44;
    for (const [line, color] of lines.slice(0, 16)) {
      txt(ctx, line, win.x + 34, y, { size: 20, color, max: win.w - 68 });
      y += 34;
    }
    txt(ctx, '$ ', win.x + 34, y, { size: 20, color: '#cfe9d6' });
    fill(ctx, '#cfe9d6', win.x + 58, y - 14, 10, 18);
  };

  SCENES.code = (ctx, m) => {
    const r = m.r;
    const file = pick(r, ['deploy.sh', 'app.js', 'config.py', 'salary.rb', 'notes.md']);
    const win = chrome(ctx, m, file + ' — ' + (m.os === 'windows' ? 'Notepad' : 'gedit'), true);
    fill(ctx, '#10151c', win.x, win.body, win.w, win.h - 46, 0);
    fill(ctx, '#161c24', win.x, win.body, 70, win.h - 46, 0);
    const snippets = {
      'deploy.sh': ['#!/bin/bash', 'set -euo pipefail', 'KEY="sk_live_9f2a1c"   # TODO: move to vault', 'ssh -i $KEY deploy@' + m.host, './migrate.sh && systemctl restart app', 'echo "deployed $(date)"'],
      'app.js': ['const express = require("express")', 'const app = express()', 'const ADMIN = { user: "admin", pass: "' + pick(r, ['admin', 'Spring2024!', 'letmein']) + '" }', 'app.get("/admin", (req, res) => {', '  res.send(users)   // no auth yet, fix later', '})'],
      'config.py': ['DEBUG = True', 'SECRET_KEY = "' + pick(r, ['dev', 'changeme', 'hunter2']) + '"', 'DATABASE = "sqlite:///data.db"', '# remove before the demo — ' + pick(r, BOSSES) + ' said so', 'ALLOWED_HOSTS = ["*"]'],
      'salary.rb': ['STAFF = [' + pick(r, PEOPLE) + ', ' + pick(r, PEOPLE) + ']', 'def raise_for(name)', '  # keep the numbers off the shared drive', '  { "amount" => 112_400 }', 'end'],
      'notes.md': ['# Incident notes', '- 02:12 paged, nobody answered', '- root cause: the config nobody reviewed', '- action: tell ' + pick(r, BOSSES) + ' after the weekend']
    }[file];
    let y = win.body + 40;
    snippets.forEach((line, i) => {
      txt(ctx, String(i + 1).padStart(3, ' '), win.x + 16, y, { size: 18, color: '#4b5665' });
      const col = /^\s*(#|\/\/)/.test(line) ? '#5f6b7a'
        : /const|def|set |if|=>|#!/.test(line) ? '#c792ea'
          : /"[^"]*"/.test(line) ? '#c3e88d' : '#d6deeb';
      txt(ctx, line, win.x + 90, y, { size: 18, color: col, max: win.w - 130 });
      y += 32;
    });
    fill(ctx, '#c792ea', win.x + 84, win.body + 40 + 32 * (snippets.length - 1) - 14, 2, 20);
  };

  SCENES.chat = (ctx, m) => {
    const r = m.r;
    const who = pick(r, PEOPLE);
    const win = chrome(ctx, m, who + ' — ' + (m.os === 'windows' ? 'Messages' : 'Chat'), true);
    fill(ctx, '#0b141a', win.x, win.body, win.w, win.h - 46, 0);
    fill(ctx, '#111d24', win.x, win.body, win.w, 62, 0);
    ctx.beginPath(); ctx.arc(win.x + 40, win.body + 31, 20, 0, Math.PI * 2); ctx.fillStyle = '#2f6f5e'; ctx.fill();
    txt(ctx, who.slice(0, 1), win.x + 40, win.body + 38, { size: 20, color: '#dff7ee', align: 'center' });
    txt(ctx, who, win.x + 72, win.body + 28, { size: 20, color: '#e6f0f3', sans: true, weight: '600' });
    txt(ctx, 'online', win.x + 72, win.body + 50, { size: 15, color: '#7da2a8', sans: true });
    const threads = [
      ['did you send the client the internal estimate?', 'the one with the margin in it?', 'no. no no no', 'I forwarded the whole folder by mistake', 'please tell me the folder was empty', 'it had the salaries in it', 'I am going to lie down under the desk'],
      ['is ' + m.user + ' asleep again', 'photo attached', 'do NOT put that in the group chat', 'too late', 'they are going to see it', 'that is what makes it funny'],
      ['the outage was my fault', 'I ran the migration on prod', 'by hand', 'at 2am', 'without a backup', 'please do not tell ' + pick(r, BOSSES)],
      ['quick one — what is the wifi password again', 'it is on the sticky note under your keyboard', 'which keyboard', 'the one you are typing on']
    ];
    const thread = pick(r, threads);
    let y = win.body + 108;
    thread.forEach((line, i) => {
      const mine = i % 2 === 1;
      font(ctx, 20, '400', SANS);
      const lines = wrap(ctx, line, 430);
      const wgt = Math.max(...lines.map(l => ctx.measureText(l).width)) + 44;
      const hgt = lines.length * 28 + 26;
      const x = mine ? win.x + win.w - wgt - 40 : win.x + 44;
      fill(ctx, mine ? '#005c4b' : '#1f2c34', x, y, wgt, hgt, 12);
      lines.forEach((l, k) => txt(ctx, l, x + 20, y + 30 + k * 28, { size: 20, color: '#e9edef', sans: true }));
      txt(ctx, (mine ? '13:' : '12:') + String(int(r, 10, 58)).padStart(2, '0'), x + wgt - 14, y + hgt - 8,
        { size: 12, color: '#7fa8a0', align: 'right', sans: true });
      y += hgt + 16;
    });
  };

  SCENES.mail = (ctx, m) => {
    const r = m.r;
    const boss = pick(r, BOSSES);
    const win = chrome(ctx, m, 'Inbox (12) — Mail', false);
    fill(ctx, '#ffffff', win.x, win.body, win.w, win.h - 46, 0);
    fill(ctx, '#f4f5f7', win.x, win.body, 250, win.h - 46, 0);
    ['Inbox 12', 'Drafts 3', 'Sent', 'Archive', 'Trash 41'].forEach((s, i) =>
      txt(ctx, s, win.x + 24, win.body + 48 + i * 40, { size: 18, color: i === 0 ? '#1a1d21' : '#6b7280', sans: true, weight: i === 0 ? '600' : '400' }));
    const subject = pick(r, [
      'Re: resignation — ignore, I was tired',
      'Fwd: the actual numbers (do not share)',
      'Re: Re: Re: the thing we discussed',
      'Draft — complaint about ' + boss
    ]);
    fill(ctx, '#ffffff', win.x + 250, win.body, win.w - 250, 74, 0);
    txt(ctx, subject, win.x + 276, win.body + 32, { size: 22, color: '#14181c', sans: true, weight: '600', max: win.w - 320 });
    txt(ctx, 'from ' + m.user + '@' + m.host.toLowerCase() + '  ·  draft, never sent', win.x + 276, win.body + 58,
      { size: 15, color: '#8a929c', sans: true });
    const body = [
      'Hi ' + boss + ',',
      'Sorry about the message last night. I had been awake for nineteen hours and I did not mean the part about the team.',
      'The part about the deadline I do mean.',
      'Also, ' + pick(r, PEOPLE) + ' asked me not to forward the salary sheet, so I have deleted it from the shared drive. Mostly.',
      'Thanks,',
      m.user
    ];
    let y = win.body + 118;
    font(ctx, 19, '400', SANS);
    for (const para of body) {
      for (const line of wrap(ctx, para, win.w - 340)) {
        txt(ctx, line, win.x + 276, y, { size: 19, color: '#23282e', sans: true });
        y += 30;
      }
      y += 12;
    }
    fill(ctx, '#ffe8e6', win.x + win.w - 220, win.body + 96, 154, 34, 8);
    txt(ctx, 'DRAFT · not sent', win.x + win.w - 143, win.body + 118, { size: 15, color: '#a4232b', sans: true, align: 'center', weight: '600' });
  };

  SCENES.sheet = (ctx, m) => {
    const r = m.r;
    const win = chrome(ctx, m, 'payroll_2026.xlsx — Spreadsheet', false);
    fill(ctx, '#ffffff', win.x, win.body, win.w, win.h - 46, 0);
    fill(ctx, '#f1f3f5', win.x, win.body, win.w, 34, 0);
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const colW = (win.w - 60) / cols.length;
    cols.forEach((c, i) => txt(ctx, c, win.x + 30 + i * colW + colW / 2, win.body + 22,
      { size: 14, color: '#5c6673', align: 'center' }));
    const head = ['name', 'role', 'grade', 'salary', 'review', 'bonus', 'notes'];
    const rowH = 38;
    head.forEach((h, i) => {
      fill(ctx, '#e8ebef', win.x + 24 + i * colW, win.body + 40, colW - 2, rowH, 0);
      txt(ctx, h, win.x + 32 + i * colW, win.body + 65, { size: 16, color: '#2c3440', weight: '600' });
    });
    const names = [pick(r, PEOPLE), pick(r, PEOPLE), pick(r, PEOPLE), m.user, pick(r, PEOPLE), pick(r, PEOPLE)];
    names.forEach((n, row) => {
      const y = win.body + 40 + (row + 1) * rowH;
      const vals = [n, pick(r, ['engineer', 'analyst', 'manager', 'support', 'designer']),
        pick(r, ['B2', 'C1', 'A3', 'B1']), String(int(r, 34, 118) * 1000),
        pick(r, ['meets', 'exceeds', 'needs work', '—']), String(int(r, 0, 9)) + '%',
        pick(r, ['', 'keep private', '', 'see HR'])];
      vals.forEach((v, i) => {
        if (i === 3 && row === 3) fill(ctx, '#ffe3e3', win.x + 24 + i * colW, y, colW - 2, rowH, 0);
        txt(ctx, v, win.x + 32 + i * colW, y + 25, { size: 15, color: i === 3 && row === 3 ? '#b3261e' : '#333b46', max: colW - 16 });
      });
      stroke(ctx, '#e6eaee', win.x + 24, y + rowH, win.w - 48, 0.5, 1);
    });
    const hy = win.body + 40 + 4 * rowH;
    fill(ctx, '#fff6d6', win.x + 24, hy, win.w - 48, rowH, 0);
    txt(ctx, 'note: do not share this column with the team — ' + pick(r, BOSSES), win.x + 32, hy + 25, { size: 15, color: '#7a5b00', sans: true });
  };

  SCENES.doc = (ctx, m) => {
    const r = m.r;
    fill(ctx, '#2b2f33', 0, 0, W, H);
    const x = 300, y = 40, w = 680, h = H - 80;
    fill(ctx, 'rgba(0,0,0,.45)', x + 12, y + 16, w, h, 4);
    fill(ctx, '#f6f2e7', x, y, w, h, 3);
    txt(ctx, pick(r, ['MERIDIAN HOLDINGS', 'NORTHGATE LOGISTICS', 'BRINDLE & SONS']), x + 48, y + 70,
      { size: 20, color: '#3b3a33', weight: '700', sans: true });
    txt(ctx, 'CONFIDENTIAL', x + w - 60, y + 70, { size: 16, color: '#a08b52', align: 'right', weight: '700', sans: true });
    fill(ctx, '#c9c2ad', x + 48, y + 90, w - 96, 2, 0);
    txt(ctx, pick(r, ['Notice of disciplinary meeting', 'Offer of employment', 'Resignation', 'Salary review']),
      x + 48, y + 140, { size: 26, color: '#22201a', weight: '700', sans: true, max: w - 96 });
    font(ctx, 17, '400', SANS);
    const para = 'This document records the meeting held on ' + int(r, 1, 28) + ' ' +
      pick(r, ['January', 'March', 'June', 'September']) + ' 2026 between ' + m.user + ' and ' + pick(r, BOSSES) +
      '. The matters discussed are to remain private to the parties involved. Any distribution of this document, ' +
      'including by photograph, is a breach of the policy attached at appendix ' + int(r, 1, 4) + '.';
    let ly = y + 190;
    for (const line of wrap(ctx, para, w - 96)) {
      txt(ctx, line, x + 48, ly, { size: 17, color: '#4a473e', sans: true });
      ly += 28;
    }
    for (let i = 0; i < 6; i++) { fill(ctx, '#d8d2c2', x + 48, ly + 8, w - 96 - int(r, 0, 160), 8, 4); ly += 26; }
    ctx.save();
    ctx.translate(x + w - 170, y + h - 130); ctx.rotate(-0.22);
    ctx.strokeStyle = 'rgba(168,42,42,.55)'; ctx.lineWidth = 5;
    ctx.strokeRect(-90, -26, 180, 52);
    txt(ctx, 'CONFIDENTIAL', 0, 10, { size: 22, color: 'rgba(168,42,42,.65)', align: 'center', weight: '700' });
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(x + 48, y + h - 90);
    ctx.bezierCurveTo(x + 110, y + h - 120, x + 160, y + h - 60, x + 220, y + h - 96);
    ctx.strokeStyle = '#2f3b52'; ctx.lineWidth = 2.5; ctx.stroke();
  };

  SCENES.badge = (ctx, m) => {
    const r = m.r;
    const x = 340, y = 60, w = 600, h = 680;
    fill(ctx, '#1a1d21', 0, 0, W, H);
    fill(ctx, '#f2f4f6', x, y, w, h, 16);
    fill(ctx, '#2f5d8c', x, y, w, 96, 16);
    txt(ctx, 'STAFF', x + 32, y + 58, { size: 30, color: '#ffffff', weight: '700', sans: true });
    txt(ctx, pick(r, ['MERIDIAN', 'NORTHGATE', 'BRINDLE']), x + w - 32, y + 58,
      { size: 22, color: 'rgba(255,255,255,.8)', align: 'right', sans: true, weight: '600' });
    const px = x + 140, py = y + 150, pw = 320, ph = 360;
    fill(ctx, '#d8dde3', px, py, pw, ph, 8);
    /* a rushed portrait: head and shoulders, badly framed */
    fill(ctx, '#9fb0bf', px + pw / 2 - 70, py + 90, 140, 170, 70);
    ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph - 20, 130, 110, 0, Math.PI, Math.PI * 2); ctx.fillStyle = '#6c7f92'; ctx.fill();
    txt(ctx, pick(r, ['photo taken at 07:58', 'replace this photo', 'new starter — no photo']), px + pw / 2, py + ph - 16,
      { size: 14, color: '#3c464f', align: 'center', sans: true });
    const who = m.user.charAt(0).toUpperCase() + m.user.slice(1);
    txt(ctx, who + ' ' + pick(r, ['Okafor', 'Whitfield', 'Kovac', 'Delacroix', 'Raman']), x + 40, y + 570,
      { size: 30, color: '#1b2027', weight: '700', sans: true });
    txt(ctx, pick(r, ['Facilities', 'Support', 'Engineering', 'Finance']) + ' · visitor · expires ' + int(r, 1, 28) + '/12',
      x + 40, y + 604, { size: 17, color: '#5a6470', sans: true });
    for (let i = 0; i < 42; i++) fill(ctx, i % 3 ? '#1b2027' : '#f2f4f6', x + 40 + i * 4, y + 622, i % 3 ? 3 : 1.5, 40, 0);
  };

  SCENES.whiteboard = (ctx, m) => {
    const r = m.r;
    fill(ctx, '#20242a', 0, 0, W, H);
    const x = 70, y = 50, w = W - 140, h = H - 100;
    fill(ctx, '#9aa3ab', x, y, w, h, 6);
    fill(ctx, '#f4f6f5', x + 14, y + 14, w - 28, h - 28, 3);
    /* marker writing */
    const heading = pick(r, ['MIGRATION PLAN', 'Q3 — what we tell them', 'INCIDENT REVIEW', 'TEAM SHAPE']);
    txt(ctx, heading, x + 70, y + 92, { size: 40, color: '#243b6b', weight: '700', sans: true });
    const notes = [
      ['cutover fri 22:00', '#ffe066'], ['who owns rollback?', '#ffb3c1'], ['tell ' + pick(r, BOSSES) + ' AFTER', '#b8f2c9'],
      ['do NOT put this in writing', '#ffd6a5'], ['nobody tested this', '#c9d7ff'], ['2 people leaving', '#ffe066']
    ];
    for (let i = 0; i < notes.length; i++) {
      const nx = x + 80 + (i % 3) * 320 + int(r, -10, 10);
      const ny = y + 160 + Math.floor(i / 3) * 210 + int(r, -8, 8);
      ctx.save(); ctx.translate(nx + 120, ny + 80); ctx.rotate((r() - 0.5) * 0.08);
      fill(ctx, notes[i][1], -120, -80, 240, 160, 2);
      fill(ctx, 'rgba(0,0,0,.08)', -120, 60, 240, 20, 0);
      font(ctx, 24, '600', SANS);
      wrap(ctx, notes[i][0], 200).slice(0, 4).forEach((l, k) =>
        txt(ctx, l, -100, -30 + k * 34, { size: 24, color: '#20242a', sans: true }));
      ctx.restore();
    }
    /* org chart scribble */
    ctx.strokeStyle = 'rgba(36,59,107,.65)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 150, y + 560); ctx.lineTo(x + 300, y + 560); ctx.lineTo(x + 300, y + 640);
    ctx.lineTo(x + 480, y + 640); ctx.stroke();
    txt(ctx, pick(r, BOSSES) + ' → gone?', x + 510, y + 648, { size: 26, color: '#243b6b', sans: true });
    fill(ctx, '#d6d9db', x + 40, y + h - 60, 160, 14, 7);
  };

  SCENES.sticky = (ctx, m) => {
    const r = m.r;
    fill(ctx, '#3a3630', 0, 0, W, H);
    fill(ctx, '#b79a6a', 60, 40, W - 120, H - 80, 8);           /* desk */
    for (let i = 0; i < 60; i++) fill(ctx, 'rgba(0,0,0,.05)', int(r, 60, W - 120), int(r, 40, H - 60), int(r, 20, 160), 2, 0);
    const x = 360, y = 150, w = 560, h = 480;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.045);
    fill(ctx, 'rgba(0,0,0,.25)', -w / 2 + 14, -h / 2 + 18, w, h, 4);
    fill(ctx, '#ffe873', -w / 2, -h / 2, w, h, 3);
    fill(ctx, 'rgba(255,255,255,.35)', -w / 2, -h / 2, w, 60, 3);
    const lines = pick(r, [
      ['wifi: GuestNet-5G', 'pass: Summer2024!', '(do not change it)'],
      ['server room', 'root / ' + pick(r, ['changeme', 'letmein!', 'M0nth1y!']), '— ' + pick(r, BOSSES)],
      ['bank PIN 4815', 'card under the', 'keyboard — DO NOT TELL ' + pick(r, BOSSES).toUpperCase()],
      ['alarm code', '0418 # then 2', 'reset = ' + int(r, 1000, 9999)]
    ]);
    font(ctx, 34, '500', SANS);
    lines.forEach((l, i) => txt(ctx, l, -w / 2 + 44, -h / 2 + 140 + i * 60,
      { size: 34, color: i === 0 ? '#25324a' : '#2b2b2b', sans: true }));
    txt(ctx, '— ' + m.user, w / 2 - 50, h / 2 - 50, { size: 26, color: '#4a4433', align: 'right', sans: true });
    ctx.restore();
  };

  SCENES.photo = (ctx, m) => {
    const r = m.r;
    const night = r() < 0.5;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, night ? '#20262e' : '#b9c3cc');
    g.addColorStop(1, night ? '#0d1013' : '#7f8b95');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const deskY = H * 0.62;
    fill(ctx, night ? '#2a2118' : '#8a7256', 0, deskY, W, H - deskY, 0);
    /* monitor */
    const mx = 300, my = deskY - 300, mw = 620, mh = 330;
    fill(ctx, '#1a1d21', mx - 12, my - 12, mw + 24, mh + 24, 10);
    fill(ctx, night ? '#12324a' : '#1d3b57', mx, my, mw, mh, 4);
    for (let i = 0; i < 14; i++) fill(ctx, night ? 'rgba(120,200,255,.55)' : 'rgba(200,230,255,.45)',
      mx + 24, my + 30 + i * 20, int(r, 60, mw - 80), 6, 3);
    fill(ctx, '#111417', mx + mw / 2 - 30, my + mh, 60, 34, 2);
    fill(ctx, '#111417', mx + mw / 2 - 110, my + mh + 34, 220, 12, 6);
    /* keyboard, mug, papers */
    fill(ctx, '#3b3f44', 380, deskY + 80, 460, 70, 8);
    for (let i = 0; i < 40; i++) fill(ctx, '#272b2f', 396 + (i % 14) * 31, deskY + 90 + Math.floor(i / 14) * 20, 25, 14, 2);
    ctx.beginPath(); ctx.arc(980, deskY + 60, 46, 0, Math.PI * 2); ctx.fillStyle = night ? '#e8e2d4' : '#f0e9db'; ctx.fill();
    ctx.beginPath(); ctx.arc(980, deskY + 60, 34, 0, Math.PI * 2); ctx.fillStyle = '#3a2a20'; ctx.fill();
    fill(ctx, '#f2efe6', 130, deskY + 26, 180, 120, 2);
    for (let i = 0; i < 4; i++) fill(ctx, 'rgba(60,60,60,.35)', 146, deskY + 46 + i * 22, 140 - i * 16, 4, 2);
    /* a person, asleep on the desk */
    if (r() < 0.5) {
      fill(ctx, '#2b3a4a', 760, deskY - 30, 260, 90, 40);
      ctx.beginPath(); ctx.arc(880, deskY - 40, 58, 0, Math.PI * 2); ctx.fillStyle = '#c9a68a'; ctx.fill();
      ctx.beginPath(); ctx.arc(880, deskY - 62, 60, Math.PI, Math.PI * 2); ctx.fillStyle = '#3a2b22'; ctx.fill();
      txt(ctx, 'zzz', 960, deskY - 120, { size: 34, color: 'rgba(255,255,255,.7)', sans: true });
    }
    /* window light */
    if (!night) {
      const wg = ctx.createLinearGradient(900, 0, 1280, 500);
      wg.addColorStop(0, 'rgba(255,240,200,.45)'); wg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = wg; ctx.fillRect(860, 0, 420, 520);
    }
    /* grain and vignette, so it reads as a photograph */
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = 'rgba(' + int(r, 0, 255) + ',' + int(r, 0, 255) + ',' + int(r, 0, 255) + ',' + (0.02 + r() * 0.04) + ')';
      ctx.fillRect(int(r, 0, W), int(r, 0, H), 2, 2);
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    txt(ctx, 'IMG_' + int(r, 1000, 9999) + '  ·  ' + int(r, 1, 28) + '/' + int(r, 1, 12) + '/2026  ' +
      String(int(r, 0, 23)).padStart(2, '0') + ':' + String(int(r, 0, 59)).padStart(2, '0'),
      40, H - 34, { size: 18, color: 'rgba(255,255,255,.55)' });
  };

  SCENES.selfie = (ctx, m) => {
    const r = m.r;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#26313b'); g.addColorStop(1, '#101418');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    fill(ctx, 'rgba(255,220,180,.10)', 0, 0, W, H * 0.5, 0);
    /* head and shoulders, off-centre, badly lit */
    const cx = W / 2 + int(r, -60, 60);
    ctx.beginPath(); ctx.ellipse(cx, H * 0.66, 250, 240, 0, Math.PI, Math.PI * 2); ctx.fillStyle = '#2f3a46'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, 380, 175, 200, 0, 0, Math.PI * 2); ctx.fillStyle = '#c39c80'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, 300, 185, 120, 0, Math.PI, Math.PI * 2); ctx.fillStyle = '#241a14'; ctx.fill();
    /* tired eyes */
    fill(ctx, '#2a2018', cx - 80, 370, 46, 10, 5);
    fill(ctx, '#2a2018', cx + 34, 370, 46, 10, 5);
    ctx.beginPath(); ctx.arc(cx, 430, 20, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 6; ctx.strokeStyle = '#8a5c46'; ctx.stroke();
    /* phone held at arm's length, screen glare */
    fill(ctx, 'rgba(255,255,255,.12)', 60, 80, 260, 180, 16);
    txt(ctx, pick(r, ['00:47', '03:12', '04:58']), 100, 190, { size: 56, color: 'rgba(255,255,255,.35)' });
    /* caption strip */
    fill(ctx, 'rgba(0,0,0,.45)', 0, H - 130, W, 130, 0);
    const cap = pick(r, ['still here. still not deployed.', 'third coffee. it is 3am.', 'on call again lol',
      'the pager went off during dinner', 'day 4 of the outage']);
    txt(ctx, cap, 60, H - 60, { size: 34, color: '#f2f4f6', sans: true, max: W - 120 });
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.01 + r() * 0.03) + ')';
      ctx.fillRect(int(r, 0, W), int(r, 0, H), 2, 2);
    }
  };

  SCENES.rack = (ctx, m) => {
    const r = m.r;
    fill(ctx, '#0b0e11', 0, 0, W, H);
    for (let row = 0; row < 2; row++) {
      const x = 150 + row * 520, y = 120, w = 440, h = 560;
      fill(ctx, '#1b2026', x, y, w, h, 6);
      for (let i = 0; i < 12; i++) {
        const uy = y + 20 + i * 44;
        fill(ctx, '#252c33', x + 12, uy, w - 24, 36, 3);
        for (let k = 0; k < 8; k++) {
          ctx.beginPath(); ctx.arc(x + 34 + k * 16, uy + 18, 3, 0, Math.PI * 2);
          ctx.fillStyle = r() < 0.7 ? '#39d98a' : r() < 0.5 ? '#ffb020' : '#ff4d4f'; ctx.fill();
        }
        fill(ctx, '#12161a', x + w - 90, uy + 10, 60, 16, 2);
      }
    }
    fill(ctx, '#14181d', 0, H - 90, W, 90, 0);
    txt(ctx, 'rack ' + int(r, 1, 4) + ' · ' + m.host.toUpperCase() + ' · ' + pick(r, ['do not touch', 'spare port', 'uplink']),
      40, H - 40, { size: 20, color: 'rgba(255,255,255,.45)' });
    const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  };

  SCENES.browser = (ctx, m) => {
    const r = m.r;
    const win = chrome(ctx, m, 'Admin — ' + m.host, false);
    fill(ctx, '#f7f8fa', win.x, win.body, win.w, win.h - 46, 0);
    fill(ctx, '#ffffff', win.x, win.body, win.w, 56, 0);
    fill(ctx, '#e9edf2', win.x + 20, win.body + 12, win.w - 40, 32, 8);
    txt(ctx, 'http://' + m.host.toLowerCase() + '/admin/users?sort=password', win.x + 36, win.body + 34,
      { size: 16, color: '#5b6572', sans: true, max: win.w - 80 });
    fill(ctx, '#2f5d8c', win.x, win.body + 56, win.w, 52, 0);
    txt(ctx, 'Users', win.x + 32, win.body + 88, { size: 20, color: '#ffffff', weight: '600', sans: true });
    txt(ctx, 'signed in as ' + m.user, win.x + win.w - 32, win.body + 88, { size: 16, color: 'rgba(255,255,255,.8)', align: 'right', sans: true });
    const cols = [['name', 0], ['email', 220], ['role', 560], ['password', 720]];
    cols.forEach(([c, dx]) => txt(ctx, c, win.x + 34 + dx, win.body + 140, { size: 15, color: '#77808c', weight: '600', sans: true }));
    const rows = [[m.user, m.user + '@' + m.host.toLowerCase(), 'admin', pick(r, ['Summer2024!', 'letmein', 'changeme', 'hunter2'])],
    [pick(r, PEOPLE), pick(r, PEOPLE).toLowerCase() + '@corp.example', 'support', '••••••'],
    [pick(r, PEOPLE), pick(r, PEOPLE).toLowerCase() + '@corp.example', 'finance', '••••••'],
    [pick(r, PEOPLE), pick(r, PEOPLE).toLowerCase() + '@corp.example', 'contractor', 'password1']];
    rows.forEach((row, i) => {
      const y = win.body + 150 + i * 52;
      if (i % 2) fill(ctx, '#fafbfc', win.x + 20, y, win.w - 40, 52, 0);
      row.forEach((v, k) => txt(ctx, v, win.x + 34 + cols[k][1], y + 34,
        { size: 16, color: k === 3 && i === 0 ? '#a4232b' : '#333b46', sans: true, max: 200 }));
    });
    fill(ctx, '#ffe8e6', win.x + 34, win.body + 380, win.w - 68, 70, 8);
    txt(ctx, 'No authentication is configured on this page. Anyone on the network can read it.',
      win.x + 56, win.body + 410, { size: 17, color: '#a4232b', sans: true, max: win.w - 120 });
    txt(ctx, 'last login: 3 days ago from 10.14.20.' + int(r, 2, 240), win.x + 34, win.body + 490,
      { size: 15, color: '#77808c', sans: true });
  };

  SCENES.phone = (ctx, m) => {
    const r = m.r;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1b2a3a'); g.addColorStop(1, '#0c1218');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const x = 430, y = 60, w = 420, h = 690;
    fill(ctx, '#0a0d11', x - 8, y - 8, w + 16, h + 16, 46);
    fill(ctx, '#12202c', x, y, w, h, 40);
    txt(ctx, String(int(r, 0, 5)).padStart(2, '0') + ':' + String(int(r, 10, 59)), x + w / 2, y + 120,
      { size: 84, color: 'rgba(255,255,255,.85)', align: 'center', sans: true, weight: '300' });
    txt(ctx, pick(r, ['Thursday 12 March', 'Monday 3 November', 'Saturday 28 June']), x + w / 2, y + 158,
      { size: 18, color: 'rgba(255,255,255,.55)', align: 'center', sans: true });
    const notices = [
      [pick(r, PEOPLE), 'did you send the salary sheet to everyone'],
      [pick(r, PEOPLE), 'call me before ' + pick(r, BOSSES) + ' sees the ticket'],
      ['Calendar', 'incident review — 08:00 (you are presenting)'],
      [pick(r, PEOPLE), 'the photo is on the shared drive. sorry.']
    ];
    notices.forEach(([who, body], i) => {
      const ny = y + 200 + i * 108;
      fill(ctx, 'rgba(255,255,255,.09)', x + 18, ny, w - 36, 92, 14);
      fill(ctx, 'rgba(120,190,255,.35)', x + 32, ny + 18, 26, 26, 8);
      txt(ctx, who, x + 72, ny + 26, { size: 15, color: 'rgba(255,255,255,.6)', sans: true });
      font(ctx, 17, '400', SANS);
      wrap(ctx, body, w - 100).slice(0, 2).forEach((l, k) =>
        txt(ctx, l, x + 72, ny + 50 + k * 22, { size: 17, color: '#ffffff', sans: true }));
    });
    fill(ctx, 'rgba(255,255,255,.5)', x + w / 2 - 60, y + h - 26, 120, 6, 3);
  };

  const draw = (ctx, m) => {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    (SCENES[m.family] || SCENES.photo)(ctx, m);
    ctx.restore();
    /* the same discreet frame on every picture, so the viewer looks like one viewer */
    ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
  };

  /* ---------------------------------------------------------------- the viewer */
  let keyHandler = null;
  function close() {
    const ov = typeof document !== 'undefined' && document.getElementById('timg-ov');
    if (ov) ov.remove();
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    return true;
  }
  function show(opts) {
    if (typeof document === 'undefined') return false;
    const m = model(opts);
    close();
    const ov = document.createElement('div');
    ov.id = 'timg-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(3,6,9,.86);padding:18px;cursor:zoom-out;';
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;flex-direction:column;gap:10px;max-width:min(1180px,96vw);max-height:94vh;';
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = 'width:100%;height:auto;max-height:78vh;object-fit:contain;border-radius:10px;' +
      'box-shadow:0 34px 90px rgba(0,0,0,.7);background:#0b0e11;display:block;';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', m.path + ' — ' + m.caption);
    draw(canvas.getContext('2d'), m);
    const foot = document.createElement('div');
    foot.style.cssText = 'display:flex;justify-content:space-between;gap:18px;align-items:baseline;' +
      'font:14px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#9fb0bd;';
    const left = document.createElement('div');
    left.textContent = m.path + '  ·  ' + m.caption;
    const right = document.createElement('div');
    right.textContent = 'click or Esc to close';
    right.style.cssText = 'color:#5d6d79;white-space:nowrap;';
    foot.appendChild(left); foot.appendChild(right);
    card.appendChild(canvas); card.appendChild(foot);
    ov.appendChild(card);
    ov.addEventListener('click', close);
    document.body.appendChild(ov);
    keyHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', keyHandler);
    return m;
  }

  A.imageSpec = model;
  A.imageDraw = draw;
  A.imageView = show;
  A.imageViewerClose = close;
  if (typeof module !== 'undefined' && module.exports) module.exports = { model, draw, show };
})();
