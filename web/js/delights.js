// Seven minimal-cost delightful features: roulette, hints, confetti, spinner, compliments, streak, daily card
(() => {
  const ls = window.localStorage || {};

  // COMPLIMENTS: show on app load
  const COMPLIMENTS = [
    "You're on fire today! 🔥",
    "Every move you make is legendary",
    "Your vibe is immaculate",
    "You're crushing it this week!",
    "Pure talent on display",
    "Nothing can stop you right now",
    "You've got this energy, keep it up",
    "Your dedication is inspiring",
    "You're leveling up faster than ever",
    "Unstoppable force detected 💪"
  ];

  function showCompliment() {
    const shown = new Set(JSON.parse(ls.getItem('delights_compliments_shown') || '[]'));
    if (shown.size >= COMPLIMENTS.length) shown.clear();
    let c = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    while (shown.has(c)) c = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
    shown.add(c);
    ls.setItem('delights_compliments_shown', JSON.stringify([...shown]));
    if (window.A && window.A.toast) A.toast(c);
  }

  // KEYBOARD HINTS: show periodically
  const HINTS = [
    "Ctrl+K: search everything, or run any command",
    "? : see every keyboard shortcut",
    "Alt+1 to Alt+9: jump straight to an area",
    "Type > in Ctrl+K for commands only",
    "Ctrl+N: new chat",
    "Q: go to Chess",
    "J: scroll down a section",
    "Shift+K: scroll up a section",
    "Try voice input: click the mic",
    "Shift+Enter: add a line in chat",
    "Settings > Run a self-test to check your app",
  ];

  function showHint() {
    const hint = HINTS[Math.floor(Math.random() * HINTS.length)];
    if (window.A && window.A.toast) A.toast('💡 ' + hint);
  }

  // INSPIRATION ROULETTE: random card from collections
  function getInspiration() {
    const sources = [];
    if (window.RECIPES) sources.push(...RECIPES.map(r => ({ type: 'recipe', name: r.n, data: r })));
    if (window.CHESS_TIPS) sources.push(...CHESS_TIPS.map(t => ({ type: 'tip', name: t, data: t })));
    if (window.A && window.A.verses && typeof A.verses === 'function') {
      const verses = A.verses();
      if (verses) sources.push(...verses.slice(0, 50).map(v => ({ type: 'verse', name: v.v, data: v })));
    }
    return sources.length ? sources[Math.floor(Math.random() * sources.length)] : null;
  }

  // DAILY CARD ROTATION: pick one card per day
  function getDailyCard() {
    const today = new Date().toDateString();
    const cache = JSON.parse(ls.getItem('delights_daily_card') || '{}');
    if (cache.date === today && cache.card) return cache.card;
    const card = getInspiration();
    if (card) ls.setItem('delights_daily_card', JSON.stringify({ date: today, card }));
    return card;
  }

  // STREAK TRACKER: count consecutive games in chess
  function updateStreak() {
    if (!window.ChessAna) return;
    const games = ChessAna.GS ? ChessAna.GS.list() : [];
    if (!games || games.length === 0) return;
    const sorted = games.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    let streak = 0, lastDate = null;
    for (const g of sorted) {
      const gDate = new Date(g.at || Date.now()).toDateString();
      if (!lastDate) lastDate = gDate;
      if (gDate === lastDate || new Date(gDate).getTime() === new Date(lastDate).getTime() - 86400000) {
        streak++;
        lastDate = gDate;
      } else break;
    }
    window.STREAK_COUNT = streak;
    return streak;
  }

  // CONFETTI: trigger on milestone
  function fireConfetti() {
    if (!document.body) return;
    for (let i = 0; i < 30; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-burst';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.delay = Math.random() * 0.2 + 's';
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 2500);
    }
  }

  // THINKING SPINNER: show during AI generation
  function showThinkingSpinner() {
    if (window.A && window.A._thinkingSpinner) clearTimeout(window.A._thinkingSpinner);
    let spinner = document.getElementById('thinking-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'thinking-spinner';
      spinner.className = 'thinking-spinner';
      spinner.innerHTML = '<div class="spinner-dot"></div><div class="spinner-dot"></div><div class="spinner-dot"></div>';
      document.body.appendChild(spinner);
    }
    spinner.style.display = 'block';
    if (window.A) A._thinkingSpinner = setTimeout(() => { spinner.style.display = 'none'; }, 60000);
  }

  function hideThinkingSpinner() {
    const spinner = document.getElementById('thinking-spinner');
    if (spinner) spinner.style.display = 'none';
  }

  // STREAK DISPLAY
  function showStreakInfo() {
    const streak = updateStreak();
    const msg = streak ? `🔥 ${streak} game${streak === 1 ? '' : 's'} in a row!` : 'Play to build your streak!';
    if (window.A && A.toast) A.toast(msg);
  }

  // INSPIRATION STUDIO TOOL
  function registerInspirationTool() {
    if (typeof A === 'undefined' || !A.studio) return;
    A.studio.reg('inspiration', '✨ Daily inspiration', body => {
      const card = getDailyCard();
      body.className = 'scroll pad';
      if (!card) {
        body.innerHTML = '<div class="card"><b>Come back after playing some games or composing some songs!</b><div class="small mute">The daily card shows a random item from your collections. You need some saved games or creations first.</div></div>';
        return;
      }
      body.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">Today\'s inspiration</h2><button class="ib" onclick="location.reload()">🔄 New card</button></div>' +
        '<div class="card">' +
        (card.type === 'recipe' ? '<b>🍳 ' + (card.data.n || 'Recipe') + '</b><div class="small" style="margin-top:6px">' + (card.data.d || 'A delicious recipe') + '</div>' :
         card.type === 'tip' ? '<b>💡 Chess tip</b><div style="margin-top:8px;font-style:italic">"' + (card.data.slice(0, 200)) + '"</div>' :
         card.type === 'verse' ? '<b>✨ Verse</b><div style="margin-top:8px">' + (card.data.v || '').replace(/\n/g, '<br>').slice(0, 300) + '</div>' :
         '<b>?</b>') +
        '</div>' +
        '<div class="small mute" style="margin-top:12px">A new card each day. Refresh the page to get another right now.</div>';
    }, 100);
  }

  // DAILY CARD TOOLTIP
  function showDailyCardToast() {
    const card = getDailyCard();
    if (!card) return;
    const msg = card.type === 'recipe' ? '🍳 ' + (card.data.n || 'Recipe') :
                card.type === 'tip' ? '💡 Tip: ' + card.data.slice(0, 60) :
                card.type === 'verse' ? '✨ ' + (card.data.v || '').slice(0, 50) :
                'Inspiration waiting';
    if (window.A && A.toast) A.toast(msg);
  }

  // PUBLIC API
  window.Delights = {
    showCompliment,
    showHint,
    getInspiration,
    getDailyCard,
    updateStreak,
    fireConfetti,
    showThinkingSpinner,
    hideThinkingSpinner,
    showDailyCardToast,
    showStreakInfo
  };

  // Auto-trigger: show compliment on first load of the day
  const today = new Date().toDateString();
  const lastLoadDay = ls.getItem('delights_last_load_day');
  if (lastLoadDay !== today) {
    ls.setItem('delights_last_load_day', today);
    setTimeout(() => { showCompliment(); if (Math.random() < 0.3) showDailyCardToast(); }, 1200);
  }

  // Auto-trigger: show hint every 10 minutes
  setInterval(() => Math.random() < 0.1 && showHint(), 600000);

  // Register inspiration tool when Studio is ready
  if (window.A && A.studio) registerInspirationTool();
  else if (window.addEventListener) window.addEventListener('load', registerInspirationTool);
})();
