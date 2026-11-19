// Small offline triangle renderer. World coordinates, camera and picking are shared by both backends.
(() => {
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const n=Math.hypot(...a)||1; return a.map(v=>v/n); };
  const sub = (a,b) => a.map((v,i)=>v-b[i]);
  const colors = new Map();
  function rgb(hex) {
    if(!colors.has(hex)) colors.set(hex,[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));
    return colors.get(hex);
  }
  function graphics(canvas) {
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false});
    if(!gl)return null;
    const program=gl.createProgram();
    for(const [kind,source] of [[gl.VERTEX_SHADER,`attribute vec3 pos,col; attribute float material; uniform vec3 eye,right,up,front,fog; uniform float lens,range;
      varying vec3 shade,world;varying float ocean;void main(){ocean=material;world=pos;vec3 d=pos-eye;float z=dot(d,front);
      gl_Position=vec4(dot(d,right)*lens/480.,dot(d,up)*lens/270.,z*1.00005-.50,z);
      shade=mix(col,fog,smoothstep(range*.20,range,z)*.83);}`],
      [gl.FRAGMENT_SHADER,`precision highp float;varying vec3 shade,world;varying float ocean;uniform vec3 eye;uniform float grain,clock;
        void main(){float v=1.;if(grain>.5){vec3 p=floor(world*12.+.001);v=.84+.20*fract(sin(dot(p,vec3(12.3,27.1,7.7)))*4375.3);}
        vec3 color=shade*v;
        if(ocean>.5){
          vec2 uv=world.xz;float slow=sin(uv.y*.12+uv.x*.035+clock*1.5);
          float ripple=sin(uv.y*.75+2.1*sin(uv.x*.25+clock)+clock*2.8);
          vec3 normal=normalize(vec3(.14*cos(uv.x*.19+clock)+.09*ripple,1.,.20*slow+.09*cos(uv.y*.75+clock*2.8)));
          vec3 view=normalize(eye-world);float fres=pow(1.-clamp(dot(view,normal),0.,1.),2.6);
          float sun=pow(max(dot(reflect(normalize(vec3(-.24,-.48,-.75)),normal),view),0.),30.);
          color=mix(color*vec3(.67,1.02,1.05),vec3(.52,.73,.74),fres*.75)+vec3(1.,.83,.55)*sun*.85;
          color+=vec3(.09,.21,.19)*smoothstep(.8,.99,ripple)*smoothstep(.4,.98,slow);
        }
        gl_FragColor=vec4(color,1.);}`]]){
      const shader=gl.createShader(kind); gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))return null;
      gl.attachShader(program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return null;
    gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [field,offset] of [['pos',0],['col',12],['material',24]]){
      const a=gl.getAttribLocation(program,field);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,field==='material'?1:3,gl.FLOAT,false,28,offset);
    }
    const u=Object.fromEntries(['eye','right','up','front','fog','lens','range','grain','clock'].map(k=>[k,gl.getUniformLocation(program,k)]));
    gl.enable(gl.DEPTH_TEST);
    return {gl,u,program,buffer};
  }
  class Scene {
    constructor(ctx){
      this.ctx=ctx;this.canvas=document.createElement('canvas');this.gpu=graphics(this.canvas);
      this.vertices=new Float32Array(65536);this.used=0;this.faces=[];this.tiles=[];
    }
    begin(eye,target,{fog='#b9cdd0',range=80,lens=520,roll=0}={}){
      this.eye=eye;this.front=unit(sub(target,eye));const right=unit(cross([0,1,0],this.front)),up=cross(this.front,right);
      this.right=right.map((v,i)=>v*Math.cos(roll)+up[i]*Math.sin(roll));
      this.up=up.map((v,i)=>v*Math.cos(roll)-right[i]*Math.sin(roll));
      this.lens=lens;this.range=range;this.fog=rgb(fog);this.used=0;this.faces.length=0;this.tiles.length=0;
    }
    project(p){
      const d=sub(p,this.eye),z=dot(d,this.front);
      return z<=.25?null:[480+dot(d,this.right)*this.lens/z,270-dot(d,this.up)*this.lens/z,z];
    }
    face(points,color,light=1,material=0){
      const base=rgb(color);
      if(!this.gpu){
        let pts=points.map(p=>this.project(p));
        if(pts.every(p=>!p))return;
        if(pts.some(p=>!p)){
          const clipped=[];
          for(let i=0;i<points.length;i++){
            const a=points[i],b=points[(i+1)%points.length],za=dot(sub(a,this.eye),this.front),zb=dot(sub(b,this.eye),this.front);
            if(za>.251)clipped.push(a);
            if((za>.251)!==(zb>.251)){const f=(.251-za)/(zb-za);clipped.push(a.map((v,j)=>v+(b[j]-v)*f));}
          }
          pts=clipped.map(p=>this.project(p));if(pts.length<3)return;
        }
        const depth=pts.reduce((n,p)=>n+p[2],0)/pts.length;
        const f=Math.min(.83,Math.max(0,depth/this.range-.2));
        this.faces.push({pts,depth,color:'rgb('+base.map((v,i)=>Math.round(255*(v*light*(1-f)+this.fog[i]*f))).join(',')+')'});return;
      }
      const need=this.used+(points.length-2)*21;
      if(need>this.vertices.length){const next=new Float32Array(Math.max(need,this.vertices.length*2));next.set(this.vertices);this.vertices=next;}
      for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]]){
        let n=this.used;const v=this.vertices;v[n++]=p[0];v[n++]=p[1];v[n++]=p[2];
        v[n++]=base[0]*light;v[n++]=base[1]*light;v[n++]=base[2]*light;v[n++]=material;this.used=n;
      }
    }
    box(x,y,z,w,h,d,color,yaw=0){
      const a=Math.cos(yaw),b=Math.sin(yaw);
      const bottom=[[-w,-d],[w,-d],[w,d],[-w,d]].map(([i,j])=>[x+(i*a-j*b)/2,y,z+(i*b+j*a)/2]);
      const top=bottom.map(([i,j,k])=>[i,j+h,k]);
      this.face(top,color);
      for(let i=0;i<4;i++){const j=(i+1)%4;this.face([bottom[i],bottom[j],top[j],top[i]],color,[.81,.63,.73,.91][i]);}
    }
    cone(x,y,z,r,h,color,sides=6,angle=0){
      const ring=Array.from({length:sides},(_,i)=>[x+r*Math.cos(angle+i*2*Math.PI/sides),y,z+r*Math.sin(angle+i*2*Math.PI/sides)]);
      for(let i=0;i<sides;i++)this.face([ring[i],ring[(i+1)%sides],[x,y+h,z]],color,.78+.20*Math.cos(i*2*Math.PI/sides+.5));
    }
    patch(x,y,z,rx,rz,color,tilt=0){
      const points=[];
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6,dx=rx*Math.cos(a),dz=rz*Math.sin(a);
        points.push([x+dx*Math.cos(tilt)-dz*Math.sin(tilt),y,z+dx*Math.sin(tilt)+dz*Math.cos(tilt)]);
      }
      this.face(points,color);
    }
    tile(x,y,z,w,d,id){
      const pts=[[-w,-d],[w,-d],[w,d],[-w,d]].map(([i,j])=>this.project([x+i/2,y,z+j/2]));
      if(pts.every(Boolean))this.tiles.push({pts,id,depth:pts.reduce((n,p)=>n+p[2],0)/4});
    }
    pick(x,y){
      let best=null;
      for(const tile of this.tiles){
        const signs=tile.pts.map((a,i)=>{const b=tile.pts[(i+1)%4];return (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);});
        if((signs.every(v=>v>=0)||signs.every(v=>v<=0)) && (!best||tile.depth<best.depth))best=tile;
      }
      return best?.id;
    }
    finish(){
      const c=this.ctx,g=this.gpu;
      if(!g){
        this.faces.sort((a,b)=>b.depth-a.depth);
        for(const {pts,color} of this.faces){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
        return;
      }
      const width=Math.min(1600,c.canvas.width),height=Math.round(width*9/16);
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
      const {gl,u}=g;gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      for(const k of ['eye','right','up','front','fog'])gl.uniform3fv(u[k],this[k]);
      gl.uniform1f(u.lens,this.lens);gl.uniform1f(u.range,this.range);gl.uniform1f(u.grain,this.voxelTexture?1:0);
      gl.uniform1f(u.clock,this.waterTime||0);
      gl.bufferData(gl.ARRAY_BUFFER,this.vertices.subarray(0,this.used),gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES,0,this.used/7);c.drawImage(this.canvas,0,0,960,540);
    }
    close(){if(this.gpu){const {gl,buffer,program}=this.gpu;gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}}
  }
  function sky(c,palette,t=0){
    const [zenith,horizon,ridge,near,sun]=palette;
    const g=c.createLinearGradient(0,0,0,540);g.addColorStop(0,zenith);g.addColorStop(.53,horizon);g.addColorStop(1,near);c.fillStyle=g;c.fillRect(0,0,960,540);
    const glow=c.createRadialGradient(735,109,12,735,109,156);glow.addColorStop(0,sun+'a0');glow.addColorStop(1,sun+'00');c.fillStyle=glow;c.fillRect(570,0,330,280);
    c.fillStyle=sun;c.beginPath();c.arc(735,109,33,0,Math.PI*2);c.fill();
    for(let i=0;i<17;i++){const x=(i*137+t*.8)%1120-80,y=42+i*53%115;c.fillStyle=i%2?'#ffffff1a':'#ffffff28';c.beginPath();c.ellipse(x,y,35+i%4*17,2+i%3,0,0,Math.PI*2);c.fill();}
    for(let k=0;k<2;k++){c.fillStyle=k?near:ridge;c.beginPath();c.moveTo(0,540);
      for(let x=0;x<=976;x+=16)c.lineTo(x,220+k*43+35*Math.sin(x*.013+k)+18*Math.cos(x*.032+k)+7*Math.sin(x*.081));
      c.lineTo(960,540);c.fill();}
  }
  function pine(s,x,y,z,h,col='#40816a'){
    s.box(x,y,z,h*.10,h*.40,h*.10,'#885d47');s.cone(x,y+h*.2,z,h*.32,h*.55,col,6);
    s.cone(x,y+h*.43,z,h*.25,h*.58,col,6,.3);
  }
  function person(s,x,y,z,h=1){
    s.box(x,y,z,.34*h,.44*h,.23*h,'#354661');s.box(x,y+.39*h,z,.43*h,.33*h,.27*h,'#ed8055');
    s.box(x,y+.72*h,z,.28*h,.26*h,.27*h,'#f4c7a1');s.box(x,y+.95*h,z,.43*h,.07*h,.36*h,'#eabc79');
  }
  A.worldArt={Scene,sky,pine,person};
})();
