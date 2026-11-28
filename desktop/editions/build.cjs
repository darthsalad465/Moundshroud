'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { editions } = require('./catalog.cjs');

const root = path.resolve(__dirname, '../..');
const buildRoot = path.join(root, 'desktop', 'dist', 'editions');
const version = '0.1.0';
const excluded = [
  /^(?:web\/js\/)?(?:cyber|terminal-|artex|deep-?eye|moundshell|shell-langs|access-exercise)/i,
  /^web\/(?:cyber|terminal-|moundhub)/i,
  /^lib\/(?:artex|deep-?eye|pcshell|realnet|juiceshop|cybertools|sample-lab|terminal)/i,
  /(?:^|\/)(?:\.env|node_modules|profile|runtime)(?:$|[/.])/i,
  /\.(?:exe|dll|zip|pem|key|log|db|gguf|safetensors)$/i
];
const allowedAsset = file => file === 'server.js' || file === 'LICENSE' || file === 'VERSION' ||
  file === 'ocr.ps1' || file === 'pc-volume.ps1' ||
  /^(lib|web|py)\//.test(file) || /^data\/cmudict(?:\.dict|-LICENSE\.txt)$/.test(file);

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 ** 2 }).trim();
}

function replace(file, before, after) {
  const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (!source.includes(before)) throw new Error(`Missing build anchor in ${path.basename(file)}: ${before}`);
  fs.writeFileSync(file, source.replace(before, after));
}

function copy(source, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
}

function extractBaseline(stage, sourceRef) {
  const archive = path.join(stage, 'source.tar');
  const baseline = path.join(stage, 'source');
  fs.mkdirSync(baseline);
  git('archive', '--format=tar', '-o', archive, sourceRef, 'web', 'desktop', 'server.js', 'lib',
    'VERSION', 'LICENSE', 'ocr.ps1', 'pc-volume.ps1', 'py', 'data/cmudict.dict', 'data/cmudict-LICENSE.txt');
  execFileSync('tar', ['-xf', archive, '-C', baseline], { stdio: 'inherit', windowsHide: true });
  fs.unlinkSync(archive);
  return baseline;
}

function stagedCore(baseline, destination) {
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (entry.isDirectory() && /^(lib|web|py|data)(?:\/|$)/.test(rel)) {
        visit(path.join(directory, entry.name), rel + '/');
      } else if (entry.isFile() && allowedAsset(rel) && !excluded.some(pattern => pattern.test(rel))) {
        copy(path.join(directory, entry.name), path.join(destination, rel));
      }
    }
  };
  visit(baseline);
  // The shared server has eager imports for these tools. Keep the public editions inert.
  const lib = path.join(destination, 'lib');
  fs.writeFileSync(path.join(lib, 'artex.js'), "module.exports = { PORT: 8787, PROXY_PORT: 8788, installed: () => false, stopAll() {} };\n");
  fs.writeFileSync(path.join(lib, 'cybertools.js'), 'module.exports = {};\n');
  fs.writeFileSync(path.join(lib, 'juiceshop.js'), 'module.exports = { FRAME: 8789, stop() {} };\n');
}

function stageApp(stage, baseline, id) {
  const profile = editions[id];
  const project = path.join(stage, id);
  const core = path.join(project, 'app-core');
  const web = path.join(core, 'web');
  fs.mkdirSync(web, { recursive: true });
  copy(path.join(baseline, 'LICENSE'), path.join(project, 'LICENSE'));
  copy(path.join(baseline, 'web', 'moundshroud.ico'), path.join(web, 'moundshroud.ico'));
  copy(path.join(baseline, 'web', 'logo-64.png'), path.join(web, 'logo-64.png'));
  copy(path.join(__dirname, 'catalog.cjs'), path.join(project, 'catalog.cjs'));
  fs.writeFileSync(path.join(project, 'edition.json'), JSON.stringify({ id, ...profile }));

  if (id === 'cyber') {
    for (const file of ['cyber.css', 'cyber.js']) copy(path.join(__dirname, file), path.join(web, file));
    copy(path.join(__dirname, 'cyber.html'), path.join(web, 'index.html'));
    copy(path.join(__dirname, 'static.cjs'), path.join(project, 'main.js'));
  } else {
    stagedCore(baseline, core);
    const editionSource = `const EDITION = ${JSON.stringify({ id, ...profile })};\n` +
      fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');
    fs.writeFileSync(path.join(web, 'edition.js'), editionSource);
    copy(path.join(__dirname, 'renderer.css'), path.join(web, 'edition.css'));
    const html = path.join(web, 'index.html');
    let page = fs.readFileSync(html, 'utf8');
    const standaloneOmit = new Set(['os-shell.js', 'onboarding.js', 'updates.js', 'whatsnew.js', 'appedit.js', 'repo-store.js']);
    page = page.replace(/<script\b[^>]*\bsrc="\/web\/([^"]+)"[^>]*><\/script>/g, (full, rel) =>
      fs.existsSync(path.join(web, rel)) && !standaloneOmit.has(path.basename(rel)) ? full : '');
    page = page.replace(/<link\b[^>]*\bhref="\/web\/([^"]+)"[^>]*>/g, (full, rel) =>
      fs.existsSync(path.join(web, rel)) ? full : '');
    page = page.replace('<script defer src="/web/js/core.js"></script>',
      '<script defer src="/web/js/core.js"></script>\n<script defer src="/web/edition.js"></script>');
    page = page.replace('</head>', '<link rel="stylesheet" href="/web/edition.css">\n</head>');
    if (!page.includes('src="/web/edition.js"')) throw new Error('Missing desktop renderer setup');
    fs.writeFileSync(html, page);
    replace(path.join(web, 'js', 'main.js'), 'incoming(); A.guide.firstRun();', '');
    for (const name of ['main.js', 'backend-worker.js', 'inprocess-bridge.js', 'preload.js', 'splash.html']) {
      copy(path.join(baseline, 'desktop', name), path.join(project, name));
    }
    const main = path.join(project, 'main.js');
    replace(main, "const APP_ORIGIN = 'app://moundshroud';",
      "const edition = require('./edition.json');\nconst { permits } = require('./catalog.cjs');\n" +
      "app.setName(edition.name);\napp.setAppUserModelId('org.moundshroud.' + edition.id);\nconst APP_ORIGIN = 'app://moundshroud';");
    replace(main, "if (!app.isPackaged) {\n  app.setPath('userData', path.join(CORE_DIR, 'desktop-profile'));\n}",
      "if (process.env.MOUNDSHROUD_EDITION_PROFILE) app.setPath('userData', process.env.MOUNDSHROUD_EDITION_PROFILE);");
    replace(main, "  : path.resolve(__dirname, '..');", "  : path.join(__dirname, 'app-core');");
    replace(main, "  : path.join(CORE_DIR, 'data');", "  : path.join(app.getPath('userData'), 'data');");
    replace(main, "return forwardToWorker('app', request);",
      "return permits(edition.id, u.pathname) ? forwardToWorker('app', request) : new Response(null, { status: 404 });");
    replace(main, "if (u.host === 'moundshroud-lib') {", "if (edition.id === 'library' && u.host === 'moundshroud-lib') {");
    replace(main, "  if (!START_HIDDEN) createSplash();\n  buildTray();", '');
    replace(main, "    await migrateEdgeDataIfNeeded();", '');
    replace(main, "  registerHotkeys();", '');
    replace(main, "  createMainWindow(START_HIDDEN);", `  createMainWindow(START_HIDDEN || process.argv.includes('--edition-smoke'));
  if (process.argv.includes('--edition-smoke')) require('./smoke.cjs')(mainWin, edition);`);
    replace(main, "  if (quitting) app.quit();", "  app.quit();");
    const worker = path.join(project, 'backend-worker.js');
    replace(worker, "try { embedded.startBackground(); } catch (e) { console.error('startBackground error:', e); }", '');
  }

  copy(path.join(__dirname, 'smoke.cjs'), path.join(project, 'smoke.cjs'));
  const stem = 'Moundshroud-' + id.charAt(0).toUpperCase() + id.slice(1);
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({
    name: 'moundshroud-' + id, productName: profile.name, version,
    description: profile.description, license: 'MIT', author: 'The Moundshroud authors', main: 'main.js'
  }, null, 2) + '\n');
  return { project, stem, profile };
}

async function main() {
  const args = process.argv.slice(2);
  const channel = args.find(arg => arg.startsWith('--output='))?.slice(9);
  if (channel && !/^[a-z0-9][a-z0-9-]*$/i.test(channel)) throw new Error('Invalid output directory name');
  const output = channel ? path.join(buildRoot, channel) : buildRoot;
  const select = args.filter(arg => !arg.startsWith('--'));
  const ids = select.length ? [...new Set(select)] : Object.keys(editions);
  for (const id of ids) if (!Object.hasOwn(editions, id)) throw new Error('Unknown edition: ' + id);
  const stageOnly = args.includes('--stage');
  const testOnly = args.includes('--test');
  const baselineRef = git('rev-parse', args.find(arg => arg.startsWith('--source='))?.slice(9) || 'HEAD');
  fs.mkdirSync(output, { recursive: true });
  const stage = fs.mkdtempSync(path.join(output, 'build-'));
  console.log('Staging from ' + baselineRef + ' in ' + stage);
  const baseline = extractBaseline(stage, baselineRef);
  const electronDist = path.join(root, 'desktop', 'node_modules', 'electron', 'dist');
  const electronExe = path.join(electronDist, 'electron.exe');
  for (const id of ids) {
    const { project, stem, profile } = stageApp(stage, baseline, id);
    if (stageOnly) continue;
    if (testOnly) {
      const result = spawnSync(electronExe, [project, '--edition-smoke'], {
        env: { ...process.env, MOUNDSHROUD_EDITION_PROFILE: path.join(stage, id + '-test-profile') },
        timeout: 90_000, windowsHide: true, stdio: 'inherit'
      });
      if (result.error || result.status !== 0) throw result.error || new Error(profile.name + ' smoke test failed');
      continue;
    }
    const { build, Platform, Arch } = require('electron-builder');
    await build({
      projectDir: project,
      targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
      publish: 'never',
      config: {
        appId: 'org.moundshroud.' + id,
        productName: profile.name,
        npmRebuild: false,
        electronVersion: require('electron/package.json').version,
        electronDist,
        directories: { output: path.join(output, id) },
        files: ['**/*.js', '**/*.cjs', 'package.json', 'edition.json', 'splash.html', 'LICENSE', '!app-core/**'],
        extraResources: [{ from: 'app-core', to: 'app-core' }],
        win: { executableName: stem, icon: path.join(project, 'app-core/web/moundshroud.ico'), signExecutable: false },
        nsis: {
          artifactName: stem + '-Setup-' + version + '.exe',
          oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false
        }
      }
    });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
