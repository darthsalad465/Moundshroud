// Voice input: a local speech-to-text worker (whisper.cpp). Starts on first use, stops with the app.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..');
const PY = path.join(ROOT, 'pyenv', 'Scripts', 'python.exe'), WORKER = path.join(ROOT, 'py', 'voiceworker.py'), MODEL = path.join(ROOT, 'voice', 'ggml-base.en.bin');
let proc = null, ready = null, queue = [], buf = '', using = '';

const available = () => fs.existsSync(PY) && fs.existsSync(MODEL) && fs.existsSync(WORKER);
/* model: any whisper.cpp model (ggml-*.bin) chosen from the model catalog; the worker restarts when it changes */
function start(model) {
  const want = model && fs.existsSync(model) ? model : MODEL;
  if (ready && using !== want) stop();
  if (ready) return ready;
  using = want;
  ready = new Promise((resolve, reject) => {
    proc = cp.spawn(PY, [WORKER, using], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', d => {
      buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1); let j; try { j = JSON.parse(line); } catch (e) { continue; }
        if (j.ready) { resolve(true); continue; }
        const w = queue.shift(); if (w) w.res(j);
      }
    });
    proc.on('exit', () => { proc = null; ready = null; for (const w of queue.splice(0)) w.res({ error: 'speech engine stopped' }); reject(new Error('stopped')); });
    setTimeout(() => reject(new Error('speech engine did not start')), 60000);
  });
  ready.catch(() => {});
  return ready;
}
async function transcribe(wavBuffer, model) {
  if (!(fs.existsSync(PY) && fs.existsSync(WORKER) && (fs.existsSync(MODEL) || (model && fs.existsSync(model))))) return { error: 'Voice input is not installed' };
  const f = path.join(os.tmpdir(), 'assistant-voice-' + Date.now() + '.wav');
  fs.writeFileSync(f, wavBuffer);
  try {
    await start(model);
    return await new Promise(res => { queue.push({ res }); proc.stdin.write(f + '\n'); setTimeout(() => res({ error: 'timed out' }), 90000); });
  } catch (e) { return { error: String(e.message) }; }
  finally { try { fs.unlinkSync(f); } catch (e) {} }
}
function stop() { if (proc && proc.pid) { try { cp.spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) {} proc = null; ready = null; } }
module.exports = { transcribe, available, stop };
