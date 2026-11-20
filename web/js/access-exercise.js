(function(){
  const E=AccessExercise,store='access_exercise_v1';
  const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
  const code=c=>c.seed.toString(16).toUpperCase().padStart(8,'0');
  const sides={attack:'Attack',defend:'Defend'};
  const verdict=ok=>ok?'Granted':'Denied';
  const escape=s=>String(s).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
  const clock=h=>String(h).padStart(2,'0')+':00';
  const ref=i=>'EV-'+String(i+1).padStart(2,'0');
  function render(host){
    let saved;try{saved=JSON.parse(ls.get(store,'{}'))||{};}catch{saved={};}
    let difficulty=Object.hasOwn(E.levels,saved.difficulty)?saved.difficulty:'recruit';
    let side=saved.side==='defend'?'defend':'attack', inCase=false, filter='all', replacement=false, replay=false;
    saved.cases ||= {};
    function entry(){
      if(!saved.cases[difficulty])saved.cases[difficulty]={seed:freshSeed(),seats:{}};
      return saved.cases[difficulty];
    }
    let c,seat;
    function select(){
      const e=entry();c=E.generate(e.seed,difficulty);
      seat=e.seats[side] ||= {index:0,rule:c.ids[0],found:[],draft:{...c.live},used:0,end:'',notes:[]};
      filter='all';replacement=false;replay=false;
    }
    const save=()=>{saved.difficulty=difficulty;saved.side=side;ls.set(store,JSON.stringify(saved));};
    const heading=()=>`<p class="sy-kicker">ACCESS REVIEW / CASE ${code(c)}</p>`;
    function lobby(){
      const level=E.levels[difficulty],active=seat.used||seat.notes.length||seat.end;
      return `<div class="sy-lobby"><section class="ax-intro">${heading()}<h2>Access review</h2><p>Someone signed off on a records system. The rules it actually enforces tell a different story. Pick a team and take the case.</p>
        <div class="sy-seats">${Object.entries(sides).map(([id,name])=>`<button class="sy-seat ${id}" data-side="${id}" aria-pressed="${id===side}"><span aria-hidden="true">${id==='attack'?'↗':'◇'}</span><strong>${name}</strong><small>${id==='attack'?'Red team · prove exposure':'Blue team · repair access'}</small></button>`).join('')}</div>
        <div class="sy-brief"><b>${side==='attack'?'Red team mandate':'Blue team mandate'}</b><p>${side==='attack'?'Replay recorded requests. File an evidence-backed finding for each permission the service grants too broadly.':'Change the deployed access rules. Close unintended access while preserving every legitimate grant.'}</p></div>
        <button class="sy-primary" data-act="enter">${seat.end?'Read debrief':active?'Resume case':'Play '+sides[side]} →</button></section>
        <section class="sy-chart"><div class="sy-charthead"><label>Difficulty <select data-level>${Object.entries(E.levels).map(([k,v])=>`<option value="${k}" ${k===difficulty?'selected':''}>${v.name}</option>`).join('')}</select></label><b>${c.events.length} events</b></div><div class="ax-dossier"><p class="sy-kicker">INCIDENT DOSSIER</p><h3>${c.site.name}</h3><p>${c.site.brief}</p><dl><dt>Policy controls</dt><dd>${level.controls}</dd><dt>Permission faults</dt><dd>${level.faults}</dd><dt>${side==='attack'?'Finding submissions':'Verification runs'}</dt><dd>${c.attempts}</dd></dl>
        <button class="sy-link" data-act="roll">${replacement?'Replace this case and both team saves?':'Generate new case'}</button>${replacement?'<button class="sy-link" data-act="cancel">Keep case</button>':''}</div></section></div>`;
    }
    function charter(){
      return `<section class="ax-card"><h4>Signed access policy</h4><ul>${c.ids.map(k=>`<li><b>${E.controls[k].name}.</b> ${E.controls[k].law[c.signed[k]]}</li>`).join('')}</ul><small>All listed conditions apply to every read request.</small></section>`;
    }
    function evidence(){
      const matches=c.events.map((event,i)=>({i,granted:E.allows(c.live,event)})).filter(x=>filter==='all'||(filter==='granted')===x.granted);
      if(!matches.some(x=>x.i===seat.index))seat.index=matches.length?matches[0].i:-1;
      const e=c.events[seat.index];
      const response=e&&replay?E.readRecord(side==='attack'?c.live:seat.draft,e):null;
      const row=(term,value)=>`<dt>${term}</dt><dd>${value}</dd>`;
      return `<section class="ax-card"><div class="ax-bar"><h4>Access ledger</h4><label>Show <select data-filter>${['all','granted','denied'].map(k=>`<option value="${k}" ${filter===k?'selected':''}>${k}</option>`).join('')}</select></label></div>
        ${!e?'<p>No matching events.</p>':`<label class="ax-select">Recorded request<select data-event>${matches.map(({i,granted})=>`<option value="${i}" ${i===seat.index?'selected':''}>${ref(i)} · ${c.events[i].actor.id} · ${verdict(granted)}</option>`).join('')}</select></label>
        <div class="ax-receipt"><b>${ref(seat.index)} / READ</b><strong class="${E.allows(c.live,e)?'ax-grant':'ax-deny'}">${verdict(E.allows(c.live,e))}</strong></div><dl>
        ${row('Reader',e.actor.id+' · '+e.actor.team)}${row('Record',e.record.name+' · '+e.record.team)}
        ${c.ids.includes('team')?row('Affiliation',e.actor.internal?'Internal':'External'):''}
        ${c.ids.includes('badge')?row('Badge',e.actor.badge):''}${c.ids.includes('clearance')?row('Clearance','Level '+e.actor.clearance):''}
        ${c.ids.includes('approval')?row('Sign-off',(e.signed?'Signed':'Unsigned')+' · '+(e.actor.supervisor?'supervisor':'staff')):''}
        ${c.ids.includes('shift')?row('Duty window',clock(e.actor.start)+'–'+clock(e.actor.start+8))+row('Request time',clock(e.hour)+(e.actor.onCall?' · on-call roster':' · off roster')):''}</dl>
        <button class="sy-link" data-act="replay">Replay read against ${side==='attack'?'deployed':'staged'} policy</button>${response?`<p class="ax-output" role="status">${response.granted?'GRANTED · '+response.body:'DENIED · record withheld'}</p>`:''}`}</section>`;
    }
    function work(){
      const panel=side==='attack'?`<h4>File a finding</h4><p>Pick a granted request and identify the signed condition it violates. Each new fault needs its own evidence.</p><label class="ax-select">Violated control<select data-rule>${c.ids.map(k=>`<option value="${k}" ${k===seat.rule?'selected':''}>${E.controls[k].name}${seat.found.includes(k)?' · verified':''}</option>`).join('')}</select></label>
        <button class="sy-primary" data-act="file" ${seat.index<0||seat.found.includes(seat.rule)?'disabled':''}>Submit ${seat.index<0?'evidence':ref(seat.index)} →</button>`:
        `<h4>Policy editor</h4><p>Stage changes and replay individual requests for free. A verification run checks the entire ledger for excess access and incorrect denials.</p>${c.ids.map(k=>`<label class="ax-select">${E.controls[k].name}<select data-policy="${k}">${E.controls[k].modes.map((v,i)=>`<option value="${i}" ${i===seat.draft[k]?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}<button class="sy-primary" data-act="verify">Verify staged policy →</button>`;
      return `<div class="ax-grid"><div>${evidence()}${charter()}</div><div><section class="ax-card">${panel}</section>${log()}</div></div>`;
    }
    function log(){
      return `<section class="ax-card"><h4>Case notes</h4>${seat.notes.length?`<ol>${seat.notes.slice().reverse().map(n=>`<li>${escape(n)}</li>`).join('')}</ol>`:'<p>Your submitted findings and verification results appear here.</p>'}</section>`;
    }
    function debrief(){
      return `<div class="ax-grid"><section class="ax-card"><p class="sy-kicker">CASE DEBRIEF</p><h3>${seat.end==='win'?(side==='attack'?'Exposure proven':'Policy restored'):'Review window closed'}</h3><p>${seat.end==='win'?(side==='attack'?`You documented all ${c.quota} permission faults in ${seat.used} submissions.`:`All ${c.events.length} requests now match the signed policy.`):'The review budget ran out. The discrepancies below explain the original access decisions.'}</p>
        ${c.ids.filter(k=>c.live[k]!==c.signed[k]).map(k=>{const i=c.events.findIndex((_,i)=>E.finding(c,i,k));return `<div class="ax-diff"><b>${E.controls[k].name} · ${ref(i)}</b><small>Deployed: ${E.controls[k].modes[c.live[k]]}<br>Required: ${E.controls[k].modes[c.signed[k]]}</small></div>`;}).join('')}
        <button class="sy-primary" data-act="swap">Play ${sides[side==='attack'?'defend':'attack']} on this case →</button><button class="sy-link" data-act="lobby">Case selection</button></section>${log()}</div>`;
    }
    function draw(focus){
      host.innerHTML=`<div class="sy-shell"><div class="sy-wrap ax-wrap ${side}">${inCase?`<header class="sy-matchhead"><div>${heading()}<h2>${c.site.name}</h2><b>${sides[side]} · ${E.levels[difficulty].name}</b></div><button class="sy-link" data-act="lobby">Case selection</button></header>
        <div class="ax-meter" role="status">${side==='attack'?`${seat.found.length}/${c.quota} faults proven`:`${c.events.length} regression cases`} · ${c.attempts-seat.used} ${side==='attack'?'submissions':'verification runs'} left</div>${seat.end?debrief():work()}`:lobby()}</div></div>`;
      if(focus)host.querySelector(focus)?.focus({preventScroll:true});
    }
    host.onchange=e=>{
      const t=e.target;let f;replay=false;
      if(t.matches('[data-level]')){difficulty=t.value;select();f='[data-level]';}
      else if(t.matches('[data-filter]')){filter=t.value;f='[data-filter]';}
      else if(t.matches('[data-event]')){seat.index=Number(t.value);f='[data-event]';}
      else if(t.matches('[data-rule]')){seat.rule=t.value;f='[data-rule]';}
      else if(t.matches('[data-policy]')){seat.draft[t.dataset.policy]=Number(t.value);f=`[data-policy="${t.dataset.policy}"]`;}
      else return;
      draw(f);save();
    };
    host.onclick=e=>{
      const b=e.target.closest('button');if(!b||b.disabled)return;
      const act=b.dataset.act;
      if(b.dataset.side){side=b.dataset.side;select();}
      else if(act==='replay'){replay=true;}
      else if(act==='enter'){inCase=true;}
      else if(act==='lobby'){inCase=false;replacement=false;}
      else if(act==='cancel'){replacement=false;}
      else if(act==='roll'){
        if(!replacement&&Object.values(entry().seats).some(s=>s.used||s.end||s.notes.length||Object.keys(c.live).some(k=>s.draft[k]!==c.live[k]))){replacement=true;}
        else{saved.cases[difficulty]={seed:freshSeed(),seats:{}};select();}
      }else if(act==='swap'){side=side==='attack'?'defend':'attack';select();inCase=true;}
      else if(act==='file'&&side==='attack'&&!seat.end){
        const k=seat.rule,i=seat.index;if(i<0||seat.found.includes(k))return;
        seat.used++;
        if(E.finding(c,i,k)){seat.found.push(k);seat.notes.push(`${ref(i)} verified a ${E.controls[k].name.toLowerCase()} violation.`);}
        else seat.notes.push(`${ref(i)} was rejected. ${E.allows(c.live,c.events[i])?'The cited condition permits this request.':'The deployed system already denied this request.'}`);
        if(seat.found.length===c.quota)seat.end='win';
      }else if(act==='verify'&&side==='defend'&&!seat.end){
        const result=E.verify(c,seat.draft);seat.used++;
        seat.notes.push(result.ok?'Verification passed. All expected grants and denials matched.':`${result.leak} unexpected grants, ${result.lockout} incorrect denials. Inspect ${ref(result.example)}.`);
        if(result.ok)seat.end='win';else{filter='all';seat.index=result.example;}
      }else return;
      if(!seat.end&&seat.used>=c.attempts)seat.end='loss';
      draw(b.dataset.side?`[data-side="${side}"]`:undefined);save();
    };
    select();draw();save();
  }
  A.accessExercise={render};
})();
