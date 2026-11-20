(function(){
  const G=Switchyard, key='switchyard_v1';
  const sides={attack:'Attack',defend:'Defend'};
  const titles={attack:'Take the line',defend:'Hold the line'};
  const sign={attack:'↗',defend:'◇'};
  const callSign={attack:'Red shift',defend:'Blue watch'};
  const other=s=>s==='attack'?'defend':'attack';
  const roleButton=(side,chosen)=>`<button class="sy-seat ${side}" data-side="${side}" aria-pressed="${side===chosen}"><span aria-hidden="true">${sign[side]}</span><strong>${sides[side]}</strong><small>${titles[side]}</small></button>`;
  const load=()=>{try{return JSON.parse(ls.get(key,'{}'))||{};}catch{return {};}};
  function render(host){
    const book=load();
    book.slots ||= {}; book.record ||= {};
    let map=G.maps.find(m=>m.id===book.map)||G.maps[0];
    let side=G.roles.includes(book.side)?book.side:'attack', match=null, card='', aim=null, review=null, replaceSeed=null;
    const slot=()=>map.id+'-'+side;
    const save=()=>{book.side=side;book.map=map.id;ls.set(key,JSON.stringify(book));};
    function restore(){
      const stored=book.slots[slot()];
      if(!stored||!Number.isInteger(stored.seed)||!Array.isArray(stored.orders))return null;
      let state=G.create(map.id,side,stored.seed);
      try{for(const order of stored.orders)state=G.play(state,order);return state;}catch{return null;}
    }
    function board(red,possible=[],affected=[],mark=null,interactive=false){
      const last=map.nodes.length-1;
      const svg=map.links.map(([a,b])=>{
        const [,x,y]=map.nodes[a], [,xx,yy]=map.nodes[b];
        return `<line x1="${x}" y1="${y}" x2="${xx}" y2="${yy}" class="${red.includes(a)&&red.includes(b)?'red':''}"/>`;
      }).join('');
      const linked=G.connected({map:map.id,red});
      const pins=map.nodes.map(([name,x,y],i)=>{
        const owner=red.includes(i)?'red':'blue', tag=interactive?'button':'div';
        const isolated=owner==='red'&&!linked.includes(i);
        const symbol=i===0?'▰':i===last?'◆':owner==='red'?'▲':'◇';
        const attrs=interactive?`data-pin="${i}" aria-label="${name}, ${owner}${isolated?', disconnected':''}${i===last?', objective':''}" aria-pressed="${i===aim}" ${possible.includes(i)?'':'disabled'}`:'';
        return `<${tag} class="sy-pin ${owner} ${isolated?'isolated':''} ${i===last?'goal':''} ${possible.includes(i)?'possible':''} ${affected.includes(i)?'affected':''} ${mark===i?'marked':''}" style="left:${x}%;top:${y}%" ${attrs}><span>${symbol}</span><b>${name}${isolated?' ×':''}</b></${tag}>`;
      }).join('');
      return `<div class="sy-map" role="group" aria-label="${map.name} relay map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>${pins}</div>`;
    }
    function ledger(){
      return G.roles.map(r=>{
        const rec=book.record[map.id+'-'+r]||{wins:0,plays:0};
        return `${sides[r]} ${rec.wins}/${rec.plays}`;
      }).join(' · ');
    }
    function lobby(){
      const old=restore(), resume=old&&!old.winner && replaceSeed===null;
      const options=G.maps.map(m=>`<option value="${m.id}" ${m===map?'selected':''}>${m.name}</option>`).join('');
      return `<div class="sy-lobby"><div><p class="sy-kicker">SWITCHYARD / TACTICS ARENA</p><h2>Choose your side.</h2><p>Two operators share one switchboard. Both commit an order before either sees the other’s move.</p><div class="sy-seats">${G.roles.map(r=>roleButton(r,side)).join('')}</div>
        <div class="sy-brief"><b>${titles[side]}</b><p>${side==='attack'?`Carry a red pulse from the starting relay to ${map.goal}. Divide your pulses between lines or save cells for a shield-breaking push.`:`Keep ${map.goal} blue for ${map.limit} rounds. Cover likely routes or recall an occupied relay to disconnect a whole branch.`}</p></div>
        <button class="sy-primary" data-act="start">${resume?'Resume round '+old.round:replaceSeed!==null&&old&&!old.winner?'Replace saved match and play':'Play '+sides[side]} →</button>${old?.winner&&replaceSeed===null?'<button class="sy-link" data-act="review">Last debrief</button>':''}</div>
        <section class="sy-chart"><div class="sy-charthead"><label>Scenario <select data-map>${options}</select></label><b>${map.limit} rounds</b></div>${board([0])}<div class="sy-caption"><strong>${map.name}</strong><p>${map.brief} ${map.rule}</p><small>Wins / matches · ${ledger()}</small></div></section></div>`;
    }
    function report(ev){
      const names=ids=>ids.map(i=>map.nodes[i][0]).join(', ');
      const parts=[];
      if(ev.attack.card==='bank')parts.push('Red recharged at the starting relay.');
      if(ev.hit.length)parts.push(`${names(ev.hit)} went red.`);
      if(ev.blocked.length)parts.push(`${names(ev.blocked)} held blue.`);
      if(ev.defend.card==='reclaim')parts.push(`${map.nodes[ev.defend.target][0]} returned to blue.`);
      if(ev.bonus)parts.push(`${sides[ev.bonus]} earned the Mixer bonus.`);
      return parts.join(' ');
    }
    function orders(ev){
      return `<div class="sy-orders">${G.roles.map(r=>`<div class="${r}"><small>${callSign[r]}</small><b>${G.cards[ev[r].card].name} → ${map.nodes[ev[r].target][0]}</b></div>`).join('')}</div>`;
    }
    function matchView(){
      const past=review!==null, latest=match.history.at(-1), event=past?match.history[review]:latest;
      const red=past?event.red:match.red, energy=past?event.energy:match.energy;
      const playing=!match.winner&&!past, possible=playing?G.targets(match,card):[];
      const affected=aim!==null&&playing?G.area(match,{card,target:aim}):[];
      const remaining=map.limit-(past?event.round:match.round)+1;
      let panel;
      if(past){
        panel=`<p class="sy-kicker">ORDER REPLAY</p><h3>Round ${event.round}</h3>${orders(event)}<p>${report(event)}</p><button data-act="live" class="sy-primary">Return to ${match.winner?'debrief':'match'}</button>`;
      }else if(match.winner){
        const won=match.winner===side;
        panel=`<p class="sy-kicker">MATCH DEBRIEF</p><h3>${won?'Victory':'Defeat'}</h3><p>${match.winner==='attack'?`${map.goal} went red on round ${match.round}.`:`${map.goal} stayed blue through the final round.`}</p>${orders(latest)}<p>${report(latest)}</p><button class="sy-primary" data-act="swap">Play ${sides[other(side)]} on this board →</button><button class="sy-link" data-act="lobby">Scenario select</button>`;
      }else{
        const menu=Object.entries(G.cards).filter(([,c])=>c.role===side).map(([id,c])=>`<button class="sy-order" data-card="${id}" aria-pressed="${id===card}" ${G.targets(match,id).length?'':'disabled'}><b>${c.name}</b><small>${c.cost?c.cost+' cells':'Free'}</small></button>`).join('');
        panel=`<p class="sy-kicker">${callSign[side]} / ${sides[side]}</p><h3>${titles[side]}</h3><p>${side==='attack'?`Turn ${map.goal} red before time runs out.`:`Keep ${map.goal} blue through round ${map.limit}.`}</p>
          <div class="sy-menu">${menu}</div><p class="sy-rule">${G.cards[card].desc}</p><div class="sy-aim">${aim===null?'Choose a highlighted relay.':card==='bank'?'Recharge at the starting relay.':`Order covers <b>${affected.map(i=>map.nodes[i][0]).join(', ')}</b>`}</div><button class="sy-primary" data-act="commit" ${aim===null?'disabled':''}>Commit order →</button><small class="sy-note">Both sides regain one cell each round, up to three.</small>`;
      }
      const history=match.history.map((e,i)=>`<button data-round="${i}" aria-pressed="${i===review}">R${e.round}</button>`).join('');
      return `<header class="sy-matchhead"><div><p class="sy-kicker">SWITCHYARD / ${sides[side]}</p><h2>${map.name}</h2></div><button class="sy-link" data-act="lobby">Scenario select</button></header>
        <div class="sy-fight"><section class="sy-chart"><div class="sy-charthead"><b>Round ${past?event.round:match.round} / ${map.limit}</b><span>${past?'Replay':match.winner?'Final board':remaining===1?'Final round':remaining+' rounds left'}</span></div>
        ${board(red,possible,affected,aim,playing)}<div class="sy-caption"><div class="sy-stock"><b class="attack">▲ Red · ${energy.attack}/3 cells</b><b class="defend">◇ Blue · ${energy.defend}/3 cells</b></div><p>${map.rule}</p><p aria-live="polite">${event?`Round ${event.round} · ${report(event)}`:'Red begins at '+map.nodes[0][0]+'. The diamond marks '+map.goal+'.'}</p></div></section><section class="sy-console">${panel}</section></div>
        ${history?`<div class="sy-history"><b>Round replay</b>${history}</div>`:''}`;
    }
    const draw=()=>{host.innerHTML=`<div class="sy-shell"><main class="sy-wrap ${side}">${match?matchView():lobby()}</main></div>`;};
    function resetOrder(){
      card=side==='attack'?(match&&!match.winner&&!G.targets(match,'step').length?'bank':'step'):'guard'; aim=null;review=null;
    }
    host.onchange=e=>{if(e.target.matches('[data-map]')){map=G.maps.find(m=>m.id===e.target.value);replaceSeed=null;save();draw();host.querySelector('[data-map]').focus();}};
    host.onclick=e=>{
      const b=e.target.closest('button'); if(!b||b.disabled)return;
      let focus='';
      if(b.dataset.side){side=b.dataset.side;replaceSeed=null;save();focus='[data-side="'+side+'"]';}
      else if(b.dataset.card){card=b.dataset.card;aim=null;focus='[data-card="'+card+'"]';}
      else if(b.hasAttribute('data-pin')){aim=Number(b.dataset.pin);focus='[data-pin="'+aim+'"]';}
      else if(b.hasAttribute('data-round')){review=Number(b.dataset.round);aim=null;focus='[data-act="live"]';}
      else switch(b.dataset.act){
        case 'start':{
          const old=restore();
          if(replaceSeed===null&&old&&!old.winner)match=old;
          else {const seed=replaceSeed??crypto.getRandomValues(new Uint32Array(1))[0];match=G.create(map.id,side,seed);book.slots[slot()]={seed,orders:[]};}
          replaceSeed=null;resetOrder();save();break;
        }
        case 'commit':{
          if(aim===null||!match||match.winner)return;
          const order={card,target:aim};match=G.play(match,order);book.slots[slot()].orders.push(order);
          if(match.winner){const rec=book.record[slot()]||{wins:0,plays:0};rec.plays++;if(match.winner===side)rec.wins++;book.record[slot()]=rec;}
          save();resetOrder();focus=match.winner?'[data-act="swap"]':'[data-card="'+card+'"]';break;
        }
        case 'review':match=restore();resetOrder();break;
        case 'live':review=null;break;
        case 'lobby':match=null;replaceSeed=null;break;
        case 'swap':replaceSeed=match.seed;match=null;side=other(side);save();break;
        default:return;
      }
      draw(); if(focus)host.querySelector(focus)?.focus({preventScroll:true});
    };
    draw();
  }
  A.switchyard={render};
})();
