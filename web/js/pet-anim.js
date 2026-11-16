// Animated characters: bespoke articulated SVG rigs for the 8 Moundshroud companions (with eye-tracking, blinking,
// walking legs, waving wings/arms, wagging tails and interaction props) plus animated emoji profiles for chess opponents.
// Moods: talk, think, happy, sad, sleep, walk, run, interact, dance, flip, drag.
(() => {
  const P = {
    '🦉': 'tilt', '🦊': 'wag', '🐙': 'wobble', '🤖': 'jitter', '🐉': 'breathe', '🦥': 'slowsway', '🐧': 'waddle', '🐱': 'stretch',
    '🐠': 'swim', '🏴‍☠️': 'ship', '👵': 'rock', '🦖': 'stomp', '🧪': 'bubble', '🎧': 'beat', '🎩': 'tip', '🌙': 'float', '⚡': 'zap', '🚀': 'blast', '🕵️': 'peek', '🎭': 'flip', '🥋': 'strike', '⏱️': 'tick', '⚙️': 'spin', '🗿': 'still', '🔮': 'glow', '🏔️': 'rumble', '🧠': 'pulse'
  };
  const AURA = { '🐠': '🫧', '🧪': '🫧', '🐙': '🫧', '🐉': '🔥', '🌙': '✨', '🔮': '✨', '🚀': '💨', '⚡': '✦', '🦉': '✨', '🦊': '🍃', '🤖': '⚡', '🐱': '♪', '🐧': '❄️', '🦥': '🌿' };
  const MOODS = ['talk', 'think', 'happy', 'sad', 'sleep', 'walk', 'run', 'interact', 'dance', 'flip', 'drag'];

  /* ---------- Bespoke articulated SVG companions (viewBox 0 0 80 80) ---------- */
  const DEFS = '<defs>' +
    '<linearGradient id="pgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cf"/><stop offset=".5" stop-color="#f2c75c"/><stop offset="1" stop-color="#b87e14"/></linearGradient>' +
    '<linearGradient id="pgOwl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c4ce6"/><stop offset=".55" stop-color="#3b228a"/><stop offset="1" stop-color="#1d0f4d"/></linearGradient>' +
    '<linearGradient id="pgFox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a47"/><stop offset=".6" stop-color="#e04819"/><stop offset="1" stop-color="#9e2408"/></linearGradient>' +
    '<linearGradient id="pgOct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c46bff"/><stop offset=".6" stop-color="#7a2be0"/><stop offset="1" stop-color="#411288"/></linearGradient>' +
    '<linearGradient id="pgBot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7da0ff"/><stop offset=".55" stop-color="#3556c4"/><stop offset="1" stop-color="#192a6b"/></linearGradient>' +
    '<linearGradient id="pgDrg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5468"/><stop offset=".55" stop-color="#bf1d36"/><stop offset="1" stop-color="#6e0b1c"/></linearGradient>' +
    '<linearGradient id="pgSlo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b58963"/><stop offset=".6" stop-color="#7d583a"/><stop offset="1" stop-color="#4f3520"/></linearGradient>' +
    '<linearGradient id="pgPen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c5284"/><stop offset=".6" stop-color="#1d2a4a"/><stop offset="1" stop-color="#0d1426"/></linearGradient>' +
    '<linearGradient id="pgCat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf2"/><stop offset=".7" stop-color="#eddcc9"/><stop offset="1" stop-color="#cdb59b"/></linearGradient>' +
    '<radialGradient id="pgShd" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(0,0,0,.48)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient>' +
    '</defs>';

  const propWand = '<g class="pa-prop"><circle cx="64" cy="34" r="7" fill="rgba(161,132,255,.25)" stroke="#ffeeb0" stroke-width="1.6"/><path d="M59 39 52 46" stroke="url(#pgGold)" stroke-width="2.4" stroke-linecap="round"/><circle cx="64" cy="34" r="2.2" fill="#fff"/></g>';

  const SVG = {
    /* 🦉 Hoot: Royal Astral Owl */
    '🦉': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="19" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-tail"><path d="M32 62 27 70h26l-5-8z" fill="#25145c"/></g>' +
      '<g class="pa-legs"><g class="pa-leg-l"><path d="M33 64v6M30 70h6" stroke="url(#pgGold)" stroke-width="2.8" stroke-linecap="round"/></g><g class="pa-leg-r"><path d="M47 64v6M44 70h6" stroke="url(#pgGold)" stroke-width="2.8" stroke-linecap="round"/></g></g>' +
      '<g class="pa-body"><ellipse cx="40" cy="48" rx="19" ry="18" fill="url(#pgOwl)" stroke="#1a0d42" stroke-width="1.2"/><ellipse cx="40" cy="51" rx="12.5" ry="13" fill="#f7e8c8"/><path d="M35 46q2.5 3 5 0M40 46q2.5 3 5 0M33 52q2.5 3 5 0M42 52q2.5 3 5 0M37 58q3 3 6 0" fill="none" stroke="#8c673a" stroke-width="1.4" stroke-linecap="round"/></g>' +
      '<g class="pa-arm-l"><path d="M22 39c-6 5-7 16-2 22 2-3 4-9 4-16z" fill="url(#pgOwl)" stroke="#1a0d42" stroke-width="1"/></g>' +
      '<g class="pa-arm-r"><path d="M58 39c6 5 7 16 2 22-2-3-4-9-4-16z" fill="url(#pgOwl)" stroke="#1a0d42" stroke-width="1"/></g>' +
      '<g class="pa-head"><ellipse cx="40" cy="29" rx="18" ry="15" fill="url(#pgOwl)" stroke="#1a0d42" stroke-width="1.2"/>' +
      '<g class="pa-ears"><path d="M23 21 17 11l11 5z" fill="url(#pgOwl)"/><path d="M57 21 63 11l-11 5z" fill="url(#pgOwl)"/><path d="M33 15l-1.5-6.5L36.5 12 40 7l3.5 5 5-3.5L47 15z" fill="url(#pgGold)" stroke="#5c3b06" stroke-width=".6"/></g>' +
      '<circle cx="32.5" cy="29" r="7.2" fill="#fff9e6" stroke="#25145c" stroke-width="1.3"/><circle cx="47.5" cy="29" r="7.2" fill="#fff9e6" stroke="#25145c" stroke-width="1.3"/>' +
      '<g class="pa-pupils"><circle cx="32.5" cy="29" r="4.3" fill="#24134a"/><circle cx="47.5" cy="29" r="4.3" fill="#24134a"/><circle cx="31" cy="27.2" r="1.6" fill="#fff"/><circle cx="46" cy="27.2" r="1.6" fill="#fff"/><circle cx="34" cy="30.8" r=".8" fill="#ffe484"/><circle cx="49" cy="30.8" r=".8" fill="#ffe484"/></g>' +
      '<g class="pa-lids"><ellipse cx="32.5" cy="29" rx="7.3" ry="7.3" fill="#3b228a"/><ellipse cx="47.5" cy="29" rx="7.3" ry="7.3" fill="#3b228a"/></g>' +
      '<g class="pa-mouth"><path d="M37.2 33.5 40 38.5l2.8-5z" fill="url(#pgGold)" stroke="#5c3b06" stroke-width=".7"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🦊 Fenn: Kitsune Ember Fox */
    '🦊': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="19" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-tail"><path d="M52 58c13-2 20-12 17-22-4 1-8 4-11 8-2 4-4 9-6 14z" fill="url(#pgFox)" stroke="#6b1804" stroke-width="1"/><path d="M69 36c1 5-1 9-5 11-1-4 1-8 5-11z" fill="#fff6e8"/></g>' +
      '<g class="pa-legs"><g class="pa-leg-l"><rect x="29" y="60" width="6" height="10" rx="3" fill="#3b170e"/></g><g class="pa-leg-r"><rect x="45" y="60" width="6" height="10" rx="3" fill="#3b170e"/></g></g>' +
      '<g class="pa-body"><ellipse cx="40" cy="50" rx="16" ry="15" fill="url(#pgFox)" stroke="#6b1804" stroke-width="1.1"/><path d="M31 44c0 9 4 17 9 17s9-8 9-17z" fill="#fff6e8"/><path d="M26 41q14 5 28 0l-2 5q-12 4-24 0z" fill="#5e35cc"/><circle cx="40" cy="45" r="2.2" fill="url(#pgGold)"/></g>' +
      '<g class="pa-arm-l"><rect x="21" y="43" width="6" height="13" rx="3" transform="rotate(14 24 43)" fill="url(#pgFox)"/></g>' +
      '<g class="pa-arm-r"><rect x="53" y="43" width="6" height="13" rx="3" transform="rotate(-14 56 43)" fill="url(#pgFox)"/></g>' +
      '<g class="pa-head"><g class="pa-ears"><path d="M22 25 16 8l15 9z" fill="url(#pgFox)" stroke="#6b1804" stroke-width="1"/><path d="M21 22 18 11l9 6z" fill="#3b170e"/><path d="M58 25 64 8l-15 9z" fill="url(#pgFox)" stroke="#6b1804" stroke-width="1"/><path d="M59 22 62 11l-9 6z" fill="#3b170e"/></g>' +
      '<path d="M21 29c0-9 8-15 19-15s19 6 19 15c0 7-8 12-19 12S21 36 21 29z" fill="url(#pgFox)" stroke="#6b1804" stroke-width="1.1"/>' +
      '<path d="M21 30c5 0 11 4 19 9 8-5 14-9 19-9-1 7-9 11-19 11S22 37 21 30z" fill="#fff6e8"/>' +
      '<g class="pa-pupils"><ellipse cx="32" cy="28" rx="3.3" ry="3.8" fill="#1f140e"/><ellipse cx="48" cy="28" rx="3.3" ry="3.8" fill="#1f140e"/><circle cx="31" cy="26.6" r="1.3" fill="#fff"/><circle cx="47" cy="26.6" r="1.3" fill="#fff"/></g>' +
      '<g class="pa-lids"><rect x="27" y="23" width="10" height="9" rx="4" fill="#e04819"/><rect x="43" y="23" width="10" height="9" rx="4" fill="#e04819"/></g>' +
      '<ellipse cx="40" cy="34.5" rx="2.6" ry="1.9" fill="#26110c"/><g class="pa-mouth"><path d="M37 37.2q3 2.4 6 0" fill="none" stroke="#26110c" stroke-width="1.4" stroke-linecap="round"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🐙 Inky: Cosmic Octo-Mage */
    '🐙': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="20" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-legs"><g class="pa-leg-l"><path d="M26 53c-6 6-5 15 1 16 4 0 5-5 4-11M35 55c-3 7-1 15 4 15s5-7 3-14" fill="none" stroke="url(#pgOct)" stroke-width="5.5" stroke-linecap="round"/></g>' +
      '<g class="pa-leg-r"><path d="M45 55c3 7 1 15-3 15s-5-7-3-14M54 53c6 6 5 15-1 16-4 0-5-5-4-11" fill="none" stroke="url(#pgOct)" stroke-width="5.5" stroke-linecap="round"/></g></g>' +
      '<g class="pa-arm-l"><path d="M23 49c-9 1-13 8-9 13 3 3 8 0 11-6" fill="none" stroke="url(#pgOct)" stroke-width="5" stroke-linecap="round"/></g>' +
      '<g class="pa-arm-r"><path d="M57 49c9 1 13 8 9 13-3 3-8 0-11-6" fill="none" stroke="url(#pgOct)" stroke-width="5" stroke-linecap="round"/></g>' +
      '<g class="pa-head"><ellipse cx="40" cy="36" rx="21" ry="19" fill="url(#pgOct)" stroke="#2b095c" stroke-width="1.2"/>' +
      '<circle cx="29" cy="26" r="2" fill="#7ef2ff" opacity=".6"/><circle cx="51" cy="29" r="1.6" fill="#ffeeb0" opacity=".7"/><circle cx="47" cy="22" r="1.2" fill="#7ef2ff" opacity=".6"/>' +
      '<g class="pa-ears"><path d="M24 21c9-4 23-4 32 0l-9-13-7 3-6-5z" fill="#1e1348" stroke="url(#pgGold)" stroke-width="1.2"/></g>' +
      '<circle cx="32.5" cy="37" r="5.2" fill="#fff"/><circle cx="47.5" cy="37" r="5.2" fill="#fff"/>' +
      '<g class="pa-pupils"><circle cx="32.5" cy="37" r="3.2" fill="#170836"/><circle cx="47.5" cy="37" r="3.2" fill="#170836"/><circle cx="31.3" cy="35.6" r="1.2" fill="#7ef2ff"/><circle cx="46.3" cy="35.6" r="1.2" fill="#7ef2ff"/></g>' +
      '<g class="pa-lids"><circle cx="32.5" cy="37" r="5.4" fill="#7a2be0"/><circle cx="47.5" cy="37" r="5.4" fill="#7a2be0"/></g>' +
      '<g class="pa-mouth"><ellipse cx="40" cy="43" rx="2.5" ry="1.8" fill="#2b095c"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🤖 Bolt: Aether-Mecha Unit */
    '🤖': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="18" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-legs"><g class="pa-leg-l"><rect x="29" y="58" width="7" height="9" rx="2.5" fill="url(#pgBot)" stroke="#142257" stroke-width="1"/><ellipse cx="32.5" cy="70" rx="3" ry="2.2" fill="#46e8ff"/></g>' +
      '<g class="pa-leg-r"><rect x="44" y="58" width="7" height="9" rx="2.5" fill="url(#pgBot)" stroke="#142257" stroke-width="1"/><ellipse cx="47.5" cy="70" rx="3" ry="2.2" fill="#46e8ff"/></g></g>' +
      '<g class="pa-body"><rect x="24" y="39" width="32" height="21" rx="7" fill="url(#pgBot)" stroke="#142257" stroke-width="1.2"/><rect x="30" y="44" width="20" height="11" rx="3.5" fill="#0f1838" stroke="url(#pgGold)" stroke-width=".9"/><path d="M33 50h4l2-3 3 6 2-3h3" fill="none" stroke="#46e8ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<g class="pa-arm-l"><rect x="16" y="41" width="6.5" height="15" rx="3.2" fill="url(#pgBot)" stroke="#142257" stroke-width="1"/></g>' +
      '<g class="pa-arm-r"><rect x="57.5" y="41" width="6.5" height="15" rx="3.2" fill="url(#pgBot)" stroke="#142257" stroke-width="1"/></g>' +
      '<g class="pa-head"><g class="pa-ears"><path d="M40 15V8" stroke="url(#pgGold)" stroke-width="2.2" stroke-linecap="round"/><circle cx="40" cy="7" r="3.2" fill="#46e8ff"/></g>' +
      '<rect x="21" y="15" width="38" height="23" rx="8" fill="url(#pgBot)" stroke="#142257" stroke-width="1.2"/>' +
      '<rect x="25" y="19" width="30" height="15" rx="5" fill="#0b1129" stroke="#46e8ff" stroke-width=".8"/>' +
      '<g class="pa-pupils"><rect x="29.5" y="23.5" width="6.5" height="5.5" rx="2" fill="#46e8ff"/><rect x="44" y="23.5" width="6.5" height="5.5" rx="2" fill="#46e8ff"/></g>' +
      '<g class="pa-lids"><rect x="28" y="22" width="24" height="8" fill="#0b1129"/></g>' +
      '<g class="pa-mouth"><rect x="35" y="31" width="10" height="1.8" rx=".9" fill="url(#pgGold)"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🐉 Ember: Sovereign Ruby Drake */
    '🐉': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="19" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-tail"><path d="M51 59c11 1 18-5 19-13" fill="none" stroke="url(#pgDrg)" stroke-width="5.5" stroke-linecap="round"/><path d="M70 46c-1-5 2-9 5-10 1 4 0 9-5 10z" fill="url(#pgGold)"/></g>' +
      '<g class="pa-arm-l"><path d="M25 40c-11-6-17-2-15 9 4-2 9-2 15-1z" fill="url(#pgDrg)" stroke="#570815" stroke-width="1"/></g>' +
      '<g class="pa-arm-r"><path d="M55 40c11-6 17-2 15 9-4-2-9-2-15-1z" fill="url(#pgDrg)" stroke="#570815" stroke-width="1"/></g>' +
      '<g class="pa-legs"><g class="pa-leg-l"><rect x="28" y="59" width="7.5" height="10" rx="3.5" fill="url(#pgDrg)"/></g><g class="pa-leg-r"><rect x="44.5" y="59" width="7.5" height="10" rx="3.5" fill="url(#pgDrg)"/></g></g>' +
      '<g class="pa-body"><ellipse cx="40" cy="49" rx="16.5" ry="16" fill="url(#pgDrg)" stroke="#570815" stroke-width="1.2"/><ellipse cx="40" cy="51" rx="10.5" ry="12" fill="url(#pgGold)"/><path d="M31 46h18M30 51h20M32 56h16" stroke="#8a5608" stroke-width="1.1"/></g>' +
      '<g class="pa-head"><g class="pa-ears"><path d="M27 19 20 7l12 8zM53 19 60 7l-12 8z" fill="url(#pgGold)" stroke="#5c3b06" stroke-width=".9"/></g>' +
      '<ellipse cx="40" cy="28" rx="16.5" ry="13.5" fill="url(#pgDrg)" stroke="#570815" stroke-width="1.2"/>' +
      '<g class="pa-pupils"><ellipse cx="33" cy="26.5" rx="3.4" ry="3.8" fill="#ffe885"/><ellipse cx="47" cy="26.5" rx="3.4" ry="3.8" fill="#ffe885"/><ellipse cx="33" cy="26.5" rx="1.3" ry="3" fill="#2b050c"/><ellipse cx="47" cy="26.5" rx="1.3" ry="3" fill="#2b050c"/></g>' +
      '<g class="pa-lids"><rect x="28" y="22" width="10" height="9" rx="4" fill="#bf1d36"/><rect x="42" y="22" width="10" height="9" rx="4" fill="#bf1d36"/></g>' +
      '<circle cx="36.5" cy="32" r="1.1" fill="#3d050e"/><circle cx="43.5" cy="32" r="1.1" fill="#3d050e"/>' +
      '<g class="pa-mouth"><path d="M35 35.5q5 3 10 0" fill="none" stroke="#fff6cf" stroke-width="1.5" stroke-linecap="round"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🦥 Sloane: Cozy Moss Sloth */
    '🦥': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="19" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-legs"><g class="pa-leg-l"><rect x="29" y="59" width="7" height="10" rx="3.5" fill="url(#pgSlo)"/></g><g class="pa-leg-r"><rect x="44" y="59" width="7" height="10" rx="3.5" fill="url(#pgSlo)"/></g></g>' +
      '<g class="pa-body"><ellipse cx="40" cy="49" rx="17" ry="15.5" fill="url(#pgSlo)" stroke="#382414" stroke-width="1.1"/><ellipse cx="40" cy="51" rx="11.5" ry="11.5" fill="#e8d4bc"/><path d="M25 40q15 5 30 0l-2 5.5q-13 4-26 0z" fill="url(#pgGold)"/></g>' +
      '<g class="pa-arm-l"><path d="M24 42c-7 4-8 14-3 18" fill="none" stroke="url(#pgSlo)" stroke-width="6" stroke-linecap="round"/></g>' +
      '<g class="pa-arm-r"><path d="M56 42c7 4 8 14 3 18" fill="none" stroke="url(#pgSlo)" stroke-width="6" stroke-linecap="round"/></g>' +
      '<g class="pa-head"><g class="pa-ears"><path d="M40 15c0-5 5-8 8-5-1 4-4 6-8 5z" fill="#5ee6a8"/></g>' +
      '<ellipse cx="40" cy="28" rx="17.5" ry="14" fill="url(#pgSlo)" stroke="#382414" stroke-width="1.1"/>' +
      '<ellipse cx="40" cy="29.5" rx="14" ry="10.5" fill="#f5e7d3"/>' +
      '<ellipse cx="32" cy="28.5" rx="5.2" ry="4.2" transform="rotate(-12 32 28.5)" fill="#593c24"/><ellipse cx="48" cy="28.5" rx="5.2" ry="4.2" transform="rotate(12 48 28.5)" fill="#593c24"/>' +
      '<g class="pa-pupils"><circle cx="32.5" cy="28.5" r="2.4" fill="#170f08"/><circle cx="47.5" cy="28.5" r="2.4" fill="#170f08"/><circle cx="31.8" cy="27.6" r=".9" fill="#fff"/><circle cx="46.8" cy="27.6" r=".9" fill="#fff"/></g>' +
      '<g class="pa-lids"><ellipse cx="32" cy="28.5" rx="5.2" ry="4.2" fill="#593c24"/><ellipse cx="48" cy="28.5" rx="5.2" ry="4.2" fill="#593c24"/></g>' +
      '<ellipse cx="40" cy="31.5" rx="2.6" ry="1.8" fill="#382414"/><g class="pa-mouth"><path d="M36.5 34.8q3.5 2.4 7 0" fill="none" stroke="#382414" stroke-width="1.4" stroke-linecap="round"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🐧 Pip: Frost-Crown Emperor Penguin */
    '🐧': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="19" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-legs"><g class="pa-leg-l"><ellipse cx="32" cy="68" rx="5.5" ry="2.8" fill="#ff9d2e"/></g><g class="pa-leg-r"><ellipse cx="48" cy="68" rx="5.5" ry="2.8" fill="#ff9d2e"/></g></g>' +
      '<g class="pa-body"><ellipse cx="40" cy="48" rx="18" ry="19" fill="url(#pgPen)" stroke="#090e1c" stroke-width="1.2"/><ellipse cx="40" cy="50" rx="12.5" ry="14.5" fill="#ffffff"/><path d="M25 38q15 5 30 0l-1.5 5q-13.5 4-27 0z" fill="#7c52e6"/></g>' +
      '<g class="pa-arm-l"><path d="M22 39c-5 5-6 15-2 20 2-3 4-9 4-15z" fill="url(#pgPen)"/></g>' +
      '<g class="pa-arm-r"><path d="M58 39c5 5 6 15 2 20-2-3-4-9-4-15z" fill="url(#pgPen)"/></g>' +
      '<g class="pa-head"><g class="pa-ears"><path d="M34 15l-1-6 4 3.5L40 8l3 4.5 4-3.5-1 6z" fill="url(#pgGold)"/></g>' +
      '<ellipse cx="40" cy="27" rx="16.5" ry="13.5" fill="url(#pgPen)" stroke="#090e1c" stroke-width="1.2"/>' +
      '<circle cx="33.5" cy="26.5" r="4.8" fill="#fff"/><circle cx="46.5" cy="26.5" r="4.8" fill="#fff"/>' +
      '<g class="pa-pupils"><circle cx="33.5" cy="26.5" r="2.8" fill="#0d1426"/><circle cx="46.5" cy="26.5" r="2.8" fill="#0d1426"/><circle cx="32.5" cy="25.3" r="1.1" fill="#fff"/><circle cx="45.5" cy="25.3" r="1.1" fill="#fff"/></g>' +
      '<g class="pa-lids"><circle cx="33.5" cy="26.5" r="5" fill="#1d2a4a"/><circle cx="46.5" cy="26.5" r="5" fill="#1d2a4a"/></g>' +
      '<g class="pa-mouth"><path d="M36.5 30.5 40 35l3.5-4.5z" fill="#ff9d2e" stroke="#8f4900" stroke-width=".7"/></g>' +
      '</g>' + propWand + '</g></svg>',

    /* 🐱 Miso: Lucky Starlight Neko */
    '🐱': '<svg class="pa-svg" viewBox="0 0 80 80" aria-hidden="true">' + DEFS +
      '<ellipse class="pa-shd" cx="40" cy="73" rx="19" ry="4.5" fill="url(#pgShd)"/>' +
      '<g class="pa-rig">' +
      '<g class="pa-tail"><path d="M53 59c11-1 16-10 13-18" fill="none" stroke="url(#pgCat)" stroke-width="5" stroke-linecap="round"/></g>' +
      '<g class="pa-legs"><g class="pa-leg-l"><rect x="29" y="59" width="6.5" height="10" rx="3.2" fill="url(#pgCat)" stroke="#7a6550" stroke-width=".9"/></g><g class="pa-leg-r"><rect x="44.5" y="59" width="6.5" height="10" rx="3.2" fill="url(#pgCat)" stroke="#7a6550" stroke-width=".9"/></g></g>' +
      '<g class="pa-body"><ellipse cx="40" cy="49" rx="15.5" ry="15" fill="url(#pgCat)" stroke="#7a6550" stroke-width="1"/><path d="M27 40q13 4 26 0" fill="none" stroke="#d9384a" stroke-width="3.5" stroke-linecap="round"/><circle cx="40" cy="43" r="3" fill="url(#pgGold)" stroke="#6b4806" stroke-width=".7"/></g>' +
      '<g class="pa-arm-l"><rect x="22" y="42" width="6" height="13" rx="3" transform="rotate(12 25 42)" fill="url(#pgCat)" stroke="#7a6550" stroke-width=".9"/></g>' +
      '<g class="pa-arm-r"><rect x="52" y="42" width="6" height="13" rx="3" transform="rotate(-12 55 42)" fill="url(#pgCat)" stroke="#7a6550" stroke-width=".9"/></g>' +
      '<g class="pa-head"><g class="pa-ears"><path d="M22 25 18 10l14 8z" fill="url(#pgCat)" stroke="#7a6550" stroke-width="1"/><path d="M22 23 20 13l9 5z" fill="#ff9eb5"/><path d="M58 25 62 10l-14 8z" fill="#e08945" stroke="#7a6550" stroke-width="1"/><path d="M58 23 60 13l-9 5z" fill="#ff9eb5"/></g>' +
      '<ellipse cx="40" cy="28.5" rx="17.5" ry="14" fill="url(#pgCat)" stroke="#7a6550" stroke-width="1"/>' +
      '<path d="M46 15.5c7 1 11 5 11 11-5-1-9-5-11-11z" fill="#e08945"/>' +
      '<g class="pa-pupils"><ellipse cx="32.5" cy="28" rx="3.4" ry="4" fill="#234899"/><ellipse cx="47.5" cy="28" rx="3.4" ry="4" fill="#234899"/><circle cx="31.4" cy="26.5" r="1.4" fill="#fff"/><circle cx="46.4" cy="26.5" r="1.4" fill="#fff"/></g>' +
      '<g class="pa-lids"><rect x="28" y="23" width="9" height="9" rx="4" fill="#eddcc9"/><rect x="43" y="23" width="9" height="9" rx="4" fill="#eddcc9"/></g>' +
      '<polygon points="38.2,32 41.8,32 40,34.2" fill="#ff85a1"/><g class="pa-mouth"><path d="M36.5 35.5q1.8 2 3.5 0q1.8 2 3.5 0" fill="none" stroke="#5c4738" stroke-width="1.3" stroke-linecap="round"/></g>' +
      '</g>' + propWand + '</g></svg>'
  };

  const K = {
    tilt: '0%,55%,100%{transform:rotate(0)}62%,78%{transform:rotate(-8deg)}85%,95%{transform:rotate(7deg)}',
    wag: '0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}',
    wobble: '0%,100%{transform:scale(1,1)}25%{transform:scale(1.04,.96) rotate(-2deg)}50%{transform:scale(.97,1.04)}75%{transform:scale(1.04,.96) rotate(2deg)}',
    jitter: '0%,86%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}',
    breathe: '0%,100%{transform:scale(1)}50%{transform:scale(1.05) translateY(-1.5px)}',
    slowsway: '0%,100%{transform:rotate(-4deg) translateY(0)}50%{transform:rotate(4deg) translateY(1.5px)}',
    waddle: '0%,100%{transform:rotate(-5deg) translateX(-1px)}50%{transform:rotate(5deg) translateX(1px)}',
    stretch: '0%,70%,100%{transform:scale(1,1)}78%{transform:scale(1.08,.93)}88%{transform:scale(.95,1.06)}',
    swim: '0%,100%{transform:translateX(-3px) rotate(-6deg)}50%{transform:translateX(3px) rotate(6deg) scaleX(1.05)}',
    ship: '0%,100%{transform:rotate(-8deg) translateY(1px)}50%{transform:rotate(8deg) translateY(-2px)}',
    rock: '0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}',
    stomp: '0%,60%,100%{transform:translateY(0) scale(1)}68%{transform:translateY(-4px) scale(.97,1.05)}76%{transform:translateY(1px) scale(1.08,.9)}86%{transform:translateY(0) scale(1)}',
    bubble: '0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-2px) rotate(-6deg)}60%{transform:translateY(0) rotate(6deg)}',
    beat: '0%,100%{transform:translateY(0) scale(1)}12%{transform:translateY(-3px) scale(1.06)}24%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.06)}62%{transform:translateY(0)}',
    tip: '0%,60%,100%{transform:rotate(0) translateY(0)}70%{transform:rotate(-12deg) translateY(-2px)}80%{transform:rotate(4deg)}90%{transform:rotate(0)}',
    float: '0%,100%{transform:translateY(2px) rotate(-3deg)}50%{transform:translateY(-4px) rotate(3deg)}',
    zap: '0%,80%,100%{transform:translate(0,0) scale(1);filter:none}84%{transform:translate(-1px,0) scale(1.12);filter:brightness(1.6)}88%{transform:translate(1px,0) scale(.96)}92%{transform:scale(1.1);filter:brightness(1.8)}',
    blast: '0%,100%{transform:translate(0,0) rotate(0)}20%{transform:translate(-1px,-2px) rotate(-1deg)}40%{transform:translate(1px,-3px) rotate(1deg)}60%{transform:translate(-1px,-2px)}80%{transform:translate(1px,-3px)}',
    peek: '0%,100%{transform:translateX(-4px)}50%{transform:translateX(4px) scaleX(-1)}',
    flip: '0%,40%,100%{transform:scaleX(1)}50%,90%{transform:scaleX(-1)}',
    strike: '0%,70%,100%{transform:translateX(0) rotate(0)}78%{transform:translateX(5px) rotate(12deg)}86%{transform:translateX(-2px) rotate(-5deg)}',
    tick: '0%,100%{transform:rotate(-12deg)}8%{transform:rotate(12deg)}50%{transform:rotate(12deg)}58%{transform:rotate(-12deg)}',
    spin: '0%{transform:rotate(0)}100%{transform:rotate(360deg)}',
    still: '0%,100%{transform:scale(1)}50%{transform:scale(1.025)}',
    glow: '0%,100%{transform:translateY(1px);filter:drop-shadow(0 0 2px #b46cff)}50%{transform:translateY(-3px);filter:drop-shadow(0 0 9px #d9a8ff)}',
    rumble: '0%,100%{transform:translate(0,0)}25%{transform:translate(-1px,1px)}50%{transform:translate(1px,0)}75%{transform:translate(0,-1px)}',
    pulse: '0%,100%{transform:scale(1);filter:drop-shadow(0 0 1px #ff7ab8)}50%{transform:scale(1.1);filter:drop-shadow(0 0 8px #ff7ab8)}'
  };
  const T = { tilt: 4.5, wag: 1.8, wobble: 2.6, jitter: 2.8, breathe: 3, slowsway: 5, waddle: 1.4, stretch: 5, swim: 2.4, ship: 3.4, rock: 3.2, stomp: 3, bubble: 2.2, beat: 1.2, tip: 5, float: 3.6, zap: 3, blast: .5, peek: 4, flip: 6, strike: 4, tick: 2, spin: 6, still: 5, glow: 3, rumble: .35, pulse: 1.6 };

  let css = '.pet{position:relative;display:inline-flex;align-items:center;justify-content:center;line-height:1}' +
    '.pet i,.pet .pa-svg{font-style:normal;display:inline-block;transform-origin:50% 80%;will-change:transform}' +
    '.pet-svg{width:100%;height:100%}.pet-svg .pa-svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 4px 10px rgba(0,0,0,.38))}' +
    '.pa-rig,.pa-head,.pa-tail,.pa-arm-l,.pa-arm-r,.pa-leg-l,.pa-leg-r,.pa-ears,.pa-mouth,.pa-lids,.pa-prop{transform-box:fill-box;transform-origin:center}' +
    '.pa-tail{transform-origin:20% 80%;animation:pa-tail-wag 2.2s ease-in-out infinite}' +
    '.pa-arm-l{transform-origin:80% 25%;animation:pa-arm-idle 3.2s ease-in-out infinite}' +
    '.pa-arm-r{transform-origin:20% 25%;animation:pa-arm-idle 3.2s ease-in-out infinite reverse}' +
    '.pa-pupils{transform:translate(var(--ex,0px),var(--ey,0px));transition:transform .12s ease-out}' +
    '.pa-lids{opacity:0;animation:pa-blink 5.4s infinite}' +
    '.pa-prop{opacity:0;transform:scale(.5);transition:opacity .2s,transform .25s cubic-bezier(.34,1.5,.5,1)}' +
    '@keyframes pa-tail-wag{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(10deg)}}' +
    '@keyframes pa-arm-idle{0%,100%{transform:rotate(0deg)}50%{transform:rotate(6deg)}}' +
    '@keyframes pa-blink{0%,93%,98%,100%{opacity:0}95%,96%{opacity:1}}' +
    '@keyframes pa-step-l{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(-18deg)}}' +
    '@keyframes pa-step-r{0%,100%{transform:translateY(-5px) rotate(18deg)}50%{transform:translateY(0) rotate(0)}}' +
    '@keyframes pa-walk-bob{0%,100%{transform:translateY(0) rotate(-2deg)}25%{transform:translateY(-4px) rotate(1deg)}50%{transform:translateY(0) rotate(2deg)}75%{transform:translateY(-4px) rotate(-1deg)}}' +
    '@keyframes pa-mouth-talk{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.65) translateY(1px)}}' +
    '@keyframes pa-prop-scan{0%,100%{transform:scale(1) rotate(-8deg) translate(0,0)}50%{transform:scale(1.12) rotate(10deg) translate(-3px,-3px)}}' +
    '@keyframes pa-dance-rig{0%,100%{transform:translateY(0) rotate(0) scale(1)}25%{transform:translateY(-10px) rotate(-12deg) scale(1.06,.95)}50%{transform:translateY(0) rotate(0) scale(.95,1.06)}75%{transform:translateY(-10px) rotate(12deg) scale(1.06,.95)}}' +
    '@keyframes pa-backflip{0%{transform:translateY(0) rotate(0)}35%{transform:translateY(-26px) rotate(-180deg) scale(1.08)}75%{transform:translateY(-8px) rotate(-360deg)}100%{transform:translateY(0) rotate(-360deg)}}';

  Object.keys(K).forEach(k => { css += '@keyframes pa-' + k + '{' + K[k] + '}.pet[data-a=' + k + '] > i,.pet[data-a=' + k + '] .pa-rig{animation:pa-' + k + ' ' + T[k] + 's ' + (k === 'spin' || k === 'rumble' || k === 'blast' ? 'linear' : 'ease-in-out') + ' infinite}'; });

  css +=
    /* mood states for both emoji (i) and articulated SVG (.pa-rig) */
    '.pet.walk .pa-rig,.pet.run .pa-rig{animation:pa-walk-bob .38s ease-in-out infinite!important}' +
    '.pet.walk .pa-leg-l,.pet.run .pa-leg-l{animation:pa-step-l .34s ease-in-out infinite!important}' +
    '.pet.walk .pa-leg-r,.pet.run .pa-leg-r{animation:pa-step-r .34s ease-in-out infinite!important}' +
    '.pet.walk .pa-arm-l,.pet.run .pa-arm-l{animation:pa-step-r .34s ease-in-out infinite!important}' +
    '.pet.walk .pa-arm-r,.pet.run .pa-arm-r{animation:pa-step-l .34s ease-in-out infinite!important}' +
    '.pet.talk > i,.pet.talk .pa-rig{animation:pa-talk .32s ease-in-out infinite!important}@keyframes pa-talk{0%,100%{transform:scale(1,1) translateY(0)}50%{transform:scale(1.04,.95) translateY(1px)}}' +
    '.pet.talk .pa-mouth{animation:pa-mouth-talk .22s ease-in-out infinite!important}' +
    '.pet.talk .pa-arm-r{animation:pa-step-l .45s ease-in-out infinite!important}' +
    '.pet.think > i,.pet.think .pa-rig{animation:pa-think 1.4s ease-in-out infinite!important}@keyframes pa-think{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg) translateY(-2px)}}' +
    '.pet.think .pa-prop,.pet.interact .pa-prop{opacity:1;animation:pa-prop-scan .9s ease-in-out infinite}' +
    '.pet.interact .pa-rig{animation:pa-talk .42s ease-in-out infinite!important}' +
    '.pet.happy > i,.pet.happy .pa-rig{animation:pa-happy .52s ease-in-out infinite!important}@keyframes pa-happy{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-10px) rotate(-7deg)}60%{transform:translateY(0) rotate(7deg)}}' +
    '.pet.happy .pa-arm-l{transform:rotate(-38deg)!important}.pet.happy .pa-arm-r{transform:rotate(38deg)!important}' +
    '.pet.dance > i,.pet.dance .pa-rig{animation:pa-dance-rig .68s ease-in-out infinite!important}' +
    '.pet.flip > i,.pet.flip .pa-rig{animation:pa-backflip .72s cubic-bezier(.22,.8,.28,1) both!important}' +
    '.pet.drag .pa-rig{transform:translateY(-6px) rotate(4deg)!important;animation:none!important}' +
    '.pet.drag .pa-leg-l,.pet.drag .pa-leg-r{animation:pa-step-l .25s ease-in-out infinite!important}' +
    '.pet.sad > i,.pet.sad .pa-rig{animation:pa-sad 2s ease-in-out infinite!important;filter:saturate(.6)}@keyframes pa-sad{0%,100%{transform:rotate(7deg) translateY(2px) scale(.96)}50%{transform:rotate(4deg) translateY(3px) scale(.95)}}' +
    '.pet.sleep > i,.pet.sleep .pa-rig{animation:pa-sleep 3.8s ease-in-out infinite!important;opacity:.88}@keyframes pa-sleep{0%,100%{transform:scale(1,.96) translateY(2px) rotate(-3deg)}50%{transform:scale(1.04,.94) translateY(3px) rotate(-3deg)}}' +
    '.pet.sleep .pa-lids{opacity:1!important;animation:none!important}' +
    '.pet::after{position:absolute;right:-4px;top:-6px;font-size:15px;line-height:1;pointer-events:none;opacity:0;z-index:3}' +
    '.pet.think::after{content:"💭";opacity:1;animation:pa-fl 1.6s ease-in-out infinite}.pet.happy::after,.pet.dance::after{content:"✨";opacity:1;animation:pa-fl .9s ease-in-out infinite}.pet.interact::after{content:"⚡";opacity:1;animation:pa-fl .7s ease-in-out infinite}.pet.sad::after{content:"💧";opacity:1;animation:pa-drip 1.6s ease-in infinite}.pet.sleep::after{content:"💤";opacity:1;animation:pa-fl 2.4s ease-in-out infinite}.pet.talk::after{content:"💬";opacity:1;animation:pa-fl .8s ease-in-out infinite}' +
    '@keyframes pa-fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes pa-drip{0%{transform:translateY(-2px);opacity:0}30%{opacity:1}100%{transform:translateY(9px);opacity:0}}' +
    '.pet::before{content:attr(data-x);position:absolute;left:-2px;bottom:0;font-size:13px;line-height:1;pointer-events:none;opacity:0;z-index:3;animation:pa-aura 3.2s ease-out infinite}@keyframes pa-aura{0%{transform:translateY(2px) scale(.6);opacity:0}25%{opacity:.9}100%{transform:translateY(-15px) scale(1.1);opacity:0}}' +
    'html.idle .pet i,html.idle .pet .pa-rig,html.idle .pet::before,html.idle .pet::after,body.lowpower .pet i,body.lowpower .pet .pa-rig,body.lowpower .pet::before{animation-play-state:paused!important}@media (prefers-reduced-motion:reduce){.pet i,.pet .pa-rig,.pet::before{animation:none!important}}';

  const st = document.createElement('style'); st.id = 'petanim'; st.textContent = css; document.head.appendChild(st);
  const prof = e => P[e] || 'float';
  /* the markup for one animated character: bespoke articulated SVG for the 8 companions, animated emoji for others */
  const html = (emoji, extra) => SVG[emoji]
    ? '<span class="pet pet-svg' + (extra ? ' ' + extra : '') + '" data-a="' + prof(emoji) + '"' + (AURA[emoji] ? ' data-x="' + AURA[emoji] + '"' : '') + '>' + SVG[emoji] + '</span>'
    : '<span class="pet' + (extra ? ' ' + extra : '') + '" data-a="' + prof(emoji) + '"' + (AURA[emoji] ? ' data-x="' + AURA[emoji] + '"' : '') + '><i>' + emoji + '</i></span>';

  const mood = (el, name, ms) => {
    const p = el && (el.classList && el.classList.contains('pet') ? el : el.querySelector && el.querySelector('.pet')); if (!p) return;
    MOODS.forEach(m => p.classList.remove(m)); clearTimeout(p._pt); if (!name) return; p.classList.add(name); if (ms) p._pt = setTimeout(() => p.classList.remove(name), ms);
  };
  const set = (el, emoji) => { if (el) el.innerHTML = html(emoji); };
  window.PetAnim = { html, mood, set, profile: prof, PROFILES: P, SVG };
})();
