import { api, node, button, form, table } from './section-ui.mjs';
import { score, sqlWorkbench } from './section-instruments.mjs';

const lessonIds = new Set(['javascript', 'semester', 'history', 'sql']);
export async function reader(s, id) {
  const isLesson = lessonIds.has(id),
    key = 'section-course-' + id;
  let completed = new Set(JSON.parse(ls.get(key, '[]'))),
    term = '',
    offset = 0,
    request = 0,
    batch = [];
  const search = node('div'),
    list = node('div', null, 'sf-list'),
    page = node('article'),
    nav = node('div', null, 'sf-row');
  const label = id === 'recipes' ? 'Search recipes by dish or ingredients' : 'Search titles or lesson text';
  form(search, label, label, (q) => {
    term = q;
    offset = 0;
    s.run(load);
  });
  s.body.append(search, list, nav, page);
  if (id === 'sql') await sqlWorkbench(s);
  async function open(item) {
    const serial = ++request;
    const doc = await api(id, { file: item.file });
    if (serial !== request || s.signal.aborted) return;
    list.hidden = nav.hidden = search.hidden = true;
    page.hidden = false;
    const back = button('Back to results', () => s.run(load)),
      actions = node('div', null, 'sf-row');
    actions.append(back);
    if (isLesson) {
      const toggle = button('', () => {
        if (completed.has(item.file)) completed.delete(item.file);
        else completed.add(item.file);
        ls.set(key, JSON.stringify([...completed]));
        paint();
      });
      function paint() {
        toggle.textContent = completed.has(item.file) ? 'Mark unread' : 'Mark complete';
      }
      paint();
      actions.append(toggle);
      const next = batch[batch.findIndex((row) => row.file === item.file) + 1];
      if (next) actions.append(button('Next lesson', () => s.run(() => open(next))));
    }
    const body = node('div');
    body.innerHTML = md(
      doc.content.replace(/\{\{(?:domxref|jsxref|cssxref|htmlattrxref)\("([^"]+)"[^}]*\)\}\}/gi, '$1')
    );
    if (id === 'recipes') {
      for (const h of body.querySelectorAll('h3')) {
        if (!/ingredients/i.test(h.textContent)) continue;
        const ul = h.nextElementSibling;
        if (ul?.tagName !== 'UL') continue;
        for (const li of ul.children) {
          const check = node('input');
          check.type = 'checkbox';
          const label = node('label');
          label.append(check, ' ', ...Array.from(li.childNodes));
          li.replaceChildren(label);
        }
      }
    }
    page.replaceChildren(actions, node('h3', doc.title), body);
    s.dialog.scrollTop = 0;
  }
  async function load() {
    const serial = ++request;
    list.hidden = nav.hidden = search.hidden = false;
    page.hidden = true;
    s.status.textContent = 'Searching…';
    const r = await api(id, { q: term, offset });
    if (serial !== request || s.signal.aborted) return;
    batch = r.items;
    list.replaceChildren(
      ...r.items.map((item) =>
        button((completed.has(item.file) ? '✓ ' : '') + item.title, () => s.run(() => open(item)))
      )
    );
    nav.replaceChildren();
    if (offset)
      nav.append(
        button('Previous 40', () => {
          offset = Math.max(0, offset - 40);
          s.run(load);
        })
      );
    if (r.more)
      nav.append(
        button('Next 40', () => {
          offset += 40;
          s.run(load);
        })
      );
    s.status.textContent = r.items.length
      ? ''
      : r.indexed
        ? 'No matching pages.'
        : 'The collection is downloaded. Index it in My Files to browse its pages.';
  }
  await load();
}

export async function deepSky(s) {
  const list = node('div', null, 'sf-list');
  let seq = 0;
  form(s.body, 'Find a deep-sky object', 'Whirlpool, M51, or NGC 5194', (q) => s.run(() => load(q)));
  s.body.append(list);
  async function load(q) {
    const serial = ++seq,
      r = await api('openngc', { q });
    if (serial !== seq) return;
    list.replaceChildren(
      ...r.items.map((o) => {
        const label = [o.id, o.messier, o.names, o.constellation].filter(Boolean).join(' · ');
        const b = button(label, () => {
          if (!A.sky.loc()) return void (s.status.textContent = 'Set your observing location in Sky first.');
          s.close();
          A.sky.go('chart', {
            id: o.id,
            label,
            type: 'dso',
            kind: o.type,
            mag: o.mag,
            pos: () => ({ ra: o.ra * 15, dec: o.dec })
          });
        });
        b.disabled = o.ra == null || o.dec == null;
        return b;
      })
    );
    s.status.textContent = r.items.length
      ? 'Select an object to center the sky chart.'
      : 'No matching objects.';
  }
  await load('M51');
}

export async function openings(s) {
  let moves = [],
    q = '',
    seq = 0;
  const board = node('div', null, 'sf-board'),
    current = node('h3'),
    choices = node('div', null, 'sf-row'),
    matches = node('div', null, 'sf-list');
  form(s.body, 'Search openings', 'Name, ECO code, or move sequence', (v) => {
    q = v;
    s.run(draw);
  });
  const undo = button('Undo move', () => {
      moves.pop();
      s.run(draw);
    }),
    reset = button('Start position', () => {
      moves = [];
      q = '';
      s.body.querySelector('input').value = '';
      s.run(draw);
    });
  s.body.append(current, board, undo, reset, choices, matches);
  async function draw() {
    const serial = ++seq,
      r = await api('openings', { q, moves });
    if (serial !== seq) return;
    const pos = new Chess.Pos().setFen(Chess.START);
    for (const san of moves) {
      const m = pos.fromSan(san);
      if (m == null) throw Error('Invalid opening move ' + san);
      pos.make(m);
    }
    const pieces = {
      k: '♚',
      q: '♛',
      r: '♜',
      b: '♝',
      n: '♞',
      p: '♟',
      K: '♔',
      Q: '♕',
      R: '♖',
      B: '♗',
      N: '♘',
      P: '♙'
    };
    const cells = pos
      .fen()
      .split(' ')[0]
      .replaceAll('/', '')
      .replace(/[1-8]/g, (n) => ' '.repeat(+n));
    board.replaceChildren(
      ...Array.from(cells, (c, i) => node('span', pieces[c] || '', (Math.floor(i / 8) + i) % 2 ? 'dark' : ''))
    );
    current.textContent = r.current || moves.join(' ') || 'Starting position';
    undo.disabled = !moves.length;
    choices.replaceChildren(
      ...r.next.map((m) =>
        button(m, () => {
          moves.push(m);
          s.run(draw);
        })
      )
    );
    matches.replaceChildren(
      ...r.items.map((r) =>
        button(r.eco + ' · ' + r.name + ' · ' + r.pgn, () => {
          moves = r.moves;
          s.run(draw);
        })
      )
    );
    s.status.textContent = r.items.length ? '' : 'No matching lines.';
  }
  await draw();
}

export async function elements(s) {
  const { items } = await api('elements'),
    grid = node('div', null, 'sf-elements'),
    scroll = node('div', null, 'sf-scroll'),
    details = node('div');
  const a = node('select'),
    b = node('select');
  for (const el of items) {
    for (const sel of [a, b]) sel.add(new Option(el.name, el.number));
  }
  a.value = '1';
  b.value = '2';
  a.setAttribute('aria-label', 'First element');
  b.setAttribute('aria-label', 'Second element');
  for (const el of items) {
    const key = button(el.symbol, () => {
      a.value = el.number;
      draw();
    });
    key.title = el.number + ' · ' + el.name;
    key.style.gridColumn = el.xpos;
    key.style.gridRow = el.ypos;
    grid.append(key);
  }
  scroll.append(grid);
  s.body.append(scroll, node('h3', 'Compare elements'), a, b, details);
  function draw() {
    const left = items.find((x) => x.number === +a.value),
      right = items.find((x) => x.number === +b.value);
    details.replaceChildren(
      table(
        ['Property', left.name, right.name],
        [
          ['Atomic number', 'number'],
          ['Atomic mass (u)', 'atomic_mass'],
          ['Category', 'category'],
          ['Phase', 'phase'],
          ['Group', 'group'],
          ['Period', 'period'],
          ['Melting point (K)', 'melt'],
          ['Boiling point (K)', 'boil']
        ].map(([label, key]) => [label, left[key], right[key]])
      )
    );
  }
  a.onchange = b.onchange = draw;
  draw();
}

export async function words(s) {
  const names = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' });
  let r = await api('words'),
    index = 0,
    offset = 0,
    seq = 0;
  const lang = node('select'),
    card = node('h3'),
    answer = node('p'),
    controls = node('div', null, 'sf-row');
  for (const code of r.langs) lang.add(new Option(names.of(code) || code, code));
  lang.value = 'en';
  lang.setAttribute('aria-label', 'Practice language');
  const prev = button('Previous 20', () => s.run(() => load(Math.max(0, offset - 20))));
  const next = button('Next 20', () => s.run(() => load(offset + 20)));
  const reveal = button('Reveal word', () => {
    answer.hidden = false;
  });
  const advance = button('Next card', () => {
    index = (index + 1) % r.items.length;
    draw();
  });
  const save = button('Add these cards to Study', () =>
    s.run(async () => {
      const deck = names.of(lang.value) + ' · words ' + (offset + 1) + '–' + (offset + r.items.length);
      await A.study.addCards(
        deck,
        r.items.map((w) => ({ q: prompt(w), a: w.word }))
      );
      save.disabled = true;
      s.status.textContent = 'Saved to Study as ' + deck + '.';
    })
  );
  function prompt(w) {
    const chars = Array.from(w.word);
    if (chars.length === 1)
      return 'Recall the one-letter word ranked #' + w.rank + ' in ' + names.of(lang.value) + '.';
    const split = Math.ceil(chars.length / 2),
      letters = chars.slice(split).concat(chars.slice(0, split));
    return 'Unscramble the letters · ' + names.of(lang.value) + ' #' + w.rank + ' · ' + letters.join(' ');
  }
  function draw() {
    const w = r.items[index];
    if (!w) return;
    card.textContent = prompt(w);
    answer.textContent = w.word + ' · ' + w.count.toLocaleString() + ' occurrences';
    answer.hidden = true;
    prev.disabled = !offset;
    next.disabled = offset + 20 >= r.total;
  }
  async function load(at) {
    const serial = ++seq;
    const data = await api('words', { lang: lang.value, start: at });
    if (serial !== seq) return;
    r = data;
    offset = at;
    index = 0;
    save.disabled = false;
    draw();
  }
  lang.onchange = () => s.run(() => load(0));
  controls.append(reveal, advance, prev, next, save);
  s.body.append(lang, card, answer, controls);
  draw();
}
export async function colors(s) {
  const { items } = await api('colors'),
    pick = node('input'),
    list = node('div', null, 'sf-list'),
    sample = node('p');
  pick.type = 'color';
  pick.value = '#447799';
  pick.setAttribute('aria-label', 'Find nearest named color');
  function rgb(h) {
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const values = items.map(([name, hex]) => ({ name, hex, rgb: rgb(hex) }));
  function nearest() {
    const c = rgb(pick.value);
    let best = null,
      dist = Infinity;
    for (const v of values) {
      const d = c.reduce((n, x, i) => n + (x - v.rgb[i]) ** 2, 0);
      if (d < dist) {
        best = v;
        dist = d;
      }
    }
    sample.textContent = pick.value + ' → ' + best.name + ' (' + best.hex + ')';
  }
  function search(q) {
    list.replaceChildren(
      ...values
        .filter((v) => v.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 35)
        .map((v) => {
          const b = button(v.name + ' · ' + v.hex, () => {
            pick.value = v.hex;
            nearest();
          });
          b.style.borderLeft = '1rem solid ' + v.hex;
          return b;
        })
    );
  }
  form(s.body, 'Search named colors', 'Color name', search);
  pick.oninput = nearest;
  s.body.append(pick, sample);
  if (window.EyeDropper)
    s.body.append(
      button('Sample screen color', () =>
        s.run(async () => {
          try {
            pick.value = (await new EyeDropper().open()).sRGBHex;
            nearest();
          } catch (e) {
            if (e.name !== 'AbortError') throw e;
          }
        })
      )
    );
  s.body.append(list);
  nearest();
  search('blue');
}
export async function tunes(s) {
  const list = node('div', null, 'sf-list');
  let seq = 0;
  form(s.body, 'Search traditional tunes', 'Tune name', (q) => s.run(() => load(q)));
  s.body.append(list);
  async function load(q) {
    const serial = ++seq,
      r = await api('tunes', { q });
    if (serial !== seq) return;
    list.replaceChildren(
      ...r.items.map((t) =>
        button(t.name + ' · ' + t.type + ' · ' + t.mode + ' (#' + t.setting_id + ')', () =>
          s.run(async () => {
            const setting = await api('tunes', { setting: t.setting_id });
            s.body.replaceChildren();
            s.body.append(
              button('Back to tune book', () => {
                s.body.replaceChildren();
                s.run(() => tunes(s));
              })
            );
            await score(s, setting.abc);
          })
        )
      )
    );
    s.status.textContent = r.items.length ? '' : 'No matching tunes.';
  }
  await load('Kesh');
}
export async function savedArticles(s) {
  const r = await api('saved-articles'),
    list = node('div', null, 'sf-list');
  s.body.append(list);
  for (const { file, title } of r.items)
    list.append(
      button(title, () =>
        s.run(async () => {
          const doc = await api('saved-articles', { file });
          s.body.replaceChildren(
            button('Back to articles', () => {
              s.body.replaceChildren();
              s.run(() => savedArticles(s));
            })
          );
          const body = node('article');
          body.innerHTML = md(doc.content);
          s.body.append(body);
        })
      )
    );
  if (!r.items.length) s.status.textContent = 'Save an article from Browser → Article reader.';
}
