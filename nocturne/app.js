const canvas = document.querySelector('#stage');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });

const scenes = [
  { title: '轨道<br />花园', tag: '引力习作 / 001', desc: '一枚被潮汐拉伸的光核，在寂静轨道上持续呼吸。' },
  { title: '液态<br />回声', tag: '反射习作 / 002', desc: '冷光掠过金属般的波面，留下无法重复的短暂回声。' },
  { title: '琥珀<br />裂隙', tag: '地层习作 / 003', desc: '热流沿着虚构地层缓慢迁徙，照亮深处的微小断面。' }
];

let program;
let uniforms = {};
let quality = 1;
let scene = 0;
let targetScene = 0;
let paused = false;
let elapsed = 0;
let last = performance.now();
let pointer = { x: 0, y: 0, tx: 0, ty: 0 };

const vertex = `
  attribute vec2 position;
  void main(){ gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = `
  precision highp float;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uScene;

  #define PI 3.14159265359
  mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
  float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 p){
    vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float v=0.; for(int i=0;i<4;i++){v+=noise(p)*.5;p=p*2.03+2.1;} return v; }
  float sdSphere(vec3 p,float r){return length(p)-r;}
  float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y);return length(q)-t.y;}
  float orbMap(vec3 p){ return sdSphere(p,1.12+fbm(p*1.7+uTime*.08)*.18); }

  vec3 sceneOrbital(vec2 uv, vec3 ro, vec3 rd){
    float t=0., glow=0.; vec3 col=vec3(0.);
    for(int i=0;i<72;i++){
      vec3 p=ro+rd*t; p.xz*=rot(uTime*.08+uMouse.x*.35); p.xy*=rot(uMouse.y*.18);
      float organic=fbm(p*1.7+uTime*.08)*.18;
      float core=sdSphere(p,1.12+organic);
      float ring=sdTorus(p*vec3(1.,1.4,1.),vec2(1.72,.025));
      float d=min(core,ring); glow+=.003/(.012+abs(ring));
      if(d<.002){
        vec2 e=vec2(.004,0.);
        vec3 n=normalize(vec3(orbMap(p+e.xyy)-orbMap(p-e.xyy),orbMap(p+e.yxy)-orbMap(p-e.yxy),orbMap(p+e.yyx)-orbMap(p-e.yyx)));
        float rim=pow(1.-abs(dot(n,rd)),2.4);
        col=vec3(.06,.10,.16)+vec3(.18,.32,.48)*rim+vec3(.72,.49,.18)*pow(fbm(p*4.),4.);
        break;
      }
      t+=max(.012,d*.55); if(t>9.)break;
    }
    col+=vec3(.27,.43,.65)*glow*.25;
    col+=vec3(.12,.18,.28)*pow(max(0.,1.-length(uv-vec2(.35,-.1))),5.);
    return col;
  }

  vec3 sceneLiquid(vec2 uv, vec3 ro, vec3 rd){
    vec3 col=vec3(.008,.015,.025); float t=0.;
    for(int i=0;i<65;i++){
      vec3 p=ro+rd*t; p.xz*=rot(-.35+uMouse.x*.2);
      float wave=sin(p.x*2.2+uTime*.6)*.16+sin(p.z*3.1-uTime*.42)*.12+fbm(p*1.4)*.3;
      float d=abs(p.y+wave)*.62+.008;
      float gleam=.0025/d;
      col+=vec3(.06,.19,.28)*gleam*(.25+noise(p*3.));
      if(d<.009){ col+=vec3(.35,.62,.72)*(1.-t/8.); break; }
      t+=d; if(t>10.)break;
    }
    float arc=abs(length(uv-vec2(.35,.12))-.62);
    col+=vec3(.3,.47,.55)*.004/(.004+arc*arc*15.);
    return col;
  }

  vec3 sceneAmber(vec2 uv, vec3 ro, vec3 rd){
    float t=0., density=0.; vec3 col=vec3(.008,.006,.008);
    for(int i=0;i<78;i++){
      vec3 p=ro+rd*t; p.xy*=rot(.15+uMouse.y*.12);
      float strata=abs(sin(p.y*5.+fbm(p*1.1+uTime*.05)*4.));
      float cleft=abs(p.x+sin(p.y*1.7+uTime*.1)*.3)-.07;
      float d=max(.012,(cleft*.45+.02)*(.35+strata));
      float heat=.003/(.002+cleft*cleft*10.)*(.2+1.-strata);
      col+=vec3(.78,.26,.035)*heat*.045;
      density+=exp(-abs(p.z)*.4)*.0015;
      t+=d; if(t>9.)break;
    }
    col+=vec3(.35,.09,.015)*density;
    return col;
  }

  void main(){
    vec2 uv=(gl_FragCoord.xy*2.-uResolution.xy)/uResolution.y;
    uv.x-=.08;
    vec3 ro=vec3(0.,0.,4.2);
    vec3 rd=normalize(vec3(uv,-1.8));
    rd.xz*=rot(uMouse.x*.12); rd.yz*=rot(-uMouse.y*.08);
    float s=clamp(uScene,0.,2.);
    vec3 col;
    if(s<.5) col=sceneOrbital(uv,ro,rd);
    else if(s<1.5) col=sceneLiquid(uv,ro,rd);
    else col=sceneAmber(uv,ro,rd);
    col=pow(col,vec3(.72));
    col*=1.-.18*dot(uv,uv);
    float film=(hash(vec3(gl_FragCoord.xy,uTime))-.5)*.025;
    gl_FragColor=vec4(col+film,1.);
  }
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function initGL() {
  if (!gl) return document.body.classList.add('no-webgl');
  program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  uniforms = {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    mouse: gl.getUniformLocation(program, 'uMouse'),
    time: gl.getUniformLocation(program, 'uTime'),
    scene: gl.getUniformLocation(program, 'uScene')
  };
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5) * quality;
  const width = Math.floor(innerWidth * dpr);
  const height = Math.floor(innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width; canvas.height = height;
    gl?.viewport(0, 0, width, height);
  }
}

function render(now) {
  const delta = Math.min((now - last) / 1000, .05); last = now;
  if (!paused) elapsed += delta;
  pointer.x += (pointer.tx - pointer.x) * .045;
  pointer.y += (pointer.ty - pointer.y) * .045;
  scene += (targetScene - scene) * .035;
  resize();
  if (gl) {
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.mouse, pointer.x, pointer.y);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.scene, scene);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  const sec = Math.floor(elapsed);
  document.querySelector('#elapsed').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  document.querySelector('#progress').style.width = `${(elapsed % 18) / 18 * 100}%`;
  requestAnimationFrame(render);
}

function selectScene(index) {
  targetScene = Number(index);
  document.querySelectorAll('[data-scene]').forEach(el => el.classList.toggle('is-active', Number(el.dataset.scene) === targetScene));
  const data = scenes[targetScene];
  const copy = document.querySelector('.hero__copy');
  copy.animate([{ opacity: 1, transform: 'translateY(-48%)' }, { opacity: 0, transform: 'translateY(-44%)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
    document.querySelector('#currentIndex').textContent = String(targetScene + 1).padStart(2, '0');
    document.querySelector('#sceneTitle').innerHTML = data.title;
    document.querySelector('#sceneTag').textContent = data.tag;
    document.querySelector('#sceneDesc').textContent = data.desc;
    copy.animate([{ opacity: 0, transform: 'translateY(-53%)' }, { opacity: 1, transform: 'translateY(-48%)' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  });
}

function openPanel(id) {
  document.querySelectorAll('.panel').forEach(panel => {
    const open = panel.id === id;
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', String(!open));
  });
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('is-active', link.dataset.panel === id));
}

document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => selectScene(button.dataset.scene)));
document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.panel)));
document.querySelectorAll('[data-panel-close]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.panel').forEach(panel => { panel.classList.remove('is-open'); panel.setAttribute('aria-hidden','true'); });
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('is-active', !link.dataset.panel));
}));

document.querySelector('#playToggle').addEventListener('click', () => {
  paused = !paused;
  document.body.classList.toggle('is-paused', paused);
  document.querySelector('#playToggle').setAttribute('aria-label', paused ? '继续动画' : '暂停动画');
});
document.querySelectorAll('[data-quality]').forEach(button => button.addEventListener('click', () => {
  quality = Number(button.dataset.quality);
  document.querySelectorAll('[data-quality]').forEach(el => el.classList.toggle('is-active', el === button));
  resize();
}));

function updatePointer(e) {
  const point = e.touches?.[0] || e;
  pointer.tx = (point.clientX / innerWidth - .5) * 2;
  pointer.ty = (point.clientY / innerHeight - .5) * -2;
}
window.addEventListener('pointermove', updatePointer, { passive: true });
window.addEventListener('touchmove', updatePointer, { passive: true });
window.addEventListener('resize', resize);
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') selectScene((targetScene + 1) % scenes.length);
  if (e.key === 'ArrowLeft') selectScene((targetScene + scenes.length - 1) % scenes.length);
  if (e.key === 'Escape') document.querySelector('[data-panel-close]').click();
});

try {
  initGL();
} catch (error) {
  console.error('WebGL shader initialization failed:', error);
  document.body.classList.add('no-webgl');
}
requestAnimationFrame(render);

let load = 0;
const loadTimer = setInterval(() => {
  load += Math.ceil(Math.random() * 13);
  if (load >= 100) {
    load = 100; clearInterval(loadTimer);
    setTimeout(() => document.body.classList.remove('is-loading'), 260);
  }
  document.querySelector('#loadPercent').textContent = String(load).padStart(2, '0');
}, 60);
