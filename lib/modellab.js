// Model Lab: make a local model stronger at a task without a GPU. It writes an Ollama Modelfile from a base model,
// a system prompt, parameters and your own example answers, then runs `ollama create` to bake a new named model that
// the whole app can use. The recipe is saved so you can tweak and rebuild. (Real GPU fine-tuning is a heavier, future option.)
const cp = require('child_process'), path = require('path'), fs = require('fs'), http = require('http');
const modelOrder = require('./model-order');
const OLLAMA_EXE = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
const ollama = fs.existsSync(OLLAMA_EXE) ? OLLAMA_EXE : 'ollama';
let DATA = path.join(__dirname, '..', 'data');
const recipeFile = () => path.join(DATA, 'model-lab.json');
const mfDir = () => { const d = path.join(DATA, 'modellab'); fs.mkdirSync(d, { recursive: true }); return d; };
const cleanName = s => String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^-+/, '').slice(0, 40) || 'my-model';

function readRecipes() { try { return JSON.parse(fs.readFileSync(recipeFile(), 'utf8')); } catch (e) { return { recipes: {} }; } }
function saveRecipes(r) { fs.writeFileSync(recipeFile(), JSON.stringify(r, null, 1)); }
function renameRecipe(from, to) {
  const all = readRecipes(), a = String(from || '').replace(/:latest$/, ''), b = String(to || '').replace(/:latest$/, '');
  if (a === b || !all.recipes[a]) return false;
  all.recipes[b] = all.recipes[a]; delete all.recipes[a]; saveRecipes(all); return true;
}

function tags() {
  return new Promise(res => {
    http.get('http://127.0.0.1:11434/api/tags', r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b).models || []); } catch (e) { res([]); } }); }).on('error', () => res([]));
  });
}
async function models() {
  const t = await tags(), mine = readRecipes().recipes;
  const list = t.map(m => ({ name: m.name, size: m.size || 0, custom: !!mine[m.name.replace(/:latest$/, '')] || !!mine[m.name] }));
  return modelOrder.sortModels(list, modelOrder.getDefault(DATA));
}

function buildModelfile(r) {
  const q3 = s => String(s == null ? '' : s).replace(/"""/g, '\\"\\"\\"');
  let mf = 'FROM ' + r.base + '\n';
  if (r.system && r.system.trim()) mf += 'SYSTEM """' + q3(r.system.trim()) + '"""\n';
  const temp = Math.max(0, Math.min(2, +r.temperature)); if (!isNaN(temp)) mf += 'PARAMETER temperature ' + temp + '\n';
  const ctx = parseInt(r.num_ctx); if (ctx >= 512) mf += 'PARAMETER num_ctx ' + ctx + '\n';
  for (const ex of (r.examples || [])) { if (ex && ex.u && ex.a) mf += 'MESSAGE user """' + q3(ex.u) + '"""\nMESSAGE assistant """' + q3(ex.a) + '"""\n'; }
  return mf;
}

function build(r) {
  return new Promise(res => {
    const name = cleanName(r.name); if (!r || !r.base) return res({ ok: false, error: 'Pick a base model.' });
    const mf = buildModelfile(r), file = path.join(mfDir(), name + '.Modelfile');
    try { fs.writeFileSync(file, mf); } catch (e) { return res({ ok: false, error: 'Could not write the Modelfile: ' + e.message }); }
    cp.execFile(ollama, ['create', name, '-f', file], { windowsHide: true, timeout: 180000, maxBuffer: 4e6 }, (err, so, se) => {
      const log = ((so || '') + (se || '')).slice(-1500);
      if (err) return res({ ok: false, error: 'ollama create failed. ' + (se || err.message).slice(0, 300), log });
      const all = readRecipes(); all.recipes[name] = { base: r.base, system: r.system || '', temperature: +r.temperature, num_ctx: parseInt(r.num_ctx) || 0, examples: (r.examples || []).filter(e => e && e.u && e.a).slice(0, 50), built: new Date().toISOString() };
      saveRecipes(all);
      try { require('./lmstudio-sync').syncAll(); } catch (e) { }
      res({ ok: true, name, log: log || 'Model "' + name + '" is ready.' });
    });
  });
}
function remove(name) {
  return new Promise(res => {
    const n = String(name || ''); if (!/^[a-z0-9][a-z0-9._:-]{0,50}$/i.test(n)) return res({ ok: false, error: 'bad name' });
    cp.execFile(ollama, ['rm', n], { windowsHide: true, timeout: 30000 }, err => {
      const all = readRecipes(); delete all.recipes[n.replace(/:latest$/, '')]; delete all.recipes[n]; saveRecipes(all);
      if (!err) try { require('./lmstudio-sync').removeModel(n); } catch (e) { }
      res({ ok: !err, error: err ? err.message.slice(0, 200) : '' });
    });
  });
}
function setData(d) { DATA = d; }
module.exports = { models, recipes: () => readRecipes().recipes, build, remove, renameRecipe, setData, buildModelfile };
