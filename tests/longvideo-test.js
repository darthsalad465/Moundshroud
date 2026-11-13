// Long videos (lib/longvideo.js): jobs are checked, a cut-off job can be resumed, and every shot after the first starts
// from the last picture of the shot before (smooth). No video is made here.
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const L = require(path.join(__dirname, '..', 'lib', 'longvideo.js'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-lv-'));
  fs.mkdirSync(path.join(dir, 'videos'), { recursive: true });
  /* a job that was running when Moundshroud closed */
  fs.writeFileSync(path.join(dir, 'videos', 'jobs.json'), JSON.stringify([{ id: 'abc', title: 't', shots: ['a', 'b', 'c'], w: 416, h: 240, frames: 17, smooth: true, seed: 5, state: 'running', done: 1, total: 3, note: '', err: '', created: 1 }]));
  const media = { busy: { image: false, video: false }, unloadOllama: async () => { } };
  const lv = L.create({ dataDir: dir, media });
  const s = lv.status('abc');
  ok('long video: a job cut off by closing is marked so it can be resumed', s && s.state === 'interrupted' && /shot 2/.test(s.note), JSON.stringify(s));
  ok('long video: there is no status for an unknown job', lv.status('nope') === null);
  if (L.ready().video && L.ready().ffmpeg) ok('long video: a job with no shots is refused', !lv.start({ shots: [] }).ok);
  /* the first shot is made from words; the next starts from the last picture of the one before */
  const j = { id: 'abc', shots: ['a fox', 'the fox walks on'], w: 416, h: 240, frames: 17, smooth: true, seed: 5 };
  const d0 = lv._t.sdir(j, 0); fs.mkdirSync(d0, { recursive: true }); ['f_001.png', 'f_002.png', 'f_017.png'].forEach(f => fs.writeFileSync(path.join(d0, f), 'x'));
  const a0 = lv._t.shotArgs(j, 0, 'out'), a1 = lv._t.shotArgs(j, 1, 'out');
  ok('long video: the first shot uses the text-to-video model and no start picture', a0.includes('-M') && !a0.includes('-i') && a0[a0.indexOf('--diffusion-model') + 1].includes('t2v'));
  ok('long video: a smooth shot starts from the last picture of the shot before', a1[a1.indexOf('-i') + 1] === path.join(d0, 'f_017.png') && a1[a1.indexOf('--diffusion-model') + 1].includes('vace'));
  ok('long video: shots without "smooth" never use a start picture', !lv._t.shotArgs(Object.assign({}, j, { smooth: false }), 1, 'out').includes('-i'));
  ok('long video: each shot gets its own seed', a0[a0.indexOf('-s') + 1] !== a1[a1.indexOf('-s') + 1]);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
};
