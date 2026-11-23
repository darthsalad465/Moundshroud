// The chat's code interpreter: Python (Pyodide, with numpy, pandas and matplotlib, in web/vendor/pyodide) and JavaScript,
// each run in a Web Worker that is sealed off before your code starts: no network (fetch only reaches the Python package
// folder, and only while Python loads its packages), no XMLHttpRequest, WebSocket, IndexedDB or caches, no loading of
// other scripts, and no access to the page, your files or Moundshroud's data. Files you attach to the chat are copied in
// (Python: /data/<name>). Every run has a time limit; a run that goes over is stopped by ending its worker.
// A.interp.run(lang, code, {files}) -> {ok, stdout, error, figures:[base64 png], ms}
(() => {
  const PY_TIME = 60000, JS_TIME = 20000;
  /* The worker's network lockdown. It runs after Pyodide has loaded and before any user code, and its closure keeps
     the original fetch away from that code. The original is also replaced on the prototype chain, so deleting
     `self.fetch` (the old escape) finds no working copy. Only URLs under the Pyodide folder are allowed, and encoded
     slashes or dots are rejected so a path cannot walk out of it. Everything else that can reach the network is
     removed: XHR, WebSocket, EventSource, beacon, WebTransport, WebRTC, script/worker loading, BroadcastChannel,
     SharedWorker and caches. This is defence in depth, not the only boundary: the page's CSP and same-origin checks
     still apply. */
  function sealNetwork() {
    var g = self;
    if (g.__oaSealed) return;
    var loc = (g.location && g.location.href) || 'http://sandbox.invalid/';
    var base = '';
    try {
      if (g.__allow) {
        base = new URL(String(g.__allow), loc).href;
        if (base.charAt(base.length - 1) !== '/') base += '/';
      }
    } catch (e) { base = ''; }
    /* The package folder's own scheme. The standalone desktop app serves every file on app://moundshroud, not http,
       so that scheme has to be accepted too — only for URLs inside the same package folder. */
    var bproto = '';
    try { if (base) bproto = new URL(base, loc).protocol; } catch (e) { bproto = ''; }
    function allowed(input) {
      var raw = '';
      /* fetch takes a string, a URL or a Request: Pyodide's package loader passes a URL object, so read all three */
      try {
        if (typeof input === 'string') raw = input;
        else if (input && typeof input.href === 'string') raw = input.href;
        else if (input && typeof input.url === 'string') raw = input.url;
      } catch (e) { return false; }
      if (!base || !raw) return false;
      var u;
      try { u = new URL(raw, loc); } catch (e) { return false; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== bproto) return false;
      var href = u.href;
      if (href !== base && href.indexOf(base) !== 0) return false;
      if (/%2f|%5c|%2e/i.test(u.pathname)) return false;
      return true;
    }
    var real = g.fetch;
    function net(input, init) {
      if (allowed(input)) return real.call(g, input, init);
      return Promise.reject(new Error('The sandbox has no network.'));
    }
    function blockOn(obj, key) {
      var p = obj, found = false;
      while (p) {
        var d = Object.getOwnPropertyDescriptor(p, key);
        if (d) {
          found = true;
          try { Object.defineProperty(p, key, { value: undefined, configurable: false, writable: false, enumerable: !!d.enumerable }); }
          catch (e) { try { p[key] = undefined; } catch (x) { } }
        }
        p = Object.getPrototypeOf(p);
      }
      if (!found) { try { Object.defineProperty(obj, key, { value: undefined, configurable: false, writable: false }); } catch (e) { } }
    }
    function replaceOn(obj, key, value) {
      var p = obj;
      while (p) {
        var d = Object.getOwnPropertyDescriptor(p, key);
        if (d) {
          try { Object.defineProperty(p, key, { value: value, configurable: false, writable: false, enumerable: !!d.enumerable }); }
          catch (e) { }
        }
        p = Object.getPrototypeOf(p);
      }
      try { Object.defineProperty(obj, key, { value: value, configurable: false, writable: false }); } catch (e) { }
    }
    replaceOn(g, 'fetch', net);
    ['XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'indexedDB', 'caches', 'importScripts',
      'BroadcastChannel', 'SharedWorker', 'Worker', 'WebTransport', 'RTCPeerConnection', 'webkitRTCPeerConnection',
      'RTCDataChannel'].forEach(function (k) { blockOn(g, k); });
    try {
      var nav = g.navigator;
      if (nav) ['sendBeacon', 'serviceWorker'].forEach(function (k) { blockOn(nav, k); });
    } catch (e) { }
    try { Object.defineProperty(g, '__oaSealed', { value: true, configurable: false, writable: false }); } catch (e) { }
    /* the package allow-list stays in this closure; user code never needs to read it */
    try { delete g.__allow; } catch (e) { }
  }
  const SEAL = '(' + sealNetwork.toString() + ')();';

  /* ---------- bundled libraries ---------- */
  /* The sandbox ships a few pure-Python packages in web/vendor/python-libs (chess, …). They are written into every
     Python run before the code starts, so a library that works in one sandbox works in all of them: the terminal's
     python3, mcode's CODE blocks, the chat's Run button and the code lessons all share this list. */
  const BUNDLED = [{ name: 'chess.zip', path: 'python-libs/chess.zip' }, { name: 'sandbox-shims.zip', path: 'python-libs/sandbox-shims.zip' }];
  /* Pictures drawn without a screen: the pygame, turtle and tkinter shims keep their frames in sandbox_figures, matplotlib keeps
     its figures, and this collects them all once the program has finished so nothing visual is ever invisible. */
  const CAPTURE = 'import io, base64\n' +
    '_o = []\n' +
    'try:\n' +
    '    import sys\n' +
    '    _t = sys.modules.get("turtle")\n' +
    '    if _t is not None:\n' +
    '        _t._flush()\n' +
    'except Exception:\n' +
    '    pass\n' +
    'try:\n' +
    '    import sys\n' +
    '    _k = sys.modules.get("tkinter")\n' +
    '    if _k is not None:\n' +
    '        _k._flush()\n' +
    'except Exception:\n' +
    '    pass\n' +
    'try:\n' +
    '    import sys\n' +
    '    _p = sys.modules.get("pygame")\n' +
    '    if _p is not None and hasattr(_p, "flush"):\n' +
    '        _p.flush()\n' +
    'except Exception:\n' +
    '    pass\n' +
    'try:\n' +
    '    import sandbox_figures as _sf\n' +
    '    _o.extend(_sf.FIGURES)\n' +
    'except Exception:\n' +
    '    pass\n' +
    'try:\n' +
    '    import matplotlib.pyplot as _plt\n' +
    '    for _n in _plt.get_fignums():\n' +
    '        _b = io.BytesIO()\n' +
    '        _plt.figure(_n).savefig(_b, format="png", dpi=110, bbox_inches="tight")\n' +
    '        _o.append(base64.b64encode(_b.getvalue()).decode())\n' +
    '    _plt.close("all")\n' +
    'except Exception:\n' +
    '    pass\n' +
    '_o[-8:]';
  /* Each run starts with an empty picture list, so only what this program drew is shown. */
  const CLEAR_FIGS = 'try:\n' +
    '    import sandbox_figures as _sf\n' +
    '    _sf.clear()\n' +
    'except Exception:\n' +
    '    pass';
  let bundledLibs = null;
  function loadBundled() {
    if (!bundledLibs) {
      const base = A.interpreterAssets || location.origin + '/web/vendor/';
      bundledLibs = Promise.all(BUNDLED.map(async lib => {
        const response = await fetch(base + lib.path);
        if (!response.ok) throw new Error(lib.name + ' is unavailable');
        return { name: lib.name, data: new Uint8Array(await response.arrayBuffer()) };
      })).catch(() => { bundledLibs = null; return []; });
    }
    return bundledLibs;
  }

  /* ---------- Python ---------- */
  let py = null;      /* {w, ready: Promise, busy} */
  function pyWorker() {
    const base = (A.interpreterAssets || location.origin + '/web/vendor/') + 'pyodide/';
    /* Python loads its engine with importScripts, so the worker seals itself the moment Python is ready, before any code runs */
    const src = 'importScripts(' + JSON.stringify(base + 'pyodide.js') + ');self.__allow=' + JSON.stringify(base) + ';const __base=' + JSON.stringify(base) + ';function __seal(){' + SEAL + '}' +
      'let P=null,out=[],err=[],cut={o:0,ox:0,e:0,ex:0};' +
      /* output is capped while it is produced, so a program that prints for ever still stops with a readable result and
         cannot exhaust the page's memory */
      'const put=(a,k,s)=>{s=String(s);if(cut[k]>=200000){if(!cut[k+"x"]){cut[k+"x"]=1;a.push("\\n[output truncated at 200 KB]");if(k==="o")postMessage({progress:out.join("\\n")});}return;}const room=200000-cut[k];a.push(room<s.length?s.slice(0,room):s);cut[k]+=Math.min(s.length,room);};' +
      'let beat=0,lastBeat=0;' +
      'const ready=loadPyodide({indexURL:' + JSON.stringify(base) + '}).then(async p=>{P=p;__seal();p.setStdout({batched:s=>{put(out,"o",s);if(++beat%10===0||Date.now()-lastBeat>80){lastBeat=Date.now();postMessage({progress:out.join("\\n")});}}});p.setStderr({batched:s=>put(err,"e",s)});try{p.FS.mkdir("/data");}catch(e){}return true;});' +
      'self.onmessage=async e=>{const {id,code,files,collectFigures,libs,argv}=e.data;out=[];err=[];cut.o=0;cut.ox=0;cut.e=0;cut.ex=0;const t0=Date.now();let res={id},pkgErr="";' +
      'try{await ready;' +
      'if(libs&&libs.length){try{P.FS.mkdir("/libs");}catch(x){}for(const l of libs){try{P.FS.writeFile("/libs/"+l.name,new Uint8Array(l.data));}catch(x){}}' +
      'try{await P.runPython("import sys; [sys.path.insert(0, p) for p in "+JSON.stringify(libs.map(l=>"/libs/"+l.name))+"]");}catch(x){}}' +
      'try{await P.runPython(argv?"import os, sys; os.makedirs(\'/data\', exist_ok=True); os.chdir(\'/data\'); sys.argv = "+JSON.stringify(argv):"import os; os.makedirs(\'/data\', exist_ok=True); os.chdir(\'/data\')");}catch(x){}' +
      '(files||[]).forEach(f=>{try{P.FS.writeFile("/data/"+f.name.replace(/[\\\\/:*?"<>|]/g,"_"),f.text);}catch(x){}});' +
      '// pygame, turtle and tkinter come from the bundled shim, so the import scan must not look for a wheel of them\n' +
      'const scan=String(code).replace(/^[ \\t]*(?:import|from)[ \\t]+(?:pygame|turtle|tkinter(?:\.[a-z_]+)?)\\b.*$/gm,"");' +
      'for(let a=0;a<2;a++){try{await P.loadPackagesFromImports(scan,{messageCallback:()=>{},errorCallback:m=>{if(!pkgErr)pkgErr=String(m);}});break;}catch(x){if(a)throw x;}}' +
      'if(/matplotlib|pygame|turtle|plt\\./.test(code)){try{await P.loadPackage("matplotlib",{messageCallback:()=>{},errorCallback:m=>{if(!pkgErr)pkgErr=String(m);}});}catch(x){}try{await P.runPythonAsync("import matplotlib\\nmatplotlib.use(\\"AGG\\")");}catch(x){}}' +
      /* Pillow is what actually draws a tkinter window, so it is fetched and then *verified* three times: one failed
         download must not leave a run showing an empty result. The reason is kept in pkgErr and shown with the error. */
      'const pilOK=async()=>{try{await P.runPythonAsync("import PIL");return true;}catch(x){return false;}};' +
      /* A second way in, used only if the package loader fails: fetch the wheel itself and unpack it onto sys.path.
         It skips the loader's name lookup and integrity check, so a bad lock entry or a broken fetch cache cannot stop it. */
      'const pilWheel=async()=>{const u=__base+"pillow-10.2.0-cp312-cp312-pyodide_2024_0_wasm32.whl";let r;try{r=await fetch(u,{cache:"no-store"});}catch(e){throw new Error("could not fetch "+u+": "+(e&&e.message||e));}if(!r.ok)throw new Error("HTTP "+r.status+" for "+u);const b=new Uint8Array(await r.arrayBuffer());try{P.FS.mkdir("/pil");}catch(e){}try{P.unpackArchive(b,"zip",{extractDir:"/pil"});}catch(e){throw new Error("could not unpack "+u+": "+(e&&e.message||e));}await P.runPythonAsync("import sys\\nif \\\"/pil\\\" not in sys.path:\\n    sys.path.insert(0, \\\"/pil\\\")");if(!await pilOK())throw new Error("unpacked "+u+" but PIL still will not import");return true;};' +
      'if(/\\btkinter\\b|ImageTk/.test(code)){let pil=await pilOK();for(let a=0;!pil&&a<2;a++){try{await P.loadPackage("pillow",{messageCallback:()=>{},errorCallback:m=>{pkgErr=pkgErr||("Pillow: "+m);}});}catch(y){pkgErr=pkgErr||("Pillow: "+(y&&y.message||y));}pil=await pilOK();if(!pil&&a<1)await new Promise(r=>setTimeout(r,300));}' +
      'if(!pil){try{pil=await pilWheel();}catch(y){const w=String(y&&y.message||y);pkgErr=(pkgErr?pkgErr+"; ":"")+"the wheel itself: "+w;}}' +
      'if(!pil)err.push("warning: Pillow could not be loaded, and it is what draws a tkinter window here. Every run tries again."+(pkgErr?" ("+pkgErr+")":"")+"\\n");' +
      'try{await P.runPythonAsync("import tkinter");}catch(x){}}' +
      'try{await P.runPythonAsync(' + JSON.stringify(CLEAR_FIGS) + ');}catch(x){}' +
      'const v=await P.runPythonAsync(code);' +
      'let figs=[];if(collectFigures){try{const r=await P.runPythonAsync(' + JSON.stringify(CAPTURE) + ');figs=(r&&r.toJs)?r.toJs():[];r&&r.destroy&&r.destroy();}catch(x){}}' +
      'let val=v===undefined||v===null?"":String(v);if(val.length>20000)val=val.slice(0,20000)+" …[value truncated]";if(v&&v.destroy)v.destroy();' +
      'res={id,ok:true,stdout:out.join("\\n"),stderr:err.join("\\n"),value:val,figures:figs,ms:Date.now()-t0};' +
      '}catch(x){let ef=[];try{if(collectFigures){const rr=await P.runPythonAsync(' + JSON.stringify(CAPTURE) + ');ef=(rr&&rr.toJs)?rr.toJs():[];rr&&rr.destroy&&rr.destroy();}}catch(y){}res={id,ok:false,stdout:out.join("\\n"),stderr:err.join("\\n"),error:String(x&&x.message||x).split("\\n").slice(-12).join("\\n")+(pkgErr?"\\nA package could not be loaded: "+pkgErr:""),figures:ef,ms:Date.now()-t0};}' +
      'postMessage(res);};ready.then(()=>postMessage({hello:1}),e=>postMessage({hello:0,err:String(e&&e.message||e)}));';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url); } finally { URL.revokeObjectURL(url); }
    let readyTimer;
    const ready = new Promise((ok, no) => { readyTimer = setTimeout(() => no(new Error('Python did not start.')), 60000); w.addEventListener('message', function h(e) { if (e.data && 'hello' in e.data) { clearTimeout(readyTimer); w.removeEventListener('message', h); if (e.data.hello) ok(); else no(new Error('Python could not start: ' + e.data.err)); } }); w.addEventListener('error', e => { clearTimeout(readyTimer); no(new Error('Python could not start: ' + (e.message || 'error'))); }, { once: true }); });
    return { w, ready, close: () => { clearTimeout(readyTimer); w.terminate(); } };
  }
  async function runPython(code, opts = {}) {
    const { files, isolated, signal, collectFigures = true, libs } = opts;
    const bundled = libs && libs.length ? libs : await loadBundled();
    if (isolated) {
      const me = pyWorker();
      let abort;
      try {
        await Promise.race([me.ready, new Promise((_, reject) => {
          abort = () => reject(new Error('Run stopped.'));
          if (signal?.aborted) abort();
          else signal?.addEventListener('abort', abort, { once: true });
        })]);
        return await pythonResult(me, code, files, signal, collectFigures, bundled, undefined, opts.onOutput);
      } finally {
        signal?.removeEventListener('abort', abort);
        me.close();
      }
    }
    if (!py) py = pyWorker();
    await py.ready;
    return pythonResult(py, code, files, signal, collectFigures, bundled, undefined, opts.onOutput);
  }
  /* One shape for everything that crosses back from a worker. The guest can post anything it likes, so the page
     keeps only the fields it understands and puts a hard ceiling on every string and list. */
  function tidy(result) {
    if (!result || typeof result !== 'object') return { ok: false, error: 'The sandbox returned an unreadable result.', stdout: '', figures: [] };
    const text = value => typeof value === 'string' ? value.slice(0, 200000) : '';
    /* a figure is embedded in an <img src>, so only real base64 may cross: a quote or tag here would be page injection */
    const figures = Array.isArray(result.figures)
      ? result.figures.filter(item => typeof item === 'string' && item.length <= 4 * 1024 * 1024 && /^[A-Za-z0-9+/]+={0,2}$/.test(item)).slice(-4)
      : [];
    return {
      ok: !!result.ok,
      stdout: text(result.stdout),
      stderr: text(result.stderr),
      error: result.error ? text(result.error) : undefined,
      value: result.value === undefined || result.value === null ? undefined : String(result.value).slice(0, 20000),
      figures,
      ms: Number(result.ms) || 0
    };
  }
  function pythonResult(me, code, files, signal, collectFigures, libs, argv, onOutput) {
    const id = Math.random().toString(36).slice(2);
    let partial = '', progressMessages = 0;
    return new Promise(done => {
      const settle = result => done(tidy(result));
      /* a program that never finishes still shows what it printed before the limit was reached */
      const k = setTimeout(() => { me.close(); if (py === me) py = null; finish({ ok: false, error: 'Stopped after ' + PY_TIME / 1000 + ' seconds (an endless loop, or too much work).', stdout: partial, figures: [], ms: PY_TIME }); }, PY_TIME);
      const h = e => {
        if (e.data?.id === id) return finish(e.data);
        if (e.data && typeof e.data.progress === 'string') {
          /* a program can post its own messages; cap both the text and the number of updates so it cannot flood the page */
          if (++progressMessages > 1000) return finish({ ok: false, error: 'Stopped: the program produced too many live updates.', stdout: partial, figures: [] });
          partial = e.data.progress.slice(0, 200000);
          /* live output: the Playground draws each chunk as it arrives, so an animation is visible while it runs */
          if (onOutput) { try { onOutput(partial); } catch (x) { } }
        }
      };
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      function finish(result) {
        clearTimeout(k);
        me.w.removeEventListener('message', h);
        signal?.removeEventListener('abort', abort);
        settle(result);
      }
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort', abort, { once: true });
      me.w.addEventListener('message', h);
      me.w.postMessage({ id, code, collectFigures, libs, argv, files: (files || []).map(f => ({ name: String(f.name || 'file.txt'), text: String(f.text || '') })) });
    });
  }

  /* ---------- JavaScript ---------- */
  /* Drawing in JavaScript: a canvas made with document.createElement('canvas') is a real OffscreenCanvas inside the
     worker, so ordinary 2D drawing code runs unchanged. Every canvas is turned into a PNG when the program ends, which
     is how a program that only draws something still has visible output. */
  const JS_DRAW = 'const __canv=[];' +
    'const __mk=(w,h)=>{const c=new OffscreenCanvas(Math.max(1,Math.round(+w)||300),Math.max(1,Math.round(+h)||150));__canv.push(c);return c;};' +
    'const __el=t=>({tagName:String(t||"div").toUpperCase(),style:{},children:[],appendChild(x){this.children.push(x);return x;},append(...x){this.children.push(...x);},setAttribute(){},addEventListener(){},getContext(){return null;},width:0,height:0,textContent:""});' +
    'self.document={createElement:t=>/canvas/i.test(t)?__mk():(/img/i.test(t)?__el(t):__el(t)),getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},body:__el("body"),documentElement:__el("html")};' +
    'self.alert=()=>{};self.prompt=()=>null;if(!self.window)self.window=self;' +
    'const __b64=async b=>{const u=new Uint8Array(await b.arrayBuffer());let s="";for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s);};' +
    /* an animation is drawn over and over and may never finish, so a few mid-flight frames are kept while it runs:
       the run can then still show what was on the canvas when it was stopped, not an empty result */
    'const __keep=[];let __busy=0,__tick=0,__anim=0;' +
    'const __snap=async()=>{if(__busy||!__canv.length)return;__busy=1;try{const b=await __b64(await __canv[__canv.length-1].convertToBlob({type:"image/png"}));if(b&&b!==__keep[__keep.length-1]){__keep.push(b);if(__keep.length>4)__keep.shift();}}catch(e){}finally{__busy=0;}};' +
    'const __tock=()=>{const n=Date.now();if(n-__tick>=300){__tick=n;__snap();}};' +
    /* a worker's own requestAnimationFrame never fires for a canvas that is not on a page, so it is replaced with a
       timer: an animation then really advances while the program runs, and can be photographed */
    'self.requestAnimationFrame=f=>{__anim=1;return setTimeout(()=>{f(Date.now());__tock();},16);};self.cancelAnimationFrame=id=>clearTimeout(id);' +
    'const __si=self.setInterval.bind(self);self.setInterval=(f,ms,...a)=>{if(__canv.length)__anim=1;return __si(()=>{f(...a);__tock();},ms);};' +
    'const __shots=async()=>{const o=__keep.slice();for(const c of __canv){try{o.push(await __b64(await c.convertToBlob({type:"image/png"})));}catch(e){}}return o.slice(-4);};';
  function runJS(code, signal, onOutput) {
    const src = SEAL + JS_DRAW + 'self.onmessage=async e=>{if(e.data&&e.data.shoot){postMessage({shoot:1,for:e.data.shoot,figures:await __shots()});return;}const out=[];const fmt=a=>a.map(x=>typeof x==="string"?x:(()=>{try{return JSON.stringify(x);}catch(z){return String(x);}})()).join(" ");let used=0,told=0;let beat=0,lastBeat=0;const say=(...a)=>{const s=fmt(a);if(used>=200000){if(!told){told=1;out.push("[output truncated at 200 KB]");postMessage({progress:out.join("\\n")});}return;}const room=200000-used;out.push(room<s.length?s.slice(0,room):s);used+=Math.min(s.length,room);if(++beat%10===0||Date.now()-lastBeat>80){lastBeat=Date.now();postMessage({progress:out.join("\\n")});}};const console={log:say,info:say,warn:say,error:say,table:a=>say(fmt([a]))};const show=v=>{if(v===undefined)return "";let t;try{t=typeof v==="string"?v:JSON.stringify(v);}catch(z){t=String(v);}if(t==null)t=String(v);return t.slice(0,20000);};const t0=Date.now();' +
      'try{const v=await (new Function("console",\'"use strict";return (async()=>{\'+e.data.code+\'\\n})()\'))(console);' +
      /* a program that animates keeps drawing after its code returns, so a canvas animation gets a moment to run:
         the frames it draws are kept, and the run shows them instead of only the first one */
      'if(__anim&&__canv.length){while(Date.now()-t0<2500){await new Promise(r=>setTimeout(r,100));}}' +
      'postMessage({ok:true,stdout:out.join("\\n"),value:show(v),figures:await __shots(),ms:Date.now()-t0});}' +
      'catch(x){postMessage({ok:false,stdout:out.join("\\n"),error:String(x&&x.stack||x).split("\\n").slice(0,4).join("\\n"),figures:await __shots(),ms:Date.now()-t0});}};';
    return new Promise(done => {
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      let w; try { w = new Worker(url); } catch (e) { return done({ ok: false, error: 'The sandbox could not start.', stdout: '', figures: [] }); } finally { URL.revokeObjectURL(url); }
      let partial = '', progressMessages = 0;
      /* an animation never finishes, so the worker is asked for its last pictures before it is stopped: the run then
         shows the frame it reached instead of no picture at all */
      const k = setTimeout(async () => {
        let figures = [];
        try {
          figures = await new Promise(resolve => {
            const tag = 'shot' + Math.random().toString(36).slice(2);
            const h = e => {
              if (!e.data || !e.data.shoot || e.data.for !== tag) return;
              clearTimeout(wait); w.removeEventListener('message', h);
              resolve(Array.isArray(e.data.figures) ? e.data.figures : []);
            };
            const wait = setTimeout(() => { w.removeEventListener('message', h); resolve([]); }, 1500);
            w.addEventListener('message', h);
            try { w.postMessage({ shoot: tag }); } catch (x) { clearTimeout(wait); w.removeEventListener('message', h); resolve([]); }
          });
        } catch (x) { figures = []; }
        finish({ ok: false, error: 'Stopped after ' + JS_TIME / 1000 + ' seconds (an endless loop?).', stdout: partial, figures, ms: JS_TIME });
      }, JS_TIME);
      const abort = () => finish({ ok: false, error: 'Run stopped.' });
      function finish(result) {
        clearTimeout(k);
        signal?.removeEventListener('abort', abort);
        w.terminate();
        done(tidy(result));
      }
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort', abort, { once: true });
      w.onmessage = e => {
        /* the answer to a picture request is read by the timeout handler, not by the result path */
        if (e.data && e.data.shoot) return;
        if (e.data && typeof e.data.progress === 'string') {
          if (++progressMessages > 1000) return finish({ ok: false, error: 'Stopped: the program produced too many live updates.', stdout: partial, figures: [] });
          partial = e.data.progress.slice(0, 200000);
          if (onOutput) { try { onOutput(partial); } catch (x) { } }
          return;
        }
        finish(e.data);
      };
      w.onerror = e => finish({ ok: false, error: String(e.message || 'error'), stdout: partial, figures: [] });
      w.postMessage({ code });
    });
  }

  /* A private, long-lived Python session: state (variables, imports) survives between calls, for the sandbox shells.
     Each session owns its own worker, so it never mixes with the chat interpreter. */
  function session() {
    let me = null, chain = Promise.resolve();
    const ensure = () => me || (me = pyWorker());
    const api = {
      run(code, o = {}) {
        const job = chain.then(async () => {
          const w = ensure();
          await w.ready;
          return pythonResult(w, code, o.files, o.signal, !!o.collectFigures, o.libs && o.libs.length ? o.libs : await loadBundled(), o.argv);
        }).then(result => {
          if (result && !result.ok && /Stopped after|Run stopped/.test(String(result.error || ''))) api.close();
          return result;
        }, e => {
          api.close();
          return { ok: false, error: String(e && e.message || e), stdout: '', figures: [] };
        });
        chain = job.then(() => { }, () => { });
        return job;
      },
      close() { if (me) { try { me.close(); } catch (e) { } me = null; } }
    };
    return api;
  }

  const LANG = l => /^(py|python|python3)$/i.test(l) ? 'python' : /^(js|javascript|node)$/i.test(l) ? 'js' : '';
  async function run(lang, code, o) {
    const L = LANG(lang); if (!L) return { ok: false, error: 'Only Python and JavaScript can run here.', stdout: '', figures: [] };
    try { return L === 'python' ? await runPython(code, o) : await runJS(code, o?.signal, o?.onOutput); } catch (e) { return { ok: false, error: String(e.message || e), stdout: '', figures: [] }; }
  }
  /* the first runnable block of a reply: ```python or ```js */
  function firstBlock(text) {
    const m = /```(python|py|python3|javascript|js)\s*\n([\s\S]*?)```/i.exec(String(text || '')); return m ? { lang: LANG(m[1]), code: m[2] } : null;
  }
  /* the result, as text for the AI to read */
  const asText = r => ((r.stdout || '').trim() + (r.value ? '\n' + r.value : '') + (r.ok ? '' : '\nERROR: ' + (r.error || '')) + (r.figures && r.figures.length ? '\n[' + r.figures.length + ' chart(s) shown to the user]' : '')).trim().slice(0, 6000) || '(no output)';
  const warm = () => { if (!py) { py = pyWorker(); py.ready.catch(() => { py = null; }); } };
  A.interp = { run, firstBlock, asText, warm, LANG, session };
  /* Automatic code execution is opt-in. Remember explicit choices. */
  const sw = document.getElementById('runcode');
  if (sw) { try { sw.checked = ls.get('runcode', '0') === '1'; } catch (e) { sw.checked = false; } sw.addEventListener('change', () => { try { ls.set('runcode', sw.checked ? '1' : '0'); } catch (e) { } }); }
})();
