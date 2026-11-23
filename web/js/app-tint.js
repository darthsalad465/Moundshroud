// A colour for every app's logo (2026-11-22). One tint per page, so an app is recognisable at a glance on the
// desktop, the taskbar, the sidebar and the Start menu. A.tint(id) is a CSS colour; A.tintHue(id) is the hue alone
// (used to build gradients). Pages keep their own headers and colours: this only colours the drawn logo.
(() => {
  if (!window.A) return;
  /* the apps people use most get a colour that suits them; anything else gets a stable one from its name */
  const HUE = {
    home: 265, chat: 203, files: 38, notes: 48, docs: 212, offed: 222, mail: 194, calc: 166, scan: 286, meet: 348, rem: 12, clip: 52,
    lib: 22, study: 152, lang: 130, writing: 320, practice: 300, teach: 176, sky: 232, lab: 190,
    kitchen: 24, garden: 112, money: 145, journal: 42, albums: 274,
    play: 336, music: 288, radio: 8, tv: 258, photos: 48,
    brain: 278, globe: 202, cyber: 172, studio: 310, tools: 208, health: 356, faith: 224, news: 6, map: 128, guide: 260, timeline: 32, cal: 216, web: 196,
    know: 218, learn: 152, life: 24, fun: 320
  };
  const hash = s => { let h = 0; const t = String(s == null ? '' : s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h); };
  const hue = id => HUE[id] != null ? HUE[id] : hash(id) % 360;
  A.tintHue = hue;
  A.tint = (id, l, s) => 'hsl(' + hue(id) + ' ' + (s == null ? 76 : s) + '% ' + (l == null ? 64 : l) + '%)';
  /* the tile behind the logo: a soft wash of the same colour, so the icons read as apps rather than grey buttons */
  A.tintBg = id => 'linear-gradient(160deg,hsl(' + hue(id) + ' 72% 62% / .34),hsl(' + hue(id) + ' 64% 42% / .3))';
})();
