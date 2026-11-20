const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../web/js/switchyard-rules');
const order = (card, target) => ({card, target});

test('simultaneous shield, pulse and overdrive orders consume the right reserves', () => {
  const s = G.create('midnight','attack',1);
  const split = G.resolve(s,order('split',0),order('guard',1));
  assert.deepEqual(split.red,[0,2]);
  assert.deepEqual(split.history[0].blocked,[1]);
  const surge = G.resolve(s,order('surge',1),order('screen',1));
  assert.deepEqual(surge.red,[0,1]);
  assert.deepEqual(surge.energy,{attack:1,defend:2});
  assert.deepEqual(s.red,[0]);
  assert.throws(()=>G.resolve(surge,order('surge',3),order('guard',3)));
});

test('recalling the center of a line disconnects the far end', () => {
  const s = {...G.create('midnight','defend',1),red:[0,1,3]};
  const next = G.resolve(s,order('step',5),order('reclaim',1));
  assert.deepEqual(next.red,[0,3,5]);
  assert.deepEqual(G.connected(next),[0]);
  assert.equal(G.targets(next,'step').includes(6),false);
  assert.equal(G.targets(s,'reclaim').includes(0),false);
});

test('Mixer pays its new owner and the Depot observes its timetable', () => {
  const s = {...G.create('airwave','attack',7),red:[0,1]};
  const next = G.resolve(s,order('surge',2),order('guard',2));
  assert.equal(next.history[0].bonus,'attack');
  assert.equal(next.energy.attack,2);
  const recalled=G.resolve(next,order('bank',0),order('reclaim',2));
  assert.equal(recalled.energy.defend,3);
  assert.equal(recalled.history[1].bonus,'defend');
  const closed={...G.create('north','attack',7),red:[0,1,3,5],round:3};
  assert.equal(G.targets(closed,'step').includes(7),false);
  assert.equal(G.targets(closed,'split').includes(5),false);
  const open={...closed,round:4};
  assert.equal(G.resolve(open,order('surge',7),order('guard',7)).winner,'attack');
  const full={...closed,red:[0,1,2,3,4,5,6],round:6};
  assert.deepEqual(G.targets(full,'step'),[]);
  assert.equal(G.play(full,order('bank',0)).round,7);
});

test('both seats can win on each map and every recorded order reproduces its match', () => {
  for(const map of G.maps){
    const outcomes=new Set();
    for(let seed=0;seed<60;seed++){
      let attack=G.create(map.id,'attack',seed), defend=G.create(map.id,'defend',seed);
      while(!attack.winner){
        const red=G.rival(attack,'attack'),blue=G.rival(defend,'defend');
        attack=G.play(attack,red);
        defend=G.play(defend,blue);
        assert.deepEqual(attack.history,defend.history);
        assert.ok(attack.round<=map.limit);
      }
      outcomes.add(attack.winner);
      const replay=attack.history.reduce((s,e)=>G.play(s,e.attack),G.create(map.id,'attack',seed));
      assert.deepEqual(replay,attack);
      assert.throws(()=>G.play(attack,order('step',1)));
    }
    assert.equal(outcomes.size,2,map.name);
  }
});
