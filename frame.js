// noprotect
(function () {
// FRAME · a live instrument that takes pictures apart (sibling of the camera polychoron and ink field)
// Your images, a video or the camera, cut into tiles, strips and shards, folded, woven, pushed, rippled and
// put inside themselves, with a print finish (halftone, riso, dither, lines, xerox, ink). The music drives the effects.
// Paste into editor.p5js.org (p5 v1 or v2). Needs WebGL2 (any recent iPhone, Android or computer browser).
//
// TOP BAR   source (image, video, camera) · add (images or a video) · music · mic · rec
//           bpm (beat clock: auto / off) · react (calm / groove / wild) · colour · ui (hide) · menu
// DOCK      mondrian shatter puzzle strips weave turn fold / push lens ripple collage droste mirror warhol
//           (tap = on / off, hold = only while held, drag up / down while holding = amount; the amount bar also has
//           music on / off and, for some effects, a style button)
//           looks 1-4 (tap = recall, hold = save) · print (tap = next finish, hold = its amount and style) · hit · freeze · next
// TOUCH     drag = move the centre (or push the picture, with push on) · tap = next image · double tap = centre back
// SOUND     kick = shards fly, a tile slides, cells turn, strips shift, folds breathe, lenses pulse, ripples start ·
//           snare = the stretch line jumps, warhol colours change, the photocopy jumps · the energy of the song sets how
//           strong (the amount = the maximum) · only effects with music on follow it; the picture itself never moves with it
// KEYS      Q W E R T Y U = mondrian shatter puzzle strips weave turn fold · A S D G J K L = push lens ripple collage droste
//           mirror warhol (hold = while held) · O next print finish · P style · 1-4 looks (shift = save) · X or → next image ·
//           Z freeze · M react · V colour · ; beat clock · B tap tempo · 0 everything off · space play · H hide · F full screen · N random
// Uses p5 only for setup / draw; everything else is plain WebGL2 + Web Audio, inside one function (no name clashes).

// ---------------------------------------------------------------- state
const P = {                       // the settings (sliders), all saved in looks
  zoom: 1.0,                      // zoom into the picture
  scale: 0.5,                     // size of the print screen (halftone dots, lines, dither pixels)
  move: 0.5,                      // how fast the effects move by themselves (without music)
  contrast: 1.0,
  bright: 0.0,
  sat: 1.0,                       // colour amount
  grain: 0.3,                     // paper grain
  fade: 0.6,                      // seconds of crossfade between images (0 = cut)
  sens: 1.0,                      // sound sensitivity
};
const PDEF = Object.assign({}, P);
const SLIDERS = [
  ['zoom', 'zoom', 1, 3, 0.01],
  ['scale', 'print size · fine ←→ coarse', 0, 1, 0.01],
  ['move', 'drift · the tempo without music', 0, 1, 0.01],
  ['contrast', 'contrast', 0.5, 2, 0.01],
  ['bright', 'brightness', -0.4, 0.4, 0.01],
  ['sat', 'colour amount', 0, 2, 0.01],
  ['grain', 'paper grain', 0, 1, 0.01],
  ['fade', 'image crossfade · seconds', 0, 3, 0.05],
  ['sens', 'sound sensitivity', 0.2, 3, 0.01],
];
const SOURCES = ['image', 'video', 'camera'];
const PAPER = [244, 240, 230], INKC = [16, 16, 20];
const COLS = [                    // original, grey, or two colours (dark parts -> first, light parts -> second)
  { name: 'original' },
  { name: 'mono' },
  { name: 'ink', dark: INKC, light: PAPER },
  { name: 'sepia', dark: [52, 32, 18], light: [240, 230, 212] },
  { name: 'indigo', dark: [16, 26, 74], light: [234, 238, 246] },
  { name: 'blood', dark: [70, 6, 10], light: [246, 226, 222] },
  { name: 'ember', dark: [12, 10, 10], light: [255, 90, 31] },
  { name: 'neon', dark: [4, 4, 10], light: [60, 255, 220] },
];
const FX = ['mondrian', 'shatter', 'puzzle', 'strips', 'weave', 'turn', 'fold',
  'push', 'lens', 'ripple', 'collage', 'droste', 'mirror', 'warhol'];
const PRINTS = ['halftone', 'riso', 'dither', 'lines', 'xerox', 'ink'];   // the print finish: one at a time (the print button)
const FX_ALL = FX.concat(PRINTS);
let printMode = -1;
const fxOn = {}, fxAmt = {}, fxMus = {}, fxVar = {};
for (const f of FX_ALL) { fxOn[f] = false; fxAmt[f] = 0.5; fxMus[f] = true; fxVar[f] = 0; }   // fxMus: follows the music · fxVar: style
fxAmt.mirror = 0.3;
const FX_LABEL = {};
const MOND_PALS = [               // mondrian: 'parts' = every rectangle shows a part of the picture; the others add some cells of flat colour
  { name: 'parts', none: true, c: null, line: [14, 14, 16] },
  { name: 'classic', c: [[214, 36, 32], [246, 206, 30], [26, 54, 148], [238, 235, 226]], line: [14, 14, 16] },
  { name: 'mono', c: [[54, 54, 56], [128, 128, 130], [196, 196, 194], [238, 237, 233]], line: [10, 10, 12] },
  { name: 'ember', c: [[255, 90, 31], [180, 46, 18], [28, 26, 26], [236, 228, 216]], line: [12, 10, 10] },
  { name: 'pastel', c: [[240, 170, 162], [246, 222, 156], [164, 194, 226], [246, 242, 234]], line: [40, 40, 46] },
  { name: 'neon', c: [[255, 40, 140], [60, 255, 220], [255, 238, 40], [18, 16, 28]], line: [6, 6, 10] },
  { name: 'image', c: null, line: [14, 14, 16] },
];
const RISO = [                    // riso inks (2 or 3 drums)
  { name: 'pink + blue', c: [[255, 72, 176], [0, 120, 191]] },
  { name: 'pink yellow blue', c: [[255, 72, 176], [255, 232, 0], [0, 120, 191]] },
  { name: 'red + teal', c: [[255, 102, 94], [0, 157, 165]] },
  { name: 'orange + navy', c: [[255, 108, 47], [40, 50, 110]] },
  { name: 'green + purple', c: [[0, 169, 92], [118, 91, 167]] },
];
const WARHOL = [                  // warhol: six colour sets of (shadow, middle, light), one per tile
  { name: 'pop', c: [[30, 30, 90], [230, 60, 140], [255, 220, 40]], d: [[20, 20, 20], [255, 120, 0], [120, 220, 255]], e: [[60, 0, 90], [0, 200, 120], [255, 250, 200]],
    f: [[0, 40, 120], [255, 80, 60], [250, 240, 90]], g: [[90, 20, 20], [60, 160, 255], [255, 180, 200]], h: [[10, 60, 60], [250, 200, 0], [255, 90, 180]] },
  { name: 'acid', c: [[0, 0, 0], [255, 0, 170], [0, 255, 200]], d: [[0, 0, 0], [255, 230, 0], [120, 0, 255]], e: [[10, 0, 30], [0, 255, 90], [255, 80, 0]],
    f: [[0, 0, 0], [0, 170, 255], [255, 255, 255]], g: [[20, 0, 0], [255, 60, 60], [255, 240, 0]], h: [[0, 0, 20], [180, 255, 0], [255, 0, 255]] },
  { name: 'soft', c: [[90, 80, 110], [240, 170, 170], [250, 240, 220]], d: [[60, 90, 100], [160, 210, 200], [250, 245, 230]], e: [[110, 70, 60], [240, 200, 140], [255, 248, 235]],
    f: [[70, 70, 110], [180, 180, 240], [250, 250, 255]], g: [[100, 60, 90], [230, 160, 210], [255, 240, 245]], h: [[60, 90, 60], [190, 220, 150], [250, 252, 235]] },
];
const VARIANTS = {                // the style button in the amount bar
  halftone: ['colour', 'black'], lines: ['straight', 'wave', 'rings'], dither: ['mono', 'colour'], xerox: ['black', 'blue'],
  riso: RISO.map((r) => r.name), warhol: WARHOL.map((w) => w.name), mondrian: MOND_PALS.map((m) => m.name),
  stretch: ['down', 'sideways'], droste: ['frame', 'spiral'], collage: ['mixed', 'squares', 'circles', 'strips', 'triangles'],
};
let mondAlpha = 0.6;
const CHANGES = [['tap only', 0, 0], ['every beat', 1, 2], ['every bar', 4, 4], ['every 4 bars', 16, 8]];   // [name, beats, seconds without music]
let srcMode = 0, colMode = 0, changeMode = 0, frozen = false;     // images change only when you tap (unless chosen in menu · source)
let frameNo = 0, simTime = 0, driftT = 0, lastT = 0;
let centre = { x: 0.5, y: 0.5 }, rotA = 0;
let sortSeed = 1, autoT = 0;

// ---------------------------------------------------------------- WebGL
let cv, gl, W = 0, H = 0, aspect = 1, dpr = 1, resScale = 1;
let progCmp, progShow, progDisp, quadVao;
let dispTex = [null, null], dispFbo = [null, null], dispCur = 0, dispW = 0, dispH = 0, dispK = 0.5, dispFloat = false;
let cmpTex = [null, null], cmpFbo = [null, null], cmpCur = 0;
let camTex = null, camReady = false, vidTex = null, vidReady = false, plate = null;
let glOk = true, clearNow = true;

const QUAD_VS = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// 1. compose: the picture taken apart and moved — pushed, rippled, lensed, folded, cut into tiles, strips and shards
const CMP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA, uB, uI1, uI2, uI3, uDisp;
uniform vec2 uScaleA, uScaleB, uS1, uS2, uS3, uC, uXOff;
uniform float uCN, uCLine;
uniform vec4 uCP[8], uCQ[8];
uniform vec3 uCLC;
uniform float uFlipA, uFlipB, uMixAB, uAspect, uZoom, uRot, uMirror, uWarN, uXAng, uTime;
uniform float uPush, uDispK;
uniform float uLN;
uniform vec4 uL[5];
uniform float uRpN;
uniform vec4 uRp[6];
uniform float uDro, uDroT, uDroTw;
uniform float uFold, uFoldN, uFoldA;
uniform float uPuz, uPuzN, uPuzFrom, uPuzTo, uPuzT, uPuzSrc;
uniform float uPerm[36];
uniform float uTurn, uTurnN, uTurnA, uTurnB, uTurnT;
uniform float uStr, uStrN, uStrA, uStrB, uStrT, uStrAmp;
uniform float uSha, uShaN, uShaSeed, uShaE;
uniform float uStre, uStreY, uStreLen, uStreDir;
uniform float uWea, uWeaN, uWeaSx, uWeaSy;
out vec4 o;
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 mrep(vec2 t) { vec2 m = mod(t, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }   // beyond the edge: mirror, never smear
vec3 pick(sampler2D s, vec2 uv, vec2 sc, float flip) {
  vec2 t = (uv - 0.5) * sc + 0.5;                                    // cover the screen without stretching
  if (flip > 0.5) t.x = 1.0 - t.x;
  t = mrep(t);
  return texture(s, vec2(t.x, 1.0 - t.y)).rgb;
}
vec3 srcAB(vec2 uv) {
  vec3 a = pick(uA, uv, uScaleA, uFlipA);
  if (uMixAB < 0.001) return a;
  return mix(a, pick(uB, uv, uScaleB, uFlipB), uMixAB);            // crossfade to the next image
}
vec2 place(vec2 p) {                                                  // zoom, warhol grid, photocopy skew, mirror
  vec2 asp = vec2(uAspect, 1.0);
  vec2 v = p;
  if (uWarN > 0.5) v = fract(p * uWarN);
  vec2 q = (v - uC) * asp / uZoom;
  float ra = uXAng + uRot;                                            // photocopy skew + the two-finger twist
  if (ra != 0.0) { float cs = cos(ra), sn = sin(ra); q = mat2(cs, sn, -sn, cs) * q; }
  if (uMirror > 0.5) { q.x = -abs(q.x); if (uMirror > 1.5) q.y = -abs(q.y); }
  return q / asp + uC + uXOff;
}
float ease(float t) { t = clamp(t, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec3 piece(float k, vec2 uv) {                                       // a collage piece: from one of the images of the set
  if (k < 0.5) return srcAB(uv);
  if (k < 1.5) return pick(uI1, uv, uS1, 0.0);
  if (k < 2.5) return pick(uI2, uv, uS2, 0.0);
  return pick(uI3, uv, uS3, 0.0);
}
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdTri(vec2 p, float r) {
  const float k3 = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r / k3;
  if (p.x + k3 * p.y > 0.0) p = vec2(p.x - k3 * p.y, -k3 * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
float shapeD(float t, vec2 l, vec2 sz) {                              // rectangle, circle, triangle, half circle, strip
  if (t < 0.5) return sdBox(l, sz);
  if (t < 1.5) return length(l) - sz.x;
  if (t < 2.5) return sdTri(l, sz.x);
  if (t < 3.5) return max(length(l) - sz.x, l.y);
  return sdBox(l, vec2(sz.x * 2.2, sz.y * 0.28));
}
void main() {
  vec2 asp = vec2(uAspect, 1.0);
  vec2 p = vUv;
  float shade = 1.0, gap = 0.0;                                       // gap: 1 = the dark background shows through
  if (uPush > 0.5) p -= (texture(uDisp, vUv).xy - uDispK) * 2.0;     // push: your finger moved the picture like wet paint
  if (uRpN > 0.5) {                                                   // ripple: rings spreading from where the kicks fell
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uRpN) break;
      vec4 r = uRp[i];
      vec2 d = (p - r.xy) * asp;
      float dist = length(d), front = r.z * 0.32;
      float env = exp(-pow((dist - front) / 0.09, 2.0)) * exp(-r.z * 1.3) * r.w;
      p += normalize(d + 1e-5) / asp * sin((dist - front) * 55.0) * env * 0.05;
    }
  }
  if (uLN > 0.5) {                                                    // lens: wandering magnifying bulges and pinches
    for (int i = 0; i < 5; i++) {
      if (float(i) >= uLN) break;
      vec4 l = uL[i];
      vec2 d = (p - l.xy) * asp;
      float r = length(d) / l.z;
      if (r < 1.0) { float f = 1.0 - r * r; d *= 1.0 - l.w * f * f; p = l.xy + d / asp; }
    }
  }
  if (uDro > 0.0) {                                                   // droste: the picture inside itself, forever, zooming in
    vec2 q = (p - uC) * asp;
    float n = max(abs(q.x) / (uAspect * 0.5), abs(q.y) * 2.0) + 1e-5;
    float z = log(n) / log(uDro) + uDroT;
    float j = floor(z);
    q *= pow(uDro, -(j - uDroT));
    float a = j * uDroTw;
    q = mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
    float n2 = max(abs(q.x) / (uAspect * 0.5), abs(q.y) * 2.0);
    if (n2 > 0.985) gap = 0.85;                                       // the frame around each picture
    p = q / asp + uC;
  }
  if (uFold > 0.0) {                                                  // fold: an accordion of paper, opening and closing
    float k = floor(p.x * uFoldN), lx = fract(p.x * uFoldN);
    float c = cos(uFoldA), s = sin(uFoldA);
    p.x = 0.5 + ((k + lx) - uFoldN * 0.5) / (uFoldN * c);
    float odd = mod(k, 2.0);
    float tilt = (lx - 0.5) * (odd > 0.5 ? 1.0 : -1.0) * s * 0.12;
    p.y = 0.5 + (p.y - 0.5) * (1.0 + tilt);
    shade = odd > 0.5 ? 1.0 - 0.85 * s * (0.55 + 0.45 * lx) : 1.0 - 0.2 * s * (1.0 - lx) + 0.12 * s * lx;
    shade *= 1.0 - 0.35 * s * pow(abs(lx - 0.5) * 2.0, 6.0);
  }
  if (uPuz > 0.0) {                                                   // puzzle: tiles slide into the empty place
    vec2 g = p * uPuzN;
    vec2 cell = floor(g);
    float idx = cell.x + cell.y * uPuzN;
    vec2 fc = vec2(mod(uPuzFrom, uPuzN), floor(uPuzFrom / uPuzN)), tc = vec2(mod(uPuzTo, uPuzN), floor(uPuzTo / uPuzN));
    vec2 mp = mix(fc, tc, ease(uPuzT));
    vec2 ml = g - mp;
    vec2 local = fract(g);
    float src = -1.0;
    if (uPuzT >= 0.0 && ml.x >= 0.0 && ml.x < 1.0 && ml.y >= 0.0 && ml.y < 1.0) { src = uPuzSrc; local = ml; }
    else if (uPuzT >= 0.0 && (idx == uPuzFrom || idx == uPuzTo)) src = -1.0;
    else { int ii = int(idx); src = (ii >= 0 && ii < 36) ? uPerm[ii] : -1.0; }
    if (src < 0.0) gap = 1.0;
    else {
      vec2 sc = vec2(mod(src, uPuzN), floor(src / uPuzN));
      p = (sc + local) / uPuzN;
      float e = min(min(local.x, local.y), min(1.0 - local.x, 1.0 - local.y));
      shade *= 0.6 + 0.4 * smoothstep(0.0, 0.025, e);                // the tile edge
    }
  }
  if (uTurn > 0.0) {                                                  // turn: square cells click round by quarter turns
    vec2 q = p * asp * uTurnN;
    vec2 cell = floor(q);
    vec2 l = fract(q) - 0.5;
    float a0 = floor(h2(cell + uTurnA) * 4.0) * 1.5708, a1 = floor(h2(cell + uTurnB) * 4.0) * 1.5708;
    float t = ease((uTurnT - h2(cell + 7.7) * 0.45) / 0.55);
    float a = mix(a0, a1, t);
    l = mat2(cos(a), sin(a), -sin(a), cos(a)) * l;
    float e = 0.5 - max(abs(l.x), abs(l.y));
    shade *= 0.7 + 0.3 * smoothstep(0.0, 0.03, e);
    p = (cell + 0.5 + l) / uTurnN / asp;
  }
  if (uStr > 0.0) {                                                   // strips: shredded, each strip slides up or down
    float k = floor(p.x * uStrN), lx = fract(p.x * uStrN);
    float o0 = (h2(vec2(k, uStrA)) - 0.5), o1 = (h2(vec2(k, uStrB)) - 0.5);
    p.y += mix(o0, o1, ease(uStrT)) * uStrAmp + sin(uTime * 0.6 + k * 1.7) * 0.004;
    if (lx < 0.06 || p.y < 0.0 || p.y > 1.0) gap = 1.0;
    shade *= 0.8 + 0.2 * sin(lx * 3.1416);
  }
  if (uSha > 0.0) {                                                   // shatter: glass shards, shifted and turned
    vec2 q = p * asp * uShaN;
    vec2 ip = floor(q);
    float d1 = 9.0, d2 = 9.0;
    vec2 best = vec2(0.0), bc = vec2(0.0);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 c = ip + vec2(float(i), float(j));
        vec2 pt = c + 0.5 + 0.4 * (vec2(h2(c + uShaSeed), h2(c + uShaSeed + 31.0)) - 0.5) * 2.0;
        float d = length(q - pt);
        if (d < d1) { d2 = d1; d1 = d; best = pt; bc = c; } else if (d < d2) d2 = d;
      }
    }
    float r = h2(bc + 5.3);
    vec2 dir = normalize(best / uShaN - uC * asp + 1e-4);
    vec2 l = q - best;
    float a = (r - 0.5) * uShaE * 1.2;
    l = mat2(cos(a), sin(a), -sin(a), cos(a)) * l;
    vec2 qs = best + l - dir * uShaE * (0.6 + 1.4 * r) * uShaN * 0.12;
    p = qs / uShaN / asp;
    float edge = d2 - d1;
    if (edge < 0.04 + uShaE * 0.25) gap = 1.0;                       // the cracks open as the shards fly apart
    else if (edge < 0.09 + uShaE * 0.25) shade *= 1.25;               // a bright glass edge
    shade *= 0.85 + 0.3 * r;
  }
  if (uStre > 0.0) {                                                  // stretch: one line of the picture pulled across
    float c = uStreDir > 0.5 ? p.x : p.y;
    if (c < uStreY && c > uStreY - uStreLen) { if (uStreDir > 0.5) p.x = uStreY; else p.y = uStreY; }
  }
  vec3 col;
  if (uWea > 0.0) {                                                   // weave: strips of two pictures, over and under
    float bw = 1.0 / uWeaN;
    float i = floor((p.y + uWeaSy) / bw), j = floor((p.x * uAspect + uWeaSx) / bw);
    float ly = fract((p.y + uWeaSy) / bw), lx = fract((p.x * uAspect + uWeaSx) / bw);
    bool over = mod(i + j, 2.0) < 0.5;
    vec2 pp = place(p);
    if (over) { col = srcAB(pp); shade *= 0.72 + 0.28 * sin(ly * 3.1416); if (ly < 0.05 || ly > 0.95) gap = 0.9; }
    else { col = pick(uI1, pp, uS1, 0.0); shade *= 0.72 + 0.28 * sin(lx * 3.1416); if (lx < 0.05 || lx > 0.95) gap = 0.9; }
  } else col = srcAB(place(p));
  col *= shade;
  col = mix(col, vec3(0.04, 0.04, 0.045), gap);
  if (uCN > 0.5) {                                                    // collage: clean geometric cut-outs laid on top, each from another picture
    float px = 1.0 / 900.0;
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uCN) break;
      vec4 cp = uCP[i], cq = uCQ[i];                                  // cp: x, y, w, h · cq: angle, image, kind, zoom
      float cs = cos(cq.x), sn = sin(cq.x);
      mat2 R = mat2(cs, -sn, sn, cs);
      vec2 l = R * ((vUv - cp.xy) * asp);
      vec2 ls = R * ((vUv - cp.xy - vec2(0.008, -0.011)) * asp);
      float d = shapeD(cq.z, l, cp.zw), ds = shapeD(cq.z, ls, cp.zw);
      if (d < 0.0) {
        col = piece(cq.y, cp.xy + (vUv - cp.xy) / cq.w + vec2(sin(float(i) * 2.3 + cq.y), cos(float(i) * 1.7 - cq.y)) * 0.22);
        if (uCLine > 0.0 && d > -uCLine * px * 4.0) col = uCLC;        // a clean outline
      } else if (ds < 0.0) col *= 0.55;                               // a hard shadow
    }
  }
  o = vec4(col, 1.0);
}`;

// the push field: where your finger (or a kick) pushed the picture; it slowly flows back
const DISP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevD;
uniform vec2 uPos, uVel;
uniform float uOn, uRad, uRelax, uAsp, uK;
out vec4 o;
void main() {
  vec2 d = texture(uPrevD, vUv).xy - uK;
  d = sign(d) * max(abs(d) * uRelax - (uK > 0.0 ? 0.0015 : 0.0), 0.0);          // flows back (8-bit buffers: step down to zero)
  if (uOn > 0.5) {
    vec2 r = (vUv - uPos) * vec2(uAsp, 1.0);
    d += uVel * exp(-dot(r, r) / (uRad * uRad)) * 0.5;
  }
  d = clamp(d, -0.24, 0.24);
  o = vec4(d + uK, 0.0, 1.0);
}`;

// 2. on screen: mondrian windows, colour, warhol, photocopy, then the print finish (riso, ink, halftone, lines, dither)
const SHOW_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCmp;
uniform vec2 uRes, uC;
uniform float uContrast, uBright, uSat, uGrain, uTime, uPal;
uniform vec3 uDark, uLight, uPaper;
uniform float uInk, uInkThr, uHalf, uLines, uDither, uCell, uAng, uLineT;
uniform float uRiso, uRDens;
uniform vec3 uRI[3];
uniform vec2 uROff[3];
uniform float uXerox, uXSeed, uXAmt;
uniform float uWarN, uWShift;
uniform vec3 uWP[18];
uniform float uRN, uLineW, uMAlpha;
uniform vec4 uR[32], uRC[32], uRO[32];
uniform vec3 uLineC;
out vec4 o;
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec2 mrep(vec2 t) { vec2 m = mod(t, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
float bayer(vec2 p) {                                                 // 4 x 4 ordered dither threshold
  vec2 c = mod(floor(p), 4.0);
  int i = int(c.x) + int(c.y) * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
// the picture at uv, with colour, warhol and photocopy applied (called once per print plate)
vec3 shade(vec2 uv) {
  vec3 col = texture(uCmp, uv).rgb;
  col = (col - 0.5) * uContrast + 0.5 + uBright;
  float L = clamp(lum(col), 0.0, 1.0);
  col = mix(vec3(L), col, uSat);
  if (uPal > 1.5) col = mix(uDark, uLight, smoothstep(0.0, 1.0, L));
  else if (uPal > 0.5) col = vec3(L);
  if (uWarN > 0.5) {                                                  // warhol: each tile its own three screen-print colours
    vec2 t = floor(vUv * uWarN);
    float k = mod(t.x + t.y * uWarN + uWShift, 6.0);
    int b = int(k) * 3;
    float l = clamp(lum(col), 0.0, 1.0);
    col = l < 0.33 ? uWP[b] : (l < 0.62 ? uWP[b + 1] : uWP[b + 2]);
  }
  if (uXerox > 0.5) {                                                 // photocopy: hard contrast, streaks, toner
    float l = lum(col);
    float streak = (vn(vec2(vUv.x * 60.0, uXSeed)) - 0.5) * 0.35 * uXAmt + (vn(vec2(vUv.x * 9.0, uXSeed + 3.0)) - 0.5) * 0.2;
    float w = 0.2 - 0.12 * uXAmt;                                     // more = harsher copy
    float t = smoothstep(0.36 - w, 0.36 + w, l + streak * 0.5);
    vec2 e = abs(vUv - 0.5) * 2.0;
    t *= 1.0 - smoothstep(0.86, 1.0, max(e.x, e.y)) * 0.6;            // grey copier edges
    vec3 toner = uXerox > 1.5 ? vec3(0.08, 0.2, 0.55) : vec3(0.06);
    col = mix(toner, uPaper, t);
  }
  return clamp(col, 0.0, 1.0);
}
// how much ink a print screen puts down for coverage v (0..1) at pixel p, screen turned by a
float screenOf(float v, vec2 p, float a) {
  if (uHalf > 0.5) {                                                  // halftone dots
    float cs = cos(a), sn = sin(a);
    vec2 r = mat2(cs, -sn, sn, cs) * p / uCell;
    vec2 c = fract(r) - 0.5;
    float rad = sqrt(clamp(v, 0.0, 1.0)) * 0.62;
    float aa = 1.2 / uCell;
    return smoothstep(rad + aa, rad - aa, length(c));
  }
  if (uLines > 0.5) {                                                 // engraving lines: thicker where it is darker
    float cs = cos(a), sn = sin(a);
    vec2 r = mat2(cs, -sn, sn, cs) * p / uCell;
    float y = r.y;
    if (uLines > 1.5 && uLines < 2.5) y += sin(r.x * 0.35 + uLineT) * 0.9;                       // wave
    if (uLines > 2.5) y = length((p / uRes - uC) * vec2(uRes.x / uRes.y, 1.0)) * uRes.y / uCell; // rings around the centre
    float d = abs(fract(y) - 0.5);
    float w = clamp(v, 0.0, 1.0) * 0.5;
    float aa = 1.0 / uCell;
    return smoothstep(w + aa, w - aa, d);
  }
  if (uDither > 0.5) return step(bayer(p / max(1.0, uCell * 0.25)), v);   // dither: pixels on or off
  return v;
}
bool anyScreen() { return uHalf > 0.5 || uLines > 0.5 || uDither > 0.5; }
void main() {
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 uv = vUv;
  float mk = 0.0;                                                     // what goes on top: 1 colour cell, 2 colour from the picture, 3 line
  vec4 mc = vec4(0.0);
  if (uRN > 0.5) {                                                    // mondrian: each rectangle is a window onto another part of the picture
    for (int i = 0; i < 32; i++) {
      if (float(i) >= uRN) break;
      vec4 r = uR[i];
      if (vUv.x >= r.x && vUv.x <= r.z && vUv.y >= r.y && vUv.y <= r.w) {
        mc = uRC[i];
        vec4 ro = uRO[i];
        vec2 cc = (r.xy + r.zw) * 0.5;
        uv = mrep(cc + (vUv - cc) / ro.z + ro.xy);
        if (mc.a > 1.5) { mk = 2.0; mc.rgb = texture(uCmp, cc).rgb * 1.15; }
        else if (mc.a > 0.5) mk = 1.0;
        vec2 pa = (vUv - r.xy) * uRes, pb = (r.zw - vUv) * uRes;
        if (min(min(pa.x, pa.y), min(pb.x, pb.y)) < uLineW) mk = 3.0;
        break;
      }
    }
  }
  // the print
  vec2 px = gl_FragCoord.xy;
  vec3 col;
  if (uRiso > 0.5) {                                                  // riso: 2 or 3 ink drums, each slightly out of register
    vec3 paper = uPaper, outc = paper;
    int n = uRiso > 2.5 ? 3 : 2;
    vec3 a0 = 1.0 - uRI[0], a1 = 1.0 - uRI[1], a2 = 1.0 - uRI[2];     // what each ink takes away from white
    for (int k = 0; k < 3; k++) {
      if (k >= n) break;
      vec3 c = shade(uv + uROff[k]);
      vec3 ab = 1.0 - c;                                              // what the picture takes away from white
      float cov;
      if (n == 3) { mat3 M = mat3(a0, a1, a2); vec3 x = inverse(M) * ab; cov = k == 0 ? x.x : (k == 1 ? x.y : x.z); }
      else {                                                          // two inks: the best mix of the two
        float m00 = dot(a0, a0), m01 = dot(a0, a1), m11 = dot(a1, a1), b0 = dot(a0, ab), b1 = dot(a1, ab);
        float det = m00 * m11 - m01 * m01;
        float x0 = (b0 * m11 - b1 * m01) / det, x1 = (m00 * b1 - m01 * b0) / det;
        cov = k == 0 ? x0 : x1;
      }
      cov = clamp(cov * uRDens, 0.0, 1.0);
      cov = anyScreen() ? screenOf(cov, px + uROff[k] * uRes, 0.26 + float(k) * 0.52 + uAng) : cov * (0.86 + 0.28 * h2(px * 0.5 + float(k)));
      vec3 ink = k == 0 ? uRI[0] : (k == 1 ? uRI[1] : uRI[2]);
      outc *= mix(vec3(1.0), ink, cov * 0.92);
    }
    col = outc;
  } else {
    col = shade(uv);
    float L = clamp(lum(col), 0.0, 1.0);
    vec3 dk = uDark, lt = uXerox > 0.5 ? uPaper : uLight;
    if (uInk > 0.0) {                                                 // ink: two colours, like a print
      float cov = anyScreen() ? screenOf(1.0 - L, px, 0.785 + uAng) : step(uInkThr, 1.0 - L + (h2(floor(px)) - 0.5) * 0.28);
      col = mix(lt, dk, cov);
    } else if (uHalf > 1.5 || uLines > 0.5 || (uDither > 0.5 && uDither < 1.5)) {   // one-colour screens
      col = mix(lt, dk, screenOf(1.0 - L, px, 0.785 + uAng));
    } else if (uHalf > 0.5) {                                         // colour halftone: cyan, magenta, yellow and black dots
      vec3 a = 1.0 - col;
      float kk = min(a.r, min(a.g, a.b));
      a = (a - kk) / max(1.0 - kk, 0.001);
      float c = screenOf(a.r * 0.9, px, 0.262 + uAng), m = screenOf(a.g * 0.9, px, 1.309 + uAng), y = screenOf(a.b * 0.9, px, uAng);
      float kd = screenOf(kk, px, 0.785 + uAng);
      col = uPaper * (1.0 - vec3(c, m, y) * vec3(1.0, 1.0, 1.0) * 0.95) * (1.0 - kd * 0.92);
    } else if (uDither > 1.5) {                                       // colour dither: each colour on or off
      float t = bayer(px / max(1.0, uCell * 0.25));
      col = step(vec3(t), col);
    }
  }
  if (mk == 1.0 || mk == 2.0) col = mix(col, mc.rgb, uMAlpha);         // mondrian colour over the picture (strength = how solid)
  if (mk == 3.0) col = uLineC;
  col += (h2(px + uTime) - 0.5) * uGrain * 0.12 + (vn(px * 0.35) - 0.5) * uGrain * 0.05;           // paper grain
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
function makeTex() {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function initGL() {
  cv = document.createElement('canvas');
  cv.id = 'frame';
  cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;touch-action:none;display:block';
  document.body.appendChild(cv);
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  gl = cv.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('This browser has no WebGL2.');
  progCmp = program(QUAD_VS, CMP_FS);
  progShow = program(QUAD_VS, SHOW_FS);
  progDisp = program(QUAD_VS, DISP_FS);
  dispFloat = !!gl.getExtension('EXT_color_buffer_float');
  quadVao = gl.createVertexArray();
  camTex = makeTex(); vidTex = makeTex();
  plate = makePlate();
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glOk = false; });
  cv.addEventListener('webglcontextrestored', () => { location.reload(); });
}

// two full-size buffers for the picture, and the push field
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
  // the push field: a quarter of the size, as precise as the phone allows
  dispW = Math.max(2, Math.floor(W / 4)); dispH = Math.max(2, Math.floor(H / 4));
  for (let i = 0; i < 2; i++) {
    if (dispTex[i]) gl.deleteTexture(dispTex[i]);
    if (dispFbo[i]) gl.deleteFramebuffer(dispFbo[i]);
    dispTex[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, dispTex[i]);
    let ok = false;
    dispFbo[i] = gl.createFramebuffer();
    if (dispFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, dispW, dispH, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dispFbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dispTex[i], 0);
      ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      if (!ok) dispFloat = false;
    }
    if (!ok) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, dispW, dispH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dispFbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dispTex[i], 0);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  dispK = dispFloat ? 0 : 0.5;
  clearPush();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  clearTrails();
}
function clearPush() {
  for (let i = 0; i < 2; i++) {
    if (!dispFbo[i]) continue;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dispFbo[i]);
    gl.clearColor(dispK, dispK, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function clearTrails() { clearNow = true; }

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2) * resScale;
  const w = Math.max(2, Math.floor(window.innerWidth * dpr)), h = Math.max(2, Math.floor(window.innerHeight * dpr));
  if (w === W && h === H) return;
  W = w; H = h;
  cv.width = W; cv.height = H;
  aspect = W / H;
  buildBuffers();
}

// ---------------------------------------------------------------- sources: images, a video, the camera
const MAX_IMG = 16, IMG_LONG = 1400;
const imgs = [];                                  // { tex, w, h }
let idxA = 0, idxB = 0, mixAB = 0, fading = false;
function texFrom(canvasOrImg) {
  const t = makeTex();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasOrImg);
  return t;
}
// the picture before anything is loaded
function makePlate() {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1200;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e6df'; g.fillRect(0, 0, 1200, 1200);
  g.fillStyle = '#111214';
  for (let i = 0; i < 26; i++) { g.fillRect(0, i * 46, 1200, 14 + (i % 5) * 4); }
  g.save();
  g.beginPath(); g.arc(600, 560, 330, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#e9e6df'; g.fillRect(0, 0, 1200, 1200);
  for (let r = 330; r > 0; r -= 26) {
    g.beginPath(); g.arc(600 + (330 - r) * 0.35, 560 - (330 - r) * 0.2, r, 0, Math.PI * 2);
    g.fillStyle = (r / 26) % 2 < 1 ? '#111214' : '#e9e6df'; g.fill();
  }
  g.restore();
  g.fillStyle = '#ff5a1f'; g.fillRect(140, 930, 920, 46);
  g.fillStyle = '#111214'; g.fillRect(140, 1000, 920, 120);
  g.fillStyle = '#e9e6df';
  g.font = '600 64px ui-monospace, Menlo, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('F R A M E', 600, 1046);
  g.fillStyle = '#111214'; g.font = '30px ui-monospace, Menlo, monospace';
  g.fillText('+ ADD  YOUR  IMAGES', 600, 160);
  return { tex: texFrom(c), w: 1200, h: 1200 };
}
function addImageFile(file) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, IMG_LONG / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      if (imgs.length >= MAX_IMG) { const old = imgs.shift(); gl.deleteTexture(old.tex); idxA = 0; idxB = 0; fading = false; mixAB = 0; }
      imgs.push({ tex: texFrom(c), w: c.width, h: c.height });
      URL.revokeObjectURL(im.src);
      resolve(true);
    };
    im.onerror = () => { URL.revokeObjectURL(im.src); resolve(false); };
    im.src = URL.createObjectURL(file);
  });
}
async function addFiles(list) {
  let nImg = 0, bad = 0, vid = null;
  for (const f of Array.from(list)) {
    const t = f.type || '', n = f.name || '';
    if (/^video\//.test(t) || /\.(mp4|mov|m4v|webm)$/i.test(n)) { vid = f; continue; }
    if (await addImageFile(f)) nImg++; else bad++;
  }
  if (vid) { loadVideo(vid); srcMode = 1; }
  else if (nImg) { idxA = imgs.length - nImg; idxB = idxA; fading = false; mixAB = 0; srcMode = 0; }
  note((nImg ? nImg + ' image' + (nImg > 1 ? 's' : '') + ' added · ' + imgs.length + ' in the set' : (vid ? 'video loaded' : 'nothing added')) + (bad ? ' · ' + bad + ' could not be read' : ''));
  sourceChanged();
}
function clearImages() {
  for (const im of imgs) { gl.deleteTexture(im.tex); }
  imgs.length = 0; idxA = 0; idxB = 0; mixAB = 0; fading = false;
  refreshTop();
}
function nextImage() {
  autoT = 0;
  if (imgs.length < 2 || SOURCES[srcMode] !== 'image') return;
  if (fading) { idxA = idxB; mixAB = 0; }
  idxB = (idxA + 1) % imgs.length;
  if (P.fade <= 0.02) { idxA = idxB; mixAB = 0; fading = false; }
  else { fading = true; mixAB = 0; }
}
function updateImages(dt) {
  if (!fading) return;
  mixAB += dt / Math.max(0.02, P.fade);
  if (mixAB >= 1) { idxA = idxB; mixAB = 0; fading = false; }
}

let vidEl = null, vidUploadT = 0;
function loadVideo(file) {
  if (!vidEl) {
    vidEl = document.createElement('video');
    vidEl.muted = true; vidEl.loop = true; vidEl.playsInline = true;
    vidEl.setAttribute('playsinline', ''); vidEl.setAttribute('muted', '');
  }
  if (vidEl.src && vidEl.src.startsWith('blob:')) URL.revokeObjectURL(vidEl.src);
  vidReady = false;
  vidEl.src = URL.createObjectURL(file);
  const pr = vidEl.play();
  if (pr && pr.catch) pr.catch(() => note('tap the picture to start the video'));
}
let video = null, camStream = null, camFacing = 'user', camOn = false, camUploadT = 0;
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
  } catch (e) {
    camOn = false;
    note('camera blocked · allow it in the browser');
  }
}
function stopCamera() {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null; camOn = false; camReady = false;
}
// the moving sources go to the graphics chip about 30 times a second
function uploadMoving() {
  const now = performance.now(), s = SOURCES[srcMode];
  if (s === 'camera' && camOn && video && video.readyState >= 2 && video.videoWidth && now - camUploadT >= 30) {
    camUploadT = now;
    gl.bindTexture(gl.TEXTURE_2D, camTex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); camReady = true; } catch (e) { camReady = false; }
  }
  if (s === 'video' && vidEl && vidEl.readyState >= 2 && vidEl.videoWidth && now - vidUploadT >= 30) {
    vidUploadT = now;
    gl.bindTexture(gl.TEXTURE_2D, vidTex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vidEl); vidReady = true; } catch (e) { vidReady = false; }
  }
}
function camScale(srcAspect) {                                       // cover the screen without stretching
  return srcAspect > aspect ? [aspect / srcAspect, 1] : [1, srcAspect / aspect];
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
const M = { energy: 1, eLvl: 0, eHi: 0.16, eLo: 0, kick: 0, snare: 0, hat: 0, drop: 0, calm: 0, gain: 1, hist: [], histT: 0, lastDrop: -1e9 };
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
  M.kick *= Math.pow(0.8, k60); M.snare *= Math.pow(0.78, k60); M.drop *= Math.pow(0.94, k60); M.calm *= Math.pow(0.992, k60);
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
    }
  }
  if (reactMode === 0) return;                                        // calm: no hits, only the energy
  const sens = Math.min(2, Math.max(0.4, P.sens));
  if (isHit('kick', rise('kick', band(40, 140)), now, 180, sens)) onKick(now);
  const fs = rise('snare', band(1800, 4500)), fh = rise('hat', band(7000, 14000));
  const sh = isHit('snare', fs, now, 140, sens);
  if (sh && fs > fh * 0.8) onSnare(now);                              // a snare is wide; a hi-hat is mostly very high
}
// kick: things move — shards fly, a tile slides, cells turn, strips shift, folds breathe, lenses pulse, ripples start, print screens turn
function onKick(now) {
  kickN++; lastKickAt = now; M.kick = 1;                               // (the moves come from the groove clock; the kick adds its punch)
}
// snare / clap: things jump — the stretch line, warhol colours, the photocopy
function onSnare(now) {
  snareN++; lastSnareAt = now; M.snare = 1;
  for (const f of ['shatter', 'strips', 'warhol', 'xerox', 'glitch']) {   // the breaking effects also hit on the snare
    if (fxOn[f] && useMusic(f) && rateOf(f) <= 1 && now - fxLast[f] > period * 0.35) fire(f, now, period * rateOf(f));
  }
}
// the drop: one big moment for the effects (the picture itself is not touched)
function onDrop(now) {
  M.drop = 1; M.kick = 1.4; M.snare = 1.4;
  if (mus('mondrian')) { mBuild(); mRecolour(4); }
  if (mus('shatter')) shaSeed = Math.random() * 100;
  if (mus('puzzle') && puzN) puzReset();
  if (mus('ripple')) { for (let i = 0; i < 3; i++) { rippleAt(rnd(0.2, 0.8), rnd(0.2, 0.8), 1.5); } }
  if (mus('droste')) droTarget += 1;
  if (mus('warhol')) warShift += 3;
  for (const f of FX_ALL) { if (mus(f)) fire(f, now, period * 2); }
  note('drop');
}
function setReact(i) {
  reactMode = (i + REACTS.length) % REACTS.length;
  store('react', reactMode);
  refreshTop();
}

// ---------------------------------------------------------------- the groove: one clock that every effect dances to
// With music the clock is the beat (the beat clock, or the bass hits). Without music it runs at the drift tempo, and the
// hit pad plays it by hand. It ticks every half beat; each effect moves every ½, 1, 2 or 4 beats (its rate), and every
// move lasts exactly until the next one, so the motion never stops and always lands on the beat.
const RATES = [0.5, 1, 2, 4];
const RATE_NAME = ['½ beat', '1 beat', '2 beats', '4 beats'];
const fxRate = {}, fxDance = {}, fxLast = {}, fxDur = {};
for (const f of FX_ALL) { fxRate[f] = 1; fxDance[f] = 0.75; fxLast[f] = -1e9; fxDur[f] = 500; }
fxRate.mondrian = 3; fxRate.collage = 2; fxRate.droste = 3; fxRate.weave = 2; fxRate.push = 2; fxRate.puzzle = 0;
let beatN = 0, beatHeld = false, lastBeatAt = -1e9, period = 500, mTick = 0, vTick = 0, mBeatAt = -1e9, mHalf = true, vT = 0;
const beatGaps = [];
let hitHeld = false, hitT = 0;
function useMusic(f) { return !!(soundOn() && fxMus[f]); }                // this effect follows the music (else the drift clock)
function musicLive() { return soundOn() && performance.now() - mBeatAt < Math.max(1500, period * 2.5); }   // beats are coming right now
function useClock(f) { return !!(musicLive() && fxMus[f]); }           // no beats for a while (quiet intro): back to the drift clock
function rateOf(f) { return RATES[fxRate[f]] * [2, 1, 0.5][reactMode]; }   // calm: half as often · wild: twice as often
function driftPeriod() { return 2400 - 1900 * P.move; }                // the tempo without music (drift slider)
// how strongly an effect is moving right now: 1 on its move, fading to 0 by its next move
function env(f) { return fxOn[f] ? Math.exp(-3.2 * Math.min(4, (performance.now() - fxLast[f]) / Math.max(60, fxDur[f]))) : 0; }
function dance(f) { return fxOn[f] ? fxDance[f] : 0; }

function watchBeats(dtReal) {
  const now = performance.now(), snd = soundOn();
  if (pulse > 0.95 && !beatHeld) {                                     // a beat of the music
    beatHeld = true;
    beatN++;
    if (lastBeatAt > 0) { const g = now - lastBeatAt; if (g > 250 && g < 1500) { beatGaps.push(g); if (beatGaps.length > 8) beatGaps.shift(); } }
    lastBeatAt = now;
    if (snd) musicBeat(now);
  }
  if (pulse < 0.6) beatHeld = false;
  if (snd) {
    if (bcActive() && BC.periodMs) period = BC.periodMs;
    else if (beatGaps.length >= 3) { const s = beatGaps.slice().sort((a, b) => a - b); period = s[s.length >> 1]; }
    if (!mHalf && now - mBeatAt >= period / 2) { mHalf = true; tick('m', now, true); }   // the off-beat, half way
  }
  // the drift clock (no music, or effects set to music off)
  const vp = driftPeriod();
  if (!vT || now - vT > vp * 4) vT = now;
  if (now - vT >= vp / 2) { vT += vp / 2; tick('v', now, (vTick & 1) === 0); }
  // the hit pad held: hits keep coming on the tempo
  if (hitHeld && now - hitT >= (soundOn() ? period : vp)) { hitT = now; hitBeat(); }
  // the image set changes on its own beat count, or every few seconds without music
  const ch = CHANGES[changeMode];
  if (!snd && ch[2] > 0) { autoT += dtReal; if (autoT >= ch[2]) nextImage(); }
  else if (snd && ch[1] === 0) autoT = 0;
}
function musicBeat(now) {
  mBeatAt = now; mHalf = false;
  tick('m', now, false);
  const every = CHANGES[changeMode][1];
  if (every && beatN % every === 0) nextImage();
}
// the hit pad: you play a beat by hand, for every effect that is on
function hitBeat() {
  const now = performance.now();
  for (const f of FX_ALL) { if (fxOn[f]) fire(f, now, Math.max(250, (soundOn() ? period : driftPeriod()) * rateOf(f) * 0.9)); }
  M.kick = Math.max(M.kick, 1);
}
// half-beat ticks: m = music clock, v = drift clock
function tick(src, now, half) {
  let n;
  if (src === 'm') { mTick = half ? (mTick | 1) : ((mTick >> 1) + 1) << 1; n = mTick; }
  else { vTick++; n = vTick; }
  const per = src === 'm' ? period : driftPeriod();
  for (const f of FX_ALL) {
    if (!fxOn[f]) continue;
    if ((src === 'm') !== useClock(f)) continue;
    const every = Math.max(1, Math.round(rateOf(f) * 2));
    if (n % every === 0) fire(f, now, per * rateOf(f));
  }
}
let fireN = {};
// one move of one effect, lasting dur ms
function fire(f, now, dur) {
  fxLast[f] = now; fxDur[f] = dur;
  fireN[f] = (fireN[f] || 0) + 1;
  const k = fireN[f];
  fxHit[f] = now;
  switch (f) {
    case 'shatter': if (k % 4 === 0) shaSeed = Math.random() * 100; break;
    case 'puzzle': if (puzN) puzStep(dur); break;
    case 'turn': turnGo(dur); break;
    case 'strips': strGo(dur); break;
    case 'weave': weTx += (Math.random() < 0.5 ? 1 : -1) / (4 + 12 * fxAmt.weave); weDur = dur; break;
    case 'push': pushRandom(0.6 + 0.8 * fxDance.push); break;
    case 'ripple': rippleAt(rnd(0.15, 0.85), rnd(0.15, 0.85), 0.6 + 0.8 * fxDance.ripple); break;
    case 'collage': cMoveOne(); break;
    case 'droste': droTarget += 1; break;
    case 'warhol': warShift++; break;
    case 'mondrian': if (mRoot) { mMove(1 + (k % 2)); mRecolour(1 + (k % 3 === 0 ? 1 : 0)); if (k % 4 === 0) mRestructure(); } break;
    case 'halftone': case 'lines': case 'dither': angT += 0.26 * (0.4 + fxDance[f]); lineT += 0.8; break;
    case 'riso': { const m = (0.004 + 0.02 * fxAmt.riso) * (0.3 + fxDance.riso); for (const r of rOff) { r.x += rnd(-m, m); r.y += rnd(-m, m); } break; }
    case 'xerox': xeroxJump(); break;
    default: break;
  }
}

// ---------------------------------------------------------------- one frame
function fxNow(f) { return fxOn[f] ? 0.1 + 0.9 * fxAmt[f] : 0; }
const rnd = (a, b) => a + Math.random() * (b - a);
const easeTo = (c, t, rate, k60) => c + (t - c) * (1 - Math.pow(1 - rate, k60));
const glide = (dur, dtReal) => 1 - Math.pow(0.03, dtReal * 1000 / Math.max(60, dur));   // reaches the target within dur

// ---------------------------------------------------------------- the manipulators
let shaE = 0, shaSeed = 1;                                             // shatter
let puzN = 0, puzEmpty = 0, puzLast = -1, puzMove = null;              // puzzle
const puzPerm = new Float32Array(36);
let turnA = 1, turnB = 2, turnT = 1, turnDur = 500;                    // turn
let strA = 1, strB = 2, strT = 1, strDur = 500;                        // strips
let weSx = 0, weSy = 0, weTx = 0, weDur = 800;                         // weave
let foldA = 0;                                                         // fold
const lenses = [];                                                     // lens
const ripples = [];                                                    // ripple
let droT = 0, droTarget = 0;                                           // droste
let streY = 0.6, streT = 0.6;                                          // (stretch, kept for old looks)
const lensU = new Float32Array(20), ripU = new Float32Array(24);
let pushKick = null;

function puzReset() {
  puzN = 3 + Math.round(fxAmt.puzzle * 3);
  const n = puzN * puzN;
  for (let i = 0; i < 36; i++) { puzPerm[i] = i < n ? i : -1; }
  puzEmpty = Math.floor(Math.random() * n);
  puzPerm[puzEmpty] = -1;
  puzMove = null; puzLast = -1;
}
function puzStep(dur) {                                                // one tile slides into the empty place, taking the whole move
  if (puzMove) { puzPerm[puzMove.to] = puzMove.src; puzPerm[puzMove.from] = -1; puzEmpty = puzMove.from; puzMove = null; }
  const ex = puzEmpty % puzN, ey = Math.floor(puzEmpty / puzN), nb = [];
  if (ex > 0) nb.push(puzEmpty - 1);
  if (ex < puzN - 1) nb.push(puzEmpty + 1);
  if (ey > 0) nb.push(puzEmpty - puzN);
  if (ey < puzN - 1) nb.push(puzEmpty + puzN);
  const choices = nb.filter((i) => i !== puzLast);
  const from = choices[Math.floor(Math.random() * choices.length)];
  puzLast = puzEmpty;
  puzMove = { from, to: puzEmpty, src: puzPerm[from], t: 0, dur: Math.max(120, dur * (0.35 + 0.6 * (1 - fxDance.puzzle * 0.5))) };
}
function turnGo(dur) { turnA = turnB; turnB = Math.random() * 100; turnT = 0; turnDur = Math.max(150, dur * 0.8); }
function strGo(dur) { strA = strB; strB = Math.random() * 100; strT = 0; strDur = Math.max(120, dur * 0.6); }
function rippleAt(x, y, s) { ripples.push({ x, y, age: 0, s }); if (ripples.length > 6) ripples.shift(); }
function pushRandom(a) {                                               // an invisible finger pushes the picture
  pushKick = { x: rnd(0.2, 0.8), y: rnd(0.2, 0.8), vx: rnd(-1, 1) * 0.05 * a, vy: rnd(-1, 1) * 0.05 * a };
}

function manipStep(dt, dtReal, k60) {
  const snd = soundOn();
  const gm = (f) => (mus(f) ? M.gain : 1);
  const bass = (f) => (useMusic(f) ? sBass * P.sens : 0), mid = (f) => (useMusic(f) ? sMid * P.sens : 0), high = (f) => (useMusic(f) ? sTreble * P.sens : 0);
  // shatter: bursts open on each move, closes by the next; the bass keeps it trembling
  const sd = dance('shatter');
  shaE = fxOn.shatter ? (0.02 + 0.1 * fxAmt.shatter) * gm('shatter') * (1 - 0.5 * sd) + sd * env('shatter') * (0.12 + 0.4 * fxAmt.shatter) + sd * bass('shatter') * 0.05 : 0;
  // puzzle
  if (fxOn.puzzle) {
    if (!puzN || puzN !== 3 + Math.round(fxAmt.puzzle * 3)) puzReset();
    if (puzMove) puzMove.t = Math.min(1, puzMove.t + dtReal * 1000 / puzMove.dur);
  } else puzN = 0;
  // turn, strips: each move glides over its own share of the beat
  turnT = Math.min(1.2, turnT + dtReal * 1000 / turnDur);
  strT = Math.min(1, strT + dtReal * 1000 / strDur);
  // weave: steps on the move, the mids keep it sliding
  weSx += (weTx - weSx) * glide(weDur * 0.5, dtReal);
  weSy += dt * (0.004 + 0.03 * mid('weave') * dance('weave'));
  // fold: pumps open on each move and closes by the next, like an accordion; the bass opens it a little more
  const fd = dance('fold');
  const fBase = (0.2 + 0.7 * fxAmt.fold) * gm('fold');
  foldA = easeTo(foldA, Math.min(1.35, fBase * (1 - 0.6 * fd) + fd * (0.25 + 0.8 * fxAmt.fold) * env('fold') + fd * bass('fold') * 0.25), 0.35, k60);
  // lens: swells with the bass like a speaker cone, kicks on each move
  const ld = dance('lens');
  const ln = fxOn.lens ? 2 + Math.round(fxAmt.lens * 3) : 0;
  while (lenses.length < ln) { lenses.push({ ph: rnd(0, 6.28), fx: rnd(0.07, 0.17), fy: rnd(0.07, 0.17), r: rnd(0.12, 0.3), sgn: lenses.length % 3 === 2 ? -1 : 1 }); }
  lenses.length = ln;
  const lp = 1 + ld * (1.2 * env('lens') + 1.0 * bass('lens'));
  lenses.forEach((l, i) => {
    const t = simTime * (0.2 + 0.8 * P.move + ld * mid('lens'));
    const j = i * 4;
    lensU[j] = 0.5 + 0.36 * Math.sin(t * l.fx * 6 + l.ph); lensU[j + 1] = 0.5 + 0.38 * Math.cos(t * l.fy * 6 + l.ph * 1.7);
    lensU[j + 2] = l.r * (0.8 + 0.4 * fxAmt.lens) * (1 + 0.3 * ld * bass('lens'));
    lensU[j + 3] = l.sgn * (0.3 + 0.3 * fxAmt.lens) * gm('lens') * lp;
  });
  // ripple: the rings travel at the tempo
  const rs = 500 / Math.max(250, useMusic('ripple') ? period : driftPeriod());
  for (const r of ripples) { r.age += dt * rs * 1.6; }
  while (ripples.length && ripples[0].age > 3) ripples.shift();
  if (!fxOn.ripple) ripples.length = 0;
  ripples.forEach((r, i) => { const j = i * 4; ripU[j] = r.x; ripU[j + 1] = r.y; ripU[j + 2] = r.age; ripU[j + 3] = r.s * (0.4 + 0.9 * fxAmt.ripple) * gm('ripple') * (1 + 0.5 * dance('ripple') * bass('ripple')); });
  // droste: one level deeper on each move, gliding exactly into place
  if (droTarget - droT > 3) droT = droTarget - 1;
  droT += (droTarget - droT) * glide(fxDur.droste * 0.9, dtReal) * (frozen ? 0.05 : 1);
}

// the push field: the finger (or a move) pushes, then it slowly flows back
function pushPass(k60) {
  if (!fxOn.push) return;
  let on = 0, pos = [0, 0], vel = [0, 0];
  if (touch.on && touch.push) { on = 1; pos = [touch.x, touch.y]; vel = [touch.vx * 0.5, touch.vy * 0.5]; }
  if (pushKick) { on = 1; pos = [pushKick.x, pushKick.y]; vel = [pushKick.vx, pushKick.vy]; pushKick = null; }
  const nxt = 1 - dispCur;
  gl.bindFramebuffer(gl.FRAMEBUFFER, dispFbo[nxt]);
  gl.viewport(0, 0, dispW, dispH);
  gl.useProgram(progDisp);
  const u = progDisp.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dispTex[dispCur]); gl.uniform1i(u.uPrevD, 0);
  gl.uniform2f(u.uPos, pos[0], pos[1]); gl.uniform2f(u.uVel, vel[0], vel[1]);
  gl.uniform1f(u.uOn, on); gl.uniform1f(u.uRad, 0.06 + 0.12 * fxAmt.push); gl.uniform1f(u.uAsp, aspect); gl.uniform1f(u.uK, dispK);
  gl.uniform1f(u.uRelax, Math.pow(0.992 - 0.02 * dance('push') * env('push'), k60));
  gl.bindVertexArray(quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  dispCur = nxt;
}
let touch = { on: false, push: false, x: 0, y: 0, vx: 0, vy: 0, t: 0 };

// ---------------------------------------------------------------- collage: geometric cut-outs from the images of the set
const cPieces = [];
const cP = new Float32Array(32), cQ = new Float32Array(32);
function cKind() {
  const st = fxVar.collage;
  if (st === 1) return 0;
  if (st === 2) return 1;
  if (st === 3) return 4;
  if (st === 4) return Math.random() < 0.6 ? 2 : 3;
  return Math.floor(Math.random() * 5);
}
function cAim(p, fromOutside) {
  const a = fxAmt.collage;
  p.kind = cKind();
  p.tx = rnd(0.12, 0.88); p.ty = rnd(0.12, 0.88);
  const sz = rnd(0.07, 0.2) * (0.75 + 0.6 * a);
  p.tw = p.kind === 0 ? sz * rnd(0.7, 1.6) : sz; p.th = p.kind === 0 ? sz * rnd(0.6, 1.4) : sz;
  p.ta = (Math.random() < 0.5 ? 0 : rnd(-0.6, 0.6)) + (p.kind === 4 && Math.random() < 0.5 ? Math.PI / 2 : 0);
  p.img = Math.floor(Math.random() * 4); p.z = rnd(0.9, 1.6);
  if (fromOutside) { p.x = p.tx + (Math.random() < 0.5 ? -1.1 : 1.1); p.y = p.ty; p.w = p.tw; p.h = p.th; p.a = p.ta; }
}
function cMoveOne() {
  if (!cPieces.length) return;
  const p = cPieces.shift();                                          // the bottom piece slides in again on top
  cAim(p, true);
  cPieces.push(p);
}
function collageStep(dtReal) {
  if (!fxOn.collage) return 0;
  const n = 3 + Math.round(fxAmt.collage * 5);
  while (cPieces.length < n) { const p = {}; cAim(p, true); cPieces.push(p); }
  while (cPieces.length > n) cPieces.shift();
  const r = glide(fxDur.collage * 0.6, dtReal) * (frozen ? 0.05 : 1);
  const b = 1 + 0.06 * dance('collage') * (useMusic('collage') ? sBass * P.sens : 0) + 0.05 * dance('collage') * env('collage');
  cPieces.forEach((p, i) => {
    p.x += (p.tx - p.x) * r; p.y += (p.ty - p.y) * r; p.w += (p.tw - p.w) * r; p.h += (p.th - p.h) * r; p.a += (p.ta - p.a) * r;
    const j = i * 4;
    cP[j] = p.x; cP[j + 1] = p.y; cP[j + 2] = p.w * b; cP[j + 3] = p.h * b;
    cQ[j] = p.a; cQ[j + 1] = p.img; cQ[j + 2] = p.kind; cQ[j + 3] = p.z;
  });
  return cPieces.length;
}

// ---------------------------------------------------------------- print: screens, riso plates, warhol colours, photocopy
let angT = 0, angCur = 0, lineT = 0, warShift = 0, xAng = 0, xOff = { x: 0, y: 0 }, xSeed = 1;
const rOff = [{ x: 0, y: 0, bx: 0, by: 0 }, { x: 0, y: 0, bx: 0, by: 0 }, { x: 0, y: 0, bx: 0, by: 0 }];
for (const r of rOff) { r.bx = rnd(-1, 1); r.by = rnd(-1, 1); }
function xeroxJump() {                                               // the copy comes out crooked, with new streaks
  const a = fxAmt.xerox * (0.4 + fxDance.xerox);
  xAng = rnd(-1, 1) * (0.006 + 0.03 * a); xOff = { x: rnd(-1, 1) * 0.012 * a, y: rnd(-1, 1) * 0.02 * a }; xSeed = Math.random() * 100;
}
function printStep(dt, dtReal, k60) {
  const sf = PRINTS.find((f) => fxOn[f] && (f === 'halftone' || f === 'lines' || f === 'dither'));
  angCur += (angT - angCur) * glide(sf ? fxDur[sf] * 0.5 : 400, dtReal);
  lineT += dt * (0.4 + 1.6 * P.move);
  const base = 0.0012 + 0.004 * fxAmt.riso;                           // riso plates are never quite in register
  const rr = glide(fxDur.riso * 0.7, dtReal);
  for (const r of rOff) { r.x += (r.bx * base - r.x) * rr; r.y += (r.by * base - r.y) * rr; }
  if (!fxOn.xerox) { xAng = 0; xOff = { x: 0, y: 0 }; }
}
function setPrint(i) {
  printMode = i >= PRINTS.length ? -1 : i;
  for (let k = 0; k < PRINTS.length; k++) { fxOn[PRINTS[k]] = k === printMode; }
  if (B.print) { B.print.innerHTML = 'print<br>' + (printMode < 0 ? 'off' : PRINTS[printMode]); setOn(B.print, printMode >= 0); }
  if (printMode >= 0 && focusFx && PRINTS.includes(focusFx)) focusFx = PRINTS[printMode];
  if (amtBox) refreshFx();
}
// ---------------------------------------------------------------- mondrian: a tree of rectangles whose lines slide, split and merge
let mRoot = null, mT = 0, mRects = new Float32Array(128), mCols = new Float32Array(128), mOffs = new Float32Array(128), mN = 0;
function mLeaf() {
  const l = { dir: 0, r: 0.5, tr: 0.5, a: null, b: null, rv: Math.random(), ci: Math.floor(Math.random() * 4), dying: false, ox: 0, oy: 0, z: 1 };
  mAim(l); l.ox = l.tox; l.oy = l.toy; l.z = l.tz;
  return l;
}
function mAim(l) {                                                   // where this window looks next: another part of the picture, a little closer
  const a = fxAmt.mondrian, ang = Math.random() * Math.PI * 2;
  l.tox = Math.cos(ang) * (0.04 + 0.5 * a) * Math.random(); l.toy = Math.sin(ang) * (0.04 + 0.5 * a) * Math.random();
  l.tz = 1 + Math.random() * (0.15 + 0.9 * a);
  l.vx = (Math.random() - 0.5) * 0.06 * a; l.vy = (Math.random() - 0.5) * 0.06 * a;
}
function mSplit(n, fromEdge) {
  n.dir = Math.random() < 0.5 ? 0 : 1;
  n.tr = 0.22 + Math.random() * 0.56;
  n.r = fromEdge ? (Math.random() < 0.5 ? 0 : 1) : n.tr;              // a new line slides in from the edge
  n.a = mLeaf(); n.b = mLeaf();
  n.a.rv = n.rv; n.a.ci = n.ci; n.a.ox = n.ox; n.a.oy = n.oy; n.a.z = n.z; n.a.tox = n.tox; n.a.toy = n.toy; n.a.tz = n.tz;
}
function mBuild() {
  mRoot = mLeaf();
  const grow = (n, d) => { if (d < 4 && (d < 2 || Math.random() < 0.65)) { mSplit(n, false); grow(n.a, d + 1); grow(n.b, d + 1); } };
  grow(mRoot, 0);
}
function mWalk(fn) { const st = [mRoot]; while (st.length) { const n = st.pop(); fn(n); if (n.a) { st.push(n.a, n.b); } } }
function mCount() { let c = 0; mWalk((n) => { if (!n.a) c++; }); return c; }
function mMove(count) {                                              // some lines slide to a new place
  const inner = []; mWalk((n) => { if (n.a && !n.dying) inner.push(n); });
  for (let i = 0; i < count && inner.length; i++) { inner[Math.floor(Math.random() * inner.length)].tr = 0.2 + Math.random() * 0.6; }
}
function mRecolour(count) {
  const lv = []; mWalk((n) => { if (!n.a) lv.push(n); });
  for (let i = 0; i < count && lv.length; i++) { const n = lv[Math.floor(Math.random() * lv.length)]; n.rv = Math.random(); n.ci = Math.floor(Math.random() * 4); mAim(n); }
}
function mRestructure() {                                            // a cell splits in two, or two cells merge
  const c = mCount();
  if (c < 8 || (c < 18 && Math.random() < 0.55)) {
    const lv = []; mWalk((n) => { if (!n.a) lv.push(n); });
    mSplit(lv[Math.floor(Math.random() * lv.length)], true);
  } else {
    const pairs = []; mWalk((n) => { if (n.a && !n.a.a && !n.b.a && !n.dying) pairs.push(n); });
    if (pairs.length) { const n = pairs[Math.floor(Math.random() * pairs.length)]; n.dying = true; n.tr = Math.random() < 0.5 ? 0 : 1; }
  }
}
function mondStep(dtReal, k60) {
  if (!fxOn.mondrian) { mN = 0; return; }
  if (!mRoot) mBuild();
  const rate = glide(fxDur.mondrian * 0.7, dtReal) * (frozen ? 0.05 : 1);   // the lines arrive just as the next move starts
  const slide = 1 - Math.pow(1 - 0.045, k60 * (frozen ? 0.05 : 1)), dts = frozen ? 0 : dtReal;
  mWalk((n) => {
    if (!n.a) {                                                       // the picture slides inside each window
      n.tox += n.vx * dts; n.toy += n.vy * dts;
      n.ox += (n.tox - n.ox) * slide; n.oy += (n.toy - n.oy) * slide; n.z += (n.tz - n.z) * slide;
      return;
    }
    n.r += (n.tr - n.r) * rate;
    if (n.dying && Math.abs(n.r - n.tr) < 0.004) { const keep = n.tr < 0.5 ? n.b : n.a; n.a = null; n.b = null; n.dying = false; n.rv = keep.rv; n.ci = keep.ci; }
  });
  // the leaves, as rectangles on the screen
  const pal = MOND_PALS[fxVar.mondrian], share = pal.none ? 0 : 0.3;
  mN = 0;
  const st = [[mRoot, 0, 0, 1, 1]];
  while (st.length && mN < 32) {
    const [n, x0, y0, x1, y1] = st.pop();
    if (n.a) {
      if (n.dir === 0) { const xm = x0 + (x1 - x0) * n.r; st.push([n.a, x0, y0, xm, y1], [n.b, xm, y0, x1, y1]); }
      else { const ym = y0 + (y1 - y0) * n.r; st.push([n.a, x0, y0, x1, ym], [n.b, x0, ym, x1, y1]); }
      continue;
    }
    const j = mN * 4;
    mRects[j] = x0; mRects[j + 1] = y0; mRects[j + 2] = x1; mRects[j + 3] = y1;
    if (n.rv < share) {
      if (pal.c) { const c = pal.c[n.ci]; mCols[j] = c[0] / 255; mCols[j + 1] = c[1] / 255; mCols[j + 2] = c[2] / 255; mCols[j + 3] = 1; }
      else { mCols[j + 3] = 2; }
    } else mCols[j + 3] = 0;
    mOffs[j] = n.ox; mOffs[j + 1] = n.oy; mOffs[j + 2] = n.z;
    mN++;
  }
}
// the style button in the amount bar (colours of mondrian, riso, warhol, shapes; kind of halftone, lines, dither, xerox)
function setVar(f, i) {
  const vs = VARIANTS[f];
  if (!vs) return;
  fxVar[f] = (i + vs.length) % vs.length;
  if (f === 'collage') { for (const p of cPieces) { cAim(p, true); } }   // a new style: all pieces cut again
  if (amtBox) refreshFx();
}

const u3 = (a, c) => a.push(c[0] / 255, c[1] / 255, c[2] / 255);
function renderFrame() {
  const now = performance.now();
  const dtReal = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
  lastT = now;
  const k60 = dtReal * 60;
  updateFps(dtReal);
  listen(k60);
  musicStep(k60);
  watchBeats(dtReal);
  updateTween();
  updateReadouts();
  if (!glOk) return;
  resize();
  if (!frozen) uploadMoving();
  updateImages(dtReal);
  const dt = dtReal * (frozen ? 0.04 : 1) * (1 - 0.6 * M.calm);       // a breakdown slows the effects down for a while
  simTime += dt;
  const snd = soundOn();

  // what is shown: the image set, the video or the camera (if not ready yet: the images)
  let texA = null, scA = [1, 1], flipA = 0, texB = null, scB = [1, 1], mAB = 0;
  const s = SOURCES[srcMode];
  if (s === 'camera' && camReady && video) { texA = camTex; scA = camScale(video.videoWidth / Math.max(1, video.videoHeight)); flipA = camFacing === 'user' ? 1 : 0; }
  else if (s === 'video' && vidReady && vidEl) { texA = vidTex; scA = camScale(vidEl.videoWidth / Math.max(1, vidEl.videoHeight)); }
  else {
    const A = imgs.length ? imgs[Math.min(idxA, imgs.length - 1)] : plate;
    texA = A.tex; scA = camScale(A.w / A.h);
    if (fading && imgs[idxB]) { const Bm = imgs[idxB]; texB = Bm.tex; scB = camScale(Bm.w / Bm.h); mAB = mixAB * mixAB * (3 - 2 * mixAB); }
  }
  // weave takes its second picture from the next image of the set (or the same picture, mirrored)
  const extra = [];                                                   // the next images of the set (weave, collage)
  for (let i = 1; i <= 3; i++) {
    const im = imgs.length > 1 ? imgs[(idxA + i) % imgs.length] : null;
    extra.push(im ? { tex: im.tex, sc: camScale(im.w / im.h) } : { tex: texA, sc: scA });
  }

  const gm = (f) => (mus(f) ? M.gain : 1);
  const bassOf = (f) => (useMusic(f) ? sBass * P.sens : 0);
  const mirror = fxOn.mirror ? (fxAmt.mirror < 0.5 ? 1 : 2) : 0;
  printStep(dt, dtReal, k60);
  manipStep(dt, dtReal, k60);
  mondStep(dtReal, k60);
  const warN = fxOn.warhol ? (fxAmt.warhol < 0.5 ? 2 : 3) : 0;
  pushPass(k60);
  const cN = collageStep(dtReal);

  // 1. compose: the picture taken apart
  const nxt = 1 - cmpCur;
  gl.bindFramebuffer(gl.FRAMEBUFFER, cmpFbo[nxt]);
  gl.viewport(0, 0, W, H);
  gl.useProgram(progCmp);
  const u = progCmp.u;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA); gl.uniform1i(u.uA, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB || texA); gl.uniform1i(u.uB, 1);
  for (let i = 0; i < 3; i++) {
    gl.activeTexture(gl.TEXTURE2 + i); gl.bindTexture(gl.TEXTURE_2D, extra[i].tex); gl.uniform1i(u['uI' + (i + 1)], 2 + i);
    gl.uniform2f(u['uS' + (i + 1)], extra[i].sc[0], extra[i].sc[1]);
  }
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, dispTex[dispCur]); gl.uniform1i(u.uDisp, 5);
  gl.uniform2f(u.uScaleA, scA[0], scA[1]); gl.uniform2f(u.uScaleB, scB[0], scB[1]);
  gl.uniform1f(u.uFlipA, flipA); gl.uniform1f(u.uFlipB, 0); gl.uniform1f(u.uMixAB, texB ? mAB : 0);
  gl.uniform1f(u.uAspect, aspect); gl.uniform1f(u.uTime, simTime);
  gl.uniform2f(u.uC, centre.x, centre.y);
  gl.uniform1f(u.uZoom, P.zoom); gl.uniform1f(u.uRot, rotA); gl.uniform1f(u.uMirror, mirror); gl.uniform1f(u.uWarN, warN);
  gl.uniform1f(u.uXAng, fxOn.xerox ? xAng : 0); gl.uniform2f(u.uXOff, fxOn.xerox ? xOff.x : 0, fxOn.xerox ? xOff.y : 0);
  gl.uniform1f(u.uPush, fxOn.push ? 1 : 0); gl.uniform1f(u.uDispK, dispK);
  gl.uniform1f(u.uLN, lenses.length); if (lenses.length) gl.uniform4fv(u['uL[0]'], lensU);
  gl.uniform1f(u.uRpN, ripples.length); if (ripples.length) gl.uniform4fv(u['uRp[0]'], ripU);
  gl.uniform1f(u.uDro, fxOn.droste ? 0.62 - 0.32 * fxAmt.droste : 0); gl.uniform1f(u.uDroT, droT); gl.uniform1f(u.uDroTw, fxVar.droste === 1 ? 0.35 : 0);
  gl.uniform1f(u.uFold, fxOn.fold ? 1 : 0); gl.uniform1f(u.uFoldN, 2 + Math.round(fxAmt.fold * 6)); gl.uniform1f(u.uFoldA, foldA);
  gl.uniform1f(u.uPuz, fxOn.puzzle && puzN ? 1 : 0);
  if (fxOn.puzzle && puzN) {
    gl.uniform1f(u.uPuzN, puzN); gl.uniform1fv(u['uPerm[0]'], puzPerm);
    gl.uniform1f(u.uPuzT, puzMove ? Math.min(1, puzMove.t) : -1);
    gl.uniform1f(u.uPuzFrom, puzMove ? puzMove.from : -5); gl.uniform1f(u.uPuzTo, puzMove ? puzMove.to : -5); gl.uniform1f(u.uPuzSrc, puzMove ? puzMove.src : -1);
  }
  gl.uniform1f(u.uTurn, fxOn.turn ? 1 : 0); gl.uniform1f(u.uTurnN, 2 + Math.round(fxAmt.turn * 6)); gl.uniform1f(u.uTurnA, turnA); gl.uniform1f(u.uTurnB, turnB); gl.uniform1f(u.uTurnT, turnT);
  gl.uniform1f(u.uStr, fxOn.strips ? 1 : 0); gl.uniform1f(u.uStrN, 6 + Math.round(fxAmt.strips * 30)); gl.uniform1f(u.uStrA, strA); gl.uniform1f(u.uStrB, strB);
  gl.uniform1f(u.uStrT, strT); gl.uniform1f(u.uStrAmp, (0.06 + 0.4 * fxAmt.strips) * gm('strips') * (1 + 0.6 * dance('strips') * bassOf('strips')));
  gl.uniform1f(u.uSha, fxOn.shatter ? 1 : 0); gl.uniform1f(u.uShaN, 3 + Math.round(fxAmt.shatter * 7)); gl.uniform1f(u.uShaSeed, shaSeed); gl.uniform1f(u.uShaE, shaE);
  gl.uniform1f(u.uStre, fxOn.stretch ? 1 : 0); gl.uniform1f(u.uStreY, streY); gl.uniform1f(u.uStreLen, (0.1 + 0.6 * fxAmt.stretch) * gm('stretch')); gl.uniform1f(u.uStreDir, fxVar.stretch);
  gl.uniform1f(u.uWea, fxOn.weave ? 1 : 0); gl.uniform1f(u.uWeaN, 4 + Math.round(fxAmt.weave * 12)); gl.uniform1f(u.uWeaSx, weSx); gl.uniform1f(u.uWeaSy, weSy);
  gl.uniform1f(u.uCN, cN);
  if (cN) {
    gl.uniform4fv(u['uCP[0]'], cP); gl.uniform4fv(u['uCQ[0]'], cQ);
    const lc = PAPER;                                                  // a thin light outline around each cut-out
    gl.uniform1f(u.uCLine, 0.6 * dpr); gl.uniform3f(u.uCLC, lc[0] / 255, lc[1] / 255, lc[2] / 255);
  }
  gl.bindVertexArray(quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  cmpCur = nxt;
  clearNow = false;

  // 2. on screen: mondrian, colour and the print finish
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, W, H);
  gl.useProgram(progShow);
  const us = progShow.u, pal = COLS[colMode];
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cmpTex[cmpCur]); gl.uniform1i(us.uCmp, 0);
  gl.uniform2f(us.uRes, W, H); gl.uniform2f(us.uC, centre.x, centre.y);
  gl.uniform1f(us.uContrast, P.contrast); gl.uniform1f(us.uBright, P.bright); gl.uniform1f(us.uSat, P.sat);
  gl.uniform1f(us.uGrain, P.grain);
  gl.uniform1f(us.uTime, (frameNo % 97) * 0.37);
  gl.uniform1f(us.uPal, pal.dark ? 2 : (colMode === 1 ? 1 : 0));
  const dk = pal.dark || INKC, lt = pal.light || PAPER;
  gl.uniform3f(us.uDark, dk[0] / 255, dk[1] / 255, dk[2] / 255);
  gl.uniform3f(us.uLight, lt[0] / 255, lt[1] / 255, lt[2] / 255);
  gl.uniform3f(us.uPaper, PAPER[0] / 255, PAPER[1] / 255, PAPER[2] / 255);
  const scr = fxOn.halftone ? 'halftone' : (fxOn.lines ? 'lines' : (fxOn.dither ? 'dither' : null));
  const cell = (3 + 16 * P.scale) * dpr * (scr ? 0.6 + 0.8 * fxAmt[scr] : 1);
  gl.uniform1f(us.uCell, Math.max(2, cell));
  gl.uniform1f(us.uAng, angCur); gl.uniform1f(us.uLineT, lineT);
  gl.uniform1f(us.uHalf, fxOn.halftone ? 1 + fxVar.halftone : 0);
  gl.uniform1f(us.uLines, fxOn.lines ? 1 + fxVar.lines : 0);
  gl.uniform1f(us.uDither, fxOn.dither ? 1 + fxVar.dither : 0);
  gl.uniform1f(us.uInk, fxOn.ink ? 1 : 0); gl.uniform1f(us.uInkThr, 0.3 + 0.4 * fxAmt.ink - 0.08 * dance('ink') * env('ink') - (mus('ink') ? 0.05 * (M.gain - 0.66) : 0));
  const ri = RISO[fxVar.riso];
  gl.uniform1f(us.uRiso, fxOn.riso ? ri.c.length : 0);
  if (fxOn.riso) {
    const inks = []; for (let i = 0; i < 3; i++) { u3(inks, ri.c[Math.min(i, ri.c.length - 1)]); }
    gl.uniform3fv(us['uRI[0]'], inks);
    gl.uniform2fv(us['uROff[0]'], [rOff[0].x, rOff[0].y, rOff[1].x, rOff[1].y, rOff[2].x, rOff[2].y]);
    gl.uniform1f(us.uRDens, 0.85 + 0.5 * fxAmt.riso * gm('riso'));
  }
  gl.uniform1f(us.uXerox, fxOn.xerox ? 1 + fxVar.xerox : 0); gl.uniform1f(us.uXSeed, xSeed); gl.uniform1f(us.uXAmt, fxAmt.xerox * gm('xerox'));
  gl.uniform1f(us.uWarN, warN); gl.uniform1f(us.uWShift, warShift);
  if (warN) {
    const w = WARHOL[fxVar.warhol], wp = [];
    for (const wk of ['c', 'd', 'e', 'f', 'g', 'h']) { for (const c of w[wk]) { u3(wp, c); } }
    gl.uniform3fv(us['uWP[0]'], wp);
  }
  gl.uniform1f(us.uRN, mN);
  if (mN) {
    gl.uniform4fv(us['uR[0]'], mRects); gl.uniform4fv(us['uRC[0]'], mCols); gl.uniform4fv(us['uRO[0]'], mOffs);
    gl.uniform1f(us.uMAlpha, mondAlpha);
    const lc = MOND_PALS[fxVar.mondrian].line;
    gl.uniform3f(us.uLineC, lc[0] / 255, lc[1] / 255, lc[2] / 255);
    gl.uniform1f(us.uLineW, Math.max(2, Math.min(W, H) * 0.007) * (1 + 0.4 * dance('mondrian') * env('mondrian')));
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  frameNo++;
}

// ---------------------------------------------------------------- midi: learn any control (Chrome / Edge on a computer, Chrome on Android,
// or a browser app with Web MIDI on the iPhone; Safari has no MIDI). Press learn, tap a control on the screen, move a knob or press a pad.
const midi = { access: null, on: false, learn: false, map: {}, target: null, prev: {}, ok: !!navigator.requestMIDIAccess };
const ACTIONS = {
  'act:hit': () => hitBeat(),
  'act:print': () => setPrint(printMode + 1),
  'act:freeze': () => setFrozen(!frozen),
  'act:next': () => nextImage(),
  'act:react': () => setReact(reactMode + 1),
  'act:colour': () => { colMode = (colMode + 1) % COLS.length; refreshTop(); },
  'act:source': () => { srcMode = (srcMode + 1) % SOURCES.length; sourceChanged(); },
  'act:music': () => togglePlay(),
  'act:rec': () => toggleRecord(),
  'act:hide': () => setHidden(!hidden),
  'act:panic': () => panic(),
  'act:random': () => randomLook(),
  'act:style': () => { const f = focusFx && VARIANTS[focusFx] ? focusFx : 'mondrian'; setVar(f, fxVar[f] + 1); },
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
  else if (kind === 'val' && name === 'malpha') { mondAlpha = v; refreshFx(); }
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
function setupTouch() {
  const pts = new Map();
  let downT = 0, moved = 0, lastTap = 0;
  const toUv = (e) => ({ x: e.clientX / window.innerWidth, y: 1 - e.clientY / window.innerHeight });
  let two = null;                                                      // two fingers: pinch = zoom, twist = rotate
  const pairOf = () => {
    const [a, b] = Array.from(pts.values());
    const dx = (b.x - a.x) * aspect, dy = b.y - a.y;
    return { d: Math.hypot(dx, dy), a: Math.atan2(dy, dx), z: P.zoom, r: rotA };
  };
  cv.addEventListener('pointerdown', (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const w0 = toUv(e);
    pts.set(e.pointerId, w0);
    downT = performance.now(); moved = 0;
    if (pts.size === 2) { two = pairOf(); touch.push = false; }
    touch.on = true; touch.push = !!fxOn.push; touch.x = w0.x; touch.y = w0.y; touch.vx = 0; touch.vy = 0; touch.t = downT;
    keepAwake();
    if (vidEl && SOURCES[srcMode] === 'video' && vidEl.paused) vidEl.play().catch(() => {});
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const w = toUv(e), dx = w.x - p.x, dy = w.y - p.y;
    moved += Math.abs(dx) + Math.abs(dy);
    pts.set(e.pointerId, w);
    if (pts.size >= 2 && two) {
      const c = pairOf();
      P.zoom = Math.min(4, Math.max(0.6, two.z * c.d / Math.max(0.01, two.d)));
      let da = c.a - two.a;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      rotA = two.r - da;
      moved = 1;
      return;
    }
    const now = performance.now(), edt = Math.max(0.004, Math.min(0.05, (now - (touch.t || now - 16)) / 1000));
    touch.t = now; touch.x = w.x; touch.y = w.y;
    touch.vx = touch.vx * 0.3 + (dx / edt) * 0.7 * 0.02; touch.vy = touch.vy * 0.3 + (dy / edt) * 0.7 * 0.02;
    if (moved < 0.02 || fxOn.push) return;                             // with push on, the finger pushes the picture instead
    centre.x = Math.min(1, Math.max(0, centre.x + dx)); centre.y = Math.min(1, Math.max(0, centre.y + dy));
  });
  const up = (e) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size < 2) two = null;
    if (pts.size === 0) { touch.on = false; touch.vx = 0; touch.vy = 0; }
    const now = performance.now();
    if (p && now - downT < 260 && moved < 0.02) {                     // a tap
      if (now - lastTap < 330) { centre = { x: 0.5, y: 0.5 }; rotA = 0; clearPush(); lastTap = 0; }
      else { nextImage(); lastTap = now; }
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
let bar, dock, menu, amtBox, amtLabel, amtVal, amtSlider, noteEl, restoreBtn, hidden = false, focusFx = null, peek = false, addInput = null;
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
    if (['source', 'music', 'rec', 'react', 'colour', 'hide'].includes(skey)) midiTag(b, 'act:' + skey);
    return b;
  };
  addInput = el('input', '', document.body);
  addInput.type = 'file'; addInput.multiple = true; addInput.accept = 'image/*,video/*';
  addInput.style.display = 'none';
  addInput.addEventListener('change', () => { if (addInput.files.length) addFiles(addInput.files); addInput.value = ''; });
  bt('source', 'source', 'image', () => { srcMode = (srcMode + 1) % SOURCES.length; sourceChanged(); });
  bt('add', 'add', 'files', () => addInput.click());
  bt('music', 'music', 'play', () => { keepAwake(); togglePlay(); });
  bt('mic', 'mic', 'off', () => { keepAwake(); toggleMic(); });
  bt('rec', 'rec', 'start', toggleRecord);
  bt('beat', 'bpm', 'auto', () => { bcToggle(); refreshTop(); });
  bt('react', 'react', 'groove', () => setReact(reactMode + 1));
  bt('colour', 'colour', 'original', () => { colMode = (colMode + 1) % COLS.length; refreshTop(); });
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
  B.mrow = el('div', 'mrow', amtBox);                                  // mondrian only: how solid the colour cells are
  const mt = el('div', 'top', B.mrow);
  el('span', '', mt, 'colour strength · see-through ←→ solid');
  B.malphaVal = el('span', 'val', mt);
  B.malpha = el('input', 'r', B.mrow);
  midiTag(B.mrow, 'val:malpha');
  B.malpha.type = 'range'; B.malpha.min = 0; B.malpha.max = 1; B.malpha.step = 0.01; B.malpha.value = mondAlpha;
  B.malpha.addEventListener('input', () => { mondAlpha = parseFloat(B.malpha.value); B.malphaVal.textContent = mondAlpha.toFixed(2); });
  meter = el('div', '', dock); meter.id = 'vu';
  const pg = el('div', 'pg fx7', dock);
  for (const f of FX) { B['fx_' + f] = holdButton(f, pg); }
  const lr = el('div', 'pg fx8', dock);
  for (let i = 0; i < 4; i++) { B['look' + i] = lookButton(i, lr); }
  B.print = printButton(lr);
  B.hit = hitButton(lr);
  B.freeze = el('button', '', lr, 'freeze'); B.freeze.addEventListener('click', () => setFrozen(!frozen)); midiTag(B.freeze, 'act:freeze');
  const nb = el('button', '', lr, 'next'); midiTag(nb, 'act:next'); nb.addEventListener('click', () => { if (imgs.length < 2) note(imgs.length ? 'add more images for a set' : 'add images first'); nextImage(); });

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
  el('div', 'sec', panes.source, 'images and video');
  const gs = el('div', 'btns', panes.source);
  const ad = el('button', '', gs, '+ add files'); ad.addEventListener('click', () => addInput.click());
  const ci = el('button', '', gs, 'clear images'); ci.addEventListener('click', () => { clearImages(); note('image set cleared'); });
  B.change = el('button', 'full', gs, '');
  B.change.addEventListener('click', () => { changeMode = (changeMode + 1) % CHANGES.length; autoT = 0; refreshTop(); });
  B.imgInfo = el('div', 'note', panes.source, '');
  el('div', 'sec', panes.source, 'camera');
  const gc = el('div', 'btns', panes.source);
  B.cam = el('button', 'full', gc, 'camera · start');
  B.cam.addEventListener('click', () => { if (camOn) { camFacing = camFacing === 'user' ? 'environment' : 'user'; } startCamera().then(() => { srcMode = 2; sourceChanged(); }); });
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
  el('div', 'note', panes.help).innerHTML = 'add · images (several at once = a set) or a video<br>source · image set / video / camera<br>drag · move the centre (with push on: push the picture) · tap · next image · double tap · centre back, push undone<br><br>dock: tap = on / off · hold = only while held, drag up / down for the amount (or a 2nd finger on the amount bar)<br>the amount bar: amount = how big · dance = how much the beat moves it (0 still, 1 full groove) · every ½ / 1 / 2 / 4 beats = how often it moves (each move lasts until the next one) · music on / off = follows the music, or the drift tempo · style<br>hit (bottom row) · tap = a beat by hand for every effect that is on, hold = keeps hitting on the tempo (key enter)<br>two fingers on the picture · pinch = zoom, twist = rotate (double tap = back)<br><br>CUT AND MOVE<br>mondrian · black lines cut the picture into windows onto other parts of it (colours: parts or flat colour cells, 2nd slider = see-through)<br>shatter · glass shards that shift, turn and fly apart on the kick · amount = more shards<br>puzzle · tiles slide into the empty place, one move per kick · amount = more tiles<br>strips · shredded strips slide up and down · amount = more strips, further<br>weave · strips of two images of your set woven over and under<br>turn · square cells click round by quarter turns · amount = smaller cells<br>fold · an accordion of paper, opening and closing · amount = more folds<br><br>DEFORM AND REPEAT<br>push · drag on the picture to push it like wet paint; it slowly flows back (kicks push too)<br>lens · wandering magnifying bulges and pinches<br>ripple · rings spreading through the picture from where the kicks fall<br>collage · clean geometric cut-outs (squares, circles, triangles, half circles, strips) from the images of your set, laid on top with a hard shadow; a new one slides in on every kick · style: mixed, squares, circles, strips, triangles · amount = more and bigger<br>droste · the picture inside itself, zooming in forever · style: frame or spiral<br>mirror · 2 or 4 parts<br>warhol · 4 or 9 copies in screen-print colours (colours: pop, acid, soft)<br><br>PRINT (bottom row) · tap = next finish: off, halftone, riso, dither, lines, xerox, ink · hold = its amount, style and music<br><br>the groove: every effect moves on the beat of the music (or the drift tempo without music), each move lasting exactly until the next, so they keep dancing · shards burst open and close, tiles slide, cells turn, strips step, folds pump, lenses swell with the bass, ripples travel at the tempo, droste zooms one level per move, mondrian lines slide · the snare also hits shatter, strips, warhol and xerox · the energy of the song sets how strong · react (top bar): calm = half as often, groove, wild = twice as often<br><br>sliders (menu · look): print size = dots, lines, pixels · drift = the tempo without music<br><br>freeze · holds everything · looks 1-4 · tap = recall, hold = save · next · next image · random look: menu · look<br><br>midi (menu · perf) · learn any control with a midi controller · works in chrome / edge / android, not in safari<br><br>keys: q w e r t y u = mondrian shatter puzzle strips weave turn fold · a s d g j k l = push lens ripple collage droste mirror warhol · o = next print finish · enter = hit · p = style · 1-4 looks (shift = save) · x or → next image · z freeze · m react · v colour · ; beat clock · b tap tempo · 0 all off · space play · h hide · f full screen · n random';
  for (let i = 0; i < 4; i++) { LOOKS[i] = recall('look' + i); }
  const cm = recall('change2'); if (Number.isInteger(cm) && cm >= 0 && cm < CHANGES.length) changeMode = cm;
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
  const [skey, label, lo, hi, step, fmt] = s;
  const row = el('div', 'row', parent);
  const top = el('div', 'top', row);
  el('span', '', top, label);
  const val = el('span', 'val', top);
  const inp = el('input', 'r', row);
  midiTag(row, 'sl:' + skey);
  inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = step; inp.value = P[skey];
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
  if (recState === 'recording') {
    const t = Math.floor((performance.now() - recStart) / 1000);
    setLabel(B.rec, 'rec', 'stop ' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  }
  if (B.fps && menu.style.display === 'block') B.fps.textContent = Math.round(fpsAvg) + ' fps · ' + W + ' × ' + H + ' px';
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
  if (s === 'camera' && !camOn) startCamera().then(refreshTop);
  if (s === 'video') {
    if (!vidEl) { note('add a video first · add button'); }
    else if (vidEl.paused) vidEl.play().catch(() => note('tap the picture to start the video'));
  } else if (vidEl && !vidEl.paused) vidEl.pause();
  if (s !== 'camera' && camOn) stopCamera();
  clearTrails();
  refreshTop();
}
function setFrozen(v) {
  frozen = v;
  if (vidEl && SOURCES[srcMode] === 'video') { if (frozen) vidEl.pause(); else vidEl.play().catch(() => {}); }
  refreshTop();
}
function refreshTop() {
  if (B.beat) { setLabel(B.beat, 'bpm', bcLabel()); setOn(B.beat, bcActive()); }
  setLabel(B.source, 'source', SOURCES[srcMode]);
  setLabel(B.add, 'add', imgs.length ? imgs.length + ' img +' : 'files');
  setLabel(B.colour, 'colour', COLS[colMode].name);
  setOn(B.freeze, frozen);
  if (B.react) { setLabel(B.react, 'react', REACTS[reactMode]); setOn(B.react, reactMode === 2); }
  if (B.reactBtns) B.reactBtns.forEach((b, i) => setOn(b, i === reactMode));
  if (B.cam) B.cam.textContent = camOn ? 'camera · ' + (camFacing === 'user' ? 'front · tap to flip' : 'back · tap to flip') : 'camera · start';
  if (B.change) B.change.textContent = 'image change · ' + CHANGES[changeMode][0];
  if (B.imgInfo) B.imgInfo.textContent = (imgs.length ? imgs.length + ' image' + (imgs.length > 1 ? 's' : '') + ' in the set (up to ' + MAX_IMG + ')' : 'no images yet · add several at once for a set') + ' · with music they change on the beat, without music every ' + (CHANGES[changeMode][2] || '-') + ' s';
  store('change2', changeMode);
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
  const show = focusFx && (fxOn[focusFx] || peek);
  amtBox.style.display = show ? 'block' : 'none';
  if (show) {
    amtLabel.textContent = focusFx + ' · amount';
    midiTag(amtSlider, 'fa:' + focusFx); midiTag(B.drow, 'fd:' + focusFx);
    midiTag(B.rate, 'act:rate'); midiTag(B.mpal, 'act:style');
    const vs = VARIANTS[focusFx];
    B.mpal.style.display = vs ? '' : 'none';
    if (vs) B.mpal.textContent = (['mondrian', 'riso', 'warhol', 'shapes'].includes(focusFx) ? 'colours · ' : 'style · ') + vs[fxVar[focusFx]];
    B.fmus.textContent = 'music · ' + (fxMus[focusFx] ? 'on' : 'off'); setOn(B.fmus, !fxMus[focusFx]);
    B.mrow.style.display = focusFx === 'mondrian' && !MOND_PALS[fxVar.mondrian].none ? '' : 'none';
    B.malphaVal.textContent = mondAlpha.toFixed(2);
    B.danceVal.textContent = fxDance[focusFx].toFixed(2);
    if (document.activeElement !== B.dance) B.dance.value = fxDance[focusFx];
    B.rate.textContent = 'every ' + RATE_NAME[fxRate[focusFx]];
    if (document.activeElement !== B.malpha) B.malpha.value = mondAlpha;
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
// the print button: tap = next finish (off, halftone, riso, dither, lines, xerox, ink), hold = its amount, style and music
function printButton(parent) {
  const b = el('button', 'prt', parent);
  midiTag(b, 'act:print');
  b.innerHTML = 'print<br>off';
  let timer = null, held = false, pressed = false;
  b.addEventListener('pointerdown', () => {
    pressed = true; held = false; clearTimeout(timer);
    timer = setTimeout(() => {
      held = true;
      if (printMode < 0) setPrint(0);
      focusFx = PRINTS[printMode]; peek = false; refreshFx();
    }, 350);
  });
  const end = (cancel) => {
    clearTimeout(timer);
    if (!pressed) return;
    pressed = false;
    if (!held && !cancel) { setPrint(printMode + 1); if (focusFx && PRINTS.includes(focusFx)) focusFx = printMode >= 0 ? PRINTS[printMode] : null; refreshFx(); }
  };
  b.addEventListener('pointerup', () => end(false));
  b.addEventListener('pointercancel', () => end(true));
  return b;
}
function panic() {
  for (const f of FX) { fxOn[f] = false; }
  setPrint(-1);
  focusFx = null;
  setFrozen(false);
  refreshFx();
}

// looks: four saved states
const LOOKS = [null, null, null, null];
let tween = null, curLook = -1;
function snapshot() { return { P: Object.assign({}, P), fxOn: Object.assign({}, fxOn), fxAmt: Object.assign({}, fxAmt), col: colMode, print: printMode, vars: Object.assign({}, fxVar), malpha: mondAlpha, mus: Object.assign({}, fxMus), rate: Object.assign({}, fxRate), dance: Object.assign({}, fxDance) }; }
function store(k, v) { try { localStorage.setItem('frame_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
function recall(k) { try { const v = localStorage.getItem('frame_' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
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
  if (Number.isInteger(o.col) && o.col >= 0 && o.col < COLS.length) colMode = o.col;
  for (const f of FX_ALL) { if (o.mus && typeof o.mus[f] === 'boolean') fxMus[f] = o.mus[f]; }
  if (Number.isFinite(o.malpha)) mondAlpha = Math.min(1, Math.max(0, o.malpha));
  for (const f of FX_ALL) {
    if (o.rate && Number.isInteger(o.rate[f]) && o.rate[f] >= 0 && o.rate[f] < RATES.length) fxRate[f] = o.rate[f];
    if (o.dance && Number.isFinite(o.dance[f])) fxDance[f] = Math.min(1, Math.max(0, o.dance[f]));
  }
  setPrint(Number.isInteger(o.print) ? o.print : -1);
  for (const f of FX_ALL) { if (o.vars && Number.isInteger(o.vars[f]) && VARIANTS[f]) fxVar[f] = ((o.vars[f] % VARIANTS[f].length) + VARIANTS[f].length) % VARIANTS[f].length; }
  clearTrails();
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
  applySettings({ zoom: r(1, 1.4), scale: r(0.2, 0.8), move: r(0.2, 0.8), contrast: r(0.95, 1.4), sat: r(0.6, 1.4), grain: r(0.1, 0.5) });
  const pool = FX.filter((f) => f !== 'push');
  for (const f of FX) { fxOn[f] = false; }
  setPrint(Math.random() < 0.5 ? Math.floor(Math.random() * PRINTS.length) : -1);
  const n = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) { const f = pool[Math.floor(Math.random() * pool.length)]; fxOn[f] = true; fxAmt[f] = r(0.25, 0.85); }
  if (Math.random() < 0.4) colMode = Math.floor(Math.random() * COLS.length);
  for (const f in VARIANTS) { if (fxOn[f]) fxVar[f] = Math.floor(Math.random() * VARIANTS[f].length); }
  clearTrails();
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
  a.download = 'frame-' + Date.now() + (recBlob.type.includes('mp4') ? '.mp4' : '.webm');
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

const KEY_FX = { KeyQ: 'mondrian', KeyW: 'shatter', KeyE: 'puzzle', KeyR: 'strips', KeyT: 'weave', KeyY: 'turn', KeyU: 'fold',
  KeyA: 'push', KeyS: 'lens', KeyD: 'ripple', KeyG: 'collage', KeyJ: 'droste', KeyK: 'mirror', KeyL: 'warhol' };
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
    else if (c === 'KeyC') clearTrails();
    else if (c === 'Space') { e.preventDefault(); if (micOn) toggleMic(); else togglePlay(); }
    else if (c === 'KeyF') goFullscreen();
    else if (c === 'KeyN') randomLook();
    else if (c === 'KeyX' || c === 'ArrowRight') nextImage();
    else if (c === 'KeyZ') setFrozen(!frozen);
    else if (c === 'KeyO') setPrint(printMode + 1);
    else if (c === 'Enter') { e.preventDefault(); hitBeat(); hitHeld = true; hitT = performance.now(); }
    else if (c === 'KeyM') setReact(reactMode + 1);
    else if (c === 'KeyP') { const f = focusFx && VARIANTS[focusFx] ? focusFx : 'mondrian'; setVar(f, fxVar[f] + 1); note(f + ' · ' + VARIANTS[f][fxVar[f]]); }
    else if (c === 'KeyV') { colMode = (colMode + 1) % COLS.length; refreshTop(); }
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
    window.addEventListener('resize', () => { W = 0; });
  } catch (e) {
    glOk = false;
    const f = el('div', '', document.body);
    f.id = 'fatal';
    f.innerHTML = 'FRAME needs WebGL2 on the graphics chip.<br><br>' + String(e.message || e).slice(0, 300);
    const st = el('style', '', document.head);
    st.textContent = CSS;
  }
}
let lastErr = '';
function draw() {
  try {
    renderFrame();
  } catch (e) {
    if (e && e.message !== lastErr) { lastErr = e.message; console.error('frame error:', e); }
  }
}
function windowResized() { W = 0; }

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
})();
