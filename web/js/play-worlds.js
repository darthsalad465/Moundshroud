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
    const keydown = e => { if (A.cur !== 'play') return; const key = e.key.toLowerCase(); if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault(); if (!e.repeat && !pressed.has(key)) taps.add(key); pressed.add(key); };
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

  // Emberwild: a compact side-scrolling exploration and building adventure.
  P.games.emberwild = { name:'Emberwild', icon:'⛏️', desc:'Recover three buried bells, earn their gifts and confront the Glasswing at Copperfall.', mount(el,api) {
    const tools = ['mine','blade','dirt','stone','rope','wall','torch'].map((name,i)=>'<button class="ib'+(i?'':' on')+'" data-item="'+name+'">'+name+'</button>').join('')+
      '<button class="ib" data-rope>Weave 4 rope · 2 dirt</button><button class="ib" data-wall>Shape 4 walls · 1 stone</button><button class="ib" data-torch>Make 3 lights · 1 crystal</button><button class="ib" data-beacon>Bind beacon · 2 crystals</button><button class="ib" data-tonic>Brew & drink · 1 crystal + 2 dirt</button><button class="ib" data-use>Interact (E)</button><button class="ib" data-atlas>Survey map (M)</button>';
    const u=mount(el,api,'EMBERWILD · THE GLOW SEAM',
      'A/D run · Space jump · W/S climb rope · 1–7 select hotbar · hold click to dig · F quick strike · Shift dash · click to build. E rings a nearby bell. Follow the survey at top right. Enter recalls you to your beacon.',tools);
    const backdrop=new Image(),beech=new Image();
    beech.src=new URL('../data/emberwild-beech.png',document.querySelector('script[src*="play-worlds.js"]').src).href;
    backdrop.src=new URL('../data/emberwild-copperfall.png',document.querySelector('script[src*="play-worlds.js"]').src).href;
    const artBase=new URL('../data/',document.querySelector('script[src*="play-worlds.js"]').src);
    const cast=new Image(),earth=new Image(),relics=new Image();
    const zoom=1.42;
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
    const c=u.ctx,TS=24,WW=220,HH=58;
    const surface=x=>12+Math.round(Math.sin(x*.12)*2+Math.sin(x*.047)*2);
    const saved=readWorld('ember');
    let map=saved?.map || Array.from({length:WW},(_,x)=>Array.from({length:HH},(_,y)=>{
      const top=surface(x);
      if(y<top)return null;
      if(y>top+5 && y<HH-2 && (Math.sin(x*.23+y*.38)+Math.cos(y*.52-x*.13)>.75))return null;
      if(y>top+3 && rand()>.91)return 'crystal';
      return y===top?'grass':y<top+4?'dirt':'stone';
    }));
    const sites=[
      {name:'Root Chapel',x:23,y:22,color:'#a2ead2',gift:'Root pick · stone breaks twice as fast'},
      {name:'Amber Cistern',x:63,y:32,color:'#ffc572',gift:'Amber blade · longer reach and double damage'},
      {name:'Violet Observatory',x:109,y:43,color:'#daaaff',gift:'Star boots · jump again in midair'}
    ];
    const journal=Object.assign({bells:[],cleared:false,survey:{}},saved?.journal);
    if(!saved?.map){
      for(const site of sites){
        for(let i=-5;i<=5;i++)for(let j=-4;j<=1;j++){
          if(Math.abs(i)===5&&j===-4)continue;
          map[site.x+i][site.y+j]=j===1?'stone':null;
        }
        // The first bell can be reached by following the abandoned rope shaft.
        if(site===sites[0])for(let y=surface(site.x-3);y<=site.y;y++)map[site.x-3][y]='rope';
      }
    }
    let spawn=saved?.spawn || {x:5*TS,y:surface(5)*TS-34};
    const p={x:spawn.x,y:spawn.y,vx:0,vy:0,on:false,health:5,ores:saved?.ores || 0,reach:5};
    const bag=saved?.bag || {dirt:0,stone:0,rope:4,crystal:0};
    const walls=saved?.walls||{}, lights=saved?.lights||{};
    bag.wall??=0;bag.torch??=0;
    if(saved?.traveler&&Number.isFinite(saved.traveler.x)&&Number.isFinite(saved.traveler.y)){
      Object.assign(p,{x:saved.traveler.x,y:saved.traveler.y,health:clamp(saved.traveler.health||5,1,5)});
    }
    let guardian=null,airJump=true;
    const hasBell=site=>journal.bells.includes(site.name);
    const altar={x:8*TS+12,y:surface(8)*TS-18};
    function interact(){
      const site=sites.find(site=>!hasBell(site)&&Math.hypot(p.x+9-(site.x+.5)*TS,p.y+17-(site.y+.5)*TS)<60);
      if(site){
        if(sentries.some(w=>w.site===site&&w.hp)){u.help.textContent='A cave moth guards this bell. Select Blade (2), face it and hold F.';return;}
        journal.bells.push(site.name);p.health=5;dirty=true;persist();
        u.help.textContent=site.name+' rings. '+site.gift+'.';return;
      }
      if(Math.hypot(p.x+9-altar.x,p.y+17-altar.y)<75&&journal.bells.length===3&&!journal.cleared){
        if(!guardian){guardian={x:altar.x+135,y:altar.y-80,hp:12,phase:'circle',age:0,vx:0,vy:0};
          u.help.textContent='Glasswing awake. Dodge the gold flash, then strike while it rests.';}return;
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
      const ox=40,oy=170,scale=4;
      rr(c,18,85,924,342,16,'#151e2a');
      label(c,'COPPERFALL SURVEY',ox,123,21,'#ffe2ab');
      label(c,'Explored ground · gold marks your beacon · white marks your position · M to close',ox,148,13,'#d0d8dc');
      for(const k of Object.keys(journal.survey)){
        const [cx,cy]=k.split(',').map(Number);
        for(let x=cx*8;x<Math.min(WW,(cx+1)*8);x++)for(let y=cy*8;y<Math.min(HH,(cy+1)*8);y++){
          const tile=map[x][y];
          c.fillStyle=tile==='crystal'?'#c3a8e6':tile==='grass'?'#83b279':tile==='rope'?'#d3a673':
            tile?'#746c76':y<surface(x)?'#507384':'#303c4c';
          c.fillRect(ox+x*scale,oy+y*scale,scale,scale);
        }
      }
      for(const site of sites){
        c.strokeStyle=site.color;c.lineWidth=2;c.strokeRect(ox+site.x*scale-3,oy+site.y*scale-3,9,9);
        if(hasBell(site)){c.fillStyle=site.color;c.fillRect(ox+site.x*scale,oy+site.y*scale,4,4);}
      }
      c.fillStyle='#ffcb7b';c.fillRect(ox+spawn.x/TS*scale-2,oy+spawn.y/TS*scale-4,5,9);
      c.fillStyle='#fff';c.beginPath();c.arc(ox+(p.x+9)/TS*scale,oy+(p.y+17)/TS*scale,3.5,0,Math.PI*2);c.fill();
    }
    const sentries=sites.slice(1).map((site,i)=>({site,x:(site.x+.5)*TS,y:site.y*TS-12,hp:hasBell(site)?0:i+2,hit:0}));
    let cam=0,camY=0,sel='mine',t=0,immunity=0,dirty=false,sinceSave=0;
    let slimes=Array.from({length:8},(_,i)=>({x:(12+i*22)*TS,y:(surface(12+i*22))*TS,vx:0,vy:0,wait:.6+i*.13,d:1,hp:1}));
    const persist=()=>{if(dirty){saveWorld('ember',{map,spawn,bag,walls,lights,journal,traveler:{x:p.x,y:p.y,health:p.health},ores:p.ores});dirty=false;}};
    function syncBag(){
      el.querySelectorAll('[data-item]').forEach(b=>{
        const id=b.dataset.item;b.textContent=id==='mine'?'Pickaxe':id==='blade'?'Blade':id+' ×'+bag[id];b.classList.toggle('on',id===sel);
      });
    }
    el.querySelector('.mw-tools').addEventListener('click',e=>{
      const b=e.target.closest('[data-item]');if(b)sel=b.dataset.item;
      if(e.target.closest('[data-use]'))interact();
      if(e.target.closest('[data-tonic]')){
        if(p.health<5&&bag.crystal&&bag.dirt>=2){bag.crystal--;bag.dirt-=2;p.health=Math.min(5,p.health+3);dirty=true;u.help.textContent='Clay tonic restored up to three hearts.';}
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
    function respawn(){p.x=spawn.x;p.y=spawn.y;p.health=5;p.vx=p.vy=0;dash=dashRest=0;immunity=1.5;guardian=null;airJump=true;}
    u.loop(dt=>{
      if(u.tapped('m'))toggleAtlas();
      if(atlas){drawAtlas();return;}
      const cx=Math.floor((p.x+9)/(8*TS)),cy=Math.floor((p.y+17)/(8*TS)),chunk=cx+','+cy;
      if(chunk!==lastSurvey){
        lastSurvey=chunk;
        for(let x=Math.max(0,cx-1);x<=Math.min(Math.floor((WW-1)/8),cx+1);x++)
          for(let y=Math.max(0,cy-1);y<=Math.min(Math.floor((HH-1)/8),cy+1);y++)journal.survey[x+','+y]=true;
        dirty=true;
      }
      t+=dt;immunity=Math.max(0,immunity-dt);
      const desired=(Number(u.key('d','arrowright'))-Number(u.key('a','arrowleft')))*205;
      p.vx+=(desired-p.vx)*(1-Math.exp(-(p.on?18:8)*dt));
      jumpBuffer=(u.tapped(' ')||u.tapped('w')||u.tapped('arrowup')) ? .12:Math.max(0,jumpBuffer-dt);
      if(Math.abs(p.vx)>5)facing=Math.sign(p.vx);
      dashRest=Math.max(0,dashRest-dt);dash=Math.max(0,dash-dt);
      if(u.tapped('shift')&&!dashRest){dash=.15;dashRest=.8;dashDir=desired?Math.sign(desired):facing;immunity=Math.max(immunity,.15);scatter(p.x+9,p.y+30,'#d5b783',6);}
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
        const reach=hasBell(sites[1])?95:65;
        for(const w of sentries){
          const dx=(w.x-p.x-9)*facing;
          if(w.hp&&dx>=-10&&dx<reach&&Math.abs(w.y-p.y-17)<42){w.hp=Math.max(0,w.hp-(hasBell(sites[1])?2:1));w.hit=.3;scatter(w.x,w.y,'#ffc574',8);}
        }
        if(guardian&&Math.abs(guardian.y-p.y-17)<52&&(guardian.x-p.x-9)*facing>=-15&&(guardian.x-p.x-9)*facing<reach){
          scatter(guardian.x,guardian.y,'#c4fcff',9);guardian.hp-=hasBell(sites[1])?2:1;
          if(guardian.hp<=0){guardian=null;journal.cleared=true;dirty=true;persist();api.submit(100+p.ores);
            u.help.textContent='Copperfall restored. All three bells answer your blade. Your expedition is complete.';}
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
        else p.vy=Math.min(560,p.vy+((p.vy<0&&!u.key(' ','w','arrowup'))?1550:890)*dt);
      }
      if(!step(0,p.vy*dt))p.vy=0;
      cam=clamp(p.x-450/zoom,0,WW*TS-960/zoom);camY=clamp(p.y-245/zoom,0,HH*TS-540/zoom);
      for(const s of slimes){
        if(!s.hp)continue;
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
          else if(!immunity){p.health--;immunity=1.25;}
        }
      }
      for(const w of sentries){
        if(!w.hp)continue;
        const cx=(w.site.x+.5)*TS,cy=w.site.y*TS-12;
        const nearby=Math.hypot(p.x+9-cx,p.y+17-cy)<110;
        const tx=nearby?p.x+9:cx+Math.cos(t*1.8)*52,ty=nearby?p.y+17:cy+Math.sin(t*3)*16;
        w.hit=Math.max(0,w.hit-dt);
        if(!w.hit){w.x+=(tx-w.x)*dt*1.6;w.y+=(ty-w.y)*dt*1.6;}
        if(nearby&&!immunity&&Math.hypot(w.x-p.x-9,w.y-p.y-17)<18){p.health--;immunity=1.4;}
      }
      if(guardian){
        const g=guardian;g.age+=dt;
        if(g.phase==='circle'){
          const tx=p.x+9+Math.cos(t*2)*98,ty=p.y-57+Math.sin(t*3)*18;
          g.x+=(tx-g.x)*Math.min(1,dt*3);g.y+=(ty-g.y)*Math.min(1,dt*3);
          if(g.age>1.6){g.phase='signal';g.age=0;}
        }else if(g.phase==='signal'&&g.age>.65){
          const dx=p.x+9-g.x,dy=p.y+17-g.y,length=Math.max(1,Math.hypot(dx,dy));
          g.vx=dx/length*290;g.vy=dy/length*290;g.phase='dive';g.age=0;
        }else if(g.phase==='dive'){
          g.x+=g.vx*dt;g.y+=g.vy*dt;
          if(!immunity&&Math.hypot(g.x-p.x-9,g.y-p.y-17)<30){p.health--;immunity=1;}
          if(g.age>.51||solid(Math.floor(g.x/TS),Math.floor((g.y+12)/TS))){g.phase='rest';g.age=0;}
        }else if(g.phase==='rest'&&g.age>1.3){g.phase='circle';g.age=0;}
      }
      slimes=slimes.filter(s=>s.hp);
      if(p.health<=0||u.tapped('enter'))respawn();
      if(!u.pointer.down)dig=0;
      if(u.pointer.tap||(sel==='mine'&&u.pointer.down)){
        const x=Math.floor((u.pointer.x/zoom+cam)/TS),y=Math.floor((u.pointer.y/zoom+camY)/TS);
        if(x>=0&&x<WW&&y>=0&&y<HH-1&&Math.hypot(x-(p.x+9)/TS,y-(p.y+17)/TS)<=p.reach){
          const tile=map[x][y],cell=x+','+y;
          if(digTile!==cell){digTile=cell;dig=0;}
          if(sel==='mine' && tile){
            dig+=dt/(tile==='stone'||tile==='crystal'?(hasBell(sites[0])?.24:.50):.25);
            if(dig>=1){
            dig=0;
            const item=tile==='grass'?'dirt':tile;bag[item]=(bag[item]||0)+1;
            map[x][y]=null;dirty=true;scatter((x+.5)*TS,(y+.5)*TS,item==='crystal'?'#e8beff':item==='stone'?'#adc0ca':'#dca772',12);
            if(item==='crystal'){p.ores++;api.submit(p.ores);}
            }
          }else if(sel==='mine'&&!tile&&(walls[cell]||lights[cell])){
            if(lights[cell]){delete lights[cell];bag.torch++;}else{delete walls[cell];bag.wall++;}
            dirty=true;
          }else if(sel==='wall'||sel==='torch'){
            const layer=sel==='wall'?walls:lights;
            if(!tile&&!layer[cell]&&bag[sel]>0){layer[cell]=true;bag[sel]--;dirty=true;}
          }else if(sel!=='mine'&&sel!=='blade'&&!tile&&bag[sel]>0){
            const adjacent=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>map[x+dx]?.[y+dy]);
            const overlaps=(px,py)=>x*TS<px+18&&(x+1)*TS>px&&y*TS<py+34&&(y+1)*TS>py;
            if(adjacent&&(sel==='rope'||(!overlaps(p.x,p.y)&&!overlaps(spawn.x,spawn.y)))){
              map[x][y]=sel;bag[sel]--;dirty=true;
            }
          }
          syncBag();
        }
      }
      sinceSave+=dt;if(sinceSave>2){persist();sinceSave=0;}
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
      if(backdrop.naturalWidth){
        c.save();c.imageSmoothingEnabled=false;
        c.drawImage(backdrop,-cam/(WW*TS-960)*225,-70-camY*.08,1185,570);c.restore();
        for(let leaf=0;leaf<24;leaf++){const xx=(leaf*89+t*(9+leaf%5)-cam*.45)%1010,yy=(leaf*71+t*(7+leaf%7)-camY*.32)%460;
          c.fillStyle=leaf%2?'#edb653aa':'#f9dd99aa';c.fillRect(xx+9*Math.sin(t+leaf),yy,3,2);}
      }
      c.save();c.scale(zoom,zoom);c.save();c.translate(-Math.floor(cam),-Math.floor(camY));
      const left=Math.floor(cam/TS),right=Math.min(WW,Math.ceil((cam+960/zoom)/TS));
      for(let x=left;x<right;x++)for(let y=Math.max(0,Math.floor(camY/TS));y<Math.min(HH,Math.ceil((camY+540/zoom)/TS));y++){
        const tile=map[x][y],xx=x*TS,yy=y*TS,k=x+','+y,n=(x*97+y*31)%17;
        if(!tile||tile==='rope'){
          if(y>=surface(x)||walls[k]){c.fillStyle=walls[k]?'#605460':patterns[2]||'#303449';c.fillRect(xx,yy,TS,TS);if(walls[k]){c.fillStyle='#8d7480';c.fillRect(xx+(n%5),yy+12,15,2);}}
          if(!tile&&y>surface(x)+5&&map[x][y-1]&&n%4===0){
            c.fillStyle=y>37?'#bfa2dc':y>25?'#a5c591':'#8493ae';
            c.beginPath();c.moveTo(xx+2,yy);c.lineTo(xx+7,yy+7+n%6);c.lineTo(xx+10,yy);c.fill();
          }
          if(tile==='rope'){c.fillStyle='#cb9b69';c.fillRect(xx+10,yy,4,TS);c.fillRect(xx+7,yy+9,10,3);}
        }else{
          const soil=tile==='dirt'||tile==='grass';
          c.fillStyle=patterns[soil?0:1]||(soil?'#76492c':'#515963');c.fillRect(xx,yy,TS,TS);
          const openAbove=!solid(x,y-1);
          if(openAbove){
            c.fillStyle=soil?'#e5b27788':'#c6cacf88';c.fillRect(xx,yy,TS,2);
          }
          if(!solid(x-1,y)){c.fillStyle='#eed4a044';c.fillRect(xx,yy,2,TS);}
          if(!solid(x+1,y)){c.fillStyle='#1e182957';c.fillRect(xx+TS-3,yy,3,TS);}
          if(!solid(x,y+1)){c.fillStyle='#20192799';c.fillRect(xx,yy+TS-4,TS,4);}
          if(tile==='grass'&&openAbove&&relics.naturalWidth){
            const slice=x%4;
            c.drawImage(relics,615+slice*163,285,163,211,xx,yy-13,TS,21);
          }else if(tile==='grass'&&openAbove){
            c.fillStyle='#414a26';c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+24,yy);c.lineTo(xx+24,yy+3);c.lineTo(xx+12,yy+6+n%4);c.lineTo(xx,yy+4);c.fill();
            for(let j=0;j<7;j++){
              const gx=xx+j*3.6,lean=Math.sin(x*4+j)*3;
              c.fillStyle=['#82914c','#9fa751','#ced07b','#768442'][(j+n)%4];c.beginPath();c.moveTo(gx-2,yy+2);c.lineTo(gx+lean,yy-3-(j+n)%6);c.lineTo(gx+3,yy+2);c.fill();
            }
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
      for(let x=Math.ceil((left-2)/6)*6;x<right+2;x+=6){
        if(x<0||x>=WW||map[x][surface(x)]!=='grass')continue;
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
      for(const w of sentries)if(w.hp){
        if(sprite(4,w.x,w.y+13,29,1,.87+.13*Math.sin(t*14)))continue;
        const flap=Math.sin(t*12)*7;c.fillStyle=w.hit?'#fff':w.site.color;
        for(const side of [-1,1]){c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x+side*17,w.y-9+flap);c.lineTo(w.x+side*9,w.y+6);c.fill();}
        c.fillStyle='#402746';c.fillRect(w.x-3,w.y-4,6,11);
      }
      c.fillStyle='#524357';c.fillRect(altar.x-22,altar.y+10,44,8);
      for(let i=0;i<3;i++){c.fillStyle=hasBell(sites[i])?sites[i].color:'#897966';c.fillRect(altar.x-15+i*12,altar.y-6-i%2*7,6,18+i%2*7);}
      if(guardian){
        const g=guardian,wing=12*Math.sin(t*9);
        if(g.phase==='signal'){c.strokeStyle='#ffd475';c.lineWidth=2;c.beginPath();c.arc(g.x,g.y,23+14*g.age,0,Math.PI*2);c.stroke();}
        if(!sprite(5,g.x,g.y+30,68,1,.85+.15*Math.sin(t*9))){
        c.save();c.translate(g.x,g.y);
        for(const side of [-1,1]){c.save();c.scale(side,1);c.fillStyle=g.phase==='signal'?'#ffce70':'#a6dfdf';c.beginPath();c.moveTo(0,4);c.lineTo(39,-21+wing);c.lineTo(30,6+wing);c.lineTo(9,14);c.fill();c.restore();}
        c.fillStyle='#564c70';c.fillRect(-6,-10,12,26);c.fillStyle='#fff3ac';c.fillRect(-3,-7,6,5);c.restore();}
      }
      if(relics.naturalWidth)c.drawImage(relics,680,581,537,631,spawn.x-24,spawn.y-12,38,46);
      for(const slime of slimes){const sy=slime.y;
        const crouch=!slime.vy&&slime.wait<.25;
        if(sprite(3,slime.x,sy,crouch?20:27,slime.d,crouch?1.22:1))continue;
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
      if(swing||sel==='blade'){
        const phase=1-swing/.33;
        if(swing){
          c.strokeStyle='#ffdd9399';c.lineWidth=3;c.beginPath();c.arc(0,0,34,-1.5,-1.5+phase*2.65);c.stroke();
          c.rotate(-.6+phase*2.65);
        }else c.rotate(.65);
        c.fillStyle='#eed7a0';c.fillRect(-4,-9,10,3);c.fillStyle='#cbdfe1';
        c.beginPath();c.moveTo(-1,-9);c.lineTo(1,-33);c.lineTo(4,-27);c.lineTo(3,-9);c.fill();
      }else if(sel==='mine'){
        c.rotate(dig?-.4+Math.sin(dig*Math.PI)*1.65:.64);
        c.fillStyle='#ad8155';c.fillRect(0,-17,3,22);c.fillStyle='#b8cddb';c.beginPath();c.moveTo(-8,-14);c.quadraticCurveTo(-4,-26,12,-16);c.lineTo(15,-10);c.quadraticCurveTo(6,-17,-8,-14);c.fill();
      }
      c.restore();
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
      const next=sites.find(site=>!hasBell(site));
      const dx=(next?next.x:8)-Math.floor((p.x+9)/TS),dy=(next?next.y:surface(8)-1)-Math.floor((p.y+17)/TS);
      rr(c,627,18,315,66,12,'rgba(13,18,32,.86)');
      label(c,guardian?'GLASSWING  '+guardian.hp+'/12':journal.cleared?'COPPERFALL RESTORED':(next?next.name:'Copperfall altar').toUpperCase(),643,45,15,'#ffe3ad');
      label(c,guardian?'2 selects blade · hold F to strike':journal.cleared?'Three bells recovered · free exploration':Math.abs(dx)+(dx<0?' west':' east')+' · '+Math.abs(dy)+(dy<0?' up':' down')+' · E to ring',643,69,12,'#d9dad0');
      rr(c,18,18,206,68,13,'rgba(13,18,32,.8)');label(c,'HEARTS '+'♥'.repeat(p.health)+'♡'.repeat(5-p.health),32,46,14,'#ff9d9d');label(c,'CRYSTALS '+p.ores+' · '+sel.toUpperCase(),32,70,12,'#dec2ff');u.status.textContent='Depth '+Math.max(0,Math.floor(p.y/TS)-surface(Math.floor(p.x/TS)))+' · '+bag.crystal+' crystals in pack · '+p.health+' hearts';
    });return ()=>u.stop(()=>{dirty=true;persist();});
  }};
})();
