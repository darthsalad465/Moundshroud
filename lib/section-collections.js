const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const docs = require('./docs');
const refs = require('./refs');
const { Worker, isMainThread, parentPort } = require('node:worker_threads');

const books = {
  recipes: ['recipes', 'docs', /\.md$/i],
  mdn: ['content', 'files/en-us', /\/index\.md$/i],
  javascript: ['en-javascript-info', '', /^\d[^/]*\/.*\/article\.md$/],
  semester: ['missing-semester', '_2026', /\.md$/],
  sql: ['sql-novice-survey', 'episodes', /^\d[^/]*\.md$/],
  history: ['jekyll', '', /^(en|es|fr|pt)\/(?:lessons|lecciones|lecons|licoes)\/[^/]+\.md$/]
};
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function source(repo, relative = '.') {
  const base = path.join(refs.DIR, repo);
  if (!fs.existsSync(base))
    throw Object.assign(Error('This collection needs its offline data.'), { collection: repo });
  const root = fs.realpathSync(base);
  if (!inside(fs.realpathSync(refs.DIR), root)) throw Error('Invalid collection location.');
  const file = fs.realpathSync(path.resolve(root, relative));
  if (file !== root && !inside(root, file)) throw Error('Invalid collection file.');
  return file;
}
function bookTitle(id, key) {
  const parts = key.replace(/\.md$/, '').split('/');
  if (id === 'mdn') return parts.slice(-3, -1).join(' / ');
  if (id === 'javascript') parts.pop();
  return parts
    .at(-1)
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]/g, ' ');
}
function book(id, input) {
  const [repo, folder, pattern] = books[id];
  const root = source(repo, folder);
  if (input.file) {
    const key = String(input.file);
    if (key.includes('\\') || key.split('/').some((p) => !p || p.startsWith('.')) || !pattern.test(key))
      throw Error('Invalid page.');
    const file = source(repo, path.join(folder, key));
    if (!inside(root, file) || fs.statSync(file).size > 3e6) throw Error('Page unavailable.');
    const raw = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const front = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    const content = raw
      .slice(front?.[0].length || 0)
      .replace(/:([a-z][\w-]*):(?=\s)/g, id === 'recipes' ? '' : '$&');
    const title =
      front?.[1].match(/^title:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '') ||
      content.match(/^#\s+(.+)/m)?.[1] ||
      bookTitle(id, key);
    return { title, content, file: key };
  }
  const prefix = root + path.sep;
  const db = docs.open();
  const term = String(input.q || '')
    .trim()
    .slice(0, 120);
  const limit = 40,
    offset = Math.max(0, Math.trunc(Number(input.offset) || 0));
  const rows = db
    .prepare("SELECT path FROM files WHERE path>=? AND path<? AND kind='doc' ORDER BY path")
    .all(prefix, root + String.fromCharCode(path.sep.charCodeAt(0) + 1));
  const pages = rows
    .map((r) => path.relative(root, r.path).split(path.sep).join('/'))
    .filter(
      (k) =>
        pattern.test(k) &&
        !(
          id === 'recipes' &&
          /^(?:assets|reference|javascripts|css|stylesheets)\/|(?:^|\/)(?:index|README|tags)\.md$/i.test(k)
        )
    );
  if (id === 'semester') {
    const date = (key) =>
      fs
        .readFileSync(source(repo, path.join(folder, key)), 'utf8')
        .match(/^date:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] || '';
    const dated = new Map(pages.map((key) => [key, date(key)]));
    pages.sort((a, b) => dated.get(a).localeCompare(dated.get(b)));
  } else if (id === 'javascript') pages.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const words = term.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const named = pages.filter((k) => words.every((w) => k.toLowerCase().includes(w)));
  if (words.length && named.length <= offset + limit) {
    const hits = db
      .prepare('SELECT DISTINCT path FROM docs WHERE docs MATCH ? AND path>=? AND path<?')
      .all(
        words.map((w) => '"' + w + '"').join(' AND '),
        prefix,
        root + String.fromCharCode(path.sep.charCodeAt(0) + 1)
      );
    const found = new Set(hits.map((r) => path.relative(root, r.path).split(path.sep).join('/'))),
      seen = new Set(named);
    for (const k of pages) if (found.has(k) && !seen.has(k)) named.push(k);
  }
  return {
    items: named.slice(offset, offset + limit).map((file) => ({ file, title: bookTitle(id, file) })),
    more: named.length > offset + limit,
    indexed: pages.length
  };
}

const cache = new Map();
function table(repo, file, parse) {
  const p = source(repo, file),
    stamp = fs.statSync(p).mtimeMs,
    old = cache.get(p);
  if (old?.stamp === stamp) return old.value;
  const value = parse(fs.readFileSync(p, 'utf8'));
  cache.set(p, { stamp, value });
  return value;
}
function lines(s) {
  return s.trimEnd().split(/\r?\n/);
}
function sexagesimal(s) {
  if (!s) return null;
  const [a, b, c] = s.replace(/^[+-]/, '').split(':').map(Number);
  return (s.startsWith('-') ? -1 : 1) * (a + b / 60 + c / 3600);
}
function ngc(input) {
  const rows = table('openngc', 'database_files/NGC.csv', (raw) =>
    lines(raw)
      .slice(1)
      .map((line) => {
        const f = line.split(';');
        return {
          id: f[0],
          type: f[1],
          ra: sexagesimal(f[2]),
          dec: sexagesimal(f[3]),
          constellation: f[4],
          messier: f[23] ? 'M' + Number(f[23]) : '',
          names: f[28],
          mag: f[9] && Number.isFinite(Number(f[9])) ? Number(f[9]) : null
        };
      })
  );
  const norm = (s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/(ngc|ic|m)0+(?=\d)/g, '$1');
  const q = norm(String(input.q || ''));
  return { items: rows.filter((r) => norm([r.id, r.names, r.messier].join('|')).includes(q)).slice(0, 50) };
}
function openings(input) {
  const rows = ['a', 'b', 'c', 'd', 'e'].flatMap((c) =>
    table('chess-openings', c + '.tsv', (raw) =>
      lines(raw)
        .slice(1)
        .map((line) => {
          const [eco, name, pgn] = line.split('\t');
          return {
            eco,
            name,
            pgn,
            moves: pgn
              .replace(/\d+\.\s*/g, '')
              .trim()
              .split(/\s+/)
          };
        })
    )
  );
  const prefix = Array.isArray(input.moves) ? input.moves.slice(0, 100) : [];
  const q = String(input.q || '')
    .trim()
    .toLowerCase();
  const matches = rows.filter((r) => prefix.every((m, i) => r.moves[i] === m));
  return {
    current: matches.find((r) => r.moves.length === prefix.length)?.name || '',
    next: [...new Set(matches.map((r) => r.moves[prefix.length]).filter(Boolean))],
    items: matches.filter((r) => (r.name + ' ' + r.eco + ' ' + r.pgn).toLowerCase().includes(q)).slice(0, 35)
  };
}
function words(input) {
  const base = 'content/2018';
  const langs = fs
    .readdirSync(source('frequencywords', base))
    .filter(
      (n) =>
        /^[a-z]{2,3}$/.test(n) &&
        fs.existsSync(path.join(refs.DIR, 'frequencywords', base, n, n + '_50k.txt'))
    );
  const lang = input.lang || 'en';
  if (!langs.includes(lang)) throw Error('Choose a listed language.');
  const start = Math.max(0, Math.min(49999, Math.trunc(Number(input.start) || 0)));
  const rows = table('frequencywords', base + '/' + lang + '/' + lang + '_50k.txt', lines);
  return {
    langs,
    total: rows.length,
    items: rows.slice(start, start + 20).map((line, i) => {
      const at = line.lastIndexOf(' ');
      return { rank: start + i + 1, word: line.slice(0, at), count: Number(line.slice(at + 1)) };
    })
  };
}
function tunes(input) {
  const db = new DatabaseSync(source('thesession-data', 'thesession.db'), { readOnly: true });
  try {
    db.exec('PRAGMA trusted_schema=OFF');
    if (input.setting) {
      const row = db
        .prepare('SELECT name, type, meter, mode, abc FROM tunes WHERE setting_id=? LIMIT 1')
        .get(String(input.setting));
      if (!row) throw Error('Tune setting unavailable.');
      return {
        name: row.name,
        abc: [
          'X:1',
          'T:' + row.name,
          'R:' + row.type,
          'M:' + row.meter,
          'L:1/8',
          'K:' + row.mode,
          row.abc
        ].join('\n')
      };
    }
    return {
      items: db
        .prepare(
          'SELECT setting_id,name,type,mode FROM tunes WHERE instr(lower(name),lower(?))>0 ORDER BY name,setting_id LIMIT 50'
        )
        .all(String(input.q || '').slice(0, 120))
    };
  } finally {
    db.close();
  }
}
function query(b) {
  if (Object.hasOwn(books, b.id)) return book(b.id, b);
  switch (b.id) {
    case 'saved-articles': {
      const dir = path.join(require('./webpages').DIR, 'reader');
      if (!fs.existsSync(dir)) return { items: [] };
      const files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile() && /^[a-z\d-]+\.md$/i.test(e.name))
        .map((e) => e.name);
      if (b.file) {
        if (!files.includes(b.file)) throw Error('Article unavailable.');
        return { content: fs.readFileSync(path.join(dir, b.file), 'utf8') };
      }
      return {
        items: files.map((file) => {
          const fd = fs.openSync(path.join(dir, file), 'r'),
            buf = Buffer.alloc(1400);
          try {
            const n = fs.readSync(fd, buf, 0, buf.length, 0);
            return { file, title: buf.toString('utf8', 0, n).split('\n')[0].replace(/^#\s*/, '') || file };
          } finally {
            fs.closeSync(fd);
          }
        })
      };
    }
    case 'openngc':
      return ngc(b);
    case 'openings':
      return openings(b);
    case 'words':
      return words(b);
    case 'tunes':
      return tunes(b);
    case 'elements':
      return {
        items: table('periodic-table-json', 'PeriodicTableJSON.json', (raw) =>
          JSON.parse(raw)
            .elements.filter((el) => el.number <= 118)
            .map(
              ({
                name,
                symbol,
                number,
                atomic_mass,
                category,
                phase,
                period,
                group,
                melt,
                boil,
                xpos,
                ypos
              }) => ({
                name,
                symbol,
                number,
                atomic_mass,
                category,
                phase,
                period,
                group,
                melt,
                boil,
                xpos,
                ypos
              })
            )
        )
      };
    case 'colors':
      return {
        items: table('color-names', 'src/colornames.csv', (raw) =>
          lines(raw)
            .slice(1)
            .flatMap((line) => {
              const m = line.match(/^(.+),(#[\da-f]{6}),/i);
              return m ? [[m[1].replace(/^"|"$/g, ''), m[2]]] : [];
            })
        )
      };
    case 'survey':
      return {
        database: fs.readFileSync(source('sql-novice-survey', 'episodes/files/survey.db')).toString('base64')
      };
    default:
      throw Error('Unknown collection.');
  }
}
// Keep full-text searches and collection parsing off the server's request thread.
let worker,
  sequence = 0;
const pending = new Map();
function queryAsync(input) {
  if (!worker) {
    const current = new Worker(__filename);
    worker = current;
    current.on('message', ({ id, result, error, collection }) => {
      const job = pending.get(id);
      if (!job) return;
      pending.delete(id);
      if (error) job.reject(Object.assign(Error(error), { collection }));
      else job.resolve(result);
    });
    function stopped() {
      if (worker !== current) return;
      worker = null;
      for (const job of pending.values())
        job.reject(Error('The collection reader stopped. Please try again.'));
      pending.clear();
    }
    current.on('error', stopped);
    current.on('exit', stopped);
    current.unref();
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, input });
  });
}
if (!isMainThread && require.main === module) {
  parentPort.on('message', ({ id, input }) => {
    try {
      parentPort.postMessage({ id, result: query(input) });
    } catch (e) {
      parentPort.postMessage({
        id,
        error:
          e.code === 'ENOENT'
            ? 'The collection file is unavailable. Check its repository download.'
            : e.message,
        collection: e.collection
      });
    }
  });
}
module.exports = { query, queryAsync };
