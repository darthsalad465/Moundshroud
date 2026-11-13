// The offline media engines in one place: pictures (SDXL Turbo), music (MusicGen), voices (Piper) and short video
// clips (Wan 2.1). Each function writes one file and says how it went; the server's routes and the swarm's steps
// both call them. Every engine runs one job at a time, because the graphics card holds one model at a time.
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http'), cp = require('child_process');

const ROOT = path.join(__dirname, '..'), OLLAMA = { host: '127.0.0.1', port: 11434 };
const SD_EXE = path.join(ROOT, 'imggen', 'bin', 'sd-cli.exe'), SD_Q8 = path.join(ROOT, 'imggen', 'models', 'sd_xl_turbo_1.0_q8_0.gguf'), SD_FULL = path.join(ROOT, 'imggen', 'models', 'sd_xl_turbo_1.0_fp16.safetensors');
const MG_PY = path.join(ROOT, 'musicgen', 'venv', 'Scripts', 'python.exe'), MG_GEN = path.join(ROOT, 'musicgen', 'gen.py'), MG_MODEL = path.join(ROOT, 'musicgen', 'models', 'musicgen-small', 'config.json');
const PIPER = path.join(ROOT, 'piper', 'bin', 'piper.exe'), VOICES = path.join(ROOT, 'piper', 'voices');
/* the video model: Wan 2.1 text-to-video, 1.3 billion parameters, run by the same engine as the pictures (install-video-model.ps1) */
const VID_DIR = path.join(ROOT, 'imggen', 'models', 'video');
const VID = { model: path.join(VID_DIR, 'wan2.1_t2v_1.3B_fp16.safetensors'), vae: path.join(VID_DIR, 'wan_2.1_vae.safetensors'), t5: path.join(VID_DIR, 'umt5-xxl-encoder-Q5_K_M.gguf') };
/* what the Wan model is told to avoid (the list its makers publish, in English) */
const VID_NEG = 'overexposed, static, blurred details, subtitles, text, still picture, grey, worst quality, low quality, JPEG artifacts, ugly, deformed, extra fingers, badly drawn hands, badly drawn face, fused fingers, cluttered background, three legs, walking backwards';
const VID_DEFAULT = { w: 416, h: 240, frames: 17 };
/* the photo-edit model: FLUX.1 Kontext dev (4-bit) with its text encoders and decoder, in imggen\models\kontext.
   It changes what you ask for and keeps the rest of the photo. Without it, edits use SDXL Turbo redrawing the photo (img2img). */
const KON_DIR = path.join(ROOT, 'imggen', 'models', 'kontext');
const KON = { model: path.join(KON_DIR, 'flux1-kontext-dev-Q4_K_S.gguf'), vae: path.join(KON_DIR, 'ae.safetensors'), clip: path.join(KON_DIR, 'clip_l.safetensors'), t5: path.join(KON_DIR, 't5-v1_1-xxl-encoder-Q4_K_M.gguf') };

const busy = { image: false, music: false, video: false };
const has = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const sdModel = () => has(SD_Q8) ? { file: SD_Q8, args: [] } : { file: SD_FULL, args: ['--type', 'q8_0'] };
const voices = () => { try { return has(PIPER) ? fs.readdirSync(VOICES).filter(f => /\.onnx$/.test(f) && has(path.join(VOICES, f + '.json'))).map(f => f.replace(/\.onnx$/, '')) : []; } catch (e) { return []; } };
const ready = () => ({
  image: has(SD_EXE) && has(sdModel().file),
  music: has(MG_PY) && has(MG_GEN) && has(MG_MODEL),
  voice: voices().length > 0,
  video: has(SD_EXE) && has(VID.model) && has(VID.vae) && has(VID.t5),
  edit: has(SD_EXE) && has(KON.model) && has(KON.vae) && has(KON.clip) && has(KON.t5),
});

/* the limits every request is held to, whoever sends it */
const line = (s, n) => String(s || '').replace(/[\r\n\0]+/g, ' ').trim().slice(0, n);
const seedOf = v => Number.isFinite(+v) && +v >= 0 && v !== '' && v != null ? Math.floor(+v) % 2147483647 : Math.floor(Math.random() * 2147483647);
const step = (v, d, lo, hi, by) => Math.max(lo, Math.min(hi, Math.round((+v || d) / by) * by));
const clamp = {
  image: b => ({ prompt: line(b.prompt, 400), neg: line(b.neg, 200), w: step(b.w, 512, 256, 768, 64), h: step(b.h, 512, 256, 768, 64), steps: Math.max(1, Math.min(6, Math.round(+b.steps || 2))), seed: seedOf(b.seed) }),
  music: b => ({ prompt: line(b.prompt, 300), seconds: Math.max(5, Math.min(30, Math.round(+b.seconds || 15))), seed: seedOf(b.seed) }),
  voice: b => ({ voice: String(b.voice || ''), text: String(b.text || '').slice(0, 1500).replace(/\s+/g, ' ').trim(), length: Math.min(2.5, Math.max(0.4, +b.length || 1)) }),
  /* Wan wants sizes in multiples of 16 and a frame count of the form 4n+1 */
  video: b => ({ prompt: line(b.prompt, 400), neg: line(b.neg, 300), w: step(b.w, VID_DEFAULT.w, 256, 832, 16), h: step(b.h, VID_DEFAULT.h, 144, 480, 16), frames: Math.max(5, Math.min(33, Math.round(((+b.frames || VID_DEFAULT.frames) - 1) / 4) * 4 + 1)), seed: seedOf(b.seed) }),
};

/* the engines need the graphics card's memory, so ask Ollama to let go of any model it is holding (it reloads by itself the next time you chat) */
const unloadOllama = () => new Promise(done => {
  let fin = false; const end = () => { if (!fin) { fin = true; done(); } };
  const q = http.request({ ...OLLAMA, path: '/api/ps', method: 'GET' }, r => {
    let t = ''; r.on('data', c => t += c); r.on('end', () => {
      try {
        const ms = (JSON.parse(t).models || []).map(m => m.name); let n = ms.length; if (!n) return end();
        ms.forEach(name => { const p = JSON.stringify({ model: name, keep_alive: 0 }); const g = http.request({ ...OLLAMA, path: '/api/generate', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, x => { x.resume(); x.on('end', () => { if (!--n) setTimeout(end, 600); }); }); g.on('error', () => { if (!--n) end(); }); g.end(p); });
      } catch (e) { end(); }
    });
  });
  q.on('error', end); q.setTimeout(3000, () => { q.destroy(); end(); }); q.end();
});

/* runs one engine process to the end; true when it left the file it was asked for */
const proc = (exe, args, opts, out, ms, signal) => new Promise(done => {
  let pr; try { pr = cp.spawn(exe, args, Object.assign({ windowsHide: true, stdio: 'ignore' }, opts)); } catch (e) { return done(false); }
  const stop = () => { try { cp.spawnSync('taskkill', ['/PID', String(pr.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { try { pr.kill(); } catch (x) { } } };
  const k = setTimeout(stop, ms);
  if (signal) { if (signal.aborted) stop(); else signal.addEventListener('abort', stop); }
  pr.on('error', () => { clearTimeout(k); done(false); });
  pr.on('close', code => { clearTimeout(k); done(code === 0 && has(out)); });
});
const tmp = (kind, ext) => path.join(os.tmpdir(), 'moundshroud-' + kind + '-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + ext);
const no = (code, error) => ({ ok: false, code, error });

/* a picture; o.out is where to write it (a temporary file when left out) */
async function image(o) {
  if (!ready().image) return no(404, 'The image model is not installed. Run install-art-model.ps1 (or use the Qwen drawing option).');
  if (busy.image || busy.video) return no(429, 'A picture is already being made. Wait for it to finish.');
  const c = clamp.image(o || {}); if (!c.prompt) return no(400, 'Type what to draw.');
  busy.image = true; const out = (o && o.out) || tmp('art', '.png'); let ok = false;
  try {
    await unloadOllama();
    const M = sdModel(), args = ['-m', M.file, ...M.args, '-p', c.prompt, '--steps', String(c.steps), '--cfg-scale', '1.0', '-W', String(c.w), '-H', String(c.h), '-s', String(c.seed), '--sampling-method', 'euler_a', '--vae-tiling', '-o', out]; if (c.neg) args.push('-n', c.neg);
    const run = extra => proc(SD_EXE, args.concat(extra), { cwd: path.dirname(SD_EXE) }, out, 240000, o && o.signal);
    ok = await run([]); if (!ok) { await unloadOllama(); ok = await run([]); } if (!ok) ok = await run(['--backend', 'cpu']);
  } catch (e) { ok = false; } finally { busy.image = false; }
  if (!ok) { fs.unlink(out, () => { }); return no(500, 'The picture could not be made. Close other heavy programs (games, VMs) and try again.'); }
  return { ok: true, file: out, seed: c.seed };
}

/* an edited photo. o.input is the photo (a file, already sized to o.w x o.h by the page); o.engine 'kontext' (precise edit,
   needs the edit model) or 'sd' (SDXL Turbo redraws the photo; o.strength 0.2-0.9 says how much may change) */
const editArgs = (c, input, out) => c.engine === 'kontext'
  ? ['--diffusion-model', KON.model, '--vae', KON.vae, '--clip_l', KON.clip, '--t5xxl', KON.t5, '-r', input, '-p', c.prompt, '--cfg-scale', '1.0', '--guidance', '2.5',
    '--sampling-method', 'euler', '--steps', String(c.steps), '-W', String(c.w), '-H', String(c.h), '-s', String(c.seed), '--offload-to-cpu', '--mmap', '--vae-tiling', '-o', out]      // the weights (about 9.6 GB) wait in memory; --mmap maps the file instead of copying it
  : ['-m', sdModel().file, ...sdModel().args, '-i', input, '--strength', String(c.strength), '-p', c.prompt, '--steps', String(c.steps), '--cfg-scale', '1.0',
    '-W', String(c.w), '-H', String(c.h), '-s', String(c.seed), '--sampling-method', 'euler_a', '--vae-tiling', '-o', out].concat(c.neg ? ['-n', c.neg] : []);
clamp.edit = b => {
  const engine = b.engine === 'kontext' ? 'kontext' : 'sd', strength = Math.max(0.2, Math.min(0.9, +b.strength || 0.55));
  return { engine, prompt: line(b.prompt, 500), neg: line(b.neg, 200), w: step(b.w, 512, 256, 1024, 16), h: step(b.h, 512, 256, 1024, 16), seed: seedOf(b.seed), strength,
    /* Turbo does about steps x strength real steps, so it needs a few more here; Kontext needs about 20 */
    steps: engine === 'kontext' ? Math.max(8, Math.min(28, Math.round(+b.steps || 20))) : Math.max(2, Math.min(8, Math.round(+b.steps || 4))) };
};
async function edit(o) {
  const c = clamp.edit(o || {}), r = ready();
  if (c.engine === 'kontext' && !r.edit) return no(404, 'The photo-edit model is not installed yet (imggen\\models\\kontext).');
  if (c.engine === 'sd' && !r.image) return no(404, 'The image model is not installed. Run install-art-model.ps1.');
  if (!o || !o.input || !has(o.input)) return no(400, 'No photo was given.');
  if (!c.prompt) return no(400, 'Say what to change.');
  if (busy.image || busy.video) return no(429, 'A picture is already being made. Wait for it to finish.');
  busy.image = true; const out = o.out || tmp('edit', '.png'), t = Date.now(); let ok = false;
  try {
    await unloadOllama();
    const run = extra => proc(SD_EXE, editArgs(c, o.input, out).concat(extra), { cwd: path.dirname(SD_EXE) }, out, c.engine === 'kontext' ? 20 * 60000 : 240000, o.signal);
    ok = await run([]); if (!ok && c.engine === 'sd' && !(o.signal && o.signal.aborted)) { await unloadOllama(); ok = await run([]); }      // a precise edit is not retried: a second try takes minutes and fails the same way when memory is short
  } catch (e) { ok = false; } finally { busy.image = false; }
  if (!ok) { fs.unlink(out, () => { }); return no(500, c.engine === 'kontext' ? 'The photo could not be edited. The precise edit needs about 10 GB of free memory (RAM): close virtual machines, games and big browser windows, then try again, or use Quick redraw.' : 'The photo could not be edited. Close other heavy programs (games, VMs) and try again.'); }
  return { ok: true, file: out, seed: c.seed, seconds: Math.round((Date.now() - t) / 1000), engine: c.engine };
}

/* a picture made by the edit model from words alone (FLUX.1 Kontext dev without a reference photo); slow, about 3 minutes at 512 */
async function flux(o) {
  if (!ready().edit) return no(404, 'The edit model is not installed.');
  if (busy.image || busy.video) return no(429, 'A picture is already being made. Wait for it to finish.');
  const c = clamp.edit(Object.assign({}, o, { engine: 'kontext' })); if (!c.prompt) return no(400, 'Type what to draw.');
  busy.image = true; const out = (o && o.out) || tmp('flux', '.png'), t = Date.now(); let ok = false;
  try { await unloadOllama(); const a = editArgs(c, '', out), i = a.indexOf('-r'); a.splice(i, 2); ok = await proc(SD_EXE, a, { cwd: path.dirname(SD_EXE) }, out, 20 * 60000, o && o.signal); }
  catch (e) { ok = false; } finally { busy.image = false; }
  if (!ok) { fs.unlink(out, () => { }); return no(500, 'The picture could not be made (the edit model needs about 10 GB of free memory).'); }
  return { ok: true, file: out, seed: c.seed, seconds: Math.round((Date.now() - t) / 1000) };
}

/* a music clip */
async function music(o) {
  if (!ready().music) return no(404, 'The AI music model is not installed. Run install-music-model.ps1 (Qwen can write the song instead).');
  if (busy.music) return no(429, 'Music is already being made. Wait for it to finish.');
  const c = clamp.music(o || {}); if (!c.prompt) return no(400, 'Describe the music first.');
  busy.music = true; const out = (o && o.out) || tmp('music', '.wav'); let ok = false;
  try {
    await unloadOllama();
    const run = extra => proc(MG_PY, [MG_GEN, '--prompt', c.prompt, '--seconds', String(c.seconds), '--seed', String(c.seed), '--out', out].concat(extra), { cwd: path.dirname(MG_GEN), stdio: ['ignore', 'ignore', fs.openSync(path.join(path.dirname(MG_GEN), 'last-error.log'), 'w')] }, out, 600000, o && o.signal);
    ok = await run([]); if (!ok) ok = await run(['--cpu']);
  } catch (e) { ok = false; } finally { busy.music = false; }
  if (!ok) { fs.unlink(out, () => { }); return no(500, 'The AI music model could not make that clip.'); }
  return { ok: true, file: out, seed: c.seed };
}

/* a spoken line */
function voice(o) {
  return new Promise(done => {
    const c = clamp.voice(o || {}), mdl = path.join(VOICES, c.voice + '.onnx');
    if (!/^[\w.-]+$/.test(c.voice) || !has(mdl) || !has(PIPER)) return done(no(404, 'no such voice'));
    if (!c.text) return done(no(400, 'no text'));
    const out = (o && o.out) || tmp('tts', '.wav');
    let pr; try { pr = cp.spawn(PIPER, ['--model', mdl, '--output_file', out, '--length_scale', String(c.length)], { cwd: path.dirname(PIPER), stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true }); } catch (e) { return done(no(500, 'voice engine failed')); }
    const kill = setTimeout(() => { try { pr.kill(); } catch (e) { } }, 30000);
    pr.on('error', () => { clearTimeout(kill); done(no(500, 'voice engine failed')); });
    pr.on('close', () => { clearTimeout(kill); done(has(out) ? { ok: true, file: out } : no(500, 'voice engine failed')); });
    pr.stdin.on('error', () => { }); pr.stdin.end(c.text + '\n');
  });
}

/* the command line for one video clip; c comes from clamp.video */
const videoArgs = (c, out) => ['-M', 'vid_gen', '--diffusion-model', VID.model, '--vae', VID.vae, '--t5xxl', VID.t5, '-p', c.prompt, '-n', c.neg || VID_NEG,
  '--cfg-scale', '6.0', '--sampling-method', 'euler', '-W', String(c.w), '-H', String(c.h), '--video-frames', String(c.frames), '--flow-shift', '3.0', '--fps', '16',
  '-s', String(c.seed), '--vae-tiling', '--offload-to-cpu', '-o', out];

/* a short silent video clip (.webm) */
async function video(o) {
  if (!ready().video) return no(404, 'The video model is not installed. Run install-video-model.ps1.');
  if (busy.video || busy.image) return no(429, 'A video or a picture is already being made. Wait for it to finish.');
  const c = clamp.video(o || {}); if (!c.prompt) return no(400, 'Describe the video first.');
  busy.video = true; const out = (o && o.out) || tmp('video', '.webm'), t = Date.now(); let ok = false;
  try { await unloadOllama(); ok = await proc(SD_EXE, videoArgs(c, out), { cwd: path.dirname(SD_EXE) }, out, 30 * 60000, o && o.signal); }
  catch (e) { ok = false; } finally { busy.video = false; }
  if (!ok) { fs.unlink(out, () => { }); return no(500, 'The video could not be made. Close other heavy programs (games, VMs) and try again.'); }
  return { ok: true, file: out, seed: c.seed, seconds: Math.round((Date.now() - t) / 1000) };
}

module.exports = { image, edit, flux, editArgs, music, voice, video, videoArgs, clamp, ready, voices, unloadOllama, busy, VID, VID_DEFAULT, KON };
