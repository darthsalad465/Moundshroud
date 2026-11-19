// Two original arcade arenas. Movement, collisions and cooldowns use a fixed simulation step.
(() => {
  const P=A.play,{mount,clamp,rr,label}=P.worldKit;
  const {sky,pine,person}=A.worldArt;
  const tau=Math.PI*2, wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const length=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const rise=(x,z)=>1.6*Math.sin(x*.026)+1.2*Math.cos(z*.032);
  const wave=(x,z,t)=>1.1*Math.sin(z*.047+t*1.32)+.63*Math.sin(x*.08-z*.022+t*1.7);
  const barriers=[[-88,30,16],[80,53,18],[-24,92,12],[45,-22,12],[-118,-93,20],[120,-104,20]];
  function model(s,b,sea,t){
    const a=b.a,h=sea?wave(b.x,b.z,t):rise(b.x,b.z),roll=sea?.065*Math.sin(t*1.5+b.z*.061):0;
    const paint=b.team===0?(sea?'#248b91':'#738b64'):(sea?'#ac4c4a':'#ac7959');
    const pt=(i,y,k)=>[b.x+i*Math.cos(a)+k*Math.sin(a),h+y+i*roll,b.z-i*Math.sin(a)+k*Math.cos(a)];
    const part=(i,y,k,w,height,d,color)=>{const [x,up,z]=pt(i,y,k);s.box(x,up,z,w,height,d,color,-a);};
    if(!sea){
      part(0,1,0,8,3,13,paint);for(const i of [-4.1,4.1]){
        part(i,.1,0,2,2.6,14,'#343b3a');
        for(let j=-5;j<=5;j+=2.5)part(i*1.1,.5,j,1.6,1.8,1.8,'#727a65');
      }
      s.box(b.x,h+4,b.z,6,2.4,6.4,paint,-b.turret);
      s.box(b.x+Math.sin(b.turret)*6,h+5.1,b.z+Math.cos(b.turret)*6,.85,.9,10,'#525e51',-b.turret);
      part(-1.4,6,0,1.2,1.1,1.2,'#42534e');return;
    }
    const rim=[[-4,-14],[-5.4,-8],[-5.1,7],[-3.5,12],[0,17],[3.5,12],[5.1,7],[5.4,-8],[4,-14]];
    s.face(rim.map(([i,k])=>pt(i,3,k)),'#b98b59');
    for(let j=0;j<rim.length;j++){
      const [x,z]=rim[j],[nx,nz]=rim[(j+1)%rim.length];
      s.face([pt(x,3,z),pt(nx,3,nz),pt(nx*.60,-1.4,nz*.9),pt(x*.60,-1.4,z*.9)],j%2?'#544137':'#6a4b36');
      s.face([pt(x,2.5,z),pt(nx,2.5,nz),pt(nx,3.1,nz),pt(x,3.1,z)],'#d7af73');
    }
    for(const k of [-7,4]){
      part(0,3,k,.42,18,.42,'#6f5238');
      for(let tier=0;tier<2;tier++){
        const y=9+tier*6,w=6-tier*1.5;
        for(let q=0;q<4;q++){
          const lo=-w+q*w/2,hi=lo+w/2,billow=i=>1.4*Math.cos(i/w*Math.PI/2)+.3*Math.sin(t*2+b.x);
          s.face([pt(lo,y+5,k),pt(hi,y+5,k),pt(hi*.84,y,k+billow(hi)),pt(lo*.84,y,k+billow(lo))],b.disabled?'#a99e80':b.flagship?'#8e3e44':q%2?'#eddfb2':'#ead6ab');
        }
        part(0,y+5,k,w*2+.7,.28,.28,'#745638');
      }
      s.face([pt(0,22,k),pt(0,20,k),pt(3.7,21.3,k+.5)],paint);
    }
    part(0,3,-10,8,2.1,5,paint);
    for(const i of [-1,1])for(let k=-6;k<9;k+=4)part(i*4.8,2.9,k,1.8,.65,.75,'#373d3d');
  }
  function arena(el,api,sea){
    const u=mount(el,api,sea?'BRINEWAKE · THE COPPER FLEET':'IRON VALE · SIGNAL RIDGE',
      sea?'W/S set sail · A/D rudder · Q/E port/starboard volley · B board the disabled crimson flagship within 38 units. On deck: WASD move, Space cutlass, F pistol.':
        'W/S drive · A/D turn hull · J/L rotate turret · Space fire. Hold the signal circle for 12 seconds or defeat the opposing team.');
    const s=u.scene,c=u.ctx,panorama=new Image();
    if(sea)panorama.src=new URL('../data/brinewake-horizon.png',document.querySelector('script[src*="play-fleet-armour.js"]').src).href;
    let units,player,flag,shots,bursts,tracks,t,score,end,charge,deck,accum,camera;
    const campaignId=sea?'brinewake_chart':'ironvale_operations';
    const operations=sea?['Copper Fleet','The Narrows','Crown Anchorage']:['Signal Ridge','East Relay','Last Crossing'];
    const log=P.worldKit.readWorld(campaignId)||{cleared:0};
    let operation,relayX,relayZ;
    function win(title){
      end=title;
      if(operation===log.cleared){log.cleared++;P.worldKit.saveWorld(campaignId,log);}
    }
    function reset(){
      operation=Math.min(2,log.cleared);
      relayX=[0,65,-65][operation];relayZ=[0,-5,25][operation];
      shots=[];bursts=[];tracks=[];units=[];t=score=charge=accum=camera=0;end='';deck=null;
      const size=sea?7:4;
      for(let team=0;team<2;team++)for(let i=0;i<size;i++){
        const b={x:(i===0?0:(i%2?1:-1)*Math.ceil(i/2)*(sea?39:25)),z:(team?1:-1)*(sea?82:67)+(i%3)*6,
          a:team?Math.PI:0,turret:team?Math.PI:0,team,hp:i===0&&!team?14:sea?7:5,v:0,vx:0,vz:0,cd:i*.17,sail:.45,disabled:false,mark:0};
        if(team){b.x+=operation*15;b.z+=operation*19;b.hp+=operation;}
        units.push(b);
      }
      player=units[0];flag=units[size];if(sea){flag.flagship=true;flag.hp=10+operation*2;}
    }
    function flash(x,z,col){bursts.push({x,z,col,age:0});}
    function fire(b,angle){
      if(b.cd>0||b.disabled)return;
      b.cd=sea?2.3:1.15;
      for(let i=0;i<(sea?4:1);i++){
        const shift=sea?(i-1.5)*3:0;
        shots.push({x:b.x+Math.sin(angle)*7+Math.sin(b.a)*shift,z:b.z+Math.cos(angle)*7+Math.cos(b.a)*shift,
          vx:Math.sin(angle)*(sea?81:114)+b.vx*.2,vz:Math.cos(angle)*(sea?81:114)+b.vz*.2,life:sea?2:2.7,age:0,team:b.team});
      }
      flash(b.x+Math.sin(angle)*8,b.z+Math.cos(angle)*8,'#ffcb76');
    }
    function damage(b){if(!b||b.hp<=0||b.disabled)return;b.hp--;flash(b.x,b.z,'#ff955d');
      if(b===flag&&sea&&b.hp<=2){b.disabled=true;b.hp=2;b.v=0;}
      if(b.hp===0&&b.team===1){score+=100;api.submit(score);}
    }
    function constrain(b){
      b.x=clamp(b.x,-245,245);b.z=clamp(b.z,-245,245);
      for(const [x,z,r] of barriers){const dx=b.x-x,dz=b.z-z,d=Math.hypot(dx,dz),min=r+(sea?6:5);
        if(d<min){const nx=d?dx/d:1,nz=d?dz/d:0;b.x=x+nx*min;b.z=z+nz*min;b.v*=.96;const vn=b.vx*nx+b.vz*nz;if(vn<0){b.vx-=vn*nx;b.vz-=vn*nz;}}}
    }
    function board(){
      if(!sea||deck||!flag.disabled||length(player,flag)>38)return;
      deck={x:0,z:-12,hp:8,a:0,cd:0,hurt:0,slash:0,shot:0,crew:Array.from({length:5+operation},(_,i)=>({x:(i%2?1:-1)*(2+i%3),z:-1+i*3,hp:2,cd:1+i*.3}))};
      u.help.textContent='Take the quarterdeck. WASD moves and faces your pirate. Space swings the cutlass, F fires the pistol.';
    }
    function onDeck(dt){
      const d=deck,dx=+u.key('d','arrowright')-+u.key('a','arrowleft'),dz=+u.key('w','arrowup')-+u.key('s','arrowdown');
      if(dx||dz)d.a=Math.atan2(dx,dz);const n=Math.max(1,Math.hypot(dx,dz));
      d.x=clamp(d.x+dx*dt*9/n,-6,6);d.z=clamp(d.z+dz*dt*9/n,-16,16);d.cd-=dt;d.hurt-=dt;d.slash=Math.max(0,d.slash-dt);d.shot=Math.max(0,d.shot-dt);
      const pistol=u.key('f');
      if((pistol||u.key(' '))&&d.cd<=0){
        d.cd=pistol?.9:.32;if(pistol)d.shot=.13;else d.slash=.24;
        const foe=d.crew.filter(e=>e.hp>0&&length(d,e)<(pistol?22:4)&&Math.abs(wrap(Math.atan2(e.x-d.x,e.z-d.z)-d.a))<(pistol?.38:1.6)).sort((a,b)=>length(d,a)-length(d,b))[0];
        if(foe){foe.hp--;foe.z=clamp(foe.z+Math.cos(d.a)*1.4,-16,16);}
      }
      for(const e of d.crew){if(!e.hp)continue;const dist=length(d,e)||1;e.cd-=dt;
        if(dist>2){e.x+=(d.x-e.x)/dist*2.4*dt;e.z+=(d.z-e.z)/dist*2.4*dt;}
        else if(e.cd<=0&&d.hurt<=0){e.cd=1.5;d.hp--;d.hurt=.8;}}
      if(!d.hp)end='Boarding repelled';
      else if(d.crew.every(e=>!e.hp)){score+=750;api.submit(score);win('Flagship captured');}
    }
    function simulate(dt){
      t+=dt;if(end)return;if(deck){onDeck(dt);return;}
      for(const b of units){
        if(!b.hp)continue;b.cd-=dt;b.mark-=dt;
        const drive=Number(u.key('w','arrowup'))-Number(u.key('s','arrowdown'));
        let steering=0,wanted=0;
        if(b===player){
          steering=Number(u.key('d','arrowright'))-Number(u.key('a','arrowleft'));
          b.sail=clamp(b.sail+drive*dt*.5,0,1);
          wanted=sea?b.sail*(13+5*Math.cos(b.a-.7)):drive*(drive<0?12:24);
          b.turret+=(Number(u.key('l'))-Number(u.key('j')))*dt*1.7;
          if(sea){if(u.key('q'))fire(b,b.a-Math.PI/2);if(u.key('e'))fire(b,b.a+Math.PI/2);}
          else if(u.key(' '))fire(b,b.turret);
        }else if(!b.disabled){
          const targets=units.filter(e=>e.team!==b.team&&e.hp>0&&!e.disabled);
          const target=targets.sort((i,j)=>length(b,i)-length(b,j))[0];
          if(target){
            const dist=length(b,target),bearing=Math.atan2(target.x-b.x,target.z-b.z);
            let desired=sea&&dist<105?bearing+(units.indexOf(b)%2?1:-1)*1.4:bearing;
            for(const [ox,oz,r] of barriers){
              const dx=ox-b.x,dz=oz-b.z,ahead=dx*Math.sin(b.a)+dz*Math.cos(b.a),side=dx*Math.cos(b.a)-dz*Math.sin(b.a);
              if(ahead>0&&ahead<r+25&&Math.abs(side)<r+7){desired=b.a+(side>=0?-1:1)*1.2;break;}
            }
            steering=clamp(wrap(desired-b.a)*2,-1,1);wanted=sea?9:dist>68?13:2;
            b.turret+=clamp(wrap(bearing-b.turret),-dt,dt);
            const aim=sea?b.a+Math.sign(wrap(bearing-b.a))*Math.PI/2:b.turret;
            if(dist<(sea?145:160)&&Math.abs(wrap(bearing-aim))<.2)fire(b,aim);
          }
        }
        const rate=sea?.65*Math.min(1,.12+Math.abs(b.v)/9):1.35;
        b.a+=steering*rate*dt;if(!sea&&b===player)b.turret+=steering*rate*dt;
        const slope=sea?0:(rise(b.x+Math.sin(b.a),b.z+Math.cos(b.a))-rise(b.x,b.z));
        b.v+=(wanted-b.v)*(1-Math.exp(-dt*(sea?.48:2.1)))-slope*dt*8;
        const grip=1-Math.exp(-dt*(sea?.9:6));b.vx+=(Math.sin(b.a)*b.v-b.vx)*grip;b.vz+=(Math.cos(b.a)*b.v-b.vz)*grip;
        b.x+=b.vx*dt;b.z+=b.vz*dt;constrain(b);
        if(b.mark<=0&&Math.abs(b.v)>2){tracks.push({x:b.x,z:b.z,a:b.a,life:sea?2:4});b.mark=.27;}
      }
      for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
        const a=units[i],b=units[j],d=length(a,b),min=sea?14:9;if(!a.hp||!b.hp||d>=min)continue;
        const nx=d?(a.x-b.x)/d:1,nz=d?(a.z-b.z)/d:0,push=(min-d)*.5;
        a.x+=nx*push;a.z+=nz*push;b.x-=nx*push;b.z-=nz*push;
      }
      for(const p of shots){p.age+=dt;p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;
        if(barriers.some(([x,z,r])=>Math.hypot(p.x-x,p.z-z)<r)){p.life=0;flash(p.x,p.z,'#d4bc91');continue;}
        const hit=units.find(b=>b.team!==p.team&&b.hp&&!b.disabled&&length(b,p)<(sea?7.5:5.7));if(hit){damage(hit);p.life=0;}}
      shots=shots.filter(p=>p.life>0);bursts=bursts.filter(e=>(e.age+=dt)<.36);tracks=tracks.filter(e=>(e.life-=dt)>0);
      if(!player.hp)end=sea?'Ship lost':'Tank disabled';
      else if(!sea){
        if(Math.hypot(player.x-relayX,player.z-relayZ)<22&&!units.some(b=>b.team&&b.hp&&Math.hypot(b.x-relayX,b.z-relayZ)<22))charge+=dt;else charge=Math.max(0,charge-dt*.7);
        if(charge>=12||units.every(b=>!b.team||!b.hp)){win('Ridge secured');score+=500;api.submit(score);}
      }
    }
    function scenery(){
      const ox=Math.floor(player.x/25)*25,oz=Math.floor(player.z/25)*25;
      for(let i=-10;i<=10;i++)for(let j=-9;j<=12;j++){
        const x=ox+i*25,z=oz+j*25;
        const y=(a,b)=>sea?wave(a,b,t):rise(a,b);
        const n=.5+.5*Math.sin(x*.07+z*.043);
        s.face([[x,y(x,z),z],[x+25,y(x+25,z),z],[x+25,y(x+25,z+25),z+25],[x,y(x,z+25),z+25]],
          sea?'#30828b':(n>.5?'#94a16e':'#89996b'),sea?.97+n*.04:1,sea?1:0);
        if(sea&&n>.62)s.box(x+7,y(x+7,z)+.45,z,5,.13,.26,'#9bc9bb');
      }
      for(const [x,z,r] of barriers){const h=sea?0:rise(x,z);
        s.cone(x,h-2,z,r,sea?7:12,sea?'#e2c28d':'#7a8273',8,.24);
        if(sea){s.box(x,4,z,.85,9,.85,'#91734f');for(let k=0;k<7;k++){const a=k*.90;
          s.face([[x,14,z],[x+5*Math.cos(a-.4),15,z+5*Math.sin(a-.4)],[x+9*Math.cos(a),10,z+9*Math.sin(a)]],'#58926a');}}
        else pine(s,x+3,h+5,z,12,'#567959');}
    }
    function renderDeck(){
      const d=deck;s.begin([d.x+1,21,d.z-21],[d.x,1,d.z+3],{range:95,lens:510,fog:'#bed4ba'});
      s.face([[-100,-1,-100],[100,-1,-100],[100,-1,100],[-100,-1,100]],'#30828b',1,1);s.box(0,-1,0,15,1.2,36,'#8e6548');
      for(let i=-7;i<8;i++)s.box(i,.22,0,.94,.1,35,i%2?'#b78c63':'#c2986a');
      for(const x of [-7.2,7.2])s.box(x,.2,0,.4,1.6,36,'#654f41');
      s.box(0,0,12,.8,10,.8,'#8f7150');
      for(const side of [-1,1])for(let z=-12;z<=12;z+=6){
        s.box(side*6,.32,z,1.2,.78,1.1,'#73523a');s.box(side*6.2,1.12,z,1.8,.45,.5,'#3e4849');
        s.box(side*7,1.9,z,.15,1.05,.15,'#b88a54');
      }
      s.box(0,.3,16,13,1,2,'#856344');s.box(-5.4,.4,14,1.1,1.6,1.1,'#a67a4b');
      s.face([[-6,8.5,12],[6,8.5,12],[5,5.2,12.7],[-5,5.2,12.7]],'#cc977d');
      model(s,{x:-24,z:8,a:.08,team:0},true,t);
      for(const e of d.crew)if(e.hp){person(s,e.x,.32,e.z,2.6);s.box(e.x,2.75,e.z,.9,.35,.8,'#a24246');}
      person(s,d.x,.32,d.z,2.8);
      if(d.slash||d.shot){const reach=d.shot?10:3.2,a=d.a+(d.slash?d.slash*6-.7:0);
        s.box(d.x+Math.sin(a)*reach/2,1.7,d.z+Math.cos(a)*reach/2,d.shot?.12:.24,.15,reach,d.shot?'#ffce76':'#d6e4dc',-a);}
      s.finish();
    }
    reset();
    u.loop(dt=>{
      if(end&&u.tapped('enter')){reset();u.help.textContent=sea?'Sail to the crimson flagship, disable it, then B to board.':'Hold the signal circle or defeat the opposing team.';}
      if(u.tapped('b')&&!end)board();
      accum+=dt;while(accum>=1/60){simulate(1/60);accum-=1/60;}
      sky(c,sea?['#698caa','#f5d0a2','#91a5a1','#7095a1','#ffe6ae']:['#607ea0','#ddd5ab','#9eaa9c','#809883','#ffdf9d'],t);
      if(sea&&panorama.naturalWidth)c.drawImage(panorama,0,-65,960,450);
      s.waterTime=t;
      if(deck)renderDeck();else{
        const desired=sea?player.a:player.turret;camera+=wrap(desired-camera)*(1-Math.exp(-dt*4.5));
        const sx=Math.sin(camera),sz=Math.cos(camera),y=sea?wave(player.x,player.z,t):rise(player.x,player.z);
        s.begin([player.x-sx*(sea?47:29),y+(sea?24:15),player.z-sz*(sea?47:29)],[player.x+sx*25,y+4,player.z+sz*25],{lens:500,range:415,fog:sea?'#b5ceca':'#c2c2a4'});
        scenery();
        for(const tr of tracks)for(const k of [-1,1]){
          const x=tr.x+Math.cos(tr.a)*k*(sea?4:3.4),z=tr.z-Math.sin(tr.a)*k*(sea?4:3.4);
          s.box(x,(sea?wave(x,z,t):rise(x,z))+.45,z,sea?.7:1.1,.09,2.5,sea?'#c3dfd1':'#656d52',-tr.a);}
        for(const b of units)if(b.hp)model(s,b,sea,t);
        if(!sea){for(let i=0;i<28;i++){const a=i*tau/28,x=relayX+Math.sin(a)*22,z=relayZ+Math.cos(a)*22;s.box(x,rise(x,z)+.2,z,1.5,.35,1.5,'#ffe299');}s.box(relayX,rise(relayX,relayZ),relayZ,.6,13,.6,'#706657');s.box(relayX+2,12+rise(relayX,relayZ),relayZ,4,.15,2,'#eab268');}
        for(const p of shots)s.box(p.x,(sea?wave(p.x,p.z,t):rise(p.x,p.z))+4+Math.sin(p.age*3)*2,p.z,1.1,1.1,1.1,'#ffe5a1');
        for(const b of bursts)s.cone(b.x,(sea?0:rise(b.x,b.z))+2,b.z,2+b.age*10,5+b.age*14,b.col,5);s.finish();
        // Tactical chart uses the same coordinates as the simulation.
        rr(c,806,17,137,119,9,'#152c32df');
        if(!sea){c.strokeStyle='#ffe299';c.strokeRect(871+relayX*.24,73-relayZ*.21,8,8);}
        for(const b of units)if(b.hp){c.fillStyle=b===player?'#fff9cd':b.flagship?'#ffbd61':b.team?'#f48779':'#8bdacc';
          const size=b===player||b.flagship?6:4;c.fillRect(874+b.x*.24,76-b.z*.21,size,size);}
      }
      const info=deck?'Crew remaining '+deck.crew.filter(e=>e.hp).length+' · vitality '+deck.hp:sea?(flag.disabled?'Board flagship · '+Math.ceil(length(player,flag))+' units · B within 38':'Disable the crimson flagship'):'Signal circle '+Math.min(12,charge).toFixed(1)+' / 12 s';
      rr(c,17,17,355,61,10,'#182b31e8');label(c,info,31,43,14,'#ffe4ad');
      label(c,'Hull '+player.hp+' / 14   ·   '+(sea?'Sail '+Math.round(player.sail*100)+'%':'Turret J / L')+'   ·   '+(player.cd>0?'Reloading':'Ready'),31,64,12,'#d0e3d8');
      u.status.textContent=(deck?'Boarding':sea?'Fleet engagement':'Signal ridge')+' · '+operations[operation]+' · '+log.cleared+'/3 cleared · '+score+' pts';
      if(end){rr(c,265,201,430,125,16,'#152a31f2');label(c,end,480,251,24,'#ffe3a8','center');label(c,log.cleared===3?'Campaign complete · Enter to replay':log.cleared>operation?'Operation cleared · Enter for next operation':'Enter to retry operation',480,286,14,'#e5e8de','center');}
    });
    return ()=>u.stop();
  }
  P.games.ironvale={name:'Iron Vale',icon:'🛡️',desc:'Command a tracked tank on Signal Ridge. Rotate your turret, fight alongside allies, and capture the relay.',mount:(el,api)=>arena(el,api,false)};
  P.games.brinewake={name:'Brinewake',icon:'🏴‍☠️',desc:'Lead a seven-ship squadron through an island fleet battle, board the flagship, and capture its quarterdeck.',mount:(el,api)=>arena(el,api,true)};
})();
