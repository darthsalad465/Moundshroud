// Exercise the backend with the exact runtime and resources distributed by NSIS.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function main() {
  const app = path.resolve(process.argv[2] || path.join(__dirname, 'dist', 'win-unpacked'));
  const core = path.join(app, 'resources', 'app-core');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'moundshroud-smoke-'));
  const port = 42000 + Math.floor(Math.random() * 10000);
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(path.join(app, 'Moundshroud.exe'), [path.join(core, 'server.js')], {
    cwd: core, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, USERPROFILE: data, ELECTRON_RUN_AS_NODE: '1', MOUNDSHROUD_DATA: data, MOUNDSHROUD_PORT: String(port) }
  });
  try {
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw Error('Packaged server exited during startup');
      const status = await fetch(base + '/api/status').catch(() => null);
      if (status && !status.ok) throw Error('Status endpoint returned HTTP ' + status.status);
      if (status?.ok && (await status.json()).ok) {
        const page = await fetch(base);
        if (!page.ok || !/Moundshroud/i.test(await page.text())) throw Error('Missing app UI');
        console.log('Packaged runtime served the status endpoint and the app UI.');
        return;
      }
      await delay(500);
    }
    throw Error('Packaged server startup timed out');
  } finally {
    if (child.exitCode === null) {
      const stopped = new Promise(resolve => child.once('close', resolve));
      child.kill();
      await stopped;
    }
    fs.rmSync(data, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
