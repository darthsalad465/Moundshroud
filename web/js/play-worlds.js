// Moundshroud Worlds: five original, offline-first arcade adventures.
// Inspired by broad genres, with original art, worlds, controls, and game logic.
(() => {
  const P = A.play;
  if (!P) return;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const addStyle = () => {
    if (document.getElementById('mw-style')) return;
    const s = document.createElement('style'); s.id = 'mw-style';
    s.textContent = '.mw-world{width:min(100%,1100px);min-height:100%;display:flex;flex-direction:column;gap:10px;color:var(--text)}.mw-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(135deg,rgba(116,91,177,.18),rgba(19,24,39,.9))}.mw-title{font:700 16px/1.2 "Sitka Display",Georgia,serif;letter-spacing:.02em}.mw-status{margin-left:auto;font:600 12px ui-monospace,Consolas,monospace;color:#f4c66a}.mw-help{font-size:12px;color:var(--mute);line-height:1.45}.mw-screen{width:100%;height:clamp(300px,58vh,660px);border:1px solid var(--line);border-radius:16px;background:#101321;box-shadow:0 18px 56px rgba(0,0,0,.34);touch-action:none;outline:none}.mw-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.mw-tools .ib.on{border-color:#f4c66a;color:#ffe2a0}.mw-chip{border:1px solid var(--line);border-radius:999px;padding:4px 9px;background:rgba(255,255,255,.04);font-size:11px;color:var(--mute)}.mw-screen:focus-visible{border-color:#f4c66a;box-shadow:0 0 0 2px rgba(244,198,106,.2),0 18px 56px rgba(0,0,0,.34)}@media(max-width:650px){.mw-screen{height:52vh;min-height:290px}.mw-world{gap:7px}}'; s.textContent += '.mw-world:fullscreen{box-sizing:border-box;width:100vw;height:100vh;min-height:0;padding:8px;background:#101525;overflow:auto}.mw-world:fullscreen .mw-screen{width:min(100%,calc((100vh - 130px)*1.77778));height:auto;max-height:calc(100vh - 110px);min-height:100px;aspect-ratio:16/9;align-self:center}.mw-world:fullscreen .mw-tools{flex:none}'; document.head.appendChild(s);
  };
  function mount(el, api, title, hint, toolHtml) {
    addStyle();
    el.innerHTML = '<div class="mw-world"><div class="mw-head"><span class="mw-title">' + title + '</span><span class="mw-status" data-score></span><button type="button" class="ib" data-full>Fullscreen</button></div><canvas class="mw-screen" tabindex="0" aria-label="' + esc(title) + ' game canvas"></canvas><div class="mw-tools">' + (toolHtml || '') + '<span class="mw-help" data-help>' + hint + '</span></div></div>';
    const shell=el.querySelector('.mw-world'),full=shell.querySelector('[data-full]');
    const fullscreenChange=()=>{const active=document.fullscreenElement===shell;full.textContent=active?'Exit fullscreen':'Fullscreen';full.setAttribute('aria-pressed',String(active));};
    full.onclick=async()=>{try{if(document.fullscreenElement===shell)await document.exitFullscreen();else await shell.requestFullscreen();}catch{help.textContent='Fullscreen is unavailable in this window.';}};
    document.addEventListener('fullscreenchange',fullscreenChange);
    const canvas = el.querySelector('canvas'), ctx = canvas.getContext('2d');
    const status = el.querySelector('[data-score]'), help = el.querySelector('[data-help]');
    const pressed = new Set(), taps = new Set(); let raf = 0, last = 0, alive = true, W = 960, H = 540;
    const resize = () => { const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); W = Math.max(320, r.width); H = Math.max(240, r.height); const w = Math.round(W * d), h = Math.round(H * d); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0); };
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();
    const keydown = e => { if (A.cur !== 'play'||e.target.closest?.('.mw-world select,.mw-world input')) return; const key = e.key.toLowerCase(); if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault(); if (!e.repeat && !pressed.has(key)) taps.add(key); pressed.add(key); };
    const clearKeys = () => { pressed.clear(); taps.clear(); };
    window.addEventListener('blur', clearKeys);
    const keyup = e => pressed.delete(e.key.toLowerCase());
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    const key = (...names) => names.some(n => pressed.has(n));
    const pointer = { x: 0, y: 0, down: false, tap: false };
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * 960 / r.width, y: (e.clientY - r.top) * 540 / r.height }; };
    canvas.addEventListener('pointermove', e => Object.assign(pointer, pos(e)));
    canvas.addEventListener('pointerdown', e => { Object.assign(pointer, pos(e)); canvas.focus({preventScroll:true}); pointer.down = true; pointer.tap = true; });
    let scene;
    const ui = { get scene(){return scene || (scene=new A.worldArt.Scene(ctx));}, ctx, canvas, api, status, help, key, tapped: key => taps.has(key), pointer, W: () => W, H: () => H, button: (selector, fn) => { const b = el.querySelector(selector); if (b) b.addEventListener('click', fn); }, stop: fn => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); scene?.close(); document.removeEventListener('fullscreenchange',fullscreenChange); if(document.fullscreenElement===shell)document.exitFullscreen().catch(()=>{}); window.removeEventListener('blur', clearKeys); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('pointerup', up); if (fn) fn(); }, loop: draw => { const frame = t => { if (!alive) return; resize(); const dt = Math.min(.04, (t - (last || t)) / 1000); last = t; ctx.setTransform(canvas.width / 960,0,0,canvas.height / 540,0,0); if (A.cur === 'play' && !document.hidden) draw(dt,t/1000); taps.clear(); pointer.tap = false; raf = requestAnimationFrame(frame); }; raf = requestAnimationFrame(frame); } };
    const up = () => { pointer.down = false; };
    window.addEventListener('pointerup', up);
    return ui;
  }
  const rr = (c,x,y,w,h,r,fill) => { c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill(); };
  const label = (c,t,x,y,size=14,color='#fff',align='left') => { c.font='600 '+size+'px ui-monospace,Consolas,monospace';c.fillStyle=color;c.textAlign=align;c.fillText(t,x,y); };
  const rand = (() => { let s=918273; return () => { s=(s*1664525+1013904223)>>>0; return s/4294967296; }; })();

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function readWorld(id) {
    try { return JSON.parse(ls.get('worlds_v1_' + id, 'null')); } catch { return null; }
  }
  function saveWorld(id, data) {
    try { ls.set('worlds_v1_' + id, JSON.stringify(data)); } catch { /* Storage may be unavailable. */ }
  }

  P.worldKit={mount,readWorld,saveWorld,clamp,label,rr};

  // Boardwalk: a score-attack skate run with ollies, manuals, rails and soft landings.
  P.games.skate = { name:'Boardwalk', icon:'🛹', desc:'Skate a moonlit boardwalk, link ollies and manuals, and stick the landing.', mount(el,api) {
    const record=readWorld('boardwalk_tour')||{cleared:0};
    const finishes=[3200,4800,6400];let finish;
    const u=mount(el,api,'BOARDWALK · NIGHT SESSION','← → carve · Space ollie · hold ↓ to manual · land cleanly to bank your combo.'); const c=u.ctx;
    let x=120,v=235,y=0,vy=0,air=0,score=0,combo=1,bestCombo=1,dist=0,crash=0,obs=[],next=520,run=true,trail=[];
    const reset=()=>{finish=finishes[Math.min(2,record.cleared)];x=120;v=235;y=0;vy=0;air=0;score=0;combo=1;dist=0;obs=[];next=460;run=true;crash=0;trail=[];};
    reset();
    u.button('.mw-screen',()=>{if(!run)reset();});
    u.loop((dt,t)=>{ const sp=dt*60; if(run){v=Math.max(150,Math.min(410,v+(u.key('arrowright','d')?2:-.35)*sp));x=Math.max(95,Math.min(810,x+(u.key('arrowright','d')?2.2:u.key('arrowleft','a')?-2:0)*sp));dist+=v*dt; if(dist>next){obs.push({x:1040,type:rand()<.32?'rail':rand()<.5?'cone':'gap',w:55+rand()*55});next+=350+rand()*280;} obs.forEach(o=>o.x-=v*dt);obs=obs.filter(o=>o.x>-100);if(air>0){y+=vy*dt;vy-=820*dt;if(y<=0&&vy<0){y=0;air=0;if(vy < -425){run=false;crash=1;api.submit(Math.floor(score));}else{score+=Math.round(110*combo);combo=Math.min(8,combo+1);bestCombo=Math.max(combo,bestCombo);}}} else if(u.key(' ')){air=1;vy=360;score+=40*combo;}else if(u.key('arrowdown','s')&&v>230){score+=dt*18;combo=Math.min(8,combo+dt*.08);}for(const o of obs)if(!o.hit&&Math.abs(o.x-x)<o.w/2+24&&y===0){o.hit=true;if(o.type==='rail'&&u.key('arrowdown','s')){score+=220*combo;combo=Math.min(8,combo+1);}else{run=false;crash=1;combo=1;api.submit(Math.floor(score));}}trail.push({x:x-20,y:420-y,life:.4});trail=trail.filter(p=>(p.life-=dt)>0); }
      if(run&&dist>=finish){run=false;api.submit(Math.floor(score));if(record.cleared<3){record.cleared++;saveWorld('boardwalk_tour',record);}}
      const sky=c.createLinearGradient(0,0,0,540);sky.addColorStop(0,'#11172e');sky.addColorStop(.63,'#3a3158');sky.addColorStop(1,'#171a2a');c.fillStyle=sky;c.fillRect(0,0,960,540);c.fillStyle='#f9dfaa';c.beginPath();c.arc(770,100,42,0,7);c.fill();for(let i=0;i<30;i++){let sx=(i*137-dist*.12)%1000;if(sx<0)sx+=1000;c.fillStyle=i%3?'#d4d8ee':'#ffd98d';c.globalAlpha=.3+(i%4)*.12;c.fillRect(sx,(i*79)%230,2,2);}c.globalAlpha=1;
      c.fillStyle='#26354b';c.beginPath();c.moveTo(0,320);for(let i=0;i<=20;i++){const xx=i*50,yy=295+Math.sin((xx+dist*.1)/80)*19+Math.sin(xx/27)*8;c.lineTo(xx,yy);}c.lineTo(960,540);c.lineTo(0,540);c.fill();c.fillStyle='#d1b17d';c.fillRect(0,390,960,150);c.fillStyle='#372b35';c.fillRect(0,414,960,126);c.fillStyle='#f4c66a';c.fillRect(0,414,960,5);for(let i=0;i<12;i++){let sx=(i*105-dist*.65)%1120;if(sx< -100)sx+=1120;c.fillStyle='#372c49';c.fillRect(sx,340,9,74);c.fillStyle='#f2c974';c.beginPath();c.arc(sx+5,336,11,Math.PI,0);c.fill();c.fillStyle='#ffe9b3';c.globalAlpha=.75;c.beginPath();c.arc(sx+5,356,5,0,7);c.fill();c.globalAlpha=1;}
      for(const o of obs){if(o.type==='rail'){rr(c,o.x-o.w/2,394,o.w,8,4,'#e6a9b6');rr(c,o.x-o.w/2+8,402,6,24,2,'#b77b8d');rr(c,o.x+o.w/2-14,402,6,24,2,'#b77b8d');}else if(o.type==='cone'){c.fillStyle='#ff8d68';c.beginPath();c.moveTo(o.x,386);c.lineTo(o.x-18,414);c.lineTo(o.x+18,414);c.fill();}else{c.fillStyle='#111321';c.fillRect(o.x-o.w/2,414,o.w,22);}}
      trail.forEach(p=>{c.globalAlpha=p.life*1.3;c.fillStyle='#83c9ff';c.beginPath();c.arc(p.x,p.y,3,0,7);c.fill();});c.globalAlpha=1;
      const sy=398-y;c.save();c.translate(x,sy);c.rotate(air?Math.sin((.48-air)*12)*.5:u.key('arrowdown','s')?.12:0);rr(c,-37,10,74,9,5,'#f4c66a');c.fillStyle='#292d3d';for(const dx of [-25,22]){c.beginPath();c.arc(dx,22,7,0,7);c.fill();c.fillStyle='#bcc5db';c.beginPath();c.arc(dx,22,3,0,7);c.fill();c.fillStyle='#292d3d';}c.strokeStyle='#f1c9a7';c.lineWidth=8;c.lineCap='round';c.beginPath();c.moveTo(0,-35);c.lineTo(2,5);c.moveTo(1,-28);c.lineTo(-19,-12);c.moveTo(1,-27);c.lineTo(19,-11);c.moveTo(2,4);c.lineTo(-15,11);c.moveTo(2,4);c.lineTo(17,11);c.stroke();c.fillStyle='#f1c9a7';c.beginPath();c.arc(0,-48,11,0,7);c.fill();c.fillStyle='#34264a';c.beginPath();c.arc(0,-53,12,Math.PI,0);c.fill();c.restore();
      rr(c,20,18,204,76,13,'rgba(11,14,27,.74)');label(c,'SCORE '+Math.floor(score),36,49,18,'#fff');label(c,'COMBO ×'+combo.toFixed(1),36,76,13,'#f4c66a');label(c,'BEST ×'+bestCombo.toFixed(1),36,96,11,'#b8bfd5');if(!run){rr(c,280,190,400,150,20,'rgba(12,14,24,.88)');label(c,crash?'WIPEOUT':'SESSION COMPLETE',480,246,25,'#ffd6a0','center');label(c,'Click the board or press Enter for another run',480,286,13,'#d7d9e7','center');if(u.key('enter'))reset();}u.status.textContent=Math.max(0,Math.ceil((finish-dist)/10))+' m to finish · '+record.cleared+'/3 runs cleared';
    }); return ()=>u.stop();
  }};

  // Cloudline: a gentle instrumented flight loop with checkpoints and runway approach.
  P.games.cloudline = { name:'Cloudline Flight', icon:'✈️', desc:'Carry lantern mail through six sky gates, manage airspeed and flare over the lit runway.', mount(el,api) {
    const u = mount(el, api, 'CLOUDLINE · LANTERN MAIL',
      'W/S pitch up/down · A/D bank · Shift/Ctrl throttle · F toggle flaps. Follow the lanterns, then touch down on the lit strip. C changes view. In Sky Duel, hold Space to fire pulses.', '<button class="ib" data-cockpit>C · Cockpit view</button><button class="ib" data-duel>Sky Duel</button>');
    const c = u.ctx, rings = Array.from({ length: 6 }, (_, i) => ({
      lateral: Math.sin(i * 1.18) * 130, altitude: 900 - i * 115, along: 520 + 420 * i
    }));
    const runway = rings[rings.length - 1].along + 600;
    let pitch, bank, alt, spd, heading, score, gate, land, landed, crash, along, lateral, throttle, flaps, sink, message, t;
    let cockpit=false,duel=false,hull,raiders,pulses,reload,duelWon;
    const wings=readWorld('cloudline_wings')||{mail:false,duel:false};
    function qualify(kind){if(!wings[kind]){wings[kind]=true;saveWorld('cloudline_wings',wings);}}
    const viewButton=el.querySelector('[data-cockpit]');
    function changeView(){cockpit=!cockpit;viewButton.textContent=cockpit?'C · Chase view':'C · Cockpit view';}
    u.button('[data-cockpit]',changeView);
    u.button('[data-duel]',()=>{duel=!duel;el.querySelector('[data-duel]').textContent=duel?'Return to mail route':'Sky Duel';restart();});
    function restart() {
      hull=5;reload=0;duelWon=false;pulses=[];
      raiders=Array.from({length:4},(_,i)=>({x:(i%2?1:-1)*i*42,y:441+i*5,z:280+95*i,a:Math.PI,hp:2,timer:3+i}));
      pitch = bank = heading = score = gate = along = lateral = t = sink = 0;
      alt = 980; spd = 105; throttle = .6; flaps = land = landed = crash = false;
      message = 'Lantern mail outbound';
    }
    restart();
    u.loop(dt => {
      if(u.tapped('c'))changeView();
      if ((crash || landed || duelWon) && u.tapped('enter')) restart();
      if (!landed && !crash && !duelWon) {
        t += dt;
        if (u.tapped('f')) flaps = !flaps;
        throttle = clamp(throttle + ((+u.key('shift')) - (+u.key('control'))) * dt * .4, 0, 1);
        const stick = (+u.key('d','arrowright')) - (+u.key('a','arrowleft'));
        bank += (stick * .85 - bank) * Math.min(1, dt * 2.5);
        pitch = clamp(pitch + ((+u.key('w','arrowup')) - (+u.key('s','arrowdown'))) * dt * .30, -.52, .45);
        const targetSpeed = 53 + throttle * 89 - pitch * 52 - (flaps ? 14 : 0);
        spd += (targetSpeed - spd) * dt * .32;
        heading = (heading + Math.tan(bank) * dt * .42 + Math.PI * 2) % (Math.PI * 2);
        along += Math.cos(heading) * spd * .9 * dt;
        lateral += (Math.sin(heading) * spd * .9 + Math.sin(t * .15) * 3) * dt;
        const stall = Math.max(0, (flaps ? 53 : 64) - spd);
        sink = Math.sin(pitch) * spd * 1.7 - stall * 1.8;
        alt += sink * dt;
        if (!duel && !land && along >= rings[gate].along) {
          const ring = rings[gate];
          const through = Math.abs(lateral - ring.lateral) < 70 && Math.abs(alt - ring.altitude) < 105;
          if (through) { score += 250; api.submit(score); }
          message = through ? 'Lantern stamped +250' : 'Lantern missed';
          land = ++gate === rings.length;
        }
        if (alt <= 0) {
          alt = 0;
          landed = land && along >= runway && along <= runway + 900 && Math.abs(lateral) <= 44 &&
            Math.cos(heading) > .96 && Math.abs(bank) < .2 && spd < 84 && sink > -15;
          crash = !landed;
          if (landed){if(score===rings.length*250)qualify('mail');score+=1000;}
          api.submit(score);
        }
      }
      if(duel && !crash && !duelWon){
        const py=alt*.45;reload-=dt;
        if(u.key(' ')&&reload<=0){reload=.16;pulses.push({x:lateral,y:py,z:along,vx:Math.sin(heading)*390,vy:Math.tan(pitch)*390,vz:Math.cos(heading)*390,life:2,ally:true});}
        for(const e of raiders){
          if(e.hp<=0)continue;
          const dx=lateral-e.x,dz=along-e.z,range=Math.hypot(dx,dz);
          const desired=Math.atan2(dx,dz)+(range<115?1.7:0);
          e.a+=clamp(Math.atan2(Math.sin(desired-e.a),Math.cos(desired-e.a)),-1.2,1.2)*dt;
          e.x+=Math.sin(e.a)*57*dt;e.z+=Math.cos(e.a)*57*dt;e.y+=(py+10*Math.sin(t*.6+e.z*.01)-e.y)*dt*.55;
          e.timer-=dt;
          if(e.timer<=0 && range<540){e.timer=3.2;const d=Math.hypot(dx,py-e.y,dz)||1;
            pulses.push({x:e.x,y:e.y,z:e.z,vx:dx/d*150,vy:(py-e.y)/d*150,vz:dz/d*150,life:4,ally:false});}
        }
        for(const shot of pulses){
          shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;shot.z+=shot.vz*dt;shot.life-=dt;
          if(shot.ally){const e=raiders.find(e=>e.hp>0&&Math.hypot(shot.x-e.x,shot.y-e.y,shot.z-e.z)<24);
            if(e){shot.life=0;e.hp--;if(!e.hp){score+=250;api.submit(score);}}}
          else if(Math.hypot(shot.x-lateral,shot.y-py,shot.z-along)<12){shot.life=0;hull--;if(hull<=0)crash=true;}
        }
        pulses=pulses.filter(p=>p.life>0);duelWon=raiders.every(e=>e.hp<=0);
        if(duelWon)qualify('duel');
        message='Sky Duel · shields '+hull+'/5 · rivals '+raiders.filter(e=>e.hp>0).length;
      }
      A.worldArt.flight(u.scene,{lateral,along,alt,heading,bank,pitch,rings:duel?[]:rings,gate,runway,t,cockpit,raiders:duel?raiders:[],pulses});
      const goal = land ? { lateral: 0, along: runway, altitude: 0 } : rings[gate];
      label(c, 'THR '+Math.round(throttle*100)+'%   FLAPS '+(flaps?'DOWN':'UP')+'   VSI '+Math.round(sink*60)+' ft/min', 24, 500, 14, '#fff');
      label(c, duel ? 'Sky Duel · Space fires · '+message : land ? 'Strip '+Math.round(runway-along)+' ahead · offset '+Math.round(lateral)+' · <84 kt · sink <900 ft/min' :
        'Lantern '+(gate+1)+' · target '+goal.altitude+' ft · '+Math.round(goal.lateral-lateral)+' lateral', 24, 522, 13, '#fff');
      rr(c,18,18,172,104,13,'rgba(13,21,37,.76)');label(c,'ALT '+Math.round(alt)+' ft',32,48,14);label(c,'IAS '+Math.round(spd)+' kt',32,73,14);label(c,'HDG '+String(Math.round(heading*180/Math.PI)).padStart(3,'0')+'°',32,98,14,'#83c9ff');rr(c,760,18,180,64,13,'rgba(13,21,37,.76)');label(c,duel?'SKY DUEL':land?'RUNWAY APPROACH':'GATE '+Math.min(gate+1,rings.length)+' / '+rings.length,850,48,13,'#ffe39a','center');label(c,'SCORE '+score,850,69,12,'#fff','center');
      c.strokeStyle='rgba(255,255,255,.76)';c.lineWidth=2;c.beginPath();c.moveTo(450,273);c.lineTo(470,273);c.moveTo(490,273);c.lineTo(510,273);c.moveTo(480,263);c.lineTo(480,283);c.stroke();if(crash||landed||duelWon){rr(c,290,202,380,112,18,'rgba(13,21,37,.9)');label(c,duelWon?'SKY CLEARED':duel&&crash?'SORTIE ENDED':crash?'HARD OR OFF-STRIP LANDING':'SMOOTH LANDING · BEAUTIFULLY DONE',480,250,17,crash?'#ff9fae':'#9bf0c2','center');label(c,'Score '+score+' · press Enter to fly again',480,282,13,'#eef','center');}u.status.textContent=message+' · '+(wings.mail?'Mail wings earned':'Mail wings: stamp all six and land')+' · '+(wings.duel?'Duel wings earned':'Duel wings: clear the sky');
    });return ()=>u.stop();
  }};

  // Sunset Circuit: top-down open-city cruise with deliveries and responsive driving.
  P.games.sunset = { name:'Sunset Circuit', icon:'🚗', desc:'Walk the neon districts, pick a ride and run timed parcels between night-shift dispatch desks.', mount(el,api) {
    const u = mount(el, api, 'SUNSET CIRCUIT · NIGHT DISPATCH',
      'WASD / arrows walk or drive · E enter or leave a stopped vehicle · Space handbrake. Walk to a lit dispatch desk to collect a night-shift job.');
    const c = u.ctx, world = 2400;
    const depots = [
      { x: 660, y: 900, name: 'Neon Post' }, { x: 1600, y: 620, name: 'Glass Market' },
      { x: 340, y: 300, name: 'Wavelength FM' }, { x: 1920, y: 1480, name: 'Moon Pier' }
    ];
    const fleet = [
      { x: 680, y: 905, a: 0, v: 0, name: 'Courier coupe', max: 280, color: '#ef7e76' },
      { x: 1610, y: 642, a: 1.57, v: 0, name: 'Market van', max: 205, color: '#74bec6' },
      { x: 320, y: 320, a: 0, v: 0, name: 'Radio cab', max: 245, color: '#f4bf73' }
    ];
    const dispatch=readWorld('sunset_dispatch')||{del:0,score:0,target:0,hit:0};
    const walker = { x: depots[dispatch.target].x-20, y: depots[dispatch.target].y-10, a: 0, v: 0 };
    let cameraYaw=-Math.PI/2;
    let car = walker, score = dispatch.score, del = dispatch.del, hit = dispatch.hit, time = 0, target = dispatch.target, carrying = false, cooldown = 0;
    let note = 'Report to '+depots[target].name+' on foot';
    const shifts=['Parcel run','Medical express','Midnight relay'];
    const traffic = Array.from({length: 14}, (_,i) => ({
      x: i%2 ? (1+i%6)*320+15 : i*163%world, y: i%2 ? i*133%1800 : (1+i%5)*300-15,
      a: i%2 ? Math.PI/2 : 0, v: 52+i*2, color: ['#ffd27c','#7ccad6','#d58fcb'][i%3]
    }));
    const onStreet = (x,y) => Math.min(x%320,320-x%320) < 45 || Math.min(y%300,300-y%300) < 45;
    function move(actor, dx, dy) {
      const x = clamp(actor.x+dx, 12, world-12), y = clamp(actor.y+dy, 12, 1788);
      if (onStreet(x,actor.y)) actor.x=x; else actor.v *= .6;
      if (onStreet(actor.x,y)) actor.y=y; else actor.v *= .6;
    }
    u.loop(dt => {
      const steer = Number(u.key('d','arrowright'))-Number(u.key('a','arrowleft'));
      const gas = Number(u.key('w','arrowup'))-Number(u.key('s','arrowdown'));
      if (u.tapped('e')) {
        if (car === walker) {
          const near = fleet.find(v => Math.hypot(v.x-walker.x,v.y-walker.y)<55);
          if (near) { car=near; note='Driving '+near.name; } else note='Walk up to a parked vehicle';
        } else if (Math.abs(car.v)<24) {
          walker.x=car.x; walker.y=car.y; car.v=car.vx=car.vy=0;
          move(walker, -Math.sin(car.a)*22, Math.cos(car.a)*22);
          car=walker; note='On foot';
        } else note='Slow down to exit';
      }
      if (car===walker) {
        const length=Math.max(1,Math.hypot(steer,gas));
        move(walker,steer*120*dt/length,-gas*120*dt/length);
      } else {
        car.v=clamp((car.v+gas*210*dt)*Math.pow(u.key(' ')? .91:.994, dt*60),-85,car.max);
        car.a+=steer*Math.sign(car.v)*Math.min(Math.abs(car.v)/45,1)*(u.key(' ')?3.2:1.9)*dt;
        const traction=1-Math.exp(-(u.key(' ')?2.25:8)*dt);
        car.vx=(car.vx||0)+(Math.cos(car.a)*car.v-(car.vx||0))*traction;
        car.vy=(car.vy||0)+(Math.sin(car.a)*car.v-(car.vy||0))*traction;
        move(car,car.vx*dt,car.vy*dt);
      }
      cooldown=Math.max(0,cooldown-dt);
      for (const t of traffic) {
        t.x=(t.x+Math.cos(t.a)*t.v*dt)%world; t.y=(t.y+Math.sin(t.a)*t.v*dt)%1800;
        if (car!==walker && !cooldown && Math.hypot(t.x-car.x,t.y-car.y)<26) {
          car.v*=.3; hit++; cooldown=1.6; note='Traffic bump · handle the cargo gently';
        }
      }
      if (car===walker && Math.hypot(car.x-depots[target].x,car.y-depots[target].y)<22) {
        if (carrying) {
          const pay=100+Math.ceil(time)*2; score+=pay; del++; carrying=false;
          api.submit(score); note='Delivered +'+pay+' · next pickup marked';
        } else { carrying=true; time=[70,60,52][Math.min(2,Math.floor(del/2))]; note='Parcel collected · deliver on foot'; }
        target=(target+1)%depots.length;
        if(!carrying){saveWorld('sunset_dispatch',{del,score,hit,target});if(del===6)note='Six jobs delivered · night shift complete';}
      }
      if (carrying && (time=Math.max(0,time-dt))===0) { carrying=false; note='Job expired · collect another parcel'; }
      const g=depots[target], desired=car===walker?-Math.PI/2:car.a;
      cameraYaw+=Math.atan2(Math.sin(desired-cameraYaw),Math.cos(desired-cameraYaw))*Math.min(1,dt*5);
      A.worldArt.city(u.scene,car,walker,fleet,traffic,g,cameraYaw,performance.now()/1000);
      rr(c,18,18,360,86,14,'rgba(13,17,29,.88)');
      label(c,(carrying?'DROP · ':'PICKUP · ')+g.name,34,45,16,'#ffdc90');
      label(c,carrying?Math.ceil(time)+' s · '+note:note,34,70,12);
      label(c,(car===walker?'ON FOOT':car.name)+' · '+del+' jobs · '+score+' credits',34,91,12);
      // The map shares the same street spacing and world coordinates as navigation.
      rr(c,780,18,158,119,10,'rgba(12,19,34,.88)');
      c.fillStyle='#536175';
      for(let x=0;x<world;x+=320)c.fillRect(788+x*.059,25,2,105);
      for(let y=0;y<1800;y+=300)c.fillRect(788,25+y*.059,140,2);
      for(const [point,color,size] of [...fleet.map(v=>[v,v.color,3]),[g,'#ffdc70',7],[car,'#fff',5]]){
        c.fillStyle=color; c.fillRect(788+point.x*.059-size/2,25+point.y*.059-size/2,size,size);
      }
      u.status.textContent=(del>=6?'Dispatch veteran':shifts[Math.floor(del/2)])+' · '+del+' deliveries · '+hit+' bumps · '+score+' credits';
    });return ()=>u.stop();
  }};

  // Each recipe describes its output, ingredients and placement layer. Fixture anchors
  // sit at the lower left, so walls can be painted independently behind furniture.
  const cottageRecipes={};
  function cottage(id,name,group,yieldCount,cost,layer,style,colors,station){
    cottageRecipes[id]={id,name,group,yieldCount,cost,layer,style,colors,station};
  }
  cottage('board','Sawn boards','Materials',8,{wood:1});
  cottage('brick','Fired brick','Materials',8,{dirt:2,wood:1});
  cottage('glass','Crystal glass','Materials',6,{crystal:1,stone:1},null,null,null,'hearth');
  cottage('cloth','Woven linen','Materials',4,{fiber:2});
  for(const [id,name,colors] of [
    ['oak','Honey oak',['#a36b3f','#d49b59']],['walnut','Dark walnut',['#674230','#a56b45']],
    ['pine','Whitewashed pine',['#c4bba0','#ede3c7']]]){
    cottage(id,name+' flooring','Floors & masonry',8,{board:4},'block','planks',colors);
    cottage(id+'panel',name+' paneling','Interior walls',12,{board:3},'wall','panel',colors);
  }
  for(const [id,name,cost,colors] of [
    ['fieldstone','Fieldstone',{stone:2},['#727980','#acadb0']],['clinker','Red brick',{brick:4},['#9b5443','#dc936d']],
    ['limestone','Cream limestone',{stone:2,dirt:1},['#bbab88','#e8d9b6']]]){
    cottage(id,name+' blocks','Floors & masonry',8,cost,'block','masonry',colors);
    cottage(id+'wall',name+' backing','Interior walls',12,cost,'wall','masonry',colors);
  }
  for(const [id,name,colors] of [
    ['ochre','Ochre plaster',['#c49c68','#76513a']],['sage','Sage plaster',['#9cab85','#62523a']],
    ['cream','Ivory plaster',['#e1d3b5','#73523b']]]){
    cottage(id,name+' with timber frame','Interior walls',12,{dirt:2,board:1},'wall','frame',colors);
  }
  for(const [id,name,cost,colors] of [
    ['slate','Blue slate',{stone:2,board:1},['#465767','#96a4ac']],
    ['clay','Terracotta',{brick:3},['#a45437','#e49a64']],
    ['reed','Golden thatch',{fiber:2,board:1},['#99783d','#e5c879']]]){
    for(const [suffix,title] of [['roof','tiles'],['rise','left pitch'],['fall','right pitch']]){
      cottage(id+suffix,name+' '+title,'Roofing',8,cost,'wall',suffix,colors);
    }
  }
  const furnishings=[
    ['door','Carved oak door',1,2,{board:4}],['amberwindow','Amber leaded window',1,1,{board:1,glass:1}],
    ['rosewindow','Rose window',2,2,{board:2,glass:3}],['bookcase','Library shelves',2,2,{board:6,cloth:1}],
    ['bed','Quilted bed',2,1,{board:4,cloth:2}],['hearth','Stone hearth',2,2,{stone:5,brick:2}],
    ['chair','Sage chair',1,1,{board:2,cloth:1}],['table','Carved dining table',2,1,{board:4}],
    ['flowers','Wildflower box',2,1,{board:2,fiber:2}],['lantern','Brass lantern',1,1,{glass:1,crystal:1}],
    ['cabinet','Apothecary cabinet',2,2,{board:5,glass:1}],['bench','Carpenter’s bench',2,1,{board:4,stone:1}]
  ];
  furnishings.forEach(([id,name,w,h,cost],i)=>{
    cottage(id,name,'Furnishings',1,cost,'fixture',i,null,id==='bench'?null:'bench');
    Object.assign(cottageRecipes[id],{w,h});
  });
  function drawCottageTile(c,r,x,y,size,atlas){
    const xx=x*size,yy=y*size,[base,trim]=r.colors;
    c.save();c.translate(xx,yy);
    if(r.style==='rise'||r.style==='fall'){
      c.beginPath();c.moveTo(0,size);c.lineTo(size,size);c.lineTo(r.style==='rise'?size:0,0);c.closePath();c.clip();
    }
    c.fillStyle=base;c.fillRect(0,0,size+.65,size+.65);
    const roof=r.group==='Roofing';
    const swatch=roof?(r.id.startsWith('clay')?1:r.id.startsWith('reed')?2:0):r.style==='frame'?4:r.style==='masonry'?5:3;
    if(atlas.naturalWidth){
      const edge=atlas.width/3,height=atlas.height/2;
      const col=((x%3)+3)%3,row=((y%3)+3)%3;
      c.drawImage(atlas,(swatch%3+col/3)*edge,(Math.floor(swatch/3)+row/3)*height,edge/3,height/3,0,0,size+.6,size+.6);
      if(!roof){
        const tint=r.id.startsWith('pine')||r.id.startsWith('limestone')?'#f5ead39c':r.id.startsWith('walnut')?'#30202d80':
          r.id.startsWith('clinker')?'#a63f2ba8':r.id.startsWith('sage')?'#7993618c':r.id.startsWith('ochre')?'#aa651e73':null;
        if(tint){c.fillStyle=tint;c.fillRect(0,0,size+.65,size+.65);}
      }
    }
    if(r.style==='frame'){
      c.fillStyle=trim;
      if(x%3===0){c.fillRect(0,0,3.5,size+.4);c.fillStyle='#d0a77f';c.fillRect(1,0,.7,size);}
      if(y%3===0){c.fillStyle=trim;c.fillRect(0,0,size+.4,3);}
      if(x%3===y%3){c.strokeStyle=trim;c.lineWidth=2.4;c.beginPath();c.moveTo(0,0);c.lineTo(size,size);c.stroke();}
    }
    if(r.style==='rise'||r.style==='fall'){
      c.strokeStyle=trim;c.lineWidth=2;c.beginPath();c.moveTo(0,r.style==='rise'?size:0);c.lineTo(size,r.style==='rise'?0:size);c.stroke();
    }
    if(r.layer==='wall'&&r.group!=='Roofing'){c.fillStyle='#30272e30';c.fillRect(0,0,size,size);}
    c.restore();
  }

  // Emberwild: a compact side-scrolling exploration and building adventure.
  P.games.emberwild={name:'Emberwild',icon:'⛏️',desc:'Explore five wild regions, craft weapons, build a home and hunt six guardians.',mount(el,api){
    const book=readWorld('ember_library')||{active:'ember',worlds:[{id:'ember',name:'Copperfall',mode:'Adventurer',seed:0}]};
    let stop;
    function enter(world){
      book.active=world.id;
      stop=runEmber(el,api,world,book,next=>{
        const exists=book.worlds.some(w=>w.id===next.id);
        const proposed={active:next.id,worlds:exists?book.worlds:[...book.worlds,next]};
        if(!A.emberExpedition.write('ember_library',proposed))return false;
        stop();Object.assign(book,proposed);enter(next);return true;
      });
    }
    enter(book.worlds.find(w=>w.id===book.active)||book.worlds[0]);
    return ()=>stop();
  }};
  function runEmber(el,api,world,book,changeWorld){
    const {regions,quarry,relics:relicTable,weapons,difficulty,write,encode,decode,pretty}=A.emberExpedition;
    const rules=difficulty[world.mode];
    const tools = ['mine','blade','dirt','stone','rope','wall','torch'].map((name,i)=>'<button class="ib'+(i?'':' on')+'" data-item="'+name+'">'+name+'</button>').join('')+
      '<button class="ib" data-rope>Weave 4 rope · 2 dirt</button><button class="ib" data-wall>Shape 4 walls · 1 stone</button><button class="ib" data-torch>Make 3 lights · 1 crystal</button><button class="ib" data-beacon>Bind beacon · 2 crystals</button><button class="ib" data-tonic>Brew & drink · 1 crystal + 2 dirt</button><button class="ib" data-use>Interact (E)</button><button class="ib" data-atlas>Survey map (M)</button>'+
      '<details data-cottage><summary>House workshop</summary><div class="mw-tools"><label>Category <select data-category></select></label> <label>Recipe <select data-blueprint></select></label> <label>Batches <select data-batch><option>1</option><option>5</option><option>10</option></select></label> <button class="ib" data-make>Craft</button> <button class="ib" data-equip>Build</button> <button class="ib" data-gather>Gather beechwood & fiber</button></div><div data-formula></div><div data-supplies></div><small>Gather near a beech. Mine dirt, stone and crystals. Place a bench for furniture and a hearth for glass. Drag to lay blocks or paint walls. Click to place furniture. Pick up furnishings with the pickaxe.</small></details>'+
      '<details data-smith><summary>Tool forge & boss challenges</summary><p>Mine orange copper near the upper caves, blue mooniron below it, and violet starstone in the depths. Forge beside a placed stone hearth. Each pick opens the next seam. Blades deal more damage and reach farther.</p><div data-metals></div><div class="mw-tools"><button class="ib" data-forge="pick"></button><button class="ib" data-forge="blade"></button></div><p data-hunts></p><div class="mw-tools"><button class="ib" data-hunt="quarry">Challenge Quarry King</button><button class="ib" data-hunt="glass">Challenge Glasswing</button></div></details>'+
      '<details data-worlds><summary>Saved worlds</summary><div data-current></div><label>World <select data-slots></select></label> <button class="ib" data-load>Open</button> <button class="ib" data-save>Save now</button><div><label>New world <input data-name maxlength="48" placeholder="World name"></label> <select aria-label="New world difficulty" data-mode><option>Explorer</option><option selected>Adventurer</option><option>Veteran</option></select> <button class="ib" data-create>Create world</button></div><small>Explorer gives eight hearts and weaker bosses. Adventurer gives five hearts. Veteran gives four hearts, stronger bosses and double incoming damage.</small></details>'+
      '<details data-pack><summary>Inventory & expedition gear (I)</summary><div data-packinfo></div><div data-items></div><label>Stack <select data-stack></select></label> <button class="ib" data-store>Store or retrieve at beacon</button> <button class="ib" data-expand></button><div><label>Weapon <select data-weapon></select></label> <button class="ib" data-arm></button><span data-ability></span></div><div><label>Hunt <select data-quarry></select></label> <button class="ib" data-lure>Craft summon</button> <button class="ib" data-call>Use summon</button></div><div data-trail></div><div data-drops></div><button class="ib" data-relic></button></details>';
    const u=mount(el,api,'EMBERWILD · THE GLOW SEAM',
      'A/D run · Space jump · W/S climb rope · 1–7 select hotbar · hold click to dig · F quick strike · Shift dash · click to build. E rings a nearby bell. Follow the survey at top right. Enter recalls you to your beacon.',tools);
    const backdrop=new Image(),beech=new Image();
    beech.src=new URL('../data/emberwild-beech.png',document.querySelector('script[src*="play-worlds.js"]').src).href;
    backdrop.src=new URL('../data/emberwild-copperfall.png',document.querySelector('script[src*="play-worlds.js"]').src).href;
    const artBase=new URL('../data/',document.querySelector('script[src*="play-worlds.js"]').src);
    const cast=new Image(),earth=new Image(),relics=new Image();
    const zoom=1.42, furnishingArt=new Image(),cottageArt=new Image();
    cottageArt.src=new URL('emberwild-cottage-materials.png',artBase).href;
    furnishingArt.src=new URL('emberwild-furnishings.png',artBase).href;
    const crops=[[0,0,363,363],[381,4,327,354],[736,12,335,346],[1107,0,311,361],
      [2,417,359,259],[376,371,342,314],[781,379,242,308],[1068,379,382,308],
      [0,771,379,237],[444,716,178,350],[733,705,290,365],[1051,743,398,305]];
    relics.src=new URL('emberwild-relics.png',artBase).href;
    cast.src=new URL('emberwild-cast.png',artBase).href;
    earth.src=new URL('emberwild-earth.png',artBase).href;
    const poses=[[114,8,229,495],[557,33,425,459],[1103,7,359,420],[34,587,430,370],[515,610,496,315],[1024,544,511,449]];
    function sprite(index,x,y,h,dir=1,stretch=1){
      if(!cast.naturalWidth)return false;
      const [sx,sy,sw,sh]=poses[index],w=h*sw/sh;
      c.save();c.translate(x,y);c.scale(dir*stretch,1);c.drawImage(cast,sx,sy,sw,sh,-w/2,-h,w,h);c.restore();
      return true;
    }
    const patterns=[];
    earth.onload=()=>{
      for(let band=0;band<2;band++){
        const sheet=document.createElement('canvas');sheet.width=576;sheet.height=288;
        const brush=sheet.getContext('2d'),h=earth.height/2;
        for(let col=0;col<2;col++)for(let row=0;row<2;row++){
          brush.save();brush.translate(col*576,row*288);brush.scale(col?-1:1,row?-1:1);
          brush.drawImage(earth,0,band*h,earth.width,h,0,0,288,144);brush.restore();
        }
        patterns[band]=c.createPattern(sheet,'repeat');
        if(band){brush.fillStyle='#171b33be';brush.fillRect(0,0,576,288);patterns[2]=c.createPattern(sheet,'repeat');}
      }
    };
    let dash=0,dashRest=0,dashDir=1;
    const chips=[];
    function scatter(x,y,color,count){
      for(let i=0;i<count;i++)chips.push({x,y,vx:(Math.random()-.5)*135,vy:-35-Math.random()*100,color,life:.25+Math.random()*.22});
    }
    let jumpBuffer=0,coyote=0;
    const c=u.ctx,TS=24,WW=1200,HH=72,span=WW/regions.length;
    const regionAt=x=>clamp(Math.floor(x/span),0,regions.length-1);
    const skyArt=new Image(),bossArt=new Image();skyArt.src=new URL('emberwild-regions.png',artBase).href;bossArt.src=new URL('emberwild-guardians.png',artBase).href;
    const surface=x=>12+Math.round(Math.sin(x*.12)*2+Math.sin(x*.047)*2+(x<220?0:Math.sin(x*.044+world.seed%83)*(2+regionAt(x))));
    const noise=(x,y)=>{const v=Math.sin(x*32.15+y*78.71+world.seed%65521)*43758.5453;return v-Math.floor(v);};
    const saved=readWorld(world.id),previous=saved?.map||decode(saved?.terrain);
    const map=Array.from({length:WW},(_,x)=>Array.from({length:HH},(_,y)=>{
      if(previous?.[x]&&y<previous[x].length)return previous[x][y];
      const top=surface(x);
      if(y<top)return null;
      if(y>top+5 && y<HH-2 && (Math.sin(x*.23+y*.38)+Math.cos(y*.52-x*.13)>.75))return null;
      if(y>top+3 && noise(x,y)>.91)return 'crystal';
      return y===top?'grass':y<top+4?'dirt':'stone';
    }));
    const sites=[
      {name:'Root Chapel',x:23,y:22,color:'#a2ead2',gift:'Root pick · stone breaks twice as fast'},
      {name:'Amber Cistern',x:63,y:32,color:'#ffc572',gift:'Amber blade · longer reach and double damage'},
      {name:'Violet Observatory',x:109,y:43,color:'#daaaff',gift:'Star boots · jump again in midair'}
    ];
    const journal=Object.assign({bells:[],cleared:false,survey:{}},saved?.journal);
    if(!previous){
      for(const site of sites){
        for(let i=-5;i<=5;i++)for(let j=-4;j<=1;j++){
          if(Math.abs(i)===5&&j===-4)continue;
          map[site.x+i][site.y+j]=j===1?'stone':null;
        }
        // The first bell can be reached by following the abandoned rope shaft.
        if(site===sites[0])for(let y=surface(site.x-3);y<=site.y;y++)map[site.x-3][y]='rope';
      }
    }
    const vaults=regions.slice(1).map((r,i)=>({name:['Willow Pump House','Ochre Kiln','Aurora Archive','Fallen Observatory'][i],
      x:(i+1)*span+56+(world.seed%17),y:25+i*7,region:i+1}));
    for(const v of vaults){
      if(previous&&v.x<previous.length)continue;
      for(let dx=-5;dx<=5;dx++)for(let dy=-3;dy<=1;dy++)map[v.x+dx][v.y+dy]=dy===1?'stone':null;
      for(let y=surface(v.x-3);y<=v.y;y++)map[v.x-3][y]='rope';
    }
    const metals=[
      {id:'copper',name:'Copper',color:'#f6a16a',required:0},
      {id:'mooniron',name:'Mooniron',color:'#89e4f3',required:1},
      {id:'starstone',name:'Starstone',color:'#dba6ff',required:2}
    ];
    const metalById=Object.fromEntries(metals.map(m=>[m.id,m]));
    const gear=Object.assign({pick:0,blade:0,quarry:false},saved?.gear);
    if(!saved?.oreVersion||previous?.length!==WW){
      // Seed veins once. Preserve excavated air, fixtures, constructed walls and the chamber floors.
      for(let x=2;x<WW-2;x++)for(let y=surface(x)+4;y<HH-2;y++){
        const key=x+','+y;
        if(saved?.oreVersion&&previous?.[x]&&y<previous[x].length)continue;
        if(map[x][y]!=='stone'||saved?.walls?.[key]||sites.some(site=>Math.abs(x-site.x)<=5&&Math.abs(y-site.y)<=4))continue;
        if(Math.sin(x*.81+y*.46)+Math.cos(x*.39-y*.85)>1.44){
          map[x][y]=metals[y>=40?2:y>=29?1:0].id;
        }
      }
    }
    const toolName=(kind,tier)=>[tier?metals[tier-1].name:'Trail',kind==='pick'?'pick':'blade'].join(' ');
    let spawn=saved?.spawn || {x:5*TS,y:surface(5)*TS-34};
    const p={x:spawn.x,y:spawn.y,vx:0,vy:0,on:false,health:rules.hearts,ores:saved?.ores || 0,reach:5};
    const bag=saved?.bag || {dirt:0,stone:0,rope:4,crystal:0};
    const walls=saved?.walls||{}, lights=saved?.lights||{};
    const fixtures=saved?.fixtures||{},grove=saved?.grove||{};
    if(!saved?.cottageKit){
      for(const [id,n] of Object.entries({wood:18,fiber:14,stone:18,dirt:18,crystal:4}))bag[id]=(bag[id]||0)+n;
    }
    const occupied=new Map();
    function footprint(id,x,y,visit){
      const {w,h}=cottageRecipes[id];
      for(let i=x;i<x+w;i++)for(let j=y-h+1;j<=y;j++)visit(i,j);
    }
    function indexFixture(key,id,add){
      const [x,y]=key.split(',').map(Number);
      footprint(id,x,y,(i,j)=>{if(add)occupied.set(i+','+j,key);else occupied.delete(i+','+j);});
    }
    for(const [key,id] of Object.entries(fixtures))indexFixture(key,id,true);
    bag.wall??=0;bag.torch??=0;
    if(saved?.traveler&&Number.isFinite(saved.traveler.x)&&Number.isFinite(saved.traveler.y)){
      Object.assign(p,{x:saved.traveler.x,y:saved.traveler.y,health:clamp(saved.traveler.health||rules.hearts,1,rules.hearts)});
    }
    const expedition=Object.assign({pack:0,cache:{},arms:[],equipped:'',relics:[],vaults:[],kills:{},visited:[0]},saved?.expedition);
    const landForTile=x=>regions[regionAt(x)];
    const region=()=>regionAt((p.x+9)/TS);
    const allHunts=[quarry,...regions];
    const hasRelic=token=>expedition.relics.includes(token);
    const supply=r=>({[r.material]:3,crystal:1});
    const canPay=cost=>Object.entries(cost).every(([id,n])=>(bag[id]||0)>=n);
    function pay(cost){for(const [id,n] of Object.entries(cost))bag[id]-=n;}
    const packSize=()=>18+expedition.pack*10;
    const stacks=()=>Object.keys(bag).filter(id=>bag[id]>0);
    function sortPack(){
      for(const id of stacks().slice(packSize())){expedition.cache[id]=(expedition.cache[id]||0)+bag[id];bag[id]=0;}
    }
    const shots=[];let abilityDelay=0;
    let guardian=saved?.encounter||null,airJump=true;
    if(guardian)guardian.hunt=allHunts.find(h=>h.token===guardian.hunt.token);
    const hasBell=site=>journal.bells.includes(site.name);
    const altar={x:8*TS+12,y:surface(8)*TS-18};
    function challenge(kind){
      if(guardian){u.help.textContent='A guardian is already awake. Enter recalls you and ends this attempt.';return;}
      if(Math.hypot(p.x+9-altar.x,p.y+17-altar.y)>=75){u.help.textContent='Return to the Copperfall altar, eight blocks east of the world edge.';return;}
      if(kind==='quarry'&&!gear.blade){u.help.textContent='Forge a copper blade to wake the Quarry King.';return;}
      if(kind==='glass'&&journal.bells.length!==3){u.help.textContent='Ring all three expedition bells to wake the Glasswing.';return;}
      const quarry=kind==='quarry',hunt=quarry?allHunts[0]:regions[0],hp=Math.ceil((quarry?18:12)*rules.power);
      if(!bag[hunt.token]){u.help.textContent='Craft a '+pretty(hunt.token)+' in Inventory & expedition gear to summon '+hunt.boss+'.';return;}
      bag[hunt.token]--;dirty=true;
      guardian={hunt,kind,name:quarry?'QUARRY KING':'GLASSWING',x:altar.x+100,y:altar.y-50,hp,max:hp,phase:quarry?'brace':'circle',age:0,vx:0,vy:0,stones:[]};
      persist();
      u.help.textContent=quarry?'The Quarry King crouches before leaping. Jump the stone waves when it lands.':'Glasswing awake. Dodge the gold flash and strike while it rests.';
    }
    function interact(){
      const vault=vaults.find(v=>Math.hypot(p.x+9-(v.x+.5)*TS,p.y+17-(v.y+.5)*TS)<55);
      if(vault&&!expedition.vaults.includes(vault.name)){
        const r=regions[vault.region];expedition.vaults.push(vault.name);bag[r.material]=(bag[r.material]||0)+6;bag.crystal=(bag.crystal||0)+3;
        changed();u.help.textContent=vault.name+' surveyed. Recovered 6 '+r.material+' and 3 crystals.';return;
      }
      const site=sites.find(site=>!hasBell(site)&&Math.hypot(p.x+9-(site.x+.5)*TS,p.y+17-(site.y+.5)*TS)<60);
      if(site){
        if(sentries.some(w=>w.site===site&&w.hp)){u.help.textContent='A cave moth guards this bell. Select Blade (2), face it and hold F.';return;}
        journal.bells.push(site.name);p.health=rules.hearts;dirty=true;persist();
        u.help.textContent=site.name+' rings. '+site.gift+'.';return;
      }
      if(Math.hypot(p.x+9-altar.x,p.y+17-altar.y)<75&&journal.bells.length===3&&!journal.cleared){
        challenge('glass');return;
      }
      u.help.textContent=journal.cleared?'The three bells are singing again. Copperfall is yours to explore.':'Follow the survey to a bell and press E beside it.';
    }
    let dig=0,digTile='',facing=1,swing=0;
    let atlas=false,lastSurvey='';
    function toggleAtlas(){
      atlas=!atlas;
      el.querySelector('[data-atlas]').setAttribute('aria-pressed',String(atlas));
      u.pointer.down=false;
    }
    u.button('[data-atlas]',toggleAtlas);
    function drawAtlas(){
      const ox=40,oy=170,scale=880/WW,sy=2.65;
      rr(c,18,85,924,342,16,'#151e2a');
      label(c,'COPPERFALL SURVEY',ox,123,21,'#ffe2ab');
      label(c,'Explored ground · gold marks your beacon · white marks your position · M to close',ox,148,13,'#d0d8dc');
      regions.forEach((r,i)=>{label(c,r.name,ox+i*176,402,12,r.color);c.fillStyle=r.color;c.fillRect(ox+i*176,379,172,2);});
      for(const k of Object.keys(journal.survey)){
        const [cx,cy]=k.split(',').map(Number);
        for(let x=cx*8;x<Math.min(WW,(cx+1)*8);x++)for(let y=cy*8;y<Math.min(HH,(cy+1)*8);y++){
          const tile=map[x][y];
          c.fillStyle=tile==='crystal'?'#c3a8e6':tile==='grass'?'#83b279':tile==='rope'?'#d3a673':
            tile?'#746c76':y<surface(x)?'#507384':'#303c4c';
          c.fillRect(ox+x*scale,oy+y*sy,Math.max(1,scale),sy);
        }
      }
      for(const site of sites){
        c.strokeStyle=site.color;c.lineWidth=2;c.strokeRect(ox+site.x*scale-3,oy+site.y*sy-3,9,9);
        if(hasBell(site)){c.fillStyle=site.color;c.fillRect(ox+site.x*scale,oy+site.y*sy,4,4);}
      }
      c.fillStyle='#ffcb7b';c.fillRect(ox+spawn.x/TS*scale-2,oy+spawn.y/TS*sy-4,5,9);
      c.fillStyle='#fff';c.beginPath();c.arc(ox+(p.x+9)/TS*scale,oy+(p.y+17)/TS*sy,3.5,0,Math.PI*2);c.fill();
    }
    const sentries=sites.slice(1).map((site,i)=>({site,x:(site.x+.5)*TS,y:site.y*TS-12,hp:hasBell(site)?0:i+2,hit:0}));
    let cam=0,camY=0,sel='mine',t=0,immunity=0,dirty=false,sinceSave=0;
    let slimes=Array.from({length:53},(_,i)=>({x:(12+i*22)*TS,y:(surface(12+i*22))*TS,vx:0,vy:0,wait:.6+i*.13,d:1,hp:1}));
    let packed=null,mapChanged=true;
    function persist(force=false){
      if(!dirty&&!force)return true;
      sortPack();
      if(mapChanged){packed=encode(map);mapChanged=false;}
      const ok=write(world.id,{terrain:packed,encounter:guardian,expedition,spawn,bag,walls,lights,fixtures,grove,cottageKit:true,oreVersion:1,gear,journal,traveler:{x:p.x,y:p.y,health:p.health},ores:p.ores});
      if(ok)dirty=false;else u.help.textContent='Storage is full or unavailable. Your world is still open; saving did not finish.';
      return ok;
    }
    const workshop=el.querySelector('[data-cottage]'),category=workshop.querySelector('[data-category]'),
      blueprint=workshop.querySelector('[data-blueprint]'),batch=workshop.querySelector('[data-batch]');
    const recipes=Object.values(cottageRecipes);
    for(const name of new Set(recipes.map(r=>r.group)))category.add(new Option(name,name));
    function loadRecipes(){
      blueprint.replaceChildren();
      for(const r of recipes.filter(r=>r.group===category.value))blueprint.add(new Option(r.name,r.id));
    }
    loadRecipes();
    const nearbyStation=id=>!id||Object.entries(fixtures).some(([cell,item])=>{
      if(item!==id)return false;const [x,y]=cell.split(',').map(Number);return Math.hypot(x+1-(p.x+9)/TS,y-(p.y+17)/TS)<7;
    });
    const smith=el.querySelector('[data-smith]');
    const catalystReady=tier=>tier<1||(tier===1?gear.quarry:journal.cleared);
    const costFor=kind=>kind==='pick'?4:5;
    function refreshForge(){
      for(const kind of ['pick','blade']){
        const tier=gear[kind],m=metals[tier],button=smith.querySelector('[data-forge="'+kind+'"]');
        button.textContent=m?'Forge '+toolName(kind,tier+1)+' · '+costFor(kind)+' '+m.id:toolName(kind,tier)+' equipped';
        button.disabled=!m||!nearbyStation('hearth')||!catalystReady(tier)||(bag[m.id]||0)<costFor(kind);
      }
      smith.querySelector('[data-metals]').textContent=metals.map(m=>m.name+' '+(bag[m.id]||0)).join(' · ')+(nearbyStation('hearth')?' · Hearth ready':' · Hearth needed within 7 blocks');
      smith.querySelector('[data-hunts]').textContent='Copperfall altar (column 8) · Quarry King '+(gear.quarry?'defeated':'requires a copper blade')+' · Glasswing '+(journal.cleared?'defeated':journal.bells.length+'/3 bells')+'. Quarry heart unlocks mooniron forging. Glasswing prism unlocks starstone forging.';
    }
    smith.ontoggle=refreshForge;
    smith.onclick=e=>{
      const kind=e.target.closest('[data-forge]')?.dataset.forge,hunt=e.target.closest('[data-hunt]')?.dataset.hunt;
      if(hunt)challenge(hunt);
      if(kind){
        const tier=gear[kind],m=metals[tier],cost=costFor(kind);
        if(!m||!nearbyStation('hearth')||!catalystReady(tier)||(bag[m.id]||0)<cost)return;
        bag[m.id]-=cost;gear[kind]++;dirty=true;persist();syncBag();
        u.help.textContent=toolName(kind,tier+1)+' forged and equipped.';
      }
    };
    const canMake=(r,n)=>nearbyStation(r.station)&&Object.entries(r.cost).every(([id,amount])=>(bag[id]||0)>=amount*n);
    function syncWorkshop(){
      if(!workshop.open)return;
      const r=cottageRecipes[blueprint.value],n=Number(batch.value);
      const ingredients=Object.entries(r.cost).map(([id,amount])=>amount*n+' '+id+' ('+(bag[id]||0)+' held)').join(' + ');
      workshop.querySelector('[data-formula]').textContent=r.yieldCount*n+' × '+r.name+' from '+ingredients+
        (r.station?' · '+cottageRecipes[r.station].name+(nearbyStation(r.station)?' nearby':' needed within 7 blocks'):' · hand crafted');
      workshop.querySelector('[data-supplies]').textContent=['wood','fiber','stone','dirt','crystal','board','brick','cloth','glass'].map(id=>id+' '+(bag[id]||0)).join(' · ');
      workshop.querySelector('[data-make]').disabled=!canMake(r,n);
      const equip=workshop.querySelector('[data-equip]');equip.disabled=!r.layer||!bag[r.id];equip.textContent='Build ('+(bag[r.id]||0)+' held)';
    }
    category.onchange=()=>{loadRecipes();syncWorkshop();};blueprint.onchange=batch.onchange=syncWorkshop;
    workshop.ontoggle=syncWorkshop;
    function makeRecipe(){
      const r=cottageRecipes[blueprint.value],n=Number(batch.value);if(!canMake(r,n))return;
      for(const [id,amount] of Object.entries(r.cost))bag[id]-=amount*n;
      bag[r.id]=(bag[r.id]||0)+r.yieldCount*n;if(r.layer)sel=r.id;dirty=true;
      u.help.textContent='Crafted '+r.yieldCount*n+' × '+r.name+(r.layer?' · equipped for building.':'.');
    }
    function gather(){
      for(let x=0;x<WW;x+=6){
        if(map[x][surface(x)]!=='grass'||Math.hypot(x*TS+12-p.x-9,surface(x)*TS-p.y-30)>3*TS||(grove[x]||0)>Date.now())continue;
        bag.wood=(bag.wood||0)+6;bag.fiber=(bag.fiber||0)+4;grove[x]=Date.now()+45000;dirty=true;
        u.help.textContent='Gathered 6 wood and 4 fiber. This beech replenishes in 45 seconds.';return;
      }
      u.help.textContent='Walk to another beech or let its branches replenish.';
    }
    const field=el.querySelector('[data-pack]'),find=id=>el.querySelector('[data-'+id+']');
    const choice=id=>find(id).value;
    find('current').textContent=world.name+' · '+world.mode+' · autosave enabled';
    for(const w of book.worlds)find('slots').add(new Option(w.name+' · '+w.mode,w.id));
    find('slots').value=world.id;
    find('save').onclick=()=>{if(persist(true))u.help.textContent='Saved '+world.name+'.';};
    function transfer(next){if(persist(true)&&!changeWorld(next))u.help.textContent='Could not save the world list.';}
    find('load').onclick=()=>{const next=book.worlds.find(w=>w.id===choice('slots'));if(next&&next.id!==world.id)transfer(next);};
    find('create').onclick=()=>{
      const name=choice('name').trim();if(!name){u.help.textContent='Give the new world a name.';return;}
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      transfer({id:'ember_'+crypto.randomUUID(),name,mode:choice('mode'),seed});
    };
    weapons.forEach(w=>find('weapon').add(new Option(w.name,w.id)));
    allHunts.forEach(h=>find('quarry').add(new Option(h.boss,h.token)));
    const landmarks=document.createElement('select');landmarks.setAttribute('aria-label','Discovered waystones');
    const travel=document.createElement('button');travel.className='ib';travel.textContent='Travel to waystone';field.append(landmarks,travel);
    const nearBeacon=()=>Math.hypot(p.x-spawn.x,p.y-spawn.y)<105;
    const selectedHunt=()=>allHunts.find(h=>h.token===choice('quarry'));
    const selectedArm=()=>weapons.find(w=>w.id===choice('weapon'));
    const costText=cost=>Object.entries(cost).map(([k,n])=>n+' '+pretty(k)).join(' + ');
    const packCost=()=>({fiber:4+expedition.pack*2,wood:3+expedition.pack*2});
    function refreshPack(){
      if(!field.open)return;
      const present=stacks(),stored=Object.keys(expedition.cache).filter(k=>expedition.cache[k]>0);
      find('packinfo').textContent=present.length+'/'+packSize()+' stack slots. Overflow goes to your beacon chest.';
      find('items').textContent=present.map(k=>pretty(k)+' ×'+bag[k]).join(' · ');
      const stack=find('stack'),options=[...present.map(k=>'Pack/'+k),...stored.map(k=>'Chest/'+k)];
      if(stack.dataset.keys!==options.join('|')){
        const old=stack.value;stack.replaceChildren(...options.map(k=>new Option(k.replace('/',' · '),k)));if(options.includes(old))stack.value=old;stack.dataset.keys=options.join('|');
      }
      find('store').disabled=!nearBeacon()||!stack.value;
      find('expand').textContent='Sew 10 slots · '+costText(packCost());find('expand').disabled=!canPay(packCost());
      const w=selectedArm(),owned=expedition.arms.includes(w.id);
      find('arm').textContent=owned?(expedition.equipped===w.id?'Equipped':'Equip'):'Craft · '+costText(w.cost);
      find('arm').disabled=owned?expedition.equipped===w.id:!canPay(w.cost);
      find('ability').textContent=w.move+' · R fires toward the cursor; F swings your blade.';
      const h=selectedHunt();find('lure').textContent='Craft '+pretty(h.token)+' · '+costText(supply(h));find('lure').disabled=!canPay(supply(h));
      find('call').textContent='Summon ('+(bag[h.token]||0)+' held)';find('call').disabled=!bag[h.token]||!!guardian;
      find('trail').textContent=h.name+' · '+(h===quarry?'mine copper ore':'mine surface grass for '+h.material)+'. '+(h===quarry||h===regions[0]?'Summon at the Copperfall altar.':'Use the summon on the surface in this region.');
      if(regions.indexOf(h)>0)find('trail').textContent+=' Region begins at column '+regions.indexOf(h)*span+'.';
      const wins=expedition.kills[h.token]||0;
      find('drops').textContent='Victories '+wins+' · guaranteed rotating drops: '+h.loot.map((k,i)=>pretty(k)+(wins>i?' ✓':'')).join(', ')+'.';
      const charm=relicTable[h.token],ownedCharm=hasRelic(h.token);
      find('relic').textContent=(ownedCharm?'Equipped: ':'Combine both drops: ')+charm[0]+' · '+charm[1];find('relic').disabled=ownedCharm||!h.loot.every(id=>bag[id]>0);
      if(landmarks.length!==expedition.visited.length){
        landmarks.replaceChildren(...expedition.visited.map(i=>new Option(regions[i].name,String(i))));
      }
      travel.disabled=!!guardian;
    }
    field.ontoggle=refreshPack;find('weapon').onchange=find('quarry').onchange=refreshPack;
    function changed(){dirty=true;sortPack();persist();syncBag();}
    find('store').onclick=()=>{
      if(!nearBeacon())return;const [from,id]=choice('stack').split('/');
      const withdraw=from==='Chest',src=withdraw?expedition.cache:bag,dst=withdraw?bag:expedition.cache;
      if(!src[id]||(withdraw&&!bag[id]&&stacks().length>=packSize())){u.help.textContent='Free a pack slot first.';return;}
      dst[id]=(dst[id]||0)+src[id];src[id]=0;changed();
    };
    find('relic').onclick=()=>{
      const h=selectedHunt();
      if(hasRelic(h.token)||!h.loot.every(id=>bag[id]>0))return;
      for(const id of h.loot)bag[id]--;
      expedition.relics.push(h.token);changed();
    };
    find('expand').onclick=()=>{const cost=packCost();if(canPay(cost)){pay(cost);expedition.pack++;changed();}};
    find('arm').onclick=()=>{
      const w=selectedArm();if(!expedition.arms.includes(w.id)){if(!canPay(w.cost))return;pay(w.cost);expedition.arms.push(w.id);}
      expedition.equipped=w.id;u.help.textContent=w.name+' equipped. Aim and press R for '+w.move.toLowerCase()+'.';changed();
    };
    find('lure').onclick=()=>{const h=selectedHunt(),cost=supply(h);if(canPay(cost)){pay(cost);bag[h.token]=(bag[h.token]||0)+1;changed();}};
    find('call').onclick=()=>{
      const h=selectedHunt(),index=regions.indexOf(h);
      if(index<=0){challenge(index<0?'quarry':'glass');refreshPack();return;}
      if(guardian||!bag[h.token])return;
      if(region()!==index||p.y/TS>surface(Math.floor(p.x/TS))+1){u.help.textContent='Use this summon on the surface of '+h.name+'.';return;}
      const hp=Math.ceil((12+index*4)*rules.power);
      guardian={kind:'regional',index,hunt:h,name:h.boss.toUpperCase(),hp,max:hp,x:p.x+90,y:p.y-55,age:0,phase:'watch',stones:[],vx:0,vy:0};
      bag[h.token]--;changed();
    };
    travel.onclick=()=>{
      if(guardian)return;const i=Number(landmarks.value);if(!expedition.visited.includes(i))return;
      const x=i?i*span+5:5;let y=surface(x)*TS-34;while(y>0&&blocked(x*TS,y))y-=TS;
      p.x=x*TS;p.y=y;p.vx=p.vy=0;immunity=1.5;changed();
    };
    function finishHunt(g){
      const h=g.hunt,n=expedition.kills[h.token]||0,loot=h.loot[n%h.loot.length];
      expedition.kills[h.token]=n+1;bag[loot]=(bag[loot]||0)+1;
      if(g.kind==='quarry')gear.quarry=true;if(g.kind==='glass')journal.cleared=true;
      guardian=null;changed();api.submit(100+p.ores);
      u.help.textContent=h.boss+' defeated · recovered '+pretty(loot)+'.';
    }
    function weaponCast(){
      const w=weapons.find(w=>w.id===expedition.equipped);if(!w||abilityDelay>0)return;
      const x=p.x+9,y=p.y+17,aim=u.pointer.x||u.pointer.y?Math.atan2(u.pointer.y/zoom+camY-y,u.pointer.x/zoom+cam-x):facing<0?Math.PI:0;
      const angles=w.id==='reedbow'?[-.19,0,.19]:[0];
      for(const offset of angles){const a=aim+offset;shots.push({w,x,y,vx:Math.cos(a)*315,vy:Math.sin(a)*315,age:0,hit:new Set()});}
      abilityDelay=w.cool*(hasRelic('void_pearl')?.75:1);
    }
    function projectiles(dt){
      abilityDelay=Math.max(0,abilityDelay-dt);if(u.key('r'))weaponCast();
      for(let i=shots.length-1;i>=0;i--){
        const q=shots[i],id=q.w.id;q.age+=dt;
        if(id==='chakram'&&q.age>.48){const a=Math.atan2(p.y+17-q.y,p.x+9-q.x);q.vx=Math.cos(a)*350;q.vy=Math.sin(a)*350;}
        if(id!=='starbell'){q.x+=q.vx*dt;q.y+=q.vy*dt;}
        const radius=id==='starbell'?q.age*340:14;
        for(const target of [...slimes,...sentries,guardian]){
          if(!target||target.hp<=0||q.hit.has(target)||Math.hypot(target.x-q.x,target.y-q.y)>radius+13)continue;
          q.hit.add(target);target.hp=Math.max(0,target.hp-({reedbow:1,chakram:3,rimestaff:4,starbell:7}[id]));
          if(id==='rimestaff')target.chill=2;
          scatter(target.x,target.y,q.w.color,5);if(target===guardian&&!target.hp)finishHunt(target);
          if(id==='reedbow'||id==='rimestaff'){q.age=2;break;}
        }
        if(q.age>(id==='starbell'?.46:id==='chakram'?1.1:.95)||(id!=='starbell'&&solid(Math.floor(q.x/TS),Math.floor(q.y/TS))))shots.splice(i,1);
      }
    }
    function syncBag(){
      sortPack();refreshPack();syncWorkshop();if(smith.open)refreshForge();
      el.querySelectorAll('[data-item]').forEach(b=>{
        const id=b.dataset.item;b.textContent=id==='mine'?toolName('pick',gear.pick):id==='blade'?toolName('blade',gear.blade):id+' ×'+bag[id];b.classList.toggle('on',id===sel);
      });
    }
    el.querySelector('.mw-tools').addEventListener('click',e=>{
      const b=e.target.closest('[data-item]');if(b)sel=b.dataset.item;
      if(e.target.closest('[data-make]'))makeRecipe();
      if(e.target.closest('[data-equip]')&&bag[blueprint.value]&&cottageRecipes[blueprint.value].layer)sel=blueprint.value;
      if(e.target.closest('[data-gather]'))gather();
      if(e.target.closest('[data-use]'))interact();
      if(e.target.closest('[data-tonic]')){
        if(p.health<rules.hearts&&bag.crystal&&bag.dirt>=2){bag.crystal--;bag.dirt-=2;p.health=Math.min(rules.hearts,p.health+3);dirty=true;u.help.textContent='Clay tonic restored up to three hearts.';}
        else u.help.textContent='Brew while injured with a crystal and two dirt.';
      }
      if(e.target.closest('[data-wall]')&&bag.stone){bag.stone--;bag.wall+=4;sel='wall';dirty=true;}
      if(e.target.closest('[data-torch]')&&bag.crystal){bag.crystal--;bag.torch+=3;sel='torch';dirty=true;}
      if(e.target.closest('[data-rope]')){
        if(bag.dirt>=2){bag.dirt-=2;bag.rope+=4;sel='rope';dirty=true;}
        else u.help.textContent='Mine two dirt blocks for four lengths of root rope.';
      }
      if(e.target.closest('[data-beacon]')){
        if(bag.crystal>=2 && p.on){bag.crystal-=2;spawn={x:p.x,y:p.y};dirty=true;u.help.textContent='Beacon bound here. Enter returns you to it.';}
        else u.help.textContent='Stand on solid ground with two crystals to bind a beacon.';
      }
      syncBag();persist();
    });
    syncBag();
    const solid=(x,y)=>x<0||x>=WW||y>=HH||(y>=0 && !!map[x][y] && map[x][y]!=='rope');
    function canPlace(r,x,y){
      const key=x+','+y;
      if(x<0||y<0||x>=WW||y>=HH-1||map[x][y]||!bag[r.id])return false;
      const touches=!!walls[key]||[[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>map[x+dx]?.[y+dy]||walls[(x+dx)+','+(y+dy)]);
      if(!touches)return false;
      if(r.layer==='wall')return !walls[key];
      if(r.layer==='fixture'){
        let free=true;
        footprint(r.id,x,y,(i,j)=>{if(i>=WW||j<0||map[i]?.[j]||occupied.has(i+','+j))free=false;});
        return free;
      }
      const overlaps=q=>x*TS<q.x+18&&(x+1)*TS>q.x&&y*TS<q.y+34&&(y+1)*TS>q.y;
      return !occupied.has(key)&&!overlaps(p)&&!overlaps(spawn);
    }
    function drawFixture(r,x,y,opening=false){
      const xx=x*TS,yy=(y+1-r.h)*TS,w=r.w*TS,h=r.h*TS;
      if(!furnishingArt.naturalWidth){c.fillStyle='#9e7750';c.fillRect(xx+2,yy+2,w-4,h-4);return;}
      const [sx,sy,sw,sh]=crops[r.style],scale=Math.min(w/sw,h/sh);
      const dw=r.id==='door'?w*(opening?.26:1):sw*scale,dh=r.id==='door'?h:sh*scale;
      c.drawImage(furnishingArt,sx,sy,sw,sh,xx+(opening?1:(w-dw)/2),yy+h-dh,dw,dh);
    }
    function blocked(x,y){
      for(let i=Math.floor(x/TS);i<=Math.floor((x+17)/TS);i++)
        for(let j=Math.floor(y/TS);j<=Math.floor((y+33)/TS);j++)if(solid(i,j))return true;
      return false;
    }
    function step(dx,dy){
      const parts=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));
      for(let n=0;n<parts;n++){
        if(blocked(p.x+dx/parts,p.y+dy/parts))return false;
        p.x+=dx/parts;p.y+=dy/parts;
      }
      return true;
    }
    function respawn(){dirty=true;p.x=spawn.x;p.y=spawn.y;p.health=rules.hearts;p.vx=p.vy=0;dash=dashRest=0;immunity=1.5;guardian=null;shots.length=0;airJump=true;}
    u.loop(dt=>{
      if(u.tapped('i')){field.open=!field.open;refreshPack();}
      if(u.tapped('m'))toggleAtlas();
      if(atlas){drawAtlas();return;}
      const cx=Math.floor((p.x+9)/(8*TS)),cy=Math.floor((p.y+17)/(8*TS)),chunk=cx+','+cy;
      if(chunk!==lastSurvey){
        lastSurvey=chunk;
        for(let x=Math.max(0,cx-1);x<=Math.min(Math.floor((WW-1)/8),cx+1);x++)
          for(let y=Math.max(0,cy-1);y<=Math.min(Math.floor((HH-1)/8),cy+1);y++)journal.survey[x+','+y]=true;
        dirty=true;
      }
      const biome=region(),land=regions[biome];
      if(!expedition.visited.includes(biome)){expedition.visited.push(biome);dirty=true;u.help.textContent=land.name+' discovered. Its waystone is now available in your inventory.';}
      projectiles(dt);t+=dt;immunity=Math.max(0,immunity-dt);
      const desired=(Number(u.key('d','arrowright'))-Number(u.key('a','arrowleft')))*(hasRelic('reed_whistle')?246:205);
      const surfaceZone=p.y/TS<surface(Math.floor(p.x/TS))+1?biome:0;
      const traction=p.on?(surfaceZone===3?4.2:18):8;
      p.vx+=(desired*(surfaceZone===1&&p.on?.88:1)-p.vx)*(1-Math.exp(-traction*dt));
      jumpBuffer=(u.tapped(' ')||u.tapped('w')||u.tapped('arrowup')) ? .12:Math.max(0,jumpBuffer-dt);
      if(Math.abs(p.vx)>5)facing=Math.sign(p.vx);
      dashRest=Math.max(0,dashRest-dt);dash=Math.max(0,dash-dt);
      if(u.tapped('shift')&&!dashRest){dash=.15;dashRest=hasRelic('frost_chime')?.52:.8;dashDir=desired?Math.sign(desired):facing;immunity=Math.max(immunity,.15);scatter(p.x+9,p.y+30,'#d5b783',6);}
      if(dash)p.vx=dashDir*350;
      if(u.pointer.down&&sel==='mine')facing=u.pointer.x/zoom+cam>p.x+9?1:-1;
      for(let i=chips.length-1;i>=0;i--){const q=chips[i];q.life-=dt;if(q.life<=0){chips.splice(i,1);continue;}
        q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=310*dt;}
      if(u.tapped('e'))interact();
      swing=Math.max(0,swing-dt);
      for(let i=0;i<7;i++)if(u.tapped(String(i+1))){sel=['mine','blade','dirt','stone','rope','wall','torch'][i];syncBag();}
      if((u.key('f')||(sel==='blade'&&(u.pointer.down||u.pointer.tap)))&&!swing){
        if(!u.key('f'))facing=u.pointer.x/zoom+cam>=p.x+9?1:-1;
        swing=.33;
        const reach=(hasBell(sites[1])?95:65)+gear.blade*8+(hasRelic('glass_chime')?18:0),damage=(hasBell(sites[1])?2:1)+gear.blade+Number(hasRelic('sun_scarab'));
        for(const w of sentries){
          const dx=(w.x-p.x-9)*facing;
          if(w.hp&&dx>=-10&&dx<reach&&Math.abs(w.y-p.y-17)<42){w.hp=Math.max(0,w.hp-damage);w.hit=.3;scatter(w.x,w.y,'#ffc574',8);}
        }
        if(guardian&&Math.abs(guardian.y-p.y-17)<52&&(guardian.x-p.x-9)*facing>=-15&&(guardian.x-p.x-9)*facing<reach){
          scatter(guardian.x,guardian.y,'#c4fcff',9);guardian.hp-=damage;
          if(guardian.hp<=0)finishHunt(guardian);
        }
        for(const slime of slimes){
          const dx=(slime.x-p.x-9)*facing;
          if(dx>=-6&&dx<reach&&Math.abs(slime.y-p.y-27)<39){slime.hp=0;scatter(slime.x,slime.y-8,'#c8d37f',8);}
        }
      }
      step(p.vx*dt,0);
      p.on=blocked(p.x,p.y+1);
      const rope=map[Math.floor((p.x+9)/TS)]?.[Math.floor((p.y+17)/TS)]==='rope';
      if(rope)p.vy=(Number(u.key('s','arrowdown'))-Number(u.key('w','arrowup')))*130;
      else {
        coyote=p.on?.10:Math.max(0,coyote-dt);
        if(p.on)airJump=true;
        if(jumpBuffer && coyote){p.vy=-392;coyote=jumpBuffer=0;}
        else if(jumpBuffer&&airJump&&hasBell(sites[2])){airJump=false;jumpBuffer=0;p.vy=-350;}
        else{
          const gravity=surfaceZone===4?.69:1;
          p.vy=Math.min(560,p.vy+((p.vy<0&&!u.key(' ','w','arrowup'))?1550:890)*gravity*dt);
        }
      }
      if(!step(0,p.vy*dt))p.vy=0;
      cam=clamp(p.x-450/zoom,0,WW*TS-960/zoom);camY=clamp(p.y-245/zoom,0,HH*TS-540/zoom);
      for(const s of slimes){
        if(!s.hp||Math.abs(s.x-p.x)>900)continue;
        if(s.chill>0){s.chill-=dt;continue;}
        const grounded=solid(Math.floor(s.x/TS),Math.floor((s.y+1)/TS));
        if(grounded&&s.vy>=0){
          s.vy=s.vx=0;s.wait-=dt;
          if(s.wait<=0){
            const close=Math.abs(p.x+9-s.x)<165;
            if(close)s.d=Math.sign(p.x+9-s.x)||s.d;
            if(s.x<45||s.x>WW*TS-45)s.d=s.x<45?1:-1;
            s.vx=s.d*(close?126:65);s.vy=close?-238:-183;s.wait=close?.92:1.35;
          }
        }
        s.vy=Math.min(420,s.vy+620*dt);
        const nx=clamp(s.x+s.vx*dt,12,WW*TS-12),ny=s.y+s.vy*dt;
        if(!solid(Math.floor(nx/TS),Math.floor((s.y-7)/TS)))s.x=nx;
        if(s.vy>=0&&solid(Math.floor(s.x/TS),Math.floor(ny/TS))){
          s.y=Math.floor(ny/TS)*TS;s.vy=s.vx=0;
        }else s.y=ny;
        if(Math.abs(s.x-p.x-9)<21 && Math.abs(s.y-p.y-30)<18){
          if(p.vy>50 && p.y+24<s.y){s.hp=0;p.vy=-260;}
          else if(!immunity){p.health=Math.max(0,p.health-rules.hurt);immunity=1.25;}
        }
      }
      for(const w of sentries){
        if(!w.hp)continue;
        if(w.chill>0){w.chill-=dt;continue;}
        const cx=(w.site.x+.5)*TS,cy=w.site.y*TS-12;
        const nearby=Math.hypot(p.x+9-cx,p.y+17-cy)<110;
        const tx=nearby?p.x+9:cx+Math.cos(t*1.8)*52,ty=nearby?p.y+17:cy+Math.sin(t*3)*16;
        w.hit=Math.max(0,w.hit-dt);
        if(!w.hit){w.x+=(tx-w.x)*dt*1.6;w.y+=(ty-w.y)*dt*1.6;}
        if(nearby&&!immunity&&Math.hypot(w.x-p.x-9,w.y-p.y-17)<18){p.health=Math.max(0,p.health-rules.hurt);immunity=1.4;}
      }
      if(guardian){
        dirty=true;const g=guardian;
        const pace=g.chill>0 ? .48 : 1;g.chill=Math.max(0,(g.chill||0)-dt);const tick=dt*pace;g.age+=tick;
        if(g.kind==='regional'){
          const i=g.index,px=p.x+9,py=p.y+16;
          if(g.phase==='watch'){
            const tx=px+Math.cos(t*(i===1?2:.8))*95,ty=py-(i===2?14:60)+Math.sin(t*2)*17;
            g.x+=(tx-g.x)*tick*2;g.y+=(ty-g.y)*tick*2;
            if(g.age>1.15){g.phase='signal';g.age=0;}
          }else if(g.phase==='signal'&&g.age>.65){
            const aim=Math.atan2(py-g.y,px-g.x);
            if(i<=2){g.vx=Math.cos(aim)*(i===1?300:225);g.vy=i===2?0:Math.sin(aim)*300;}
            else{const count=i===3?3:8;for(let j=0;j<count;j++){const a=i===3?aim+(j-1)*.25:aim+j*Math.PI/4;
              g.stones.push({x:g.x,y:g.y,vx:Math.cos(a)*132,vy:Math.sin(a)*132,life:1.8});}}
            g.phase='attack';g.age=0;
          }else if(g.phase==='attack'){
            g.x+=g.vx*tick;g.y+=g.vy*tick;
            if(i===2)g.y+=(py-g.y)*Math.min(1,tick*2);
            if(i<=2&&!immunity&&Math.hypot(px-g.x,py-g.y)<28){p.health=Math.max(0,p.health-rules.hurt);immunity=1.2;}
            if(g.age>.65){g.phase='rest';g.age=0;g.vx=g.vy=0;}
          }else if(g.phase==='rest'&&g.age>.85){g.phase='watch';g.age=0;}
          for(const q of g.stones){q.x+=q.vx*tick;q.y+=q.vy*tick;q.life-=tick;
            if(!immunity&&Math.hypot(q.x-px,q.y-py)<17){p.health=Math.max(0,p.health-rules.hurt);immunity=1.2;q.life=0;}}
          g.stones=g.stones.filter(q=>q.life>0);
        }else if(g.kind==='quarry'){
          if(g.phase==='brace'&&g.age>.85){
            g.phase='leap';g.age=0;g.vy=-248;g.vx=clamp((p.x+9-g.x)*1.8,-190,190);
          }else if(g.phase==='leap'){
            g.vy+=610*tick;g.x=clamp(g.x+g.vx*tick,16,WW*TS-16);g.y+=g.vy*tick;
            if(!immunity&&Math.hypot(g.x-p.x-9,g.y-p.y-17)<26){p.health=Math.max(0,p.health-rules.hurt);immunity=1;}
            if(g.vy>0&&solid(Math.floor(g.x/TS),Math.floor((g.y+14)/TS))){
              g.y=Math.floor((g.y+14)/TS)*TS-14;g.phase='rest';g.age=0;
              for(const dir of [-1,1])g.stones.push({x:g.x,y:g.y+7,dir,life:1.1});
              scatter(g.x,g.y+12,'#ce9f71',14);
            }
          }else if(g.phase==='rest'&&g.age>1.15){g.phase='brace';g.age=0;}
          for(const q of g.stones){q.x+=q.dir*140*tick;q.life-=tick;
            if(!immunity&&Math.abs(q.x-p.x-9)<14&&Math.abs(q.y-p.y-25)<15){p.health=Math.max(0,p.health-rules.hurt);immunity=1;}}
          g.stones=g.stones.filter(q=>q.life>0);
        }else if(g.phase==='circle'){
          const tx=p.x+9+Math.cos(t*2)*98,ty=p.y-57+Math.sin(t*3)*18;
          g.x+=(tx-g.x)*Math.min(1,tick*3);g.y+=(ty-g.y)*Math.min(1,tick*3);
          if(g.age>1.6){g.phase='signal';g.age=0;}
        }else if(g.phase==='signal'&&g.age>.65){
          const dx=p.x+9-g.x,dy=p.y+17-g.y,length=Math.max(1,Math.hypot(dx,dy));
          g.vx=dx/length*290;g.vy=dy/length*290;g.phase='dive';g.age=0;
        }else if(g.phase==='dive'){
          g.x+=g.vx*tick;g.y+=g.vy*tick;
          if(!immunity&&Math.hypot(g.x-p.x-9,g.y-p.y-17)<30){p.health=Math.max(0,p.health-rules.hurt);immunity=1;}
          if(g.age>.51||solid(Math.floor(g.x/TS),Math.floor((g.y+12)/TS))){g.phase='rest';g.age=0;}
        }else if(g.phase==='rest'&&g.age>1.3){g.phase='circle';g.age=0;}
      }
      slimes=slimes.filter(s=>s.hp);
      if(p.health<=0||u.tapped('enter'))respawn();
      if(!u.pointer.down)dig=0;
      const build=cottageRecipes[sel];
      if(u.pointer.tap||(u.pointer.down&&(sel==='mine'||build&&build.layer!=='fixture'))){
        const x=Math.floor((u.pointer.x/zoom+cam)/TS),y=Math.floor((u.pointer.y/zoom+camY)/TS);
        const key=x+','+y,houseTarget=occupied.has(key)||cottageRecipes[walls[key]]||cottageRecipes[map[x]?.[y]];
        if(x>=0&&x<WW&&y>=0&&y<HH-1&&Math.hypot(x+.5-(p.x+9)/TS,y+.5-(p.y+17)/TS)<=(build||houseTarget?8:p.reach)){
          const tile=map[x][y],cell=x+','+y;
          if(digTile!==cell){digTile=cell;dig=0;}
          if(build&&canPlace(build,x,y)){
            if(build.layer==='wall')walls[cell]=sel;
            else if(build.layer==='fixture'){fixtures[cell]=sel;indexFixture(cell,sel,true);}
            else{map[x][y]=sel;mapChanged=true;}
            bag[sel]--;dirty=true;
          }else if(sel==='mine'&&occupied.has(cell)){
            if(u.pointer.tap){const anchor=occupied.get(cell),id=fixtures[anchor];indexFixture(anchor,id,false);delete fixtures[anchor];bag[id]=(bag[id]||0)+1;dirty=true;}
          }else if(sel==='mine' && tile){
            const ore=metalById[tile];
            if(ore&&gear.pick<ore.required){dig=0;u.help.textContent=ore.name+' seam · requires '+toolName('pick',ore.required)+'.';}
            else{
              const hardness=ore ? .7+ore.required*.22 : (tile==='stone'||tile==='crystal' ? .5 : .25);
              dig+=dt*(hasRelic('quarry_drum')?1.25:1)*(1+gear.pick*.4)*(hasBell(sites[0])?2:1)/hardness;
            }
            if(dig>=1){
            dig=0;
            if(tile==='grass'){bag[landForTile(x).material]=(bag[landForTile(x).material]||0)+1;}
            const item=tile==='grass'?'dirt':tile;bag[item]=(bag[item]||0)+1;
            map[x][y]=null;mapChanged=true;dirty=true;scatter((x+.5)*TS,(y+.5)*TS,item==='crystal'?'#e8beff':item==='stone'?'#adc0ca':'#dca772',12);
            if(item==='crystal'){p.ores++;api.submit(p.ores);}
            }
          }else if(sel==='mine'&&!tile&&(walls[cell]||lights[cell])){
            if(u.pointer.tap){if(lights[cell]){delete lights[cell];bag.torch++;}else{const id=walls[cell]===true?'wall':walls[cell];delete walls[cell];bag[id]=(bag[id]||0)+1;}}
            dirty=true;
          }else if(sel==='wall'||sel==='torch'){
            const layer=sel==='wall'?walls:lights;
            if(!tile&&!layer[cell]&&bag[sel]>0){layer[cell]=true;bag[sel]--;dirty=true;}
          }else if(!build&&sel!=='mine'&&sel!=='blade'&&!tile&&!occupied.has(cell)&&bag[sel]>0){
            const adjacent=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>map[x+dx]?.[y+dy]);
            const overlaps=(px,py)=>x*TS<px+18&&(x+1)*TS>px&&y*TS<py+34&&(y+1)*TS>py;
            if(adjacent&&(sel==='rope'||(!overlaps(p.x,p.y)&&!overlaps(spawn.x,spawn.y)))){
              map[x][y]=sel;mapChanged=true;bag[sel]--;dirty=true;
            }
          }
          syncBag();
        }
      }
      sinceSave+=dt;if(sinceSave>1){persist();syncWorkshop();refreshPack();if(smith.open)refreshForge();sinceSave=0;}
      const sky=c.createLinearGradient(0,0,0,540);
      sky.addColorStop(0,'#586c9d');sky.addColorStop(.5,'#e4ac9b');sky.addColorStop(1,'#8f899d');c.fillStyle=sky;c.fillRect(0,0,960,540);
      const sun=c.createRadialGradient(720,93,17,720,93,118);sun.addColorStop(0,'#fff0c4');sun.addColorStop(.3,'#f7d7a6aa');sun.addColorStop(1,'#fbe3bf00');c.fillStyle=sun;c.fillRect(595,0,250,225);
      c.fillStyle='#ffe9b9';c.beginPath();c.arc(720,93,22,0,7);c.fill();
      for(let layer=0;layer<3;layer++){
        c.fillStyle=['#9992a7','#797f96','#526f80'][layer];c.beginPath();c.moveTo(0,540);
        for(let sx=0;sx<=970;sx+=8){const n=sx+cam*(.12+layer*.13);c.lineTo(sx,172+layer*44+Math.sin(n/89+layer)*33+Math.cos(n/38)*11-camY*.13);}
        c.lineTo(960,540);c.fill();
        for(let j=-1;j<23;j++){const xx=j*49-(cam*(layer+1)*.09)%49,yy=196+layer*45+17*Math.cos(j*2.4)-camY*.12;
          c.fillRect(xx,yy-20,4,41);for(let k=0;k<3;k++){c.beginPath();c.moveTo(xx+2,yy-54+k*12);c.lineTo(xx-9-k*2,yy-25+k*12);c.lineTo(xx+14+k*2,yy-25+k*12);c.fill();}}
      }
      if(biome&&skyArt.naturalWidth){
        const w=skyArt.width/2,h=skyArt.height/2,i=biome-1;
        c.drawImage(skyArt,(i%2)*w,Math.floor(i/2)*h,w,h,-((p.x/TS)%span)*.25,-12,1030,550);
      }else if(backdrop.naturalWidth){
        c.save();c.imageSmoothingEnabled=false;
        c.drawImage(backdrop,-cam/(WW*TS-960)*225,-70-camY*.08,1185,570);c.restore();
        for(let leaf=0;leaf<24;leaf++){const xx=(leaf*89+t*(9+leaf%5)-cam*.45)%1010,yy=(leaf*71+t*(7+leaf%7)-camY*.32)%460;
          c.fillStyle=leaf%2?'#edb653aa':'#f9dd99aa';c.fillRect(xx+9*Math.sin(t+leaf),yy,3,2);}
      }
      c.save();c.scale(zoom,zoom);c.save();c.translate(-Math.floor(cam),-Math.floor(camY));
      const left=Math.floor(cam/TS),right=Math.min(WW,Math.ceil((cam+960/zoom)/TS));
      for(let x=Math.ceil((left-2)/6)*6;x<right+2;x+=6){
        if(x<0||x>=WW||regionAt(x)!==0||map[x][surface(x)]!=='grass')continue;
        const xx=x*TS+9,yy=surface(x)*TS,height=64+(x*23)%40;
        if(beech.naturalWidth){
          const h=height*1.42,w=h*beech.naturalWidth/beech.naturalHeight;
          c.save();c.translate(xx+4,yy+2);c.scale(x%12===0?-1:1,1);c.drawImage(beech,-w*.35,-h,w,h);c.restore();continue;
        }
        c.fillStyle='#574b48';c.fillRect(xx,yy-height,9,height);c.fillStyle='#947153';c.fillRect(xx+2,yy-height,3,height-2);
        for(let i=0;i<6;i++){const ox=(i*19)%43-22,oy=(i*13)%28;
          c.fillStyle=i%2?'#9d633e':'#ac7246';c.fillRect(xx+ox-12,yy-height-oy,30,21);
          c.fillStyle=i%2?'#e3a04e':'#c8904e';c.fillRect(xx+ox-9,yy-height-oy-3,23,7);}
      }
      for(let x=left;x<right;x++)for(let y=Math.max(0,Math.floor(camY/TS));y<Math.min(HH,Math.ceil((camY+540/zoom)/TS));y++){
        const tile=map[x][y],xx=x*TS,yy=y*TS,k=x+','+y,n=(x*97+y*31)%17;
        if(cottageRecipes[tile]?.layer==='block'){drawCottageTile(c,cottageRecipes[tile],x,y,TS,cottageArt);continue;}
        if(!tile||tile==='rope'){
          if(cottageRecipes[walls[k]])drawCottageTile(c,cottageRecipes[walls[k]],x,y,TS,cottageArt);
          else if(y>=surface(x)||walls[k]){c.fillStyle=walls[k]?'#605460':patterns[2]||'#303449';c.fillRect(xx,yy,TS+.7,TS+.7);if(walls[k]){c.fillStyle='#8d7480';c.fillRect(xx+(n%5),yy+12,15,2);}}
          if(!tile&&y>surface(x)+5&&map[x][y-1]&&n%4===0){
            c.fillStyle=y>37?'#bfa2dc':y>25?'#a5c591':'#8493ae';
            c.beginPath();c.moveTo(xx+2,yy);c.lineTo(xx+7,yy+7+n%6);c.lineTo(xx+10,yy);c.fill();
          }
          if(tile==='rope'){
            c.fillStyle='#604434';c.fillRect(xx+10,yy,4,TS+.6);c.strokeStyle='#dbaf79';c.lineWidth=1.3;
            c.beginPath();for(let j=0;j<24;j+=4){c.moveTo(xx+10,yy+j+3);c.lineTo(xx+14,yy+j);}c.stroke();
            if(y%2===0){c.strokeStyle='#c69965';c.lineWidth=2.5;c.beginPath();c.moveTo(xx+7,yy+11);c.lineTo(xx+17,yy+10);c.stroke();}
          }
        }else{
          const soil=tile==='dirt'||tile==='grass';
          c.fillStyle=patterns[soil?0:1]||(soil?'#76492c':'#515963');c.fillRect(xx,yy,TS+.7,TS+.7);
          const zone=regionAt(x);
          if(zone){c.fillStyle=(soil?['','#25473175','#da995783','#a4bfdcb8','#674d886b']:['','#21545055','#c988555c','#4e89af65','#74469862'])[zone];
            c.fillRect(xx,yy,TS+.7,TS+.7);}
          const openAbove=!solid(x,y-1);
          if(openAbove){
            c.fillStyle=soil?'#e5b27788':'#c6cacf88';c.fillRect(xx,yy,TS,2);
          }
          if(!solid(x-1,y)){c.fillStyle='#eed4a044';c.fillRect(xx,yy,2,TS);}
          if(!solid(x+1,y)){c.fillStyle='#1e182957';c.fillRect(xx+TS-3,yy,3,TS);}
          if(!solid(x,y+1)){c.fillStyle='#20192799';c.fillRect(xx,yy+TS-4,TS,4);}
          if(tile==='grass'&&openAbove&&regionAt(x)){
            c.fillStyle=landForTile(x).color;c.fillRect(xx,yy,TS+.5,4);
            c.fillStyle='#ffffff69';c.fillRect(xx+n,yy-2,3,5);
            if(x%4===0){
              const zone=regionAt(x);c.strokeStyle=landForTile(x).color;c.lineWidth=2;
              for(let j=0;j<3;j++){const gx=xx+5+j*5,tip=yy-6-(x+j*13)%14;
                c.beginPath();c.moveTo(gx,yy+1);c.lineTo(gx+j-1,tip);c.stroke();
                c.fillStyle=['','#f3d884','#e9804d','#effbff','#e8c6ff'][zone];c.beginPath();
                c.ellipse(gx+j-1,tip,zone===1?2:3,zone===2?3:5,.25*j,0,Math.PI*2);c.fill();}
            }
          }else if(tile==='grass'&&openAbove&&relics.naturalWidth){
            const slice=x%4;
            c.drawImage(relics,615+slice*163,285,163,211,xx,yy-13,TS,21);
          }else if(tile==='grass'&&openAbove){
            c.fillStyle='#414a26';c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+24,yy);c.lineTo(xx+24,yy+3);c.lineTo(xx+12,yy+6+n%4);c.lineTo(xx,yy+4);c.fill();
            for(let j=0;j<7;j++){
              const gx=xx+j*3.6,lean=Math.sin(x*4+j)*3;
              c.fillStyle=['#82914c','#9fa751','#ced07b','#768442'][(j+n)%4];c.beginPath();c.moveTo(gx-2,yy+2);c.lineTo(gx+lean,yy-3-(j+n)%6);c.lineTo(gx+3,yy+2);c.fill();
            }
          }
          if(metalById[tile]){
            c.fillStyle=metalById[tile].color;
            for(let i=0;i<4;i++){const gx=xx+4+i*5,gy=yy+5+((n+i*7)%14);
              c.beginPath();c.moveTo(gx-3,gy+2);c.lineTo(gx,gy-3);c.lineTo(gx+4,gy-2);c.lineTo(gx+2,gy+2);c.fill();
              c.fillStyle='#fff1d7';c.fillRect(gx,gy-2,2,1);c.fillStyle=metalById[tile].color;}
          }
          if((tile==='crystal'||tile==='ore')&&relics.naturalWidth){c.drawImage(relics,48,626,493,574,xx+2,yy+2,20,22);}
          else if(tile==='crystal'||tile==='ore'){
            for(let j=0;j<3;j++){
              const gx=xx+6+j*5,gy=yy+19-j%2*2,h=6+(n+j*3)%9;
              c.fillStyle='#855f9f';c.beginPath();c.moveTo(gx-3,gy);c.lineTo(gx-2,gy-h+3);c.lineTo(gx+2,gy-h);c.lineTo(gx+3,gy-1);c.fill();
              c.fillStyle='#eac5ff';c.beginPath();c.moveTo(gx,gy-1);c.lineTo(gx+2,gy-h);c.lineTo(gx+3,gy-2);c.fill();
            }
          }
        }
      }
      for(const site of sites){
        const x=(site.x+.5)*TS,y=(site.y+1)*TS;
        if(x<cam-64||x>cam+1024)continue;
        const active=hasBell(site);
        if(relics.naturalWidth)c.drawImage(relics,7,3,596,566,x-46,y-86,92,87);
        else{
        c.fillStyle='#38495a';c.fillRect(x-38,y-6,76,6);
        for(const side of [-1,1]){c.fillStyle='#73686c';c.fillRect(x+side*30-3,y-65,7,60);}
        c.fillStyle='#958881';c.fillRect(x-37,y-68,74,7);
        c.fillStyle=site.color;c.beginPath();c.moveTo(x-4,y-58);c.lineTo(x+5,y-58);c.lineTo(x+13,y-29);c.lineTo(x-13,y-29);c.fill();
        c.fillRect(x-2,y-28,4,5);}
        if(active){c.strokeStyle=site.color;c.beginPath();c.arc(x,y-40,20+4*Math.sin(t*3),0,Math.PI*2);c.stroke();}
      }
      for(const v of vaults){
        if(v.x+4<left||v.x-4>right)continue;
        const x=(v.x+.5)*TS,y=(v.y+1)*TS,col=regions[v.region].color;
        for(const dx of [-82,72]){c.fillStyle='#54453b';c.fillRect(x+dx,y-81,10,81);c.fillStyle=col;c.fillRect(x+dx+3,y-69,3,47);}
        c.fillStyle='#8d7659';c.fillRect(x-90,y-86,180,8);
        c.fillStyle='#5b3a2e';c.fillRect(x-17,y-18,34,18);
        c.fillStyle=col;c.fillRect(x-16,y-(expedition.vaults.includes(v.name)?25:20),32,5);c.fillRect(x-3,y-14,6,7);
      }
      for(const [cell,id] of Object.entries(fixtures)){
        const [x,y]=cell.split(',').map(Number),r=cottageRecipes[id];
        if(x+r.w<left||x>right)continue;
        drawFixture(r,x,y,id==='door'&&Math.abs(p.x+9-(x+.5)*TS)<22&&Math.abs(p.y+17-y*TS)<40);
        if(id==='lantern'||id==='hearth'){
          const sx=(x+r.w/2)*TS,sy=y*TS+6,g=c.createRadialGradient(sx,sy,1,sx,sy,46);
          g.addColorStop(0,'#ffbb595c');g.addColorStop(1,'#ffc47200');c.fillStyle=g;c.fillRect(sx-46,sy-46,92,92);
        }
      }
      if(build&&bag[sel]&&u.pointer.x+u.pointer.y>0){
        const x=Math.floor((u.pointer.x/zoom+cam)/TS),y=Math.floor((u.pointer.y/zoom+camY)/TS);
        const valid=Math.hypot(x+.5-(p.x+9)/TS,y+.5-(p.y+17)/TS)<=8&&canPlace(build,x,y);
        c.save();c.globalAlpha=.46;
        if(build.layer==='fixture')drawFixture(build,x,y);else drawCottageTile(c,build,x,y,TS,cottageArt);
        c.globalAlpha=.95;c.strokeStyle=valid?'#a9e2a3':'#ed9e85';c.lineWidth=1;
        c.strokeRect(x*TS,(y+1-(build.h||1))*TS,(build.w||1)*TS,(build.h||1)*TS);c.restore();
      }
      for(const w of sentries)if(w.hp){
        if(sprite(4,w.x,w.y+13,29,1,.87+.13*Math.sin(t*14)))continue;
        const flap=Math.sin(t*12)*7;c.fillStyle=w.hit?'#fff':w.site.color;
        for(const side of [-1,1]){c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x+side*17,w.y-9+flap);c.lineTo(w.x+side*9,w.y+6);c.fill();}
        c.fillStyle='#402746';c.fillRect(w.x-3,w.y-4,6,11);
      }
      if(relics.naturalWidth)c.drawImage(relics,7,3,596,566,altar.x-23,altar.y-24,46,43);
      for(let i=0;i<3;i++){
        c.fillStyle=hasBell(sites[i])?sites[i].color:'#9c7e53';
        c.beginPath();c.arc(altar.x-8+i*8,altar.y+14,2.1,0,Math.PI*2);c.fill();
      }
      if(guardian){
        const g=guardian,wing=12*Math.sin(t*9);
        if(g.phase==='signal'){c.strokeStyle='#ffd475';c.lineWidth=2;c.beginPath();c.arc(g.x,g.y,23+14*g.age,0,Math.PI*2);c.stroke();}
        if(g.kind==='regional'){
          const i=g.index-1,w=bossArt.width/2,h=bossArt.height/2;
          if(bossArt.naturalWidth)c.drawImage(bossArt,i%2*w,Math.floor(i/2)*h,w,h,g.x-46,g.y-40,92,80);
          else{c.fillStyle=land.color;c.fillRect(g.x-20,g.y-15,40,30);}
          for(const q of g.stones){c.fillStyle=regions[g.index].color;c.beginPath();c.arc(q.x,q.y,5,0,Math.PI*2);c.fill();}
        }else if(g.kind==='quarry'){
          const h=g.phase==='brace'?41:54;
          sprite(3,g.x,g.y+14,h,p.x>g.x?1:-1,1.12);
          c.fillStyle=g.phase==='brace'?'#ffcc7d':'#c48b66';
          for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(g.x+i*8-5,g.y+19-h);c.lineTo(g.x+i*8,g.y+4-h-Math.cos(i)*5);c.lineTo(g.x+i*8+5,g.y+19-h);c.fill();}
          for(const q of g.stones){c.fillStyle='#e3ad74';c.beginPath();c.moveTo(q.x-7,q.y+5);c.lineTo(q.x,q.y-8);c.lineTo(q.x+8,q.y+5);c.fill();}
        }else if(!sprite(5,g.x,g.y+30,68,1,.85+.15*Math.sin(t*9))){
        c.save();c.translate(g.x,g.y);
        for(const side of [-1,1]){c.save();c.scale(side,1);c.fillStyle=g.phase==='signal'?'#ffce70':'#a6dfdf';c.beginPath();c.moveTo(0,4);c.lineTo(39,-21+wing);c.lineTo(30,6+wing);c.lineTo(9,14);c.fill();c.restore();}
        c.fillStyle='#564c70';c.fillRect(-6,-10,12,26);c.fillStyle='#fff3ac';c.fillRect(-3,-7,6,5);c.restore();}
      }
      if(relics.naturalWidth)c.drawImage(relics,680,581,537,631,spawn.x-24,spawn.y-12,38,46);
      for(const slime of slimes){const sy=slime.y;
        const crouch=!slime.vy&&slime.wait<.25;
        if(sprite(3,slime.x,sy,crouch?23:31,slime.d,crouch?1.22:1))continue;
        c.fillStyle='#497d71';c.fillRect(slime.x-13,sy-9,26,10);c.fillStyle='#83cfa1';c.fillRect(slime.x-10,sy-15,20,11);
        c.fillStyle='#c3ecc0';c.fillRect(slime.x-7,sy-13,6,3);c.fillStyle='#334359';c.fillRect(slime.x+2,sy-9,3,3);}
      const halo=c.createRadialGradient(p.x+9,p.y+14,2,p.x+9,p.y+14,32);
      halo.addColorStop(0,'#ffd17877');halo.addColorStop(1,'#ffd17800');c.fillStyle=halo;c.fillRect(p.x-24,p.y-19,66,66);
      c.save();c.translate(Math.round(p.x+9),Math.round(p.y+15));c.scale(facing,1);
      const stride=Math.round(Math.sin(t*15)*(p.vx?3:0));
      if(immunity&&Math.floor(t*12)%2===0)c.globalAlpha=.62;
      const moving=Math.abs(p.vx)>12,pose=rope?2:!p.on&&Math.abs(p.vy)>15?2:moving&&Math.sin(t*16)>-.25?1:0;
      if(!sprite(pose,0,19+(moving&&p.on?Math.sin(t*17):0),pose===2?40:46)){
        c.fillStyle='#304254';c.fillRect(-7,7,5,10+stride);c.fillRect(2,7,5,10-stride);
        c.fillStyle='#527a88';c.fillRect(-8,-3,15,13);c.fillStyle='#a85441';c.fillRect(-9,-5,17,4);
        c.fillStyle='#edb995';c.fillRect(-6,-15,12,11);c.fillStyle='#503d42';c.fillRect(3,-11,2,2);
        c.fillStyle='#ac794d';c.fillRect(-8,-18,13,6);c.fillStyle='#ecc079';c.fillRect(-11,-14,22,3);
      }
      c.translate(5,0);
      if(expedition.equipped&&abilityDelay>0&&!swing){
        const id=expedition.equipped;c.strokeStyle=weapons.find(w=>w.id===id).color;c.lineWidth=2.6;
        c.beginPath();
        if(id==='reedbow'){c.moveTo(5,-18);c.quadraticCurveTo(25,-2,6,15);c.closePath();}
        else if(id==='chakram'){c.arc(10,-6,9,0,Math.PI*2);}
        else{c.moveTo(-2,10);c.lineTo(10,-18);c.moveTo(15,-20);c.arc(10,-20,id==='starbell'?7:4,0,Math.PI*2);}
        c.stroke();
      }else if(swing||sel==='blade'){
        const phase=1-swing/.33;
        if(swing){
          c.strokeStyle='#ffdd9399';c.lineWidth=3;c.beginPath();c.arc(0,0,34,-1.5,-1.5+phase*2.65);c.stroke();
          c.rotate(-.6+phase*2.65);
        }else c.rotate(.65);
        c.fillStyle='#eed7a0';c.fillRect(-4,-9,10,3);c.fillStyle=metals[gear.blade-1]?.color||'#cbdfe1';
        c.beginPath();c.moveTo(-1,-9);c.lineTo(1,-33);c.lineTo(4,-27);c.lineTo(3,-9);c.fill();
      }else if(sel==='mine'){
        c.rotate(dig?-.4+Math.sin(dig*Math.PI)*1.65:.64);
        c.fillStyle='#ad8155';c.fillRect(0,-17,3,22);c.fillStyle=metals[gear.pick-1]?.color||'#b8cddb';c.beginPath();c.moveTo(-8,-14);c.quadraticCurveTo(-4,-26,12,-16);c.lineTo(15,-10);c.quadraticCurveTo(6,-17,-8,-14);c.fill();
      }
      c.restore();
      for(const q of shots){
        c.strokeStyle=q.w.color;c.fillStyle=q.w.color;c.lineWidth=3;c.beginPath();
        if(q.w.id==='starbell'||q.w.id==='chakram'){c.arc(q.x,q.y,q.w.id==='starbell'?Math.max(1,q.age*340):8,0,Math.PI*2);c.stroke();}
        else{c.moveTo(q.x-q.vx*.05,q.y-q.vy*.05);c.lineTo(q.x,q.y);c.stroke();}
      }
      for(const q of chips){c.fillStyle=q.color;c.fillRect(q.x,q.y,2.7,2.1);}
      c.restore();
      const depth = Math.max(0, p.y/TS-surface(Math.floor(p.x/TS)));
      if(depth>1){
        const lamp=c.createRadialGradient(p.x-cam+9,p.y-camY+15,24,p.x-cam+9,p.y-camY+15,230);
        lamp.addColorStop(0,'rgba(14,12,32,0)');lamp.addColorStop(1,'rgba(14,12,32,'+Math.min(.72,depth*.075)+')');
        c.fillStyle=lamp;c.fillRect(0,0,960,540);
      }
      for(const k of Object.keys(lights)){const [x,y]=k.split(',').map(Number),sx=x*TS+12-cam,sy=y*TS+12-camY;if(sx< -60||sx>1020||sy< -60||sy>600)continue;
        const light=c.createRadialGradient(sx,sy,1,sx,sy,58);light.addColorStop(0,'#ffc888b0');light.addColorStop(1,'#ffba6400');c.fillStyle=light;c.fillRect(sx-58,sy-58,116,116);c.fillStyle='#ffe6a0';c.fillRect(sx-2,sy-4,4,7);}
      if(dig>0){const [x,y]=digTile.split(',').map(Number);c.fillStyle='#f5d39a';c.fillRect(x*TS-cam,y*TS-camY-3,TS*Math.min(1,dig),2);
        const sx=x*TS-cam,sy=y*TS-camY;c.strokeStyle='#312535';c.lineWidth=1.6;c.beginPath();c.moveTo(sx+3,sy+1);c.lineTo(sx+9,sy+6);c.lineTo(sx+8,sy+10);c.lineTo(sx+13,sy+12);if(dig>.4){c.lineTo(sx+10,sy+17);c.lineTo(sx+14,sy+23);c.moveTo(sx+13,sy+12);c.lineTo(sx+21,sy+7);}c.stroke();}
      c.restore();
      if(sel==='mine'&&u.pointer.x+u.pointer.y>0){
        const tx=Math.floor((u.pointer.x/zoom+cam)/TS),ty=Math.floor((u.pointer.y/zoom+camY)/TS);
        const ore=metalById[map[tx]?.[ty]];
        if(ore){
          const text=ore.name+' seam'+(gear.pick<ore.required?' · needs '+toolName('pick',ore.required):'');
          c.font='600 12px ui-monospace,Consolas,monospace';const width=c.measureText(text).width+18;
          const sx=clamp(u.pointer.x+12,4,956-width),sy=clamp(u.pointer.y-28,88,508);
          rr(c,sx,sy,width,23,5,'#171922eb');label(c,text,sx+9,sy+16,12,ore.color);
        }
      }
      const localVault=vaults.find(v=>v.region===biome&&!expedition.vaults.includes(v.name));
      const next=biome?localVault:sites.find(site=>!hasBell(site));
      const dx=(next?next.x:8)-Math.floor((p.x+9)/TS),dy=(next?next.y:surface(8)-1)-Math.floor((p.y+17)/TS);
      rr(c,627,18,315,66,12,'rgba(13,18,32,.86)');
      label(c,guardian?guardian.name+'  '+guardian.hp+'/'+guardian.max:biome?(localVault?localVault.name.toUpperCase():land.name.toUpperCase()):journal.cleared?'COPPERFALL RESTORED':(next?next.name:'Copperfall altar').toUpperCase(),643,45,15,'#ffe3ad');
      label(c,guardian?'F blade · R weapon · Shift dash':biome&&!localVault?'Vault surveyed · craft a local summon':!biome&&journal.cleared?'Three bells recovered · free exploration':Math.abs(dx)+(dx<0?' west':' east')+' · '+Math.abs(dy)+(dy<0?' up':' down')+(biome?' · E to search':' · E to ring'),643,69,12,'#d9dad0');
      if(expedition.equipped){
        const w=weapons.find(w=>w.id===expedition.equipped);
        rr(c,18,89,206,25,8,'#101723d9');label(c,'R · '+w.name+(abilityDelay>0?' · '+abilityDelay.toFixed(1)+'s':' · ready'),28,106,12,w.color);
      }
      rr(c,18,18,206,68,13,'rgba(13,18,32,.8)');label(c,'HEARTS '+'♥'.repeat(p.health)+'♡'.repeat(rules.hearts-p.health),32,46,14,'#ff9d9d');label(c,build?'BUILD · '+(bag[sel]||0)+' HELD':'CRYSTALS '+p.ores+' · '+sel.toUpperCase(),32,70,12,'#dec2ff');u.status.textContent=land.name+' · '+world.mode+' · '+(build?build.name+' · ':'')+'Depth '+Math.max(0,Math.floor(p.y/TS)-surface(Math.floor(p.x/TS)))+' · '+bag.crystal+' crystals in pack · '+p.health+' hearts';
    });const flush=()=>persist(true);window.addEventListener('pagehide',flush);
    return ()=>{window.removeEventListener('pagehide',flush);u.stop(flush);};
  }
})();
