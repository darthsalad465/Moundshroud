const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/js/access-exercise-rules');

test('case seeds reproduce and scale the ledger, controls and fault count', () => {
  for (const [level, settings] of Object.entries(E.levels)) {
    const sites = new Set(), policies = new Set();
    for (let seed = 0; seed < 120; seed++) {
      const c = E.generate(seed, level);
      assert.deepEqual(c, E.generate(seed, level));
      sites.add(c.site.name);
      policies.add(JSON.stringify(c.signed));
      assert.equal(c.ids.length, settings.controls);
      const faults = c.ids.filter(k => c.live[k] !== c.signed[k]);
      assert.equal(faults.length, settings.faults);
      for (const k of c.ids) {
        const witnesses = c.events.filter((_, i) => E.finding(c, i, k));
        assert.equal(witnesses.length > 0, faults.includes(k));
        for (const event of witnesses) {
          assert.equal(E.readRecord(c.live, event).body, event.record.content);
          assert.deepEqual(E.readRecord(c.signed, event), { granted:false, body:null });
        }
      }
      assert.equal(E.verify(c, c.live).leak > 0, true);
      assert.equal(E.verify(c, c.signed).ok, true);
    }
    assert.equal(sites.size, 4);
    assert.ok(policies.size > 20);
  }
});

test('the ledger distinguishes all possible configurations, including accidental lockouts', () => {
  for (const level of Object.keys(E.levels)) {
    for (let seed = 0; seed < 8; seed++) {
      const c = E.generate(seed, level);
      let passes = 0;
      for (let index = 0; index < 3 ** c.ids.length; index++) {
        const policy = Object.fromEntries(c.ids.map((k, pos) => [k, Math.floor(index / 3 ** pos) % 3]));
        const r = E.verify(c, policy);
        if (r.ok) { assert.deepEqual(policy, c.signed); passes++; }
        else assert.ok(r.example >= 0 && r.leak + r.lockout > 0);
      }
      assert.equal(passes, 1);
    }
  }
});
