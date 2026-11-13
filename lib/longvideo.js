// Long videos: any length, made shot by shot on this PC and joined into one MP4.
// The video model (Wan 2.1, 1.3B) makes 1 to 2 seconds per shot. Each shot is saved as numbered pictures; with the
// continuation model (Wan 2.1 VACE 1.3B, imggen\models\video) every shot after the first starts from the last picture of
// the shot before, so the video flows on instead of cutting. ffmpeg then joins every picture into one H.264 MP4.
// Jobs live here on the server, so they keep going while you use the rest of the app (the server stays up while one runs).
// A job that was cut off (Moundshroud was closed) keeps its finished shots and can be resumed from where it stopped.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..'), SD = path.join(ROOT, 'imggen', 'bin', 'sd-cli.exe'), VDIR = path.join(ROOT, 'imggen', 'models', 'video');
const M = { t2v: path.join(VDIR, 'wan2.1_t2v_1.3B_fp16.safetensors'), vace: path.join(VDIR, 'wan2.1_vace_1.3B_fp16.safetensors'), vae: path.join(VDIR, 'wan_2.1_vae.safetensors'), t5: path.join(VDIR, 'umt5-xxl-encoder-Q5_K_M.gguf') };
const SIZES = { '416x240x17': [416, 240, 17], '624x352x17': [624, 352, 17], '624x352x33': [624, 352, 33], '832x480x33': [832, 480, 33], '416x240x33': [416, 240, 33] };
const FPS = 16, NEG = 'overexposed, static, blurred details, subtitles, text, still picture, worst quality, low quality, JPEG artifacts, ugly, deformed, extra fingers, badly drawn hands, badly drawn face, fused fingers, cluttered background';
const has = p => { try { return fs.existsSync(p); } catch (e) { return false; } };

/* ffmpeg: one next to the picture engine, or the first one Windows can find */
let ffCache = null;
function ffmpeg() {
  if (ffCache !== null) return ffCache;
  const local = path.join(ROOT, 'imggen', 'bin', 'ffmpeg.exe'); if (has(local)) return (ffCache = local);
  try { const out = cp.execFileSync('where', ['ffmpeg'], { encoding: 'utf8', windowsHide: true, timeout: 5000 }).split(/\r?\n/).map(s => s.trim()).filter(Boolean); return (ffCache = out[0] || ''); } catch (e) { return (ffCache = ''); }
}
const ready = () => ({ video: has(SD) && has(M.t2v) && has(M.vae) && has(M.t5), smooth: has(M.vace), ffmpeg: !!ffmpeg() });

function create(deps) {
  const dir = path.join(deps.dataDir, 'videos'), file = path.join(dir, 'jobs.json');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
  let J = load(), cur = null;
  function load() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return []; } }
  function save() { const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(J.slice(0, 50), null, 1)); fs.renameSync(t, file); }
  /* a job that was running when Moundshroud closed can be resumed */
  J.forEach(j => { if (j.state === 'running' || j.state === 'queued') { j.state = 'interrupted'; j.note = 'Moundshroud was closed while this was being made. Press Resume to carry on from shot ' + (j.done + 1) + '.'; } }); save();
  const jdir = j => path.join(dir, j.id), sdir = (j, i) => path.join(jdir(j), 's' + String(i).padStart(4, '0'));
  const pngs = d => { try { return fs.readdirSync(d).filter(f => /\.png$/i.test(f)).sort(); } catch (e) { return []; } };

  function start(o) {
    const r = ready(); if (!r.video) return { ok: false, error: 'The video model is not installed (install-video-model.ps1).' };
    if (!r.ffmpeg) return { ok: false, error: 'ffmpeg is needed to join the shots and was not found on this PC.' };
    const shots = (Array.isArray(o.shots) ? o.shots : []).map(s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 400)).filter(Boolean).slice(0, 1800);
    if (!shots.length) return { ok: false, error: 'There are no shots to make.' };
    const sz = SIZES[o.size] || SIZES['416x240x17'];
    const j = { id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'), title: String(o.title || shots[0]).slice(0, 120), shots, w: sz[0], h: sz[1], frames: sz[2], smooth: !!o.smooth && r.smooth, seed: Number.isFinite(+o.seed) ? Math.floor(+o.seed) : Math.floor(Math.random() * 2e9), state: 'queued', done: 0, total: shots.length, note: 'Waiting to start…', err: '', created: Date.now(), secsPerShot: 0, file: '' };
    J.unshift(j); save(); pump(); return { ok: true, id: j.id };
  }
  function resume(id) { const j = J.find(x => x.id === id); if (!j) return { ok: false, error: 'No such video.' }; if (!['interrupted', 'stopped', 'failed'].includes(j.state)) return { ok: false, error: 'It is not stopped.' }; j.state = 'queued'; j.err = ''; j.note = 'Waiting to start…'; save(); pump(); return { ok: true }; }
  function stop(id) { const j = J.find(x => x.id === id); if (!j) return { ok: false, error: 'No such video.' }; if (cur && cur.j === j) { cur.stop = true; try { cp.spawnSync('taskkill', ['/PID', String(cur.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } } if (j.state === 'queued') j.state = 'stopped'; j.note = 'Stopped after ' + j.done + ' of ' + j.total + ' shots. Resume carries on.'; save(); return { ok: true }; }
  function remove(id) { const j = J.find(x => x.id === id); if (!j) return { ok: true }; if (cur && cur.j === j) return { ok: false, error: 'It is being made. Stop it first.' }; try { fs.rmSync(jdir(j), { recursive: true, force: true }); } catch (e) { } J = J.filter(x => x !== j); save(); return { ok: true }; }
  const status = id => { const j = J.find(x => x.id === id); return j ? Object.assign({}, j, { shots: undefined, prompt: j.shots[0], left: j.secsPerShot ? Math.round((j.total - j.done) * j.secsPerShot) : 0 }) : null; };

  const run = (args, ms) => new Promise(done => {
    let p; try { p = cp.spawn(SD, args, { cwd: path.dirname(SD), windowsHide: true, stdio: 'ignore' }); } catch (e) { return done(false); }
    if (cur) cur.pid = p.pid;
    const k = setTimeout(() => { try { cp.spawnSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } }, ms);
    p.on('error', () => { clearTimeout(k); done(false); }); p.on('close', code => { clearTimeout(k); done(code === 0); });
  });
  /* one shot: the first from words alone; later ones (smooth) from the last picture of the shot before */
  function shotArgs(j, i, out) {
    const prev = i > 0 && j.smooth ? pngs(sdir(j, i - 1)) : [], from = prev.length ? path.join(sdir(j, i - 1), prev[prev.length - 1]) : '';
    const a = ['-M', 'vid_gen', '--diffusion-model', from ? M.vace : M.t2v, '--vae', M.vae, '--t5xxl', M.t5, '-p', j.shots[i], '-n', NEG, '--cfg-scale', '6.0', '--sampling-method', 'euler',
      '-W', String(j.w), '-H', String(j.h), '--video-frames', String(j.frames), '--flow-shift', '3.0', '-s', String((j.seed + i) % 2147483647), '--vae-tiling', '--offload-to-cpu', '-o', path.join(out, 'f_%03d.png')];
    if (from) a.push('-i', from);
    return a;
  }
  async function make(j) {
    j.state = 'running'; save();
    for (let i = j.done; i < j.total; i++) {
      if (cur.stop) break;
      const out = sdir(j, i); try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) { } fs.mkdirSync(out, { recursive: true });
      j.note = 'Shot ' + (i + 1) + ' of ' + j.total + ': ' + j.shots[i].slice(0, 80); save();
      while (deps.media.busy.image || deps.media.busy.video) { if (cur.stop) break; await new Promise(r => setTimeout(r, 3000)); }      /* the graphics card does one thing at a time */
      if (cur.stop) break;
      deps.media.busy.video = true; const t0 = Date.now(); let ok = false;
      try { await deps.media.unloadOllama(); ok = await run(shotArgs(j, i, out), 40 * 60000); } finally { deps.media.busy.video = false; }
      if (cur.stop) break;
      if (!ok || !pngs(out).length) { j.state = 'failed'; j.err = 'Shot ' + (i + 1) + ' could not be made. Close other heavy programs (games, VMs) and press Resume.'; j.note = j.err; save(); return; }
      const secs = (Date.now() - t0) / 1000; j.secsPerShot = j.secsPerShot ? j.secsPerShot * .7 + secs * .3 : secs; j.done = i + 1; save();
    }
    if (cur.stop) { j.state = 'stopped'; j.note = 'Stopped after ' + j.done + ' of ' + j.total + ' shots. Resume carries on.'; save(); return; }
    /* join: every picture in order (a smooth shot's first picture repeats the last one before it, so it is skipped) */
    j.note = 'Joining ' + j.total + ' shots into one video…'; save();
    const all = path.join(jdir(j), 'all'); try { fs.rmSync(all, { recursive: true, force: true }); } catch (e) { } fs.mkdirSync(all);
    let n = 0; for (let i = 0; i < j.total; i++) { const ps = pngs(sdir(j, i)); ps.forEach((f, k) => { if (k === 0 && i > 0 && j.smooth) return; fs.copyFileSync(path.join(sdir(j, i), f), path.join(all, String(++n).padStart(6, '0') + '.png')); }); }
    const mp4 = path.join(jdir(j), 'video.mp4');
    const ok = await new Promise(done => { const p = cp.spawn(ffmpeg(), ['-y', '-framerate', String(FPS), '-i', path.join(all, '%06d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], { windowsHide: true, stdio: 'ignore' }); p.on('error', () => done(false)); p.on('close', c => done(c === 0 && has(mp4))); });
    if (!ok) { j.state = 'failed'; j.err = 'The shots were made but could not be joined (ffmpeg failed). Press Resume to try the joining again.'; j.note = j.err; save(); return; }
    try { fs.rmSync(all, { recursive: true, force: true }); for (let i = 0; i < j.total; i++) fs.rmSync(sdir(j, i), { recursive: true, force: true }); } catch (e) { }
    j.state = 'done'; j.file = 'video.mp4'; j.frames_total = n; j.seconds = Math.round(n / FPS); j.note = 'Done: ' + j.seconds + ' seconds.'; j.finished = Date.now(); save();
  }
  async function pump() {
    if (cur) return; const j = J.slice().reverse().find(x => x.state === 'queued'); if (!j) return;
    cur = { j, stop: false, pid: 0 };
    try { await make(j); } catch (e) { j.state = 'failed'; j.err = String(e.message || e); j.note = j.err; save(); }
    cur = null; pump();
  }
  const fileOf = id => { const j = J.find(x => x.id === id); if (!j || j.state !== 'done') return ''; const f = path.join(jdir(j), 'video.mp4'); return has(f) ? f : ''; };
  return { _t: { shotArgs, sdir }, start, resume, stop, remove, status, list: () => J.map(j => status(j.id)), fileOf, busy: () => !!cur, ready, shutdown: () => { if (cur) { cur.stop = true; try { cp.spawnSync('taskkill', ['/PID', String(cur.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { } } } };
}

module.exports = { create, ready, SIZES, FPS };
