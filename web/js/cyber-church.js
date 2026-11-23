// The sanctuary rule: the fake internet's church websites cannot be hacked.
// Every moundshell tool (curl, nmap, whatweb, nikto, gobuster, sqlmap, hydra, ssh, breach, paths, leaked, virus scan …)
// refuses to touch a church site, and an attempt is punished with thirty seconds of fake Windows error dialogs full
// of King James Bible verses, under a ringing alarm, after which the app restarts itself. Nothing here contacts
// anything: the dialogs are DIVs, the verses are bundled below and the alarm is made with the browser's own audio, so
// it all works offline. The scolding ends by putting the app back to the screen it opens on, without reloading.
(function () {
  'use strict';
  /* the app keeps its API on the global `const A` from core.js, not on window.A */
  const G = (() => {
    try { if (typeof A !== 'undefined' && A) return A; } catch (e) { /* not defined yet */ }
    return (window.A = window.A || {});
  })();

  /* a generated site is a church if the universe says so, or if its host, brand or topic sounds like one. The shell
     only ever hands this the site objects the fake internet made, so a wide net here protects only invented pages. */
  /* word boundaries matter here: “rectory” lives inside “directory”, and a darknet index is not a church */
  const CHURCH = /church|parish|chapel|cathedral|\bminster\b|abbey|diocese|deanery|vicar|\brectory\b|clergy|chaplain|monastery|convent|seminary|evangel|gospel|worship|congregation|hymn|psalm|\bbibl(?:e|es|ical)\b|saint|christian|catholic|anglican|baptist|methodist|lutheran|presbyterian|orthodox|quaker|\bfaith\b|\bst[.\- ]/i;

  function isChurch(site) {
    if (!site) return false;
    const cat = site.cat || {};
    if (String(cat.id || site.catId || '').toLowerCase() === 'church') return true;
    const hay = [site.host, site.brand, site.topic, site.kind, cat.label, site.tagline].filter(Boolean).join(' ');
    return CHURCH.test(hay);
  }

  /* a random `web` or `virus` target must never land on a sanctuary, or a roll of the dice would punish the shell */
  function elsewhere(site, trappedOnly) {
    const CW = G.cyberWeb;
    if (!CW || !CW.all) return null;
    let pool = [];
    try { pool = (CW.all() || []).filter(s => s && s.host !== (site && site.host) && !isChurch(s)); } catch (e) { pool = []; }
    if (trappedOnly) pool = pool.filter(s => s.trapped);
    if (!pool.length) return null;
    return pool[(Math.random() * pool.length) | 0];
  }

  /* King James Version, public domain. Bundled so a refusal needs no download and arrives instantly. */
  const VERSES = [
    ['Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
    ['Psalm 23:4', 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.'],
    ['Psalm 27:1', 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?'],
    ['Psalm 34:14', 'Depart from evil, and do good; seek peace, and pursue it.'],
    ['Psalm 37:8', 'Cease from anger, and forsake wrath: fret not thyself in any wise to do evil.'],
    ['Psalm 46:1', 'God is our refuge and strength, a very present help in trouble.'],
    ['Psalm 46:10', 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.'],
    ['Psalm 51:10', 'Create in me a clean heart, O God; and renew a right spirit within me.'],
    ['Psalm 91:1', 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.'],
    ['Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.'],
    ['Psalm 121:1-2', 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.'],
    ['Psalm 133:1', 'Behold, how good and how pleasant it is for brethren to dwell together in unity!'],
    ['Psalm 19:14', 'Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight, O LORD, my strength, and my redeemer.'],
    ['Proverbs 3:5', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'],
    ['Proverbs 3:6', 'In all thy ways acknowledge him, and he shall direct thy paths.'],
    ['Proverbs 11:1', 'A false balance is abomination to the LORD: but a just weight is his delight.'],
    ['Proverbs 16:3', 'Commit thy works unto the LORD, and thy thoughts shall be established.'],
    ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
    ['Isaiah 41:10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'],
    ['Micah 6:8', 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?'],
    ['Exodus 20:15', 'Thou shalt not steal.'],
    ['Exodus 20:16', 'Thou shalt not bear false witness against thy neighbour.'],
    ['Numbers 6:24-26', 'The LORD bless thee, and keep thee: The LORD make his face shine upon thee, and be gracious unto thee: The LORD lift up his countenance upon thee, and give thee peace.'],
    ['2 Chronicles 7:14', 'If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.'],
    ['Matthew 5:5', 'Blessed are the meek: for they shall inherit the earth.'],
    ['Matthew 5:9', 'Blessed are the peacemakers: for they shall be called the children of God.'],
    ['Matthew 5:44', 'But I say unto you, Love your enemies, bless them that curse you, do good to them that hate you, and pray for them which despitefully use you, and persecute you.'],
    ['Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
    ['Matthew 7:7', 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.'],
    ['Matthew 11:28', 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'],
    ['Matthew 22:21', 'Render therefore unto Caesar the things which are Caesar\u2019s; and unto God the things that are God\u2019s.'],
    ['Luke 6:31', 'And as ye would that men should do to you, do ye also to them likewise.'],
    ['Luke 12:2', 'For there is nothing covered, that shall not be revealed; neither hid, that shall not be known.'],
    ['John 3:16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
    ['John 8:32', 'And ye shall know the truth, and the truth shall make you free.'],
    ['John 14:6', 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.'],
    ['John 14:27', 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.'],
    ['Romans 8:31', 'What shall we then say to these things? If God be for us, who can be against us?'],
    ['Romans 12:19', 'Dearly beloved, avenge not yourselves, but rather give place unto wrath: for it is written, Vengeance is mine; I will repay, saith the Lord.'],
    ['Romans 12:21', 'Be not overcome of evil, but overcome evil with good.'],
    ['1 Corinthians 13:4', 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.'],
    ['Galatians 5:22', 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith.'],
    ['Ephesians 4:32', 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ\u2019s sake hath forgiven you.'],
    ['Ephesians 6:11', 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.'],
    ['Philippians 4:6', 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.'],
    ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
    ['Hebrews 13:8', 'Jesus Christ the same yesterday, and to day, and for ever.'],
    ['James 4:7', 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.'],
    ['1 Peter 5:8', 'Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour.']
  ];

  const SECONDS = 30;
  const TICK_MS = 300;
  /* what a virus would have said, before it hands the floor to the verse */
  const WARNINGS = [
    'System Alert: a hostile attempt was blocked.',
    'moundshroud.exe has detected an intrusion attempt.',
    'Warning: this machine was used against a sanctuary.',
    'Critical error: the target site is protected.',
    'Windows has stopped a breach of a church website.'
  ];
  const PATHS = [
    'C:\\WINDOWS\\system32\\sanctuary.dll',
    'C:\\Program Files\\Moundshroud\\bells.exe',
    'C:\\WINDOWS\\system32\\drivers\\chapel.sys',
    'C:\\Users\\you\\AppData\\Local\\Temp\\verse.tmp'
  ];
  let storm = null;
  let alarm = null;

  /* The alarm is a two-tone siren built from oscillators: no sound file, nothing to download, and it stops the moment
     the verses do. The browser may refuse to start audio without a click or a keypress first, and a shell command is
     one of those, so the sirens usually come up; if it refuses anyway the verses still arrive, only silent. */
  function startAlarm() {
    if (alarm) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.25);
      master.connect(ctx.destination);
      const siren = ctx.createOscillator();
      siren.type = 'square';
      const sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.5;
      siren.connect(sirenGain);
      sirenGain.connect(master);
      /* a warble: 0.36s high, 0.36s low, over and over, scheduled well past the longest punishment */
      const t0 = ctx.currentTime + 0.02;
      for (let i = 0; i < 90; i++) {
        const t = t0 + i * 0.72;
        siren.frequency.setValueAtTime(760, t);
        siren.frequency.setValueAtTime(520, t + 0.36);
        sirenGain.gain.setValueAtTime(0.5, t);
        sirenGain.gain.setValueAtTime(0.05, t + 0.31);
      }
      siren.start(t0);
      siren.stop(t0 + 90 * 0.72);
      if (ctx.state === 'suspended') ctx.resume().catch(() => { });
      alarm = { ctx, master, siren };
    } catch (e) { alarm = null; }
  }

  function stopAlarm() {
    const a = alarm;
    alarm = null;
    if (!a) return;
    try {
      a.master.gain.cancelScheduledValues(a.ctx.currentTime);
      a.master.gain.setValueAtTime(Math.max(0.0001, a.master.gain.value), a.ctx.currentTime);
      a.master.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + 0.12);
    } catch (e) { }
    setTimeout(() => { try { a.siren.stop(); } catch (e) { } try { a.ctx.close(); } catch (e) { } }, 400);
  }

  function verse() { return VERSES[(Math.random() * VERSES.length) | 0]; }
  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function ensureCss() {
    if (!document || !document.head || document.getElementById('cd-church-css')) return;
    const style = document.createElement('style');
    style.id = 'cd-church-css';
    style.textContent = [
      '#cd-church-storm{position:fixed;inset:0;z-index:2147483400;pointer-events:none;user-select:none;overflow:hidden;',
      'font:13px/1.45 "Segoe UI",system-ui,-apple-system,sans-serif}',
      '#cd-church-storm .cc-bar{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;',
      'padding:8px 16px;border-radius:999px;background:rgba(24,16,10,.94);border:1px solid #c8a45c;color:#f7e7bd;',
      'box-shadow:0 12px 34px rgba(0,0,0,.55);white-space:nowrap;font-weight:600;letter-spacing:.2px}',
      '#cd-church-storm .cc-bar b{color:#ffd98a}',
      /* an ordinary Windows dialog, 95 vintage: grey panel, bevelled edges, navy title bar */
      '#cd-church-storm .cc-win{position:absolute;background:#c0c0c0;color:#000;padding:1px;border:1px solid #000;',
      'box-shadow:inset 1px 1px 0 #fff,inset -1px -1px 0 #808080,0 14px 30px rgba(0,0,0,.45);animation:cc-pop .12s ease-out}',
      '#cd-church-storm .cc-win .cc-title{display:flex;align-items:center;gap:5px;padding:2px 4px 2px 4px;',
      'background:linear-gradient(90deg,#000080,#1084d0 72%,#3a95d8);color:#fff;font:700 11px "Segoe UI",Tahoma,sans-serif;letter-spacing:.1px}',
      '#cd-church-storm .cc-win .cc-tt{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
      '#cd-church-storm .cc-win .cc-x{flex:none;width:16px;height:14px;display:flex;align-items:center;justify-content:center;',
      'background:#c0c0c0;color:#000;font:700 9px "Segoe UI",Tahoma,sans-serif;border:1px solid #000;',
      'box-shadow:inset 1px 1px 0 #fff,inset -1px -1px 0 #808080}',
      '#cd-church-storm .cc-win .cc-body{display:flex;gap:9px;padding:11px 10px 7px}',
      '#cd-church-storm .cc-win .cc-ico{flex:none;font-size:25px;line-height:1}',
      '#cd-church-storm .cc-win .cc-txt{flex:1;min-width:0}',
      '#cd-church-storm .cc-win .cc-warn{font:700 11.5px "Segoe UI",Tahoma,sans-serif;margin-bottom:5px}',
      '#cd-church-storm .cc-win .cc-v{font-family:Georgia,"Times New Roman",serif;font-size:12px;line-height:1.45}',
      '#cd-church-storm .cc-win .cc-path{margin-top:6px;font:10px "Consolas",monospace;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#cd-church-storm .cc-win .cc-btns{display:flex;justify-content:center;padding:2px 10px 10px}',
      '#cd-church-storm .cc-win .cc-ok{min-width:74px;padding:3px 12px;font:11px "Segoe UI",Tahoma,sans-serif;background:#c0c0c0;color:#000;',
      'border:1px solid #000;box-shadow:inset 1px 1px 0 #fff,inset -1px -1px 0 #808080;outline:1px dotted #000;outline-offset:-4px}',
      '@keyframes cc-pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}',
      '#cd-church-restart{position:fixed;inset:0;z-index:2147483500;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;gap:12px;padding:28px;text-align:center;background:radial-gradient(circle at 50% 40%,#241a10 0%,#0d0906 70%);',
      'color:#f7e7bd;font:14px/1.5 "Segoe UI",system-ui,-apple-system,sans-serif;animation:cc-pop .3s ease-out}',
      '#cd-church-restart .cc-rk{font-size:58px;line-height:1}',
      '#cd-church-restart .cc-rt{font-size:19px;font-weight:700;letter-spacing:.2px}',
      '#cd-church-restart .cc-rs{max-width:560px;color:#c9b58c;font-size:13px}',
      '#cd-church-restart .cc-love{color:#ffd98a;font-size:16px;font-family:Georgia,"Times New Roman",serif;font-style:italic}',
      '#cd-church-restart .cc-rw{margin-top:6px;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#8f7a54}',
      '#cd-church-restart .cc-rw b{color:#ffd98a}'
    ].join('');
    document.head.appendChild(style);
  }

  let restarting = false;

  /* When the scolding is over the app is put back exactly where it starts: the shell session is ended, its window is
     taken away, any dialog is closed and the app opens on Today again. Nothing is reloaded — no page, no files — so
     this lands at once even where a reload would be caught by an unsaved-changes prompt. */
  function softReset() {
    try {
      if (A.moundshell && A.moundshell.reset) A.moundshell.reset();
      else if (document.getElementById('aeshellwrap')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true, cancelable: true }));
      }
    } catch (e) { }
    try { A.closeDlg && A.closeDlg(); } catch (e) { }
    try { A.closePop && A.closePop(); } catch (e) { }
    try { A.showTab && A.showTab('home'); } catch (e) { }
    try { window.scrollTo(0, 0); } catch (e) { }
  }

  /* the scolding stays on screen for a full twenty-three seconds: long enough to be read, long enough to be felt */
  function restartApp() {
    if (restarting) return;
    restarting = true;
    let tick = null;
    try {
      ensureCss();
      const card = document.createElement('div');
      card.id = 'cd-church-restart';
      card.className = 'cc-restart';
      card.innerHTML = '<div class="cc-rk">\u26ea</div>' +
        '<div class="cc-rt">The bells have stopped. Moundshroud is starting over.</div>' +
        '<div class="cc-rs">You tried to break into a church website. That was not clever, it was not harmless, and it is ' +
        'not allowed here \u2014 a sanctuary is not a target. Nothing you had open survives this, and that is on you.</div>' +
        '<div class="cc-rs cc-love">Jesus loves you anyway.</div>' +
        '<div class="cc-rw">starting over in <b>23</b></div>';
      document.body.appendChild(card);
      const out = card.querySelector('.cc-rw b');
      let left = 23;
      tick = setInterval(() => {
        left -= 1;
        if (out) out.textContent = String(Math.max(0, left));
        if (left <= 0) { try { clearInterval(tick); } catch (e) { } }
      }, 1000);
    } catch (e) { /* no DOM: nothing to show, the reset below is still the point */ }
    setTimeout(() => {
      softReset();
      try { const card = document.getElementById('cd-church-restart'); if (card) card.remove(); } catch (e) { }
      restarting = false;
    }, 23000);
  }

  function stop(reason) {
    if (!storm) return;
    try { clearInterval(storm.timer); } catch (e) { }
    try { clearTimeout(storm.done); } catch (e) { }
    try { storm.layer.remove(); } catch (e) { }
    storm = null;
    stopAlarm();
    if (reason === 'done') restartApp();
  }

  function pop(layer) {
    const v = verse();
    const win = document.createElement('div');
    win.className = 'cc-win';
    const w = 252 + ((Math.random() * 132) | 0);
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - 214);
    win.style.width = w + 'px';
    win.style.left = Math.round(8 + Math.random() * Math.max(1, maxX - 8)) + 'px';
    win.style.top = Math.round(46 + Math.random() * Math.max(1, maxY - 46)) + 'px';
    /* the title bar names the verse itself, so the reference sits where the eye goes first */
    win.innerHTML = '<div class="cc-title"><span>\u26a0</span><span class="cc-tt">' + esc(v[0]) + '</span>' +
      '<span class="cc-x">\u2715</span></div>' +
      '<div class="cc-body"><div class="cc-ico">\u26a0\ufe0f</div><div class="cc-txt">' +
      '<div class="cc-warn">' + esc(WARNINGS[(Math.random() * WARNINGS.length) | 0]) + '</div>' +
      '<div class="cc-v">\u201c' + esc(v[1]) + '\u201d</div>' +
      '<div class="cc-path">' + esc(PATHS[(Math.random() * PATHS.length) | 0]) + '</div></div></div>' +
      '<div class="cc-btns"><span class="cc-ok">OK</span></div>';
    layer.appendChild(win);
    while (layer.querySelectorAll('.cc-win').length > 26) {
      const first = layer.querySelector('.cc-win');
      if (!first) break;
      first.remove();
    }
  }

  function startStorm(host) {
    if (typeof document === 'undefined' || !document.body) return;
    if (storm) {
      /* another attempt during the punishment keeps the bells ringing, and pushes the restart back with them */
      storm.until = Date.now() + SECONDS * 1000;
      storm.host = host || storm.host;
      try { clearTimeout(storm.done); } catch (e) { }
      storm.done = setTimeout(() => stop('done'), SECONDS * 1000);
      if (alarm && alarm.ctx.state === 'suspended') { try { alarm.ctx.resume().catch(() => { }); } catch (e) { } }
      paintBar();
      return;
    }
    ensureCss();
    const layer = document.createElement('div');
    layer.id = 'cd-church-storm';
    const bar = document.createElement('div');
    bar.className = 'cc-bar';
    layer.appendChild(bar);
    document.body.appendChild(layer);
    storm = { layer, bar, host: host || 'this website', until: Date.now() + SECONDS * 1000, timer: null, done: null };
    startAlarm();
    paintBar();
    pop(layer);
    storm.timer = setInterval(() => {
      if (!storm) return;
      pop(storm.layer);
      paintBar();
    }, TICK_MS);
    storm.done = setTimeout(() => stop('done'), SECONDS * 1000);
  }

  function paintBar() {
    if (!storm || !storm.bar) return;
    const left = Math.max(0, Math.ceil((storm.until - Date.now()) / 1000));
    storm.bar.innerHTML = '\u26ea <b>' + esc(storm.host) + '</b> is a sanctuary \u00b7 the bells ring for <b>' +
      left + 's</b> \u00b7 no tool touches a church website';
  }

  /* the refusal the shell prints, and the popups that come with it */
  function punish(tool, site) {
    const host = (site && site.host) || 'this website';
    const v = verse();
    startStorm(host);
    return [
      '\u26ea THE SANCTUARY HOLDS \u2014 access denied',
      '  ' + String(tool || 'that command') + ' will not be run against ' + host + '.',
      '  Church websites are not targets in this shell: no scan, no dump, no shell, no exploit, no tools at all.',
      '  The bells are ringing for ' + SECONDS + ' seconds, and then Moundshroud restarts itself.',
      '',
      '  \u201c' + v[1] + '\u201d',
      '  \u2014 ' + v[0]
    ].join('\n');
  }

  G.cyberChurch = {
    isChurch,
    elsewhere,
    punish,
    stop,
    active: () => !!storm,
    alarm: () => (alarm ? alarm.ctx.state : 'off'),
    verses: VERSES.length
  };
})();
