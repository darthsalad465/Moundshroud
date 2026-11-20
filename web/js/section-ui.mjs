const scripts = new Map();
const collections = {
  recipes: 'nicholaswilde/recipes',
  content: 'mdn/content',
  'en-javascript-info': 'javascript-tutorial/en.javascript.info',
  'missing-semester': 'missing-semester/missing-semester',
  'sql-novice-survey': 'swcarpentry/sql-novice-survey',
  jekyll: 'programminghistorian/jekyll',
  openngc: 'mattiaverga/OpenNGC',
  'chess-openings': 'lichess-org/chess-openings',
  'periodic-table-json': 'Bowserinator/Periodic-Table-JSON',
  frequencywords: 'hermitdave/FrequencyWords',
  'thesession-data': 'adactio/TheSession-data',
  'color-names': 'meodai/color-names'
};
export function script(url) {
  if (!scripts.has(url)) {
    const promise = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = url;
      tag.onload = resolve;
      tag.onerror = () => {
        tag.remove();
        scripts.delete(url);
        reject(Error('Could not load the local tool.'));
      };
      document.head.append(tag);
    });
    scripts.set(url, promise);
  }
  return scripts.get(url);
}
export async function api(id, data = {}) {
  const r = await A.api('/api/section-tools', { ...data, id });
  if (r.error) throw Object.assign(Error(r.error), { repo: collections[r.collection] });
  return r;
}
export function node(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
export function button(label, fn, cls = 'ib') {
  const b = node('button', label, cls);
  b.type = 'button';
  b.onclick = fn;
  return b;
}
export function form(box, label, placeholder, onSearch) {
  const f = node('form', null, 'sf-search');
  const field = node('input');
  field.type = 'search';
  field.placeholder = placeholder;
  field.setAttribute('aria-label', label);
  const submit = node('button', 'Search', 'ib');
  f.append(field, submit);
  box.append(f);
  f.onsubmit = (e) => {
    e.preventDefault();
    onSearch(field.value.trim());
  };
  return field;
}
export function table(headers, rows) {
  const t = node('table', null, 'sf-table'),
    head = t.createTHead().insertRow();
  for (const h of headers) head.append(node('th', h));
  const b = t.createTBody();
  for (const row of rows) {
    const tr = b.insertRow();
    for (const cell of row) tr.insertCell().textContent = cell ?? '—';
  }
  return t;
}
export function modal(title) {
  document.querySelector('dialog.section-tool')?.close();
  const dialog = node('dialog', null, 'section-tool'),
    head = node('header'),
    heading = node('h2', title);
  heading.id = 'sf-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const close = () => dialog.close(),
    body = node('div', null, 'sf-body'),
    status = node('div', null, 'sf-status');
  status.setAttribute('role', 'status');
  head.append(heading, button('Close', close));
  dialog.append(head, body, status);
  document.body.append(dialog);
  dialog.showModal();
  const controller = new AbortController();
  dialog.addEventListener(
    'close',
    () => {
      controller.abort();
      dialog.remove();
    },
    { once: true }
  );
  const run = async (fn) => {
    try {
      status.textContent = '';
      return await fn();
    } catch (e) {
      if (!dialog.open) return;
      status.textContent = e.message || String(e);
      if (e.repo)
        status.append(
          ' ',
          button('Download ' + e.repo, () =>
            run(async () => {
              const r = await A.api('/api/refs/install', { url: e.repo });
              if (r.error) throw Error(r.error);
              status.textContent =
                'Downloading. Reopen this tool when indexing finishes in Tools → Repositories.';
            })
          )
        );
    }
  };
  return { dialog, body, status, close, signal: controller.signal, run };
}
