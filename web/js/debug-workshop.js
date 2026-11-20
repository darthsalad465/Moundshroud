(function(){
  const cases=[
    {id:'finish', title:'Photo finish', concept:'Numeric ordering', story:'The timing booth sorts race finishes from fastest to slowest. A ten-second run just beat a two-second run.',
      code:'function repair(times) {\n  return [...times].sort();\n}',
      tests:[[[2,10,3],[2,3,10]],[[12,1,2],[1,2,12]],[[3.1,3,2.9],[2.9,3,3.1]],[[],[]],[[4,4,12],[4,4,12]]],
      trace:['Start with [2, 10, 3]. The spread makes a new array.','With no comparison function, sort compares the strings "2", "10" and "3".','"10" sorts ahead of "2", so the returned array is [10, 2, 3].'],
      hint:'A numeric comparison function should return a negative value when its first time is faster.'},
    {id:'meter',title:'The missing zero',concept:'Missing values',story:'A weather buoy reports zero on calm nights. The display replaces that perfectly good reading with the missing-reading marker.',
      code:'function repair(readings) {\n  return readings.map(value => value || "offline");\n}',
      tests:[[[0,null,4],[0,'offline',4]],[[null],['offline']],[[-2,0],[-2,0]],[[],[]],[[1,2],[1,2]]],
      trace:['The first reading is the number 0.','The || operator checks whether its left value is truthy. Zero is falsy.','The fallback "offline" replaces both 0 and null. Only null represents a missing reading here.'],
      hint:'Decide whether the reading is missing before choosing the fallback. Zero is valid.'},
    {id:'gate',title:'Last one aboard',concept:'Boundary conditions',story:'The gate admits every ticket issued on or before the cutoff. One passenger stamped exactly at closing time was left behind.',
      code:'function repair(manifest) {\n  return manifest.stamps.filter(time => time < manifest.cutoff);\n}',
      tests:[[{stamps:[8,9,10],cutoff:9},[8,9]],[{stamps:[0],cutoff:0},[0]],[{stamps:[3,4],cutoff:2},[]],[{stamps:[5,5],cutoff:5},[5,5]],[{stamps:[],cutoff:1},[]]],
      trace:['The cutoff is 9. The first stamp, 8, passes the filter.','At stamp 9 the condition becomes 9 < 9, which evaluates to false.','The function returns [8]. The boarding rule also admits the stamp at 9.'],
      hint:'Test the boundary itself. A ticket at the cutoff has the same timestamp as the cutoff.'},
    {id:'streak',title:'The streak keeper',concept:'Loop state',story:'A rhythm game awards a medal for the longest uninterrupted run of hits. Its scorekeeper is counting across misses.',
      code:'function repair(hits) {\n  let run = 0, best = 0;\n  for (const hit of hits) {\n    if (hit) run++;\n    best = Math.max(best, run);\n  }\n  return best;\n}',
      tests:[[[true,false,true],1],[[true,true,false,true],2],[[false,false],0],[[],0],[[false,true,true,true],3]],
      trace:['The first hit raises run and best to 1.','The miss skips run++. The current run is still 1.','The last hit raises run to 2 even though the longest uninterrupted run was 1.'],
      hint:'Track the current run separately from the best one. Decide what happens to the current run on a miss.'}
  ];
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const show=v=>JSON.stringify(v);
  const done=c=>ls.get('dw_clear_'+c.id,'')==='1';
  function render(host){
    let c=cases.find(v=>v.id===ls.get('dw_last',''))||cases[0], trace=0, hint=false, version=0, rows=null, message='';
    const draft=()=>ls.get('dw_code_'+c.id,c.code);
    const pick=id=>{c=cases.find(v=>v.id===id)||cases[0];ls.set('dw_last',c.id);trace=0;hint=false;rows=null;message='';version++;draw();};
    function draw(){
      const cleared=cases.filter(done).length;
      host.innerHTML=`<div class="dw-shell"><main class="dw-wrap"><header class="dw-head"><div><p class="sy-kicker">JavaScript / ${cleared} of ${cases.length} repaired</p><h2>Debug workshop</h2></div><label>Repair ticket<select data-ticket>${cases.map(v=>`<option value="${v.id}" ${v===c?'selected':''}>${done(v)?'✓ ':''}${v.title}</option>`).join('')}</select></label></header>
        <h3>${c.title}</h3><p>${c.story}</p><div class="dw-layout"><section class="dw-panel"><h4><label for="dw-code">Repair the function</label></h4>
        <textarea class="dw-editor" id="dw-code" spellcheck="false" autocapitalize="off"></textarea><div class="dw-controls"><button class="dw-primary" data-job="run">Run ${c.tests.length} cases →</button><button class="dw-link" data-job="hint" aria-expanded="${hint}">Hint</button></div>${hint?`<p>${c.hint}</p>`:''}
        </section><section class="dw-panel"><p class="sy-kicker">${c.concept}</p><h4>Trace the original bug</h4><p>Input <code>${esc(show(c.tests[0][0]))}</code><br>Expected <code>${esc(show(c.tests[0][1]))}</code></p>
        <ol class="dw-trace">${c.trace.slice(0,trace).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><button class="dw-link" data-job="trace">${trace===c.trace.length?'Rewind trace':`Trace step ${trace+1} of ${c.trace.length} →`}</button></section></div><div class="dw-results" aria-live="polite"></div>
        <button class="dw-link" data-job="lessons">Coding lessons</button></main></div>`;
      host.querySelector('.dw-editor').value=draft();results();
    }
    function results(){
      const out=host.querySelector('.dw-results');
      out.innerHTML=`<div class="dw-summary">${esc(message)}</div>`+(rows||[]).map((r,i)=>`<div class="dw-result ${r.ok?'pass':'fail'}"><b>${r.ok?'Pass':'Fail'} · ${esc(show(c.tests[i][0]))}</b><small>Expected ${esc(show(c.tests[i][1]))} · Returned ${esc(r.actual)}</small></div>`).join('');
      if(rows?.every(r=>r.ok)){
        const next=cases.find(v=>!done(v));
        if(next)out.insertAdjacentHTML('beforeend',`<button class="dw-primary" data-job="next">Next repair · ${next.title} →</button>`);
      }
    }
    async function run(){
      const ticket=c, token=++version, ed=host.querySelector('.dw-editor'), btn=host.querySelector('[data-job="run"]');
      const inputs=ticket.tests.map(t=>t[0]);
      btn.disabled=true;rows=null;message='Running the cases…';results();
      try{
        const testCode=ed.value+'\nreturn '+JSON.stringify(inputs)+'.map(input => {try { const value = repair(input); return {value: JSON.stringify(value) ?? "undefined"}; } catch (e) { return {error: String(e.message || e)}; }});';
        const r=await A.interp.run('js',testCode);
        if(token!==version)return;
        if(!r.ok)throw Error(r.error||'The code stopped.');
        const values=JSON.parse(r.value);
        if(!Array.isArray(values)||values.length!==ticket.tests.length)throw Error('Keep the repair function and let the workshop call it for each input.');
        rows=values.map((v,i)=>({ok:v?.value===show(ticket.tests[i][1]),actual:v?.error?'Error · '+v.error:String(v?.value)}));
        const n=rows.filter(x=>x.ok).length;
        if(n===rows.length){ls.set('dw_clear_'+ticket.id,'1');message=cases.every(done)?'All repair tickets cleared.':`Repair verified · ${n} of ${n} cases passed.`;}
        else message=`${n} of ${rows.length} passed. Compare a failing return value with its expected value.`;
      }catch(err){if(token!==version)return;message=err.message||String(err);}
      if(token===version){draw();host.querySelector('[data-job="run"]').focus({preventScroll:true});}
    }
    host.oninput=e=>{
      if(!e.target.matches('.dw-editor'))return;
      ls.set('dw_code_'+c.id,e.target.value);version++;rows=null;message='';
      host.querySelector('[data-job="run"]').disabled=false;results();
    };
    host.onchange=e=>{if(e.target.matches('[data-ticket]')){pick(e.target.value);host.querySelector('[data-ticket]').focus();}};
    host.onclick=e=>{
      const action=e.target.closest('[data-job]')?.dataset.job;
      if(action==='run')return void run();
      if(action==='lessons')return A.cybertab.go('code');
      if(action==='next')return pick(cases.find(v=>!done(v))?.id);
      if(action==='trace')trace=(trace+1)%(c.trace.length+1);
      else if(action==='hint')hint=!hint;
      else return;
      version++;message='';draw();host.querySelector(`[data-job="${action}"]`).focus({preventScroll:true});
    };
    draw();
  }
  A.debugWorkshop={render};
})();
