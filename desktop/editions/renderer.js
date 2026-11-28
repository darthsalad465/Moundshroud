/* Loaded after core and before the application modules register their pages. */
(() => {
  const allowed = new Set(EDITION.tabs);
  const register = A.registerTab;
  A.registerTab = function (name, ...args) {
    if (allowed.has(name)) return register.call(this, name, ...args);
  };
  document.documentElement.classList.add('edition');
  document.documentElement.dataset.edition = EDITION.id;
  document.title = EDITION.name;
  const title = document.querySelector('body > header > b');
  if (title) title.textContent = EDITION.name;
  A.ready.push(() => {
    const open = EDITION.tabs.find(name => A.tabs[name]);
    if (open) return A.showTab(open);
    document.querySelector('main').textContent = 'This edition could not initialize its workspace.';
  });
})();
