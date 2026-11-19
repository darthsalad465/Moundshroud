// Lazy tab loader - loads tab modules on first visit
(() => {
  const loaded = new Set();
  const loading = new Map(); // name -> Promise

  // Map of tab name -> [script paths]
  const TAB_SCRIPTS = {
    // Core tabs (load quickly)
    home: ['/web/js/today.js'],
    chat: ['/web/js/chat.js', '/web/js/voicemode.js', '/web/js/agent.js', '/web/js/swarm.js', '/web/js/olympics.js', '/web/js/debate.js'],
    brain: ['/web/js/brain.js', '/web/js/appmap.js', '/web/js/whatsnew.js'],
    web: ['/web/js/net.js', '/web/js/websearch.js', '/web/js/search.js'],
    lib: ['/web/js/lib.js', '/web/js/libframe.js', '/web/js/classics.js', '/web/js/wikibooks.js', '/web/js/chessbooks.js', '/web/js/bookmarks.js', '/web/js/library.js', '/web/js/thesaurus.js', '/web/js/rhyme.js', '/web/js/viewer.js', '/web/js/pc.js'],
    files: ['/web/js/files.js', '/web/js/appedit.js'],
    notes: ['/web/js/notes.js'],
    study: ['/web/js/study.js', '/web/js/quiz.js', '/web/js/play-chess-study.js'],
    lang: ['/web/js/lang.js', '/web/js/lang-notes.js'],
    tools: ['/web/js/tools.js', '/web/js/markitdown.js', '/web/js/apis.js', '/web/js/calculator.js', '/web/js/scanner.js', '/web/js/meetings.js'],
    health: ['/web/js/health.js'],
    guide: ['/web/js/guide.js', '/web/js/guide-book.js', '/web/js/tutorial.js', '/web/js/walk.js'],
    play: ['/web/js/play.js', '/web/js/play-levels.js', '/web/js/play-g1.js', '/web/js/play-g2.js', '/web/js/play-g3.js', '/web/js/play-g4.js', '/web/js/play-depths.js', '/web/js/play-trader.js', '/web/js/president-engine.js', '/web/js/play-president.js', '/web/js/play-defense.js', '/web/js/play-germ.js', '/web/js/play-boards.js', '/web/js/play-cards.js', '/web/js/play-poker.js', '/web/js/play-classics.js', '/web/js/play-help.js', '/web/js/play-meta.js', '/web/js/play-hub.js', '/web/js/play-ports.js'],
    music: ['/web/js/music.js', '/web/js/music-mine.js', '/web/js/music-lib.js'],
    radio: ['/web/js/radio.js'],
    tv: ['/web/js/tv.js'],
    photos: ['/web/js/photos.js'],
    mail: ['/web/js/mail.js'],
    docs: ['/web/js/documents.js', '/web/js/office-edit.js'],
    offed: ['/web/js/office-edit.js'],
    calc: ['/web/js/calc.js', '/web/js/calc-engine.js', '/web/js/calc-lib.js', '/web/js/calc-cas.js', '/web/js/calc-pro.js', '/web/js/calc-pro-apps.js'],
    scan: ['/web/js/scanner.js'],
    meet: ['/web/js/meetings.js'],
    rem: ['/web/js/remind.js'],
    clip: ['/web/js/tools.js'],
    writing: ['/web/js/documents.js'],
    practice: ['/web/js/study.js'],
    teach: ['/web/js/teach.js'],
    sky: ['/web/js/sky-core.js', '/web/js/sky.js', '/web/js/sky-chart.js', '/web/js/sky-space.js', '/web/js/sky-compass.js', '/web/js/sky-weather.js'],
    lab: ['/web/js/lab.js', '/web/js/interp.js'],
    studio: ['/web/js/studio.js', '/web/js/studio-pixel-rand.js', '/web/js/studio-pixel.js', '/web/js/aiart.js', '/web/js/promptopt.js', '/web/js/studio-albums.js', '/web/js/studio-paint.js', '/web/js/studio-music.js', '/web/js/composer.js', '/web/js/modellab.js', '/web/js/forge.js', '/web/js/heretic.js', '/web/js/studio-medialab.js', '/web/js/studio-photoshop.js', '/web/js/studio-modelsuite.js', '/web/js/studio-sessions.js', '/web/js/studio-games.js', '/web/js/studio-godot.js', '/web/js/studio-storybook.js', '/web/js/studio-hotbox.js', '/web/js/tabletop.js'],
    cyber: ['/web/js/cyber-tools.js', '/web/js/artex.js', '/web/js/cyber-labs.js', '/web/js/cyber-reverse.js', '/web/js/cyber-crack.js', '/web/js/cybercourse-data.js', '/web/js/cybercourse.js', '/web/js/code-lessons-data.js', '/web/js/code-lessons.js', '/web/js/cyberlab.js', '/web/js/cyber-games.js'],
    faith: ['/web/js/faith-data.js', '/web/js/faith.js', '/web/js/faith-extra.js', '/web/js/faith-learn.js', '/web/js/bible.js', '/web/js/bible-book.js', '/web/js/bible-chats.js', '/web/js/play-bible.js'],
    map: ['/web/js/appmap.js'],
    timeline: ['/web/js/timeline.js'],
    money: ['/web/js/money.js'],
    journal: ['/web/js/journal.js'],
    albums: ['/web/js/albums.js'],
    cal: ['/web/js/cal.js', '/web/js/holidays.js', '/web/js/onthisday.js'],
    kitchen: ['/web/js/kitchen.js'],
    garden: ['/web/js/garden.js'],
    prep: ['/web/js/prepare.js', '/web/js/prep-plans.js', '/web/js/prep-supplies.js', '/web/js/prep-people.js', '/web/js/prep-signals.js', '/web/js/prep-sky.js', '/web/js/prep-recipes.js'],
    appedit: ['/web/js/code-stats.js', '/web/js/appedit.js'],
    coding: ['/web/js/code-stats.js', '/web/js/coding.js'],
  };

  // Load a script dynamically
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  // Load all scripts for a tab
  async function loadTabScripts(name) {
    const scripts = TAB_SCRIPTS[name] || [];
    await Promise.all(scripts.map(loadScript));
    // Wait for modules to register
    await new Promise(r => setTimeout(r, 50));
  }

  // Public API
  A.lazy = {
    // Load a tab's scripts on demand
    load: async (name) => {
      if (loaded.has(name)) return true;
      if (loading.has(name)) return loading.get(name);

      const promise = (async () => {
        try {
          await loadTabScripts(name);
          const before = A.order.length;
          loaded.add(name);
          /* a module loaded just now can register its tab (and its page); the top bar and the pages must catch up, or
             the new tab has no button and its page can sit on top of the one being shown */
          if (A.order.length !== before) { try { A.buildNav(); A.navMark(); } catch (e) { } }
          for (const p of document.querySelectorAll('section.panel')) p.classList.toggle('on', p.id === 'p-' + A.cur);
          // Call onShow if it exists and was deferred
          if (A.tabs[name] && A.tabs[name]._deferredOnShow) {
            A.tabs[name].onShow = A.tabs[name]._deferredOnShow;
            delete A.tabs[name]._deferredOnShow;
          }
          return true;
        } catch (e) {
          console.error(`Failed to load tab ${name}:`, e);
          return false;
        } finally {
          loading.delete(name);
        }
      })();

      loading.set(name, promise);
      return promise;
    },

    // Preload tabs (e.g., on hover or idle)
    preload: (names) => {
      names.forEach(n => A.lazy.load(n));
    },

    // Check if loaded
    isLoaded: (name) => loaded.has(name),
  };

  // Override showTab to lazy-load
  const originalShowTab = A.showTab;
  A.showTab = async (name) => {
    if (!A.tabs[name]) return;
    if (!loaded.has(name)) {
      A.toast(`Loading ${A.tabs[name].label}...`, 2000);
      await A.lazy.load(name);
    }
    return originalShowTab(name);
  };

  // Preload on nav hover
  let preloadTimer = null;
  document.addEventListener('mouseover', e => {
    const btn = e.target.closest('#nav button[data-tab]');
    if (btn && !loaded.has(btn.dataset.tab)) {
      clearTimeout(preloadTimer);
      preloadTimer = setTimeout(() => A.lazy.load(btn.dataset.tab), 200);
    }
  });

// Preload related tabs on first load (idle)
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload commonly used tabs
      ['chat', 'brain', 'lib', 'notes'].forEach(n => A.lazy.load(n));
    }, { timeout: 5000 });
  }
})();

/* Lazy image loading with IntersectionObserver - call A.lazyImages() after rendering content */
A.lazyImages = (root = document) => {
  const images = root.querySelectorAll('img[data-src]:not([data-lazy-done])');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.onload = () => img.removeAttribute('data-src');
        img.dataset.lazyDone = '1';
        obs.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });
  images.forEach(img => obs.observe(img));
  return obs;
};

/* Virtual list renderer for large lists - use A.virtualList(host, items, renderItem, opts) from core.js */

/* Virtual grid renderer - use A.virtualGrid(host, items, renderItem, opts) from core.js */
