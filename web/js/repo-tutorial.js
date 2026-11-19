// Interactive hands-on walkthrough for the new Studio & Tools repository sections:
//   - Studio > Heretic (p-e-w/heretic)
//   - Studio > Photo Editor (miniPaint + LaMa AI Magic Eraser + rembg + Real-ESRGAN)
//   - Studio > Media Lab (rembg, Real-ESRGAN, Demucs)
//   - Studio > Model Suite (lm-evaluation-harness, mergekit, autoresearch)
//   - Tools  > MarkItDown (microsoft/markitdown)
// Drives the real UI, spotlights exact buttons on screen, and provides one-click live demo actions.
(() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const DONE_KEY = 'oa_repo_tut_done_v1';

  const getDone = () => {
    try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch (e) { return new Set(); }
  };
  const saveDone = set => {
    try { localStorage.setItem(DONE_KEY, JSON.stringify([...set])); } catch (e) { }
  };

  /* ---- Synthetic in-browser sample generators for zero-friction hands-on practice ---- */
  function makePracticePhotoDataUrl() {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 420;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 290);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(0.55, '#6d28d9');
    sky.addColorStop(1, '#f97316');
    g.fillStyle = sky; g.fillRect(0, 0, 640, 420);
    // Sun
    g.fillStyle = '#fde68a';
    g.beginPath(); g.arc(470, 145, 48, 0, Math.PI * 2); g.fill();
    // Distant mountains
    g.fillStyle = '#312e81';
    g.beginPath(); g.moveTo(0, 290); g.lineTo(140, 175); g.lineTo(270, 260); g.lineTo(410, 160); g.lineTo(560, 250); g.lineTo(640, 210); g.lineTo(640, 420); g.lineTo(0, 420); g.closePath(); g.fill();
    // Foreground lake
    const lake = g.createLinearGradient(0, 285, 0, 420);
    lake.addColorStop(0, '#1e293b'); lake.addColorStop(1, '#0f172a');
    g.fillStyle = lake; g.fillRect(0, 285, 640, 135);
    // Sun reflection
    g.fillStyle = 'rgba(253, 230, 138, 0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(435 + i * 4, 298 + i * 16, 70 - i * 8, 5);
    // Bright unwanted object to practice AI Magic Eraser on!
    g.fillStyle = '#ef4444';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.fillRect(195, 225, 165, 66);
    g.strokeRect(195, 225, 165, 66);
    g.fillStyle = '#ffffff';
    g.font = 'bold 20px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.fillText('ERASE ME!', 277, 265);
    return c.toDataURL('image/png');
  }

  function makeSampleSpriteBlob(size) {
    return new Promise(res => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const g = c.getContext('2d');
      // Solid backdrop for rembg / upscaler testing
      const bg = g.createLinearGradient(0, 0, size, size);
      bg.addColorStop(0, '#0ea5e9'); bg.addColorStop(1, '#1d4ed8');
      g.fillStyle = bg; g.fillRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2, r = size * 0.28;
      // Rocket body
      g.fillStyle = '#f8fafc';
      g.beginPath();
      g.moveTo(cx, cy - r * 1.4);
      g.quadraticCurveTo(cx + r * 0.9, cy - r * 0.2, cx + r * 0.55, cy + r * 0.95);
      g.lineTo(cx - r * 0.55, cy + r * 0.95);
      g.quadraticCurveTo(cx - r * 0.9, cy - r * 0.2, cx, cy - r * 1.4);
      g.fill();
      // Nose & fins
      g.fillStyle = '#ef4444';
      g.beginPath(); g.moveTo(cx, cy - r * 1.4); g.lineTo(cx + r * 0.35, cy - r * 0.65); g.lineTo(cx - r * 0.35, cy - r * 0.65); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx - r * 0.55, cy + r * 0.35); g.lineTo(cx - r * 1.05, cy + r * 1.05); g.lineTo(cx - r * 0.45, cy + r * 0.95); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(cx + r * 0.55, cy + r * 0.35); g.lineTo(cx + r * 1.05, cy + r * 1.05); g.lineTo(cx + r * 0.45, cy + r * 0.95); g.closePath(); g.fill();
      // Window
      g.fillStyle = '#38bdf8';
      g.strokeStyle = '#334155';
      g.lineWidth = Math.max(2, size * 0.025);
      g.beginPath(); g.arc(cx, cy - r * 0.1, r * 0.3, 0, Math.PI * 2); g.fill(); g.stroke();
      // Flame
      g.fillStyle = '#facc15';
      g.beginPath(); g.moveTo(cx - r * 0.32, cy + r * 0.95); g.lineTo(cx, cy + r * 1.55); g.lineTo(cx + r * 0.32, cy + r * 0.95); g.closePath(); g.fill();
      c.toBlob(blob => res(blob), 'image/png');
    });
  }

  function injectFileIntoInput(inputSel, file) {
    const inp = document.querySelector(inputSel);
    if (!inp) return false;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---- Lesson definitions for all 5 new repository sections ---- */
  const LESSONS = [
    {
      id: 'hub',
      icon: '🎓',
      badge: 'Overview',
      title: 'Welcome: Your New Studio & Tools Repos',
      where: 'Studio & Tools',
      summary: 'We added 8 open-source AI & creative repositories organized into 5 clean tabs. Pick any tool below to jump right in, or click Next to walk through them one by one with live interactive demos!',
      io: null,
      steps: [
        '<b>Studio › ⚗️ Heretic</b> — Turn any downloaded AI model into an uncensored / less-preachy <code>-heretic</code> model.',
        '<b>Studio › 🖼️ Photo Editor</b> — Full Photoshop-style layered editor + 1-click AI Magic Eraser, Remove BG &amp; Upscaler.',
        '<b>Studio › 🪄 Media Lab</b> — Batch-ready Background Remover, 2×/4× AI Upscaler, and Music Stem Splitter (Vocals/Drums/Bass).',
        '<b>Studio › 🧬 Model Suite</b> — Benchmark models (Eval Harness), blend two models (Mergekit), and run GPU research (Autoresearch).',
        '<b>Tools › 📝 MarkItDown</b> — Drop any PDF, Word, PowerPoint, Excel, or HTML file to turn it into clean Markdown.'
      ],
      tip: 'Every section also has a <b>🎓 Guide</b> button in its top bar so you can reopen its specific lesson anytime.',
      nav: async () => {},
      spotlight: null
    },
    {
      id: 'heretic',
      icon: '⚗️',
      badge: 'Studio › Heretic',
      title: 'Heretic: Customize Any Downloaded Model',
      where: 'Studio › ⚗️ Heretic  (p-e-w/heretic)',
      summary: 'Want a local model that stops giving preachy refusals, reduces "AI slop", or stops being overly sycophantic — without losing its intelligence? Heretic uses directional ablation + Optuna optimization locally on your GPU.',
      io: ['Any downloaded Ollama, LM Studio, or Hugging Face model', 'A new <model>-heretic model auto-added to every dropdown'],
      steps: [
        'Open the <b>Model</b> picker in the main card and choose any model you already have downloaded on your PC.',
        'Pick a <b>Preset</b> chip: <i>Decensor</i>, <i>Reduce AI slop</i>, <i>Reduce sycophancy</i>, or <i>Make terse</i>.',
        'Click <b>Start Heretic Run</b>. If you picked a local GGUF model, Moundshroud unpacks it, runs GPU trials, and automatically imports the finished <code>-heretic</code> model into Ollama &amp; LM Studio.'
      ],
      tip: 'Smaller models (2B–8B) finish much faster on an 8 GB GPU. You can track live trial progress and logs right in the Runs sidebar.',
      nav: async () => { A.studio && A.studio.go('heretic'); await wait(450); },
      spotlight: '#hrmain',
      demoLabel: '🔍 Highlight Model Picker & Controls',
      demo: async () => {
        const el = document.querySelector('#hrmain select, #hrmain input, #hrmain');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); highlightEl(el, 'Pick any downloaded model here'); }
      }
    },
    {
      id: 'photoshop',
      icon: '🖼️',
      badge: 'Studio › Photo Editor',
      title: 'Photo Editor: Photoshop + AI Magic Eraser',
      where: 'Studio › 🖼️ Photo Editor  (miniPaint + LaMa + rembg + Real-ESRGAN)',
      summary: 'A full layered image editor (brushes, text, crop, filters, layers, export) fused directly with 3 local GPU AI buttons along the top bar. Every AI tool reads your live canvas and sends the edited image back as a new undoable layer!',
      io: ['Any PNG / JPG / WEBP photo (or draw directly on canvas)', 'Layered edited photo saved to PNG or Art Albums'],
      steps: [
        'Click <b>📁 Open Photo</b> (or press the <b>Practice Photo</b> demo button below!) to put an image on the canvas.',
        'Click <b>✨ AI Magic Eraser</b>: paint red over any unwanted object, person, text, or watermark, then press <b>✨ Erase Masked Area</b> and click <b>✓ Apply to Photo Editor</b>.',
        'Try <b>✂️ AI Remove BG</b> to cut out the subject onto a new transparent layer, or <b>🔍 Run</b> to 2×/4× AI-upscale the whole canvas.',
        'Use miniPaint\'s left toolbar for brushes, text, crop, color adjustments &amp; layers, then click <b>💾 Save to Album</b> or <b>File › Export</b>.'
      ],
      tip: 'First time you click Erase Masked Area, it downloads the 196 MB LaMa model once. After that it runs 100% offline in seconds!',
      nav: async () => { A.studio && A.studio.go('photoed'); await wait(650); },
      spotlight: '#peErase',
      demoLabel: '🎨 Load Practice Photo ("ERASE ME!")',
      demo: async () => {
        const url = makePracticePhotoDataUrl();
        const pane = document.querySelector('#p-studio #peFrame');
        if (!pane) return A.toast('Photo Editor is still loading — wait 1 second and try again.');
        const w = pane.contentWindow;
        if (w && w.FileOpen && w.FileOpen.file_open_data_url_handler) {
          w.FileOpen.file_open_data_url_handler(url);
          A.toast('Practice photo loaded! Now click ✨ AI Magic Eraser and paint over the red "ERASE ME!" box.', 5500);
          highlightEl(document.querySelector('#peErase'), 'Click here to erase the red box!');
        } else {
          A.toast('miniPaint is still initializing — click Load Practice Photo again in a moment.', 3500);
        }
      }
    },
    {
      id: 'rembg',
      icon: '✂️',
      badge: 'Media Lab · 1/3',
      title: 'Media Lab: AI Background Remover',
      where: 'Studio › 🪄 Media Lab › ✂️ Background Remover  (danielgatis/rembg)',
      summary: 'Need clean transparent PNG cutouts for thumbnails, stickers, product shots, or game sprites? Drop an image and rembg strips the background locally.',
      io: ['Any PNG / JPG / WEBP image', 'Transparent cutout PNG with side-by-side preview & Download'],
      steps: [
        'Drag &amp; drop a photo onto the dashed box (or click <b>Load Sample Rocket</b> below to try it immediately).',
        'Pick a model: <code>isnet-general-use</code> is best all-around; <code>u2net_human_seg</code> is great for portraits; <code>isnet-anime</code> is great for anime/illustrations.',
        'Optional: tick <b>Alpha matting</b> for wispy hair or fur edges.',
        'Press <b>✂️ Remove Background</b> — compare Original vs. Output on the checkerboard below and hit <b>⬇ Download PNG</b>.'
      ],
      tip: 'Need to keep editing the cutout with text or a new background? Use Studio › Photo Editor › ✂️ AI Remove BG instead!',
      nav: async () => {
        A.studio && A.studio.go('medialab'); await wait(450);
        const btn = document.querySelector('#mlTabs [data-t="rembg"]'); if (btn) btn.click();
        await wait(200);
      },
      spotlight: '#rbDrop',
      demoLabel: '🚀 Load Sample Rocket Into Dropzone',
      demo: async () => {
        const blob = await makeSampleSpriteBlob(384);
        const file = new File([blob], 'demo-rocket.png', { type: 'image/png' });
        if (injectFileIntoInput('#rbFile', file)) {
          A.toast('Loaded demo-rocket.png! Now click ✂️ Remove Background to see it in action.', 4500);
          highlightEl(document.querySelector('#rbGo'), 'Press here to cut out the rocket!');
        }
      }
    },
    {
      id: 'realesrgan',
      icon: '🔍',
      badge: 'Media Lab · 2/3',
      title: 'Media Lab: AI Image Upscaler (2× / 4×)',
      where: 'Studio › 🪄 Media Lab › 🔍 AI Upscaler  (xinntao/Real-ESRGAN)',
      summary: 'Turn small, blurry, or compressed photos, pixel art, and illustrations into crisp high-resolution images using GPU super-resolution.',
      io: ['Small or blurry PNG / JPG / WEBP image', 'Sharpened 2× or 4× high-res PNG'],
      steps: [
        'Drop an image into the dashed box (or click <b>Load 128×128 Test Image</b> below).',
        'Pick a <b>Model</b>: General photo (<code>RealESRGAN_x4plus</code>) or Anime/Illustration (<code>RealESRGAN_x4plus_anime_6B</code>).',
        'Keep <b>Tile = 256 px</b> (this slices big images into tiles so an 8 GB GPU never runs out of VRAM).',
        'Click <b>🔍 Upscale Image</b> and download your crisp high-res PNG from the results card.'
      ],
      tip: 'Use <b>2×</b> for already-medium photos (faster and smaller file size), or <b>4×</b> for tiny images and thumbnails.',
      nav: async () => {
        A.studio && A.studio.go('medialab'); await wait(450);
        const btn = document.querySelector('#mlTabs [data-t="realesrgan"]'); if (btn) btn.click();
        await wait(200);
      },
      spotlight: '#esDrop',
      demoLabel: '🖼️ Load 128×128 Test Image',
      demo: async () => {
        const blob = await makeSampleSpriteBlob(128);
        const file = new File([blob], 'tiny-rocket-128px.png', { type: 'image/png' });
        if (injectFileIntoInput('#esFile', file)) {
          A.toast('Loaded tiny-rocket-128px.png! Click 🔍 Upscale Image to enlarge it to 512×512.', 4500);
          highlightEl(document.querySelector('#esGo'), 'Click to upscale 4× on GPU!');
        }
      }
    },
    {
      id: 'demucs',
      icon: '🎚️',
      badge: 'Media Lab · 3/3',
      title: 'Media Lab: Music Stem Splitter',
      where: 'Studio › 🪄 Media Lab › 🎚️ Stem Splitter  (facebookresearch/demucs)',
      summary: 'Separate any song into clean studio stems — Vocals, Drums, Bass, and Other — or make an instant karaoke instrumental track, 100% offline.',
      io: ['Any MP3 / WAV / FLAC / M4A song (or a track from your Music library)', 'Playable & downloadable WAV files for each stem'],
      steps: [
        'Drop a song onto the box, <b>OR</b> pick a track from the <b>Moundshroud library</b> dropdown right underneath it.',
        'Choose <b>Mode</b>: <i>All stems (Vocals / Drums / Bass / Other)</i> for remixing/sampling, or <i>2 stems (Vocals + Instrumental)</i> for acapellas &amp; karaoke.',
        'Press <b>🎚️ Split Stems</b>. When finished, play each isolated instrument right in the browser or click <b>⬇ WAV</b>.'
      ],
      tip: '<code>htdemucs</code> is fast and high-quality; <code>htdemucs_6s</code> even separates Guitar and Piano into their own stems!',
      nav: async () => {
        A.studio && A.studio.go('medialab'); await wait(450);
        const btn = document.querySelector('#mlTabs [data-t="demucs"]'); if (btn) btn.click();
        await wait(200);
      },
      spotlight: '#dmDrop',
      demoLabel: '🎵 Highlight Song Picker & Mode',
      demo: async () => {
        const el = document.querySelector('#dmTrack') || document.querySelector('#dmDrop');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); highlightEl(el, 'Drop a song above or pick one here'); }
      }
    },
    {
      id: 'lmeval',
      icon: '📊',
      badge: 'Model Suite · 1/3',
      title: 'Model Suite: Benchmark Models (Eval Harness)',
      where: 'Studio › 🧬 Model Suite › 📊 Eval Harness  (EleutherAI/lm-evaluation-harness)',
      summary: 'Want to know if your newly uncensored Heretic model or a new Ollama download is actually smarter — or if it lost accuracy? Run standard academic benchmarks locally.',
      io: ['Any local Ollama model or Hugging Face folder', 'Accuracy score table per benchmark task (e.g. HellaSwag, MMLU, GSM8K)'],
      steps: [
        'Keep <b>Backend = Local Ollama model</b> and select the model you want to test.',
        'Set <b>Samples/task = 10 to 25</b> for a fast ~1-minute sanity check (setting <code>0</code> runs thousands of questions and takes hours!).',
        'Tick 1 or 2 benchmark tasks (like <code>hellaswag</code> for commonsense or <code>gsm8k</code> for math).',
        'Press <b>▶ Run Evaluation</b> and view the scored results table below.'
      ],
      tip: 'Great workflow: run a 25-sample Eval on a model <i>before</i> and <i>after</i> Heretic so you can verify intelligence stayed intact!',
      nav: async () => {
        A.studio && A.studio.go('modelsuite'); await wait(450);
        const btn = document.querySelector('#msTabs [data-t="lmeval"]'); if (btn) btn.click();
        await wait(200);
      },
      spotlight: '#evGo',
      demoLabel: '🎯 Set Fast 10-Sample Quick Check',
      demo: async () => {
        const lim = document.querySelector('#evLim');
        if (lim) lim.value = '10';
        const checks = [...document.querySelectorAll('#evTasks input[type=checkbox]')];
        checks.forEach((c, i) => { c.checked = c.value === 'hellaswag' || (i === 0 && !checks.some(x => x.value === 'hellaswag')); });
        A.toast('Configured a fast 10-sample HellaSwag check! Press ▶ Run Evaluation whenever you\'re ready.', 4500);
        highlightEl(document.querySelector('#evGo'), 'Ready to benchmark!');
      }
    },
    {
      id: 'mergekit',
      icon: '🔀',
      badge: 'Model Suite · 2/3',
      title: 'Model Suite: Blend Models Without Training (Mergekit)',
      where: 'Studio › 🧬 Model Suite › 🔀 Mergekit  (arcee-ai/mergekit)',
      summary: 'Combine the strengths of two AI models (for example, a general chat model + a coding model) into one hybrid model locally — no training required!',
      io: ['2 Hugging Face models with the SAME base architecture & size', 'A merged model folder (auto-importable into Ollama / LM Studio)'],
      steps: [
        'Give your merged model an <b>Output name</b> (e.g. <code>qwen-chat-coder-blend</code>).',
        'Pick a <b>Merge method</b>: <b>SLERP</b> is easiest for blending 2 models (<code>t = 0.5</code> means 50/50 blend); <b>TIES / DARE</b> are great for combining multiple fine-tunes onto a base model.',
        'Enter <b>Model A</b> and <b>Model B</b> (must be the same family &amp; size, e.g. both Qwen2.5 1.5B, or both Llama-3 8B).',
        'Click <b>Generate YAML</b> to preview the merge recipe, then click <b>🔀 Run Merge</b>.'
      ],
      tip: 'Rule #1 of Mergekit: Model A and Model B must share the same architecture &amp; parameter count (e.g., two 3B Qwen models can merge; a Qwen 3B + Llama 8B cannot).',
      nav: async () => {
        A.studio && A.studio.go('modelsuite'); await wait(450);
        const btn = document.querySelector('#msTabs [data-t="mergekit"]'); if (btn) btn.click();
        await wait(200);
      },
      spotlight: '#mgBuildYaml',
      demoLabel: '✨ Fill Example Blend & Preview YAML',
      demo: async () => {
        const setVal = (sel, v) => { const e = document.querySelector(sel); if (e) e.value = v; };
        setVal('#mgName', 'qwen25-chat-coder-slerp');
        setVal('#mgA', 'Qwen/Qwen2.5-1.5B-Instruct');
        setVal('#mgB', 'Qwen/Qwen2.5-Coder-1.5B-Instruct');
        setVal('#mgBase', '');
        setVal('#mgT', '0.5');
        const btn = document.querySelector('#mgBuildYaml');
        if (btn) btn.click();
        A.toast('Generated a valid 50/50 SLERP merge recipe! Check the YAML preview below.', 4500);
        highlightEl(document.querySelector('#mgYaml') || btn, 'Generated Mergekit YAML recipe');
      }
    },
    {
      id: 'autoresearch',
      icon: '🔬',
      badge: 'Model Suite · 3/3',
      title: 'Model Suite: Autonomous ML Lab (Autoresearch)',
      where: 'Studio › 🧬 Model Suite › 🔬 Autoresearch  (karpathy/autoresearch)',
      summary: 'Andrej Karpathy\'s miniature autonomous AI research harness. It trains a small language model on your GPU in short timed runs and logs validation loss (val_bpb) so you — or an AI agent — can test architecture ideas.',
      io: ['Edits to train.py (hyperparameters, optimizer, layers)', 'Timed CUDA training run + validation score log'],
      steps: [
        'First-time only: click <b>Prepare Data</b> to download the tiny starter tokenizer &amp; dataset shard.',
        'Inspect or tweak <code>train.py</code> right inside the built-in editor (or ask Chat › Agent to propose an experiment!).',
        'Press <b>▶ Run Experiment</b> to launch a timed GPU training run and compare whether your change lowered the loss.'
      ],
      tip: 'This tab is for hands-on ML tinkering — if you just want to chat, code, edit photos, or convert docs, you can skip this one safely!',
      nav: async () => {
        A.studio && A.studio.go('modelsuite'); await wait(450);
        const btn = document.querySelector('#msTabs [data-t="autoresearch"]'); if (btn) btn.click();
        await wait(200);
      },
      spotlight: '#ms-autoresearch',
      demoLabel: '🔬 Focus Experiment Controls',
      demo: async () => {
        const el = document.querySelector('#ms-autoresearch');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); highlightEl(el, 'Edit train.py & run timed GPU experiments here'); }
      }
    },
    {
      id: 'markitdown',
      icon: '📝',
      badge: 'Tools › MarkItDown',
      title: 'MarkItDown: Convert Any Document to Markdown',
      where: 'Tools › 📝 MarkItDown  (microsoft/markitdown)',
      summary: 'AI models and Notes love clean Markdown — not messy PDFs, Word docs, Excel spreadsheets, or PowerPoints. Drop almost any office or web file here and turn it into spotless Markdown offline.',
      io: ['PDF, DOCX, PPTX, XLSX, HTML, CSV, JSON, XML, or ZIP', 'Clean Markdown you can Preview, Copy, Download .md, or Save to Notes'],
      steps: [
        'Drag &amp; drop any file into the dashed box (or click <b>Convert Sample Document Now</b> below to watch it work live!).',
        'Toggle between <b>Raw Markdown</b> and rendered <b>Preview</b> to inspect headings, tables, and lists.',
        'Click <b>💾 Save to Notes</b> so Moundshroud Chat can immediately search and answer questions about that document!'
      ],
      tip: 'Pro workflow: Convert a long PDF or Excel report with MarkItDown → click <b>Save to Notes</b> → ask Chat about it with <b>Use my files</b> checked!',
      nav: async () => {
        A.showTab('tools'); await wait(250);
        if (A.tools && A.tools.go) A.tools.go('md');
        await wait(350);
      },
      spotlight: '#mkDrop',
      demoLabel: '📄 Convert Sample Document Live!',
      demo: async () => {
        const sampleHtml = [
          '<!doctype html><html><head><title>Moundshroud Field Notes</title></head><body>',
          '<h1>Moundshroud Studio Quick-Start Report</h1>',
          '<p>This sample HTML document was converted locally by <strong>microsoft/markitdown</strong> with zero internet required.</p>',
          '<h2>Tool Summary</h2>',
          '<table><thead><tr><th>Tool</th><th>Location</th><th>Best For</th></tr></thead><tbody>',
          '<tr><td>Photo Editor</td><td>Studio &gt; Photo Editor</td><td>Layers + LaMa AI Magic Eraser</td></tr>',
          '<tr><td>Media Lab</td><td>Studio &gt; Media Lab</td><td>Background removal, 4x upscaling, song stems</td></tr>',
          '<tr><td>Model Suite</td><td>Studio &gt; Model Suite</td><td>Benchmarks, SLERP merges, GPU research</td></tr>',
          '</tbody></table>',
          '<h2>Next Step</h2><ul><li>Click <b>Preview</b> to see formatted tables.</li><li>Click <b>Save to Notes</b> to keep it searchable in Chat!</li></ul>',
          '</body></html>'
        ].join('');
        const file = new File([sampleHtml], 'moundshroud-demo-report.html', { type: 'text/html' });
        if (injectFileIntoInput('#mkFile', file)) {
          A.toast('Converting sample document live with MarkItDown…', 3000);
          setTimeout(() => {
            const out = document.querySelector('#mkOutWrap');
            if (out && out.style.display !== 'none') highlightEl(out, 'Converted clean Markdown!');
          }, 1500);
        }
      }
    }
  ];

  /* ---- Floating Spotlight + Interactive Guide Card CSS ---- */
  function injectCss() {
    if (document.getElementById('rtut-css')) return;
    const s = document.createElement('style');
    s.id = 'rtut-css';
    s.textContent = `
#rtut-card{
  position:fixed;right:20px;bottom:20px;z-index:2600;width:min(440px,calc(100vw - 28px));max-height:min(82vh,680px);
  display:flex;flex-direction:column;overflow:hidden;border-radius:20px;
  border:1px solid color-mix(in srgb,var(--acc,#8b7cff) 55%,var(--line,#2a3042));
  background:linear-gradient(180deg,color-mix(in srgb,var(--panel2,#1d212e) 94%,var(--panel,#161923)),color-mix(in srgb,var(--panel,#161923) 98%,var(--bg,#0e1016)));
  box-shadow:0 26px 70px -12px rgba(0,0,0,.78),0 0 0 1px rgba(255,255,255,.08) inset;
  color:var(--text,#eceef5);font-family:var(--f-ui,"Segoe UI",system-ui,sans-serif);
  animation:rtutIn .26s cubic-bezier(.16,1,.3,1) both;
}
@keyframes rtutIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
#rtut-card.min{max-height:56px;width:300px}
#rtut-card.min .rtut-bd,#rtut-card.min .rtut-ft,#rtut-card.min .rtut-prog{display:none}
.rtut-hd{
  display:flex;align-items:center;gap:9px;padding:12px 14px;cursor:grab;user-select:none;
  border-bottom:1px solid color-mix(in srgb,var(--line) 80%,transparent);
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 20%,var(--panel2)),color-mix(in srgb,var(--acc2,#46d7c8) 10%,var(--panel2)));
}
.rtut-ic{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:18px;flex:none;background:color-mix(in srgb,var(--acc) 22%,var(--panel));border:1px solid color-mix(in srgb,var(--acc) 45%,transparent)}
.rtut-meta{flex:1;min-width:0}
.rtut-badge{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--acc2,#46d7c8)}
.rtut-title{font-size:14.5px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rtut-hbtn{width:28px;height:28px;border-radius:8px;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:color-mix(in srgb,var(--panel) 65%,transparent);color:var(--mute);display:grid;place-items:center;cursor:pointer;font-size:13px}
.rtut-hbtn:hover{color:var(--text);border-color:var(--acc)}
.rtut-prog{height:3px;background:color-mix(in srgb,var(--line) 60%,transparent);flex:none}
.rtut-prog i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2,#46d7c8));transition:width .32s ease}
.rtut-bd{flex:1;min-height:0;overflow:auto;padding:14px 16px;font-size:13.2px;line-height:1.55}
.rtut-where{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent);border:1px solid color-mix(in srgb,var(--acc) 28%,transparent);margin-bottom:9px}
.rtut-sum{margin:0 0 11px;color:var(--text)}
.rtut-io{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.rtut-io > div{padding:8px 10px;border-radius:11px;border:1px solid color-mix(in srgb,var(--line) 75%,transparent);background:color-mix(in srgb,var(--bg) 45%,var(--panel2));font-size:12px;line-height:1.4}
.rtut-io b{display:block;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin-bottom:2px}
.rtut-steps{list-style:none;margin:0 0 11px;padding:0;display:flex;flex-direction:column;gap:7px}
.rtut-steps li{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-radius:11px;border:1px solid color-mix(in srgb,var(--line) 65%,transparent);background:color-mix(in srgb,var(--panel2) 55%,transparent)}
.rtut-num{width:20px;height:20px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;font-weight:700;background:color-mix(in srgb,var(--acc) 25%,var(--panel));color:var(--text);margin-top:1px}
.rtut-tip{padding:9px 11px;border-radius:11px;border-left:3px solid var(--acc2,#46d7c8);background:color-mix(in srgb,var(--acc2,#46d7c8) 9%,var(--panel2));font-size:12.2px;color:var(--mute);margin-bottom:11px}
.rtut-tip b{color:var(--text)}
.rtut-demo{width:100%;padding:10px 14px;border-radius:12px;border:0;font-weight:700;font-size:13px;cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--acc,#8b7cff),var(--acc2,#46d7c8));box-shadow:0 8px 22px -8px color-mix(in srgb,var(--acc) 60%,transparent);transition:transform .14s,filter .14s;margin-bottom:8px}
.rtut-demo:hover{transform:translateY(-1px);filter:brightness(1.07)}
.rtut-hub{display:grid;grid-template-columns:1fr;gap:6px;margin-top:10px}
.rtut-hub button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:8px 11px;border-radius:11px;border:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:color-mix(in srgb,var(--panel2) 65%,transparent);color:var(--text);cursor:pointer;transition:border-color .15s,background-color .15s,transform .12s}
.rtut-hub button:hover{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,var(--panel2));transform:translateX(2px)}
.rtut-hub button .rt-ck{margin-left:auto;font-size:12px;color:var(--ok,#5ee6a8)}
.rtut-ft{display:flex;align-items:center;gap:6px;padding:10px 14px;border-top:1px solid color-mix(in srgb,var(--line) 80%,transparent);background:color-mix(in srgb,var(--panel2) 45%,transparent)}
.rtut-ft .sp{flex:1}
#rtut-spot{
  position:fixed;z-index:2590;pointer-events:none;border-radius:12px;
  border:2.5px solid var(--acc2,#46d7c8);
  box-shadow:0 0 0 5px color-mix(in srgb,var(--acc2,#46d7c8) 26%,transparent),0 0 28px color-mix(in srgb,var(--acc,#8b7cff) 55%,transparent);
  transition:all .24s cubic-bezier(.16,1,.3,1);
  animation:rtutPulse 1.4s ease-in-out infinite;
}
#rtut-spot-lbl{
  position:absolute;left:0;top:-30px;white-space:nowrap;padding:3px 10px;border-radius:999px;
  background:linear-gradient(135deg,var(--acc,#8b7cff),var(--acc2,#46d7c8));color:#fff;font-size:11.5px;font-weight:700;
  box-shadow:0 6px 16px rgba(0,0,0,.45);
}
@keyframes rtutPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
`;
    document.head.appendChild(s);
  }

  let card = null, spot = null, spotTimer = 0, curIdx = 0, navToken = 0;

  function clearSpotlight() {
    clearTimeout(spotTimer);
    if (spot) { spot.remove(); spot = null; }
  }

  function highlightEl(el, label) {
    clearSpotlight();
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    spot = document.createElement('div');
    spot.id = 'rtut-spot';
    spot.style.left = Math.max(4, r.left - 5) + 'px';
    spot.style.top = Math.max(4, r.top - 5) + 'px';
    spot.style.width = (r.width + 10) + 'px';
    spot.style.height = (r.height + 10) + 'px';
    if (label) {
      const lb = document.createElement('div');
      lb.id = 'rtut-spot-lbl';
      lb.textContent = label;
      if (r.top < 42) lb.style.top = (r.height + 14) + 'px';
      spot.appendChild(lb);
    }
    document.body.appendChild(spot);
    spotTimer = setTimeout(clearSpotlight, 5200);
  }

  function close() {
    clearSpotlight();
    if (card) { card.remove(); card = null; }
  }

  function makeDraggable(box, handle) {
    let drag = null;
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      const r = box.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      box.style.right = 'auto'; box.style.bottom = 'auto';
      box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
      handle.style.cursor = 'grabbing';
      try { handle.setPointerCapture(e.pointerId); } catch (x) { }
    });
    handle.addEventListener('pointermove', e => {
      if (!drag) return;
      const nx = Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, e.clientX - drag.dx));
      const ny = Math.max(8, Math.min(window.innerHeight - 56, e.clientY - drag.dy));
      box.style.left = nx + 'px'; box.style.top = ny + 'px';
    });
    const end = () => { drag = null; handle.style.cursor = 'grab'; };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  async function goStep(index, doNav) {
    curIdx = Math.max(0, Math.min(LESSONS.length - 1, index));
    const L = LESSONS[curIdx];
    const done = getDone();
    if (L.id !== 'hub') { done.add(L.id); saveDone(done); }
    const my = ++navToken;

    if (doNav !== false && L.nav) {
      try { await L.nav(); } catch (e) { }
      if (my !== navToken || !card) return;
    }

    const pct = Math.round(((curIdx + 1) / LESSONS.length) * 100);
    card.querySelector('.rtut-ic').textContent = L.icon;
    card.querySelector('.rtut-badge').textContent = L.badge + ' · ' + (curIdx + 1) + ' / ' + LESSONS.length;
    card.querySelector('.rtut-title').textContent = L.title;
    card.querySelector('.rtut-prog i').style.width = pct + '%';

    let body = '<div class="rtut-where">📍 ' + esc(L.where) + '</div>' +
      '<p class="rtut-sum">' + L.summary + '</p>';

    if (L.io) {
      body += '<div class="rtut-io">' +
        '<div><b>What Goes In</b>' + esc(L.io[0]) + '</div>' +
        '<div><b>What Comes Out</b>' + esc(L.io[1]) + '</div>' +
      '</div>';
    }

    if (L.id === 'hub') {
      body += '<div class="rtut-hub">' + LESSONS.slice(1).map((x, idx) =>
        '<button type="button" data-jump="' + (idx + 1) + '">' +
          '<span style="font-size:17px">' + x.icon + '</span>' +
          '<span style="flex:1;min-width:0"><b style="display:block;font-size:12.8px">' + esc(x.title) + '</b><span class="small mute">' + esc(x.badge) + '</span></span>' +
          '<span class="rt-ck">' + (done.has(x.id) ? '✓ Seen' : '→') + '</span>' +
        '</button>'
      ).join('') + '</div>';
    } else {
      body += '<ol class="rtut-steps">' + L.steps.map((st, i) =>
        '<li><span class="rtut-num">' + (i + 1) + '</span><div>' + st + '</div></li>'
      ).join('') + '</ol>';
    }

    if (L.demo && L.demoLabel) {
      body += '<button type="button" class="rtut-demo" id="rtut-demo">' + esc(L.demoLabel) + '</button>';
    }
    if (L.tip) {
      body += '<div class="rtut-tip"><b>💡 Tip:</b> ' + L.tip + '</div>';
    }

    const bd = card.querySelector('.rtut-bd');
    bd.innerHTML = body;
    bd.scrollTop = 0;

    card.querySelector('#rtut-prev').disabled = curIdx === 0;
    card.querySelector('#rtut-next').textContent = curIdx === LESSONS.length - 1 ? '✓ Finish' : 'Next →';

    const demoBtn = bd.querySelector('#rtut-demo');
    if (demoBtn && L.demo) {
      demoBtn.onclick = () => L.demo();
    }
    bd.querySelectorAll('[data-jump]').forEach(btn => {
      btn.onclick = () => goStep(+btn.dataset.jump, true);
    });

    if (L.spotlight) {
      const target = document.querySelector(L.spotlight);
      if (target) highlightEl(target, L.badge);
    } else {
      clearSpotlight();
    }
  }

  function open(lessonId) {
    injectCss();
    if (!card) {
      card = document.createElement('aside');
      card.id = 'rtut-card';
      card.setAttribute('aria-label', 'Interactive Studio and Tools Guide');
      card.innerHTML =
        '<div class="rtut-hd">' +
          '<div class="rtut-ic">🎓</div>' +
          '<div class="rtut-meta"><div class="rtut-badge">Interactive Guide</div><div class="rtut-title">New Studio &amp; Tools</div></div>' +
          '<button type="button" class="rtut-hbtn" id="rtut-hub" title="All lessons">☰</button>' +
          '<button type="button" class="rtut-hbtn" id="rtut-min" title="Minimize">–</button>' +
          '<button type="button" class="rtut-hbtn" id="rtut-x" title="Close">✕</button>' +
        '</div>' +
        '<div class="rtut-prog"><i style="width:10%"></i></div>' +
        '<div class="rtut-bd"></div>' +
        '<div class="rtut-ft">' +
          '<button type="button" class="ib" id="rtut-prev">← Back</button>' +
          '<button type="button" class="ib" id="rtut-show" title="Jump back to this tool & highlight it">📍 Show me</button>' +
          '<span class="sp"></span>' +
          '<button type="button" class="pri" id="rtut-next">Next →</button>' +
        '</div>';
      document.body.appendChild(card);
      makeDraggable(card, card.querySelector('.rtut-hd'));
      card.querySelector('#rtut-x').onclick = close;
      card.querySelector('#rtut-min').onclick = () => {
        card.classList.toggle('min');
        card.querySelector('#rtut-min').textContent = card.classList.contains('min') ? '▢' : '–';
      };
      card.querySelector('#rtut-hub').onclick = () => goStep(0, false);
      card.querySelector('#rtut-prev').onclick = () => goStep(curIdx - 1, true);
      card.querySelector('#rtut-show').onclick = () => goStep(curIdx, true);
      card.querySelector('#rtut-next').onclick = () => {
        if (curIdx >= LESSONS.length - 1) { close(); A.toast('Tutorial complete! Reopen anytime via 🎓 Guide or Ctrl+K.', 4000); }
        else goStep(curIdx + 1, true);
      };
    } else {
      card.classList.remove('min');
      card.querySelector('#rtut-min').textContent = '–';
    }

    const found = lessonId ? LESSONS.findIndex(x => x.id === lessonId) : 0;
    goStep(found >= 0 ? found : 0, !!lessonId);
  }

  A.repoTutorial = { open, close, lessons: LESSONS.map(l => ({ id: l.id, title: l.title, badge: l.badge })) };

  if (A.cmd && A.cmd.reg) {
    A.cmd.reg([{
      title: 'Interactive Tutorial: New Studio & Tools Guide',
      sub: 'Step-by-step live walkthrough with demos for Heretic, Photo Editor, Media Lab, Model Suite & MarkItDown',
      icon: '🎓',
      group: 'Help',
      tags: 'tutorial guide walkthrough heretic photo editor minipaint lama media lab rembg upscaler demucs model suite mergekit eval autoresearch markitdown help how to use',
      run: () => open('hub')
    }]);
  }
})();
