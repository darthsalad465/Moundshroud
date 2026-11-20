// Verifies the 19 ultra-small open-source repos wired into Moundshroud:
//   - 4 single-file native tools (sqlite-vec, rg, fd, jq) via lib/microtools.js
//   - 15 tiny browser libraries in web/vendor/micro/ + web/js/micro.js + remind/FSRS/SunCalc/MiniSearch/PapaParse/fflate
const fs = require('fs'), path = require('path'), vm = require('vm');
const { DatabaseSync } = require('node:sqlite');
const microtools = require('../lib/microtools');

module.exports = async ok => {
  const root = path.join(__dirname, '..');
  const rd = f => fs.readFileSync(path.join(root, f), 'utf8');

  /* 1. Native single-file tools (engines/micro/) */
  const st = microtools.status();
  ok('microtools: all 5 native binaries (vec, rg, fd, jq, sd) are present', st.vec.ok && st.rg.ok && st.fd.ok && st.jq.ok && st.sd.ok, JSON.stringify(st));

  const db = new DatabaseSync(':memory:', { allowExtension: true });
  db.loadExtension(microtools.vecPath());
  const vv = db.prepare('SELECT vec_version() AS v').get();
  const a = Buffer.from(new Float32Array([1, 0, 0]).buffer), b = Buffer.from(new Float32Array([1, 0, 0]).buffer);
  const dist = db.prepare('SELECT vec_distance_cosine(?, ?) AS d').get(a, b);
  db.close();
  ok('microtools: sqlite-vec loads and computes cosine distance in C', !!vv.v && Math.abs(dist.d) < 1e-6, JSON.stringify({ vv, dist }));

  const rg = microtools.rgSearch(path.join(root, 'lib'), 'vec_distance_cosine', { max: 10 });
  ok('microtools: ripgrep finds text in lib/', rg.ok && rg.hits.some(h => h.rel.endsWith('docs.js')), JSON.stringify(rg.hits && rg.hits.slice(0, 2)));

  const fd = microtools.fdFind(path.join(root, 'web', 'vendor', 'micro'), 'suncalc', { type: 'f', max: 10 });
  ok('microtools: fd finds files quickly', fd.ok && fd.files.some(f => /suncalc/i.test(f.rel)), JSON.stringify(fd.files));

  const jq = microtools.jqRun('{"items":[1,2,3,4]}', '.items | add');
  ok('microtools: jq evaluates JSON filters offline', jq.ok && jq.output.trim() === '10', JSON.stringify(jq));

  const sd = microtools.sdRun('version = 1.2.0', '1\\.2\\.0', '1.3.0');
  ok('microtools: sd performs regex find-and-replace offline', sd.ok && sd.output.trim() === 'version = 1.3.0', JSON.stringify(sd));

  /* 2. Micro JS libraries + helpers */
  const ctx = vm.createContext({
    A: { api: async () => ({}), toast() { }, copy() { } },
    ls: { get: (k, d) => d, set() { } },
    esc: s => String(s),
    document: { createElement: () => ({ style: {}, getContext: () => ({}) }), addEventListener() { }, querySelector: () => null, querySelectorAll: () => [], getElementsByTagName: () => [], compatMode: 'CSS1Compat', currentScript: { hasAttribute: () => true, src: '' } },
    window: null, self: null, globalThis: null, navigator: { userAgent: '' }, location: { href: 'http://127.0.0.1/' },
    crypto: require('crypto').webcrypto,
    Element: function Element() { },
    devicePixelRatio: 1,
    matchMedia: () => ({ addEventListener() { }, removeEventListener() { }, matches: false }),
    CustomEvent: function CustomEvent(t) { this.type = t; },
    addEventListener() { }, removeEventListener() { },
    dispatchEvent() { },
    console, setTimeout, clearTimeout, Math, Date, Object, Array, RegExp, Number, String,
    Uint8Array, Int32Array, Uint16Array, Uint32Array, Float64Array, DataView, ArrayBuffer,
    Map, Set, Symbol, Error, TypeError, RangeError, JSON, parseInt, parseFloat, isNaN, isFinite, TextEncoder, TextDecoder,
  });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.Prism = { manual: true };

  const libs = [
    'suncalc.min.js', 'codejar.min.js', 'qrcodegen.min.js', 'ts-fsrs.umd.js',
    'minisearch.min.js', 'papaparse.min.js', 'purify.min.js', 'diff.min.js',
    'fflate.min.js', 'rough.min.js', 'sortable.min.js', 'uplot.min.js',
    'jsqr.min.js', 'graphre.min.js', 'nomnoml.min.js', 'chrono.min.js',
    'otpauth.min.js', 'exifr.min.js', 'readability.min.js', 'fraction.min.js',
    'colord.min.js', 'midi.min.js', 'panzoom.min.js', 'split.min.js',
    'confetti.min.js', 'prism.min.js', 'jsbarcode.min.js', 'js-yaml.min.js',
    'ical.min.js', 'temml.min.js', 'franc.min.js',
  ];
  for (const f of libs) {
    vm.runInContext(rd(path.join('web', 'vendor', 'micro', f)), ctx, { filename: f });
  }
  vm.runInContext(rd('web/js/micro.js'), ctx, { filename: 'micro.js' });
  vm.runInContext(rd('web/js/md.js'), ctx, { filename: 'md.js' });
  vm.runInContext(rd('web/js/remind.js'), ctx, { filename: 'remind.js' });

  ok('micro JS: SunCalc computes golden hour times', !!ctx.SunCalc.getTimes(new Date('2026-06-21T12:00:00Z'), 40.71, -74.01).goldenHour);
  ok('micro JS: QR generator builds clean SVG via A.micro.qrSvg', /^<svg[\s\S]*<\/svg>$/.test(ctx.A.micro.qrSvg('http://127.0.0.1:47231')));
  ok('micro JS: ts-fsrs schedules next review interval', ctx.FSRS.fsrs().repeat(ctx.FSRS.createEmptyCard(), new Date())[ctx.FSRS.Rating.Good].card.due instanceof Date);
  const ms = new ctx.MiniSearch({ fields: ['title'], storeFields: ['id'], searchOptions: { fuzzy: 0.3 } });
  ms.addAll([{ id: '1', title: 'Settings' }, { id: '2', title: 'Calculator' }]);
  ok('micro JS: MiniSearch matches typos (setings -> Settings)', ms.search('setings').some(h => h.id === '1'));
  ok('micro JS: PapaParse parses quoted CSV cleanly', ctx.Papa.parse('2026-11-19,-12.50,"Dining, out","coffee"').data[0][2] === 'Dining, out');
  ok('micro JS: jsdiff renders line diff HTML', /\+1 added/.test(ctx.A.micro.diffHtml('a\nb\n', 'a\nc\n')));
  const zipped = ctx.fflate.zipSync({ 'hi.txt': new Uint8Array([104, 105]) });
  ok('micro JS: fflate zips and unzips round-trip', Buffer.from(ctx.fflate.unzipSync(zipped)['hi.txt']).toString() === 'hi');
  ok('micro JS: nomnoml renders diagram SVG', /<svg[\s\S]*<\/svg>/.test(ctx.A.micro.renderNomnoml('[A] -> [B]')));
  ok('micro JS: rough, CodeJar, jsQR, Sortable, uPlot, DOMPurify loaded',
    !!ctx.rough && typeof ctx.CodeJar === 'function' && typeof ctx.jsQR === 'function' &&
    typeof ctx.Sortable === 'function' && typeof ctx.uPlot === 'function' && typeof ctx.DOMPurify === 'function');
  const rem = ctx.A.remind.parse('remind me to renew passport 2 weeks from now at 10am', new Date('2026-11-19T12:00:00'));
  ok('micro JS: chrono powers natural-language fallback in A.remind.parse', !!rem && rem.at > new Date('2026-12-01').getTime(), JSON.stringify(rem));

  /* Round 2 checks */
  const totp = new ctx.OTPAuth.TOTP({ secret: ctx.OTPAuth.Secret.fromBase32('JBSWY3DPEHPK3PXP') }).generate();
  ok('micro JS R2: OTPAuth generates 6-digit TOTP codes offline', /^\d{6}$/.test(totp), totp);
  ok('micro JS R2: Fraction computes exact mixed fractions', new ctx.Fraction(5, 4).toFraction(true) === '1 1/4');
  ok('micro JS R2: colord converts colors cleanly', ctx.colord('#ff6b81').toHex() === '#ff6b81');
  const midi = new ctx.Midi(); midi.addTrack().addNote({ midi: 60, time: 0, duration: 0.5 });
  ok('micro JS R2: @tonejs/midi builds and serializes MIDI bytes', midi.toArray().length > 20);
  ok('micro JS R2: js-yaml parses and dumps YAML', ctx.jsyaml.load('name: moundshroud\ncount: 3').count === 3);
  const ical = ctx.ICAL.parse('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Test\r\nDTSTART:20261119T120000Z\r\nEND:VEVENT\r\nEND:VCALENDAR');
  ok('micro JS R2: ical.js parses VCALENDAR events', new ctx.ICAL.Component(ical).getFirstSubcomponent('vevent').getFirstPropertyValue('summary') === 'Test');
  const mathHtml = ctx.md('Energy: $E = mc^2$');
  ok('micro JS R2: Temml renders inline LaTeX math in md()', /<math\b/.test(mathHtml), mathHtml.slice(0, 120));
  const codeHtml = ctx.md('```js\nconst x = 42;\n```');
  ok('micro JS R2: Prism highlights fenced code blocks in md()', /class="token keyword"/.test(codeHtml), codeHtml.slice(0, 140));
  const fr = ctx.A.micro.detectLang('Bonjour tout le monde, comment allez-vous aujourd hui?');
  ok('micro JS R2: franc detects language offline', !!fr && fr.code === 'fra', JSON.stringify(fr));
  ok('micro JS R2: exifr, Readability, Panzoom, Split, confetti, JsBarcode loaded',
    !!ctx.exifr && typeof ctx.Readability === 'function' && typeof ctx.Panzoom === 'function' &&
    typeof ctx.Split === 'function' && typeof ctx.confetti === 'function' && typeof ctx.JsBarcode === 'function');
};
