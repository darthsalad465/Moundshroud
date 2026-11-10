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

const busy = { image: false, music: false, video: false };
const has = p => { try { return fs.existsSync(p); } catch (e) { return false; } };
const sdModel = () => has(SD_Q8) ? { file: SD_Q8, args: [] } : { file: SD_FULL, args: ['--type', 'q8_0'] };
const voices = () => { try { return has(PIPER) ? fs.readdirSync(VOICES).filter(f => /\.onnx$/.test(f) && has(path.join(VOICES, f + '.json'))).map(f => f.replace(/\.onnx$/, '')) : []; } catch (e) { return []; } };
const ready = () => ({
  image: has(SD_EXE) && has(sdModel().file),
  music: has(MG_PY) && has(MG_GEN) && has(MG_MODEL),
  voice: voices().length > 0,
  video: has(SD_EXE) && has(VID.model) && has(VID.vae) && has(VID.t5),
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

module.exports = { image, music, voice, video, videoArgs, clamp, ready, voices, unloadOllama, busy, VID, VID_DEFAULT };
