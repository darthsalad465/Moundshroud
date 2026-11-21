// Static allowlist for files the opaque-origin Cyber Desktop terminal can load.
const prefix = '/web/cyber-guest/';
const terminalPage = '/web/cyber-desktop-terminal.html';
const files = new Set([
  'cyber-desktop.css', 'terminal-manual.css', 'terminal-command-coach.css',
  'js/cyber-desktop-terminal.js', 'js/interp.js', 'js/terminal-sandbox-python.js',
  'js/terminal-unix.js', 'js/terminal-playground-data.js', 'js/terminal-playground-data2.js',
  'js/terminal-playground-data3.js', 'js/terminal-playground-curios.js', 'js/terminal-playground-jobs.js',
  'js/terminal-scenarios.js', 'js/terminal-manual-content.js', 'js/terminal-manual-beginner.js',
  'js/terminal-manual.js', 'js/terminal-command-coach.js', 'js/terminal-labyrinth-data.js',
  'js/terminal-labyrinth-data2.js', 'js/terminal-labyrinth.js', 'js/terminal-puzzles.js',
  'js/terminal-pentest.js', 'js/terminal-remote.js',
  'js/mcode-custom.js', 'js/mcode-swarm.js', 'js/mcode-whip.js', 'js/terminal-playground-mcode.js',
  'js/terminal-playground.js', 'vendor/python-libs/chess.zip', 'vendor/python-libs/sandbox-shims.zip'
]);
function asset(pathname) {
  if (!pathname.startsWith(prefix)) return null;
  const name = pathname.slice(prefix.length);
  const python = /^vendor\/pyodide\/(?:pyodide(?:\.asm)?\.js|pyodide\.asm\.wasm|pyodide-lock\.json|python_stdlib\.zip|[a-z0-9_.-]+\.whl)$/i.test(name);
  return files.has(name) || python ? name : null;
}
function policy(origin) {
  const base = origin + prefix;
  return "default-src 'none'; script-src 'unsafe-eval' blob: " + base + "js/ " + base + "vendor/pyodide/; " +
    "style-src 'unsafe-inline' " + base + "; img-src data: blob:; worker-src blob:; " +
    "connect-src " + base + "vendor/pyodide/ " + base + "vendor/python-libs/; " +
    "frame-ancestors 'self'; base-uri 'none'; form-action 'none'";
}
const assetHeaders = { 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*' };
module.exports = { asset, assetHeaders, policy, terminalPage };
