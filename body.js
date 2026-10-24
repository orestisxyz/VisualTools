// noprotect
(function () {
// BODY · a live camera instrument for performers (sibling of the polychoron, ink field and frame)
// The camera finds the person (a small AI model in the browser, or a background key, or movement), cuts them out,
// copies them in rows and rings with a time delay, paints each copy in flat stage colours, and lays a tracking HUD on
// top. The music drives it: every effect moves on the beat.
// Paste into editor.p5js.org (p5 v1 or v2). Needs WebGL2 and a camera. The AI cut-out needs internet the first time.
//
// TOP BAR   camera (front / back) · cut (ai / key / motion) · music · mic · rec
//           bpm (beat clock) · react (calm / groove / wild) · bg (camera, dim, black, paper, orange) · ui · menu
// DOCK      clones echo mirror pop outline ghost dots / stutter track body lines scan grid data
//           (tap = on / off, hold = only while held, drag up / down = amount; the amount bar: dance, every ½-4 beats,
//           music on / off, style) · looks 1-4 · hit · freeze · rnd
// SOUND     every effect moves on the beat (or the drift tempo without music) · copies step along the row, colours change,
//           copies freeze and jump, the scan sweeps, tracking boxes jump to new targets · the energy sets how strong
// KEYS      Q W E R T Y U = clones echo mirror pop outline ghost dots · A S D G J K L = stutter track body lines scan grid
//           data · enter = hit · P style · 1-4 looks (shift = save) · Z freeze · M react · V background · O learn background ·
//           C camera flip · ; beat clock · B tap tempo · 0 everything off · space play · H hide · F full screen · N random
// Uses p5 only for setup / draw; everything else is plain WebGL2 + Web Audio, inside one function (no name clashes).

// ---------------------------------------------------------------- state
const P = {                       // the settings (sliders), all saved in looks
  delay: 0.25,                    // seconds between one copy and the next
  spread: 0.5,                    // space between the copies
  size: 1.0,                      // size of the copies
  cut: 0.5,                       // cut-out threshold
  soft: 0.2,                      // cut-out edge softness
  bgdim: 0.6,                     // how dark the 'dim' background is
  contrast: 1.0,
  sat: 1.0,
  grain: 0.2,
  move: 0.5,                      // the drift tempo (without music)
  sens: 1.0,                      // sound sensitivity
  pdens: 0.5,                     // points: how many
  psize: 0.35,                    // points: how big
  pdepth: 0.6,                    // points: how deep the cloud is
  pturn: 0.5,                     // points: how far it turns by itself
  pstay: 0.6,                     // paint: how long the marks stay (right = for ever)
  pbody: 0.3,                     // paint: how much of you is seen over the canvas
};
const PDEF = Object.assign({}, P);
const SLIDERS = [
  ['delay', 'time between copies · seconds', 0.03, 1, 0.01],
  ['spread', 'space between copies', 0, 1, 0.01],
  ['size', 'size of the copies', 0.4, 1.6, 0.01],
  ['cut', 'cut-out · loose ←→ tight', 0.15, 0.85, 0.01],
  ['soft', 'cut-out edge · hard ←→ soft', 0, 0.6, 0.01],
  ['bgdim', 'dim background · how dark', 0, 1, 0.01],
  ['contrast', 'contrast', 0.5, 2, 0.01],
  ['sat', 'colour amount', 0, 2, 0.01],
  ['grain', 'grain', 0, 1, 0.01],
  ['move', 'drift · the tempo without music', 0, 1, 0.01],
  ['sens', 'sound sensitivity', 0.2, 3, 0.01],
  ['pdens', 'points · how many', 0, 1, 0.01],
  ['psize', 'points · size', 0, 1, 0.01],
  ['pdepth', 'points · depth', 0, 1, 0.01],
  ['pturn', 'points · turning by itself', 0, 1, 0.01],
  ['pstay', 'paint · how long it stays (right = for ever)', 0, 1, 0.01],
  ['pbody', 'paint · how much of you is seen', 0, 1, 0.01],
];
const FX = ['clones', 'echo', 'mirror', 'pop', 'outline', 'ghost', 'dots',
  'stutter', 'track', 'body', 'lines', 'scan', 'grid', 'data', 'points', 'time', 'paint'];   // points: the view, not a dock button
const FX_ALL = FX;
const HUD_FX = ['track', 'body', 'lines', 'scan', 'grid', 'data'];
const fxOn = {}, fxAmt = {}, fxMus = {}, fxVar = {};
let outSolo = false;
let dotCol = 0;                                                       // dots: camera, white, orange, black
const DOT_COLS = ['camera', 'white', 'orange', 'black'];                                                  // outline: solo = only the line, together = the line over the body
for (const f of FX) { fxOn[f] = false; fxAmt[f] = 0.5; fxMus[f] = true; fxVar[f] = 0; }
const FX_LABEL = {};
const POPS = [                    // flat stage colours: six sets of (shadow, middle, light), one per copy
  { name: 'stage', c: [[[0, 40, 10], [40, 220, 90], [200, 255, 180]], [[0, 10, 60], [40, 140, 255], [180, 230, 255]], [[50, 10, 0], [255, 120, 20], [255, 220, 140]],
    [[60, 0, 10], [240, 40, 40], [255, 190, 170]], [[40, 0, 50], [220, 40, 200], [255, 190, 250]], [[30, 30, 0], [240, 220, 30], [255, 255, 200]]] },
  { name: 'fire', c: [[[20, 0, 0], [200, 30, 10], [255, 170, 40]], [[40, 5, 0], [255, 90, 0], [255, 230, 150]], [[10, 0, 10], [230, 0, 60], [255, 140, 60]],
    [[60, 10, 0], [255, 120, 20], [255, 255, 200]], [[15, 5, 5], [180, 20, 20], [255, 90, 31]], [[30, 0, 20], [255, 60, 0], [255, 210, 0]]] },
  { name: 'acid', c: [[[0, 0, 0], [255, 0, 170], [0, 255, 200]], [[0, 0, 0], [255, 230, 0], [120, 0, 255]], [[10, 0, 30], [0, 255, 90], [255, 80, 0]],
    [[0, 0, 0], [0, 170, 255], [255, 255, 255]], [[20, 0, 0], [255, 60, 60], [255, 240, 0]], [[0, 0, 20], [180, 255, 0], [255, 0, 255]]] },
  { name: 'cold', c: [[[0, 10, 30], [0, 120, 200], [150, 240, 255]], [[5, 0, 30], [80, 60, 220], [200, 190, 255]], [[0, 20, 20], [0, 170, 150], [190, 255, 230]],
    [[0, 0, 0], [40, 90, 255], [255, 255, 255]], [[10, 10, 40], [110, 150, 255], [230, 240, 255]], [[0, 30, 40], [0, 200, 255], [220, 255, 255]]] },
  { name: 'mono', c: [[[10, 10, 10], [120, 120, 120], [240, 240, 240]], [[0, 0, 0], [80, 80, 80], [200, 200, 200]], [[20, 20, 20], [150, 150, 150], [255, 255, 255]],
    [[0, 0, 0], [100, 100, 100], [230, 230, 230]], [[30, 30, 30], [170, 170, 170], [250, 250, 250]], [[5, 5, 5], [130, 130, 130], [220, 220, 220]]] },
];
const VARIANTS = {
  clones: ['fan', 'stack', 'row', 'grid', 'ring', 'auto'], pop: POPS.map((p) => p.name), outline: ['white', 'orange', 'colour', 'black'],
  dots: ['round', 'square', 'lines'], time: ['down', 'across', 'rings', 'bands', 'wave', 'auto'], paint: ['ink', 'spray', 'line', 'smear'], points: ['camera', 'white', 'depth', 'orange'], track: ['boxes', 'crosshairs'], scan: ['down', 'across'],
};
const BGS = [['camera', null], ['dim', null], ['black', [0, 0, 0]], ['paper', [236, 232, 222]], ['orange', [255, 90, 31]]];
let bgMode = 2;
const CUTS = ['ai', 'key', 'motion'];
let cutMode = 0;
let frozen = false, frameNo = 0, simTime = 0, lastT = 0;

// ---------------------------------------------------------------- WebGL
let cv, gl, W = 0, H = 0, aspect = 1, dpr = 1, resScale = 1;
let progHist, progCmp, progShow, quadVao;
let cmpTex = [null, null], cmpFbo = [null, null], cmpCur = 0;
const HN = 60;                                     // frames of history (two seconds) for the delayed copies
let histTex = null, histFbo = null, hW = 0, hH = 0, hHead = 0, hFill = 0;
let camTex = null, maskTex = null, hudTex = null, camReady = false, maskReady = false;
let glOk = true, clearNow = true;

const QUAD_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const VID_GLSL = `
uniform vec2 uScale;
uniform float uFlip;
vec2 vid(vec2 uv) {                                                   // screen -> camera picture (cover the screen, mirrored for the front camera)
  vec2 t = (uv - 0.5) * uScale + 0.5;
  if (uFlip > 0.5) t.x = 1.0 - t.x;
  return vec2(t.x, 1.0 - t.y);
}`;

// 1. history: each camera frame, with the person's cut-out in its alpha
const HIST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCam, uMask;
${VID_GLSL}
out vec4 o;
void main() { vec2 t = vid(vUv); o = vec4(texture(uCam, t).rgb, texture(uMask, t).r); }`;

// 2. compose: the background, then every copy of the person (oldest behind), coloured, outlined or dotted, plus ghost trails
const CMP_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUv;
uniform sampler2DArray uHist;
uniform sampler2D uCam, uMask, uPrev;
${VID_GLSL}
uniform vec2 uRes;
uniform float uAspect, uN;
uniform vec4 uCl[8], uCm[8];                     // uCl: offset x, y, size, angle · uCm: layer (-1 = now), alpha, mirrored, colour set
uniform float uCut, uSoft, uBg, uBgDim, uContrast, uSat;
uniform vec3 uBgC;
uniform float uPop, uPalShift;
uniform vec3 uPal[18];
uniform float uOut, uOutW, uOutStyle, uOutSolo;
uniform vec3 uOutC;
uniform float uDots, uDotN, uDotStyle, uDotK, uDotCol;
uniform float uTimeOn, uHead, uHN, uSpan, uTStyle, uTPhase, uTFlip;
uniform vec2 uTPiv;
uniform float uGhost, uPrevOK, uFlash, uPaintOn, uPBody;
uniform sampler2D uPaint;
out vec4 o;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec4 person(vec2 uv, float layer) {
  if (layer < -0.5) { vec2 t = vid(uv); return vec4(texture(uCam, t).rgb, texture(uMask, t).r); }
  float l0 = floor(layer), f = layer - l0;
  vec4 a0 = texture(uHist, vec3(uv, l0));
  if (f < 0.002) return a0;
  return mix(a0, texture(uHist, vec3(uv, mod(l0 + 1.0, uHN))), f);   // between two moments (time view)
}
// time view: which moment each place on the screen shows (0 = now, 1 = the oldest)
float timeField(vec2 uv) {
  float v;
  if (uTStyle < 0.5) v = 1.0 - uv.y;                                   // down: the top is now, lower is earlier
  else if (uTStyle < 1.5) v = uv.x;                                     // across
  else if (uTStyle < 2.5) v = length((uv - uTPiv) * vec2(uAspect, 1.0)) * 1.5;   // rings out from the body
  else if (uTStyle < 3.5) v = floor((1.0 - uv.y) * 7.0) / 6.0;          // bands: steps of time
  else v = 0.5 + 0.5 * sin(uv.y * 11.0 + uv.x * 5.0);                  // wave
  v = mix(v, 1.0 - v, uTFlip);
  v = fract(v + uTPhase);
  return clamp(v, 0.0, 1.0);
}
vec3 grade(vec3 c) { c = (c - 0.5) * uContrast + 0.5; return clamp(mix(vec3(lum(c)), c, uSat), 0.0, 1.0); }
vec3 popOf(vec3 c, float k) {
  int b = int(mod(k + uPalShift, 6.0)) * 3;
  float l = lum(c);
  return l < 0.2 ? uPal[b] : (l < 0.46 ? uPal[b + 1] : uPal[b + 2]);
}
void main() {
  vec2 asp = vec2(uAspect, 1.0);
  vec3 cam = grade(texture(uCam, vid(vUv)).rgb);
  vec3 col = uBg < 0.5 ? cam : (uBg < 1.5 ? cam * (1.0 - uBgDim) : uBgC);
  float tLayer = 0.0;
  if (uTimeOn > 0.5) {
    tLayer = mod(uHead - timeField(vUv) * uSpan + uHN, uHN);
    if (uBg < 0.5) col = grade(person(vUv, tLayer).rgb);                // camera background: the whole picture runs through time
    else if (uBg < 1.5) col = grade(person(vUv, tLayer).rgb) * (1.0 - uBgDim);
  }
  for (int i = 7; i >= 0; i--) {
    if (float(i) >= uN) continue;
    vec4 L = uCl[i], C = uCm[i];
    if (uTimeOn > 0.5) { L = vec4(0.0, 0.0, 1.0, 0.0); C = vec4(tLayer, 1.0, 0.0, C.w); }
    else if (uPaintOn > 0.5) { L = vec4(0.0, 0.0, 1.0, 0.0); C = vec4(-1.0, uPBody, 0.0, C.w); }   // paint: you, faint, over the canvas
    vec2 q = (vUv - 0.5 - L.xy) * asp;
    float cs = cos(L.w), sn = sin(L.w);
    q = mat2(cs, -sn, sn, cs) * q / L.z;
    vec2 u = q / asp + 0.5;
    if (C.z > 0.5) u.x = 1.0 - u.x;
    if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) continue;
    vec4 b = person(u, C.x);
    float lo = uCut - uSoft * 0.5 - 0.01, hi = uCut + uSoft * 0.5 + 0.01;
    float a = smoothstep(lo, hi, b.a);
    vec3 c = grade(b.rgb);
    if (uDots > 0.5) {                                                 // dots: the person as a screen of dots
      vec2 g = u * asp * uDotN;
      vec2 f = fract(g) - 0.5;
      vec2 cu = (floor(g) + 0.5) / uDotN / asp;
      vec4 bc = person(cu, C.x);
      c = grade(bc.rgb);
      float r = (0.12 + 0.36 * lum(c)) * uDotK;
      if (uDotCol > 0.5) c = uDotCol < 1.5 ? vec3(0.94, 0.94, 0.92) : (uDotCol < 2.5 ? vec3(1.0, 0.353, 0.12) : vec3(0.04));
      float d = uDotStyle < 0.5 ? length(f) : (uDotStyle < 1.5 ? max(abs(f.x), abs(f.y)) : abs(f.y) * 1.6);
      a = step(uCut, bc.a) * (1.0 - smoothstep(r - 0.05, r + 0.05, d));
    }
    if (uPop > 0.5) c = popOf(c, C.w);
    c = mix(c, vec3(1.0), uFlash);                                     // the snare: a flash on the body
    // the layers stack: the body (camera or pop colours, or dots) and the outline drawn over it
    col = mix(col, c, (uOut > 0.5 && uOutSolo > 0.5 ? 0.0 : a) * C.y);   // outline solo leaves out the body
    if (uOut > 0.5) {                                                  // outline: a line along the edge of the body
      vec2 e = vec2(uOutW / uRes.x, uOutW / uRes.y) / L.z;
      float g = abs(person(u + vec2(e.x, 0.0), C.x).a - person(u - vec2(e.x, 0.0), C.x).a)
              + abs(person(u + vec2(0.0, e.y), C.x).a - person(u - vec2(0.0, e.y), C.x).a);
      float line = smoothstep(0.05, 0.3, g);
      vec3 lc = (uOutStyle > 1.5 && uOutStyle < 2.5) ? popOf(vec3(0.8), C.w + 2.0) : uOutC;
      col = mix(col, lc, line * C.y);
    }
  }
  if (uPaintOn > 0.5) { vec4 pp = texture(uPaint, vUv); col = col * (1.0 - pp.a) + pp.rgb; }   // the paint, over everything
  if (uGhost > 0.0 && uPrevOK > 0.5) col = mix(col, max(col, texture(uPrev, vUv).rgb), uGhost);   // ghost: what was bright stays a while
  o = vec4(col, 1.0);
}`;

// 3. on screen: the picture, the HUD on top, grain
const SHOW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCmp, uHud;
uniform float uHudOn, uGrain, uTime;
out vec4 o;
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 col = texture(uCmp, vUv).rgb;
  if (uHudOn > 0.5) { vec4 h = texture(uHud, vec2(vUv.x, 1.0 - vUv.y)); col = mix(col, h.rgb, h.a); }
  col += (h2(gl_FragCoord.xy + uTime) - 0.5) * uGrain * 0.15;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(type, srcText) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, srcText);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  return sh;
}
function program(vs, fs) {
  const pr = gl.createProgram();
  gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(pr));
  pr.u = {};
  const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(pr, i);
    pr.u[info.name] = gl.getUniformLocation(pr, info.name);
  }
  return pr;
}
function makeTex(filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function initGL() {
  cv = document.createElement('canvas');
  cv.id = 'body';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;touch-action:none;display:block';
  document.body.appendChild(cv);
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('This browser has no WebGL2.');
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  progHist = program(QUAD_VS, HIST_FS);
  progCmp = program(QUAD_VS, CMP_FS);
  progShow = program(QUAD_VS, SHOW_FS);
  initPoints();
  initPaint();
  quadVao = gl.createVertexArray();
  camTex = makeTex(); maskTex = makeTex(); hudTex = makeTex();
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glOk = false; });
  cv.addEventListener('webglcontextrestored', () => { location.reload(); });
}
function buildBuffers() {
  for (let i = 0; i < 2; i++) {
    if (cmpTex[i]) gl.deleteTexture(cmpTex[i]);
    if (cmpFbo[i]) gl.deleteFramebuffer(cmpFbo[i]);
    cmpTex[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cmpTex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    cmpFbo[i] = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cmpFbo[i]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cmpTex[i], 0);
  }
  const long = 512;                                                  // the history is smaller than the screen
  hW = aspect >= 1 ? long : Math.max(2, Math.round(long * aspect));
  hH = aspect >= 1 ? Math.max(2, Math.round(long / aspect)) : long;
  if (histTex) gl.deleteTexture(histTex);
  if (!histFbo) histFbo = gl.createFramebuffer();
  histTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, histTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, hW, hH, HN);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  hFill = 0; clearNow = true;
  if (progPaint) buildPaint();
  sizeHud();
}
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale;
  const w = Math.max(2, Math.floor(window.innerWidth * dpr)), h = Math.max(2, Math.floor(window.innerHeight * dpr));
  if (w === W && h === H) return;
  W = w; H = h;
  cv.width = W; cv.height = H;
  aspect = W / H;
  buildBuffers();
}

// ---------------------------------------------------------------- the camera
let video = null, camStream = null, camFacing = 'user', camOn = false, camUploadT = 0, camNew = false;
async function startCamera() {
  stopCamera();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video = document.createElement('video');
    video.playsInline = true; video.muted = true; video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.srcObject = camStream;
    await video.play().catch(() => {});
    camOn = true;
    bgKey = null;
  } catch (e) {
    camOn = false;
    note('camera blocked or not started · tap camera in the top bar');
  }
  if (typeof refreshTop === 'function' && B.camera) refreshTop();
}
function stopCamera() {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null; camOn = false; camReady = false;
}
function uploadCamera(now) {
  camNew = false;
  if (!camOn || !video || video.readyState < 2 || !video.videoWidth || now - camUploadT < 30) return;
  camUploadT = now;
  gl.bindTexture(gl.TEXTURE_2D, camTex);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); camReady = true; camNew = true; } catch (e) { camReady = false; }
}
function camScale() {                                                  // cover the screen without stretching
  const sa = video && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
  return sa > aspect ? [aspect / sa, 1] : [1, sa / aspect];
}
// a point of the camera picture (0..1, y down) -> the screen (0..1, y up)
function vidToScreen(tx, ty) {
  const sc = camScale();
  const x = camFacing === 'user' ? 1 - tx : tx, y = 1 - ty;
  return { x: (x - 0.5) / sc[0] + 0.5, y: (y - 0.5) / sc[1] + 0.5 };
}

// ---------------------------------------------------------------- finding the person
// ai: Google's MediaPipe selfie segmenter, running in the browser (downloaded the first time) · key: the difference from a
// picture of the empty background (learn background) · motion: whatever moves
const AI_VER = '0.10.14';
const AI_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + AI_VER;
const AI_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
let seg = null, aiState = 'off', aiLast = 0, aiFail = '';
let aiMask = null, aiW = 0, aiH = 0;
async function loadAI() {
  if (aiState === 'loading' || aiState === 'on') return;
  aiState = 'loading'; refreshTop && refreshTop();
  note('loading the body model…');
  try {
    const vision = await import(AI_BASE + '/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(AI_BASE + '/wasm');
    const make = (delegate) => vision.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: AI_MODEL, delegate },
      runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true,
    });
    try { seg = await make('GPU'); } catch (e) { seg = await make('CPU'); }
    aiState = 'on';
    note('body model ready');
  } catch (e) {
    aiState = 'failed'; aiFail = String(e && e.message || e).slice(0, 120);
    note('the body model could not load · using the background key');
    if (cutMode === 0) setCut(1);
  }
  refreshTop && refreshTop();
}
function runAI(now) {
  if (!seg || aiState !== 'on' || !camOn || !video || video.readyState < 2 || now - aiLast < 45) return false;
  aiLast = now;
  let got = false;
  try {
    seg.segmentForVideo(video, now, (res) => {                          // the masks are only valid inside this callback
      const masks = res && res.confidenceMasks;
      if (!masks || !masks.length) return;
      const m = masks.length > 1 ? masks[1] : masks[0];               // the person (a 2-class model lists the background first)
      const f = m.getAsFloat32Array();
      aiW = m.width; aiH = m.height;
      if (!aiMask || aiMask.length !== f.length) aiMask = new Uint8Array(f.length);
      for (let i = 0; i < f.length; i++) { aiMask[i] = Math.max(0, Math.min(255, f[i] * 255)); }
      got = true;
    });
  } catch (e) { aiErrors = (aiErrors || 0) + 1; if (aiErrors > 30) { aiState = 'failed'; aiFail = String(e && e.message || e).slice(0, 120); setCut(2); note('the body model stopped · using motion'); } return false; }
  if (got) {
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, aiW, aiH, 0, gl.RED, gl.UNSIGNED_BYTE, aiMask);
    maskReady = true;
  }
  return got;
}
let aiErrors = 0;

// a small copy of the camera on the processor: movement for the HUD, and the key / motion cut-out
const AW = 96, AH = 72;
let anaCv = null, anaCtx = null, anaT = 0;
const gPrev = new Float32Array(AW * AH), motion = new Float32Array(AW * AH), cpuMask = new Float32Array(AW * AH);
const cpuMaskU8 = new Uint8Array(AW * AH);
let bgKey = null, keyCount = 0;
const STATS = { has: false, x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, hx: 0, hy: 0, area: 0 };
const hot = [];                                                        // the places where something moves (screen uv)
function analyse(now) {
  if (!camOn || !video || video.readyState < 2 || now - anaT < 50) return;
  anaT = now;
  if (!anaCv) { anaCv = document.createElement('canvas'); anaCv.width = AW; anaCv.height = AH; anaCtx = anaCv.getContext('2d', { willReadFrequently: true }); }
  anaCtx.drawImage(video, 0, 0, AW, AH);
  const d = anaCtx.getImageData(0, 0, AW, AH).data;
  const useKey = cutMode === 1 && bgKey, useMotion = cutMode === 2 || (cutMode === 1 && !bgKey) || (cutMode === 0 && aiState !== 'on');
  const lo = 0.015 + 0.1 * P.cut;                                   // the cut-out slider: how different from the background counts
  for (let i = 0, j = 0; i < AW * AH; i++, j += 4) {
    const r = d[j] / 255, g = d[j + 1] / 255, b = d[j + 2] / 255;
    const gray = r * 0.3 + g * 0.59 + b * 0.11;
    const mo = Math.abs(gray - gPrev[i]);
    gPrev[i] = gray;
    motion[i] = Math.max(motion[i] * 0.8, mo * 5);
    if (useKey) {
      const k = i * 3, cd = (Math.abs(r - bgKey[k]) + Math.abs(g - bgKey[k + 1]) + Math.abs(b - bgKey[k + 2])) / 3;
      const m = Math.min(1, Math.max(0, (cd - lo) / 0.05));
      cpuMask[i] = cpuMask[i] * 0.4 + m * 0.6;
    } else if (useMotion) {
      cpuMask[i] = Math.max(cpuMask[i] * 0.94, Math.min(1, Math.max(0, (mo - 0.02) / 0.06)));
    }
  }
  if (keyCount > 0) {                                                  // learning the empty background: average a few frames
    if (!bgKey) bgKey = new Float32Array(AW * AH * 3);
    const w = 1 / (11 - keyCount);
    for (let i = 0, j = 0; i < AW * AH; i++, j += 4) {
      const k = i * 3;
      bgKey[k] += (d[j] / 255 - bgKey[k]) * w; bgKey[k + 1] += (d[j + 1] / 255 - bgKey[k + 1]) * w; bgKey[k + 2] += (d[j + 2] / 255 - bgKey[k + 2]) * w;
    }
    keyCount--;
    if (!keyCount) note('background learned · step back in');
  }
  if (useKey || useMotion) {                                           // the processor cut-out goes to the graphics chip (softened)
    for (let y = 0; y < AH; y++) {
      for (let x = 0; x < AW; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < AW && yy < AH) { s += cpuMask[yy * AW + xx]; n++; }
          }
        }
        cpuMaskU8[y * AW + x] = Math.min(255, (s / n) * 255);
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, AW, AH, 0, gl.RED, gl.UNSIGNED_BYTE, cpuMaskU8);
    maskReady = true;
  }
  // the body: its box, centre and the top (head), from whichever cut-out is in use
  let src = cpuMaskU8, sw = AW, sh = AH, stride = 1;
  if (cutMode === 0 && aiState === 'on' && aiMask) { src = aiMask; sw = aiW; sh = aiH; stride = 4; }
  // a robust box: where the middle 90 % of the person's pixels are (stray specks of noise do not stretch it)
  const colC = new Float32Array(sw), rowC = new Float32Array(sh);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < sh; y += stride) {
    for (let x = 0; x < sw; x += stride) {
      if (src[y * sw + x] > 127) { colC[x]++; rowC[y]++; sx += x; sy += y; n++; }
    }
  }
  const pct = (arr, len, q) => { let c = 0; const goal = n * q; for (let i = 0; i < len; i++) { c += arr[i]; if (c >= goal) return i; } return len - 1; };
  const x0 = pct(colC, sw, 0.05), x1 = pct(colC, sw, 0.95), y0 = pct(rowC, sh, 0.03), y1 = pct(rowC, sh, 0.97);
  STATS.has = n > 6;
  if (STATS.has) {
    const a = vidToScreen(x0 / sw, y0 / sh), b = vidToScreen(x1 / sw, y1 / sh), c = vidToScreen(sx / n / sw, sy / n / sh);
    let hxs = 0, hn = 0;                                                 // the head: the middle of the top rows
    for (let x = 0; x < sw; x += stride) { for (let y = y0; y < Math.min(sh, y0 + 4 * stride); y += stride) { if (src[y * sw + x] > 127) { hxs += x; hn++; } } }
    const hd = vidToScreen(hn ? hxs / hn / sw : sx / n / sw, y0 / sh);
    const k = 0.35;
    const ease = (key, v) => { STATS[key] = STATS.area ? STATS[key] + (v - STATS[key]) * k : v; };
    ease('x0', Math.min(a.x, b.x)); ease('x1', Math.max(a.x, b.x)); ease('y0', Math.min(a.y, b.y)); ease('y1', Math.max(a.y, b.y));
    ease('cx', c.x); ease('cy', c.y); ease('hx', hd.x); ease('hy', hd.y);
    STATS.area = n * stride * stride / (sw * sh);
  } else STATS.area = 0;
  // movement hot spots for the tracking boxes: the strongest cells of a coarse grid
  const GX = 8, GY = 6, cells = [];
  for (let gy = 0; gy < GY; gy++) {
    for (let gx = 0; gx < GX; gx++) {
      let s = 0;
      for (let y = gy * AH / GY | 0; y < (gy + 1) * AH / GY; y++) { for (let x = gx * AW / GX | 0; x < (gx + 1) * AW / GX; x++) { s += motion[y * AW + x]; } }
      cells.push({ gx, gy, s });
    }
  }
  cells.sort((p, q) => q.s - p.s);
  hot.length = 0;
  for (const c of cells) {
    if (c.s < 4 || hot.length >= 8) break;
    if (hot.some((h) => Math.abs(h.gx - c.gx) <= 1 && Math.abs(h.gy - c.gy) <= 1)) continue;
    const p = vidToScreen((c.gx + 0.5) / GX, (c.gy + 0.5) / GY);
    hot.push({ gx: c.gx, gy: c.gy, x: p.x, y: p.y, s: c.s });
  }
}
function learnBackground() {
  if (!camOn) { note('start the camera first'); return; }
  note('step out of the picture · learning the background in 3 s');
  setTimeout(() => { keyCount = 10; bgKey = null; note('learning the background…'); }, 3000);
}
function setCut(i) {
  cutMode = (i + CUTS.length) % CUTS.length;
  if (cutMode === 0 && aiState !== 'on') loadAI();
  if (cutMode === 1 && !bgKey) learnBackground();
  cpuMask.fill(0);
  refreshTop && refreshTop();
}
// ---------------------------------------------------------------- beat clock (shared by the sketches)
// Listens for hits (sudden rises in the low and mid frequencies), finds the regular spacing between them over the
// last 8 seconds (the tempo, in BPM) and where the beats fall (the phase), then predicts every next beat.
// It can be switched off (the sketch then reacts to bass hits as before) or set by tapping.
const BC = {
  on: true,              // the switch
  mode: 'auto',          // 'auto' = listening, 'tap' = set by tapping
  bpm: 0, periodMs: 0, next: 0, locked: false, conf: 0, beat: 0, misses: 0, drift: 0,
  env: new Float32Array(400), envI: 0, envN: 0, envT: 0, acc: 0, prev: null, lastEst: 0, ests: [], taps: [],
};
const BC_HZ = 50;                    // the hit envelope is kept at 50 values a second

// feed one frame of the spectrum (0..255 values), now = performance.now()
function bcFeed(freq, now) {
  if (!BC.prev || BC.prev.length !== freq.length) { BC.prev = new Float32Array(freq.length); BC.envT = now; }
  let flux = 0;
  const top = Math.min(freq.length, 180);
  for (let i = 1; i < top; i++) {
    const d = freq[i] - BC.prev[i];
    if (d > 0) flux += i < 12 ? d * 2 : d;            // kicks count double
  }
  for (let i = 0; i < freq.length; i++) { BC.prev[i] = freq[i]; }
  BC.acc = Math.max(BC.acc, flux);
  if (now - BC.envT > 1000) BC.envT = now - 1000;     // after a pause, do not fill a long gap
  while (now - BC.envT >= 1000 / BC_HZ) {
    BC.env[BC.envI] = BC.acc;
    BC.envI = (BC.envI + 1) % BC.env.length;
    BC.envN = Math.min(BC.env.length, BC.envN + 1);
    BC.acc = 0;
    BC.envT += 1000 / BC_HZ;
  }
  if (BC.mode === 'auto' && now - BC.lastEst > 500 && BC.envN >= 250) { BC.lastEst = now; bcEstimate(now); }
}

function bcEstimate(now) {
  const n = BC.envN, L = BC.env.length, x = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) { const v = BC.env[(BC.envI - n + i + L * 2) % L]; x[i] = v; mean += v; }
  mean /= n;
  let e0 = 0;
  for (let i = 0; i < n; i++) { x[i] = Math.max(0, x[i] - mean); e0 += x[i] * x[i]; }
  if (e0 <= 1e-6) { bcMiss(); return; }
  e0 /= n;
  // how well the hits repeat at each spacing between 70 and 180 BPM (a little preference for 90..140)
  const lo = Math.floor(60 * BC_HZ / 180), hi = Math.ceil(60 * BC_HZ / 70);
  const r = new Float32Array(2 * hi + 3);
  for (let lag = lo - 1; lag <= 2 * hi + 2 && lag < n - 50; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) { s += x[i] * x[i - lag]; }
    r[lag] = s / (n - lag);
  }
  let best = -1, bestScore = 0;
  for (let lag = lo; lag <= hi; lag++) {
    const bpm = 60 * BC_HZ / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.55, 2));
    const twice = r[2 * lag] || 0;                                         // a real beat also repeats at double the spacing
    const score = (r[lag] + 0.5 * twice) * prior;
    if (score > bestScore) { bestScore = score; best = lag; }
  }
  if (best < 0) { bcMiss(); return; }
  // off-beat hats make the pattern repeat every 3 half-beats too: if 2/3 of the spacing fits almost as well, that is the real beat
  const c23 = Math.round(best * 2 / 3);
  if (c23 >= lo && r[c23] >= 0.7 * r[best]) best = c23;
  const a = r[best - 1], b = r[best], c = r[best + 1], den = a - 2 * b + c;
  const lagF = best + (den < 0 ? 0.5 * (a - c) / den : 0);                 // between two spacings
  const conf = b / e0;
  BC.conf = conf;
  if (conf < 0.3) { bcMiss(); return; }                                     // no clear rhythm: do not pretend
  BC.misses = 0;
  const est = 60 * BC_HZ / lagF;
  if (BC.bpm && Math.abs(est - BC.bpm) / BC.bpm > 0.06) {                  // the tempo really changed: start again on it
    if (++BC.drift >= 2) { BC.ests = []; BC.bpm = 0; BC.locked = false; BC.drift = 0; }
  } else BC.drift = 0;
  BC.ests.push(est);
  if (BC.ests.length > 5) BC.ests.shift();
  const sorted = BC.ests.slice().sort((p, q) => p - q);
  const bpm = sorted[Math.floor(sorted.length / 2)];
  BC.bpm = BC.bpm ? BC.bpm + (bpm - BC.bpm) * 0.5 : bpm;
  BC.periodMs = 60000 / BC.bpm;
  // where the beats fall: the offset that lines up best with the hits of the last 4 seconds
  const P = lagF, steps = Math.floor(Math.min(n, 4 * BC_HZ) / P);
  let bestPh = 0, bestSum = -1;
  for (let ph = 0; ph < Math.ceil(P); ph++) {
    let sum = 0;
    for (let k = 0; k < steps; k++) {
      const idx = n - 1 - Math.round(ph + k * P);
      if (idx >= 0) sum += x[idx] + 0.5 * (x[idx - 1] || 0) + 0.5 * (x[idx + 1] || 0);
    }
    if (sum > bestSum) { bestSum = sum; bestPh = ph; }
  }
  const lastBeat = now - bestPh * 1000 / BC_HZ - 30;                       // the hit envelope runs a little late
  let nb = lastBeat;
  while (nb <= now) { nb += BC.periodMs; }
  if (!BC.locked) BC.next = nb;
  else {                                                                     // already running: nudge gently
    let diff = nb - BC.next;
    if (diff > BC.periodMs / 2) diff -= BC.periodMs;
    if (diff < -BC.periodMs / 2) diff += BC.periodMs;
    BC.next += diff * 0.5;
  }
  BC.locked = true;
}
function bcMiss() { if (++BC.misses >= 4) { BC.locked = false; BC.ests = []; } }

// true on the frame a beat falls (only when the clock is on and locked)
function bcTick(now) {
  if (!BC.on || !BC.locked || !BC.periodMs) return false;
  if (now - BC.next > BC.periodMs * 2) { while (BC.next < now) { BC.next += BC.periodMs; } return false; }  // came back from a pause
  if (now >= BC.next) { BC.next += BC.periodMs; BC.beat++; return true; }
  return false;
}
function bcActive() { return BC.on && BC.locked; }

// tapping sets the tempo and where the beats are; the clock then stays on the tapped tempo until auto is chosen again
function bcTap(now) {
  if (BC.taps.length && now - BC.taps[BC.taps.length - 1] > 2000) BC.taps = [];
  BC.taps.push(now);
  if (BC.taps.length > 6) BC.taps.shift();
  if (BC.taps.length >= 2) {
    let sum = 0;
    for (let i = 1; i < BC.taps.length; i++) { sum += BC.taps[i] - BC.taps[i - 1]; }
    const per = sum / (BC.taps.length - 1);
    BC.bpm = Math.max(50, Math.min(220, 60000 / per));
    BC.periodMs = 60000 / BC.bpm;
    BC.next = now + BC.periodMs;
    BC.mode = 'tap'; BC.locked = true; BC.on = true;
  }
}
// the switch: auto -> off -> auto (tapping sets 'tap'; the switch from 'tap' goes back to auto)
function bcToggle() {
  if (BC.mode === 'tap') { BC.mode = 'auto'; BC.locked = false; BC.ests = []; BC.on = true; }
  else { BC.on = !BC.on; BC.locked = false; BC.ests = []; }
  try { localStorage.setItem('beatclock', BC.on ? '1' : '0'); } catch (e) { /* ignore */ }
}
function bcLoad() { try { const v = localStorage.getItem('beatclock'); if (v === '0') BC.on = false; } catch (e) { /* ignore */ } }
function bcLabel() {
  if (!BC.on) return 'off';
  if (BC.mode === 'tap') return 'tap ' + Math.round(BC.bpm);
  return BC.locked ? 'auto ' + Math.round(BC.bpm) : 'auto …';
}

// ---------------------------------------------------------------- sound
let actx = null, analyser, freqData, timeData, recDest, audioEl = null, fileLoaded = false, micStream = null, micSrc = null, micOn = false;
let sBass = 0, sMid = 0, sTreble = 0, sHigh = 0, sLevel = 0, pulse = 0, bassAvg = 0, beatCool = 0;
const ranges = {};
function setupAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.8;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
  recDest = actx.createMediaStreamDestination();
}
function soundOn() { return micOn || (audioEl && !audioEl.paused); }
let musicInput = null, musicName = null, musicLabel = null;
function handleMusic(file) {
  const okType = /^audio\//.test(file.type || '') || /\.(mp3|m4a|aac|wav|aif|aiff|ogg|oga|opus|flac|mp4|caf)$/i.test(file.name || '');
  if (!okType) { note('that is not a music file'); setLabel(B.music, 'music', 'not audio'); return; }
  setupAudio();
  actx.resume();
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.loop = true;
    audioEl.preload = 'auto';
    audioEl.setAttribute('playsinline', '');
    const s = actx.createMediaElementSource(audioEl);
    s.connect(analyser); s.connect(actx.destination); s.connect(recDest);
    audioEl.addEventListener('error', () => {
      fileLoaded = false;
      setLabel(B.music, 'music', 'can\'t play'); setOn(B.music, false);
      note('this phone cannot play that file · try mp3 or m4a');
    });
    audioEl.addEventListener('canplay', () => { if (audioEl.paused) setLabel(B.music, 'music', 'play'); });
  }
  audioEl.pause();
  if (audioEl.src && audioEl.src.startsWith('blob:')) URL.revokeObjectURL(audioEl.src);
  audioEl.src = URL.createObjectURL(file);
  audioEl.load();
  fileLoaded = true;
  if (typeof M !== 'undefined') { M.eHi = 0.16; M.eLo = 0; M.hist = []; }           // a new song: learn its loudness again
  musicName = (file.name || 'music').replace(/\.[^.]+$/, '');
  if (musicLabel) musicLabel.textContent = 'loaded · ' + musicName;
  setLabel(B.music, 'music', 'play'); setOn(B.music, false);
  note('loaded · ' + musicName.slice(0, 28) + ' · press music');
}
function togglePlay() {
  if (!fileLoaded) { if (musicInput) musicInput.click(); return; }   // no music yet: open the file picker straight away
  actx.resume();
  if (micOn) toggleMic();
  if (audioEl.paused) {
    const pr = audioEl.play();
    if (pr && pr.catch) pr.catch(() => { setLabel(B.music, 'music', 'tap again'); setOn(B.music, false); });
    setLabel(B.music, 'music', 'pause'); setOn(B.music, true);
  } else {
    audioEl.pause();
    setLabel(B.music, 'music', 'play'); setOn(B.music, false);
  }
}
async function toggleMic() {
  if (micOn) {
    micStream.getTracks().forEach((t) => t.stop());
    micSrc.disconnect();
    micOn = false;
    setLabel(B.mic, 'mic', 'off'); setOn(B.mic, false);
    return;
  }
  try {
    setupAudio();
    await actx.resume();
    if (audioEl && !audioEl.paused) { audioEl.pause(); setLabel(B.music, 'music', 'play'); setOn(B.music, false); }
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    micSrc = actx.createMediaStreamSource(micStream);
    micSrc.connect(analyser); micSrc.connect(recDest);
    micOn = true;
    setLabel(B.mic, 'mic', 'on'); setOn(B.mic, true);
  } catch (e) { setLabel(B.mic, 'mic', 'blocked'); }
}
function band(lo, hi) {
  const hz = actx.sampleRate / analyser.fftSize;
  const i0 = Math.max(0, Math.floor(lo / hz)), i1 = Math.min(freqData.length - 1, Math.ceil(hi / hz));
  let sum = 0;
  for (let i = i0; i <= i1; i++) { sum += freqData[i]; }
  return sum / ((i1 - i0 + 1) * 255);
}
function normalise(name, v) {
  const r = ranges[name] || (ranges[name] = { lo: v, hi: v + 0.05 });
  r.hi = v > r.hi ? v : r.hi + (v - r.hi) * 0.004;
  r.lo = v < r.lo ? v : r.lo + (v - r.lo) * 0.004;
  return Math.pow(Math.min(1, Math.max(0, (v - r.lo) / Math.max(r.hi - r.lo, 0.05))), 1.3);
}
const follow = (c, t, k60) => c + (t - c) * (1 - Math.pow(1 - (t > c ? 0.7 : 0.1), k60));
function listen(k60) {
  if (!soundOn()) { sBass *= 0.9; sMid *= 0.9; sTreble *= 0.9; sLevel *= 0.9; pulse *= 0.9; return; }
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  let sumSq = 0;
  for (let i = 0; i < timeData.length; i++) { const v = (timeData[i] - 128) / 128; sumSq += v * v; }
  const bass = normalise('bass', band(20, 140));
  sBass = follow(sBass, bass, k60);
  sMid = follow(sMid, normalise('mid', band(400, 2600)), k60);
  sTreble = follow(sTreble, normalise('treble', band(5200, 14000)), k60);
  sHigh = follow(sHigh, normalise('high', band(2600, 5200)), k60);
  sLevel = follow(sLevel, normalise('level', Math.sqrt(sumSq / timeData.length)), k60);
  bassAvg += (bass - bassAvg) * 0.05;
  beatCool = Math.max(0, beatCool - k60);
  const now = performance.now();
  pulse *= Math.pow(0.88, k60);                                         // the last beat fades (before a new one can arrive)
  bcFeed(freqData, now);
  if (bcActive()) { if (bcTick(now)) pulse = 1; }                         // the beat clock: on the predicted beats
  else if (beatCool <= 0 && bass > 0.45 && bass > bassAvg * 1.2) { pulse = 1; beatCool = 10; }   // off: react to bass hits
}

// ---------------------------------------------------------------- how the music drives the picture
// kick = movement · snare = breaks · highs = texture · energy (the last few seconds, against the whole song) = how strong
// everything is (the amount you set is the maximum) · bars and phrases (4 / 16 beats) = bigger changes · a drop = one big moment
const REACTS = ['calm', 'groove', 'wild'];       // calm = energy only · groove = energy + kick and snare · wild = all of it, strong
let reactMode = 1;
const M = { hh: 0, lastSwell: -1e9, energy: 1, eLvl: 0, eHi: 0.16, eLo: 0, kick: 0, snare: 0, hat: 0, drop: 0, calm: 0, gain: 1, hist: [], histT: 0, lastDrop: -1e9 };
let kickN = 0, snareN = 0, lastKickAt = -1e9, lastSnareAt = -1e9;
const det = {};
const fxHit = {};
function rise(name, v) {                                             // how much one band jumped up since the last frame
  const d = det[name] || (det[name] = { prev: v, avg: 0.01, last: 0 });
  const f = Math.max(0, v - d.prev);
  d.prev = v;
  return f;
}
function isHit(name, f, now, gap, sens) {                            // a jump well above the usual ones = a hit
  const d = det[name];
  const hit = f > d.avg * (2.6 / sens) + 0.012 && now - d.last > gap;
  d.avg += (f - d.avg) * 0.04;
  if (hit) d.last = now;
  return hit;
}

function hitFx(list, now) { for (const f of list) { if (fxOn[f] && fxMus[f]) fxHit[f] = now; } }
function mus(f) { return fxOn[f] && fxMus[f]; }                    // this effect is on and follows the music
function accent() { return [0, 1, 1.7][reactMode]; }               // how hard the hits land
function musicStep(k60) {
  const now = performance.now();
  M.kick *= Math.pow(0.86, k60); M.snare *= Math.pow(0.85, k60); M.hh *= Math.pow(0.72, k60);   // hits: flash in, gone in about a quarter second M.drop *= Math.pow(0.94, k60); M.calm *= Math.pow(0.992, k60);
  if (!soundOn()) { M.gain = 1; M.hat = 0; M.energy += (1 - M.energy) * 0.05 * k60; return; }
  // energy: how loud the last ~2 seconds are, between the quietest and loudest parts heard so far
  let s2 = 0;
  for (let i = 0; i < timeData.length; i++) { const v = (timeData[i] - 128) / 128; s2 += v * v; }
  const rms = Math.sqrt(s2 / timeData.length);
  M.eLvl += (rms - M.eLvl) * (1 - Math.pow(1 - 0.012, k60));
  const ref = micOn ? 0.05 : 0.16;                                    // about how loud a loud part is (a mastered track / the mic)
  M.eHi = Math.max(M.eLvl, M.eHi * Math.pow(0.9994, k60), ref * 0.4);   // starts at a typical loud level, then learns this song
  M.eLo = Math.min(M.eLvl, M.eLo + (M.eLvl - M.eLo) * 0.0006 * k60);
  const e = Math.min(1, Math.max(0, (M.eLvl - M.eLo) / Math.max(0.02, M.eHi - M.eLo)));
  M.energy += (e - M.energy) * (1 - Math.pow(1 - 0.03, k60));
  const base = reactMode === 2 ? 0.5 : 0.33;                          // quiet parts: about a third of what you set
  M.gain = base + (1 - base) * Math.pow(M.energy, 1.3);
  M.hat = sTreble;
  // drop (loud right after a quiet stretch) and breakdown (quiet right after a loud one)
  M.histT += k60 / 60;
  if (M.histT >= 0.25) {
    M.histT = 0;
    M.hist.push(M.energy);
    if (M.hist.length > 28) M.hist.shift();
    if (M.hist.length >= 24) {
      let before = 0;
      for (let i = 0; i < 14; i++) { before += M.hist[i]; }
      before /= 14;
      if (M.energy > 0.6 && M.energy - before > 0.35 && now - M.lastDrop > 10000) { M.lastDrop = now; onDrop(now); }
      if (M.energy < 0.22 && before > 0.6 && M.calm < 0.2) { M.calm = 1; note('breakdown'); }
      // a swell (ambient): the sound grows over a couple of seconds, without any drums needed
      const ago = M.hist[M.hist.length - 9];
      if (M.energy - ago > 0.18 && now - M.lastSwell > 4000 && now - M.lastDrop > 4000) { M.lastSwell = now; onSwell(now); }
    }
  }
  if (reactMode === 0) return;                                        // calm: no hits, only the energy
  const sens = Math.min(2, Math.max(0.4, P.sens));
  if (isHit('kick', rise('kick', band(40, 140)), now, 180, sens)) onKick(now);
  const fs = rise('snare', band(1800, 4500)), fh = rise('hat', band(7000, 14000));
  const sh = isHit('snare', fs, now, 140, sens);
  if (sh && fs > fh * 0.8) onSnare(now);                              // a snare is wide; a hi-hat is mostly very high
  else if (isHit('hat', fh, now, 70, sens)) M.hh = 1;                  // hi-hat: a short tick of texture
}
// kick: its punch (the moves themselves come from the groove clock)
function onKick(now) {
  kickN++; lastKickAt = now; M.kick = 1;                               // (the moves come from the groove clock; the kick adds its punch)
}
// snare / clap: things jump — the copies freeze on other moments, colours change, the tracking jumps
function onSnare(now) {
  snareN++; lastSnareAt = now; M.snare = 1;
  if (viewMode === 1 && mus('points')) pYawK += (Math.random() < 0.5 ? -1 : 1) * 0.25 * hitK('points');   // the cloud jerks round
  if (viewMode === 3 && mus('paint')) paintSnare();                   // paint: the brush changes colour
  if (viewMode === 2 && mus('time')) tPhaseTo += (Math.random() < 0.5 ? -1 : 1) * 0.125 * Math.min(1, hitK('time') + 0.3);   // time jumps
  for (const f of ['stutter', 'pop', 'track']) {   // the breaking effects also hit on the snare
    if (fxOn[f] && useMusic(f) && rateOf(f) <= 1 && now - fxLast[f] > period * 0.35) fire(f, now, period * rateOf(f));
  }
}
// how hard the hits land on an effect: its dance, the react mode, and how loud this part of the song is
function hitK(f) { return useMusic(f) ? dance(f) * accent() * (0.45 + 0.55 * M.gain) : 0; }
// which effect leads the current view (copies: clones, when it is on)
function viewLead() { return viewMode === 1 ? 'points' : viewMode === 2 ? 'time' : viewMode === 3 ? 'paint' : (fxOn.clones ? 'clones' : null); }
// a swell: the views make a slow move of their own (ambient music has no drums to follow)
function onSwell(now) {
  const f = viewLead();
  if (f && mus(f) && now - fxLast[f] > 600) fire(f, now, Math.max(1500, (soundOn() && period ? period : driftPeriod()) * 4));
}
// the drop: one big moment for the effects (the picture itself is not touched)
function onDrop(now) {
  M.drop = 1; M.kick = 1.4; M.snare = 1.4;
  if (mus('pop')) palShift += 3;
  if (mus('clones')) spreadKick = 1;
  if (mus('stutter')) stutterGo();
  if (mus('points')) pointsDrop();
  if (mus('time')) { tMove = 'pump'; }
  if (mus('paint')) paintDrop();
  for (const f of FX) { if (mus(f)) fire(f, now, period * 2); }
  note('drop');
}
function setReact(i) {
  reactMode = (i + REACTS.length) % REACTS.length;
  store('react', reactMode);
  refreshTop();
}

// ---------------------------------------------------------------- the groove: one clock that every effect dances to
// With music the clock is the beat. Without music it runs at the drift tempo, and the hit pad plays it by hand. Each effect
// moves every ½, 1, 2 or 4 beats (its rate), and every move lasts until the next one.
const RATES = [0.5, 1, 2, 4];
const RATE_NAME = ['½ beat', '1 beat', '2 beats', '4 beats'];
const fxRate = {}, fxDance = {}, fxLast = {}, fxDur = {};
for (const f of FX) { fxRate[f] = 1; fxDance[f] = 0.75; fxLast[f] = -1e9; fxDur[f] = 500; }
fxRate.points = 2; fxRate.time = 2; fxRate.paint = 2; fxRate.scan = 2; fxRate.track = 1; fxRate.pop = 1; fxRate.stutter = 1; fxRate.clones = 2; fxRate.grid = 2;
let beatN = 0, beatHeld = false, lastBeatAt = -1e9, period = 500, mTick = 0, vTick = 0, mBeatAt = -1e9, mHalf = true, vT = 0;
const beatGaps = [];
let hitHeld = false, hitT = 0;
function useMusic(f) { return !!(soundOn() && fxMus[f]); }
function musicLive() { return soundOn() && performance.now() - mBeatAt < Math.max(1500, period * 2.5); }
function useClock(f) { return !!(musicLive() && fxMus[f]); }
function rateOf(f) { return RATES[fxRate[f]] * [2, 1, 0.5][reactMode]; }
function driftPeriod() {
  const base = 2400 - 1900 * P.move;
  return soundOn() ? base * (1.5 - 0.9 * M.energy) : base;               // music without a clear beat: quiet = slow, loud = fast
}
const glide = (dur, dtReal) => 1 - Math.pow(0.03, dtReal * 1000 / Math.max(60, dur));   // reaches the target within dur
function env(f) { return fxOn[f] ? Math.exp(-3.2 * Math.min(4, (performance.now() - fxLast[f]) / Math.max(60, fxDur[f]))) : 0; }
function dance(f) { return fxOn[f] ? fxDance[f] : 0; }
function watchBeats() {
  const now = performance.now(), snd = soundOn();
  if (pulse > 0.95 && !beatHeld) {
    beatHeld = true;
    beatN++;
    if (lastBeatAt > 0) { const g = now - lastBeatAt; if (g > 250 && g < 1500) { beatGaps.push(g); if (beatGaps.length > 8) beatGaps.shift(); } }
    lastBeatAt = now;
    if (snd) { mBeatAt = now; mHalf = false; tick('m', now, false); }
  }
  if (pulse < 0.6) beatHeld = false;
  if (snd) {
    if (bcActive() && BC.periodMs) period = BC.periodMs;
    else if (beatGaps.length >= 3) { const s = beatGaps.slice().sort((a, b) => a - b); period = s[s.length >> 1]; }
    if (!mHalf && now - mBeatAt >= period / 2) { mHalf = true; tick('m', now, true); }
  }
  const vp = driftPeriod();
  if (!vT || now - vT > vp * 4) vT = now;
  if (now - vT >= vp / 2) { vT += vp / 2; tick('v', now, (vTick & 1) === 0); }
  if (hitHeld && now - hitT >= (soundOn() ? period : vp)) { hitT = now; hitBeat(); }
}
function hitBeat() {
  const now = performance.now();
  for (const f of FX) { if (fxOn[f]) fire(f, now, Math.max(250, (soundOn() ? period : driftPeriod()) * rateOf(f) * 0.9)); }
  M.kick = Math.max(M.kick, 1);
}
function tick(src, now, half) {
  let n;
  if (src === 'm') { mTick = half ? (mTick | 1) : ((mTick >> 1) + 1) << 1; n = mTick; }
  else { vTick++; n = vTick; }
  const per = src === 'm' ? period : driftPeriod();
  for (const f of FX) {
    if (!fxOn[f]) continue;
    if ((src === 'm') !== useClock(f)) continue;
    const every = Math.max(1, Math.round(rateOf(f) * 2));
    if (n % every === 0) fire(f, now, per * rateOf(f));
  }
}
const fireN = {};
// one move of one effect, lasting dur ms
function fire(f, now, dur) {
  fxLast[f] = now; fxDur[f] = dur;
  fireN[f] = (fireN[f] || 0) + 1;
  fxHit[f] = now;
  try { fireMove(f, now, dur); } catch (e) { if (!fireErr) { fireErr = true; console.error('body move error (' + f + '): ' + e.message); } }
}
let fireErr = false;
function fireMove(f, now, dur) {
  switch (f) {
    case 'clones': cloneFire(); break;                                 // one dance move of the copies
    case 'mirror': mirrorSwap = !mirrorSwap; break;
    case 'pop': popFire(); break;
    case 'stutter': stutterGo(); break;                                 // the copies freeze on other moments
    case 'track': trackGo(); break;
    case 'lines': linkSeed = Math.random() * 1000; break;
    case 'points': pointsFire(); break;
    case 'time': timeFire(); break;
    case 'paint': paintFire(); break;
    case 'scan': scanAt = now; scanDur = dur; scanDir = fxVar.scan; break;
    default: break;
  }
}

// ---------------------------------------------------------------- the copies of the person
// Each move of clones is one of several dance moves (step along, step back, swap two, mirror the order, shuffle, gather
// into one body, burst apart); a new kind of move is chosen every bar, so it never just loops. The copies glide to their
// new places over the length of the move. With music: the time between copies locks to the beat (so each copy repeats your
// move exactly a beat or half a beat later, like a canon), quiet parts show fewer copies and loud parts all of them, the
// bass makes the crowd breathe and the mids make it sway.
let mirrorSwap = false, palShift = 0, stutterLags = [];
let order = [], popPal = [], cloneMove = 'step', spreadKick = 0, autoLay = 0;
const MOVES = ['step', 'step', 'back', 'swap', 'mirror', 'shuffle', 'gather', 'burst'];
const cur = [];                                                        // where each copy is now (it glides to its target)
const clU = new Float32Array(32), cmU = new Float32Array(32);
let copyN = 1;
function stutterGo() {
  const maxLag = Math.max(1, hFill - 1);
  stutterLags = [];
  for (let i = 0; i < 8; i++) { stutterLags.push((hHead - Math.floor(Math.random() * maxLag) + HN) % HN); }
}
function layerFor(lagFrames) {                                         // -1 = the live picture
  if (lagFrames <= 0 || hFill < 2) return -1;
  const lag = Math.min(lagFrames, hFill - 1);
  return (hHead - lag + HN * 2) % HN;
}
function cloneFire() {
  const n = order.length;
  if (n < 2) return;
  const k = fireN.clones || 0;
  if (k % 4 === 1) cloneMove = MOVES[Math.floor(Math.random() * MOVES.length)];   // a new kind of move every bar
  if (k % 8 === 0) autoLay = (autoLay + 1) % 4;                        // auto style: a new arrangement every 2 bars of moves
  const next = order.slice();
  let t = 0;
  if (cloneMove === 'step') { for (let i = 0; i < n; i++) { next[i] = (order[i] + 1) % n; } }
  else if (cloneMove === 'back') { for (let i = 0; i < n; i++) { next[i] = (order[i] - 1 + n) % n; } }
  else if (cloneMove === 'mirror') { for (let i = 0; i < n; i++) { next[i] = n - 1 - order[i]; } }
  else if (cloneMove === 'swap') {
    const a = Math.floor(Math.random() * n);
    let b = Math.floor(Math.random() * n);
    if (a === b) b = (b + 1) % n;
    t = next[a]; next[a] = next[b]; next[b] = t;
  } else if (cloneMove === 'shuffle') {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); t = next[i]; next[i] = next[j]; next[j] = t; }
  } else if (cloneMove === 'gather') spreadKick = -0.85;                 // all collapse into one body, then open again
  else if (cloneMove === 'burst') spreadKick = 0.9;                     // flung apart, then back
  order = next;
}
function popFire() {                                                   // colours: all change together, or just one copy
  if (Math.random() < 0.5 || !popPal.length) palShift++;
  else { const i = Math.floor(Math.random() * popPal.length); popPal[i] = (popPal[i] + 1 + Math.floor(Math.random() * 5)) % 6; }
}
function buildCopies(dtReal) {
  const list = [];
  const fps = 30;
  let lagStep = Math.max(1, Math.round(P.delay * fps));
  if (musicLive() && fxMus.clones && period) {                         // locked to the beat: the nearest of 1/8, 1/4, 1/2, 1 beat
    const bf = period / 1000 * fps;
    let best = lagStep, bd = 1e9;
    for (const f of [0.125, 0.25, 0.5, 1]) { const c = Math.max(1, Math.round(bf * f)); const d = Math.abs(c - P.delay * fps); if (d < bd) { bd = d; best = c; } }
    lagStep = best;
  }
  let n = 1;
  if (fxOn.clones) n = 2 + Math.round(fxAmt.clones * 5);
  else if (fxOn.mirror) n = 2;
  const echoN = fxOn.echo ? 1 + Math.round(fxAmt.echo * 3) : 0;
  while (n * (1 + echoN) > 8 && n > 1) n--;
  if (order.length !== n) { order = Array.from({ length: n }, (_, i) => i); popPal = Array.from({ length: n }, (_, i) => i); }
  let lay = fxOn.clones ? fxVar.clones : 0;
  if (lay === 5) lay = [0, 1, 2, 4][autoLay];                          // auto: changes by itself
  const mus = useMusic('clones'), d = dance('clones');
  spreadKick *= Math.pow(0.03, dtReal * 1000 / Math.max(120, fxDur.clones || 500));   // gather / burst ease back over the move
  const pump = Math.max(0.1, 1 + (0.3 * env('clones') + spreadKick) * (0.3 + 0.7 * d));
  const bass = mus ? sBass * P.sens * d : 0, mid = mus ? sMid * P.sens * d : 0;
  // quiet parts: fewer copies · loud parts: all of them
  const visible = mus ? 1 + (n - 1) * Math.min(1, 0.3 + 0.9 * M.energy) : n;
  const bw = STATS.has ? Math.max(0.12, STATS.x1 - STATS.x0) : 0.35, bh = STATS.has ? Math.max(0.2, STATS.y1 - STATS.y0) : 0.5;
  const px = STATS.has ? STATS.cx : 0.5, pyb = STATS.has ? STATS.y0 : 0.15;
  const at = (sc, dx, dy) => ({ x: (px - 0.5) * (1 - sc) + dx, y: (pyb - 0.5) * (1 - sc) + dy, s: sc });
  const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const gl0 = glide(Math.max(120, (fxDur.clones || 500) * 0.55), dtReal);
  for (let j = 0; j < n; j++) {
    const slot = order[j];
    const off = slot - (n - 1) / 2;
    let x = 0, y = 0, a = 0, s = P.size;
    const kp = (fxOn.clones ? hitK('clones') : (soundOn() && reactMode > 0 ? 0.5 * accent() * M.gain : 0)) * M.kick;                                  // the kick: every copy jolts bigger, the live one a little less
    const breathe = 1 + 0.1 * bass * (j % 2 ? 1 : -1) * Math.min(1, j);
    if (n > 1) {
      if (lay === 0) { const t = at(P.size * (1 - 0.07 * j) * breathe, off * bw * (0.18 + 0.45 * P.spread) * pump, 0); x = t.x; y = t.y; s = t.s; }
      else if (lay === 1) { const t = at(P.size * (1 - 0.09 * j) * breathe, (slot % 2 ? 1 : -1) * bw * 0.06 * Math.min(1, j) * pump, slot * bh * (0.08 + 0.22 * P.spread) * pump); x = t.x; y = t.y; s = t.s; }
      else if (lay === 2) {
        let sc = P.size;
        const total = () => (n - 1) * bw * sc * (0.8 + 0.8 * P.spread) + bw * sc;
        if (total() > 0.98) sc *= 0.98 / total();
        const t = at(sc * breathe, off * bw * sc * (0.8 + 0.8 * P.spread) * pump, 0); x = t.x; y = t.y; s = t.s;
      } else if (lay === 3) { const c = slot % cols, r = Math.floor(slot / cols); x = (c - (cols - 1) / 2) / cols; y = ((rows - 1) / 2 - r) / rows; s = P.size / Math.max(cols, rows) * 1.05 * breathe; }
      else { const ang = slot / n * Math.PI * 2 + simTime * 0.15; const rr = (0.18 + 0.25 * P.spread) * pump; s = P.size * Math.max(0.3, 1.1 / n) * breathe; x = Math.cos(ang) * rr / aspect; y = Math.sin(ang) * rr; a = ang - Math.PI / 2; }
      x += Math.sin(simTime * 2.1 + j * 1.7) * 0.012 * mid * Math.min(1, j);   // the mids make the crowd sway
    }
    // glide from where the copy is to where it should be
    const c = cur[j] || (cur[j] = { x, y, s, a });
    c.x += (x - c.x) * gl0; c.y += (y - c.y) * gl0; c.s += (s - c.s) * gl0; c.a += (a - c.a) * gl0;
    // the kick lands straight away (not glided): bigger, and pushed out from the middle
    const kS = 1 + (j ? 0.12 : 0.07) * kp, kX = 1 + 0.35 * kp;
    const cs2 = c.s * kS;                                                // grows from the feet, like the layouts
    const cx2 = (px - 0.5) * (1 - cs2) + (c.x - (px - 0.5) * (1 - c.s)) * kX;
    const cy2 = (pyb - 0.5) * (1 - cs2) + (c.y - (pyb - 0.5) * (1 - c.s));
    const vis = Math.max(0, Math.min(1, visible - j + 0.5));            // fades in and out with the energy
    if (j > 0 && vis <= 0.01) continue;
    const lagBase = j * lagStep;
    let layer = layerFor(lagBase);
    if (fxOn.stutter && j > 0 && stutterLags.length) layer = stutterLags[j % stutterLags.length];
    const flip = (fxOn.mirror && (slot % 2 === 1) !== mirrorSwap) ? 1 : 0;
    const pal = popPal[j] !== undefined ? popPal[j] : slot;
    for (let e = echoN; e >= 1; e--) {
      const lg = lagBase + e * Math.max(2, Math.round(lagStep * 0.6 + 3 * fxAmt.echo));
      list.push({ x: cx2, y: cy2, s: cs2, a: c.a, layer: layerFor(lg), age: lg + 0.5, alpha: vis * Math.pow(0.55, e) * (0.7 + 0.5 * dance('echo') * env('echo')), flip, pal });
    }
    list.push({ x: cx2, y: cy2, s: cs2, a: c.a, layer, age: lagBase, alpha: j === 0 ? 1 : vis, flip, pal });
  }
  cur.length = n;
  list.sort((p, q) => p.age - q.age);                                  // the first is drawn on top: the live copy in front
  copyN = Math.min(8, list.length);
  for (let i = 0; i < copyN; i++) {
    const c = list[i], k = i * 4;
    clU[k] = c.x; clU[k + 1] = c.y; clU[k + 2] = c.s; clU[k + 3] = c.a;
    cmU[k] = c.layer; cmU[k + 1] = c.alpha; cmU[k + 2] = c.flip; cmU[k + 3] = c.pal;
  }
}

// ---------------------------------------------------------------- the HUD: tracking boxes, the body, lines, scan, grid, data
let hudCv = null, hudCtx = null, hudW = 0, hudH = 0, hudK = 1;
const tracks = [];
let linkSeed = 1, scanAt = -1e9, scanDur = 1000, scanDir = 0;
function sizeHud() {
  hudK = Math.min(1.5, window.devicePixelRatio || 1);
  hudW = Math.max(2, Math.round(window.innerWidth * hudK)); hudH = Math.max(2, Math.round(window.innerHeight * hudK));
  if (!hudCv) { hudCv = document.createElement('canvas'); hudCtx = hudCv.getContext('2d'); }
  hudCv.width = hudW; hudCv.height = hudH;
}
function trackGo() {                                                   // the boxes jump to the strongest places that move
  const n = 2 + Math.round(fxAmt.track * 4);
  const pool = hot.length ? hot.slice() : [{ x: STATS.cx || 0.5, y: STATS.cy || 0.5 }];
  for (let i = 0; i < n; i++) {
    const h = pool[i % pool.length];
    const t = tracks[i] || (tracks[i] = { x: h.x, y: h.y, id: 1 + Math.floor(Math.random() * 98) });
    t.tx = h.x + (i >= pool.length ? (Math.random() - 0.5) * 0.2 : 0); t.ty = h.y + (i >= pool.length ? (Math.random() - 0.5) * 0.2 : 0);
    t.flash = 1;
  }
  tracks.length = n;
}
function hudOn() { return HUD_FX.some((f) => fxOn[f]); }
function drawHud(now, k60) {
  const g = hudCtx, w = hudW, h = hudH, k = hudK;
  g.clearRect(0, 0, w, h);
  const X = (u) => u * w, Y = (v) => (1 - v) * h;
  const fs = Math.round(9 * k);
  g.font = fs + 'px ui-monospace, "SF Mono", Menlo, monospace';
  g.textBaseline = 'top';
  const WH = 'rgba(232,234,236,', OR = 'rgba(255,90,31,';
  const fmt = (v) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2).slice(1);
  const brackets = (x, y, bw, bh, col, len) => {
    const l = len || Math.min(bw, bh) * 0.25;
    g.strokeStyle = col; g.beginPath();
    g.moveTo(x, y + l); g.lineTo(x, y); g.lineTo(x + l, y);
    g.moveTo(x + bw - l, y); g.lineTo(x + bw, y); g.lineTo(x + bw, y + l);
    g.moveTo(x + bw, y + bh - l); g.lineTo(x + bw, y + bh); g.lineTo(x + bw - l, y + bh);
    g.moveTo(x + l, y + bh); g.lineTo(x, y + bh); g.lineTo(x, y + bh - l);
    g.stroke();
  };
  g.lineWidth = Math.max(1, k);
  // grid: a measuring grid with ruler marks on the edges
  if (fxOn.grid) {
    const e = 0.18 + 0.5 * dance('grid') * env('grid'), nn = 4 + Math.round(fxAmt.grid * 8);
    g.strokeStyle = WH + (0.12 + 0.2 * e) + ')'; g.beginPath();
    for (let i = 1; i < nn; i++) { const x = Math.round(w * i / nn) + 0.5; g.moveTo(x, 0); g.lineTo(x, h); }
    const ny = Math.round(nn * h / w);
    for (let i = 1; i < ny; i++) { const y = Math.round(h * i / ny) + 0.5; g.moveTo(0, y); g.lineTo(w, y); }
    g.stroke();
    g.strokeStyle = WH + '0.55)'; g.beginPath();
    for (let i = 0; i <= 40; i++) { const x = w * i / 40, l = (i % 5 ? 4 : 9) * k; g.moveTo(x, h - 64 * k); g.lineTo(x, h - 64 * k - l); const y = h * i / 40; g.moveTo(0, y); g.lineTo(l, y); }
    g.stroke();
    g.fillStyle = WH + '0.5)';
    for (let i = 0; i <= 4; i++) { g.fillText(fmt(i / 4).padStart(3, '0'), w * i / 4 + 2 * k, h - 62 * k); }
  }
  // scan: a line sweeping across, once per move
  if (fxOn.scan) {
    const t = Math.min(1, (now - scanAt) / Math.max(200, scanDur));
    if (t < 1) {
      const across = scanDir === 1;
      const p = across ? t * w : t * h;
      const grad = across ? g.createLinearGradient(p - 60 * k, 0, p, 0) : g.createLinearGradient(0, p - 60 * k, 0, p);
      grad.addColorStop(0, OR + '0)'); grad.addColorStop(1, OR + '0.25)');
      g.fillStyle = grad;
      if (across) g.fillRect(p - 60 * k, 0, 60 * k, h); else g.fillRect(0, p - 60 * k, w, 60 * k);
      g.strokeStyle = OR + '0.95)'; g.beginPath();
      if (across) { g.moveTo(p, 0); g.lineTo(p, h); } else { g.moveTo(0, p); g.lineTo(w, p); }
      g.stroke();
      g.fillStyle = OR + '0.95)';
      g.fillText('SCAN ' + fmt(t), across ? p + 4 * k : 8 * k, across ? h * 0.5 : p + 3 * k);
    }
  }
  // body: a box around the person, the centre and the head
  if (fxOn.body && STATS.has) {
    const e = 1 + 0.6 * dance('body') * env('body');
    const x0 = X(STATS.x0), x1 = X(STATS.x1), y0 = Y(STATS.y1), y1 = Y(STATS.y0);
    const pad = 6 * k * e;
    brackets(x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2, WH + '0.9)', 16 * k * e);
    const cx = X(STATS.cx), cy = Y(STATS.cy);
    g.strokeStyle = OR + '0.95)'; g.beginPath(); g.moveTo(cx - 8 * k, cy); g.lineTo(cx + 8 * k, cy); g.moveTo(cx, cy - 8 * k); g.lineTo(cx, cy + 8 * k); g.stroke();
    const hx = X(STATS.hx), hy = Y(STATS.hy);
    g.strokeStyle = WH + '0.9)'; g.strokeRect(hx - 5 * k, hy - 5 * k, 10 * k, 10 * k);
    g.fillStyle = WH + '0.9)';
    g.fillText('BODY  ' + fmt(STATS.cx) + ' ' + fmt(STATS.cy), x0 - pad, y0 - pad - fs - 3 * k);
    g.fillText('H ' + fmt(STATS.y1 - STATS.y0) + '  W ' + fmt(STATS.x1 - STATS.x0), x0 - pad, y1 + pad + 3 * k);
    g.fillText('HEAD', hx + 8 * k, hy - 4 * k);
  }
  // track: boxes following what moves
  if (fxOn.track) {
    if (!tracks.length) trackGo();
    const rate = 1 - Math.pow(1 - 0.18, k60);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (hot.length && !useClock('track')) { let best = null, bd = 9; for (const h0 of hot) { const dd = Math.hypot(h0.x - t.tx, h0.y - t.ty); if (dd < bd) { bd = dd; best = h0; } } if (best && bd < 0.25) { t.tx += (best.x - t.tx) * 0.1; t.ty += (best.y - t.ty) * 0.1; } }
      t.x += (t.tx - t.x) * rate; t.y += (t.ty - t.y) * rate;
      t.flash = (t.flash || 0) * Math.pow(0.9, k60);
      const s = (28 + 26 * fxAmt.track) * k * (1 + 0.4 * dance('track') * env('track'));
      const x = X(t.x), y = Y(t.y);
      const col = t.flash > 0.3 ? OR + '1)' : WH + '0.9)';
      if (fxVar.track === 1) {
        g.strokeStyle = col; g.beginPath(); g.moveTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y); g.moveTo(x, y - s * 0.6); g.lineTo(x, y + s * 0.6); g.stroke();
        g.beginPath(); g.arc(x, y, s * 0.3, 0, Math.PI * 2); g.stroke();
      } else brackets(x - s / 2, y - s / 2, s, s, col, s * 0.3);
      g.fillStyle = col;
      g.fillText('TRK ' + String(t.id).padStart(2, '0'), x + s / 2 + 4 * k, y - s / 2);
      g.fillText(fmt(t.x) + ' ' + fmt(t.y), x + s / 2 + 4 * k, y - s / 2 + fs + 2 * k);
    }
  }
  // lines: a constellation linking the tracked points and the body
  if (fxOn.lines) {
    const pts = tracks.map((t) => [t.x, t.y]);
    if (STATS.has) pts.push([STATS.cx, STATS.cy], [STATS.hx, STATS.hy]);
    if (pts.length < 2) for (const h0 of hot) pts.push([h0.x, h0.y]);
    const e = 0.35 + 0.6 * dance('lines') * env('lines');
    g.strokeStyle = WH + (0.35 + 0.4 * e) + ')';
    g.setLineDash([3 * k, 4 * k]);
    g.beginPath();
    const r = (i) => { const v = Math.sin(linkSeed * 0.37 + i * 12.9898) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1 + Math.floor(r(i) * (pts.length - 1))) % pts.length;
      if (j === i) continue;
      g.moveTo(X(pts[i][0]), Y(pts[i][1])); g.lineTo(X(pts[j][0]), Y(pts[j][1]));
    }
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = OR + '0.9)';
    for (const p of pts) { g.fillRect(X(p[0]) - 2 * k, Y(p[1]) - 2 * k, 4 * k, 4 * k); }
  }
  // data: readouts in the corners
  if (fxOn.data) {
    const e = 0.6 + 0.4 * dance('data') * env('data');
    const top = 92 * k, lh = fs + 4 * k;
    g.fillStyle = WH + (0.75 * e + 0.2) + ')';
    const lines = ['BODY · ' + String(frameNo).padStart(6, '0'), 'CAM  ' + (camFacing === 'user' ? 'FRONT' : 'BACK'), 'CUT  ' + (cutMode === 0 ? 'AI ' + aiState.toUpperCase() : CUTS[cutMode].toUpperCase()),
      'BPM  ' + (soundOn() && period ? Math.round(60000 / period) : '---'), 'BEAT ' + String(beatN).padStart(4, '0'), 'FPS  ' + Math.round(fpsAvg)];
    lines.forEach((t, i) => g.fillText(t, 10 * k, top + i * lh));
    const labs = ['TRACK', 'LINES', 'SCAN', 'GRID', 'BODY'];
    const on = { TRACK: fxOn.track, LINES: fxOn.lines, SCAN: fxOn.scan, GRID: fxOn.grid, BODY: fxOn.body };
    let x = 10 * k;
    const by = h - 170 * k;
    for (const t of labs) { g.fillStyle = on[t] ? OR + '1)' : WH + '0.45)'; g.fillText(t, x, by); x += g.measureText(t).width + 12 * k; }
    const lv = [sBass, sMid, sTreble];                                 // the three bands of the sound as small bars
    lv.forEach((v, i) => { g.fillStyle = WH + '0.25)'; g.fillRect(w - 70 * k, top + i * lh, 56 * k, 4 * k); g.fillStyle = OR + '0.95)'; g.fillRect(w - 70 * k, top + i * lh, 56 * k * Math.min(1, v), 4 * k); });
  }
  gl.bindTexture(gl.TEXTURE_2D, hudTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hudCv);
}

// ---------------------------------------------------------------- points: you as a cloud of dots with depth
// The middle of the body comes forward and the edges fall back, so the cloud has a shape when it turns. Every move of the
// groove is one of: scatter (blown apart, then gathering back into you), wave (a ripple running out through the depth),
// turn (swings round to show the side), fall (drops to the floor and climbs back), swirl (twisted round its height),
// pulse (breathes out from the middle), split (opens down the middle). A new kind of move every bar.
// The other effects still work on the cloud: clones = clouds of earlier moments standing behind you, mirror = a mirrored
// cloud, echo = faint clouds a moment later, stutter = the clouds jump to other moments, pop = stage colours, outline =
// the edge of the body (solo: only the edge), dots = the shape of each point, ghost = trails, and all the HUD.
let viewMode = 0;                                                      // 0 = copies · 1 = points
const VIEWS = ['copies', 'points', 'time', 'paint'];
const VIEW_FX = [null, 'points', 'time', 'paint'];
const PCOLS = 256, PROWS = 192, PMAX = PCOLS * PROWS;
let progPts = null, ptsVao = null;
const PMOVES = ['scatter', 'wave', 'turn', 'fall', 'swirl', 'scatter', 'pulse', 'split'];
let pMove = 'scatter', pYawTo = 0, pYawK = 0, pGather = 0, pDropK = 0, pSign = 1;
const pBox = { x0: 0, y0: 0, x1: 1, y1: 1, cx: 0.5, cy: 0.5, ok: false };
const pcU = new Float32Array(16), pxU = new Float32Array(16);
let ptsClouds = 0;

const PTS_VS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
layout(location = 0) in vec4 aP;                  // where in the box (0-1), two random numbers
uniform sampler2DArray uHist;
uniform vec4 uPc[4];                              // per cloud: layer, depth offset, mirrored, colour set
uniform vec4 uPx[4];                              // per cloud: side offset, -, alpha, -
uniform vec4 uBox;                                // the part of the screen the points cover
uniform vec2 uPiv;                                // the middle of the body (what the cloud turns around)
uniform float uAspect, uCut, uDepth, uSize, uYaw, uPitch;
uniform float uScat, uWave, uWaveA, uFall, uSwirl, uPulse, uSplit, uJit, uTime, uBreath;
uniform float uStyle, uContrast, uSat, uPop, uPalShift, uOut, uOutSolo, uOutStyle, uFlash;
uniform vec3 uPal[18];
uniform vec3 uOutC;
out vec3 vC;
out float vA;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 grade(vec3 c) { c = (c - 0.5) * uContrast + 0.5; return clamp(mix(vec3(lum(c)), c, uSat), 0.0, 1.0); }
vec3 popOf(vec3 c, float k) {
  int b = int(mod(k + uPalShift, 6.0)) * 3;
  float l = lum(c);
  return l < 0.2 ? uPal[b] : (l < 0.46 ? uPal[b + 1] : uPal[b + 2]);
}
float h1(float n) { return fract(sin(n) * 43758.5453); }
float maskAt(vec2 u, float layer) { return texture(uHist, vec3(u, layer)).a; }
void main() {
  vec4 C = uPc[gl_InstanceID], X = uPx[gl_InstanceID];
  vec2 uv = mix(uBox.xy, uBox.zw, aP.xy);
  vec2 su = uv;
  if (C.z > 0.5) su.x = uPiv.x * 2.0 - su.x;                          // a mirrored cloud reads the picture flipped round the body
  vec4 s = texture(uHist, vec3(su, C.x));
  float on = step(uCut, s.a);
  // how deep inside the body: the middle comes forward
  float ins = 0.0;
  for (int k = 0; k < 8; k++) {
    float an = float(k) * 0.785398 + 0.39;
    float rr = (k - (k / 2) * 2) == 0 ? 0.035 : 0.08;
    ins += maskAt(su + vec2(cos(an) / uAspect, sin(an)) * rr, C.x);
  }
  ins /= 8.0;
  float e4 = 0.0;                                                      // close to the edge?
  for (int k = 0; k < 4; k++) { float an = float(k) * 1.5708; e4 += step(uCut, maskAt(su + vec2(cos(an) / uAspect, sin(an)) * 0.012, C.x)); }
  float edge = on * (1.0 - step(3.5, e4));
  if (uOut > 0.5 && uOutSolo > 0.5) on *= edge;                        // outline solo: only the edge of the body
  vec3 c = grade(s.rgb);
  float l = lum(c);
  float z = (pow(ins, 0.8) * 0.8 + l * 0.2) * uDepth;
  vec3 p = vec3((uv - uPiv) * vec2(uAspect, 1.0), z - 0.5 * uDepth);
  // the moves
  vec3 dir = normalize(vec3(h1(aP.z * 91.1) - 0.5, h1(aP.w * 53.7) - 0.5, h1(aP.z * 17.3 + aP.w * 3.1) - 0.5) + 0.0001);
  p += dir * uScat * (0.25 + 0.75 * aP.w);
  float rad = length(p.xy);
  p.z += uWaveA * exp(-pow((rad - uWave * 1.2) * 7.0, 2.0));
  float floorY = 0.02 - uPiv.y;
  p.y = max(p.y - uFall * (0.3 + 0.9 * aP.z), min(p.y, floorY));
  float tw = uSwirl * p.y * 3.0, ct = cos(tw), st = sin(tw);
  p.xz = vec2(ct * p.x - st * p.z, st * p.x + ct * p.z);
  p.xy *= 1.0 + uPulse * (0.3 + 0.7 * aP.w);
  p.z += uPulse * 0.3 * (aP.z - 0.5);
  p.x += sign(p.x) * uSplit * 0.22;
  p.z -= uSplit * 0.15 * abs(p.x) * 4.0;
  p += (vec3(h1(aP.z * 13.0 + uTime), h1(aP.w * 7.0 + uTime), h1(aP.z + aP.w + uTime)) - 0.5) * uJit;
  p *= 1.0 + uBreath;
  // the clouds of other moments stand behind
  p.x += X.x * uAspect;
  p.z += C.y;
  // turn
  float cy = cos(uYaw), sy = sin(uYaw);
  p.xz = vec2(cy * p.x + sy * p.z, -sy * p.x + cy * p.z);
  float cp = cos(uPitch), sp = sin(uPitch);
  p.yz = vec2(cp * p.y - sp * p.z, sp * p.y + cp * p.z);
  // perspective
  float D = 2.2;
  float k = D / max(0.3, D - p.z);
  vec2 scr = uPiv + vec2(p.x * k / uAspect, p.y * k);
  gl_Position = on > 0.5 ? vec4(scr * 2.0 - 1.0, 0.0, 1.0) : vec4(4.0, 4.0, 0.0, 1.0);
  bool lineHere = uOut > 0.5 && edge > 0.5;
  gl_PointSize = on > 0.5 ? max(1.0, uSize * k * (0.75 + 0.5 * l) * (lineHere && uOutSolo < 0.5 ? 1.4 : 1.0)) : 0.0;
  // colour
  vec3 col = c;
  if (uStyle > 0.5 && uStyle < 1.5) col = vec3(0.94, 0.94, 0.92);
  else if (uStyle > 1.5 && uStyle < 2.5) col = mix(vec3(0.22, 0.23, 0.25), vec3(1.0, 0.353, 0.12), smoothstep(0.15, 0.9, ins));
  else if (uStyle > 2.5) col = vec3(1.0, 0.353, 0.12) * (0.55 + 0.6 * l);
  if (uPop > 0.5) col = popOf(c, C.w);
  if (lineHere) col = (uOutStyle > 1.5 && uOutStyle < 2.5) ? popOf(vec3(0.8), C.w + 2.0) : uOutC;
  col = mix(col, vec3(1.0), uFlash);
  col *= clamp(0.55 + 0.45 * k, 0.4, 1.15);                            // further away = darker
  vC = col;
  vA = X.z;
}`;
const PTS_FS = `#version 300 es
precision highp float;
in vec3 vC;
in float vA;
uniform float uShape;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = uShape < 0.5 ? length(q) : (uShape < 1.5 ? max(abs(q.x), abs(q.y)) : max(abs(q.x) * 0.9, abs(q.y) * 3.5));
  float a = 1.0 - smoothstep(0.36, 0.5, d);
  if (a <= 0.01) discard;
  o = vec4(vC, a * vA);
}`;

function initPoints() {
  progPts = program(PTS_VS, PTS_FS);
  // a jittered grid, shuffled: drawing the first n points gives an even spread at any density
  const data = new Float32Array(PMAX * 4);
  let sd = 12345;
  const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const idx = new Uint32Array(PMAX);
  for (let i = 0; i < PMAX; i++) { idx[i] = i; }
  for (let i = PMAX - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  for (let n = 0; n < PMAX; n++) {
    const i = idx[n], cx = i % PCOLS, cy = Math.floor(i / PCOLS);
    data[n * 4] = (cx + rnd()) / PCOLS;
    data[n * 4 + 1] = (cy + rnd()) / PROWS;
    data[n * 4 + 2] = rnd();
    data[n * 4 + 3] = rnd();
  }
  ptsVao = gl.createVertexArray();
  gl.bindVertexArray(ptsVao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
}
function setView(i) {
  const was = viewMode;
  viewMode = ((i % VIEWS.length) + VIEWS.length) % VIEWS.length;
  fxOn.points = viewMode === 1; fxOn.time = viewMode === 2; fxOn.paint = viewMode === 3;
  if (viewMode === 1 && was !== 1) pGather = 1;                        // the cloud arrives scattered and gathers into you
  if (viewMode !== was) {
    if (VIEW_FX[viewMode]) focusFx = VIEW_FX[viewMode];
    else if (focusFx === 'points' || focusFx === 'time' || focusFx === 'paint') focusFx = null;
  }
  if (amtBox) refreshFx();
}
// one move of the cloud
function pointsFire() {
  const k = fireN.points || 0;
  if (k % 4 === 1 || k === 1) { pMove = PMOVES[Math.floor(Math.random() * PMOVES.length)]; pSign = Math.random() < 0.5 ? -1 : 1; }
  if (pMove === 'turn') { pYawTo = (Math.random() < 0.5 ? -1 : 1) * (0.45 + 0.6 * Math.random()) * (0.5 + fxAmt.points); }
  else if (k % 2 === 0) pYawTo = 0;
}
function pointsDrop() { pDropK = 1; pMove = 'scatter'; }
const burstOf = (t) => Math.min(1, (1 - Math.exp(-t * 14)) * Math.exp(-t * 3.2) / 0.62);
const humpOf = (t) => (t >= 1 ? 0 : (t < 0.35 ? Math.sin(t / 0.35 * Math.PI / 2) : 0.5 + 0.5 * Math.cos((t - 0.35) / 0.65 * Math.PI)));
function drawPoints(dtReal, now) {
  if (!progPts || hFill < 1 || !maskReady) return;
  // the box: around the body (glides), the whole screen when nobody is found
  const tgt = STATS.has ? { x0: STATS.x0 - 0.12, y0: STATS.y0 - 0.06, x1: STATS.x1 + 0.12, y1: STATS.y1 + 0.08, cx: STATS.cx, cy: (STATS.y0 + STATS.y1) / 2 }
    : { x0: 0, y0: 0, x1: 1, y1: 1, cx: 0.5, cy: 0.5 };
  const g = pBox.ok ? glide(400, dtReal) : 1;
  for (const kk of ['x0', 'y0', 'x1', 'y1', 'cx', 'cy']) { pBox[kk] += (tgt[kk] - pBox[kk]) * g; }
  pBox.ok = true;
  const bx0 = Math.max(0, pBox.x0), by0 = Math.max(0, pBox.y0), bx1 = Math.min(1, pBox.x1), by1 = Math.min(1, pBox.y1);
  // the clouds: you now, and (clones) earlier moments behind you
  const clouds = [];
  let n = 1;
  if (fxOn.clones) n = 2 + Math.round(fxAmt.clones * 2);
  else if (fxOn.mirror) n = 2;
  const echoN = fxOn.echo ? 1 : 0;
  while (n * (1 + echoN) > 4 && n > 1) n--;
  let lagStep = Math.max(2, Math.round(P.delay * 30));
  if (musicLive() && fxMus.clones && period) lagStep = Math.max(2, Math.round(period / 1000 * 30 * (P.delay > 0.4 ? 1 : 0.5)));
  const spread = 0.2 + 0.6 * P.spread;
  for (let j = 0; j < n; j++) {
    let layer = layerFor(j * lagStep);
    if (fxOn.stutter && j > 0 && stutterLags.length) layer = stutterLags[j % stutterLags.length];
    if (layer < 0) layer = hHead;
    const side = fxOn.clones ? (j === 0 ? 0 : (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 0.16 * spread) : (n === 2 ? (j ? 1 : -1) * 0.18 * spread : 0);
    const dz = fxOn.clones ? -j * 0.45 * spread : 0;
    const mir = fxOn.mirror && (j % 2 === 1) !== mirrorSwap ? 1 : 0;
    const pal = popPal[j] !== undefined ? popPal[j] : j;
    for (let e = echoN; e >= 1; e--) {
      const lg = j * lagStep + e * Math.max(3, Math.round(4 + 8 * fxAmt.echo));
      let el2 = layerFor(lg); if (el2 < 0) el2 = hHead;
      clouds.push([el2, dz - 0.06 * e, mir, pal, side, 0.35 * (0.7 + 0.5 * dance('echo') * env('echo'))]);
    }
    clouds.push([layer, dz, mir, pal, side, j === 0 ? 1 : 0.85]);
  }
  ptsClouds = clouds.length;
  pcU.fill(0); pxU.fill(0);
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    pcU[i * 4] = c[0]; pcU[i * 4 + 1] = c[1]; pcU[i * 4 + 2] = c[2]; pcU[i * 4 + 3] = c[3];
    pxU[i * 4] = c[4]; pxU[i * 4 + 2] = c[5];
  }
  // the moves
  const d = dance('points'), amt = fxAmt.points;
  const t = (now - fxLast.points) / Math.max(60, fxDur.points || 500);
  const bt = burstOf(Math.max(0, t)), hp = humpOf(Math.max(0, t));
  const mv = (m) => (pMove === m ? 1 : 0) * (0.25 + 0.75 * d);
  pGather *= Math.pow(0.03, dtReal / 1.6);
  pDropK *= Math.pow(0.03, dtReal / 1.4);
  pYawK += (pYawTo - pYawK) * glide(Math.max(200, (fxDur.points || 500) * 0.8), dtReal);
  const mus = useMusic('points');
  const bass = mus ? sBass * P.sens * d : 0, hi = mus ? (sTreble + sHigh) * 0.5 * P.sens * d : 0;
  const hk = hitK('points'), kick = hk * M.kick, hat = hk * M.hh, lvl = mus ? M.energy : 0.5;
  const yaw = Math.sin(simTime * 0.23) * (0.12 + 0.75 * P.pturn) + pYawK;
  const pitch = Math.sin(simTime * 0.17) * 0.1 * (0.3 + P.pturn) - 0.04 * bass;

  gl.useProgram(progPts);
  const u = progPts.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, histTex); gl.uniform1i(u.uHist, 0);
  gl.uniform4fv(u['uPc[0]'], pcU); gl.uniform4fv(u['uPx[0]'], pxU);
  gl.uniform4f(u.uBox, bx0, by0, bx1, by1);
  gl.uniform2f(u.uPiv, pBox.cx, pBox.cy);
  gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uCut, P.cut); gl.uniform1f(u.uDepth, (0.15 + 0.85 * P.pdepth) * (mus ? 0.6 + 0.7 * lvl : 1));   // louder = deeper
  gl.uniform1f(u.uSize, (0.8 + 5 * P.psize) * dpr * (1 + 0.35 * bass + 0.6 * kick));
  gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
  gl.uniform1f(u.uScat, (0.06 + 0.55 * amt) * bt * mv('scatter') + 0.9 * pGather + 0.7 * pDropK + (0.04 + 0.14 * amt) * kick);   // the kick: a small burst every time
  gl.uniform1f(u.uWave, Math.min(1, Math.max(0, t))); gl.uniform1f(u.uWaveA, t < 1 ? (0.1 + 0.5 * amt) * (1 - t) * mv('wave') : 0);
  gl.uniform1f(u.uFall, hp * (0.2 + 0.9 * amt) * mv('fall'));
  gl.uniform1f(u.uSwirl, Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * (0.4 + 1.6 * amt) * pSign * mv('swirl'));
  gl.uniform1f(u.uPulse, bt * (0.1 + 0.6 * amt) * mv('pulse'));
  gl.uniform1f(u.uSplit, hp * (0.2 + 0.8 * amt) * mv('split'));
  gl.uniform1f(u.uJit, 0.004 + 0.03 * Math.min(1.5, hi) + 0.03 * hat); gl.uniform1f(u.uTime, (frameNo % 251) * 0.913);
  gl.uniform1f(u.uBreath, 0.1 * Math.min(1.5, bass));
  gl.uniform1f(u.uFlash, Math.min(0.55, 0.4 * hk * M.snare));
  gl.uniform1f(u.uStyle, fxVar.points);
  gl.uniform1f(u.uContrast, P.contrast); gl.uniform1f(u.uSat, P.sat);
  gl.uniform1f(u.uPop, fxOn.pop ? 1 : 0); gl.uniform1f(u.uPalShift, palShift);
  if (fxOn.pop || fxOn.outline) {
    const pal = []; for (const tr of POPS[fxVar.pop].c) { for (const c of tr) { u3(pal, c); } }
    gl.uniform3fv(u['uPal[0]'], pal);
  }
  gl.uniform1f(u.uOut, fxOn.outline ? 1 : 0); gl.uniform1f(u.uOutSolo, outSolo ? 1 : 0); gl.uniform1f(u.uOutStyle, fxVar.outline);
  const oc = fxVar.outline === 1 ? [1, 0.353, 0.12] : fxVar.outline === 3 ? [0.04, 0.04, 0.04] : [0.94, 0.94, 0.92];
  gl.uniform3f(u.uOutC, oc[0], oc[1], oc[2]);
  gl.uniform1f(u.uShape, fxOn.dots ? fxVar.dots : 0);
  const per = Math.min(PMAX, Math.floor(PMAX * (0.12 + 0.88 * Math.pow(P.pdens, 1.3))), Math.floor(120000 / clouds.length));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(ptsVao);
  gl.drawArraysInstanced(gl.POINTS, 0, per, clouds.length);
  gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
}

// ---------------------------------------------------------------- time: every place on the screen shows a different moment
// The last two seconds are kept; the top of the screen can be now and the bottom a second ago (or across, in rings from the
// body, in bands, in a wave), so whatever moves stretches and bends through time. On the beat it moves: flip (now and then
// swap ends), shift (the moments slide along), sweep (they run through the screen for the whole move), pump (reaches
// further back for a moment), snap (snaps to now, then stretches out again). A new kind of move every bar.
const TMOVES = ['flip', 'shift', 'sweep', 'pump', 'snap', 'shift', 'flip', 'sweep'];
let tMove = 'shift', tFlip = 0, tFlipTo = 0, tPhase = 0, tPhaseTo = 0, tAuto = 0;
function timeFire() {
  const k = fireN.time || 0;
  if (k % 4 === 1 || k === 1) tMove = TMOVES[Math.floor(Math.random() * TMOVES.length)];
  if (k % 8 === 0) tAuto = (tAuto + 1) % 5;
  if (tMove === 'flip') tFlipTo = tFlipTo > 0.5 ? 0 : 1;
  else if (tMove === 'shift') tPhaseTo += Math.random() < 0.5 ? 0.25 : -0.25;
}
function timeUniforms(u, dtReal, now) {
  const d = dance('time'), amt = fxAmt.time;
  const t = Math.max(0, (now - fxLast.time) / Math.max(60, fxDur.time || 500));
  const mv = (m) => (tMove === m ? 1 : 0) * (0.25 + 0.75 * d);
  const g = glide(Math.max(150, (fxDur.time || 500) * 0.6), dtReal);
  tFlip += (tFlipTo - tFlip) * g;
  tPhase += (tPhaseTo - tPhase) * g;
  if (Math.abs(tPhase) > 8) { tPhase -= Math.trunc(tPhase); tPhaseTo -= Math.trunc(tPhaseTo); }
  const sweep = tMove === 'sweep' ? Math.min(1, t) * mv('sweep') : 0;
  const mus = useMusic('time');
  const bass = mus ? sBass * P.sens * d : 0;
  const hk = hitK('time');
  let span = 6 + 52 * amt;
  if (mus) span *= 0.55 + 0.6 * M.energy;                                // quiet = close to now, loud = reaches far back
  span *= 1 - 0.55 * hk * M.kick;                                       // the kick: pulls to now for a moment
  span *= 1 + 0.25 * Math.min(1.5, bass) + 0.8 * burstOf(t) * mv('pump') - 0.92 * humpOf(t) * mv('snap');
  span = Math.max(0, Math.min(hFill - 1, span));
  const st = fxVar.time === 5 ? tAuto : fxVar.time;
  gl.uniform1f(u.uTimeOn, 1); gl.uniform1f(u.uHead, hHead); gl.uniform1f(u.uHN, HN);
  gl.uniform1f(u.uSpan, span); gl.uniform1f(u.uTStyle, st);
  gl.uniform1f(u.uTPhase, ((tPhase + sweep + 0.012 * hk * M.hh * Math.sin(frameNo * 2.7)) % 1 + 1) % 1);   // hats: a shiver gl.uniform1f(u.uTFlip, tFlip);
  gl.uniform2f(u.uTPiv, STATS.has ? STATS.cx : 0.5, STATS.has ? (STATS.y0 + STATS.y1) / 2 : 0.5);
}

// ---------------------------------------------------------------- paint: your body is the brush, the screen is the canvas
// What moves leaves paint, and the marks stay (from a few seconds to for ever, menu · paint · how long it stays) and build
// up into a picture over the song. Brush (style): ink (soft strokes that bleed), spray (grains), line (clean lines along your
// edge), smear (the wet canvas is dragged along as you move). The sound: kick = a splash out from the body, snare = the
// brush changes colour, hi-hats = speckle, bass = a wider brush, loudness = how wet the paint is and how much flows.
// On the beat the canvas itself moves: drift, turn, pull (flows out from the middle), push (flows in), wash (fades),
// still. A drop wipes the canvas and throws a big splash on the clean one. Double tap or 'clear' wipes it by hand.
const PAINT_COLS = ['camera', 'white', 'black', 'orange', 'palette'];
let paintCol = 0, paintCI = 0, paintWipe = false, paintFlash = 0;
let paintTex = [null, null], paintFbo = [null, null], paintCur = 0, progPaint = null;
const PNMOVES = ['drift', 'turn', 'pull', 'still', 'push', 'drift', 'wash', 'turn'];
let pnMove = 'still', pnDir = [0, 0], pnSign = 1, pnSplash = 0, pnLastCx = -1, pnLastCy = -1;
const pnVel = [0, 0];

const PAINT_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUv;
uniform sampler2D uPrevP;
uniform sampler2DArray uHist;
uniform float uL0, uL1;                          // the newest moment and the one before (for what moves)
uniform float uAspect, uCut, uKeep, uStyle, uWidth, uFlow, uWet, uSeed, uSplash, uSpeck, uFlashW, uCamCol, uWipe;
uniform float uContrast, uSat, uRot, uZoom, uHW;
uniform vec2 uCtr, uDrift, uVel;
uniform vec3 uBrush;
out vec4 o;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 grade(vec3 c) { c = (c - 0.5) * uContrast + 0.5; return clamp(mix(vec3(lum(c)), c, uSat), 0.0, 1.0); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float mk(vec2 u) { return step(uCut, texture(uHist, vec3(u, uL0)).a); }
void main() {
  // the canvas moves (the beat), turning and flowing round the middle of the body
  vec2 q = (vUv - uCtr) * vec2(uAspect, 1.0);
  float c = cos(uRot), s = sin(uRot);
  q = mat2(c, -s, s, c) * q / uZoom;
  vec2 pu = q / vec2(uAspect, 1.0) + uCtr - uDrift;
  vec4 now = texture(uHist, vec3(vUv, uL0)), was = texture(uHist, vec3(vUv, uL1));
  float m = step(uCut, now.a);
  // around the body: for the splash, and for smear
  float halo = 0.0, rr = 0.025 + 0.06 * uSplash;
  for (int k = 0; k < 8; k++) { float an = float(k) * 0.785398 + 0.2; halo += mk(vUv + vec2(cos(an) / uAspect, sin(an)) * rr); }
  halo /= 8.0;
  if (uStyle > 2.5) pu -= uVel * max(m, halo) * 1.2;                  // smear: the paint is dragged along with you
  vec4 prev = texture(uPrevP, pu);
  if (uWet > 0.01) {                                                   // wet paint bleeds
    vec2 px = vec2(1.0 / uHW / uAspect, 1.0 / uHW) * (1.0 + 2.0 * uWet);
    vec4 av = (texture(uPrevP, pu + vec2(px.x, 0.0)) + texture(uPrevP, pu - vec2(px.x, 0.0)) + texture(uPrevP, pu + vec2(0.0, px.y)) + texture(uPrevP, pu - vec2(0.0, px.y))) * 0.25;
    prev = mix(prev, max(prev, av), 0.35 * uWet);
  }
  // the edge of the body and what moves
  vec2 e = vec2(uWidth / uAspect, uWidth);
  float edge = abs(mk(vUv + vec2(e.x, 0.0)) - mk(vUv - vec2(e.x, 0.0))) + abs(mk(vUv + vec2(0.0, e.y)) - mk(vUv - vec2(0.0, e.y)));
  edge = clamp(edge, 0.0, 1.0);
  float mo = clamp(length(now.rgb - was.rgb) * 2.2 + abs(now.a - was.a) * 2.0, 0.0, 1.0) * max(m, step(uCut, was.a));
  float n1 = h2(vUv * 1013.0 + uSeed), n2 = h2(vUv * 733.0 + uSeed * 1.7);
  float dep;
  if (uStyle < 0.5) dep = smoothstep(0.08, 0.38, mo) * 0.55 + edge * 0.2 * smoothstep(0.02, 0.2, mo);   // ink
  else if (uStyle < 1.5) dep = step(n1, (smoothstep(0.07, 0.33, mo) * 0.7 + edge * 0.25) * 0.55);         // spray
  else if (uStyle < 2.5) dep = edge * (0.25 + 0.75 * smoothstep(0.02, 0.25, mo));                      // line
  else dep = smoothstep(0.08, 0.38, mo) * 0.3 + edge * 0.1;                                             // smear
  dep = max(dep, step(n2, halo * (1.0 - m) * uSplash * 0.6));         // the kick: a splash out from the body
  dep = max(dep, step(1.0 - uSpeck * 0.012, n1) * max(m, halo));       // hi-hats: speckle
  dep = clamp(dep * uFlow, 0.0, 1.0);
  vec3 col = uCamCol > 0.5 ? grade(now.rgb) : uBrush;
  col = mix(col, vec3(1.0), uFlashW);
  vec4 nw = vec4(col * dep + prev.rgb * (1.0 - dep), dep + prev.a * (1.0 - dep));
  nw = floor(nw * uKeep * 255.0 + h2(vUv * 517.0 + uSeed * 3.1)) / 255.0;   // fading, dithered (slow fades still work)
  if (uWipe > 0.5) nw = vec4(0.0);
  o = nw;
}`;

function initPaint() { progPaint = program(QUAD_VS, PAINT_FS); }
function buildPaint() {
  for (let i = 0; i < 2; i++) {
    if (paintTex[i]) gl.deleteTexture(paintTex[i]);
    if (paintFbo[i]) gl.deleteFramebuffer(paintFbo[i]);
    paintTex[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, paintTex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    paintFbo[i] = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, paintFbo[i]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paintTex[i], 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function setPaintCol(i) { paintCol = ((i % PAINT_COLS.length) + PAINT_COLS.length) % PAINT_COLS.length; if (amtBox) refreshFx(); }
function paintClear() { paintWipe = true; }
// one move of the canvas
function paintFire() {
  const k = fireN.paint || 0;
  if (k % 4 === 1 || k === 1) { pnMove = PNMOVES[Math.floor(Math.random() * PNMOVES.length)]; pnSign = Math.random() < 0.5 ? -1 : 1; }
  const a = Math.random() * Math.PI * 2;
  pnDir = [Math.cos(a), Math.sin(a)];
}
function paintSnare() { paintCI++; paintFlash = 1; }
function paintDrop() { paintWipe = true; pnSplash = 1.6; }
function paintBrush() {
  if (paintCol === 1) return [0.94, 0.94, 0.92];
  if (paintCol === 2) return [0.04, 0.04, 0.04];
  if (paintCol === 3) return [1, 0.353, 0.12];
  const t = POPS[fxVar.pop].c[paintCI % 6], cc = t[paintCI % 2 ? 2 : 1];   // palette: the pop colours, the next one on every snare
  return [cc[0] / 255, cc[1] / 255, cc[2] / 255];
}
function paintStep(dtReal, now) {
  if (!progPaint || !paintTex[0] || hFill < 2 || !maskReady || frozen) { if (paintWipe && paintTex[0]) { buildPaint(); paintWipe = false; } return; }
  const d = dance('paint'), amt = fxAmt.paint, mus = useMusic('paint'), hk = hitK('paint');
  const t = Math.max(0, (now - fxLast.paint) / Math.max(60, fxDur.paint || 500));
  const sw = t < 1 ? Math.sin(Math.PI * t) * (0.25 + 0.75 * d) : 0;      // how much the canvas moves now (over the move)
  const k60 = dtReal * 60;
  const bass = mus ? sBass * P.sens * d : 0, lvl = mus ? M.energy : 0.6;
  // the body's own movement, for smear
  const cx = STATS.has ? STATS.cx : 0.5, cy = STATS.has ? (STATS.y0 + STATS.y1) / 2 : 0.5;
  if (pnLastCx >= 0) { pnVel[0] += ((cx - pnLastCx) - pnVel[0]) * 0.3; pnVel[1] += ((cy - pnLastCy) - pnVel[1]) * 0.3; }
  pnLastCx = cx; pnLastCy = cy;
  pnSplash = Math.max(pnSplash * Math.pow(0.85, k60), hk * M.kick);
  paintFlash *= Math.pow(0.8, k60);
  // fading: 0.5 s to 2 minutes, the far right = for ever
  let keep = P.pstay >= 0.99 ? 1 : Math.exp(-dtReal / (0.5 * Math.pow(240, P.pstay)));
  if (pnMove === 'wash') keep *= Math.exp(-dtReal * 1.6 * sw);
  const nxt = 1 - paintCur;
  gl.bindFramebuffer(gl.FRAMEBUFFER, paintFbo[nxt]);
  gl.viewport(0, 0, W, H);
  gl.useProgram(progPaint);
  const u = progPaint.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, paintTex[paintCur]); gl.uniform1i(u.uPrevP, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, histTex); gl.uniform1i(u.uHist, 1);
  gl.uniform1f(u.uL0, hHead); gl.uniform1f(u.uL1, (hHead - 1 + HN) % HN);
  gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uCut, P.cut); gl.uniform1f(u.uKeep, keep);
  gl.uniform1f(u.uStyle, fxVar.paint);
  gl.uniform1f(u.uWidth, (1.2 + 3 * amt) * (1 + 1.2 * Math.min(1.5, bass)) / hH);   // bass: a wider brush
  gl.uniform1f(u.uFlow, (0.35 + 0.9 * amt) * (mus ? 0.5 + 0.8 * lvl : 1) * Math.min(1, k60));
  gl.uniform1f(u.uWet, (fxVar.paint === 0 ? 0.8 : 0.25) * (mus ? 0.3 + 0.9 * lvl : 0.6));   // louder = wetter
  gl.uniform1f(u.uSeed, (frameNo % 997) * 0.731);
  gl.uniform1f(u.uSplash, Math.min(1.6, pnSplash));
  gl.uniform1f(u.uSpeck, mus ? hk * M.hh + 0.4 * sTreble * d : 0);
  gl.uniform1f(u.uFlashW, paintCol === 0 ? 0.6 * paintFlash * hk : 0);
  gl.uniform1f(u.uCamCol, paintCol === 0 ? 1 : 0);
  const br = paintBrush(); gl.uniform3f(u.uBrush, br[0], br[1], br[2]);
  gl.uniform1f(u.uWipe, paintWipe ? 1 : 0);
  gl.uniform1f(u.uContrast, P.contrast); gl.uniform1f(u.uSat, P.sat);
  const sp = (0.3 + amt) * sw * dtReal;
  gl.uniform1f(u.uRot, pnMove === 'turn' ? pnSign * 0.35 * sp : 0);
  gl.uniform1f(u.uZoom, pnMove === 'pull' ? 1 + 0.25 * sp : pnMove === 'push' ? 1 - 0.2 * sp : 1);
  gl.uniform2f(u.uDrift, pnMove === 'drift' ? pnDir[0] * 0.08 * sp / aspect : 0, pnMove === 'drift' ? pnDir[1] * 0.08 * sp : 0);
  gl.uniform2f(u.uVel, pnVel[0], pnVel[1]);
  gl.uniform2f(u.uCtr, cx, cy);
  gl.uniform1f(u.uHW, hH);
  gl.bindVertexArray(quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  paintCur = nxt; paintWipe = false;
}

// ---------------------------------------------------------------- one frame
let flashNow = 0;
const u3 = (a, c) => a.push(c[0] / 255, c[1] / 255, c[2] / 255);
function renderFrame() {
  const now = performance.now();
  const dtReal = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
  lastT = now;
  const k60 = dtReal * 60;
  updateFps(dtReal);
  listen(k60);
  musicStep(k60);
  watchBeats();
  updateTween();
  updateReadouts();
  if (!glOk) return;
  resize();
  fxOn.points = viewMode === 1; fxOn.time = viewMode === 2; fxOn.paint = viewMode === 3;
  simTime += dtReal * (frozen ? 0.04 : 1);
  if (!frozen) {
    uploadCamera(now);
    if (cutMode === 0) runAI(now);
    analyse(now);
  }
  const sc = camScale(), flip = camFacing === 'user' ? 1 : 0;

  // 1. history: every new camera frame, with its cut-out
  if (camNew && maskReady) {
    hHead = (hHead + 1) % HN;
    hFill = Math.min(HN, hFill + 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, histFbo);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, histTex, 0, hHead);
    gl.viewport(0, 0, hW, hH);
    gl.useProgram(progHist);
    const uh = progHist.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, camTex); gl.uniform1i(uh.uCam, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(uh.uMask, 1);
    gl.uniform2f(uh.uScale, sc[0], sc[1]); gl.uniform1f(uh.uFlip, flip);
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (viewMode === 3 && camReady) paintStep(dtReal, now);             // paint: the canvas first
  // 2. compose
  buildCopies(dtReal);
  const nxt = 1 - cmpCur;
  gl.bindFramebuffer(gl.FRAMEBUFFER, cmpFbo[nxt]);
  gl.viewport(0, 0, W, H);
  gl.useProgram(progCmp);
  const u = progCmp.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, histTex); gl.uniform1i(u.uHist, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, camTex); gl.uniform1i(u.uCam, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(u.uMask, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, cmpTex[cmpCur]); gl.uniform1i(u.uPrev, 3);
  gl.uniform2f(u.uScale, sc[0], sc[1]); gl.uniform1f(u.uFlip, flip);
  gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uAspect, aspect);
  // nobody found yet (or no camera): the copies are drawn only once there is a cut-out
  gl.uniform1f(u.uN, maskReady && camReady ? (viewMode === 0 ? copyN : ((viewMode === 2 && hFill > 1) || (viewMode === 3 && P.pbody > 0.01) ? 1 : 0)) : 0);   // points: the cloud is drawn instead · time: one of you, through time
  if (viewMode === 2 && hFill > 1) timeUniforms(u, dtReal, now); else gl.uniform1f(u.uTimeOn, 0);
  gl.uniform1f(u.uHN, HN);
  gl.uniform1f(u.uPaintOn, viewMode === 3 && paintTex[0] ? 1 : 0); gl.uniform1f(u.uPBody, P.pbody);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, paintTex[paintCur]); gl.uniform1i(u.uPaint, 4);
  gl.uniform4fv(u['uCl[0]'], clU); gl.uniform4fv(u['uCm[0]'], cmU);
  gl.uniform1f(u.uCut, P.cut); gl.uniform1f(u.uSoft, P.soft);
  const bg = BGS[bgMode];
  gl.uniform1f(u.uBg, bgMode === 0 ? 0 : (bgMode === 1 ? 1 : 2)); gl.uniform1f(u.uBgDim, P.bgdim);
  const bc = bg[1] || [0, 0, 0];
  gl.uniform3f(u.uBgC, bc[0] / 255, bc[1] / 255, bc[2] / 255);
  gl.uniform1f(u.uContrast, P.contrast); gl.uniform1f(u.uSat, P.sat);
  gl.uniform1f(u.uPop, fxOn.pop ? 1 : 0); gl.uniform1f(u.uPalShift, palShift);
  if (fxOn.pop || fxOn.outline) {
    const pal = []; for (const t of POPS[fxVar.pop].c) { for (const c of t) { u3(pal, c); } }
    gl.uniform3fv(u['uPal[0]'], pal);
  }
  gl.uniform1f(u.uOut, fxOn.outline ? 1 : 0);
  gl.uniform1f(u.uOutW, (1.5 + 4 * fxAmt.outline) * dpr * 0.5 * (1 + 0.8 * dance('outline') * env('outline') + 1.2 * hitK('outline') * M.kick));
  gl.uniform1f(u.uOutStyle, fxVar.outline);
  gl.uniform1f(u.uOutSolo, outSolo ? 1 : 0);
  const oc = fxVar.outline === 1 ? [1, 0.353, 0.12] : fxVar.outline === 3 ? [0.04, 0.04, 0.04] : [0.94, 0.94, 0.92];
  gl.uniform3f(u.uOutC, oc[0], oc[1], oc[2]);
  gl.uniform1f(u.uDots, fxOn.dots ? 1 : 0); gl.uniform1f(u.uDotN, 30 + 90 * (1 - fxAmt.dots)); gl.uniform1f(u.uDotStyle, fxVar.dots); gl.uniform1f(u.uDotCol, dotCol);
  gl.uniform1f(u.uDotK, 1 + 0.6 * dance('dots') * env('dots') + 0.45 * hitK('dots') * M.kick + 0.25 * hitK('dots') * M.hh);
  const gh = fxOn.ghost ? Math.min(0.97, (0.75 + 0.2 * fxAmt.ghost) * (1 - 0.3 * dance('ghost') * env('ghost'))) : 0;
  gl.uniform1f(u.uGhost, Math.pow(gh, Math.max(1, k60))); gl.uniform1f(u.uPrevOK, clearNow ? 0 : 1);
  const lead = viewLead();
  flashNow = lead ? Math.min(0.55, 0.4 * hitK(lead) * M.snare) : 0;
  gl.uniform1f(u.uFlash, viewMode === 1 ? 0 : flashNow);
  gl.bindVertexArray(quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (viewMode === 1 && camReady) drawPoints(dtReal, now);
  gl.bindVertexArray(quadVao);
  cmpCur = nxt; clearNow = false;

  // 3. the HUD and the screen
  const hudUp = hudOn();
  if (hudUp) drawHud(now, k60);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(progShow);
  const us = progShow.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cmpTex[cmpCur]); gl.uniform1i(us.uCmp, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, hudTex); gl.uniform1i(us.uHud, 1);
  gl.uniform1f(us.uHudOn, hudUp ? 1 : 0); gl.uniform1f(us.uGrain, P.grain + (soundOn() ? 0.35 * accent() * M.hh * (0.3 + 0.7 * M.gain) : 0));   // hi-hats: a tick of grain gl.uniform1f(us.uTime, (frameNo % 97) * 0.37);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  frameNo++;
}

// ---------------------------------------------------------------- midi: learn any control (Chrome / Edge on a computer, Chrome on Android,
// or a browser app with Web MIDI on the iPhone; Safari has no MIDI). Press learn, tap a control on the screen, move a knob or press a pad.
const midi = { access: null, on: false, learn: false, map: {}, target: null, prev: {}, ok: !!navigator.requestMIDIAccess };
const ACTIONS = {
  'act:hit': () => hitBeat(),
  'act:freeze': () => setFrozen(!frozen),
  'act:react': () => setReact(reactMode + 1),
  'act:bg': () => setBg(bgMode + 1),
  'act:camera': () => flipCamera(),
  'act:cut': () => setCut(cutMode + 1),
  'act:learnbg': () => learnBackground(),
  'act:music': () => togglePlay(),
  'act:rec': () => toggleRecord(),
  'act:hide': () => setHidden(!hidden),
  'act:panic': () => panic(),
  'act:random': () => randomLook(),
  'act:view0': () => setView(0), 'act:view1': () => setView(1), 'act:view2': () => setView(2), 'act:view3': () => setView(3), 'act:pcol': () => setPaintCol(paintCol + 1), 'act:pclear': () => paintClear(), 'act:dotcol': () => setDotCol(dotCol + 1),
  'act:solo': () => setSolo(!outSolo),
  'act:style': () => { const f = focusFx && VARIANTS[focusFx] ? focusFx : 'clones'; setVar(f, fxVar[f] + 1); },
  'act:rate': () => { if (focusFx) { fxRate[focusFx] = (fxRate[focusFx] + 1) % RATES.length; refreshFx(); } },
  'act:look0': () => recallLook(0), 'act:look1': () => recallLook(1), 'act:look2': () => recallLook(2), 'act:look3': () => recallLook(3),
};
function midiTag(elm, id) { if (elm) elm.dataset.mid = id; return elm; }
async function toggleMidi() {
  if (!midi.ok) { note('this browser has no midi (safari) · use chrome on a computer or android'); midiRefresh(); return; }
  if (midi.access) { midi.on = !midi.on; midiRefresh(); return; }
  if (B.midi) B.midi.textContent = 'midi · …';
  try {
    midi.access = await navigator.requestMIDIAccess();
    midi.on = true;
    const hook = () => { for (const inp of midi.access.inputs.values()) { inp.onmidimessage = onMidi; } midiRefresh(); };
    midi.access.onstatechange = hook;
    hook();
  } catch (e) { if (B.midi) B.midi.textContent = 'midi · blocked'; }
}
function midiRefresh() {
  if (!B.midi) return;
  const n = midi.access ? Array.from(midi.access.inputs.values()).length : 0;
  B.midi.textContent = !midi.ok ? 'midi · not in this browser' : (midi.on ? 'midi · on · ' + n + ' in' : 'midi · off');
  setOn(B.midi, midi.on);
  setOn(B.learn, midi.learn);
  B.learn.textContent = midi.learn ? 'learn · done' : 'learn';
  const cnt = Object.keys(midi.map).length;
  if (B.midiNote) B.midiNote.textContent = cnt + ' controls mapped' + (midi.ok ? (midi.on ? '' : ' · midi is off') : ' · (safari has no midi: the mapping waits for a browser that has it)');
}
function toggleLearn() {
  if (!midi.ok) { note('this browser has no midi'); return; }
  if (!midi.on) toggleMidi();
  midi.learn = !midi.learn;
  if (!midi.learn) midi.target = null;
  document.body.classList.toggle('learning', midi.learn);
  document.querySelectorAll('.pick').forEach((e) => e.classList.remove('pick'));
  if (midi.learn) note('learn: tap a control, then move a knob or press a pad');
  midiRefresh();
}
function onMidi(ev) {
  if (!midi.on) return;
  const d = ev.data;
  if (!d || d.length < 2) return;
  const st = d[0] & 0xf0, d1 = d[1], d2 = d.length > 2 ? d[2] : 0;
  let mkey = null, v = 0;
  if (st === 0xb0) { mkey = 'cc:' + d1; v = d2 / 127; }
  else if (st === 0x90 && d2 > 0) { mkey = 'n:' + d1; v = 1; }
  else if (st === 0x80 || (st === 0x90 && d2 === 0)) { mkey = 'n:' + d1; v = 0; }   // a pad let go (for hold)
  else return;
  if (midi.learn) {
    if (midi.target && v > 0) {
      midi.map[mkey] = midi.target;
      store('midi', midi.map);
      note('mapped · ' + midi.target.replace(':', ' · '));
      midi.target = null;
      document.querySelectorAll('.pick').forEach((e) => e.classList.remove('pick'));
      midiRefresh();
    }
    return;
  }
  const id = midi.map[mkey];
  if (id) { try { runTarget(id, v, mkey); } catch (e) { /* a stale mapping must never stop the show */ } }
}
function runTarget(id, v, mkey) {
  const p = id.indexOf(':'), kind = id.slice(0, p), name = id.slice(p + 1);
  const isNote = mkey.charAt(0) === 'n';
  const trig = () => {                                                  // a knob counts as a button when it crosses the middle
    const was = midi.prev[mkey] || 0;
    midi.prev[mkey] = v;
    return isNote ? v > 0 : (was < 0.5 && v >= 0.5);
  };
  if (kind === 'sl' && SL[name]) {                                      // a slider of the menu
    const s = SL[name].input, lo = parseFloat(s.min), hi = parseFloat(s.max);
    P[name] = lo + v * (hi - lo); tween = null;
  } else if (kind === 'fa' && FX_ALL.includes(name)) { fxAmt[name] = v; refreshFx(); }        // an effect's amount
  else if (kind === 'fd' && FX_ALL.includes(name)) { fxDance[name] = v; refreshFx(); }       // an effect's dance
  else if (kind === 'fx' && FX.includes(name)) {                       // an effect: pad = on / off (held long = only while held)
    if (isNote) {
      if (v > 0) { midi.prev['t' + mkey] = performance.now(); midi.prev['w' + mkey] = fxOn[name]; fxOn[name] = !fxOn[name]; focusFx = name; refreshFx(); }
      else if (performance.now() - (midi.prev['t' + mkey] || 0) > 350) { fxOn[name] = midi.prev['w' + mkey]; refreshFx(); }
    } else if (trig()) { fxOn[name] = !fxOn[name]; refreshFx(); }
  } else if (kind === 'act' && id === 'act:hit') {                     // hit: a pad held keeps hitting on the tempo
    if (isNote) { if (v > 0) { hitBeat(); hitHeld = true; hitT = performance.now(); } else hitHeld = false; }
    else if (trig()) hitBeat();
  } else if (kind === 'act' && ACTIONS[id]) { if (trig()) ACTIONS[id](); }
}
// while learning, a tap on a control picks it instead of using it
function setupLearnCapture() {
  for (const evn of ['pointerdown', 'pointerup', 'click', 'mousedown', 'touchstart', 'input']) {
    document.addEventListener(evn, (e) => {
      if (!midi.learn) return;
      const t = e.target.closest ? e.target.closest('[data-mid]') : null;
      if (!t || t.dataset.mid === 'act:learn') return;                 // the learn button itself, the menu and its tabs keep working
      e.stopPropagation(); e.preventDefault();
      if (evn !== 'pointerdown') return;
      midi.target = t.dataset.mid;
      document.querySelectorAll('.pick').forEach((x) => x.classList.remove('pick'));
      t.classList.add('pick');
      const m = /^fx:(.+)$/.exec(midi.target);
      if (m) { focusFx = m[1]; peek = true; refreshFx(); }             // so its amount and dance can be picked next
      note('now move a knob or press a pad');
    }, true);
  }
}
// auto quality: if the frame rate stays low, draw at a lower resolution
let fpsAvg = 60, qCheck = 0, autoQ = true;
function updateFps(dt) {
  fpsAvg += (1 / Math.max(dt, 0.001) - fpsAvg) * 0.05;
  if (!autoQ || ++qCheck % 120 !== 0) return;
  if (fpsAvg < 40 && resScale > 0.5) { setRes(resScale === 1 ? 0.75 : 0.5); note('auto quality · resolution ' + Math.round(resScale * 100) + '%'); }
}
function setRes(r) {
  resScale = r; W = 0;
  if (B.res) B.res.textContent = 'resolution · ' + Math.round(resScale * 100) + '%';
}

// ---------------------------------------------------------------- touch on the picture
// tap = a hit (a beat by hand) · drag left / right = space between the copies · drag up / down = their size
function setupTouch() {
  const pts = new Map();
  let downT = 0, moved = 0, lastTap = 0, sp0 = 0, sz0 = 0, x0 = 0, y0 = 0;
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pts.set(e.pointerId, 1);
    downT = performance.now(); moved = 0; x0 = e.clientX; y0 = e.clientY; sp0 = P.spread; sz0 = P.size;
    keepAwake();
    if (!camOn) startCamera();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const dx = (e.clientX - x0) / window.innerWidth, dy = (y0 - e.clientY) / window.innerHeight;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    if (moved < 0.03) return;
    P.spread = Math.min(1, Math.max(0, sp0 + dx * 1.5)); P.size = Math.min(1.6, Math.max(0.4, sz0 + dy * 1.5)); tween = null;
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    const now = performance.now();
    if (now - downT < 260 && moved < 0.03) {
      if (now - lastTap < 330) { clearNow = true; if (viewMode === 3) paintClear(); lastTap = 0; }      // double tap: clear the ghost trails (and the paint)
      else { hitBeat(); lastTap = now; }
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// ---------------------------------------------------------------- interface
const B = {};
const SL = {};
let meter = null;
let bar, dock, menu, amtBox, amtLabel, amtVal, amtSlider, noteEl, restoreBtn, hidden = false, focusFx = null, peek = false;
const CSS = `
#bar,#dock,#menu,#note,#restore{position:fixed;z-index:10;font:10px/1.2 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.09em;
  text-transform:uppercase;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#bar{left:0;right:0;top:0;padding-top:env(safe-area-inset-top,0px);display:flex;flex-wrap:wrap;gap:1px;background:#23262a;border-bottom:1px solid #34373c}
#bar button,#dock button,#menu button{background:rgba(13,14,16,.9);color:#b9bdc2;border:0;border-radius:0;font:inherit;letter-spacing:inherit;
  text-transform:inherit;cursor:pointer;touch-action:manipulation}
#bar button{flex:1 1 18%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:7px 4px 8px;text-align:center}
#bar button small{display:block;font-size:8px;letter-spacing:.14em;color:#5a5f65;margin-bottom:3px}
#bar button.on,#dock button.on,#menu button.on{background:#ff5a1f;color:#0d0e10}
#bar button.on small{color:#0d0e10;opacity:.6}
#dock{left:0;right:0;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none}
#dock>*{pointer-events:auto}
#dock .pg{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:#23262a;border-top:1px solid #34373c}
#dock .pg.fx7{grid-template-columns:repeat(7,1fr)}
#dock .pg.fx8{grid-template-columns:repeat(8,1fr)}
#dock .pg.fx2{grid-template-columns:repeat(2,1fr)}
#dock .pg.fx3{grid-template-columns:repeat(3,1fr)}
#dock .pg.fx4{grid-template-columns:repeat(4,1fr)}
#dock button.hitpad{color:#ff5a1f}
#dock button.hitpad.on{color:#0d0e10}
#dock button{position:relative;padding:14px 2px 12px;text-align:center;overflow:hidden;white-space:nowrap;touch-action:none}
#dock button.focus{box-shadow:inset 0 2px 0 #e8eaec}
#dock button.has{box-shadow:inset 0 -2px 0 #e8eaec}
#dock button.cur{color:#ff5a1f;box-shadow:inset 0 -2px 0 #ff5a1f}
#dock button.on.hit{background:#ffd2bf}
#dock .meter{position:absolute;left:0;bottom:0;height:2px;background:#ff5a1f}
#dock button.on .meter{background:#0d0e10}
#vu{height:3px;background:#ff5a1f;width:0;transition:width .05s linear;pointer-events:none}
#snd{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#23262a;border-top:1px solid #34373c;pointer-events:none}
#snd span{background:rgba(13,14,16,.9);color:#5a5f65;font-size:8px;letter-spacing:.14em;text-align:center;padding:2px 0 3px;text-transform:uppercase}
#amt{background:rgba(13,14,16,.92);border-top:1px solid #34373c;padding:8px 12px 6px;color:#8b9096;display:none;touch-action:none}
#amt .top,#menu .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
#amt .val,#menu .val{color:#e8eaec}
#amt .top{gap:8px}
#amt .top span:first-child{flex:1}
#dock #amt button.mpal{background:#0d0e10;color:#e8eaec;border:1px solid #34373c;padding:5px 8px;touch-action:manipulation;letter-spacing:.06em}
#dock button.long{letter-spacing:.01em}
#dock button.prt{padding:7px 2px 6px;line-height:1.35;font-size:9px}
#menu{left:0;top:calc(82px + env(safe-area-inset-top,0px));width:min(270px,92vw);max-height:calc(100vh - 230px);overflow-y:auto;background:rgba(13,14,16,.94);color:#8b9096;
  border-right:1px solid #34373c;border-bottom:1px solid #34373c;display:none;touch-action:pan-y}
#menu .tabs{display:flex;gap:1px;background:#23262a;position:sticky;top:0;z-index:2}
#menu .tabs button{flex:1;min-width:0;padding:9px 0;color:#8b9096}
#menu .tabs button.on{background:#1b1d20;color:#ff5a1f;box-shadow:inset 0 -2px 0 #ff5a1f}
#menu .sec{padding:9px 10px 5px;color:#5a5f65;border-top:1px solid #23262a}
#menu .row{padding:7px 10px 6px}
#menu .btns{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#23262a}
#menu .btns button{text-align:left;padding:9px 10px}
#menu .full{grid-column:1 / -1}
#menu .note{padding:6px 10px 9px;line-height:1.7;letter-spacing:.04em}
#menu input[type=file]{width:100%;font:inherit;color:#8b9096;text-transform:none;padding:7px 10px;box-sizing:border-box}
#menu input[type=file]::file-selector-button{background:#0d0e10;color:#b9bdc2;border:1px solid #34373c;border-radius:0;padding:6px 8px;margin-right:8px;font:inherit;text-transform:uppercase}
input[type=range].r{-webkit-appearance:none;appearance:none;display:block;width:100%;height:18px;margin:0;background:transparent}
#amt input[type=range].r{height:44px;touch-action:none}
#amt .mrow{border-top:1px solid #23262a;padding-top:6px}
#amt .mrow input[type=range].r{height:34px}
input[type=range].r::-webkit-slider-runnable-track{height:1px;background:#52565c}
input[type=range].r::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:18px;margin-top:-9px;background:#e8eaec;border:0;border-radius:0}
#amt input[type=range].r::-webkit-slider-thumb{width:12px;height:26px;margin-top:-13px}
input[type=range].r::-moz-range-track{height:1px;background:#52565c}
input[type=range].r::-moz-range-thumb{width:9px;height:18px;background:#e8eaec;border:0;border-radius:0}
#note{left:12px;bottom:150px;color:#ff5a1f;opacity:0;transition:opacity .4s;pointer-events:none;text-shadow:0 0 6px #000}
#restore{right:8px;top:calc(8px + env(safe-area-inset-top,0px));width:30px;height:30px;display:none;background:rgba(13,14,16,.5);color:#b9bdc2;border:1px solid #34373c;opacity:.35;padding:0}
body.learning [data-mid]{outline:1px dashed rgba(255,90,31,.7);outline-offset:-2px}
body.learning .pick{outline:2px solid #ff5a1f !important}
#fatal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;color:#e8eaec;
  font:12px/1.6 ui-monospace,Menlo,monospace;background:#0d0e10;z-index:20}
`;
function el(tag, cls, parent, label) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (label !== undefined) e.textContent = label;
  if (parent) parent.appendChild(e);
  return e;
}
function setLabel(b, cap, val) {
  const h = '<small>' + cap + '</small>' + val;
  if (b.__h !== h) { b.innerHTML = h; b.__h = h; }
}
function setOn(b, on) { if (b) b.classList.toggle('on', !!on); }
let noteT = null;
function note(t) {
  if (!noteEl) return;
  noteEl.textContent = t;
  noteEl.style.opacity = 1;
  clearTimeout(noteT);
  noteT = setTimeout(() => { noteEl.style.opacity = 0; }, 2400);
}

function buildUI() {
  const st = el('style', '', document.head);
  st.textContent = CSS;
  bar = el('div', '', document.body); bar.id = 'bar';
  const bt = (skey, cap, val, fn) => {
    const b = el('button', '', bar);
    setLabel(b, cap, val);
    b.addEventListener('click', fn);
    B[skey] = b;
    if (['camera', 'cut', 'music', 'rec', 'react', 'bg', 'hide'].includes(skey)) midiTag(b, 'act:' + skey);
    return b;
  };
  bt('camera', 'camera', 'start', () => { keepAwake(); if (camOn) flipCamera(); else startCamera(); });
  bt('cut', 'cut', 'ai', () => setCut(cutMode + 1));
  bt('music', 'music', 'play', () => { keepAwake(); togglePlay(); });
  bt('mic', 'mic', 'off', () => { keepAwake(); toggleMic(); });
  bt('rec', 'rec', 'start', toggleRecord);
  bt('beat', 'bpm', 'auto', () => { bcToggle(); refreshTop(); });
  bt('react', 'react', 'groove', () => setReact(reactMode + 1));
  bt('bg', 'bg', 'dim', () => setBg(bgMode + 1));
  bt('hide', 'ui', 'hide', () => setHidden(true));
  bt('menu', 'menu', 'open', () => openMenu(menu.style.display === 'block' ? null : 'look'));

  noteEl = el('div', '', document.body); noteEl.id = 'note';
  restoreBtn = el('button', '', document.body, '+'); restoreBtn.id = 'restore';
  restoreBtn.addEventListener('click', () => setHidden(false));

  // dock
  dock = el('div', '', document.body); dock.id = 'dock';
  amtBox = el('div', '', dock); amtBox.id = 'amt';
  const top = el('div', 'top', amtBox);
  amtLabel = el('span', '', top); amtVal = el('span', 'val', top);
  B.fmus = el('button', 'mpal', top, 'music · on');
  B.fmus.addEventListener('click', () => { if (focusFx) { fxMus[focusFx] = !fxMus[focusFx]; refreshFx(); } });
  B.mpal = el('button', 'mpal', top, 'style');                       // the style of the selected effect (colours, kind of screen)
  B.mpal.addEventListener('click', () => { if (focusFx) setVar(focusFx, fxVar[focusFx] + 1); });
  B.solo = el('button', 'mpal', top, 'together');                     // outline only: the line alone, or the line over the body
  B.solo.addEventListener('click', () => setSolo(!outSolo));
  B.dcol = el('button', 'mpal', top, 'colour · camera');               // dots only: their colour (the style button is their shape)
  B.dcol.addEventListener('click', () => setDotCol(dotCol + 1));
  B.pcol = el('button', 'mpal', top, 'colour · camera');               // paint only: the colour of the brush, and wiping the canvas
  B.pcol.addEventListener('click', () => setPaintCol(paintCol + 1));
  B.pclr = el('button', 'mpal', top, 'clear');
  B.pclr.addEventListener('click', () => paintClear());
  amtSlider = el('input', 'r', amtBox);
  amtSlider.type = 'range'; amtSlider.min = 0; amtSlider.max = 1; amtSlider.step = 0.01;
  amtSlider.addEventListener('input', () => { if (focusFx) { fxAmt[focusFx] = parseFloat(amtSlider.value); refreshFx(); } });
  B.drow = el('div', 'mrow', amtBox);                                  // how much the music moves it, and how often it moves
  const dt0 = el('div', 'top', B.drow);
  el('span', '', dt0, 'dance · still ←→ full groove');
  B.danceVal = el('span', 'val', dt0);
  B.rate = el('button', 'mpal', dt0, 'every 1 beat');
  B.rate.addEventListener('click', () => { if (focusFx) { fxRate[focusFx] = (fxRate[focusFx] + 1) % RATES.length; refreshFx(); } });
  B.dance = el('input', 'r', B.drow);
  B.dance.type = 'range'; B.dance.min = 0; B.dance.max = 1; B.dance.step = 0.01;
  B.dance.addEventListener('input', () => { if (focusFx) { fxDance[focusFx] = parseFloat(B.dance.value); B.danceVal.textContent = fxDance[focusFx].toFixed(2); } });
  B.snd = el('div', '', dock); B.snd.id = 'snd';                          // what the app hears: the hits it finds, and whether it has the beat
  for (const nm of ['kick', 'snare', 'hat', 'beat']) { B['snd_' + nm] = el('span', '', B.snd, nm); }
  meter = el('div', '', dock); meter.id = 'vu';
  const vr = el('div', 'pg fx4', dock);                               // the view: copies of you, or you as a cloud of points
  for (let i = 0; i < VIEWS.length; i++) {
    const b = el('button', '', vr, VIEWS[i]);
    midiTag(b, 'act:view' + i);
    b.addEventListener('click', () => { if (viewMode === i && VIEW_FX[i]) { focusFx = VIEW_FX[i]; refreshFx(); } else setView(i); });
    B['view' + i] = b;
  }
  const pg = el('div', 'pg fx7', dock);
  for (const f of FX) { if (f !== 'points' && f !== 'time' && f !== 'paint') B['fx_' + f] = holdButton(f, pg); }
  const lr = el('div', 'pg fx7', dock);
  for (let i = 0; i < 4; i++) { B['look' + i] = lookButton(i, lr); }
  B.hit = hitButton(lr);
  B.freeze = el('button', '', lr, 'freeze'); B.freeze.addEventListener('click', () => setFrozen(!frozen)); midiTag(B.freeze, 'act:freeze');
  const rb = el('button', '', lr, 'rnd'); midiTag(rb, 'act:random'); rb.addEventListener('click', randomLook);

  // menu
  menu = el('div', '', document.body); menu.id = 'menu';
  const tabs = el('div', 'tabs', menu);
  const panes = {};
  for (const n of ['look', 'source', 'perf', 'help']) {
    const b = el('button', '', tabs, n);
    b.addEventListener('click', () => openMenu(n));
    B['tab_' + n] = b;
    panes[n] = el('div', '', menu);
  }
  B.panes = panes;
  // look
  el('div', 'sec', panes.look, 'beat clock');
  const gbc = el('div', 'btns', panes.look);
  const tb = el('button', '', gbc, 'tap tempo'); tb.addEventListener('click', () => { bcTap(performance.now()); refreshTop(); });
  const ab = el('button', '', gbc, 'auto / off'); ab.addEventListener('click', () => { bcToggle(); refreshTop(); });
  el('div', 'note', panes.look, 'auto: finds the tempo of the music by itself (shown on the bpm button) · tap: set it by hand · off: react to bass hits only');
  el('div', 'sec', panes.look, 'react to the music');
  const grr = el('div', 'btns', panes.look);
  grr.style.gridTemplateColumns = '1fr 1fr 1fr';
  B.reactBtns = REACTS.map((n, i) => { const b = el('button', '', grr, n); b.addEventListener('click', () => setReact(i)); return b; });
  el('div', 'note', panes.look, 'calm: only the energy of the song (quiet parts soft, loud parts full) · groove: plus kick = movement, snare = breaks, highs = texture · wild: all of it, stronger, changes twice as often. the amount of each effect is its maximum. every 4 beats a bigger change, a drop = one big moment, a breakdown slows down');
  el('div', 'sec', panes.look, 'settings');
  for (const s of SLIDERS) { addSlider(panes.look, s); }
  const gl1 = el('div', 'btns', panes.look);
  const rl = el('button', '', gl1, 'random look'); rl.addEventListener('click', randomLook); midiTag(rl, 'act:random');
  const rs = el('button', '', gl1, 'reset settings');
  rs.addEventListener('click', () => { applySettings(PDEF); });
  // source
  el('div', 'sec', panes.source, 'camera');
  const gc = el('div', 'btns', panes.source);
  B.cam = el('button', 'full', gc, 'camera · start');
  B.cam.addEventListener('click', () => { if (camOn) flipCamera(); else startCamera(); });
  el('div', 'sec', panes.source, 'finding the person (cut)');
  const gk = el('div', 'btns', panes.source);
  B.cutBtns = CUTS.map((n, i) => { const b = el('button', '', gk, n); b.addEventListener('click', () => setCut(i)); return b; });
  B.learnbg = el('button', '', gk, 'learn background'); B.learnbg.addEventListener('click', learnBackground); midiTag(B.learnbg, 'act:learnbg');
  B.aiInfo = el('div', 'note', panes.source, '');
  el('div', 'note', panes.source, 'ai: a small model in the browser finds the person (downloaded the first time, then kept for offline) · key: step out of the picture, learn the empty background, step back in · motion: whatever moves (no setup, rough edges, a still person fades) · the cut-out slider (menu · look) makes it looser or tighter');
  el('div', 'sec', panes.source, 'music file');
  const fm = el('input', '', panes.source); fm.type = 'file';   // no type filter: iPhone greys out some music files otherwise
  fm.addEventListener('change', () => { if (fm.files[0]) handleMusic(fm.files[0]); fm.value = ''; });
  musicInput = fm;
  musicLabel = el('div', 'note', panes.source, 'no music loaded · tap music in the top bar, or choose a file here');
  // perf
  el('div', 'sec', panes.perf, 'performance');
  const gp = el('div', 'btns', panes.perf);
  B.auto = el('button', 'full on', gp, 'auto quality · on');
  B.auto.addEventListener('click', () => { autoQ = !autoQ; B.auto.textContent = 'auto quality · ' + (autoQ ? 'on' : 'off'); setOn(B.auto, autoQ); });
  B.res = el('button', '', gp, 'resolution · 100%');
  B.res.addEventListener('click', () => setRes(resScale === 1 ? 0.75 : (resScale === 0.75 ? 0.5 : 1)));
  B.lift = el('button', 'full', gp, 'dock lift · 0 px');
  B.lift.addEventListener('click', () => { const sts = [0, 40, 84, 130]; setLift(sts[(sts.indexOf(dockLift) + 1) % sts.length]); store('lift', dockLift); });
  B.fs = el('button', '', gp, 'full screen');
  B.fs.addEventListener('click', goFullscreen);
  B.fps = el('div', 'note', panes.perf, '');
  el('div', 'sec', panes.perf, 'midi');
  const gmid = el('div', 'btns', panes.perf);
  B.midi = el('button', 'full', gmid, 'midi · off'); B.midi.addEventListener('click', toggleMidi);
  B.learn = el('button', '', gmid, 'learn'); B.learn.addEventListener('click', toggleLearn); midiTag(B.learn, 'act:learn');
  const clr = el('button', '', gmid, 'clear mapping'); clr.addEventListener('click', () => { midi.map = {}; store('midi', {}); midiRefresh(); note('midi mapping cleared'); });
  B.midiNote = el('div', 'note', panes.perf, '');
  el('div', 'note', panes.perf, 'chrome or edge on a computer, chrome on android, or a browser app with web midi on the iphone (safari has no midi). press learn, tap any control (an effect, its amount bar or dance, a slider, hit, print, a look…), then move a knob or press a pad. press learn again to finish. pads: tap = on / off, hold = only while held · hit held = keeps hitting.');
  // help
  el('div', 'note', panes.help).innerHTML = 'camera · start, then tap to flip front / back · cut · how the person is found: ai, key or motion (menu · source)<br>bg · what is behind the copies: camera, dim, black, paper, orange<br>tap on the picture · a hit (a beat by hand) · double tap · clear the ghost trails and the paint · drag left / right · space between the copies · drag up / down · their size<br><br>dock: tap = on / off · hold = only while held, drag up / down for the amount (or a 2nd finger on the amount bar)<br>the amount bar: amount · dance = how much the beat moves it · every ½ / 1 / 2 / 4 beats = how often it moves · music on / off · style<br><br>BODY<br>clones · copies of you, each one a moment later · style: fan (overlapping, older ones behind), stack (piled up), row (side by side, always all on screen), grid, ring, auto (changes by itself) · amount = how many (2-7) · on the beat they dance: step along, step back, swap two, mirror the order, shuffle, gather into one body, burst apart (a new kind of move every bar) · with music the time between copies locks to the beat (a canon: each copy repeats your move a beat later), quiet parts show fewer copies, the bass makes them breathe · space between = drag left / right<br>echo · fading copies trailing behind each one<br>mirror · every other copy mirrored (with clones off: you and your mirror image)<br>pop · each copy in its own flat stage colours, changing on the beat · colours: stage, fire, acid, cold, mono<br>outline · a line along the edge of the body · colour: white, orange, colour (follows the pop colours), black · solo / together: the line alone, or the line drawn over the body (and over pop, dots, clones)<br>ghost · bright parts leave trails<br>dots · the body as a screen of dots, lines or squares · shape: round, square, lines · colour: camera, white, orange, black · everything stacks: pop colours the dots, outline draws over them, echo and clones copy the whole stack<br>stutter · on the beat the copies freeze on other moments<br><br>POINTS (copies / points / time / paint, above the effects)<br>points · you as a cloud of dots with depth: the middle of the body comes forward, the edges fall back, and it turns slowly · on the beat it moves: scatter (blown apart, gathering back into you), wave (a ripple through the depth), turn (swings round to show the side), fall (drops to the floor and climbs back), swirl (twists round its height), pulse (breathes out), split (opens down the middle) · a new kind of move every bar, every 2 beats to start with · a drop blows it apart · tap points again for its amount bar: amount = how far it moves, colour: camera, white, depth (orange comes forward), orange · menu: how many, size, depth, turning by itself<br>the effects work on the cloud too: clones = clouds of earlier moments standing behind you, mirror = a mirrored cloud, echo = a faint cloud a moment later, stutter = the clouds jump to other moments, pop = stage colours, outline = the edge of the body (solo: only the edge), dots = the shape of each point (round, square, lines), ghost = trails, and the whole HUD<br><br>TIME<br>time · every place on the screen shows a different moment of the last two seconds, so what moves stretches and bends · style: down (the top is now, lower is earlier), across, rings (out from the body), bands (steps of time), wave, auto · amount = how far back · on the beat: flip (now and earlier swap ends), shift (the moments slide), sweep (they run through the screen), pump (reaches further back), snap (back to now, then stretches out again) · with the camera background the whole picture runs through time, with the others only you do · pop, outline, dots, ghost and the HUD work on it too<br><br>PAINT<br>paint · your body is the brush and the screen is the canvas: what moves leaves paint, and the marks stay and build up over the song · brush: ink (soft strokes that bleed), spray (grains), line (clean lines along your edge), smear (the wet canvas is dragged along with you) · colour: camera, white, black, orange, palette (the pop colours, the next one on every snare) · clear (or double tap) wipes the canvas · amount = brush strength · menu: how long it stays (right = for ever), how much of you is seen · the sound: kick = a splash out from the body, snare = the brush changes colour, hi-hats = speckle, bass = a wider brush, loudness = how wet it is and how much flows · on the beat the canvas moves: drift, turn, pull (flows out from you), push (flows in), wash (fades), still · a drop wipes the canvas and throws a big splash on the clean one · the background button is the colour of the canvas; pop, outline and dots work on you over it<br><br>HUD<br>track · boxes that lock on to what moves, with coordinates · style: boxes, crosshairs<br>body · a box around the person, the centre and the head<br>lines · a dotted constellation linking the tracked points<br>scan · a line sweeping across, once per move · style: down, across<br>grid · a measuring grid and rulers<br>data · readouts: frame, camera, cut, bpm, beat, the sound bands<br><br>the groove: every effect moves on the beat of the music (or the drift tempo without music), each move lasting until the next · react (top bar): calm = half as often, groove, wild = twice as often<br>the sound, on top of the groove: kick = a punch straight away (copies jolt bigger and apart, the cloud bursts, time pulls to now, outlines and dots thicken) · snare / clap = a white flash on the body, the cloud jerks round, time jumps · hi-hats = a tick of grain, the dots shiver · bass = size and breathing · loudness = how much of everything (quiet = calm, loud = full; the cloud deeper, time reaching further back) · ambient without drums: the drift tempo follows the loudness, and a swell (the sound growing) makes a slow move of its own · react calm = no hits, wild = harder hits · the strip above the effects shows what it hears: kick, snare, hat, and the beat (or: no beat · loudness)<br><br>looks 1-4 · tap = recall, hold = save · hit · a beat by hand (hold = keeps hitting) · freeze · holds everything · rnd · random look<br><br>midi (menu · perf) · learn any control · chrome / edge / android, not safari<br><br>keys: q w e r t y u = clones echo mirror pop outline ghost dots · a s d g j k l = stutter track body lines scan grid data · enter = hit · p = style · 1-4 looks (shift = save) · z freeze · m react · v background · x copies / points / time / paint · i outline solo / together · o learn background · c camera flip · ; beat clock · b tap tempo · 0 all off · space play · h hide · f full screen · n random';
  for (let i = 0; i < 4; i++) { LOOKS[i] = recall('look' + i); }
  const rm = recall('react'); if (Number.isInteger(rm) && rm >= 0 && rm < REACTS.length) reactMode = rm;
  refreshLooks();
  refreshFx();
  initLift();
  bcLoad();
  refreshTop();
  setupKeys();
  midi.map = recall('midi') || {};
  setupLearnCapture();
  midiRefresh();
  window.addEventListener('pointerdown', keepAwake, { once: true });
}

function addSlider(parent, s) {
  const [skey, label, lo, hi, stp, fmt] = s;
  const row = el('div', 'row', parent);
  const top = el('div', 'top', row);
  el('span', '', top, label);
  const val = el('span', 'val', top);
  const inp = el('input', 'r', row);
  midiTag(row, 'sl:' + skey);
  inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = stp; inp.value = P[skey];
  inp.addEventListener('input', () => { P[skey] = parseFloat(inp.value); tween = null; });
  SL[skey] = { input: inp, val, fmt: fmt || ((v) => (+v).toFixed(2)), last: '' };
}
let roTick = 0;
function updateReadouts() {
  if (++roTick % 3) return;
  for (const k in SL) {
    const r = SL[k], v = P[k];
    if (document.activeElement !== r.input && Math.abs(parseFloat(r.input.value) - v) > 1e-6) r.input.value = v;
    const t = r.fmt(v);
    if (t !== r.last) { r.val.textContent = t; r.last = t; }
  }
  const tnow = performance.now();
  for (const f of FX) { const b = B['fx_' + f]; if (b) b.classList.toggle('hit', fxOn[f] && tnow - (fxHit[f] || -1e9) < 130); }
  if (B.beat && roTick % 15 === 0) { setLabel(B.beat, 'bpm', bcLabel()); setOn(B.beat, bcActive()); }
  if (meter) {                                                       // the thin orange line above the dock = what the music is doing
    const lv = soundOn() ? Math.min(1, M.energy * 0.85 + M.kick * 0.15) : 0;      // the energy, with a nudge on every kick
    meter.style.width = Math.round(lv * 100) + '%';
    meter.style.opacity = M.kick > 0.6 || M.snare > 0.6 ? 1 : 0.55;
  }
  if (B.snd) {
    const on = soundOn();
    B.snd.style.display = on ? '' : 'none';
    if (on) {
      const lit = (e, v) => { const a = Math.min(1, v); e.style.background = a > 0.05 ? 'rgba(255,90,31,' + (0.25 + 0.75 * a).toFixed(2) + ')' : ''; e.style.color = a > 0.4 ? '#0d0e10' : ''; };
      lit(B.snd_kick, M.kick); lit(B.snd_snare, M.snare); lit(B.snd_hat, M.hh);
      const live = musicLive();
      B.snd_beat.textContent = live ? 'beat · ' + Math.round(60000 / period) : 'no beat · loudness';
      lit(B.snd_beat, live ? pulse * 0.8 : 0);
    }
  }
  if (recState === 'recording') {
    const t = Math.floor((performance.now() - recStart) / 1000);
    setLabel(B.rec, 'rec', 'stop ' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  }
  if (B.fps && menu.style.display === 'block') B.fps.textContent = Math.round(fpsAvg) + ' fps · ' + W + ' × ' + H + ' px';
  if (B.aiInfo && roTick % 30 === 0) B.aiInfo.textContent = 'ai model · ' + aiState + (aiState === 'failed' ? ' · ' + aiFail : '') + ' · background · ' + (bgKey ? 'learned' : 'not learned');
}

// the p5 editor on a phone puts its own toolbar over the bottom of the page: lift the dock above it
let dockLift = 0;
function setLift(px) {
  dockLift = px;
  dock.style.paddingBottom = 'calc(env(safe-area-inset-bottom, 0px) + ' + px + 'px)';
  noteEl.style.bottom = (150 + px) + 'px';
  if (B.lift) B.lift.textContent = 'dock lift · ' + px + ' px';
}
function initLift() {
  let v = recall('lift');
  if (!Number.isFinite(v)) {
    let inEditor = false;
    try {
      const anc = location.ancestorOrigins ? Array.from(location.ancestorOrigins).join(' ') : '';
      inEditor = window.self !== window.top && /p5js\.org/.test(document.referrer + ' ' + anc);
    } catch (e) { inEditor = false; }
    v = inEditor ? 84 : 0;
  }
  setLift(v);
}

function openMenu(tab) {
  if (!tab) { menu.style.display = 'none'; setLabel(B.menu, 'menu', 'open'); setOn(B.menu, false); return; }
  menu.style.display = 'block';
  setLabel(B.menu, 'menu', 'close'); setOn(B.menu, true);
  for (const n in B.panes) {
    B.panes[n].style.display = n === tab ? 'block' : 'none';
    setOn(B['tab_' + n], n === tab);
  }
}

function flipCamera() { camFacing = camFacing === 'user' ? 'environment' : 'user'; bgKey = null; startCamera(); }
function setBg(i) { bgMode = (i + BGS.length) % BGS.length; refreshTop(); }
function setFrozen(v) { frozen = v; refreshTop(); }
function setDotCol(i) { dotCol = ((i % DOT_COLS.length) + DOT_COLS.length) % DOT_COLS.length; if (amtBox) refreshFx(); }
function setSolo(v) { outSolo = !!v; if (amtBox) refreshFx(); }
function setVar(f, i) {
  const vs = VARIANTS[f];
  if (!vs) return;
  fxVar[f] = (i + vs.length) % vs.length;
  if (amtBox) refreshFx();
}
function refreshTop() {
  if (!B.camera) return;
  if (B.beat) { setLabel(B.beat, 'bpm', bcLabel()); setOn(B.beat, bcActive()); }
  setLabel(B.camera, 'camera', camOn ? (camFacing === 'user' ? 'front' : 'back') : 'start');
  setLabel(B.cut, 'cut', cutMode === 0 ? (aiState === 'on' ? 'ai' : (aiState === 'loading' ? 'ai …' : (aiState === 'failed' ? 'ai ✕' : 'ai'))) : CUTS[cutMode] + (cutMode === 1 && !bgKey ? ' ?' : ''));
  setLabel(B.bg, 'bg', BGS[bgMode][0]);
  setOn(B.freeze, frozen);
  if (B.react) { setLabel(B.react, 'react', REACTS[reactMode]); setOn(B.react, reactMode === 2); }
  if (B.reactBtns) B.reactBtns.forEach((b, i) => setOn(b, i === reactMode));
  if (B.cutBtns) B.cutBtns.forEach((b, i) => setOn(b, i === cutMode));
  if (B.cam) B.cam.textContent = camOn ? 'camera · ' + (camFacing === 'user' ? 'front · tap to flip' : 'back · tap to flip') : 'camera · start';
}

// dock buttons: tap = on / off, hold = only while held (drag up / down = amount)
function holdButton(name, parent) {
  const b = el('button', '', parent, FX_LABEL[name] || name);
  midiTag(b, 'fx:' + name);
  if ((FX_LABEL[name] || name).length > 7) b.classList.add('long');
  const m = el('i', 'meter', b);
  b.meter = m;
  let timer = null, held = false, prev = false, y0 = 0, a0 = 0, pressed = false;
  b.addEventListener('pointerdown', (e) => {
    pressed = true; held = false; prev = fxOn[name]; y0 = e.clientY; a0 = fxAmt[name];
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    focusFx = name; peek = true; refreshFx();
    clearTimeout(timer);
    timer = setTimeout(() => { held = true; fxOn[name] = true; refreshFx(); }, 300);
  });
  b.addEventListener('pointermove', (e) => {
    if (!held) return;
    fxAmt[name] = Math.min(1, Math.max(0, a0 + (y0 - e.clientY) / 160));
    refreshFx();
  });
  const end = (cancel) => {
    clearTimeout(timer);
    if (!pressed) return;
    pressed = false; peek = false;
    if (held) { fxOn[name] = prev; }
    else if (!cancel) fxOn[name] = !fxOn[name];
    if (!fxOn[name] && focusFx === name) focusFx = null;
    refreshFx();
  };
  b.addEventListener('pointerup', () => end(false));
  b.addEventListener('pointercancel', () => end(true));
  return b;
}
function refreshFx() {
  for (const f of FX) {
    const b = B['fx_' + f];
    if (!b) continue;
    setOn(b, fxOn[f]);
    b.classList.toggle('focus', focusFx === f);
    b.meter.style.width = Math.round(fxAmt[f] * 100) + '%';
  }
  for (let i = 0; i < VIEWS.length; i++) { if (B['view' + i]) setOn(B['view' + i], viewMode === i); }
  const show = focusFx && (fxOn[focusFx] || peek);
  amtBox.style.display = show ? 'block' : 'none';
  if (show) {
    amtLabel.textContent = focusFx === 'points' ? 'points · how far it moves' : focusFx === 'time' ? 'time · how far back' : focusFx === 'paint' ? 'paint · brush strength' : focusFx + ' · amount';
    midiTag(amtSlider, 'fa:' + focusFx); midiTag(B.drow, 'fd:' + focusFx);
    midiTag(B.rate, 'act:rate'); midiTag(B.mpal, 'act:style'); midiTag(B.solo, 'act:solo');
    B.solo.style.display = focusFx === 'outline' ? '' : 'none';
    B.pcol.style.display = B.pclr.style.display = focusFx === 'paint' ? '' : 'none';
    B.pcol.textContent = 'colour · ' + PAINT_COLS[paintCol]; midiTag(B.pcol, 'act:pcol'); midiTag(B.pclr, 'act:pclear');
    B.dcol.style.display = focusFx === 'dots' ? '' : 'none'; B.dcol.textContent = 'colour · ' + DOT_COLS[dotCol]; midiTag(B.dcol, 'act:dotcol');
    B.solo.textContent = outSolo ? 'solo · line only' : 'together · line + body'; setOn(B.solo, outSolo);
    const vs = VARIANTS[focusFx];
    B.mpal.style.display = vs ? '' : 'none';
    if (vs) B.mpal.textContent = (focusFx === 'pop' ? 'colours · ' : focusFx === 'outline' || focusFx === 'points' ? 'colour · ' : focusFx === 'dots' ? 'shape · ' : focusFx === 'paint' ? 'brush · ' : 'style · ') + vs[fxVar[focusFx]];
    B.fmus.textContent = 'music · ' + (fxMus[focusFx] ? 'on' : 'off'); setOn(B.fmus, !fxMus[focusFx]);
    B.danceVal.textContent = fxDance[focusFx].toFixed(2);
    if (document.activeElement !== B.dance) B.dance.value = fxDance[focusFx];
    B.rate.textContent = 'every ' + RATE_NAME[fxRate[focusFx]];
    amtVal.textContent = fxAmt[focusFx].toFixed(2);
    if (document.activeElement !== amtSlider) amtSlider.value = fxAmt[focusFx];
  }
}
// the hit pad: tap = a beat by hand for every effect that is on · hold = keeps hitting on the tempo
function hitButton(parent) {
  const b = el('button', 'hitpad', parent, 'hit');
  midiTag(b, 'act:hit');
  b.addEventListener('pointerdown', () => { hitBeat(); hitHeld = true; hitT = performance.now(); setOn(b, true); keepAwake(); });
  const end = () => { hitHeld = false; setOn(b, false); };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  return b;
}
function panic() {
  for (const f of FX) { fxOn[f] = false; }
  focusFx = null;
  setFrozen(false);
  refreshFx();
}

// looks: four saved states
const LOOKS = [null, null, null, null];
let tween = null, curLook = -1;
function snapshot() { return { P: Object.assign({}, P), fxOn: Object.assign({}, fxOn), fxAmt: Object.assign({}, fxAmt), bg: bgMode, vars: Object.assign({}, fxVar), mus: Object.assign({}, fxMus), rate: Object.assign({}, fxRate), dance: Object.assign({}, fxDance), solo: outSolo, view: viewMode, dcol: dotCol, pcol: paintCol }; }
function store(k, v) { try { localStorage.setItem('body_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
function recall(k) { try { const v = localStorage.getItem('body_' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function applySettings(np) {
  const from = {}, to = {};
  for (const k in P) {
    if (np && Number.isFinite(np[k])) { from[k] = P[k]; to[k] = np[k]; }
  }
  tween = { t0: performance.now(), dur: 900, from, to };
}
function updateTween() {
  if (!tween) return;
  const t = Math.min(1, (performance.now() - tween.t0) / tween.dur), e = t * t * (3 - 2 * t);
  for (const k in tween.to) { P[k] = tween.from[k] + (tween.to[k] - tween.from[k]) * e; }
  if (t >= 1) tween = null;
}
function applyLook(o) {
  if (!o) return;
  applySettings(o.P || {});
  for (const f of FX_ALL) {
    if (o.fxOn && typeof o.fxOn[f] === 'boolean') fxOn[f] = o.fxOn[f];
    if (o.fxAmt && Number.isFinite(o.fxAmt[f])) fxAmt[f] = o.fxAmt[f];
  }
  if (Number.isInteger(o.bg) && o.bg >= 0 && o.bg < BGS.length) bgMode = o.bg;
  for (const f of FX_ALL) { if (o.mus && typeof o.mus[f] === 'boolean') fxMus[f] = o.mus[f]; }
  for (const f of FX_ALL) {
    if (o.rate && Number.isInteger(o.rate[f]) && o.rate[f] >= 0 && o.rate[f] < RATES.length) fxRate[f] = o.rate[f];
    if (o.dance && Number.isFinite(o.dance[f])) fxDance[f] = Math.min(1, Math.max(0, o.dance[f]));
  }
  for (const f of FX_ALL) { if (o.vars && Number.isInteger(o.vars[f]) && VARIANTS[f]) fxVar[f] = ((o.vars[f] % VARIANTS[f].length) + VARIANTS[f].length) % VARIANTS[f].length; }
  if (Number.isInteger(o.view)) setView(o.view); else setView(0);
  if (Number.isInteger(o.dcol)) setDotCol(o.dcol); else dotCol = 0;
  if (Number.isInteger(o.pcol)) setPaintCol(o.pcol);
  if (typeof o.solo === 'boolean') outSolo = o.solo;
  else if (o.vars && o.vars.outline === 3) { outSolo = true; fxVar.outline = 0; }   // looks saved with the old 'line only' style
  refreshFx(); refreshTop();
}
function saveLook(i) { LOOKS[i] = snapshot(); store('look' + i, LOOKS[i]); curLook = i; refreshLooks(); note('look ' + (i + 1) + ' saved'); }
function recallLook(i) {
  if (!LOOKS[i]) { note('look ' + (i + 1) + ' is empty · hold to save'); return; }
  applyLook(LOOKS[i]); curLook = i; refreshLooks();
}
function refreshLooks() {
  for (let i = 0; i < 4; i++) {
    const b = B['look' + i];
    if (!b) continue;
    b.classList.toggle('has', !!LOOKS[i]);
    b.classList.toggle('cur', i === curLook);
  }
}
function lookButton(i, parent) {
  const b = el('button', '', parent, String(i + 1));
  midiTag(b, 'act:look' + i);
  let timer = null, pressed = false, saved = false;
  b.addEventListener('pointerdown', () => { pressed = true; saved = false; clearTimeout(timer); timer = setTimeout(() => { saved = true; saveLook(i); }, 600); });
  const end = (cancel) => { clearTimeout(timer); if (!pressed) return; pressed = false; if (!saved && !cancel) recallLook(i); };
  b.addEventListener('pointerup', () => end(false));
  b.addEventListener('pointercancel', () => end(true));
  return b;
}
function randomLook() {
  const r = (a, b) => a + Math.random() * (b - a);
  applySettings({ delay: r(0.08, 0.5), spread: r(0.2, 0.8), size: r(0.8, 1.2), contrast: r(0.95, 1.3), sat: r(0.7, 1.4) });
  for (const f of FX) { fxOn[f] = false; }
  fxOn.clones = Math.random() < 0.75;
  const pool = ['echo', 'mirror', 'pop', 'outline', 'ghost', 'dots', 'stutter'], hudPool = ['track', 'body', 'lines', 'scan', 'grid', 'data'];
  for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) { const f = pool[Math.floor(Math.random() * pool.length)]; fxOn[f] = true; fxAmt[f] = r(0.3, 0.8); }
  for (let i = 0; i < Math.floor(Math.random() * 3); i++) { fxOn[hudPool[Math.floor(Math.random() * hudPool.length)]] = true; }
  if (Math.random() < 0.4) bgMode = Math.floor(Math.random() * BGS.length);
  for (const f in VARIANTS) { if (fxOn[f]) fxVar[f] = Math.floor(Math.random() * VARIANTS[f].length); }
  if (fxOn.outline) outSolo = Math.random() < 0.3;
  refreshFx(); refreshTop();
}

// recording: the picture plus the sound
let rec = null, recChunks = [], recBlob = null, recState = 'idle', recStart = 0;
function toggleRecord() {
  if (recState === 'recording') { rec.stop(); return; }
  if (recState === 'ready') { saveRecording(); return; }
  if (!window.MediaRecorder || !cv.captureStream) { setLabel(B.rec, 'rec', 'n/a'); return; }
  setupAudio();
  actx.resume();
  const stream = cv.captureStream(30);
  recDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
  recChunks = [];
  rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : { videoBitsPerSecond: 8000000 });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  rec.onstop = () => {
    stream.getVideoTracks().forEach((t) => t.stop());
    recBlob = new Blob(recChunks, { type: rec.mimeType || mime || 'video/webm' });
    rec = null; recState = 'ready';
    setLabel(B.rec, 'rec', 'save'); setOn(B.rec, false);
  };
  rec.start(1000);
  recStart = performance.now();
  recState = 'recording';
  setOn(B.rec, true);
}
function saveRecording() {
  const a = el('a', '', document.body);
  a.href = URL.createObjectURL(recBlob);
  a.download = 'body-' + Date.now() + (recBlob.type.includes('mp4') ? '.mp4' : '.webm');
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  recState = 'idle';
  setLabel(B.rec, 'rec', 'start');
}

function setHidden(h) {
  hidden = h;
  bar.style.display = h ? 'none' : '';
  dock.style.display = h ? 'none' : '';
  if (h) menu.style.display = 'none';
  restoreBtn.style.display = h ? 'block' : 'none';
}
function goFullscreen() {
  const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!f) { note('full screen is not available here'); return; }
  if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  try { const pr = f.call(d); if (pr && pr.catch) pr.catch(() => note('full screen is not available here')); } catch (e) { note('full screen is not available here'); }
}
let wake = null;
async function keepAwake() {
  try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); lastT = 0; } });

const KEY_FX = { KeyQ: 'clones', KeyW: 'echo', KeyE: 'mirror', KeyR: 'pop', KeyT: 'outline', KeyY: 'ghost', KeyU: 'dots',
  KeyA: 'stutter', KeyS: 'track', KeyD: 'body', KeyG: 'lines', KeyJ: 'scan', KeyK: 'grid', KeyL: 'data' };
const keyDown = {};
function setupKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target;
    if (tg && tg.tagName === 'INPUT' && tg.type !== 'range') return;
    const c = e.code, f = KEY_FX[c];
    if (f) {
      e.preventDefault();
      if (e.repeat || keyDown[c]) return;
      keyDown[c] = { t: performance.now(), was: fxOn[f] };
      fxOn[f] = true; focusFx = f; refreshFx();
      return;
    }
    if (e.repeat) return;
    if (c === 'KeyH') setHidden(!hidden);
    else if (c === 'Escape') setHidden(false);
    else if (/^Digit[1-4]$/.test(c)) { const i = parseInt(c.slice(5), 10) - 1; if (e.shiftKey) saveLook(i); else recallLook(i); }
    else if (c === 'Digit0' || c === 'Backspace') { e.preventDefault(); panic(); }
    else if (c === 'KeyC') flipCamera();
    else if (c === 'Space') { e.preventDefault(); if (micOn) toggleMic(); else togglePlay(); }
    else if (c === 'KeyF') goFullscreen();
    else if (c === 'KeyN') randomLook();
    else if (c === 'KeyZ') setFrozen(!frozen);
    else if (c === 'KeyO') learnBackground();
    else if (c === 'Enter') { e.preventDefault(); hitBeat(); hitHeld = true; hitT = performance.now(); }
    else if (c === 'KeyM') setReact(reactMode + 1);
    else if (c === 'KeyP') { const f = focusFx && VARIANTS[focusFx] ? focusFx : 'clones'; setVar(f, fxVar[f] + 1); note(f + ' · ' + VARIANTS[f][fxVar[f]]); }
    else if (c === 'KeyV') setBg(bgMode + 1);
    else if (c === 'KeyX') { setView(viewMode + 1); note('view · ' + VIEWS[viewMode]); }
    else if (c === 'KeyI') { setSolo(!outSolo); note('outline · ' + (outSolo ? 'solo' : 'together')); }
    else if (c === 'Semicolon') { bcToggle(); refreshTop(); }
    else if (c === 'KeyB') { bcTap(performance.now()); refreshTop(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Enter') hitHeld = false;
    const kd = keyDown[e.code], f = KEY_FX[e.code];
    if (!kd) return;
    delete keyDown[e.code];
    const held = performance.now() - kd.t > 300;
    if (held) fxOn[f] = kd.was;                  // held: back to how it was
    else fxOn[f] = !kd.was;                      // tapped: switched
    refreshFx();
  });
  window.addEventListener('blur', () => { for (const c in keyDown) { fxOn[KEY_FX[c]] = keyDown[c].was; delete keyDown[c]; } refreshFx(); });
}

// ---------------------------------------------------------------- p5 entry points
function setup() {
  if (typeof noCanvas === 'function') noCanvas();
  try {
    initGL();
    resize();
    buildUI();
    setupTouch();
    fxOn.clones = true; fxOn.pop = true; refreshFx();                // start with something to see
    startCamera();
    if (cutMode === 0) loadAI();
    window.addEventListener('resize', () => { W = 0; });
  } catch (e) {
    glOk = false;
    const f = el('div', '', document.body);
    f.id = 'fatal';
    f.innerHTML = 'BODY needs WebGL2 on the graphics chip.<br><br>' + String(e.message || e).slice(0, 300);
    const st = el('style', '', document.head);
    st.textContent = CSS;
  }
}
let lastErr = '';
function draw() {
  try {
    renderFrame();
  } catch (e) {
    if (e && e.message !== lastErr) { lastErr = e.message; console.error('body error: ' + e.message + ' · ' + String(e.stack || '').split('\n')[0]); }
  }
}
function windowResized() { W = 0; }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
})();
