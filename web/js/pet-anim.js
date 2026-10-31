// Animated characters: every companion pet and every chess opponent gets its own idle movement (a penguin waddles, a T-rex stomps, a gear spins, a rocket shakes...)
// plus mood states that other code switches on: talk, think, happy, sad, sleep. Usage: el.innerHTML = PetAnim.html('🐧'); PetAnim.mood(el, 'happy', 2000).
// Movement is paused when Moundshroud is idle or in low-power mode, and switched off for people who asked their system for reduced motion.
(() => {
  const P = {
    '🦉': 'tilt', '🦊': 'wag', '🐙': 'wobble', '🤖': 'jitter', '🐉': 'breathe', '🦥': 'slowsway', '🐧': 'waddle', '🐱': 'stretch',
    '🐠': 'swim', '🏴‍☠️': 'ship', '👵': 'rock', '🦖': 'stomp', '🧪': 'bubble', '🎧': 'beat', '🎩': 'tip', '🌙': 'float', '⚡': 'zap', '🚀': 'blast', '🕵️': 'peek', '🎭': 'flip', '🥋': 'strike', '⏱️': 'tick', '⚙️': 'spin', '🗿': 'still', '🔮': 'glow', '🏔️': 'rumble', '🧠': 'pulse'
  };
  const AURA = { '🐠': '🫧', '🧪': '🫧', '🐙': '🫧', '🐉': '🔥', '🌙': '✨', '🔮': '✨', '🚀': '💨', '⚡': '✦' };
  const K = {
    tilt: '0%,55%,100%{transform:rotate(0)}62%,78%{transform:rotate(-14deg)}85%,95%{transform:rotate(12deg)}',
    wag: '0%,100%{transform:rotate(-5deg) skewX(-4deg)}50%{transform:rotate(5deg) skewX(4deg)}',
    wobble: '0%,100%{transform:scale(1,1)}25%{transform:scale(1.07,.93) rotate(-3deg)}50%{transform:scale(.94,1.07)}75%{transform:scale(1.07,.93) rotate(3deg)}',
    jitter: '0%,86%,100%{transform:translate(0,0)}88%{transform:translate(-2px,1px)}91%{transform:translate(2px,-1px)}94%{transform:translate(-1px,-1px)}97%{transform:translate(1px,1px)}',
    breathe: '0%,100%{transform:scale(1)}50%{transform:scale(1.09) translateY(-1px)}',
    slowsway: '0%,100%{transform:rotate(-7deg) translateY(0)}50%{transform:rotate(7deg) translateY(2px)}',
    waddle: '0%,100%{transform:rotate(-9deg) translateX(-1px)}50%{transform:rotate(9deg) translateX(1px)}',
    stretch: '0%,70%,100%{transform:scale(1,1)}78%{transform:scale(1.18,.86)}88%{transform:scale(.92,1.1)}',
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
  const T = { tilt: 5, wag: .9, wobble: 2.6, jitter: 3.5, breathe: 3, slowsway: 6, waddle: .9, stretch: 6, swim: 2.4, ship: 3.4, rock: 3.2, stomp: 3, bubble: 2.2, beat: 1.2, tip: 5, float: 3.6, zap: 3, blast: .5, peek: 4, flip: 6, strike: 4, tick: 2, spin: 6, still: 5, glow: 3, rumble: .35, pulse: 1.6 };
  let css = '.pet{position:relative;display:inline-flex;align-items:center;justify-content:center;line-height:1}.pet i{font-style:normal;display:inline-block;transform-origin:50% 80%;will-change:transform}';
  Object.keys(K).forEach(k => { css += '@keyframes pa-' + k + '{' + K[k] + '}.pet[data-a=' + k + '] i{animation:pa-' + k + ' ' + T[k] + 's ' + (k === 'spin' || k === 'rumble' || k === 'blast' ? 'linear' : 'ease-in-out') + ' infinite}'; });
  css += '.pet.talk i{animation:pa-talk .32s ease-in-out infinite!important}@keyframes pa-talk{0%,100%{transform:scale(1,1) translateY(0)}50%{transform:scale(1.06,.93) translateY(1px)}}' +
    '.pet.think i{animation:pa-think 1.4s ease-in-out infinite!important}@keyframes pa-think{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg) translateY(-1px)}}' +
    '.pet.happy i{animation:pa-happy .55s ease-in-out infinite!important}@keyframes pa-happy{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-8px) rotate(-8deg)}60%{transform:translateY(0) rotate(7deg)}}' +
    '.pet.sad i{animation:pa-sad 2s ease-in-out infinite!important;filter:saturate(.6)}@keyframes pa-sad{0%,100%{transform:rotate(9deg) translateY(2px) scale(.96)}50%{transform:rotate(6deg) translateY(3px) scale(.95)}}' +
    '.pet.sleep i{animation:pa-sleep 4s ease-in-out infinite!important;opacity:.75;filter:grayscale(.4)}@keyframes pa-sleep{0%,100%{transform:scale(1) rotate(-4deg)}50%{transform:scale(1.05) rotate(-4deg)}}' +
    '.pet::after{position:absolute;right:-5px;top:-7px;font-size:.42em;line-height:1;pointer-events:none;opacity:0}' +
    '.pet.think::after{content:"💭";opacity:1;animation:pa-fl 1.6s ease-in-out infinite}.pet.happy::after{content:"✨";opacity:1;animation:pa-fl .9s ease-in-out infinite}.pet.sad::after{content:"💧";opacity:1;animation:pa-drip 1.6s ease-in infinite}.pet.sleep::after{content:"💤";opacity:1;animation:pa-fl 2.4s ease-in-out infinite}.pet.talk::after{content:"💬";opacity:1;animation:pa-fl .8s ease-in-out infinite}' +
    '@keyframes pa-fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes pa-drip{0%{transform:translateY(-2px);opacity:0}30%{opacity:1}100%{transform:translateY(9px);opacity:0}}' +
    '.pet::before{content:attr(data-x);position:absolute;left:-4px;bottom:-3px;font-size:.36em;line-height:1;pointer-events:none;opacity:0;animation:pa-aura 3.2s ease-out infinite}@keyframes pa-aura{0%{transform:translateY(2px) scale(.6);opacity:0}25%{opacity:.9}100%{transform:translateY(-13px) scale(1.1);opacity:0}}' +
    'html.idle .pet i,html.idle .pet::before,html.idle .pet::after,body.lowpower .pet i,body.lowpower .pet::before{animation-play-state:paused!important}@media (prefers-reduced-motion:reduce){.pet i,.pet::before{animation:none!important}}';
  const st = document.createElement('style'); st.id = 'petanim'; st.textContent = css; document.head.appendChild(st);
  const prof = e => P[e] || 'float';
  /* the markup for one animated character */
  const html = (emoji, extra) => '<span class="pet' + (extra ? ' ' + extra : '') + '" data-a="' + prof(emoji) + '"' + (AURA[emoji] ? ' data-x="' + AURA[emoji] + '"' : '') + '><i>' + emoji + '</i></span>';
  /* set a mood on the .pet inside (or equal to) el; it clears itself after ms (0 = stays until cleared) */
  const mood = (el, name, ms) => {
    const p = el && (el.classList && el.classList.contains('pet') ? el : el.querySelector && el.querySelector('.pet')); if (!p) return;
    ['talk', 'think', 'happy', 'sad', 'sleep'].forEach(m => p.classList.remove(m)); clearTimeout(p._pt); if (!name) return; p.classList.add(name); if (ms) p._pt = setTimeout(() => p.classList.remove(name), ms);
  };
  /* swap the emoji inside a container for the animated version */
  const set = (el, emoji) => { if (el) el.innerHTML = html(emoji); };
  window.PetAnim = { html, mood, set, profile: prof, PROFILES: P };
})();
