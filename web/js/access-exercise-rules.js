const AccessExercise = (function(){
  const levels={
    recruit:{name:'Recruit',controls:3,faults:1,noise:3,attempts:5},
    analyst:{name:'Analyst',controls:4,faults:2,noise:7,attempts:5},
    expert:{name:'Expert',controls:5,faults:3,noise:12,attempts:4}
  };
  const controls={
    team:{name:'Assignment',modes:['Any affiliation','Internal or assigned','Assigned team only'],
      law:['Any affiliation may read.','Internal staff and assigned teams may read.','The reader must belong to the team named on the record.'],
      allows:(n,e)=>n===0||e.actor.team===e.record.team||(n===1&&e.actor.internal)},
    badge:{name:'Badge state',modes:['Any badge','Active or on call','Active only'],
      law:['Badge state is unrestricted.','Active and on-call badges are valid.','Only an active badge is valid.'],
      allows:(n,e)=>n===0||e.actor.badge==='Active'||(n===1&&e.actor.badge==='On call')},
    clearance:{name:'Clearance',modes:['No minimum','Level 1 or higher','Level 2 or higher'],
      law:['No clearance minimum applies.','Readers need clearance level 1 or higher.','Readers need clearance level 2 or higher.'],
      allows:(n,e)=>e.actor.clearance>=n},
    approval:{name:'Approval',modes:['No sign-off','Supervisor or signed','Signed request only'],
      law:['Requests can be unsigned.','A signed request or supervisor status is required.','Every request must carry a signature.'],
      allows:(n,e)=>n===0||e.signed||(n===1&&e.actor.supervisor)},
    shift:{name:'Duty window',modes:['Any hour','On duty or on call','On duty only'],
      law:['There is no time restriction.','Off-duty access requires the on-call roster.','Requests must fall within the assigned duty window.'],
      allows:(n,e)=>n===0||(e.hour>=e.actor.start&&e.hour<e.actor.start+8)||(n===1&&e.actor.onCall)}
  };
  const sites=[
    {name:'City dispatch',asset:'dispatch log',teams:['Transit','Harbor','Central'],brief:'Dispatchers share shift records with field crews. A supervisor has questioned the overnight access ledger.'},
    {name:'Meridian observatory',asset:'observation file',teams:['Optics','Survey','Telemetry'],brief:'Three observing teams share a research archive. Its access ledger needs an independent review before the next data release.'},
    {name:'Aster film archive',asset:'production cut',teams:['Sound','Picture','Restoration'],brief:'Unreleased cuts changed hands during a restoration project. The archivist wants the screening-room permissions checked.'},
    {name:'Northline freight',asset:'freight manifest',teams:['Freight','Signals','Terminal'],brief:'A handover moved manifests into a shared records desk. Operations wants the new access decisions checked against the signed handover.'}
  ];
  function random(seed){
    let s=seed>>>0;
    return n=>{s=(s+0x6D2B79F5)>>>0;let t=Math.imul(s^(s>>>15),s|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)%n;};
  }
  function shuffle(values,r){
    const a=values.slice();
    for(let i=a.length-1;i>0;i--){const j=r(i+1);[a[i],a[j]]=[a[j],a[i]];}
    return a;
  }
  function generate(seed,difficulty){
    const l=levels[difficulty];if(!l)throw Error('Unknown difficulty');
    const r=random(seed), site=sites[r(sites.length)], ids=shuffle(Object.keys(controls),r).slice(0,l.controls);
    const signed={},live={};
    for(const k of ids)signed[k]=live[k]=1+r(2);
    for(const k of shuffle(ids,r).slice(0,l.faults))live[k]=r(signed[k]);
    const events=[];
    // Each field is an ordinary attribute of a synthetic access request. A grade of
    // 0/1/2 constructs a denied, conditional or fully qualified fixture per control.
    const receipts={
      'City dispatch':['Diversion point','Relief crew','Transfer bay'],
      'Meridian observatory':['Embargoed target','Proposal reference','Observation slot'],
      'Aster film archive':['Screening room','Unreleased reel','Review slot'],
      'Northline freight':['Arrival track','Consignment reference','Receiving bay']
    };
    function fixture(grades){
      const g=k=>grades[k]??r(3), ti=r(3), group=g('team'), badge=g('badge'), approval=g('approval'), shift=g('shift'), start=5+r(9);
      return {actor:{id:'OP-'+(100+events.length),team:site.teams[group===2?ti:(ti+1+r(2))%3],internal:group>=1,
        badge:['Suspended','On call','Active'][badge],clearance:g('clearance'),supervisor:approval===1||(approval===2&&!!r(2)),start,onCall:shift===1||(shift===2&&!!r(2))},
        record:{name:site.asset+' '+(100+r(900)),team:site.teams[ti],content:receipts[site.name][r(3)]+' '+(10+r(90))},signed:approval===2,hour:shift===2?start+r(8):(start+8+r(12))%24};
    }
    const good=Object.fromEntries(ids.map(k=>[k,2]));
    for(const k of ids){
      for(const value of [0,1])events.push(fixture({...good,[k]:value}));
    }
    events.push(fixture(good));
    for(let i=0;i<l.noise;i++)events.push(fixture(Object.fromEntries(ids.map(k=>[k,r(3)]))));
    return {seed:seed>>>0,difficulty,site,ids,signed,live,events:shuffle(events,r),quota:l.faults,attempts:l.attempts};
  }
  const failures=(policy,e)=>Object.keys(policy).filter(k=>!controls[k].allows(policy[k],e));
  const allows=(policy,e)=>failures(policy,e).length===0;
  function readRecord(policy,e){
    return allows(policy,e)?{granted:true,body:e.record.content}:{granted:false,body:null};
  }
  function finding(c,index,rule){
    const e=c.events[index];
    return !!e&&c.ids.includes(rule)&&allows(c.live,e)&&!controls[rule].allows(c.signed[rule],e);
  }
  function verify(c,policy){
    if(c.ids.some(k=>![0,1,2].includes(policy[k])))throw Error('Invalid policy');
    let leak=0,lockout=0,example=null;
    for(let i=0;i<c.events.length;i++){
      const e=c.events[i],expected=allows(c.signed,e),actual=allows(policy,e);
      if(expected!==actual){if(actual)leak++;else lockout++; if(example===null)example=i;}
    }
    return {leak,lockout,example,ok:!leak&&!lockout};
  }
  return {levels,controls,generate,allows,readRecord,finding,verify};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AccessExercise;
