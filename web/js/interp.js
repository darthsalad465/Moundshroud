// The chat's code interpreter: Python (Pyodide, with numpy, pandas and matplotlib, in web/vendor/pyodide) and JavaScript,
// each run in a Web Worker that is sealed off before your code starts: no network (fetch only reaches the Python package
// folder, and only while Python loads its packages), no XMLHttpRequest, WebSocket, IndexedDB or caches, no loading of
// other scripts, and no access to the page, your files or Moundshroud's data. Files you attach to the chat are copied in
// (Python: /data/<name>). Every run has a time limit; a run that goes over is stopped by ending its worker.
// A.interp.run(lang, code, {files}) -> {ok, stdout, error, figures:[base64 png], ms}
(() => {
  const PY_TIME = 60000, JS_TIME = 10000;
  const SEAL = 'const __allow=self.__allow||"";const __f=self.fetch;self.fetch=function(u,o){const s=String(u&&u.url||u);if(__allow&&s.indexOf(__allow)===0)return __f.call(self,u,o);return Promise.reject(new Error("The sandbox has no network."));};' +
    '["XMLHttpRequest","WebSocket","EventSource","indexedDB","caches","importScripts","BroadcastChannel","SharedWorker","Worker"].forEach(function(k){try{Object.defineProperty(self,k,{value:undefined,configurable:false,writable:false});}catch(e){try{self[k]=undefined;}catch(x){}}});';

  /* ---------- Python ---------- */
  let py = null;      /* {w, ready: Promise, busy} */
  function pyWorker() {
    const base = location.origin + '/web/vendor/pyodide/';
    /* Python loads its engine with importScripts, so the worker seals itself the moment Python is ready, before any code runs */
    const src = 'importScripts(' + JSON.stringify(base + 'pyodide.js') + ');self.__allow=' + JSON.stringify(base) + ';function __seal(){' + SEAL + '}' +
      'let P=null,out=[],err=[];' +
      'const ready=loadPyodide({indexURL:' + JSON.stringify(base) + '}).then(async p=>{P=p;__seal();p.setStdout({batched:s=>out.push(s)});p.setStderr({batched:s=>err.push(s)});try{p.FS.mkdir("/data");}catch(e){}return true;});' +
      'self.onmessage=async e=>{const {id,code,files,collectFigures}=e.data;out=[];err=[];const t0=Date.now();let res={id};' +
      'try{await ready;' +
      '(files||[]).forEach(f=>{try{P.FS.writeFile("/data/"+f.name.replace(/[\\\\/:*?"<>|]/g,"_"),f.text);}catch(x){}});' +
      'await P.loadPackagesFromImports(code,{messageCallback:()=>{},errorCallback:()=>{}});' +
      'if(/matplotlib/.test(code)){await P.runPythonAsync("import matplotlib\\nmatplotlib.use(\\"AGG\\")");}' +
      'const v=await P.runPythonAsync(code);' +
      'let figs=[];if(collectFigures&&/matplotlib|plt\\./.test(code)){const r=await P.runPythonAsync("import io,base64\\nimport matplotlib.pyplot as _plt\\n_o=[]\\nfor _n in _plt.get_fignums():\\n    _b=io.BytesIO(); _plt.figure(_n).savefig(_b,format=\\"png\\",dpi=110,bbox_inches=\\"tight\\"); _o.append(base64.b64encode(_b.getvalue()).decode())\\n_plt.close(\\"all\\")\\n_o");figs=r.toJs();r.destroy&&r.destroy();}' +
      'let val=v===undefined||v===null?"":String(v);if(v&&v.destroy)v.destroy();' +
      'res={id,ok:true,stdout:out.join("\\n"),stderr:err.join("\\n"),value:val,figures:figs,ms:Date.now()-t0};' +
      '}catch(x){res={id,ok:false,stdout:out.join("\\n"),stderr:err.join("\\n"),error:String(x&&x.message||x).split("\\n").slice(-12).join("\\n"),ms:Date.now()-t0};}' +
      'postMessage(res);};ready.then(()=>postMessage({hello:1}),e=>postMessage({hello:0,err:String(e&&e.message||e)}));';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url); } finally { URL.revokeObjectURL(url); }
    let readyTimer;
    const ready = new Promise((ok, no) => { readyTimer = setTimeout(() => no(new Error('Python did not start.')), 60000); w.addEventListener('message', function h(e) { if (e.data && 'hello' in e.data) { clearTimeout(readyTimer); w.removeEventListener('message', h); if (e.data.hello) ok(); else no(new Error('Python could not start: ' + e.data.err)); } }); w.addEventListener('error', e => { clearTimeout(readyTimer); no(new Error('Python could not start: ' + (e.message || 'error'))); }, { once: true }); });
    return { w, ready, close: () => { clearTimeout(readyTimer); w.terminate(); } };
  }
  async function runPython(code, { files, isolated, signal, collectFigures = true } = {}) {
    if (isolated) {
      const me = pyWorker();
      let abort;
      try {
        await Promise.race([me.ready, new Promise((_, reject) => {
          abort = () => reject(new Error('Run stopped.'));
          if (signal?.aborted) abort();
          else signal?.addEventListener('abort', abort, { once: true });
        })]);
        return await pythonResult(me, code, files, signal, collectFigures);
      } finally {
        signal?.removeEventListener('abort', abort);
        me.close();
      }
    }
    if (!py) py = pyWorker();
    await py.ready;
    return pythonResult(py, code, files, signal, collectFigures);
  }
  function pythonResult(me, code, files, signal, collectFigures) {
    const id = Math.random().toString(36).slice(2);
    return new Promise(done => {
      const k = setTimeout(() => { me.close(); if (py === me) py = null; finish({ ok: false, error: 'Stopped after ' + PY_TIME / 1000 + ' seconds (an endless loop, or too much work).', stdout: '', figures: [], ms: PY_TIME }); }, PY_TIME);
      const h = e => { if (e.data?.id === id) finish(e.data); };
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      function finish(result) {
        clearTimeout(k);
        me.w.removeEventListener('message', h);
        signal?.removeEventListener('abort', abort);
        done(result);
      }
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort', abort, { once: true });
      me.w.addEventListener('message', h);
      me.w.postMessage({ id, code, collectFigures, files: (files || []).map(f => ({ name: String(f.name || 'file.txt'), text: String(f.text || '') })) });
    });
  }

  /* ---------- JavaScript ---------- */
  function runJS(code, signal) {
    const src = SEAL + 'self.onmessage=async e=>{const out=[];const fmt=a=>a.map(x=>typeof x==="string"?x:(()=>{try{return JSON.stringify(x);}catch(z){return String(x);}})()).join(" ");const console={log:(...a)=>out.push(fmt(a)),info:(...a)=>out.push(fmt(a)),warn:(...a)=>out.push(fmt(a)),error:(...a)=>out.push(fmt(a)),table:(a)=>out.push(fmt([a]))};const t0=Date.now();' +
      'try{const v=await (new Function("console",\'"use strict";return (async()=>{\'+e.data.code+\'\\n})()\'))(console);postMessage({ok:true,stdout:out.join("\\n"),value:v===undefined?"":(typeof v==="string"?v:JSON.stringify(v)),figures:[],ms:Date.now()-t0});}' +
      'catch(x){postMessage({ok:false,stdout:out.join("\\n"),error:String(x&&x.stack||x).split("\\n").slice(0,4).join("\\n"),figures:[],ms:Date.now()-t0});}};';
    return new Promise(done => {
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      let w; try { w = new Worker(url); } catch (e) { return done({ ok: false, error: 'The sandbox could not start.', stdout: '', figures: [] }); } finally { URL.revokeObjectURL(url); }
      const k = setTimeout(() => finish({ ok: false, error: 'Stopped after ' + JS_TIME / 1000 + ' seconds (an endless loop?).', stdout: '', figures: [], ms: JS_TIME }), JS_TIME);
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      function finish(result) {
        clearTimeout(k);
        signal?.removeEventListener('abort', abort);
        w.terminate();
        done(result);
      }
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort', abort, { once: true });
      w.onmessage = e => finish(e.data);
      w.onerror = e => finish({ ok: false, error: String(e.message || 'error'), stdout: '', figures: [] });
      w.postMessage({ code });
    });
  }

  const LANG = l => /^(py|python|python3)$/i.test(l) ? 'python' : /^(js|javascript|node)$/i.test(l) ? 'js' : '';
  async function run(lang, code, o) {
    const L = LANG(lang); if (!L) return { ok: false, error: 'Only Python and JavaScript can run here.', stdout: '', figures: [] };
    try { return L === 'python' ? await runPython(code, o) : await runJS(code, o?.signal); } catch (e) { return { ok: false, error: String(e.message || e), stdout: '', figures: [] }; }
  }
  /* the first runnable block of a reply: ```python or ```js */
  function firstBlock(text) {
    const m = /```(python|py|python3|javascript|js)\s*\n([\s\S]*?)```/i.exec(String(text || '')); return m ? { lang: LANG(m[1]), code: m[2] } : null;
  }
  /* the result, as text for the AI to read */
  const asText = r => ((r.stdout || '').trim() + (r.value ? '\n' + r.value : '') + (r.ok ? '' : '\nERROR: ' + (r.error || '')) + (r.figures && r.figures.length ? '\n[' + r.figures.length + ' chart(s) shown to the user]' : '')).trim().slice(0, 6000) || '(no output)';
  const warm = () => { if (!py) { py = pyWorker(); py.ready.catch(() => { py = null; }); } };
  A.interp = { run, firstBlock, asText, warm, LANG };
  /* Automatic code execution is opt-in. Remember explicit choices. */
  const sw = document.getElementById('runcode');
  if (sw) { try { sw.checked = ls.get('runcode', '0') === '1'; } catch (e) { sw.checked = false; } sw.addEventListener('change', () => { try { ls.set('runcode', sw.checked ? '1' : '0'); } catch (e) { } }); }
})();
