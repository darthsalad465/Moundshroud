// Exercise the standalone zero-localhost backend with the exact Electron runtime distributed by NSIS.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const app = path.resolve(process.argv[2] || path.join(__dirname, 'dist', 'win-unpacked'));
  const core = path.join(app, 'resources', 'app-core');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'moundshroud-smoke-'));
  const bridgePath = path.join(__dirname, 'inprocess-bridge.js');

  const script = `
    const path = require('path');
    const { dispatchToHandler } = require(${JSON.stringify(bridgePath)});
    const embedded = require(path.join(${JSON.stringify(core)}, 'server.js'));
    (async () => {
      const st = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/api/status'));
      const sj = await st.json();
      if (!st.ok || !sj.ok) throw new Error('Status failed: HTTP ' + st.status);
      const pg = await dispatchToHandler(embedded.handleAppRequest, new Request('app://moundshroud/'));
      const html = await pg.text();
      if (!pg.ok || !/Moundshroud/i.test(html)) throw new Error('Missing app UI: HTTP ' + pg.status);
      embedded.shutdown();
      console.log('Packaged standalone runtime served status and app UI on app://moundshroud with zero localhost ports.');
      process.exit(0);
    })().catch(err => { console.error(err); process.exit(1); });
  `;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(path.join(app, 'Moundshroud.exe'), ['-e', script], {
        cwd: core,
        stdio: 'inherit',
        windowsHide: true,
        env: { ...process.env, USERPROFILE: data, ELECTRON_RUN_AS_NODE: '1', MOUNDSHROUD_DATA: data, MOUNDSHROUD_EMBEDDED: '1', MOUNDSHROUD_DESKTOP: '1' }
      });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error('Smoke test exited with code ' + code)));
    });
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
