// Cyber > Cyber Desktop > Cosmetics shop. The one place the practice bank's money goes: wallpapers and accent
// colours for this desktop, bought with money the exercises paid. Nothing here is real, nothing is downloadable,
// and the purchase lives in this browser's bank account. Spending never lowers "earned overall" in the bank.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* The wallpapers are the desktop's own theme variables (--night / --horizon / --glow / --beam) with a different
     palette; the swatch is the same palette painted small, so the shop shows what you are buying. */
  const WALLPAPERS = [
    {
      id: 'aurora', name: 'Aurora', price: 600,
      note: 'Green curtains over a cold horizon. Reads well at night without hiding the icons.',
      swatch: 'radial-gradient(ellipse at 20% 80%, #7ff0c8 0%, transparent 40%), radial-gradient(ellipse at 75% 20%, #2f7f6a, transparent 55%), linear-gradient(150deg, #04120f, #0b3b32 70%, #04120f)'
    },
    {
      id: 'reactor', name: 'Reactor', price: 1200,
      note: 'A cyan core with an industrial grid. The brightest of the set; the scan lines carry it.',
      swatch: 'radial-gradient(circle at 50% 55%, #a8f4ff 0%, #1c8fa8 22%, transparent 60%), linear-gradient(160deg, #041016, #0b3a48 72%, #041016)'
    },
    {
      id: 'longsunset', name: 'Long sunset', price: 2000,
      note: 'Amber into plum, no scan lines. Warm enough that the dock border looks new.',
      swatch: 'radial-gradient(ellipse at 18% 88%, #ffd08a 0%, transparent 42%), radial-gradient(ellipse at 78% 16%, #b8567f, transparent 58%), linear-gradient(152deg, #28101a, #6d2a3c 68%, #28101a)'
    },
    {
      id: 'blackline', name: 'Blackline', price: 3000,
      note: 'Almost black with a single gold horizon. The quietest one — made for a maximised terminal.',
      swatch: 'linear-gradient(180deg, #05070a 0%, #05070a 62%, #c79a4a 62.4%, #1a1206 63.2%, #05070a 100%)'
    }
  ];
  const ACCENTS = [
    { id: 'brass', name: 'Brass', value: '#e6c489', price: 300, note: 'Warm gold for the dock, the menu icons and focus rings.' },
    { id: 'seafoam', name: 'Seafoam', value: '#7ff0c8', price: 500, note: 'Mint green, close to the Aurora wallpaper.' },
    { id: 'signal', name: 'Signal red', value: '#ff8a8a', price: 800, note: 'Loud on purpose. Good with Blackline and nothing else.' }
  ];

  const keyOf = item => (item.value ? 'accent:' : 'wallpaper:') + item.id;
  const bank = () => A.cyberBank;
  const owns = item => !!(bank() && bank().owns && bank().owns(keyOf(item)));
  const api = () => (A.cyberDesktop && A.cyberDesktop.api) || {};

  function app(body) {
    function draw() {
      const b = bank();
      const balance = b ? b.balance : 0;
      const earned = b ? b.earnedTotal : 0;
      const current = api().current ? api().current() : { wallpaper: '', accent: '' };
      const card = (item, kind) => {
        const owned = owns(item);
        const equipped = kind === 'wallpaper' ? current.wallpaper === item.id : String(current.accent).toLowerCase() === String(item.value).toLowerCase();
        return '<article class="cd-shop-card' + (owned ? ' owned' : '') + '">' +
          '<span class="cd-shop-swatch" style="' + (kind === 'wallpaper' ? 'background:' + item.swatch : 'background:' + item.value) + '"></span>' +
          '<div><h3>' + esc(item.name) + (equipped ? ' <em>on the desktop</em>' : '') + '</h3>' +
          '<p class="mute">' + esc(item.note) + '</p></div>' +
          '<div class="cd-shop-buy">' + (owned
            ? '<button type="button" data-shop-apply="' + kind + '" data-shop-id="' + item.id + '"' + (equipped ? ' disabled' : '') + '>' + (equipped ? 'In use' : 'Use it') + '</button>'
            : '<button type="button" class="cd-primary" data-shop-buy="' + kind + '" data-shop-id="' + item.id + '"' + (balance < item.price ? ' disabled title="Not enough in the account yet"' : '') + '>Unlock · ' + money(item.price) + '</button>') +
            '<small>' + (owned ? 'Unlocked' : 'Locked') + '</small></div></article>';
      };
      body.innerHTML = '<div class="cd-content cd-shop">' +
        '<header class="cd-shop-head"><div><span class="cd-shop-kicker">Cosmetics · desktop appearance</span><h2>Spend it on the desk</h2>' +
        '<p class="mute">Bought with practice money from the Bank. Nothing here is a real product, an image file or a download: ' +
        'each unlock is a palette this desktop already knows how to wear.</p></div>' +
        '<div class="cd-shop-purse"><span>In the account</span><b>' + money(balance) + '</b>' +
        '<span>Earned overall</span><b class="cd-shop-earned">' + money(earned) + '</b></div></header>' +
        '<h3 class="cd-shop-section">Wallpapers</h3><div class="cd-shop-grid">' + WALLPAPERS.map(item => card(item, 'wallpaper')).join('') + '</div>' +
        '<h3 class="cd-shop-section">Accent colour</h3><div class="cd-shop-grid">' + ACCENTS.map(item => card(item, 'accent')).join('') + '</div>' +
        '<p class="cd-shop-fine">Unlocking moves money out of the balance and into “spent”. The Bank keeps “earned overall” as a ' +
        'lifetime total, so your stats still read the same after a purchase. Settings › Wallpaper lists everything you own.</p></div>';
    }

    body.onclick = event => {
      const buy = event.target.closest('[data-shop-buy]');
      const apply = event.target.closest('[data-shop-apply]');
      const b = bank();
      if (!b) return;
      if (buy) {
        const list = buy.dataset.shopBuy === 'accent' ? ACCENTS : WALLPAPERS;
        const item = list.find(entry => entry.id === buy.dataset.shopId);
        if (!item) return;
        if (!b.buy(keyOf(item), item.price, 'Cosmetic unlocked: ' + item.name)) {
          A.toast('Not enough in the practice account for ' + item.name + ' yet.');
          return;
        }
        /* buying something you want to look at should also put it on, the way a shop with a mirror would */
        if (item.value) api().accent && api().accent(item.value);
        else api().wallpaper && api().wallpaper(item.id);
        A.toast(item.name + ' unlocked and applied.');
        draw();
        return;
      }
      if (apply) {
        const list = apply.dataset.shopApply === 'accent' ? ACCENTS : WALLPAPERS;
        const item = list.find(entry => entry.id === apply.dataset.shopId);
        if (!item || !owns(item)) return;
        if (item.value) api().accent && api().accent(item.value);
        else api().wallpaper && api().wallpaper(item.id);
        A.toast(item.name + ' applied to the desktop.');
        draw();
      }
    };
    draw();
    return () => { body.onclick = null; };
  }

  A.cyberCosmetics = {
    app,
    wallpapers: WALLPAPERS,
    accents: ACCENTS,
    /* what the desktop shows in Settings, so an owned wallpaper appears next to the free four */
    ownedWallpapers: () => WALLPAPERS.filter(owns).map(item => [item.id, item.name]),
    ownedAccents: () => ACCENTS.filter(owns),
    item: id => WALLPAPERS.concat(ACCENTS).find(entry => entry.id === id) || null
  };
  A.cyberExtras = A.cyberExtras || {};
  A.cyberExtras.cosmetics = app;
})();
