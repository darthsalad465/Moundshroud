// Model dropdown ordering: largest first by default, or the Settings default model pinned first.
const fs = require('fs'), os = require('os'), path = require('path');

module.exports = async ok => {
  const eq = (name, got, want) => ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
  const MO = require(path.join(__dirname, '..', 'lib', 'model-order.js'));

  const sample = [
    { name: 'free-auto', size: 0, cloud: true, label: 'Free frontier' },
    { name: 'qwen3.5:2b', size: 1800000000 },
    { name: 'gemma4:12b', size: 8100000000 },
    { name: 'smollm2:135m', size: 120000000 },
    { name: 'qwen3.5:27b', size: 17500000000 },
    { name: 'gemma4:e4b', size: 6500000000 },
  ];

  /* automatic mode (no default selected in Settings): strictly largest to smallest, cloud after local */
  const auto = MO.sortModels(sample, '');
  eq('model-order: automatic sorts local models largest to smallest', auto.map(m => m.name).join(','), 'qwen3.5:27b,gemma4:12b,gemma4:e4b,qwen3.5:2b,smollm2:135m,free-auto');
  ok('model-order: sortModels does not mutate the input array', sample[0].name === 'free-auto');

  /* default selected in Settings: pinned first, rest still largest to smallest */
  const pinSmall = MO.sortModels(sample, 'qwen3.5:2b');
  eq('model-order: chosen local default goes first, rest stay largest to smallest', pinSmall.map(m => m.name).join(','), 'qwen3.5:2b,qwen3.5:27b,gemma4:12b,gemma4:e4b,smollm2:135m,free-auto');

  /* default cloud model pinned first */
  const pinCloud = MO.sortModels(sample, 'free-auto');
  eq('model-order: chosen cloud default goes first', pinCloud.map(m => m.name).join(','), 'free-auto,qwen3.5:27b,gemma4:12b,gemma4:e4b,qwen3.5:2b,smollm2:135m');

  /* :latest normalized matching */
  const withLatest = [{ name: 'small:1b', size: 100 }, { name: 'big:latest', size: 900 }, { name: 'mid:latest', size: 500 }];
  eq('model-order: :latest default matches bare name', MO.sortModels(withLatest, 'mid').map(m => m.name).join(','), 'mid:latest,big:latest,small:1b');

  /* tool-incapable model is not pinned ahead of usable agent models */
  const agentList = [{ name: 'no-tools:3b', size: 200, tools: false }, { name: 'big:12b', size: 800, tools: true }, { name: 'small:4b', size: 400, tools: true }];
  eq('model-order: unusable default (tools=false) is not forced to top', MO.sortModels(agentList, 'no-tools:3b').map(m => m.name).join(','), 'big:12b,small:4b,no-tools:3b');
  eq('model-order: usable agent default goes to top', MO.sortModels(agentList, 'small:4b').map(m => m.name).join(','), 'small:4b,big:12b,no-tools:3b');

  /* cloud/parameter-only lists sort by parsed parameter count */
  const cloudOnly = [
    { id: 'open-mistral-7b', name: 'Mistral 7B' },
    { id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B' },
    { id: 'mistral-medium-3.5-128b', name: 'Mistral Medium 3.5 (128B)' },
  ];
  eq('model-order: parameter size fallback sorts 128B > 8x7B > 7B', MO.sortModels(cloudOnly, '').map(m => m.id).join(','), 'mistral-medium-3.5-128b,open-mixtral-8x7b,open-mistral-7b');

  /* persistence on disk */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'model-order-'));
  try {
    eq('model-order: empty by default when file absent', MO.getDefault(tmp), '');
    ok('model-order: setDefault saves chosen model', MO.setDefault(tmp, 'gemma4:e4b').ok && MO.getDefault(tmp) === 'gemma4:e4b');
    ok('model-order: setDefault empty resets to automatic', MO.setDefault(tmp, '').ok && MO.getDefault(tmp) === '');
    ok('model-order: setDefault rejects newline injection', !MO.setDefault(tmp, 'bad\nmodel').ok);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  /* every frontend dropdown file wires into A.modelOrder and Settings has the Default model control */
  const root = path.join(__dirname, '..');
  const setSrc = fs.readFileSync(path.join(root, 'web', 'js', 'settings.js'), 'utf8');
  ok('model-order: Settings includes Default model dropdown', setSrc.includes('id="sdefmodel"') && setSrc.includes('initDefModel'));
  for (const rel of ['web/js/chat.js', 'web/js/agent.js', 'web/js/swarm.js', 'web/js/bible.js', 'web/js/composer.js', 'web/js/debate.js', 'web/js/olympics.js', 'web/js/modellab.js', 'web/js/studio-games.js', 'web/js/studio-godot.js']) {
    const txt = fs.readFileSync(path.join(root, rel), 'utf8');
    ok('model-order: ' + rel + ' uses A.modelOrder', txt.includes('A.modelOrder'));
  }
};
