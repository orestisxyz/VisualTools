// noprotect
(function () {
// INK FIELD · a live audiovisual instrument (sibling of the camera polychoron)
// Thousands of particles flow through swirling currents on the graphics chip and leave ink that slowly fades:
// dense black where they gather, thin grey wisps where few pass. Music makes the core erupt and the flow race.
// Paste into editor.p5js.org (p5 v1 or v2). Needs WebGL2 (any recent iPhone, Android or computer browser).
//
// TOP BAR   source (core, motion, camera, image, field) · ink (colours) · music · mic · rec
//           bpm (beat clock: auto / off) · freeze · mode (ink = particles, lines = the same flow drawn as long lines) · ui (hide) · menu
// DOCK      burst storm swirl ribbons freeze blur strobe / explode implode vortex wind chaos mirror expose
//           (tap = on / off, hold = only while held,
//           drag up / down while holding = amount) · looks 1-4 (tap = recall, hold = save) · rnd · clear
// TOUCH     drag = stir the ink · tap = move the core there and burst · double tap = clear
// SOURCES   core = one dense centre · motion = ink comes out of whatever moves in front of the camera ·
//           camera = the dark parts of the camera picture · image = the dark parts of an uploaded image ·
//           field = everywhere at once
// BEAT      the beat clock finds the tempo by itself and predicts every beat (bpm button: auto / off; menu: tap tempo;
//           keys ; = auto/off, B = tap). Off = it reacts to bass hits, as before. With the clock: a small burst every 16 beats.
// SOUND     the music moves the look sliders (lock any to keep it still). On every beat: the core swells, lines
//           thicken, depth blur and glow flash, the currents lurch and the focus racks to a new depth; every 4th
//           beat the currents change size. Loudness gently sets ink amount and fade. Particles, flow speed,
//           stream out and particle life are never moved by the music, so it cannot get dense or overloaded.
// KEYS      Q W E R T Y U = burst storm swirl ribbons freeze blur strobe · A S D G J K L = explode implode vortex wind chaos mirror expose (hold = while held) · 1-4 looks (shift = save)
//           C clear · 0 everything off · space play · H hide · F full screen · N random look
// Uses p5 only for setup / draw; everything else is plain WebGL2 + Web Audio, inside one function (no name clashes).

const TWO_PI_ = Math.PI * 2;

// ---------------------------------------------------------------- state
const P = {                       // the settings (sliders), all saved in looks
  count: 65536,                   // particles
  speed: 0.55,                    // flow speed
  scale: 1.0,                     // size of the currents (bigger = finer swirls)
  evolve: 0.2,                    // how fast the currents change
  trail: 2.2,                     // seconds the ink takes to fade
  ink: 0.42,                      // how dark each particle draws
  size: 1.2,                      // particle size
  dof: 0.5,                       // depth blur
  focus: 0.0,                     // focus depth
  soft: 0.1,                      // overall softness
  core: 0.1,                      // core size
  out: 0.5,                       // how strongly ink streams out of the core
  life: 3.0,                      // seconds each particle lives
  sens: 1.0,                      // sound sensitivity
};
const PDEF = Object.assign({}, P);
let LINE_K = 0.16;
let INK_K = 0.035, GAIN = 2.6, JETS = 50, JETMIX = 0.82, STREAK_K = 1.0, FLATZ = 0.15;
const SLIDERS = [
  ['count', 'particles', 16384, 262144, 16384, (v) => Math.round(v / 1024) + 'k'],
  ['speed', 'flow speed', 0, 1.5, 0.01],
  ['scale', 'currents · fine ←→ wide', 0.3, 3, 0.01],
  ['evolve', 'currents change', 0, 1.5, 0.01],
  ['trail', 'ink fade · seconds', 0.1, 10, 0.05],
  ['ink', 'ink amount', 0.05, 1.5, 0.01],
  ['size', 'particle size', 0.5, 3, 0.01],
  ['dof', 'depth blur', 0, 1.5, 0.01],
  ['focus', 'focus depth', -1, 1, 0.01],
  ['soft', 'softness', 0, 1, 0.01],
  ['core', 'core size', 0.03, 0.6, 0.01],
  ['out', 'stream out of the core', 0, 1.5, 0.01],
  ['life', 'particle life · seconds', 0.5, 10, 0.1],
  ['sens', 'sound sensitivity', 0.2, 3, 0.01],
];
const SOURCES = ['core', 'motion', 'camera', 'image', 'field'];
const INKS = [
  { name: 'ink', paper: [244, 242, 238], ink: [10, 10, 12] },
  { name: 'night', paper: [6, 6, 8], ink: [236, 232, 224] },
  { name: 'sepia', paper: [239, 231, 216], ink: [56, 34, 18] },
  { name: 'indigo', paper: [236, 239, 245], ink: [18, 30, 80] },
  { name: 'blood', paper: [243, 238, 235], ink: [112, 10, 14] },
  { name: 'neon', paper: [4, 4, 8], ink: [60, 255, 220] },
];
const FX = ['burst', 'storm', 'swirl', 'ribbons', 'freeze', 'blur', 'strobe',
  'explode', 'implode', 'vortex', 'wind', 'chaos', 'mirror', 'exposure'];
const fxOn = {}, fxAmt = {};
for (const f of FX) { fxOn[f] = false; fxAmt[f] = 0.6; }
fxOn.ribbons = true;
fxAmt.freeze = 0.8; fxAmt.strobe = 0.4; fxAmt.mirror = 0.5;
const FX_LABEL = { exposure: 'expose' };
let srcMode = 0, inkMode = 0;
let puffT = 0, beatSeen = false;
let core = { x: 0, y: 0 }, coreTarget = null, burstImpulse = 0, ribbonReset = 1, ribbonCool = 0;
let clearNow = true, frameNo = 0, simTime = 0, lastT = 0;
let touch = { on: false, x: 0, y: 0, vx: 0, vy: 0 };

// ---------------------------------------------------------------- WebGL
let cv, gl, W = 0, H = 0, aspect = 1, dpr = 1, resScale = 1;
let progUpdate, progRender, progStreak, progFade, progShow, vaoStreak = [];
let bufs = [], vaoUp = [], vaoRen = [], tf, cur = 0, N = 0, RIB = 768;
let denTex, denFbo, denW = 0, denH = 0, floatInk = false;
let camTex = [null, null], camIdx = 0, camReady = false, imgTex = null, imgReady = false, imgAspect = 1;
let quadVao;
let drawMode = 'ink', linesSeen = false;
const LT = 160;                                  // points kept per line (its tail)
let NL = 0, lnPos = null, lnVel = null, lnLife = null, lnData = null, lnHead = 0, lnFrame = 1, lnBuf = null, lnVao = null, progLines = null;
let lnBeat = 0, lnBurstUsed = false;
let glOk = true, glError = '';

const UPDATE_VS = `#version 300 es
precision highp float;
precision highp int;
in vec3 aPos; in vec3 aVel; in vec2 aLife;
out vec3 vPos; out vec3 vVel; out vec2 vLife;
uniform float uTime, uDt, uSpeed, uScale, uEvolve, uSwirl, uBurst, uCoreR, uAspect, uRibbonN, uRibbonReset, uSrc, uStorm, uOut, uLife;
uniform float uExplode, uImplode, uVortex, uWind, uChaos;
uniform vec2 uWindDir;
uniform vec2 uCore, uTouch, uTouchVel; uniform float uTouchOn;
uniform sampler2D uCam, uCamPrev; uniform float uCamOn, uMirror; uniform vec2 uCamScale;
uniform int uFrame, uJets;
uniform float uJetMix, uFlatZ, uPuff;

uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(inout uint s) { s = pcg(s); return float(s) * (1.0 / 4294967295.0); }

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
vec3 grad(vec3 p) {
  const float e = 0.06;
  float n = snoise(p);
  return vec3(snoise(p + vec3(e, 0.0, 0.0)) - n, snoise(p + vec3(0.0, e, 0.0)) - n, snoise(p + vec3(0.0, 0.0, e)) - n) / e;
}
// divergence-free flow: the cross product of two noise gradients (smoke-like curls, nothing piles up)
vec3 curl(vec3 p) { return cross(grad(p), grad(p + vec3(31.4, 17.7, 9.2))); }

vec2 camUV(vec2 w) {
  vec2 uv = vec2(0.5 + w.x / uAspect * 0.5 * uCamScale.x, 0.5 - w.y * 0.5 * uCamScale.y);
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  return uv;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// how much ink a spot in the picture gives: motion = change since the last frame, camera / image = darkness
float weightAt(vec2 w) {
  vec2 uv = camUV(w);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec3 c = textureLod(uCam, uv, 0.0).rgb;
  if (uSrc < 1.5) { vec3 q = textureLod(uCamPrev, uv, 0.0).rgb; return smoothstep(0.04, 0.25, abs(lum(c) - lum(q))); }
  return smoothstep(0.35, 0.95, 1.0 - lum(c));
}

void main() {
  int id = gl_VertexID;
  uint s = uint(id) * 9781u + uint(uFrame) * 6271u + 1u;
  vec3 p = aPos; vec3 v = aVel; float life = aLife.x; float seed = aLife.y;
  bool ribbon = float(id) < uRibbonN;

  // the flow
  vec3 np = p * uScale + vec3(0.0, 0.0, uTime * uEvolve * 0.25);
  vec3 flow = curl(np) * uSpeed * (ribbon ? 0.55 : 1.0);
  if (uStorm > 0.0) flow += curl(np * 3.2 + 11.0) * (0.25 + uSpeed) * uStorm * 3.5;   // storm: rough, fast currents
  flow.z *= uFlatZ;                                                       // mostly flat flow keeps neighbours together = streaks
  vec3 d = p - vec3(uCore, 0.0);
  float r = length(d.xy) + 1e-3;
  vec2 rad = d.xy / r;
  flow.xy += vec2(-rad.y, rad.x) * uSwirl * 1.8 / (1.0 + r * r * 2.0);   // swirl: a vortex around the core
  if (uSrc < 0.5) flow.xy += rad * uOut * uSpeed * 1.5 * exp(-r * 0.8);       // ink streams out of the core
  if (uChaos > 0.0) flow += curl(np * 6.0 + 23.0) * (0.3 + uSpeed) * uChaos * 4.0;   // chaos: fine, fast, rough currents
  float hard = uBurst + uExplode + uImplode + uVortex + uWind;
  v = mix(v, flow, 1.0 - exp(-uDt * 3.0 / (1.0 + hard * 3.0)));          // strong effects: the currents give way
  v.xy += rad * uExplode * 5.0 * uDt * (0.6 + exp(-r * 0.5));            // explode: everything blasts outward
  v.xy -= d.xy * uImplode * 12.0 * uDt;                                     // implode: everything is sucked into the core
  v.z *= 1.0 - uImplode * uDt * 3.0;
  v.xy += vec2(-rad.y, rad.x) * uVortex * 9.0 * uDt / (0.3 + r);          // vortex: a whirlpool over the whole screen
  v.xy += uWindDir * uWind * 4.0 * uDt;                                    // wind: everything blown one way
  v.xy += rad * uBurst * 30.0 * exp(-r * 0.7) * uDt;                      // bursts: a shock wave out of the core
  if (uTouchOn > 0.5) {                                                   // stirring with a finger
    vec2 td = p.xy - uTouch; float tf2 = exp(-dot(td, td) * 10.0);
    v.xy = mix(v.xy, uTouchVel * 1.3, clamp(tf2 * uDt * 14.0, 0.0, 1.0));   // the ink near your finger takes its speed at once
    p.xy += uTouchVel * tf2 * uDt * 0.5;                                     // and is dragged along directly
  }
  p += v * uDt;
  p.z = clamp(p.z, -1.2, 1.2);
  life -= uDt / uLife * (0.6 + 0.8 * fract(seed * 7.13)) * (ribbon ? 0.0 : 1.0);

  bool out_ = abs(p.x) > uAspect * 1.35 || abs(p.y) > 1.35;
  // a puff: on a beat (or a burst) some particles are reborn in the core and shot outward = a visible eruption of fresh ink
  if (!ribbon && uPuff > 0.0 && rnd(s) < uPuff * 0.045) {
    float a = rnd(s) * 6.2831853, g = sqrt(-2.0 * log(max(rnd(s), 1e-4))) * uCoreR * 0.5;
    vec2 dir = vec2(cos(a), sin(a));
    p = vec3(uCore + dir * g, (rnd(s) - 0.5) * 0.6);
    v = vec3(dir * (0.6 + rnd(s) * 1.6) * (0.5 + uPuff), 0.0);
    life = 0.5 + rnd(s) * 0.5;
    seed = 10.0 + rnd(s);                                                   // marks a puff particle (drawn darker while young)
    out_ = false;
  }
  if (ribbon) {
    if (uRibbonReset > 0.5) {                                             // a new ribbon: a line of particles near the core
      float t = float(id) / max(uRibbonN - 1.0, 1.0);
      uint rs = uint(uFrame) * 131u + 7u;
      float a = rnd(rs) * 6.2831853, len = 0.25 + rnd(rs) * 0.55, bend = (rnd(rs) - 0.5) * 0.6;
      vec2 dir = vec2(cos(a), sin(a)), nrm = vec2(-dir.y, dir.x);
      p = vec3(uCore + dir * (t - 0.5) * len + nrm * sin(t * 3.14159) * bend, (rnd(rs) - 0.5) * 0.4 + t * 0.2);
      v = vec3(0.0);
      life = 1.0;
    }
  } else if (life <= 0.0 || out_) {
    // reborn somewhere new
    float pick = rnd(s);
    vec2 np2 = vec2((rnd(s) * 2.0 - 1.0) * uAspect * 1.1, rnd(s) * 2.0 - 1.0);
    bool ok = true;
    float jz = 99.0;
    if (uSrc < 0.5) {                                                      // core: jets of ink that follow the same currents = streaks
      if (pick < uJetMix) {
        uint js = uint(id % uJets) * 2654435761u + 77u;                   // each particle belongs to one jet
        float ja = rnd(js) * 6.2831853 + uTime * (rnd(js) - 0.5) * 0.25;
        float jr = (0.15 + 0.85 * rnd(js)) * uCoreR;
        jz = (rnd(js) - 0.5) * 1.1;
        np2 = uCore + vec2(cos(ja), sin(ja)) * jr + vec2(rnd(s) - 0.5, rnd(s) - 0.5) * 0.006;
      } else if (pick < 0.985) {                                           // the dense heart
        float u1 = max(rnd(s), 1e-4), u2 = rnd(s);
        float g = sqrt(-2.0 * log(u1)) * uCoreR * 0.45;
        np2 = uCore + vec2(cos(u2 * 6.2831853), sin(u2 * 6.2831853)) * g;
      }
    } else if (uSrc < 3.5 && uCamOn > 0.5) {                               // motion / camera / image
      float best = 0.0; vec2 bp = np2;
      for (int k = 0; k < 6; k++) {
        vec2 c = vec2((rnd(s) * 2.0 - 1.0) * uAspect, rnd(s) * 2.0 - 1.0);
        float w = weightAt(c) * (0.6 + 0.4 * rnd(s));
        if (w > best) { best = w; bp = c; }
      }
      np2 = bp;
      if (best < 0.15) ok = pick < 0.03;                                    // nothing there: stay hidden (a few strays)
    }
    if (ok) {
      float u1 = max(rnd(s), 1e-4), u2 = rnd(s);
      p = vec3(np2, jz < 50.0 ? jz : sqrt(-2.0 * log(u1)) * cos(u2 * 6.2831853) * 0.45);
      v = vec3(0.0);
      life = 0.6 + rnd(s) * 0.4;
    } else {
      p = vec3(99.0, 99.0, 0.0);                                            // parked off screen, tries again next frame
      v = vec3(0.0);
      life = 0.02;
    }
    seed = rnd(s);
  }
  vPos = p; vVel = v; vLife = vec2(life, seed);
}`;

const UPDATE_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(0.0); }`;

const RENDER_VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aVel; in vec2 aLife;
uniform float uAspect, uSize, uDof, uFocus, uAlpha, uPx;
out float vA;
void main() {
  vec3 p = aPos;
  float persp = 1.0 / (1.0 + p.z * 0.22);
  vec2 sp = p.xy * persp;
  gl_Position = vec4(sp.x / uAspect, sp.y, 0.0, 1.0);
  float coc = abs(p.z - uFocus) * uDof * 3.0;                    // out of focus = bigger and fainter (same total ink)
  float sz = uSize * uPx * persp * (1.0 + coc);
  gl_PointSize = clamp(sz, 1.0, 64.0);
  float fade = smoothstep(0.0, 0.15, aLife.x);
  vA = uAlpha * fade / ((1.0 + coc) * (1.0 + coc)) * (0.15 + 0.85 * smoothstep(0.25, 1.2, coc));
  if (aLife.y > 5.0) vA *= 1.0 + 1.8 * smoothstep(0.3, 0.9, aLife.x);
  if (p.x > 50.0) vA = 0.0;
}`;

const STREAK_VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aVel; in vec2 aLife;
uniform float uAspect, uDof, uFocus, uAlpha, uStreak;
out float vA;
void main() {
  vec3 p = aPos - (gl_VertexID == 1 ? aVel * uStreak : vec3(0.0));  // a short line along the way it moved this frame
  float persp = 1.0 / (1.0 + p.z * 0.22);
  vec2 sp = p.xy * persp;
  gl_Position = vec4(sp.x / uAspect, sp.y, 0.0, 1.0);
  float coc = abs(aPos.z - uFocus) * uDof * 3.0;
  vA = uAlpha * smoothstep(0.0, 0.15, aLife.x) * (1.0 - 0.85 * smoothstep(0.25, 1.2, coc));   // sharp ink; the blurred part is drawn as soft dots
  if (aLife.y > 5.0) vA *= 1.0 + 1.8 * smoothstep(0.3, 0.9, aLife.x);                         // fresh ink from a beat
  if (aPos.x > 50.0) vA = 0.0;
}`;

const RENDER_FS = `#version 300 es
precision mediump float;
in float vA;
uniform float uLine;
out vec4 o;
void main() {
  float a = vA;
  if (uLine < 0.5) {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c) * 4.0;
    if (d > 1.0) discard;
    a *= 1.0 - d;
  }
  o = vec4(a, a, a, a);
}`;

// LINES mode: each line keeps its recent path; every piece of it is drawn as a soft quad (thick and faint when out of focus)
const LINES_VS = `#version 300 es
precision highp float;
in vec4 aA; in vec4 aB;                       // two neighbouring points of a path: x, y, z, the frame it was written
uniform float uAspect, uFrame, uTail, uWidth, uAlpha, uDof, uFocus, uRot, uStride;
uniform vec2 uRes, uCoreW;
out float vA; out float vSide;
vec3 proj(vec3 p) {
  vec3 q = p - vec3(uCoreW, 0.0);
  float c = cos(uRot), s = sin(uRot);
  q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);    // the view turns slowly around the core
  q += vec3(uCoreW, 0.0);
  float persp = 1.0 / (1.0 + q.z * 0.22);
  return vec3(q.xy * persp, q.z);
}
void main() {
  float seg = mod(float(gl_InstanceID), uStride);
  bool hide = seg > uStride - 1.5 || abs(aB.w - aA.w - 1.0) > 0.5;
  float f = 1.0 - (uFrame - aB.w) / uTail;      // the tail fades out
  if (f <= 0.0) hide = true;
  vec3 a = proj(aA.xyz), b = proj(aB.xyz);
  vec2 pa = vec2(a.x / uAspect, a.y), pb = vec2(b.x / uAspect, b.y);
  vec2 d = (pb - pa) * uRes;
  float len = length(d);
  vec2 n = len > 1e-5 ? vec2(-d.y, d.x) / len : vec2(0.0, 1.0);
  float coc = abs((a.z + b.z) * 0.5 - uFocus) * uDof * 3.0;
  float w = uWidth * (1.0 + coc * 5.0);
  int v = gl_VertexID;
  float side = (v == 0 || v == 2) ? -1.0 : 1.0;
  vec2 base = v >= 2 ? pb : pa;
  gl_Position = vec4(base + n * side * w / uRes, 0.0, 1.0);
  vSide = side;
  vA = uAlpha * f * f / (1.0 + coc * 2.5);
  if (hide) { vA = 0.0; gl_Position = vec4(2.0, 2.0, 0.0, 1.0); }
}`;

const LINES_FS = `#version 300 es
precision mediump float;
in float vA; in float vSide;
out vec4 o;
void main() {
  float a = vA * smoothstep(1.0, 0.2, abs(vSide));   // soft edges
  o = vec4(a, a, a, a);
}`;

const QUAD_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FADE_FS = `#version 300 es
precision mediump float;
uniform float uFade;
out vec4 o;
void main() { o = vec4(uFade); }`;

const SHOW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDen;
uniform vec2 uTexel;
uniform float uGain, uSoft, uTime, uKick, uDot, uAspectS, uMirror, uFlash;
uniform vec2 uCoreUV;
uniform vec3 uPaper, uInk;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = uCoreUV + (vUv - uCoreUV) / (1.0 + uKick * 0.09);       // a burst kicks the whole picture outward from the core
  if (uMirror > 0.5) {                                                 // mirror: 2, 4 or 6 symmetrical parts around the centre
    vec2 c = uCoreUV;                                                // around the core, so the ink stays the centre
    vec2 q = (uv - c) * vec2(uAspectS, 1.0);
    if (uMirror < 1.5) { q.x = -abs(q.x); }
    else {
      float n = uMirror < 2.5 ? 4.0 : 6.0, seg = 6.2831853 / n;
      float a = atan(q.y, q.x), rr = length(q);
      a = abs(mod(a, seg) - seg * 0.5);
      q = vec2(cos(a), sin(a)) * rr;
    }
    uv = q / vec2(uAspectS, 1.0) + c;
    vec2 m = mod(uv, 2.0);                                           // beyond the edge: mirror again instead of smearing
    uv = mix(m, 2.0 - m, step(1.0, m));
  }
  float d = texture(uDen, uv).r;
  if (uSoft > 0.001) {                                             // a soft halo around the ink
    float r = uSoft * 6.0, acc = 0.0;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398;
      acc += texture(uDen, uv + vec2(cos(a), sin(a)) * uTexel * r).r;
      acc += texture(uDen, uv + vec2(cos(a + 0.39), sin(a + 0.39)) * uTexel * r * 2.2).r;
    }
    d = mix(d, acc / 16.0, uSoft * 0.7) + acc / 16.0 * uSoft * 0.25;
  }
  float ink = 1.0 - exp(-d * uGain * (1.0 + uKick * 0.45));
  if (uDot > 0.0) ink = max(ink, smoothstep(0.011, 0.006, length((vUv - uCoreUV) * vec2(uAspectS, 1.0))) * uDot);   // the bright dot in the middle
  vec3 col = mix(uPaper, uInk, ink);
  if (uFlash > 0.5) col = mix(uInk, uPaper, ink);                     // strobe: paper and ink swap for a moment
  float vig = smoothstep(1.25, 0.35, length(vUv - 0.5) * 1.6);
  col = mix(col, col * 0.93, 1.0 - vig);
  col += (h(vUv * 917.0 + uTime) - 0.5) * 0.025;                     // paper grain
  o = vec4(col, 1.0);
}`;

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  return sh;
}
function program(vs, fs, varyings) {
  const pr = gl.createProgram();
  gl.attachShader(pr, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, fs));
  if (varyings) gl.transformFeedbackVaryings(pr, varyings, gl.INTERLEAVED_ATTRIBS);
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

function initGL() {
  cv = document.createElement('canvas');
  cv.id = 'ink';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;touch-action:none;display:block';
  document.body.appendChild(cv);
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('This browser has no WebGL2.');
  floatInk = !!gl.getExtension('EXT_color_buffer_float');
  progUpdate = program(UPDATE_VS, UPDATE_FS, ['vPos', 'vVel', 'vLife']);
  progRender = program(RENDER_VS, RENDER_FS);
  progStreak = program(STREAK_VS, RENDER_FS);
  progFade = program(QUAD_VS, FADE_FS);
  progShow = program(QUAD_VS, SHOW_FS);
  progLines = program(LINES_VS, LINES_FS);
  quadVao = gl.createVertexArray();
  tf = gl.createTransformFeedback();
  camTex[0] = makeTex(); camTex[1] = makeTex(); imgTex = makeTex();
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glOk = false; glError = 'graphics reset · tap to restart'; });
  cv.addEventListener('webglcontextrestored', () => { location.reload(); });
}

function makeTex() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// the particles: two buffers, each frame one is read and the other written (on the graphics chip)
function buildParticles(count) {
  N = count;
  RIB = Math.min(768, Math.floor(N / 8));
  const data = new Float32Array(N * 8);
  for (let i = 0; i < N; i++) {
    const o = i * 8, a = Math.random() * TWO_PI_, g = Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-4)));
    data[o] = Math.cos(a) * g * 0.35; data[o + 1] = Math.sin(a) * g * 0.35; data[o + 2] = (Math.random() - 0.5) * 0.8;
    data[o + 6] = Math.random(); data[o + 7] = Math.random();
  }
  for (const b of bufs) { gl.deleteBuffer(b); }
  for (const v of vaoUp.concat(vaoRen, vaoStreak)) { gl.deleteVertexArray(v); }
  bufs = []; vaoUp = []; vaoRen = []; vaoStreak = [];
  for (let k = 0; k < 2; k++) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_COPY);
    bufs.push(b);
  }
  for (let k = 0; k < 2; k++) {
    vaoUp.push(makeVao(progUpdate, bufs[k]));
    vaoRen.push(makeVao(progRender, bufs[k]));
    vaoStreak.push(makeVao(progStreak, bufs[k], 1));
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  cur = 0;
  ribbonReset = 1;
}
function makeVao(pr, buf, divisor) {
  const v = gl.createVertexArray();
  gl.bindVertexArray(v);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const att = (name, size, off) => {
    const loc = gl.getAttribLocation(pr, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, off);
    if (divisor) gl.vertexAttribDivisor(loc, divisor);       // one particle per line (instanced)
  };
  att('aPos', 3, 0); att('aVel', 3, 12); att('aLife', 2, 24);
  gl.bindVertexArray(null);
  return v;
}

// ---------- lines mode: a few hundred lines orbiting the core, each leaving a long smooth tail
function linesFor(count) { return Math.max(64, Math.min(768, Math.round(count / 256))); }
function buildLines(n) {
  NL = n;
  lnSeed = null;
  lnPos = new Float32Array(NL * 3); lnVel = new Float32Array(NL * 3); lnLife = new Float32Array(NL);
  lnData = new Float32Array(NL * (LT + 1) * 4);
  for (let i = 0; i < NL; i++) {
    spawnLine(i);
    lnLife[i] *= Math.random();
    for (let j = 0; j <= LT; j++) {
      const o = (i * (LT + 1) + j) * 4;
      lnData[o] = lnPos[i * 3]; lnData[o + 1] = lnPos[i * 3 + 1]; lnData[o + 2] = lnPos[i * 3 + 2]; lnData[o + 3] = -1e9;
    }
  }
  if (lnBuf) gl.deleteBuffer(lnBuf);
  if (lnVao) gl.deleteVertexArray(lnVao);
  lnBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lnBuf);
  gl.bufferData(gl.ARRAY_BUFFER, lnData, gl.DYNAMIC_DRAW);
  lnVao = gl.createVertexArray();
  gl.bindVertexArray(lnVao);
  const la = gl.getAttribLocation(progLines, 'aA'), lb = gl.getAttribLocation(progLines, 'aB');
  gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(la, 1);
  gl.enableVertexAttribArray(lb); gl.vertexAttribPointer(lb, 4, gl.FLOAT, false, 16, 16); gl.vertexAttribDivisor(lb, 1);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}
// lines move exactly like the ink: the same jets out of the core and the same swirling currents,
// only each one keeps its path and is drawn as a long continuous line.
const PERM = new Uint8Array(512);
(function () {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) { p[i] = i; }
  let seed = 1337;
  for (let i = 255; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) { PERM[i] = p[i & 255]; }
})();
const GR3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
function snoise3(x, y, z) {                       // 3D simplex noise (the same kind the graphics chip uses for the ink)
  const F3 = 1 / 3, G3 = 1 / 6;
  const s0 = (x + y + z) * F3;
  const i = Math.floor(x + s0), j = Math.floor(y + s0), k = Math.floor(z + s0);
  const t0 = (i + j + k) * G3;
  const x0 = x - (i - t0), y0 = y - (j - t0), z0 = z - (k - t0);
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }
  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  let n = 0, t, g;
  t = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t > 0) { g = (PERM[ii + PERM[jj + PERM[kk]]] % 12) * 3; t *= t; n += t * t * (GR3[g] * x0 + GR3[g + 1] * y0 + GR3[g + 2] * z0); }
  t = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t > 0) { g = (PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]] % 12) * 3; t *= t; n += t * t * (GR3[g] * x1 + GR3[g + 1] * y1 + GR3[g + 2] * z1); }
  t = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t > 0) { g = (PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]] % 12) * 3; t *= t; n += t * t * (GR3[g] * x2 + GR3[g + 1] * y2 + GR3[g + 2] * z2); }
  t = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t > 0) { g = (PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]] % 12) * 3; t *= t; n += t * t * (GR3[g] * x3 + GR3[g + 1] * y3 + GR3[g + 2] * z3); }
  return 32 * n;
}
const CG = [0, 0, 0, 0, 0, 0];
function curl3(x, y, z) {                          // swirling, divergence-free flow (like smoke) = cross of two noise gradients
  const e = 0.06;
  let n = snoise3(x, y, z);
  const ax = (snoise3(x + e, y, z) - n) / e, ay = (snoise3(x, y + e, z) - n) / e, az = (snoise3(x, y, z + e) - n) / e;
  const X = x + 31.4, Y = y + 17.7, Z = z + 9.2;
  n = snoise3(X, Y, Z);
  const bx = (snoise3(X + e, Y, Z) - n) / e, by = (snoise3(X, Y + e, Z) - n) / e, bz = (snoise3(X, Y, Z + e) - n) / e;
  CG[0] = ay * bz - az * by; CG[1] = az * bx - ax * bz; CG[2] = ax * by - ay * bx;
  return CG;
}
let lnSeed = null;
function spawnLine(i) {                            // born in one of the jets around the core, like the ink
  const jets = 40, jet = i % jets;
  const h1 = Math.sin(jet * 12.9898) * 43758.5453, h2 = Math.sin(jet * 78.233) * 12345.678, h3 = Math.sin(jet * 39.425) * 24634.6345;
  const ja = (h1 - Math.floor(h1)) * TWO_PI_ + simTime * ((h2 - Math.floor(h2)) - 0.5) * 0.25;
  const jr = (0.15 + 0.85 * (h2 - Math.floor(h2))) * P.core;
  const jz = ((h3 - Math.floor(h3)) - 0.5) * 1.1;
  lnPos[i * 3] = core.x + Math.cos(ja) * jr + (Math.random() - 0.5) * 0.01;
  lnPos[i * 3 + 1] = core.y + Math.sin(ja) * jr + (Math.random() - 0.5) * 0.01;
  lnPos[i * 3 + 2] = jz;
  lnVel[i * 3] = 0; lnVel[i * 3 + 1] = 0; lnVel[i * 3 + 2] = 0;
  lnLife[i] = 0.6 + Math.random() * 0.4;
  if (lnSeed) lnSeed[i] = Math.random();
}
function linesStep(dt) {
  if (!lnData) return;
  if (!lnSeed || lnSeed.length !== NL) { lnSeed = new Float32Array(NL); for (let i = 0; i < NL; i++) { lnSeed[i] = Math.random(); } }
  const speed = P.speed, sc = P.scale, tz = simTime * P.evolve * 0.25;
  const storm = fxOn.storm ? 0.2 + fxAmt.storm * 0.9 : 0;
  const swirl = fxOn.swirl ? 0.3 + fxAmt.swirl * 1.7 : 0;
  const burst = burstImpulse * 1.5 + (fxOn.burst ? fxAmt.burst * 0.8 : 0);
  const ex = fxNow('explode'), im = fxNow('implode'), vo = fxNow('vortex'), wi = fxNow('wind'), ch = fxNow('chaos');
  const relax = 1 - Math.exp(-dt * 3 / (1 + (burst + ex + im + vo + wi) * 3));
  let throwFrac = 0;
  if (burstImpulse > 0.5 && !lnBurstUsed) { throwFrac = 0.25; lnBurstUsed = true; }
  if (burstImpulse < 0.2) lnBurstUsed = false;
  const prevHead = lnHead;
  lnHead = (lnHead + 1) % LT;
  for (let i = 0; i < NL; i++) {
    const o3 = i * 3;
    let x = lnPos[o3], y = lnPos[o3 + 1], z = lnPos[o3 + 2];
    let vx = lnVel[o3], vy = lnVel[o3 + 1], vz = lnVel[o3 + 2];
    const c = curl3(x * sc, y * sc, z * sc + tz);
    let fx = c[0] * speed, fy = c[1] * speed, fz = c[2] * speed;
    if (storm > 0) {
      const c2 = curl3(x * sc * 3.2 + 11, y * sc * 3.2 + 11, (z * sc + tz) * 3.2 + 11);
      const k = (0.25 + speed) * storm * 3.5;
      fx += c2[0] * k; fy += c2[1] * k; fz += c2[2] * k;
    }
    if (ch > 0) {
      const c3 = curl3(x * sc * 6 + 23, y * sc * 6 + 23, (z * sc + tz) * 6 + 23);
      const kc = (0.3 + speed) * ch * 4;
      fx += c3[0] * kc; fy += c3[1] * kc; fz += c3[2] * kc;
    }
    fz *= FLATZ;
    const dx = x - core.x, dy = y - core.y, r = Math.hypot(dx, dy) + 1e-3, rx = dx / r, ry = dy / r;
    fx += -ry * swirl * 1.8 / (1 + r * r * 2); fy += rx * swirl * 1.8 / (1 + r * r * 2);
    const outK = P.out * speed * 1.5 * Math.exp(-r * 0.8);                       // the ink streams out of the core
    fx += rx * outK; fy += ry * outK;
    vx += (fx - vx) * relax; vy += (fy - vy) * relax; vz += (fz - vz) * relax;
    const bk = burst * 22 * Math.exp(-r * 0.7) * dt;                             // bursts: a shock wave
    vx += rx * bk; vy += ry * bk;
    if (ex) { const e = ex * 5 * dt * (0.6 + Math.exp(-r * 0.5)); vx += rx * e; vy += ry * e; }
    if (im) { vx -= dx * im * 12 * dt; vy -= dy * im * 12 * dt; vz *= 1 - im * dt * 3; }
    if (vo) { const q = vo * 9 * dt / (0.3 + r); vx += -ry * q; vy += rx * q; }
    if (wi) { vx += windDir.x * wi * 4 * dt; vy += windDir.y * wi * 4 * dt; }
    if (touch.on) {
      const tx = x - touch.x, ty = y - touch.y, tf = Math.exp(-(tx * tx + ty * ty) * 10);
      const m = Math.min(1, tf * dt * 14);
      vx += (touch.vx * 1.3 - vx) * m; vy += (touch.vy * 1.3 - vy) * m;
      x += touch.vx * tf * dt * 0.5; y += touch.vy * tf * dt * 0.5;
    }
    let thrown = false;
    if (throwFrac && Math.random() < throwFrac) {                                 // thrown out of the core
      spawnLine(i); x = lnPos[o3]; y = lnPos[o3 + 1]; z = lnPos[o3 + 2];
      const a = Math.random() * TWO_PI_, sp = 1.5 + Math.random() * 2;
      vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; vz = 0; thrown = true;
    }
    x += vx * dt; y += vy * dt; z += vz * dt;
    z = Math.max(-1.2, Math.min(1.2, z));
    lnLife[i] -= dt / P.life * (0.6 + 0.8 * lnSeed[i]);
    let fresh = thrown;
    if (lnLife[i] <= 0 || Math.abs(x) > aspect * 1.35 || Math.abs(y) > 1.35 || !Number.isFinite(x + y + z)) {
      spawnLine(i);
      x = lnPos[o3]; y = lnPos[o3 + 1]; z = lnPos[o3 + 2];
      vx = 0; vy = 0; vz = 0;
      fresh = true;
    }
    lnPos[o3] = x; lnPos[o3 + 1] = y; lnPos[o3 + 2] = z;
    lnVel[o3] = vx; lnVel[o3 + 1] = vy; lnVel[o3 + 2] = vz;
    const base = i * (LT + 1);
    if (fresh) {                                                                   // break the tail: no line jumping to the new place
      lnData[(base + prevHead) * 4 + 3] = -1e9;
      if (prevHead === 0) lnData[(base + LT) * 4 + 3] = -1e9;
    }
    let o = (base + lnHead) * 4;
    lnData[o] = x; lnData[o + 1] = y; lnData[o + 2] = z; lnData[o + 3] = lnFrame;
    if (lnHead === 0) { o = (base + LT) * 4; lnData[o] = x; lnData[o + 1] = y; lnData[o + 2] = z; lnData[o + 3] = lnFrame; }
  }
  lnFrame++;
  gl.bindBuffer(gl.ARRAY_BUFFER, lnBuf);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, lnData);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}
function drawLines() {
  gl.useProgram(progLines);
  const ul = progLines.u, blur = fxOn.blur ? fxAmt.blur : 0;
  gl.uniform1f(ul.uAspect, aspect); gl.uniform1f(ul.uFrame, lnFrame - 1);
  gl.uniform1f(ul.uTail, Math.max(10, Math.min(LT - 1, P.trail * 65)));   // ink fade = tail length
  gl.uniform1f(ul.uWidth, 0.42 * P.size * dpr);
  gl.uniform1f(ul.uAlpha, LINE_K * P.ink);
  gl.uniform1f(ul.uDof, P.dof * (1 + blur * 3)); gl.uniform1f(ul.uFocus, P.focus);
  gl.uniform1f(ul.uRot, 0);
  gl.uniform1f(ul.uStride, LT + 1);
  gl.uniform2f(ul.uRes, denW / 2, denH / 2);
  gl.uniform2f(ul.uCoreW, core.x, core.y);
  gl.bindVertexArray(lnVao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, NL * (LT + 1) - 1);
  gl.bindVertexArray(null);
}
function setMode(m) {
  drawMode = m;
  if (m === 'lines') {
    if (!lnData || NL !== linesFor(P.count)) buildLines(linesFor(P.count));
    if (!linesSeen && inkMode === 0) inkMode = 1;                         // the first time: white lines on black
    linesSeen = true;
  }
  clearNow = true;
  refreshTop();
}

// the ink buffer: where the particles leave their marks (fades a little every frame)
function buildInk() {
  denW = Math.max(1, Math.floor(W)); denH = Math.max(1, Math.floor(H));
  if (denTex) gl.deleteTexture(denTex);
  if (denFbo) gl.deleteFramebuffer(denFbo);
  denTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, denTex);
  let ok = false;
  if (floatInk) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, denW, denH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    denFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, denFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, denTex, 0);
    ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!ok) { gl.deleteFramebuffer(denFbo); floatInk = false; }
  }
  if (!ok) {                                                       // older phones: 8-bit ink (slightly coarser fades)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, denW, denH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    denFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, denFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, denTex, 0);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  clearNow = true;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale;
  const w = Math.max(2, Math.floor(window.innerWidth * dpr)), h = Math.max(2, Math.floor(window.innerHeight * dpr));
  if (w === W && h === H) return;
  W = w; H = h;
  cv.width = W; cv.height = H;
  aspect = W / H;
  buildInk();
}

// ---------------------------------------------------------------- camera and image
let video = null, camStream = null, camFacing = 'user', camOn = false, camUploadT = 0;
async function startCamera() {
  stopCamera();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video = document.createElement('video');
    video.playsInline = true; video.muted = true; video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.srcObject = camStream;
    await video.play().catch(() => {});
    camOn = true;
  } catch (e) {
    camOn = false;
    note('camera blocked · allow it in the browser');
  }
}
function stopCamera() {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null; camOn = false; camReady = false;
}
function uploadCamera() {
  if (!camOn || !video || video.readyState < 2 || !video.videoWidth) return;
  const now = performance.now();
  if (now - camUploadT < 45) return;                                  // about 20 times a second is plenty
  camUploadT = now;
  camIdx = 1 - camIdx;
  gl.bindTexture(gl.TEXTURE_2D, camTex[camIdx]);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    camReady = true;
  } catch (e) { camReady = false; }
}
function loadPicture(file) {
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    imgAspect = img.width / img.height;
    imgReady = true;
    srcMode = 3;
    refreshTop();
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => note('could not read that image');
  img.src = URL.createObjectURL(file);
}
function camScale(srcAspect) {                                       // cover the screen without stretching
  return srcAspect > aspect ? [aspect / srcAspect, 1] : [1, srcAspect / aspect];
}

// ---------------------------------------------------------------- beat clock (shared by both sketches)
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
let sBass = 0, sMid = 0, sTreble = 0, sLevel = 0, pulse = 0, bassAvg = 0, beatCool = 0;
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

// ---------------------------------------------------------------- one frame
// the strength of the new movement effects right now (0 when off)
function fxNow(f) { return fxOn[f] ? 0.3 + fxAmt[f] * 1.2 : 0; }
let windDir = { x: 1, y: 0 };
function setMoveUniforms(u) {
  gl.uniform1f(u.uExplode, fxNow('explode')); gl.uniform1f(u.uImplode, fxNow('implode'));
  gl.uniform1f(u.uVortex, fxNow('vortex')); gl.uniform1f(u.uWind, fxNow('wind')); gl.uniform1f(u.uChaos, fxNow('chaos'));
  gl.uniform2f(u.uWindDir, windDir.x, windDir.y);
}
// strobe: paper and ink swap. It always runs at the speed set by its amount; when the music has a clear beat
// (heard in the last 1.5 s) it flashes on the beats instead. Never more than about 3 flashes a second (photosensitivity).
let strobeFlip = false, strobeLast = 0, strobeBeat = 0, lastBeatAt = -1e9;
function strobeOn() {
  if (!fxOn.strobe) { strobeFlip = false; return false; }
  const now = performance.now();
  if (beatN !== strobeBeat) { strobeBeat = beatN; lastBeatAt = now; }
  const onBeats = soundOn() && now - lastBeatAt < 1500;
  if (onBeats) {
    if (now === lastBeatAt || (now - lastBeatAt < 40 && !strobeFlip && now - strobeLast >= 340)) { strobeFlip = true; strobeLast = now; }
    else if (strobeFlip && now - strobeLast > 120) strobeFlip = false;
  } else {
    const period = Math.max(360, 1000 / (0.8 + 2.0 * fxAmt.strobe));   // 0.8 to 2.8 flashes a second
    if (!strobeFlip && now - strobeLast >= period) { strobeFlip = true; strobeLast = now; }
    else if (strobeFlip && now - strobeLast > Math.min(140, period * 0.45)) strobeFlip = false;
  }
  return strobeFlip;
}

function renderFrame() {
  const now = performance.now();
  const dtReal = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
  lastT = now;
  const k60 = dtReal * 60;
  updateFps(dtReal);
  listen(k60);
  driveFromSound(k60);
  updateTween();
  updateReadouts();
  if (!glOk) return;
  resize();
  uploadCamera();

  const k = P.sens, snd = soundOn();
  const freeze = fxOn.freeze ? fxAmt.freeze : 0;
  const tScale = 1 - 0.95 * freeze;
  const dt = dtReal * tScale;
  simTime += dt;

  // the core drifts slowly, or glides to where you tapped
  if (coreTarget) {
    core.x += (coreTarget.x - core.x) * 0.12; core.y += (coreTarget.y - core.y) * 0.12;
    if (Math.abs(coreTarget.x - core.x) + Math.abs(coreTarget.y - core.y) < 0.002) coreTarget = null;
  } else {
    core.x += (Math.sin(simTime * 0.11) * 0.35 * aspect - core.x) * 0.002 * k60;
    core.y += (Math.cos(simTime * 0.083) * 0.25 - core.y) * 0.002 * k60;
  }
  // bursts: the button (tap = one, hold = a stream) and the beats
  burstImpulse *= Math.pow(0.9, k60);
  let burst = burstImpulse * 1.5 + (fxOn.burst ? fxAmt.burst * 0.8 : 0);
  // a puff of fresh ink on every beat, and on every burst
  const puff = Math.min(0.6, burstImpulse * 0.35 + (fxOn.burst ? fxAmt.burst * 0.1 : 0));    // a little fresh ink from the core too
  // ribbons: a new one now and then, and on strong beats
  ribbonCool -= dtReal;
  if (fxOn.ribbons && ribbonCool <= 0) { ribbonReset = 1; ribbonCool = 3.5 + 4 * (1 - fxAmt.ribbons); }

  const speed = P.speed;
  const flowScale = P.scale;
  const swirl = fxOn.swirl ? 0.3 + fxAmt.swirl * 1.7 : 0;
  const storm = fxOn.storm ? 0.2 + fxAmt.storm * 0.9 : 0;
  const coreR = P.core;

  if (drawMode === 'lines') {
    linesStep(dt);
    gl.bindFramebuffer(gl.FRAMEBUFFER, denFbo);
    gl.viewport(0, 0, denW, denH);
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    if (fxOn.exposure && !clearNow) {                                     // long exposure: the lines leave their marks
      gl.useProgram(progFade);
      gl.bindVertexArray(quadVao);
      gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
      gl.uniform1f(progFade.u.uFade, Math.exp(-dtReal / (0.3 + fxAmt.exposure * 8)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    } else {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); clearNow = false;
    }
    gl.blendFunc(gl.ONE, gl.ONE);
    drawLines();
    gl.disable(gl.BLEND);
  } else {
  // 1. move the particles (graphics chip, no drawing)
  gl.useProgram(progUpdate);
  const u = progUpdate.u;
  setMoveUniforms(u);
  gl.uniform1f(u.uTime, simTime); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uSpeed, speed); gl.uniform1f(u.uScale, flowScale);
  gl.uniform1f(u.uEvolve, P.evolve); gl.uniform1f(u.uSwirl, swirl); gl.uniform1f(u.uBurst, burst); gl.uniform1f(u.uCoreR, coreR);
  gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uRibbonN, RIB); gl.uniform1f(u.uRibbonReset, ribbonReset); gl.uniform1f(u.uStorm, storm); gl.uniform1f(u.uOut, P.out); gl.uniform1f(u.uLife, P.life);
  gl.uniform2f(u.uCore, core.x, core.y);
  gl.uniform2f(u.uTouch, touch.x, touch.y); gl.uniform2f(u.uTouchVel, touch.vx, touch.vy); gl.uniform1f(u.uTouchOn, touch.on ? 1 : 0);
  const src = SOURCES[srcMode];
  let srcNum = 0, srcReady = false, sc = [1, 1], mirror = 0;
  if (src === 'motion' || src === 'camera') { srcNum = src === 'motion' ? 1 : 2; srcReady = camReady; if (video) sc = camScale(video.videoWidth / Math.max(1, video.videoHeight)); mirror = camFacing === 'user' ? 1 : 0; }
  else if (src === 'image') { srcNum = 3; srcReady = imgReady; sc = camScale(imgAspect); }
  else if (src === 'field') { srcNum = 4; }
  gl.uniform1f(u.uSrc, srcNum); gl.uniform1f(u.uCamOn, srcReady ? 1 : 0); gl.uniform1f(u.uMirror, mirror);
  gl.uniform2f(u.uCamScale, sc[0], sc[1]);
  gl.uniform1i(u.uFrame, frameNo); gl.uniform1i(u.uJets, JETS); gl.uniform1f(u.uJetMix, JETMIX); gl.uniform1f(u.uFlatZ, FLATZ); gl.uniform1f(u.uPuff, puff);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src === 'image' ? imgTex : camTex[camIdx]); gl.uniform1i(u.uCam, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src === 'image' ? imgTex : camTex[1 - camIdx]); gl.uniform1i(u.uCamPrev, 1);
  gl.bindVertexArray(vaoUp[cur]);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufs[1 - cur]);
  gl.enable(gl.RASTERIZER_DISCARD);
  gl.beginTransformFeedback(gl.POINTS);
  gl.drawArrays(gl.POINTS, 0, N);
  gl.endTransformFeedback();
  gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
  gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
  gl.bindVertexArray(null);
  cur = 1 - cur;
  ribbonReset = 0;

  // 2. ink: fade what is there, then add this frame's marks
  gl.bindFramebuffer(gl.FRAMEBUFFER, denFbo);
  gl.viewport(0, 0, denW, denH);
  gl.enable(gl.BLEND);
  if (clearNow) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); clearNow = false; }
  const expo = fxOn.exposure ? fxAmt.exposure : 0;
  const clearer = 1 - Math.min(0.75, fxNow('implode') * 0.5);         // implode: old ink clears faster so the collapse reads
  const fade = expo > 0 ? Math.exp(-dtReal / (P.trail * (1 + freeze * 6) + expo * 60)) : Math.exp(-dtReal / Math.max(0.05, P.trail * clearer * (1 + freeze * 6)));   // long exposure: the ink stays
  gl.useProgram(progFade);
  gl.bindVertexArray(quadVao);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);                               // ink *= fade
  gl.uniform1f(progFade.u.uFade, fade);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (!floatInk) {                                                    // 8-bit ink: also take away a tiny bit so it reaches white
    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(progFade.u.uFade, 1.2 / 255);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendEquation(gl.FUNC_ADD);
  }
  gl.blendFunc(gl.ONE, gl.ONE);                                      // ink += marks
  gl.useProgram(progRender);
  const ur = progRender.u;
  const blur = fxOn.blur ? fxAmt.blur : 0;
  const px = dpr;
  gl.uniform1f(ur.uAspect, aspect); gl.uniform1f(ur.uSize, P.size * (1 + blur * 0.5)); gl.uniform1f(ur.uPx, px);
  gl.uniform1f(ur.uDof, P.dof * (1 + blur * 3.5)); gl.uniform1f(ur.uFocus, P.focus);
  const density = Math.min(3, Math.max(0.4, (W * H) / (N * 9)));  // same darkness on any screen size and particle count
  const inkAlpha = P.ink * INK_K * (floatInk ? 1 : 1.6) * density * dtReal * 60;
  gl.uniform1f(ur.uAlpha, inkAlpha);
  gl.uniform1f(ur.uLine, 0);
  gl.bindVertexArray(vaoRen[cur]);
  gl.drawArrays(gl.POINTS, RIB, N - RIB);
  gl.useProgram(progStreak);                                          // the sharp ink: short lines along each path
  const uk = progStreak.u;
  gl.uniform1f(uk.uAspect, aspect); gl.uniform1f(uk.uDof, P.dof * (1 + blur * 2)); gl.uniform1f(uk.uFocus, P.focus);
  gl.uniform1f(uk.uAlpha, inkAlpha * STREAK_K); gl.uniform1f(uk.uStreak, Math.max(dt, 1 / 240) * 1.15);
  gl.bindVertexArray(vaoStreak[cur]);
  gl.drawArraysInstanced(gl.LINES, 0, 2, N);
  gl.useProgram(progRender);
  gl.bindVertexArray(vaoRen[cur]);
  if (fxOn.ribbons && frameNo % 3 === 0) {                            // ribbons: the line drawn every 3rd frame = stacked contours
    gl.uniform1f(ur.uAlpha, 0.22 * (0.5 + fxAmt.ribbons));
    gl.uniform1f(ur.uDof, 0);
    gl.uniform1f(ur.uLine, 1);
    gl.drawArrays(gl.LINE_STRIP, 0, RIB);
  }
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
  }

  // 3. show it: paper and ink colours, softness, grain
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(progShow);
  const us = progShow.u, pal = INKS[inkMode];
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, denTex); gl.uniform1i(us.uDen, 0);
  gl.uniform2f(us.uTexel, 1 / denW, 1 / denH);
  gl.uniform1f(us.uGain, GAIN);
  gl.uniform1f(us.uKick, drawMode === 'lines' ? 0 : burstImpulse * 0.5);
  gl.uniform1f(us.uDot, 0); gl.uniform1f(us.uAspectS, aspect);
  gl.uniform1f(us.uMirror, fxOn.mirror ? (fxAmt.mirror < 0.34 ? 1 : (fxAmt.mirror < 0.67 ? 2 : 3)) : 0);
  gl.uniform1f(us.uFlash, strobeOn() ? 1 : 0);
  gl.uniform2f(us.uCoreUV, core.x / aspect * 0.5 + 0.5, core.y * 0.5 + 0.5);
  gl.uniform1f(us.uSoft, Math.min(1, P.soft + blur * 0.8));
  gl.uniform1f(us.uTime, (frameNo % 97) * 0.37);
  gl.uniform3f(us.uPaper, pal.paper[0] / 255, pal.paper[1] / 255, pal.paper[2] / 255);
  gl.uniform3f(us.uInk, pal.ink[0] / 255, pal.ink[1] / 255, pal.ink[2] / 255);
  gl.bindVertexArray(quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  frameNo++;
  touch.vx *= 0.9; touch.vy *= 0.9;
}

// auto quality: if the frame rate stays low, use fewer particles
let fpsAvg = 60, qCheck = 0, autoQ = true;
function updateFps(dt) {
  fpsAvg += (1 / Math.max(dt, 0.001) - fpsAvg) * 0.05;
  if (!autoQ || ++qCheck % 90 !== 0) return;
  if (fpsAvg < 40 && N > 16384) { setCount(Math.max(16384, N / 2)); note('auto quality · ' + Math.round(N / 1024) + 'k particles'); }
}
function setCount(n) {
  n = Math.max(16384, Math.min(262144, Math.round(n / 16384) * 16384));
  P.count = n;
  if (n !== N && gl) buildParticles(n);
  if (gl && drawMode === 'lines' && NL !== linesFor(n)) buildLines(linesFor(n));
  if (SL.count) SL.count.input.value = n;
}

// ---------------------------------------------------------------- touch on the picture
function setupTouch() {
  const pts = new Map();
  let downT = 0, moved = 0, lastTap = 0;
  const toWorld = (e) => ({ x: (e.clientX / window.innerWidth * 2 - 1) * aspect, y: 1 - e.clientY / window.innerHeight * 2 });
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const w = toWorld(e);
    pts.set(e.pointerId, w);
    touch.on = true; touch.x = w.x; touch.y = w.y; touch.vx = 0; touch.vy = 0; touch.t = performance.now();
    downT = performance.now(); moved = 0;
    keepAwake();
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const w = toWorld(e), dx = w.x - p.x, dy = w.y - p.y;
    moved += Math.abs(dx) + Math.abs(dy);
    pts.set(e.pointerId, w);
    touch.x = w.x; touch.y = w.y;
    { const sl = Math.hypot(dx, dy); if (sl > 0.004) { windDir = { x: dx / sl, y: dy / sl }; } }
    const now = performance.now(), edt = Math.max(0.004, Math.min(0.05, (now - (touch.t || now - 16)) / 1000));
    touch.t = now;
    touch.vx = touch.vx * 0.3 + (dx / edt) * 0.7; touch.vy = touch.vy * 0.3 + (dy / edt) * 0.7;
  });
  const up = (e) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size === 0) touch.on = false;
    const now = performance.now();
    if (p && now - downT < 260 && moved < 0.03) {                     // a tap
      if (now - lastTap < 330) { clearInk(); lastTap = 0; }
      else { coreTarget = { x: p.x, y: p.y }; burstImpulse = Math.max(burstImpulse, 0.9); lastTap = now; }
    }
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
function clearInk() {
  clearNow = true; ribbonReset = 1;
  if (lnData) {                                                        // lines mode: erase every tail; the lines start drawing again from where they are
    for (let j = 3; j < lnData.length; j += 4) { lnData[j] = -1e9; }
  }
}

// ---------------------------------------------------------------- interface
const B = {};
const SL = {};
let meter = null;
let ui, bar, dock, menu, amtBox, amtLabel, amtVal, amtSlider, noteEl, restoreBtn, hidden = false, focusFx = null, peek = false;
const CSS = `
#bar,#dock,#menu,#note,#restore{position:fixed;z-index:10;font:10px/1.2 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.09em;
  text-transform:uppercase;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#bar{left:0;right:0;top:0;display:flex;flex-wrap:wrap;gap:1px;background:#23262a;border-bottom:1px solid #34373c}
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
#dock button{position:relative;padding:14px 2px 12px;text-align:center;overflow:hidden;white-space:nowrap;touch-action:none}
#dock button.focus{box-shadow:inset 0 2px 0 #e8eaec}
#dock button.has{box-shadow:inset 0 -2px 0 #e8eaec}
#dock button.cur{color:#ff5a1f;box-shadow:inset 0 -2px 0 #ff5a1f}
#dock .meter{position:absolute;left:0;bottom:0;height:2px;background:#ff5a1f}
#dock button.on .meter{background:#0d0e10}
#vu{height:3px;background:#ff5a1f;width:0;transition:width .05s linear;pointer-events:none}
#amt{background:rgba(13,14,16,.92);border-top:1px solid #34373c;padding:8px 12px 6px;color:#8b9096;display:none;touch-action:none}
#amt .top,#menu .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
#amt .val,#menu .val{color:#e8eaec}
#menu .val.drv{color:#ff5a1f}
#menu .rt{display:flex;align-items:center;gap:8px}
#menu button.lk{background:#0d0e10;color:#5a5f65;border:1px solid #34373c;font-size:8px;padding:2px 5px}
#menu button.lk.on{background:#e8eaec;color:#0d0e10;border-color:#e8eaec}
#menu{left:0;top:82px;width:min(270px,92vw);max-height:calc(100vh - 230px);overflow-y:auto;background:rgba(13,14,16,.94);color:#8b9096;
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
input[type=range].r::-webkit-slider-runnable-track{height:1px;background:#52565c}
input[type=range].r::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:18px;margin-top:-9px;background:#e8eaec;border:0;border-radius:0}
#amt input[type=range].r::-webkit-slider-thumb{width:12px;height:26px;margin-top:-13px}
input[type=range].r::-moz-range-track{height:1px;background:#52565c}
input[type=range].r::-moz-range-thumb{width:9px;height:18px;background:#e8eaec;border:0;border-radius:0}
#note{left:12px;bottom:150px;color:#ff5a1f;opacity:0;transition:opacity .4s;pointer-events:none}
#restore{right:8px;top:8px;width:30px;height:30px;display:none;background:rgba(13,14,16,.5);color:#b9bdc2;border:1px solid #34373c;opacity:.35;padding:0}
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
  noteT = setTimeout(() => { noteEl.style.opacity = 0; }, 2200);
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
    return b;
  };
  bt('source', 'source', 'core', () => { srcMode = (srcMode + 1) % SOURCES.length; sourceChanged(); });
  bt('ink', 'ink', 'ink', () => { inkMode = (inkMode + 1) % INKS.length; refreshTop(); });
  bt('music', 'music', 'play', () => { keepAwake(); togglePlay(); });
  bt('mic', 'mic', 'off', () => { keepAwake(); toggleMic(); });
  bt('rec', 'rec', 'start', toggleRecord);
  bt('beat', 'beat', 'auto', () => { bcToggle(); refreshTop(); });
  bt('freeze', 'time', 'freeze', () => toggleFx('freeze'));
  bt('mode', 'mode', 'ink', () => setMode(drawMode === 'ink' ? 'lines' : 'ink'));
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
  amtSlider = el('input', 'r', amtBox);
  amtSlider.type = 'range'; amtSlider.min = 0; amtSlider.max = 1; amtSlider.step = 0.01;
  amtSlider.addEventListener('input', () => { if (focusFx) { fxAmt[focusFx] = parseFloat(amtSlider.value); refreshFx(); } });
  meter = el('div', '', dock); meter.id = 'vu';
  const pg = el('div', 'pg fx7', dock);
  for (const f of FX) { B['fx_' + f] = holdButton(f, pg); }
  const lr = el('div', 'pg', dock);
  for (let i = 0; i < 4; i++) { B['look' + i] = lookButton(i, lr); }
  const rb = el('button', '', lr, 'rnd'); rb.addEventListener('click', randomLook);
  const cb = el('button', '', lr, 'clear'); cb.addEventListener('click', clearInk);

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
  // look: every setting
  el('div', 'sec', panes.look, 'beat clock');
  const gbc = el('div', 'btns', panes.look);
  const tb = el('button', '', gbc, 'tap tempo'); tb.addEventListener('click', () => { bcTap(performance.now()); refreshTop(); });
  const ab = el('button', '', gbc, 'auto / off'); ab.addEventListener('click', () => { bcToggle(); refreshTop(); });
  el('div', 'note', panes.look, 'auto: finds the tempo of the music by itself (shown on the bpm button) · tap: set it by hand · off: react to bass hits only');
  el('div', 'sec', panes.look, 'orange = moved by the music · lock to keep it still');
  for (const s of SLIDERS) { addSlider(panes.look, s); }
  const gl1 = el('div', 'btns', panes.look);
  const rs = el('button', 'full', gl1, 'reset settings');
  rs.addEventListener('click', () => { applySettings(PDEF); });
  // source
  el('div', 'sec', panes.source, 'camera (for motion and camera)');
  const gs = el('div', 'btns', panes.source);
  B.cam = el('button', 'full', gs, 'camera · start');
  B.cam.addEventListener('click', () => { if (camOn) { camFacing = camFacing === 'user' ? 'environment' : 'user'; } startCamera().then(refreshTop); });
  el('div', 'sec', panes.source, 'music file');
  const fm = el('input', '', panes.source); fm.type = 'file';   // no type filter: iPhone greys out some music files otherwise
  fm.addEventListener('change', () => { if (fm.files[0]) handleMusic(fm.files[0]); fm.value = ''; });
  musicInput = fm;
  musicLabel = el('div', 'note', panes.source, 'no music loaded · tap music in the top bar, or choose a file here');
  el('div', 'sec', panes.source, 'image · png / jpg');
  const fi = el('input', '', panes.source); fi.type = 'file'; fi.accept = 'image/*';
  fi.addEventListener('change', () => { if (fi.files[0]) loadPicture(fi.files[0]); });
  el('div', 'note', panes.source, 'motion: ink comes out of whatever moves in front of the camera. camera / image: out of the dark parts of the picture. the camera starts by itself when you pick motion or camera.');
  // perf
  el('div', 'sec', panes.perf, 'performance');
  const gp = el('div', 'btns', panes.perf);
  B.auto = el('button', 'full on', gp, 'auto quality · on');
  B.auto.addEventListener('click', () => { autoQ = !autoQ; B.auto.textContent = 'auto quality · ' + (autoQ ? 'on' : 'off'); setOn(B.auto, autoQ); });
  B.res = el('button', '', gp, 'resolution · 100%');
  B.res.addEventListener('click', () => { resScale = resScale === 1 ? 0.75 : (resScale === 0.75 ? 0.5 : 1); B.res.textContent = 'resolution · ' + Math.round(resScale * 100) + '%'; W = 0; });
  B.lift = el('button', 'full', gp, 'dock lift · 0 px');
  B.lift.addEventListener('click', () => { const st = [0, 40, 84, 130]; setLift(st[(st.indexOf(dockLift) + 1) % st.length]); store('lift', dockLift); });
  B.fs = el('button', '', gp, 'full screen');
  B.fs.addEventListener('click', goFullscreen);
  B.fps = el('div', 'note', panes.perf, '');
  // help
  el('div', 'note', panes.help).innerHTML = 'drag · stir the ink<br>tap · move the core there and burst<br>double tap · clear<br><br>dock: tap = on / off · hold = only while held, drag up / down for the amount (or a 2nd finger on the amount bar)<br>burst · the core erupts (tap = one, hold = a stream)<br>storm · rough, fast currents<br>swirl · a vortex around the core<br>ribbons · lines that leave stacked contours<br>freeze · time almost stops, the ink stays<br>blur · soft focus<br>strobe · paper and ink swap (on the beat with music, never more than 3 a second)<br>explode · everything blasts outward<br>implode · everything is sucked into the core<br>vortex · a whirlpool over the whole screen<br>wind · everything blown the way you last swiped<br>chaos · fine, rough, fast currents<br>mirror · 2, 4 or 6 symmetrical parts (the amount picks)<br>expose · long exposure: the ink stops fading<br><br>looks 1-4 · tap = recall, hold = save · rnd · random<br><br>keys: q w e r t y u = burst storm swirl ribbons freeze blur strobe · a s d g j k l = explode implode vortex wind chaos mirror expose · 1-4 looks (shift = save) · c clear · ; beat clock auto / off · b tap tempo · 0 all off · space play · h hide · f full screen · n random · m ink / lines<br><br>lines mode: the same currents and jets as the ink, drawn as long continuous lines; ink fade = tail length; particles = how many lines';
  for (let i = 0; i < 4; i++) { LOOKS[i] = recall('look' + i); }
  refreshLooks();
  refreshTop();
  refreshFx();
  initLift();
  bcLoad();
  refreshTop();
  setupKeys();
  window.addEventListener('pointerdown', keepAwake, { once: true });
}

// which band moves which setting, and over what range (count is never driven, so the music cannot overload the phone)
const DRIVE = {                    // [band, quiet value, loud value, how quickly it follows, beat kick]
  // not driven: particles, flow speed, stream out and particle life (those make the picture dense)
  core: ['bass', 0.08, 0.13, 0.12, 0.07],     // the core swells on every beat
  size: ['bass', 1.0, 1.15, 0.12, 0.3],       // lines thicken for a moment on a beat
  dof: ['high', 0.3, 0.6, 0.08, 0.6],         // depth blur flashes on a beat
  soft: ['high', 0.06, 0.14, 0.08, 0.18],     // a soft glow on a beat
  evolve: ['mid', 0.12, 0.35, 0.04, 0.6],     // the currents lurch on a beat
  ink: ['level', 0.32, 0.5, 0.04, 0],         // loudness -> ink amount (narrow)
  trail: ['level', 2.4, 1.6, 0.04, 0],        // loud parts renew the ink faster
  focus: ['beat', -0.5, 0.5, 0.1, 0],         // every beat racks the focus to a new depth
  scale: ['beat4', 0.75, 1.5, 0.03, 0],       // every 4th beat the currents change size
};
const locked = {};
let restP = null, wasSnd = false, sHigh = 0;
const slowF = {};
let beatN = 0, beatHeld = false, beatEnv = 0;
const beatTarget = { focus: 0, scale: 1 };
function driveFromSound(k60) {
  const snd = soundOn();
  if (snd && !wasSnd) restP = Object.assign({}, P);                  // remember the settings from before the music
  if (!snd && wasSnd && restP) {                                       // music stopped: glide back to them
    const back = {};
    for (const skey in DRIVE) { if (!locked[skey]) back[skey] = restP[skey]; }
    applySettings(back);
  }
  wasSnd = snd;
  if (!snd) return;
  const k = P.sens;
  // a beat: the moment the pulse jumps up
  if (pulse > 0.95 && !beatHeld) {
    beatHeld = true;
    beatN++;
    beatEnv = 1;
    beatTarget.focus = -0.5 + Math.random();                           // a new focus depth on every beat
    if (beatN % 4 === 0) beatTarget.scale = Math.random();            // new current size every 4th beat (every bar with the clock)
    if (bcActive() && beatN % 16 === 0) burstImpulse = Math.max(burstImpulse, 0.6);   // a new phrase: a small burst
  }
  if (pulse < 0.6) beatHeld = false;
  beatEnv *= Math.pow(0.86, k60);
  if (tween) return;                                                   // a look is gliding in: let it finish
  const bands = { level: sLevel, bass: sBass, mid: sMid, treble: sTreble, high: sHigh, beat: beatTarget.focus + 0.5, beat4: beatTarget.scale };
  for (const skey in DRIVE) {
    if (locked[skey]) continue;
    const [b, lo, hi, rate, kick] = DRIVE[skey];
    const t = Math.min(1, Math.max(0, b === 'beat' || b === 'beat4' ? bands[b] : bands[b] * k));
    const target = lo + (hi - lo) * t;
    const prev = slowF[skey] === undefined ? P[skey] : slowF[skey];
    slowF[skey] = prev + (target - prev) * (1 - Math.pow(1 - rate, k60));
    P[skey] = slowF[skey] + (kick || 0) * beatEnv * Math.min(1.5, k);   // the beat kick on top, fading quickly
  }
}

function addSlider(parent, s) {
  const [skey, label, lo, hi, step, fmt] = s;
  const row = el('div', 'row', parent);
  const top = el('div', 'top', row);
  el('span', '', top, label);
  const rt = el('span', 'rt', top);
  const val = el('span', 'val', rt);
  if (DRIVE[skey]) {                                                    // lock = the music cannot move this one
    const lk = el('button', 'lk', rt, 'free');
    lk.addEventListener('click', () => { locked[skey] = !locked[skey]; lk.textContent = locked[skey] ? 'locked' : 'free'; setOn(lk, locked[skey]); delete slowF[skey]; });
  }
  const inp = el('input', 'r', row);
  inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = step; inp.value = P[skey];
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    if (skey === 'count') { setCount(v); autoQ = false; if (B.auto) { B.auto.textContent = 'auto quality · off'; setOn(B.auto, false); } }
    else { P[skey] = v; delete slowF[skey]; if (restP) restP[skey] = v; }
  });
  SL[skey] = { input: inp, val, fmt: fmt || ((v) => (+v).toFixed(2)), last: '' };
}
let roTick = 0;
function updateReadouts() {
  if (++roTick % 3) return;
  for (const k in SL) {
    const r = SL[k], v = k === 'count' ? N || P.count : P[k];
    if (document.activeElement !== r.input && Math.abs(parseFloat(r.input.value) - v) > 1e-6) r.input.value = v;
    const t = r.fmt(v);
    if (t !== r.last) { r.val.textContent = t; r.last = t; }
    r.val.classList.toggle('drv', !!DRIVE[k] && !locked[k] && soundOn());
  }
  if (B.beat && roTick % 15 === 0) { setLabel(B.beat, 'bpm', bcLabel()); setOn(B.beat, bcActive()); }
  if (meter) {                                                       // the thin orange line above the dock = what the music is doing
    const lv = soundOn() ? Math.min(1, sLevel * 0.8 + pulse * 0.4) : 0;
    meter.style.width = Math.round(lv * 100) + '%';
    meter.style.opacity = pulse > 0.8 ? 1 : 0.6;
  }
  if (recState === 'recording') {
    const t = Math.floor((performance.now() - recStart) / 1000);
    setLabel(B.rec, 'rec', 'stop ' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  }
  if (B.fps && menu.style.display === 'block') B.fps.textContent = Math.round(fpsAvg) + ' fps · ' + Math.round(N / 1024) + 'k particles · ' + (floatInk ? 'smooth ink' : '8-bit ink');
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

function sourceChanged() {
  const s = SOURCES[srcMode];
  if ((s === 'motion' || s === 'camera') && !camOn) startCamera().then(refreshTop);
  if (s === 'image' && !imgReady) { note('pick an image in menu · source'); openMenu('source'); }
  if (s === 'motion') note('move in front of the camera');
  refreshTop();
}
function refreshTop() {
  if (B.beat) { setLabel(B.beat, 'bpm', bcLabel()); setOn(B.beat, bcActive()); }
  setLabel(B.source, 'source', SOURCES[srcMode]);
  setLabel(B.ink, 'ink', INKS[inkMode].name);
  setOn(B.freeze, fxOn.freeze);
  setLabel(B.mode, 'mode', drawMode);
  setLabel(B.source, 'source', drawMode === 'lines' ? 'core' : SOURCES[srcMode]);
  if (B.cam) B.cam.textContent = camOn ? 'camera · ' + (camFacing === 'user' ? 'front · tap to flip' : 'back · tap to flip') : 'camera · start';
}

// dock buttons: tap = on / off, hold = only while held (drag up / down = amount)
function holdButton(name, parent) {
  const b = el('button', '', parent, FX_LABEL[name] || name);
  const m = el('i', 'meter', b);
  b.meter = m;
  let timer = null, held = false, prev = false, y0 = 0, a0 = 0, pressed = false;
  b.addEventListener('pointerdown', (e) => {
    pressed = true; held = false; prev = fxOn[name]; y0 = e.clientY; a0 = fxAmt[name];
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    focusFx = name; peek = true; refreshFx();
    if (name === 'burst') burstImpulse = Math.max(burstImpulse, 0.8 + fxAmt.burst);
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
    else if (!cancel && name !== 'burst') fxOn[name] = !fxOn[name];   // burst: a tap is one burst
    if (!fxOn[name] && focusFx === name && name !== 'burst') focusFx = null;
    refreshFx();
  };
  b.addEventListener('pointerup', () => end(false));
  b.addEventListener('pointercancel', () => end(true));
  return b;
}
function toggleFx(name, v) {
  fxOn[name] = v === undefined ? !fxOn[name] : v;
  if (fxOn[name]) focusFx = name;
  refreshFx();
}
function refreshFx() {
  for (const f of FX) {
    const b = B['fx_' + f];
    if (!b) continue;
    setOn(b, fxOn[f]);
    b.classList.toggle('focus', focusFx === f);
    b.meter.style.width = Math.round(fxAmt[f] * 100) + '%';
  }
  const show = focusFx && (fxOn[focusFx] || peek);
  amtBox.style.display = show ? 'block' : 'none';
  if (show) {
    amtLabel.textContent = focusFx + ' · amount';
    amtVal.textContent = fxAmt[focusFx].toFixed(2);
    if (document.activeElement !== amtSlider) amtSlider.value = fxAmt[focusFx];
  }
  if (B.freeze) refreshTop();
}
function panic() {
  for (const f of FX) { fxOn[f] = false; }
  focusFx = null;
  burstImpulse = 0;
  refreshFx();
}

// looks: four saved states
const LOOKS = [null, null, null, null];
let tween = null, curLook = -1;
function snapshot() { return { P: Object.assign({}, P), fxOn: Object.assign({}, fxOn), fxAmt: Object.assign({}, fxAmt), src: srcMode, ink: inkMode, mode: drawMode }; }
function store(k, v) { try { localStorage.setItem('ink_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
function recall(k) { try { const v = localStorage.getItem('ink_' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function applySettings(np) {
  const from = {}, to = {};
  for (const k in P) {
    if (k === 'count') continue;
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
  if (o.mode === 'ink' || o.mode === 'lines') { if (o.mode !== drawMode) setMode(o.mode); }
  applySettings(o.P || {});
  for (const f of FX) {
    if (o.fxOn && typeof o.fxOn[f] === 'boolean') fxOn[f] = o.fxOn[f];
    if (o.fxAmt && Number.isFinite(o.fxAmt[f])) fxAmt[f] = o.fxAmt[f];
  }
  if (Number.isInteger(o.ink) && o.ink >= 0 && o.ink < INKS.length) inkMode = o.ink;
  if (Number.isInteger(o.src) && o.src >= 0 && o.src < SOURCES.length) { srcMode = o.src; sourceChanged(); }
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
  let timer = null, pressed = false, saved = false;
  b.addEventListener('pointerdown', () => { pressed = true; saved = false; clearTimeout(timer); timer = setTimeout(() => { saved = true; saveLook(i); }, 600); });
  const end = (cancel) => { clearTimeout(timer); if (!pressed) return; pressed = false; if (!saved && !cancel) recallLook(i); };
  b.addEventListener('pointerup', () => end(false));
  b.addEventListener('pointercancel', () => end(true));
  return b;
}
function randomLook() {
  const r = (a, b) => a + Math.random() * (b - a);
  const np = { speed: r(0.25, 1.0), scale: r(0.6, 2.2), evolve: r(0.1, 0.8), trail: r(0.8, 6), ink: r(0.3, 1.0), size: r(0.8, 1.8), dof: r(0.2, 1.1), focus: r(-0.5, 0.5), soft: r(0, 0.6), core: r(0.08, 0.35) };
  applySettings(np);
  for (const f of ['storm', 'swirl', 'ribbons', 'blur']) { fxOn[f] = Math.random() < 0.4; }
  refreshFx();
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
  a.download = 'ink-' + Date.now() + (recBlob.type.includes('mp4') ? '.mp4' : '.webm');
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
  try { const p = f.call(d); if (p && p.catch) p.catch(() => note('full screen is not available here')); } catch (e) { note('full screen is not available here'); }
}
let wake = null;
async function keepAwake() {
  try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); lastT = 0; } });

const KEY_FX = { KeyQ: 'burst', KeyW: 'storm', KeyE: 'swirl', KeyR: 'ribbons', KeyT: 'freeze', KeyY: 'blur', KeyU: 'strobe',
  KeyA: 'explode', KeyS: 'implode', KeyD: 'vortex', KeyG: 'wind', KeyJ: 'chaos', KeyK: 'mirror', KeyL: 'exposure' };
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
      if (f === 'burst') burstImpulse = Math.max(burstImpulse, 0.8 + fxAmt.burst);
      fxOn[f] = true; focusFx = f; refreshFx();
      return;
    }
    if (e.repeat) return;
    if (c === 'KeyH') setHidden(!hidden);
    else if (c === 'Escape') setHidden(false);
    else if (/^Digit[1-4]$/.test(c)) { const i = parseInt(c.slice(5), 10) - 1; if (e.shiftKey) saveLook(i); else recallLook(i); }
    else if (c === 'Digit0' || c === 'Backspace') { e.preventDefault(); panic(); }
    else if (c === 'KeyC') clearInk();
    else if (c === 'Space') { e.preventDefault(); if (micOn) toggleMic(); else togglePlay(); }
    else if (c === 'KeyF') goFullscreen();
    else if (c === 'KeyN') randomLook();
    else if (c === 'KeyM') setMode(drawMode === 'ink' ? 'lines' : 'ink');
    else if (c === 'Semicolon') { bcToggle(); refreshTop(); }
    else if (c === 'KeyB') { bcTap(performance.now()); refreshTop(); }
  });
  window.addEventListener('keyup', (e) => {
    const k = keyDown[e.code], f = KEY_FX[e.code];
    if (!k) return;
    delete keyDown[e.code];
    const held = performance.now() - k.t > 300;
    if (f === 'burst') fxOn[f] = false;          // burst: a tap is one burst, holding gives a stream
    else if (held) fxOn[f] = k.was;              // held: back to how it was
    else fxOn[f] = !k.was;                       // tapped: switched
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
    buildParticles(P.count);
    buildUI();
    setupTouch();
    window.addEventListener('resize', () => { W = 0; });
  } catch (e) {
    glOk = false;
    const f = el('div', '', document.body);
    f.id = 'fatal';
    f.innerHTML = 'INK FIELD needs WebGL2 on the graphics chip.<br><br>' + String(e.message || e).slice(0, 300);
    const st = el('style', '', document.head);
    st.textContent = CSS;
  }
}
let lastErr = '';
function draw() {
  try {
    renderFrame();
  } catch (e) {
    if (e && e.message !== lastErr) { lastErr = e.message; console.error('ink error:', e); }
  }
}
function windowResized() { W = 0; }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
})();
