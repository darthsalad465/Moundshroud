// Rules for the offline, simultaneous-order board game.
const Switchyard = (() => {
  const roles = ['attack', 'defend'];
  const maps = [
    { id: 'midnight', name: 'Midnight Archive', goal: 'Archive', limit: 6,
      rule: 'The archive stays open through round six.',
      brief: 'The archive closes at midnight. Two lines enter the stacks and meet again at the reading room.',
      nodes: [['Dock',9,50],['Index',30,23],['Stacks',30,77],['Binder',53,24],['Folio',54,77],['Atrium',73,50],['Archive',92,50]],
      links: [[0,1],[0,2],[1,3],[1,4],[2,4],[3,5],[4,5],[5,6]] },
    { id: 'airwave', name: 'Last Broadcast', goal: 'Tower', limit: 6,
      relay: 2, rule: 'The side that changes the Mixer’s color earns one extra cell that round.',
      brief: 'The station has one broadcast window left. The mixing desk connects both lines, but the rooftop route skips it.',
      nodes: [['Booth',9,50],['Fader',29,23],['Mixer',48,52],['Spool',29,79],['Roof',68,23],['Dish',69,78],['Tower',92,50]],
      links: [[0,1],[0,3],[1,2],[1,4],[3,2],[2,4],[2,5],[4,6],[5,6]] },
    { id: 'north', name: 'Northbound Line', goal: 'Depot', limit: 7,
      departures: [4,7], rule: 'The Depot accepts pulses only on rounds four and seven. Either approach can reach it.',
      brief: 'The last train is due at the depot. Two parallel tracks share a single crossing at Milepost.',
      nodes: [['Siding',8,50],['Birch',25,23],['Pines',25,78],['Yard',44,23],['Milepost',50,60],['Bridge',68,23],['Tunnel',70,78],['Depot',92,50]],
      links: [[0,1],[0,2],[1,3],[2,4],[3,4],[3,5],[4,6],[5,7],[6,7]] }
  ];
  const cards = {
    step: { role:'attack', name:'Advance', cost:0, desc:'Claim one linked relay with 1 power.' },
    surge: { role:'attack', name:'Overdrive', cost:2, desc:'Claim one linked relay with 3 power. Breaks any shield.' },
    split: { role:'attack', name:'Twin pulse', cost:1, desc:'Send 1 power to every open neighbor of a connected red relay.' },
    bank: { role:'attack', name:'Recharge', cost:0, desc:'Bank one extra cell at your starting relay. Send no pulse this round.' },
    guard: { role:'defend', name:'Shield', cost:0, desc:'Block up to 2 power at one blue relay this round.' },
    screen: { role:'defend', name:'Canopy', cost:1, desc:'Block 1 power at a blue relay and its neighbors this round.' },
    reclaim: { role:'defend', name:'Recall', cost:2, desc:'Recover one red relay after pulses land. The starting relay is anchored.' }
  };
  const mapOf = s => maps.find(m => m.id === s.map);
  const neighbors = (m, n) => m.links.filter(edge => edge.includes(n)).map(([a,b]) => a === n ? b : a);
  function connected(s) {
    const seen = [0], m = mapOf(s);
    for (const n of seen) for (const v of neighbors(m,n)) if (s.red.includes(v) && !seen.includes(v)) seen.push(v);
    return seen;
  }
  function openRelay(s, i) {
    const m = mapOf(s);
    return !s.red.includes(i) && (i !== m.nodes.length-1 || !m.departures || m.departures.includes(s.round));
  }
  function targets(s, card) {
    if (!cards[card] || s.winner || s.energy[cards[card].role] < cards[card].cost) return [];
    if (card === 'bank') return [0];
    const m = mapOf(s), own = connected(s);
    return m.nodes.map((_,i)=>i).filter(i=>{
      if (card === 'reclaim') return i !== 0 && s.red.includes(i);
      if (card === 'split') return own.includes(i) && neighbors(m,i).some(v=>openRelay(s,v));
      if (s.red.includes(i)) return false;
      return cards[card].role === 'defend' || (openRelay(s,i) && neighbors(m,i).some(v=>own.includes(v)));
    });
  }
  function area(s, order) {
    if (order.card === 'bank') return [];
    const adj = neighbors(mapOf(s),order.target);
    if (order.card === 'split') return adj.filter(v=>openRelay(s,v));
    if (order.card === 'screen') return [order.target,...adj];
    return [order.target];
  }
  function create(map, side, seed) {
    if (!maps.some(m=>m.id===map) || !roles.includes(side)) throw Error('Unknown match');
    return { map, side, seed:seed>>>0, round:1, red:[0], energy:{attack:2,defend:2}, history:[], winner:null };
  }
  function resolve(s, attack, defend) {
    for (const [i,o] of [attack,defend].entries()) {
      if (cards[o?.card]?.role !== roles[i] || !targets(s,o.card).includes(o.target)) throw Error('Illegal order');
    }
    const m = mapOf(s), red = new Set(s.red), hit = [], blocked = [];
    const cover = defend.card === 'reclaim' ? [] : area(s,defend);
    for (const n of area(s,attack)) {
      if (cover.includes(n) && attack.card !== 'surge') blocked.push(n);
      else { red.add(n); hit.push(n); }
    }
    if (defend.card === 'reclaim') red.delete(defend.target);
    const winner = red.has(m.nodes.length-1) ? 'attack' : s.round === m.limit ? 'defend' : null;
    // Both players recover one cell after spending. The reserve holds three.
    const energy = {};
    for (const [i,o] of [attack,defend].entries()) energy[roles[i]] = Math.min(3,s.energy[roles[i]]-cards[o.card].cost+1);
    if (attack.card === 'bank') energy.attack = Math.min(3,energy.attack+1);
    const bonus = m.relay !== undefined && s.red.includes(m.relay) !== red.has(m.relay) ? (red.has(m.relay)?'attack':'defend') : null;
    if (bonus) energy[bonus] = Math.min(3,energy[bonus]+1);
    const event = { round:s.round, attack, defend, hit, blocked, bonus, red:[...red], energy, winner };
    return {...s, round:s.round+(winner?0:1), red:event.red, energy, winner, history:[...s.history,event]};
  }
  // The rival considers only the board at the start of the round.
  function rival(s, side) {
    const m = mapOf(s), goal = m.nodes.length-1;
    let rng = (s.seed ^ Math.imul(s.round,2654435761) ^ (side==='attack'?31:47))>>>0;
    const random = () => { rng = (Math.imul(rng,1664525)+1013904223)>>>0; return rng/4294967296; };
    const distance = []; distance[goal]=0;
    const queue=[goal]; for(const n of queue) for(const v of neighbors(m,n)) if(distance[v]===undefined){distance[v]=distance[n]+1;queue.push(v);}
    const frontier = targets(s,'step');
    const options = [];
    for (const [card,c] of Object.entries(cards)) {
      if(c.role!==side) continue;
      for(const target of targets(s,card)) {
        const o={card,target}, a=area(s,o);
        let score;
        if(side==='attack') {
          score = card==='bank' ? (s.energy.attack<2 ? 5 : 0) : Math.max(...a.map(v=>5-distance[v]))*2 + (a.length-1)*0.8;
          if(card==='surge') score += a.includes(goal)?2.5:-0.8;
        } else if(card==='reclaim') {
          const after=connected({...s,red:s.red.filter(v=>v!==target)});
          score=6-distance[target]+(connected(s).length-after.length)*1.5;
        } else {
          const covered=a.filter(v=>frontier.includes(v));
          score=covered.length ? Math.max(...covered.map(v=>5-distance[v]))+covered.length*0.6 : -3;
        }
        options.push({o, score:score+random()*4});
      }
    }
    return options.sort((a,b)=>b.score-a.score)[0].o;
  }
  function play(s, order) {
    const other = s.side==='attack'?'defend':'attack', theirs=rival(s,other);
    return s.side==='attack'?resolve(s,order,theirs):resolve(s,theirs,order);
  }
  return {maps,roles,cards,mapOf,neighbors,connected,targets,area,create,resolve,rival,play};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Switchyard;
