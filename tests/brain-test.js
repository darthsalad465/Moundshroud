// Automated performance & regression checks for the 3D File Brain (1M+ file backend & WebGL GPU frontend).
// Run standalone: node tests\brain-test.js  (also invoked by tests\run.js)
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

async function run(ok) {
  const ROOT = path.join(__dirname, '..');
  const brain = require(path.join(ROOT, 'lib', 'pc-brain.js'));
  const backendSrc = fs.readFileSync(path.join(ROOT, 'lib', 'pc-brain.js'), 'utf8');
  const frontendSrc = fs.readFileSync(path.join(ROOT, 'web', 'js', 'brain.js'), 'utf8');

  console.log('3D Brain architecture & 1,000,000-file performance');
  ok('brain: backend uses O(1) queueHead instead of O(N) queue.shift()', /queueHead/.test(backendSrc) && !/INDEX\.queue\.shift\(/.test(backendSrc));
  ok('brain: backend uses compact TypedArrays (Uint32Array & Uint8Array)', /Uint32Array/.test(backendSrc) && /Uint8Array/.test(backendSrc));
  ok('brain: backend uses time-budgeted stepIndex', /function stepIndex\(maxDirs,\s*maxMs\)/.test(backendSrc) && /budgetMs/.test(backendSrc));
  ok('brain: backend uses 8,192-filename chunked SIMD indexOf search', /CHUNK_SIZE\s*=\s*8192/.test(backendSrc) && /chunksLow/.test(backendSrc));

  ok('brain: frontend has WebGL GPU renderer (points + lines shaders)', /function initWebGL\(/.test(frontendSrc) && /function drawPointsWebGL\(/.test(frontendSrc) && /function drawLinesWebGL\(/.test(frontendSrc));
  ok('brain: frontend cleans up WebGL vertex attrib arrays after draw', /disableVertexAttribArray\(a\.aMeta\)/.test(frontendSrc) && /disableVertexAttribArray\(a\.aCol\)/.test(frontendSrc));
  ok('brain: frontend has pre-baked sprite 2D fallback', /function ensureSprites2D\(/.test(frontendSrc) && /function drawFallback2D\(/.test(frontendSrc));
  ok('brain: frontend removes expensive backdrop-filter blur from .brn-glass', !/\.brn-glass\{[^}]*backdrop-filter\s*:\s*blur/i.test(frontendSrc));
  ok('brain: frontend caches lobe bar DOM instead of rebuilding innerHTML every poll', /lobesBuilt/.test(frontendSrc) && /lobeEls\.get\(/.test(frontendSrc));
  ok('brain: frontend stops requestAnimationFrame loop when tab is inactive or hidden', /function ensureLoop\(/.test(frontendSrc) && /A\.cur !== 'brain' \|\| document\.hidden/.test(frontendSrc));
  ok('brain: frontend handles folder lobe filter cleanly in star-cloud shader', /rawFilterIdx >= 0 \? rawFilterIdx : 99/.test(frontendSrc));
  {
    const drawBody = frontendSrc.slice(frontendSrc.indexOf('function drawFrame()'), frontendSrc.indexOf('function findNodeAt('));
    ok('brain: frontend draw loop does zero per-frame createRadialGradient calls', !/\.createRadialGradient\s*\(/.test(drawBody));
  }

  {
    const g = brain.scanGraph({ scope: 'custom', path: path.join(ROOT, 'lib'), force: true });
    ok('brain: live folder scan returns graph nodes and links', g && g.ok && Array.isArray(g.nodes) && g.nodes.length > 0 && Array.isArray(g.links));
    const hit = brain.searchAllIndexed('pc-brain.js', 10);
    ok('brain: live search finds pc-brain.js in scanned folder', hit && hit.matches && hit.matches.some(m => m.name === 'pc-brain.js'), JSON.stringify(hit && hit.matches));
  }

  {
    // Stress-test 1,000,000 files across 122+ chunks + tail buffer
    brain.scanGraph({ scope: 'custom', path: path.join(ROOT, 'tests'), force: true });
    const N = 1000000;
    const memBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      let name;
      if (i === 0) name = 'FirstBoundaryNeedle_Alpha.md';
      else if (i === 8191) name = 'ChunkEndNeedle_8191.js';
      else if (i === 8192) name = 'ChunkStartNeedle_8192.py';
      else if (i === 500000) name = 'HalfMillionNeedle_Secret.json';
      else if (i === N - 1) name = 'TailBufferNeedle_Millionth.txt';
      else name = 'item_' + i + '.dat';
      brain._recordFileForTest(name, 0, i % 6);
    }
    const indexMs = performance.now() - t0;
    const heapDeltaMB = (process.memoryUsage().heapUsed - memBefore) / (1024 * 1024);

    const s0 = performance.now();
    const r1 = brain.searchAllIndexed('halfmillionneedle_secret', 10);
    const searchMs = performance.now() - s0;
    const rChunk = brain.searchAllIndexed('chunkendneedle_8191', 10);
    const rChunkNext = brain.searchAllIndexed('chunkstartneedle_8192', 10);
    const rTail = brain.searchAllIndexed('tailbufferneedle_millionth', 10);
    const rFirst = brain.searchAllIndexed('firstboundaryneedle_alpha', 10);

    ok(`brain: 1M-file indexing finishes in < 3000ms (${indexMs.toFixed(0)}ms)`, indexMs < 3000, indexMs.toFixed(1) + 'ms');
    ok(`brain: 1M-file search finishes in < 250ms (${searchMs.toFixed(2)}ms)`, searchMs < 250, searchMs.toFixed(2) + 'ms');
    ok(`brain: 1M-file heap delta stays under 250 MB (${heapDeltaMB.toFixed(1)} MB)`, heapDeltaMB < 250, heapDeltaMB.toFixed(1) + ' MB');
    ok('brain: 1M-file search finds entry 0 with original case', rFirst.matches.some(m => m.name === 'FirstBoundaryNeedle_Alpha.md'));
    ok('brain: 1M-file search finds chunk-end entry 8191', rChunk.matches.some(m => m.name === 'ChunkEndNeedle_8191.js'));
    ok('brain: 1M-file search finds chunk-start entry 8192', rChunkNext.matches.some(m => m.name === 'ChunkStartNeedle_8192.py'));
    ok('brain: 1M-file search finds mid-million entry 500,000', r1.matches.some(m => m.name === 'HalfMillionNeedle_Secret.json'));
    ok('brain: 1M-file search finds tail-buffer entry 999,999', rTail.matches.some(m => m.name === 'TailBufferNeedle_Millionth.txt'));
  }
}

module.exports = run;

if (require.main === module) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fail++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')); }
  };
  run(ok).then(() => {
    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  });
}
