// Games › Tidemill Acres (coastal farm with crops and tide-mill orders) and Periapsis (tow capsules through a gravity well to an orbital dock).
(() => {
  const P=A.play,{mount,readWorld,saveWorld,clamp,rr,label}=P.worldKit;
  const {sky,pine,person}=A.worldArt;
  const crops=[
    {name:'Sunroot',seed:2,price:6,days:2,leaf:'#85ad51',fruit:'#ffbd59'},
    {name:'Sea kale',seed:3,price:9,days:3,leaf:'#439581',fruit:'#92d4af'},
    {name:'Duskberry',seed:4,price:14,days:4,leaf:'#76875d',fruit:'#c184bd'}
  ];
  const seasons=['Blossom','High Sun','Copperleaf','Frost'];
  const newFarm=()=>({day:1,coins:18,sales:0,lastForage:0,orderDay:0,stock:[0,0,0],plots:Array(12).fill(null)});
  const orderFor=day=>({crop:(day-1)%3,amount:2+(Math.floor((day-1)/3)%2)});
  function cottage(s,x,z,base,wall,roof){
    s.box(x,0,z,2.6,1.55,2.1,wall);
    for(const side of [-1,1]){
      s.face([[x-1.55,1.48,z+side*1.25],[x+1.55,1.48,z+side*1.25],[x+1.55,2.43,z],[x-1.55,2.43,z]],roof,side<0?.89:1);
      s.face([[x+side*1.30,1.5,z-1.05],[x+side*1.30,2.3,z],[x+side*1.30,1.5,z+1.05]],wall);
    }
    s.box(x+.8,1.65,z+.15,.28,1,.32,'#997466');s.box(x,0,z-1.07,.5,.94,.055,base);
    for(const side of [-1,1]){s.box(x+side*.88,.72,z-1.08,.45,.48,.04,'#38616a');s.box(x+side*.88,.73,z-1.11,.035,.46,.02,'#ffdb94');}
  }
  P.games.tidemill={name:'Tidemill Acres',icon:'🌾',desc:'Tend a coastal farm, grow three crops and fill the tide mill’s changing orders.',mount(el,api){
    const tools=crops.map((v,i)=>'<button class="ib" data-seed="'+i+'">'+v.name+' · '+v.seed+' coins</button>').join('')+
      '<button class="ib" data-water>Water</button><button class="ib" data-ship>Ship produce</button><button class="ib" data-forage>Beachcomb</button><button class="ib" data-sleep>Next day</button><button class="ib" data-restore></button>';
    const u=mount(el,api,'TIDEMILL ACRES','Choose seeds and click empty beds. Water once per day, then advance the day. Click ripe crops to harvest.',tools);
    const c=u.ctx,s=u.scene,f=readWorld('tidemill')||newFarm();let tool=0,selected=0,t=0;
    const rain=()=>f.day%5===0;
    const season=()=>Math.floor((f.day-1)/7)%4;
    const message=text=>{u.help.textContent=text;};
    const save=()=>saveWorld('tidemill',f);
    const projects=['Repair mill sluice','Restore irrigation','Reopen ferry market'];
    const prices=[24,48,72];
    f.restored??=0;
    u.button('[data-restore]',()=>{
      if(f.restored>=3||f.coins<prices[f.restored])return;
      f.coins-=prices[f.restored];f.restored++;
      message(['The sluice turns. Mill orders now pay eight extra coins.','Water channels now tend every bed overnight.','Ferry service restored. All future shipments earn a quarter more.'][f.restored-1]);save();sync();
    });
    function sync(){
      const restore=el.querySelector('[data-restore]');
      restore.disabled=f.restored===3||f.coins<prices[f.restored];
      restore.textContent=f.restored===3?'Ferry market open':projects[f.restored]+' · '+prices[f.restored]+' coins';
      el.querySelectorAll('[data-seed]').forEach(b=>b.classList.toggle('on',tool===Number(b.dataset.seed)));
      el.querySelector('[data-water]').classList.toggle('on',tool===-1);
      u.status.textContent=seasons[season()]+' · Day '+f.day+' · '+f.coins+' coins';
    }
    function tend(i){
      selected=i;const plant=f.plots[i];
      if(plant&&plant.age>=crops[plant.kind].days){
        f.stock[plant.kind]++;f.plots[i]=null;message(crops[plant.kind].name+' harvested. Ship it at the mill.');
      }else if(tool===-1){
        if(!plant){message('Plant this bed first.');return;}
        plant.wet=true;message('Watered '+crops[plant.kind].name+'.');
      }else if(plant){message(crops[plant.kind].name+' · '+plant.age+'/'+crops[plant.kind].days+' growing days · '+(plant.wet||rain()||f.restored>=2?'watered':'needs water'));return;}
      else if(f.coins>=crops[tool].seed){f.coins-=crops[tool].seed;f.plots[i]={kind:tool,age:0,wet:rain()};message('Planted '+crops[tool].name+'.');}
      else {message('Beachcomb for seed money or ship your stored harvest.');return;}
      save();sync();
    }
    el.querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>{tool=Number(b.dataset.seed);sync();});
    u.button('[data-water]',()=>{tool=-1;sync();});
    u.button('[data-forage]',()=>{
      if(f.lastForage===f.day){message('The next tide brings new sea glass tomorrow.');return;}
      f.lastForage=f.day;f.coins+=3;message('Sea glass from the strand earned 3 coins.');save();sync();
    });
    u.button('[data-sleep]',()=>{
      for(const p of f.plots)if(p){if(p.wet||rain()||f.restored>=2)p.age=Math.min(crops[p.kind].days,p.age+1);p.wet=false;}
      f.day++;message(rain()?'Rain is watering every planted bed.':f.restored>=2?'The channels irrigated your fields overnight.':'A new market day. Check the mill order and water the beds.');save();sync();
    });
    u.button('[data-ship]',()=>{
      let pay=f.stock.reduce((sum,n,i)=>sum+n*crops[i].price,0);
      if(!pay){message('Harvest a ripe crop before shipping.');return;}
      const order=orderFor(f.day), bonus=f.orderDay!==f.day&&f.stock[order.crop]>=order.amount;
      if(bonus){pay+=f.restored?20:12;f.orderDay=f.day;}
      if(f.restored===3)pay=Math.ceil(pay*1.25);
      f.stock.fill(0);f.coins+=pay;f.sales+=pay;api.submit(f.sales);message('Shipped for '+pay+' coins'+(bonus?' including the mill order bonus.':'.'));save();sync();
    });
    sync();
    u.loop(dt=>{
      t+=dt;const autumn=season()===2,winter=season()===3;
      sky(c,rain()?['#526580','#c1cfce','#879da4','#718f91','#e8debd']:['#68a4bf','#ffdbac','#a6b0a1','#8faca1','#fff2c2'],t);
      s.begin([4.6,5.4,-7.7],[-.3,.55,.9],{lens:535,range:62,fog:'#e0d0b4'});
      s.box(0,-.86,2,24,.75,16,'#b0a084');s.box(0,-.12,2,24,.12,16,winter?'#cfdbcc':autumn?'#b3aa69':'#a7ba77');
      s.box(0,-1.1,19,95,.46,25,'#75b5bd');
      for(let k=0;k<42;k++){const x=(k*7.81)%32-16,z=10+(k*2.53+t*.13)%15;s.box(x,-.63,z,.5+k%4*.25,.02,.06,'#c0ddd3');}
      // Dune grass, flower drifts and stepping stones carry the eye from the shore to the beds.
      for(let i=0;i<155;i++){
        const x=(i*7.321)%21-10,z=(i*i*.873)%13-5;
        if((Math.abs(x)<2.55&&z<3&&z>-2.3)||Math.abs(z-2.1)<.38)continue;
        s.patch(x,.012,z,.22+(i%4)*.12,.14,i%3?'#99b16f':'#bcc286',.4);
        s.cone(x,.026,z,.065,.21+(i%3)*.035,'#839b59',3);
        if(i%3===0)s.box(x,.19,z,.09,.055,.09,autumn?'#dc9869':i%2?'#ffe4a0':'#e5acc4',.45);
      }
      for(let i=0;i<12;i++)s.patch(-2.65+Math.sin(i*.4)*.2,.025,-2+i*.43,.32,.17,'#c9b995',.4);
      for(let i=0;i<7;i++)s.box(-6,.06,8+i*.48,1.1,.11,.44,'#a98060');
      for(const side of [-1,1])for(const z of [8.4,10.6])s.box(-6+side*.48,-.8,z,.1,1.1,.10,'#8d7058');
      for(const [x,z] of [[-4.6,-1.4],[5.5,.8]]){
        s.patch(x-.48,.023,z+.28,1.3,.57,'#92a16a',-.4);
        s.box(x,0,z,.18,1.35,.20,'#926e51');
        for(let i=0;i<5;i++){
          const a=i*2.4,tx=x+Math.cos(a)*.47,tz=z+Math.sin(a)*.41;
          s.cone(tx,1.05+i*.08,tz,.73,.67,autumn?'#c88961':winter?'#bbc6b0':i%2?'#deb1ba':'#e9c0ba',7,a);
        }
      }
      for(let i=0;i<3;i++){
        const x=-3.2+Math.sin(t*.48+i)*.42,z=2.05+i*.37;
        s.patch(x,.034,z,.18,.13,'#b09f78');s.box(x,.10,z,.24,.18,.19,'#f9e2b3');
        s.box(x+.09,.23,z,.13,.12,.12,'#ffe9c2');s.box(x+.15,.25,z,.065,.035,.055,'#dc9352');
      }
      for(let k=0;k<16;k++){const x=k*2-16;pine(s,x,0,7+(k%3)*.8,2.1+k%4*.4,autumn?'#a78c53':'#618a68');}
      cottage(s,-4.5,4.5,'#557e7c','#f0d4a2','#b86b5d');
      // Octagonal mill tower and four rotating sail panels facing the field.
      s.cone(3.9,-.02,5.5,1.26,3.55,'#e6d2aa',8);s.cone(3.9,2.62,5.5,.78,.88,'#536e7c',8);
      for(let i=0;i<4;i++){
        const a=t*.48+i*Math.PI/2,point=(r,w)=>[3.9+r*Math.cos(a)-w*Math.sin(a),2.46+r*Math.sin(a)+w*Math.cos(a),4.96];
        s.face([point(.05,-.045),point(1.65,-.045),point(1.65,.04),point(.05,.04)],'#675749');
        s.face([point(.48,.04),point(1.61,.04),point(1.5,.35),point(.54,.22)],'#fff1c9');
      }
      s.box(0,.004,2.1,9,.03,.5,'#dac399');
      for(let i=0;i<14;i++){const x=-5.5+i*.8;s.box(x,.01,2.8,.10,.56,.10,'#b58a64');if(i<13)s.box(x+.4,.30,2.8,.8,.07,.07,'#d8b68a');}
      const order=orderFor(f.day);
      for(let i=0;i<12;i++){
        const x=(i%4-1.5)*1.05,z=(Math.floor(i/4)-1)*1.02-.45,p=f.plots[i];
        s.box(x,.02,z,.97,.10,.91,p&&(p.wet||rain()||f.restored>=2)?'#715345':'#956d51');
        for(const row of [-.28,0,.28])s.box(x+row,.12,z,.075,.035,.77,'#ac8260');
        s.tile(x,.15,z,1,1,i);
        if(p){const crop=crops[p.kind],size=.15+.48*(p.age/crop.days);
          for(const [a,b] of [[-.18,-.15],[.20,.10],[-.15,.25]]){
            s.cone(x+a,.15,z+b,.11+size*.16,size,crop.leaf,5);
            if(p.age>=crop.days)s.box(x+a,.15+size*.42,z+b,.22,.19,.2,crop.fruit,.3);
          }
        }
      }
      const hover=s.pick(u.pointer.x,u.pointer.y);
      if(u.pointer.tap && hover!=null)tend(hover);
      const active=hover??selected,ax=(active%4-1.5)*1.05,az=(Math.floor(active/4)-1)*1.02-.45;
      for(const k of [-.48,.48]){s.box(ax+k,.13,az,.025,.02,.93,'#ffeda1');s.box(ax,.13,az+k,.95,.02,.025,'#ffeda1');}
      person(s,-2.65,0,-.7,1.05);s.finish();
      if(rain()){c.strokeStyle='#e3f3ff88';c.beginPath();for(let i=0;i<65;i++){const x=(i*137+t*180)%990,y=(i*71+t*250)%550;c.moveTo(x,y);c.lineTo(x-4,y+12);}c.stroke();}
      rr(c,20,18,270,70,12,'#263d39ed');label(c,seasons[season()].toUpperCase()+'   /   DAY '+f.day,36,45,15,'#ffedbb');
      label(c,rain()?'Rain · beds watered':'Mill order · '+order.amount+' '+crops[order.crop].name+' (+'+(f.restored?20:12)+')',36,70,13,'#e1e9d0');
      rr(c,20,482,520,39,10,'#263d39e8');label(c,'Crate   '+f.stock.map((n,i)=>crops[i].name+' ×'+n).join('     '),34,507,13,'#fff1cf');
    });return ()=>u.stop(save);
  }};
  P.games.periapsis={name:'Periapsis',icon:'🪐',desc:'Pilot a salvage tug through a planet’s gravity well. Latch onto survey capsules and tow them to the orbital dock.',mount(el,api){
    const u=mount(el,api,'PERIAPSIS · ORBITAL SALVAGE','←/→ rotate · ↑ thrust · ↓ brake · Space latch or release. Bring three capsules to the cyan dock before your shift ends.');
    const c=u.ctx,planet={x:488,y:278},dock={x:132,y:322};let ship,pods,line,time,count,score,ended,t=0,trail,reason;
    const routes=[
      {name:'Survey Belt',dock:[132,322],pods:[[225,272],[690,146],[721,399]],seconds:180},
      {name:'Far Side',dock:[805,370],pods:[[720,265],[225,140],[346,443]],seconds:155},
      {name:'Polar Return',dock:[475,82],pods:[[235,210],[771,320],[449,463]],seconds:145}
    ];
    const chart=readWorld('orbital_routes')||{cleared:0};
    let route;
    function reset(){
      route=routes[Math.min(chart.cleared,2)];[dock.x,dock.y]=route.dock;
      ship={x:dock.x+40,y:dock.y,vx:0,vy:0,a:-.65};pods=route.pods.map(([x,y])=>({x,y,vx:0,vy:0,done:false}));
      time=route.seconds;line=null;count=score=0;ended=false;trail=[];reason='';t=0;
    }
    function glow(x,y,r,color){
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color+'bc');g.addColorStop(.28,color+'59');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
    reset();
    u.loop(dt=>{
      if(ended&&u.tapped('enter'))reset();
      t+=dt;
      if(!ended){
        time=Math.max(0,time-dt);ship.a+=(Number(u.key('arrowright','d'))-Number(u.key('arrowleft','a')))*3*dt;
        const thrust=u.key('arrowup','w')?108:0,brake=u.key('arrowdown','s')?2:.13;
        const dx=planet.x-ship.x,dy=planet.y-ship.y,r=Math.max(30,Math.hypot(dx,dy));
        ship.vx+=(Math.cos(ship.a)*thrust+dx*320000/r**3-ship.vx*brake)*dt;
        ship.vy+=(Math.sin(ship.a)*thrust+dy*320000/r**3-ship.vy*brake)*dt;
        ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;
        if(ship.x<16||ship.x>944){ship.x=clamp(ship.x,16,944);ship.vx*=-.52;}
        if(ship.y<20||ship.y>520){ship.y=clamp(ship.y,20,520);ship.vy*=-.52;}
        if(u.tapped(' ')){line=line?null:pods.filter(p=>!p.done&&Math.hypot(p.x-ship.x,p.y-ship.y)<75).sort((a,b)=>Math.hypot(a.x-ship.x,a.y-ship.y)-Math.hypot(b.x-ship.x,b.y-ship.y))[0]||null;}
        if(line){const a=ship.x-line.x,b=ship.y-line.y,d=Math.hypot(a,b);if(d>27){
          const k=(d-27)*5/(d||1);line.vx+=a*k*dt;line.vy+=b*k*dt;ship.vx-=a*k*dt*.12;ship.vy-=b*k*dt*.12;
        }}
        for(const p of pods){if(p.done)continue;p.vx*=Math.exp(-dt*1.65);p.vy*=Math.exp(-dt*1.65);p.x=clamp(p.x+p.vx*dt,12,948);p.y=clamp(p.y+p.vy*dt,12,528);}
        if(line&&Math.hypot(line.x-dock.x,line.y-dock.y)<44){line.done=true;line=null;count++;score+=100+Math.floor(time);api.submit(score);}
        reason=count===3?'ALL CAPSULES RECOVERED':r<67?'ATMOSPHERIC ENTRY':time===0?'SHIFT ENDED':'';
        if(reason){ended=true;if(count===3&&chart.cleared<3){chart.cleared++;saveWorld('orbital_routes',chart);}}
        trail.push({x:ship.x,y:ship.y});if(trail.length>36)trail.shift();
      }
      c.fillStyle='#0b1027';c.fillRect(0,0,960,540);
      glow(700,115,330,'#624b9b');glow(130,415,280,'#245a71');
      for(let i=0;i<155;i++){const x=i*379%959,y=i*i*17%541;c.fillStyle=i%6?'#8293b6':'#fff0cb';c.fillRect(x,y,i%6?1:2,i%6?1:2);}
      const {x,y}=planet;
      glow(x,y,112,'#db9461');c.save();c.translate(x,y);c.rotate(-.28);c.strokeStyle='#cfaa9f88';c.lineWidth=11;c.beginPath();c.ellipse(0,0,130,32,0,0,2*Math.PI);c.stroke();c.restore();
      c.save();c.beginPath();c.arc(x,y,63,0,2*Math.PI);c.clip();
      const g=c.createLinearGradient(x-62,y-47,x+48,y+30);g.addColorStop(0,'#ffe6ac');g.addColorStop(.42,'#e5a384');g.addColorStop(.73,'#a56881');g.addColorStop(1,'#443b63');c.fillStyle=g;c.fillRect(x-65,y-65,130,130);
      for(let i=0;i<12;i++){c.strokeStyle=i%2?'#f6d7ab46':'#843c681f';c.lineWidth=2+i%4;c.beginPath();c.moveTo(x-70,y-60+i*11);c.bezierCurveTo(x-20,y-36+i*11,x+40,y-82+i*11,x+70,y-67+i*11);c.stroke();}
      c.restore();c.save();c.translate(x,y);c.rotate(-.28);c.lineWidth=5;c.strokeStyle='#edcabc';c.beginPath();c.ellipse(0,0,130,32,0,0,Math.PI);c.stroke();c.restore();
      glow(dock.x,dock.y,57,'#56c1ce');c.strokeStyle='#9de4e1';c.lineWidth=2;c.setLineDash([8,5]);c.beginPath();c.arc(dock.x,dock.y,40,0,2*Math.PI);c.stroke();c.setLineDash([]);label(c,'DOCK',dock.x,dock.y+4,12,'#ddf5e8','center');
      for(const p of pods){if(p.done)continue;glow(p.x,p.y,23,'#f6b963');c.save();c.translate(p.x,p.y);c.rotate(.785);c.fillStyle='#ffdc88';c.fillRect(-6,-6,12,12);c.fillStyle='#6c5468';c.fillRect(-3,-3,6,6);c.restore();}
      if(line){c.strokeStyle='#96ece1';c.lineWidth=2;c.beginPath();c.moveTo(ship.x,ship.y);c.lineTo(line.x,line.y);c.stroke();}
      c.strokeStyle='#8bd5e155';c.beginPath();trail.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
      c.save();c.translate(ship.x,ship.y);c.rotate(ship.a);if(u.key('arrowup','w')&&!ended){c.fillStyle='#ffb663';c.beginPath();c.moveTo(-8,-4);c.lineTo(-19-4*Math.sin(t*36),0);c.lineTo(-8,4);c.fill();}
      c.fillStyle='#e7f4ef';c.beginPath();c.moveTo(14,0);c.lineTo(-10,-8);c.lineTo(-6,0);c.lineTo(-10,8);c.fill();c.fillStyle='#6198b7';c.fillRect(-1,-2,6,4);c.restore();
      label(c,'CAPSULES  '+count+' / 3',25,39,16,'#f6d7ac');label(c,Math.ceil(time)+' s',935,39,16,'#c4d8ea','right');
      if(ended){rr(c,270,210,420,112,15,'#151c34ee');label(c,reason,480,254,20,'#ffdbab','center');label(c,'Enter to launch another tug',480,288,13,'#dee6f2','center');}
      u.status.textContent=route.name+' · '+chart.cleared+'/3 routes cleared · '+(line?'Return to dock':ended?reason:score+' credits');
    });return ()=>u.stop();
  }};
})();
