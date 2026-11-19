// Games › Little Valley: a first-person block world for digging, gathering wood and building a lantern-lit home.
(() => {
  const P=A.play,{mount,readWorld,saveWorld,clamp,rr,label}=P.worldKit;
  const N=25,H=24,STRIDE=N*N;
  const names=['Grass','Sand','Water','Stone','Wood','Crystal','Lantern','Leaves'];
  const colors=['#75ab53','#dbbd7c','#5fa8b7','#90949e','#966640','#b598d7','#ffdf8b','#538351'];
  const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const quads=[[[1,0,0],[1,0,1],[1,1,1],[1,1,0]],[[0,0,1],[0,0,0],[0,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,1,1],[0,1,1]],[[0,0,1],[1,0,1],[1,0,0],[0,0,0]],
    [[1,0,1],[0,0,1],[0,1,1],[1,1,1]],[[0,0,0],[1,0,0],[1,1,0],[0,1,0]]];
  const index=(x,y,z)=>x+z*N+y*STRIDE;
  const inside=(x,y,z)=>x>=0&&x<N&&z>=0&&z<N&&y>=0&&y<H;
  const noise=(x,z)=>{const a=Math.sin(x*47.7+z*113.1)*27143.27;return a-Math.floor(a);};
  P.games.voxel={name:'Little Valley',icon:'🧱',desc:'Explore a first-person block world. Tunnel into crystal seams, gather wood and build a home lit by crafted lanterns.',mount(el,api){
    const tools=names.map((name,i)=>'<button class="ib" data-slot="'+i+'">'+name+'</button>').join('')+
      '<button class="ib" data-craft>Craft lantern · 2 wood + 1 crystal</button><details data-workshop><summary>Workshop & forge</summary><div data-recipes></div><span data-stock></span></details>';
    const u=mount(el,api,'LITTLE VALLEY','Click to capture mouse · WASD walk · Space jump · hold left to mine · right click to place · 1–8 select · Esc releases mouse. Arrow keys aim, M mines, B builds.',tools);
    const s=u.scene,c=u.ctx,canvas=u.canvas,saved=readWorld('valley_blocks');
    const cells=new Uint8Array(STRIDE*H);
    let bag=[3,2,0,1,0,0,0,0],slot=0,x=12.5,z=12.5,y=7,yaw=.42,pitch=-.18,vy=0,vx=0,vz=0,grounded=false;
    let edits=0,artDirty=true,dirty=false,age=0,lastSave=0,work=0,targetId=-1,swing=0,mouse=false,place=false;
    const get=(i,j,k)=>inside(i,j,k)?cells[index(i,j,k)]:0;
    const put=(i,j,k,id)=>{if(inside(i,j,k))cells[index(i,j,k)]=id;};
    function surface(i,k){for(let j=H-1;j>=0;j--)if(get(i,j,k))return j+1;return 0;}
    if(saved?.cells?.length===cells.length){
      cells.set(saved.cells);({bag,slot,x,y,z,yaw,pitch,edits}=saved);
    }else{
      const legacy=readWorld('valley'),trees=[];
      for(let i=0;i<N;i++)for(let k=0;k<N;k++){
        const old=legacy?.world?.[i]?.[k],n=noise(i,k);
        const top=old?4+old.h:Math.round(5+1.7*Math.sin(i*.31)+1.5*Math.cos(k*.32)+.6*Math.sin((i+k)*.55));
        for(let j=0;j<=top;j++){
          const type=j===top?(old?old.type+1:top<=3?(top===2?3:2):1):
            old?.below?.[old.below.length-(top-j)]!=null?old.below[old.below.length-(top-j)]+1:j<top-1&&noise(i+j*8,k)>.91?6:4;
          put(i,j,k,type);
        }
        if((old?old.tree:n>.90)&&Math.hypot(i-12,k-12)>2)trees.push([i,top+1,k]);
      }
      for(const [i,j,k] of trees){
        for(let dy=0;dy<4;dy++)put(i,j+dy,k,5);
        for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let h=2;h<=4;h++){
          if(Math.abs(a)+Math.abs(b)+(h===4?2:0)>3||(!a&&!b&&h<4))continue;
          if(!get(i+a,j+h,k+b))put(i+a,j+h,k+b,8);
        }
      }
      if(legacy?.inventory?.length===7){bag=[...legacy.inventory,0];x=clamp(legacy.px+.5,.5,N-.5);z=clamp(legacy.py+.5,.5,N-.5);}
      y=surface(Math.floor(x),Math.floor(z))+.01;
    }
    const kit=Object.assign({planks:0,bench:0,kiln:0,ingot:0,pick:0,boots:0,lighthouse:0,heat:0},saved?.kit);
    const recipes=[
      ['Saw 4 planks',{wood:1},{planks:4}],
      ['Assemble workbench',{planks:3,stone:2},{bench:1}],
      ['Build kiln',{stone:5,planks:2},{kiln:1},'bench'],
      ['Stoke kiln (+3 heat)',{wood:1},{heat:3},'kiln'],
      ['Smelt crystal ingot',{crystal:1,heat:1},{ingot:1},'kiln'],
      ['Forge seam pick',{ingot:2,planks:2,heat:1},{pick:1},'bench'],
      ['Forge spring boots',{ingot:2,leaves:2,heat:1},{boots:1},'bench'],
      ['Raise the valley lighthouse',{ingot:3,planks:4,lantern:2},{lighthouse:1},'bench']
    ];
    const blocks={wood:4,stone:3,crystal:5,lantern:6,leaves:7};
    const stations=Object.assign({},saved?.stations);
    for(const id of ['bench','kiln'])if(kit[id]&&!stations[id])stations[id]={x:Math.floor(x)+.5,z:Math.floor(z)+.5,y};
    const nearby=id=>{const q=stations[id];return q&&Math.hypot(x-q.x,z-q.z,y-q.y)<5;};
    function stationSite(){
      for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[1,1]]){
        const i=Math.floor(x)+dx,k=Math.floor(z)+dz;
        if(i<0||k<0||i>=N||k>=N)continue;
        const h=surface(i,k);
        if(Math.abs(h-y)<2&&!Object.values(stations).some(q=>q.x===i+.5&&q.z===k+.5))return {x:i+.5,y:h,z:k+.5};
      }return null;
    }
    const count=k=>k in blocks?bag[blocks[k]]:kit[k];
    const change=(k,n)=>{if(k in blocks)bag[blocks[k]]+=n;else kit[k]+=n;};
    const recipesEl=el.querySelector('[data-recipes]');
    recipesEl.innerHTML=recipes.map(([title,cost],i)=>'<button class="ib" data-recipe="'+i+'">'+title+' · '+Object.entries(cost).map(([k,n])=>n+' '+k).join(', ')+'</button>').join(' ');
    function available([title,cost,result,station]){
      const item=Object.keys(result)[0];
      return (!station||nearby(station))&&!(item==='ingot'&&kit.readyAt)&&(!['bench','kiln','pick','boots','lighthouse'].includes(item)||!kit[item])&&Object.entries(cost).every(([k,n])=>count(k)>=n);
    }
    recipesEl.onclick=e=>{
      const b=e.target.closest('[data-recipe]');if(!b)return;
      const recipe=recipes[+b.dataset.recipe];if(!available(recipe))return;
      const item=Object.keys(recipe[2])[0];
      if(item==='bench'||item==='kiln'||item==='lighthouse'){
        const site=stationSite();if(!site){u.help.textContent='Find level ground with space beside you for the station.';return;}stations[item]=site;
      }
      Object.entries(recipe[1]).forEach(([k,n])=>change(k,-n));if(item==='ingot')kit.readyAt=Date.now()+4000;else Object.entries(recipe[2]).forEach(([k,n])=>change(k,n));
      if(item==='lighthouse'){u.help.textContent='The valley lighthouse is lit. Ships can find the coast again.';api.submit(edits+500);}
      dirty=true;toolbar();save();
    };
    const save=()=>{if(dirty){saveWorld('valley_blocks',{cells:Array.from(cells),bag,slot,x,y,z,yaw,pitch,edits,kit,stations});dirty=false;}};
    function toolbar(){
      recipesEl.querySelectorAll('[data-recipe]').forEach(b=>{const r=recipes[+b.dataset.recipe];b.disabled=!available(r);b.title=r[3]?'Requires '+r[3]:'Hand crafting';});
      el.querySelector('[data-stock]').textContent='Planks '+kit.planks+' · ingots '+kit.ingot+' · kiln heat '+kit.heat+(kit.readyAt?' · smelting…':'')+Object.entries(stations).map(([id,q])=>' · '+id+' '+Math.round(Math.hypot(x-q.x,z-q.z))+' blocks away').join('')+(kit.pick?' · seam pick equipped':'')+(kit.boots?' · spring boots equipped':'');

      el.querySelectorAll('[data-slot]').forEach(b=>{const i=Number(b.dataset.slot);b.classList.toggle('on',i===slot);b.textContent=(i+1)+' '+names[i]+' ×'+bag[i];});
    }
    el.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{slot=Number(b.dataset.slot);toolbar();dirty=true;});
    u.button('[data-craft]',()=>{
      if(bag[4]<2||bag[5]<1){u.help.textContent='Lantern recipe needs two wood blocks and one crystal.';return;}
      bag[4]-=2;bag[5]--;bag[6]++;slot=6;dirty=true;toolbar();save();
    });
    toolbar();
    const look=e=>{if(document.pointerLockElement!==canvas)return;yaw+=e.movementX*.0026;pitch=clamp(pitch-e.movementY*.0026,-1.48,1.48);dirty=true;};
    const press=e=>{
      if(document.pointerLockElement!==canvas){
        if(e.button===0)canvas.requestPointerLock?.()?.catch?.(()=>{u.help.textContent='Use arrows to aim, M to mine and B to place.';});
        return;
      }
      if(e.button===0)mouse=true;if(e.button===2)place=true;
    };
    const release=()=>{mouse=false;};
    const menu=e=>e.preventDefault();
    document.addEventListener('mousemove',look);document.addEventListener('pointerlockchange',release);
    canvas.addEventListener('pointerdown',press);canvas.addEventListener('contextmenu',menu);window.addEventListener('pointerup',release);
    window.addEventListener('blur',release);
    function blocked(px,py,pz){
      for(const i of [Math.floor(px-.22),Math.floor(px+.22)])for(const k of [Math.floor(pz-.22),Math.floor(pz+.22)]){
        if(i<0||i>=N||k<0||k>=N||py<0)return true;
        for(let j=Math.floor(py+.002);j<=Math.floor(py+1.7);j++)if(get(i,j,k))return true;
      }return false;
    }
    function cast(eye,dir){
      const cell=eye.map(Math.floor),step=dir.map(Math.sign),delta=dir.map(v=>v?Math.abs(1/v):Infinity);
      const next=dir.map((v,i)=>v>0?(cell[i]+1-eye[i])/v:v<0?(cell[i]-eye[i])/v:Infinity);
      let prev=null;
      for(let n=0;n<26;n++){
        if(get(...cell))return {cell:cell.slice(),prev};
        const axis=next.indexOf(Math.min(...next));if(next[axis]>5.2)break;
        prev=cell.slice();cell[axis]+=step[axis];next[axis]+=delta[axis];
      }return null;
    }
    let exposed=[];
    function rebuild(){
      exposed=[];
      for(let j=0;j<H;j++)for(let k=0;k<N;k++)for(let i=0;i<N;i++){
        const id=get(i,j,k);if(!id)continue;
        for(let f=0;f<6;f++){const [a,b,d]=directions[f];if(get(i+a,j+b,k+d)||j===0&&f===3)continue;
          const shade=[.84,.90,1,.54,.69,.82][f]*(.94+noise(i+j,k)*.06);
          exposed.push({pts:quads[f].map(([a,b,d])=>[i+a,j+b,k+d]),color:id===1&&f!==2?'#927452':colors[id-1],shade});
        }
      }artDirty=false;
    }
    function edit(cell,id){put(...cell,id);dirty=artDirty=true;swing=.23;toolbar();save();}
    u.loop(dt=>{
      const beforeAge=age;age+=dt;
      if(kit.readyAt&&Date.now()>=kit.readyAt){kit.readyAt=0;kit.ingot++;dirty=true;toolbar();save();}
      if(Math.floor(beforeAge*2)!==Math.floor(age*2)&&el.querySelector('[data-workshop]').open)toolbar();
      swing=Math.max(0,swing-dt);
      for(let i=0;i<8;i++)if(u.tapped(String(i+1))){slot=i;dirty=true;toolbar();}
      const turn=Number(u.key('arrowright'))-Number(u.key('arrowleft')),tilt=Number(u.key('arrowup'))-Number(u.key('arrowdown'));
      yaw+=turn*1.65*dt;pitch=clamp(pitch+tilt*dt*1.2,-1.48,1.48);
      const a=Number(u.key('d'))-Number(u.key('a')),b=Number(u.key('w'))-Number(u.key('s'));
      const speed=(u.key('shift')?5.6:3.55)/Math.max(1,Math.hypot(a,b));
      const dx=(a*Math.cos(yaw)+b*Math.sin(yaw))*speed,dz=(b*Math.cos(yaw)-a*Math.sin(yaw))*speed;
      const grip=1-Math.exp(-(grounded?15:6)*dt);
      vx+=(dx-vx)*grip;vz+=(dz-vz)*grip;
      if(!blocked(x+vx*dt,y,z))x+=vx*dt;else vx=0;
      if(!blocked(x,y,z+vz*dt))z+=vz*dt;else vz=0;
      if(u.key(' ')&&grounded)vy=kit.boots?9.1:7.3;
      vy=Math.max(-18,vy-20*dt);const dy=vy*dt,parts=Math.max(1,Math.ceil(Math.abs(dy)/.08));
      for(let k=0;k<parts;k++){if(blocked(x,y+dy/parts,z)){vy=0;break;}y+=dy/parts;}
      grounded=blocked(x,y-.085,z);if(dx||dz||vy||turn||tilt)dirty=true;
      const eye=[x,y+1.52,z],dir=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
      const hit=cast(eye,dir),key=hit?index(...hit.cell):-1;
      if(key!==targetId){work=0;targetId=key;}
      if(hit&&(mouse||u.key('m'))&&hit.cell[1]>0){
        const id=get(...hit.cell);work+=dt*(kit.pick?2.3:1)/(id===4?.72:id===5?.55:.32);
        if(work>=1){bag[id-1]++;edit(hit.cell,0);work=0;}
      }else work=0;
      if((place||u.tapped('b'))&&hit?.prev&&inside(...hit.prev)&&bag[slot]>0){
        const [i,j,k]=hit.prev;
        if(!(x+.22>i&&x-.22<i+1&&z+.22>k&&z-.22<k+1&&y+1.7>j&&y<j+1)){
          bag[slot]--;edits++;edit(hit.prev,slot+1);api.submit(edits);
        }
      }
      place=false;
      A.worldArt.sky(c,A.worldArt.valleySky,age);
      s.begin(eye,eye.map((v,i)=>v+dir[i]),{lens:485,range:44,fog:'#d4d8b4'});
      if(artDirty)rebuild();
      s.voxelTexture=true;
      for(const f of exposed)s.face(f.pts,f.color,f.shade);
      for(const [id,q] of Object.entries(stations)){
        const h=q.y;
        if(id==='lighthouse'){
          s.box(q.x,h,q.z,.85,2.4,.85,'#dbbd89');s.box(q.x,h+.8,q.z,.88,.46,.88,'#b3624e');
          s.box(q.x,h+2.4,q.z,.78,.64,.78,'#ffe279');s.cone(q.x,h+3.04,q.z,.75,.54,'#97533f',6);
        }else if(id==='bench'){
          for(const dx of [-.34,.34])for(const dz of [-.27,.27])s.box(q.x+dx,h,q.z+dz,.10,.63,.10,'#75503b');
          s.box(q.x,h+.62,q.z,.95,.14,.78,'#c38a56');s.box(q.x+.20,h+.77,q.z,.19,.13,.35,'#657881');
        }else{
          s.box(q.x,h,q.z,.87,.74,.82,'#735c56');s.box(q.x,h+.72,q.z,.47,.33,.46,'#805d50');
          s.box(q.x,h+.19,q.z-.419,.50,.34,.025,kit.heat||kit.readyAt?'#ffae57':'#302f38');
        }
      }
      s.finish();
      if(hit){c.strokeStyle='#fff0b8aa';c.lineWidth=1.5;
        for(const quad of quads){const pts=quad.map(p=>s.project(p.map((v,i)=>v+hit.cell[i])));if(pts.some(p=>!p))continue;
          c.beginPath();pts.forEach(([sx,sy],i)=>i?c.lineTo(sx,sy):c.moveTo(sx,sy));c.closePath();c.stroke();}}
      c.fillStyle='#192331';c.fillRect(472,269,16,3);c.fillRect(479,262,3,16);c.fillStyle='#fff5dc';c.fillRect(474,270,12,1);c.fillRect(480,264,1,12);
      if(work){c.fillStyle='#283438';c.fillRect(454,289,52,4);c.fillStyle='#ffe9a4';c.fillRect(454,289,52*work,4);}
      // First-person tool, deliberately angular like the blocks.
      c.save();c.translate(840,445);c.rotate(-.55-(work?.25*Math.sin(age*18):swing));
      c.fillStyle='#755137';c.fillRect(-8,-67,17,157);c.fillStyle='#c19869';c.fillRect(-5,-67,4,151);
      c.fillStyle='#5d7480';c.fillRect(-43,-81,80,17);c.fillStyle='#bdd4d2';c.fillRect(-37,-85,65,7);c.fillStyle='#8ca9aa';c.fillRect(31,-74,12,25);c.restore();
      for(let i=0;i<8;i++){const bx=310+i*43;rr(c,bx,483,40,40,4,i===slot?'#e6cc8a':'#29353cdf');c.fillStyle=colors[i];c.fillRect(bx+9,491,19,15);label(c,String(bag[i]),bx+33,518,11,i===slot?'#283132':'#fff','right');}
      u.status.textContent=names[slot]+' · '+(hit?names[(get(...hit.cell)||1)-1]:'Free look');
      if(age-lastSave>=3){save();lastSave=age;} // also persist immediately when leaving.
    });
    return ()=>{if(document.pointerLockElement===canvas)document.exitPointerLock();document.removeEventListener('mousemove',look);document.removeEventListener('pointerlockchange',release);window.removeEventListener('pointerup',release);window.removeEventListener('blur',release);u.stop(save);};
  }};
})();
