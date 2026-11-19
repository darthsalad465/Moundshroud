// 3D scenery for the world games: the Sunset Circuit city and cars, the Cloudline Flight sky route, and the valley sky colours (A.worldArt).
(() => {
  const {sky,pine,person}=A.worldArt;
  const valleySky=['#426fad','#f5cda7','#a4a5aa','#78948c','#fff0b8'];
  const flightSky=['#364983','#ffc897','#b58f9e','#8c92a3','#fff0c7'];
  const citySky=['#171731','#b45f76','#63495f','#403851','#ffd4a0'];
  const noise=(x,z)=>{const a=Math.sin(x*17.71+z*39.24)*43758.53;return a-Math.floor(a);};
  function carMesh(s,v){
    const x=v.x,z=-v.y,a=-v.a;
    const part=(forward,side,y,w,h,d,color)=>s.box(x+forward*Math.cos(a)-side*Math.sin(a),y,z+forward*Math.sin(a)+side*Math.cos(a),w,h,d,color,a);
    s.patch(x,.12,z,24,12,'#27283e',a);
    for(const f of [-12,12])for(const side of [-9,9])part(f,side,1,8,7,3,'#242131');
    part(0,0,4,38,7,19,v.color);part(-2,0,11,20,6,16,'#508099');part(-3,0,17,14,2,16,v.color);
    for(const side of [-6,6]){part(19.2,side,7,1,2.4,4,'#fff4b9');part(-19.2,side,7,1,2.4,5,'#ff606e');}
  }
  function city(s,actor,walker,fleet,traffic,goal,yaw,t){
    const x=actor.x,z=-actor.y,dx=Math.cos(yaw),dz=-Math.sin(yaw);
    sky(s.ctx,citySky,t);
    s.begin([x-dx*113,66,z-dz*113],[x+dx*78,16,z+dz*78],{lens:525,range:1550,fog:'#aa7182'});
    for(let i=-1;i<=7;i++)for(let j=-1;j<=6;j++){
      const bx=i*320+160,bz=-(j*300+150);
      if(Math.hypot(bx-x,bz-z)>1330)continue;
      s.box(bx,-4,bz,320,3,300,'#34354b');
      for(let d=-125;d<=125;d+=50){s.box(bx+d,-.8,bz+150,19,.15,1.6,'#c69c76');s.box(bx-160,-.7,bz+d,1.6,.15,19,'#b59379');}
      s.box(bx,-.6,bz,235,2,215,'#787681');
      if(Math.hypot(bx-x,bz-z)<780){
        for(let mark=-3;mark<=3;mark++){
          s.box(bx-160+mark*7,-.45,bz+109,4,.1,11,'#ac9193');
          s.box(bx-118,-.45,bz+150+mark*7,11,.1,4,'#ac9193');
        }
        s.box(bx-116,2,bz-106,230,.5,1.8,'#d89499');
      }
      for(let k=0;k<4;k++){
        const tx=bx+(k%2-.5)*104,tz=bz+(Math.floor(k/2)-.5)*97;
        if(Math.hypot(tx-s.eye[0],tz-s.eye[2])<53)continue;
        const n=noise(i*4+k,j);const h=26+n*n*212,w=73+12*n,d=73;
        const tone=['#60566c','#51657a','#785a70','#4c5b71'][k];
        s.box(tx,1,tz,w,h,d,tone);s.box(tx,h+1,tz,w+2,2,d+2,'#b694a5');
        s.box(tx,h+3,tz,w*.55,6+n*7,d*.53,tone);
        const floors=Math.floor(h/12), glass=n>.48?'#efb77e':'#8ec5ce';
        for(let f=1;f<=floors;f++){
          const y=f*11;
          const sx=tx+Math.sign(x-tx)*(w/2+.5),sz=tz+Math.sign(z-tz)*(d/2+.5);
          for(let pane=-1;pane<=1;pane++){
            const tint=(f+k+pane)%4===0?'#776d82':glass;
            s.face([[sx,y,tz+pane*21-7],[sx,y+3,tz+pane*21-7],[sx,y+3,tz+pane*21+7],[sx,y,tz+pane*21+7]],tint);
            s.face([[tx+pane*21-7,y,sz],[tx+pane*21-7,y+3,sz],[tx+pane*21+7,y+3,sz],[tx+pane*21+7,y,sz]],tint);
          }
        }
        const accent=['#ff818f','#73dddb','#ffbf82','#ac95e7'][k];
        if(n>.44){s.box(tx,h-2,tz,w+1.8,1.4,d+1.8,accent);s.box(tx+w/2,4,tz+d/2,1.8,h*.8,1.8,accent);}
        if(n>.77){s.box(tx,h+8,tz,1.7,22,1.7,'#d8bcc8');s.box(tx,h+30,tz,2.5,2,2.5,'#ff667c');}
      }
      for(const side of [-1,1]){
        const lx=bx+side*112,lz=bz+112;s.box(lx,0,lz,1.7,24,1.7,'#555265');s.box(lx,24,lz,7,1.6,3,'#ffe7a5');
      }
    }
    for(const v of [...traffic,...fleet])carMesh(s,v);
    if(actor===walker)person(s,x,0,z,18);
    const lift=4*Math.sin(t*3);s.cone(goal.x,18+lift,-goal.y,7,10,'#ffdb77',5);
    for(let j=0;j<12;j++){const a=j*Math.PI/6;s.box(goal.x+15*Math.cos(a),.2,-goal.y+15*Math.sin(a),3,1.2,3,'#ffd18b');}
    s.finish();
  }
  function flight(s,{lateral,along,alt,heading,bank,pitch,rings,gate,runway,t,cockpit,raiders=[],pulses=[]}){
    sky(s.ctx,flightSky,t);
    const h=alt*.45,x=lateral,z=along,dx=Math.sin(heading),dz=Math.cos(heading);
    s.begin(cockpit?[x,h+1,z]:[x-65*dx,h+23,z-65*dz],[x+90*dx,h+(cockpit?1:2)+Math.tan(pitch)*90,z+90*dz],{lens:530,roll:bank*.65,fog:'#e3b9ab',range:3600});
    const region=Math.floor(z/280);
    for(let j=region-3;j<region+13;j++){
      for(let i=-6;i<=6;i++){
        const tx=i*280,tz=j*280,n=noise(i,j);
        s.box(tx,-15,tz,280,6,280,n>.5?'#6598a3':'#6e9da5');
        s.box(tx+60*n,-8,tz,38+n*53,.4,3,'#a7c0bc');
        if(Math.abs(tx)>240 && n>.23){
          const r=90+n*124,height=30+n*n*320;
          const mk=(i,frac)=>{const a=i*Math.PI/3+n,rad=r*(.75+.3*noise(i,j));return [tx+Math.cos(a)*rad*(1-frac)+frac*r*.24,-12+height*frac,tz+Math.sin(a)*rad*(1-frac)];};
          for(let face=0;face<6;face++){
            const next=(face+1)%6,edge=.57+noise(face,j)*.14,edge2=.57+noise(next,j)*.14;
            s.face([mk(face,0),mk(next,0),mk(next,edge2),mk(face,edge)],'#668c82',.78+.16*Math.cos(face+n));
            s.face([mk(face,edge),mk(next,edge2),mk(face,1)],n>.69?'#e4d6c5':'#a3ab91',.85+.14*Math.cos(face+n));
          }
        }
      }
    }
    s.box(0,-8,runway+440,195,8,980,'#86a07c');s.box(0,.2,runway+450,88,1,900,'#575f6c');
    for(let i=0;i<22;i++){const rz=runway+20+i*40;s.box(0,1.5,rz,2,.3,16,'#fff3ce');for(const xx of [-43,43])s.box(xx,1.5,rz,3,1,3,'#ffdf92');}
    // A ring consists of flat bands in world space, with the same opening as the scoring gate.
    for(let i=gate;i<rings.length;i++){
      const r=rings[i],points=(angle,outer)=>[r.lateral+Math.cos(angle)*(70+outer),r.altitude*.45+Math.sin(angle)*(47+outer),r.along];
      for(let k=0;k<24;k++){const a=k*Math.PI/12,b=(k+1)*Math.PI/12;s.face([points(a,0),points(a,3),points(b,3),points(b,0)],k%3?'#ffd785':'#f19061');}
    }
    for(const e of raiders){if(e.hp<=0)continue;
      const body=(side,up,fore)=>[e.x+side*Math.cos(e.a)+fore*Math.sin(e.a),e.y+up,e.z-side*Math.sin(e.a)+fore*Math.cos(e.a)];
      for(const sign of [-1,1])s.face([body(0,2,9),body(sign*20,0,-4),body(sign*3,0,-3),body(0,1,-11)],sign>0?'#d95760':'#eea164');
      s.face([body(0,1,-4),body(0,7,-11),body(0,1,-12)],'#ffca6a');
    }
    for(const p of pulses)s.box(p.x,p.y,p.z,2,2,5,p.ally?'#99ffeb':'#ff8677');
    if(cockpit){
      s.finish();const c=s.ctx;c.save();
      c.strokeStyle='#344052';c.lineWidth=12;c.beginPath();c.moveTo(48,540);c.quadraticCurveTo(4,95,254,-34);c.moveTo(912,540);c.quadraticCurveTo(956,95,706,-34);c.stroke();
      c.fillStyle='#263443';c.beginPath();c.moveTo(0,540);c.lineTo(0,468);c.quadraticCurveTo(480,381,960,468);c.lineTo(960,540);c.fill();
      for(const [i,value,title] of [[0,alt/2000,'ALT'],[1,heading/6.283,'HDG'],[2,.5+pitch,'ATT']]){
        const gx=360+i*120,gy=466;c.fillStyle='#172331';c.beginPath();c.arc(gx,gy,28,0,7);c.fill();c.strokeStyle='#92acae';c.lineWidth=2;c.stroke();
        for(let j=0;j<10;j++){const a=j*.52+2.3;c.fillStyle='#d4dcb9';c.fillRect(gx+Math.cos(a)*23,gy+Math.sin(a)*23,2,2);}
        const a=value*5+2.4;c.beginPath();c.moveTo(gx,gy);c.lineTo(gx+18*Math.cos(a),gy+18*Math.sin(a));c.strokeStyle='#ffa878';c.stroke();
        c.fillStyle='#d8e7d8';c.font='10px monospace';c.textAlign='center';c.fillText(title,gx,gy+17);
      }c.restore();return;
    }
    const transform=([side,y,fore])=>{
      const sx=side*Math.cos(bank)+y*Math.sin(bank),sy=y*Math.cos(bank)-side*Math.sin(bank);
      return [x+sx*dz+fore*dx,h+sy+fore*Math.sin(pitch),z-sx*dx+fore*dz];
    };
    const poly=(pts,col)=>s.face(pts.map(transform),col);
    for(const sign of [-1,1]){
      poly([[0,2,9],[sign*3,0,2],[sign*2,0,-8],[0,2,-14]],sign>0?'#e87a52':'#ffb07a');
      poly([[0,1,4],[sign*23,0,-1],[sign*22,0,-5],[0,1,-3]],'#f5d6a2');
      poly([[sign*16,.1,.4],[sign*19,.1,-.2],[sign*19,.1,-4.5],[sign*16,.1,-4]],'#c55748');
      poly([[0,2,-8],[sign*8,2,-12],[sign*7,2,-14],[0,2,-12]],'#dc7554');
    }
    poly([[0,2,-7],[0,7,-13],[0,2,-14]],'#f2a15e');
    poly([[-2,1,3],[0,4,2],[2,1,3],[0,2,7]],'#477887');s.finish();
  }
  Object.assign(A.worldArt,{city,flight,valleySky});
})();
