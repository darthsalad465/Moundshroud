// Ollama -> LM Studio auto-sync: parses v1 manifests and v2 manifest lists, hardlinks GGUF + mmproj with zero extra space,
// skips agent copies and non-GGUF blobs, updates when re-pulled, and watches for live pulls.
const crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  const LS = require(path.join(__dirname, '..', 'lib', 'lmstudio-sync.js'));

  /* slug naming */
  eq('lmstudio-sync: library model slug', LS.slugFromName('gemma4:12b'), 'gemma4-12b');
  eq('lmstudio-sync: bare model defaults to latest', LS.slugFromName('lfm3'), 'lfm3-latest');
  eq('lmstudio-sync: namespaced model slug', LS.slugFromName('jaahas/qwen3.5-uncensored:latest'), 'jaahas-qwen3.5-uncensored-latest');
  ok('lmstudio-sync: detects agent copies', LS.isAgentCopy('gemma4-agent-latest') && LS.isAgentCopy('qwen3.5-9b-agent-64k-latest') && !LS.isAgentCopy('qwen3.5-9b'));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-sync-'));
  try {
    const ollamaDir = path.join(tmp, 'ollama');
    const blobsDir = path.join(ollamaDir, 'blobs');
    const lmModelsDir = path.join(tmp, 'lmstudio', 'models');
    const dataDir = path.join(tmp, 'data');
    fs.mkdirSync(blobsDir, { recursive: true });
    fs.mkdirSync(lmModelsDir, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });

    const writeBlob = buf => {
      const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
      const hex = crypto.createHash('sha256').update(b).digest('hex');
      const p = path.join(blobsDir, 'sha256-' + hex);
      fs.writeFileSync(p, b);
      return { digest: 'sha256:' + hex, path: p };
    };
    const writeManifest = (sub, reg, ns, mdl, tag, obj) => {
      const p = path.join(ollamaDir, sub, reg, ns, mdl, tag);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(obj));
      return p;
    };

    const gguf1 = writeBlob(Buffer.concat([Buffer.from('GGUF'), Buffer.from('model-one-weights')]));
    const proj1 = writeBlob(Buffer.concat([Buffer.from('GGUF'), Buffer.from('model-one-mmproj')]));
    const gguf2 = writeBlob(Buffer.concat([Buffer.from('GGUF'), Buffer.from('model-two-v2-weights')]));
    const nonGguf = writeBlob(Buffer.from('NOT-GGUF-SAFETENSORS'));

    /* 1. Direct v1 manifest with model + projector */
    writeManifest('manifests', 'registry.ollama.ai', 'library', 'gemma4', '12b', {
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      layers: [
        { mediaType: 'application/vnd.ollama.image.model', digest: gguf1.digest },
        { mediaType: 'application/vnd.ollama.image.projector', digest: proj1.digest },
      ],
    });

    /* 2. v2 manifest list pointing to inner GGUF manifest blob */
    const innerManifest = writeBlob(JSON.stringify({
      schemaVersion: 2,
      mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
      layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: gguf2.digest }],
    }));
    writeManifest('manifests-v2', 'ollama.com', 'library', 'Qwen3.5', '4b', {
      schemaVersion: 2,
      mediaType: 'application/vnd.ollama.manifest.list.v2+json',
      manifests: [
        { mediaType: 'application/vnd.docker.distribution.manifest.v2+json', digest: innerManifest.digest, runner: 'llamacpp', format: 'gguf' },
        { mediaType: 'application/vnd.docker.distribution.manifest.v2+json', digest: nonGguf.digest, runner: 'mlx', format: 'safetensors' },
      ],
    });

    /* 3. Agent copy (should be skipped) and non-GGUF model (should be skipped) */
    writeManifest('manifests-v2', 'ollama.com', 'library', 'gemma4-12b-agent-64k', 'latest', {
      schemaVersion: 2,
      layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: gguf1.digest }],
    });
    writeManifest('manifests', 'registry.ollama.ai', 'library', 'mlx-only', 'latest', {
      schemaVersion: 2,
      layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: nonGguf.digest }],
    });

    const r1 = LS.syncAll({ ollamaDir, lmModelsDir, dataDir, force: true });
    ok('lmstudio-sync: syncAll succeeds and links 2 models', r1.ok && r1.synced === 2 && r1.linked === 2, JSON.stringify(r1));
    const g1Dest = path.join(lmModelsDir, 'ollama', 'gemma4-12b', 'gemma4-12b.gguf');
    const p1Dest = path.join(lmModelsDir, 'ollama', 'gemma4-12b', 'mmproj-gemma4-12b.gguf');
    const q4Dest = path.join(lmModelsDir, 'ollama', 'qwen3.5-4b', 'qwen3.5-4b.gguf');
    ok('lmstudio-sync: creates main GGUF and mmproj hardlinks', fs.existsSync(g1Dest) && fs.existsSync(p1Dest) && fs.existsSync(q4Dest));
    const stSrc = fs.statSync(gguf1.path, { bigint: true }), stDst = fs.statSync(g1Dest, { bigint: true });
    const hardlinksAllowed = (() => { const t = path.join(tmp, 'hlcheck'); try { fs.linkSync(gguf1.path, t); fs.unlinkSync(t); return true; } catch (e) { return false; } })();
    ok('lmstudio-sync: linked file matches source weights' + (hardlinksAllowed ? ' (zero-copy NTFS hardlink)' : ''), fs.readFileSync(g1Dest).equals(fs.readFileSync(gguf1.path)) && (!hardlinksAllowed || (stSrc.ino === stDst.ino && stSrc.dev === stDst.dev)));
    ok('lmstudio-sync: skips agent copies and non-GGUF models', !fs.existsSync(path.join(lmModelsDir, 'ollama', 'gemma4-12b-agent-64k-latest')) && !fs.existsSync(path.join(lmModelsDir, 'ollama', 'mlx-only-latest')));

    /* 4. Idempotent re-sync */
    const r2 = LS.syncAll({ ollamaDir, lmModelsDir, dataDir, force: true });
    ok('lmstudio-sync: second sync makes no redundant changes', r2.ok && r2.synced === 2 && r2.linked === 0, JSON.stringify(r2));

    /* 5. Re-pulled updated model replaces old hardlink */
    const gguf1New = writeBlob(Buffer.concat([Buffer.from('GGUF'), Buffer.from('model-one-UPDATED-weights')]));
    writeManifest('manifests', 'registry.ollama.ai', 'library', 'gemma4', '12b', {
      schemaVersion: 2,
      layers: [{ mediaType: 'application/vnd.ollama.image.model', digest: gguf1New.digest }],
    });
    const r3 = LS.syncAll({ ollamaDir, lmModelsDir, dataDir, force: true });
    ok('lmstudio-sync: updated blob relinks cleanly', r3.ok && r3.linked === 1 && fs.readFileSync(g1Dest).equals(fs.readFileSync(gguf1New.path)) && (!hardlinksAllowed || fs.statSync(g1Dest, { bigint: true }).ino === fs.statSync(gguf1New.path, { bigint: true }).ino), JSON.stringify(r3));

    /* 6. removeModel cleans LM Studio link without touching Ollama blob */
    const rm = LS.removeModel('gemma4:12b', { lmModelsDir });
    ok('lmstudio-sync: removeModel deletes LM Studio folder and keeps Ollama blob', rm.ok && !fs.existsSync(g1Dest) && fs.existsSync(gguf1New.path));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};
