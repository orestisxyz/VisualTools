// noprotect
(function () {
// CAMERA POLYCHORON · a live audiovisual instrument
// The camera (or an image, or a 3D .obj model) becomes a mesh of points whose relief follows brightness,
// repeated as copies through the 4th dimension and projected back to the screen. Music drives it.
// Paste into editor.p5js.org (p5 v1 or v2) and allow the camera. Runs on phones, tablets and computers.
//
// TOP BAR   form (planes, spheres, cubes, pyramids, model) · arrange (stacked in 4D, solo) · style (mesh, faces,
//           rows, columns, glow, strokes) · colour (camera, mono, duotone, thermal, depth, neon) · image ·
//           music (play the file) · mic (or line-in) · rec (video with sound) · ui (hide controls) · menu
// DOCK      visual effects: kaleido ghost ripple hue trails explode twist pull invert strobe, plus lines / shapes /
//           fill (solid, outline, auto) and all off. 'sound' page: filter echo reverb chorus, link, tap tempo.
//           Always: looks 1-4 (tap = recall, hold = save), rnd, page switch.
//           Tap an effect = on / off. Hold = on only while held; drag up / down (or use a 2nd finger on the
//           amount bar) to set its amount.
// MENU      look (sliders, with locks so the music cannot move them) · fx · sound · source (camera, files) ·
//           perf (quality, full screen, projector window) · help
// SOUND     bass -> 4D depth (+ beat pulse) · mids -> relief · upper mids -> planes · treble -> size variety ·
//           loudness -> lines/shapes and saturation · every hit -> solid / outline (fill = auto)
//           The sound rack (filter, echo, reverb, chorus) works on the music file; at most two at once.
// BEAT      the beat clock finds the tempo by itself and predicts every beat; the echo time follows it. The tap button
//           shows it (auto 124); menu · sound: beat clock auto / off; B = tap tempo, ; = auto / off. Off = react to bass hits.
// KEYS      Q-P visual effects · Z X C V filter echo reverb chorus (tap = on/off, hold = while held) · arrows = amount
//           1-4 looks (shift = save) · 0 panic · B tap tempo · N random · , . / style colour form · space play
//           H hide · F full screen.  MIDI learn: Chrome on a computer or Android.
// Uses only p5 and the browser's own Web Audio. Everything is wrapped in a function so no name clashes with p5.

const CAM_W = 160, CAM_H = 120;      // camera sampling resolution
const MAXC = 96, MAXR = 72, MAXPL = 10;
const ax = 0.6, ay = 0.2, az = 0.35; // fixed 4D pose (XW, YW, ZW)
const cax = Math.cos(ax), sax = Math.sin(ax);
const cay = Math.cos(ay), say = Math.sin(ay);
const caz = Math.cos(az), saz = Math.sin(az);

// preallocated buffers (no per-frame allocation = much lighter)
const bx = new Float32Array(MAXC * MAXR), by = new Float32Array(MAXC * MAXR), bz = new Float32Array(MAXC * MAXR * MAXPL);
const cr = new Uint8Array(MAXC * MAXR * MAXPL), cg = new Uint8Array(MAXC * MAXR * MAXPL), cb = new Uint8Array(MAXC * MAXR * MAXPL);
const br = new Float32Array(MAXC * MAXR * MAXPL);
const src = new Int32Array(MAXC * MAXR);   // where each grid point reads the camera
const srcI = new Int32Array(MAXC * MAXR);  // ...and the uploaded image (not mirrored)
const vis = new Uint8Array(MAXC * MAXR);   // 0 = point is cut away by the image's shape
const bsu = new Float32Array(MAXC * MAXR), bsv = new Float32Array(MAXC * MAXR); // base camera coordinates (cached)
const dst = new Float32Array(MAXC * MAXR); // distance from the centre (for the ripple)
// sphere layout: unit direction of each grid point, and its brightness-driven radial offset
const spx = new Float32Array(MAXC * MAXR), spy = new Float32Array(MAXC * MAXR), spz = new Float32Array(MAXC * MAXR), spr = new Float32Array(MAXC * MAXR * MAXPL);
// fixed random numbers per grid point AND per plane (size variety, kind choice)
const rnd = new Float32Array(MAXC * MAXR * MAXPL), rnd2 = new Float32Array(MAXC * MAXR * MAXPL);
for (let i = 0; i < rnd.length; i++) {
  let a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233 + 1.7) * 12345.6789;
  rnd[i] = a - Math.floor(a); rnd2[i] = b - Math.floor(b);
}
const PX = new Float32Array(MAXC * MAXR * MAXPL), PY = new Float32Array(MAXC * MAXR * MAXPL);

let cam;
let rx = -0.2, ry = 0.5;  // 3D view (set by dragging)
let panX = 0, panY = 0, roll = 0;       // move the object (two fingers) and turn it like a wheel (twist)
let vRx = 0, vRy = 0, orbiting = false; // a little glide after you let go of an orbit drag
let cro = 1, sro = 0;                   // cos / sin of the roll, per frame
let camFacing = 'user', camBtn;         // 'user' = front camera, 'environment' = back camera
let S, D = 6;             // screen scale, 4D camera distance
let cvx, svx, cvy, svy;   // per-frame view trig
let zoom = 1;                    // pinch / wheel zoom
let depthSlider, reliefSlider, planesSlider, densitySlider, circleSlider, varietySlider, shapeSlider, saturationSlider, sensSlider;
// effects
// on screen the visual 'echo' (older camera frames on the planes) is called 'ghost', so 'echo' means the sound effect only
const FX_LABEL = { echo: 'ghost' };
const fxName = (f) => FX_LABEL[f] || f;
const FX = ['kaleido', 'echo', 'ripple', 'hue', 'trails', 'explode', 'twist', 'pull', 'invert', 'strobe'];
const fxOn = {}, fxAmt = {};            // which effects are on, and how strong each is (0..1)
for (const f of FX) {
  fxOn[f] = false;
  fxAmt[f] = 0.5;
}
fxAmt.invert = 1;       // invert: how fully the colours flip
fxAmt.strobe = 0.35;    // strobe: speed (kept gentle by default)
let inv = 0, strobeFlip = false, strobeLast = 0, lastBeat = 0;
let fxSlider, fxPanel, fxLabel, fxVal, solidBtn;
let exDrive = 0, twistT = 0, twDrive = 1, exAmt = 0, twAmt = 0, rippleScale = 1;
const pull = { x: 0, y: 0, active: false, str: 0 };   // touch pull: finger position and strength
let kRot = 0, kIdx = 1, kCool = 0, hueRot = 0, rippleT = 0, rippleAmp = 0.15;
const KN = [4, 6, 8, 12];                  // kaleidoscope slice counts
const ECHO_K = 12;                         // echo: camera frames kept
let hist = [], histHead = -1;
let rec = null, recChunks = [], recBlob = null, recMime = '', recStart = 0, recState = 'idle', recBtn, recLast = ''; // video recording
let formMode = 0, arrMode = 0, formBtn, arrBtn;  // form: planes/spheres/cubes/pyramids; arrangement
const FORMS = ['planes', 'spheres', 'cubes', 'pyramids', 'model'];
// ways to draw it, and colour palettes
const STYLES = ['mesh', 'faces', 'rows', 'columns', 'glow', 'strokes'];
const PALS = ['original', 'mono', 'duotone', 'thermal', 'depth', 'neon'];
let styleMode = 0, palMode = 0, styleBtn, palBtn, weightSlider;
const palLut = { 2: new Uint8Array(768), 3: new Uint8Array(768) };
(function buildPalettes() {
  const stops = {
    2: [[0, 14, 6, 40], [0.5, 150, 30, 70], [1, 255, 110, 30]],
    3: [[0, 0, 0, 10], [0.25, 90, 0, 140], [0.5, 220, 30, 50], [0.75, 255, 190, 30], [1, 255, 255, 230]],
  };
  for (const k in stops) {
    const st = stops[k];
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let a = st[0], b = st[st.length - 1];
      for (let q = 0; q < st.length - 1; q++) {
        if (t >= st[q][0] && t <= st[q + 1][0]) { a = st[q]; b = st[q + 1]; break; }
      }
      const u = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      for (let c = 0; c < 3; c++) { palLut[k][i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * u; }
    }
  }
})();
function hsv2rgb(h, sv, v) {                // h 0..1 -> [r, g, b] 0..255
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6), p = v * (1 - sv), q = v * (1 - f * sv), t = v * (1 - (1 - f) * sv);
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][(i + 6) % 6];
  return [c[0] * 255, c[1] * 255, c[2] * 255];
}
// performance
let Q = 1, autoQ = true, targetFps = 60, resScale = 1, fpsAvg = 60, qCount = 0, qHold = 0;
let autoBtn, fpsBtn, resBtn;
let geoKey = '', srcKey = '', imgVersion = 0, modelVersion = 0;   // cache keys
let imgPx = null, imgHasAlpha = false, imgMode = 0, imageBtn;
const IMAGE_MODES = ['camera', 'image', 'cut-out', 'cut-out + camera'];
let modelFull = null, modelPts = null, modelEdges = null, modelTris = null, modelDir = null, modelN = 0, modelTarget = -1; // uploaded 3D model
const ARRS = ['stacked in 4D', 'solo'];   // solo: one single copy
let fillState = 1;                              // auto fill: flips between 1 = solid and 0 = outline with the music
let fillMode = 2, showLines = true, showShapes = true, linesBtn, shapesBtn;   // fillMode: 0 solid, 1 outline, 2 auto (follows the sound)
const FILL_NAMES = ['solid', 'outline', 'auto'];
let prevFreq = null, fluxAvg = 0, fillCool = 0;   // onset detection for the solid/outline switch
let actx, analyser, recDest, freqData, timeData; // Web Audio
let micStream = null, micSrc = null, micOn = false;
let audioEl = null, fileLoaded = false;
let playBtn, micBtn;
let sBass = 0, sMid = 0, sTreble = 0, sLevel = 0; // smoothed sound energy (0..1)
let pulse = 0, bassAvg = 0, beatCool = 0;          // beat pulse state
let sHigh = 0;            // upper mids, for the planes

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  S = min(width, height) * 0.2;

  setupGestures();

  startCamera();

  buildUI();
}

function windowResized() {
  applyCanvasSize();
}

// draw at a fraction of the screen size and let the browser stretch it: much less to draw and record
function applyCanvasSize() {
  resizeCanvas(floor(windowWidth * resScale), floor(windowHeight * resScale));
  const cv = document.querySelector('canvas');
  cv.style.width = windowWidth + 'px';
  cv.style.height = windowHeight + 'px';
  S = min(width, height) * 0.2;
}

// automatic quality: if the frame rate drops, use fewer points and planes; raise them again when there is room
function updateQuality() {
  fpsAvg += (1000 / max(deltaTime, 1) - fpsAvg) * 0.08;
  if (!autoQ) { Q = 1; return; }
  qHold = max(0, qHold - 1);
  if (++qCount % 20 === 0) {
    if (fpsAvg < targetFps * 0.8) { Q = max(0.4, Q * 0.88); qHold = 90; }
    else if (fpsAvg > targetFps * 0.95 && Q < 1 && qHold === 0) Q = min(1, Q * 1.04);
    autoBtn.html('auto quality · ' + round(Q * 100) + '%');
  }
}

// ---------- small helpers for the interface ----------
function setLabel(b, cap, val) {            // two-line label: small caption over the value
  const h = '<small>' + cap + '</small>' + val;
  if (b.elt.__h !== h) { b.elt.innerHTML = h; b.elt.__h = h; }
}

function dbtn(parent, label, meter) {        // a dock button (plain DOM, wrapped so setOn() works)
  const e = document.createElement('button');
  const t = document.createElement('span');
  t.textContent = label;
  e.appendChild(t);
  const o = { elt: e, t, meter: null };
  if (meter) {
    const m = document.createElement('i');
    m.className = 'meter';
    e.appendChild(m);
    o.meter = m;
  }
  parent.appendChild(e);
  return o;
}

function store(mkey, val) {                    // localStorage when it works, memory when it does not
  memStore[mkey] = val;
  try { localStorage.setItem('pc_' + mkey, JSON.stringify(val)); } catch (e) { /* ignore */ }
}
function recall(mkey) {
  try {
    const v = localStorage.getItem('pc_' + mkey);
    if (v !== null) return JSON.parse(v);
  } catch (e) { /* ignore */ }
  return memStore[mkey] === undefined ? null : memStore[mkey];
}
const memStore = {};

// ---------- sliders, with locks (a locked slider stops following the sound) ----------
const SL = {};                                // id -> { sl, val, lock, driven, fmt }
const locked = {};
let uiBody, readouts = [], tabs = {}, panes = {};

function drive(id, v) {                       // the sound moves a slider, unless you locked it
  if (!locked[id]) SL[id].sl.value(v);
}

function setLock(id, on) {
  locked[id] = on;
  const r = SL[id];
  if (r && r.lock) {
    r.lock.html(on ? 'locked' : 'free');
    r.lock.elt.classList.toggle('on', on);
  }
}

function addSlider(parent, id, label, sl, fmt, driven) {
  const row = createDiv();
  row.class('row');
  row.parent(parent);
  row.elt.dataset.mid = 'sl:' + id;
  const top = createDiv();
  top.class('top');
  top.parent(row);
  createSpan(label).parent(top);
  const right = createSpan('');
  right.class('rt');
  right.parent(top);
  const val = createSpan('');
  val.class('val');
  val.parent(right);
  let lock = null;
  if (driven) {
    lock = createButton('free');
    lock.class('lk');
    lock.parent(right);
    lock.elt.addEventListener('click', () => setLock(id, !locked[id]));
  }
  sl.parent(row);
  SL[id] = { sl, val, lock, driven, fmt, last: '', right, row };
  locked[id] = false;
  readouts.push(SL[id]);
  return SL[id];
}

// a menu row for an effect: name, on / off switch, amount
const fxSl = {}, menuTg = {};
function addFxRow(parent, kind, name, label) {
  const rg = rangeOf(kind, name), st = stateOf(kind);
  const sl = createSlider(rg.lo, rg.hi, st.amt[name], 0.01);
  sl.input(() => { st.amt[name] = sl.value(); fxRefresh(); });
  const fmt = (kind === 'ax' && name === 'filter')
    ? (v) => (Math.abs(v) < 0.06 ? 'off' : (v < 0 ? 'low ' : 'high ') + Math.abs(v).toFixed(2))
    : (v) => v.toFixed(2);
  const r = addSlider(parent, (kind === 'fx' ? 'fx_' : 'ax_') + name, label, sl, fmt, false);
  r.row.elt.dataset.mid = (kind === 'fx' ? 'fa:' : 'aa:') + name;      // MIDI learn: the row = its amount
  const tg = createButton('off');
  tg.class('lk');
  tg.elt.dataset.mid = (kind === 'fx' ? 'fx:' : 'ax:') + name;           // ...its switch = on / off
  tg.elt.addEventListener('click', () => setToggle(kind, name, !st.on[name]));
  r.right.elt.insertBefore(tg.elt, r.right.elt.firstChild);
  (kind === 'fx' ? fxSl : axSl)[name] = sl;
  menuTg[kind + ':' + name] = tg;
}

function updateReadouts() {
  if (frameCount % 15 === 0) setLabel2();                               // the found tempo, on the tap button
  if (recState === 'recording') {             // running time on the record button
    const t = floor((millis() - recStart) / 1000);
    const txt = 'stop ' + String(floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    if (txt !== recLast) { setLabel(recBtn, 'rec', txt); recLast = txt; }
  }
  const snd = soundActive();
  if (outWin && frameCount % 30 === 0 && outWin.closed) { outWin = null; outBtn.html('output window'); setOn(outBtn, false); }
  for (const r of readouts) {
    const t = r.fmt(r.sl.value());
    if (t !== r.last) { r.val.html(t); r.last = t; }
  }
  for (const id in SL) {
    const r = SL[id];
    if (r.driven) r.val.elt.classList.toggle('drv', snd && !locked[id]);
  }
}

function addButton(parent, label, fn, full) {
  const b = createButton(label);
  b.parent(parent);
  if (full) b.class('full');
  b.elt.addEventListener('click', () => fn());
  return b;
}

function mbtn(parent, label, fn, mid, full) {   // a menu button whose label can be changed with .t.textContent
  const b = createButton('');
  b.parent(parent);
  if (full) b.class('full');
  const t = document.createElement('span');
  t.textContent = label;
  b.elt.appendChild(t);
  b.t = t;
  if (mid) { b.elt.dataset.mid = mid; ACTIONS[mid] = fn; }
  b.elt.addEventListener('click', () => fn());
  return b;
}

function menuSection(pane, title) {
  const d = createDiv(title);
  d.class('sec');
  d.parent(pane);
}

function btnGrid(pane) {
  const g = createDiv();
  g.class('btns');
  g.parent(pane);
  return g;
}

// ---------- dock: effects page, sound page, and always the looks row ----------
let menuLink, dockPage = 'fx', pageBtn, pgFx, pgSnd, tapBtn, bpmSlider, linkBtn, inBtn, midiBtn, learnBtn, fsBtn;
let outBtn, outWin = null, hideBtn, restoreBtn, hidden = false;
const axSl = {}, lookBtns = [];
let focus = null, peek = false;                // focus = { kind: 'fx' | 'ax', name }; peek = a finger is down on its button
const fxBtns = {}, axBtns = {};

function stateOf(kind) {
  return kind === 'fx' ? { on: fxOn, amt: fxAmt, lo: 0, hi: 1 } : { on: axOn, amt: axAmt, lo: 0, hi: 1 };
}
function rangeOf(kind, name) {
  return (kind === 'ax' && name === 'filter') ? { lo: -1, hi: 1 } : { lo: 0, hi: 1 };
}

function setToggle(kind, name, v) {
  const st = stateOf(kind);
  st.on[name] = v;
  if (kind === 'fx' && name === 'pull' && !v) pull.active = false;
  if (v) focus = { kind, name };
  else if (focus && focus.kind === kind && focus.name === name) focus = null;
  fxRefresh();
}

function buildDock() {
  const dock = createDiv();
  dock.id('dock');
  fxPanel = createDiv();
  fxPanel.id('amt');
  fxPanel.parent(dock);
  fxPanel.elt.style.display = 'none';
  const row = createDiv();
  row.class('top');
  row.parent(fxPanel);
  fxLabel = createSpan('');
  fxLabel.parent(row);
  fxVal = createSpan('');
  fxVal.class('val');
  fxVal.parent(row);
  fxSlider = createSlider(0, 1, 0.5, 0.01);
  fxSlider.parent(fxPanel);
  fxSlider.input(() => {
    if (!focus) return;
    stateOf(focus.kind).amt[focus.name] = fxSlider.value();
    fxRefresh();
  });

  // page 1: visual effects
  pgFx = document.createElement('div');
  pgFx.className = 'pg pg7';
  dock.elt.appendChild(pgFx);
  for (const f of FX) { fxBtns[f] = holdButton('fx', f, pgFx); }
  linesBtn = dbtn(pgFx, 'lines', false);
  tap(linesBtn, 'act:lines', () => { showLines = !showLines; if (!showLines) showShapes = true; refreshLayers(); });
  shapesBtn = dbtn(pgFx, 'shapes', false);
  tap(shapesBtn, 'act:shapes', () => { showShapes = !showShapes; if (!showShapes) showLines = true; refreshLayers(); });
  solidBtn = dbtn(pgFx, 'auto', false);                // fill of the shapes and faces: solid, outline, or flipping with the music
  tap(solidBtn, 'act:solid', () => { fillMode = (fillMode + 1) % 3; refreshLayers(); });
  refreshLayers();
  const off = dbtn(pgFx, 'all off', false);
  tap(off, 'act:alloff', panic);   // everything off: visual and sound effects

  // page 2: the sound rack and tempo (input, midi and full screen live in the menu)
  pgSnd = document.createElement('div');
  pgSnd.className = 'pg';
  pgSnd.style.display = 'none';
  dock.elt.appendChild(pgSnd);
  for (const a of AX) { axBtns[a] = holdButton('ax', a, pgSnd); }
  linkBtn = dbtn(pgSnd, 'link', false);
  tap(linkBtn, 'act:link', () => { linkOn = !linkOn; setOn(linkBtn, linkOn); fxRefresh(); });
  setOn(linkBtn, true);
  tapBtn = dbtn(pgSnd, 'tap 120', false);
  tap(tapBtn, 'act:tap', tapTempo);

  // always visible: four look slots, random, page switch
  const lr = document.createElement('div');
  lr.className = 'pg looks';
  dock.elt.appendChild(lr);
  for (let i = 0; i < 4; i++) {
    const b = dbtn(lr, String(i + 1), false);
    lookBtns.push(b);
    lookSlot(b, i);
  }
  const rb = dbtn(lr, 'rnd', false);
  tap(rb, 'act:rnd', randomLook);
  pageBtn = dbtn(lr, 'sound', false);
  tap(pageBtn, 'act:page', () => showPage(dockPage === 'fx' ? 'snd' : 'fx'));
  refreshLooks();
  fxRefresh();
}

// the p5 editor on a phone puts its own toolbar over the bottom of the page: lift the dock above it
let dockLift = 0, liftBtn;
function applyLift() {
  const d = document.getElementById('dock');
  if (d) d.style.paddingBottom = 'calc(env(safe-area-inset-bottom, 0px) + ' + dockLift + 'px)';
  if (liftBtn) liftBtn.html('dock lift · ' + dockLift + ' px');
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
  dockLift = v;
  applyLift();
}

function refreshLayers() {
  setOn(linesBtn, showLines);
  setOn(shapesBtn, showShapes);
  solidBtn.t.textContent = FILL_NAMES[fillMode];
  setOn(solidBtn, fillMode === 2);
}

function showPage(p) {
  dockPage = p;
  pgFx.style.display = p === 'fx' ? '' : 'none';
  pgSnd.style.display = p === 'snd' ? '' : 'none';
  pageBtn.t.textContent = p === 'fx' ? 'sound' : 'fx';
}

function allOff() {
  for (const f of FX) { fxOn[f] = false; }
  pull.active = false;
  focus = null;
  fxRefresh();
}

// a plain tap button (also a MIDI target)
function tap(b, mid, fn) {
  b.elt.dataset.mid = mid;
  b.elt.addEventListener('click', () => fn());
  ACTIONS[mid] = fn;
}

// tap = on/off. Hold = on while held; drag up/down while holding to set the amount. The bar under the name shows the amount.
function holdButton(kind, name, parent) {
  const b = dbtn(parent, kind === 'ax' ? AX_LABEL[name] : fxName(name), true);
  const st = stateOf(kind), rg = rangeOf(kind, name);
  let timer = null, momentary = false, prev = false, y0 = 0, a0 = 0, pressed = false;
  b.elt.style.touchAction = 'none';
  b.elt.dataset.mid = (kind === 'fx' ? 'fx:' : 'ax:') + name;
  b.elt.addEventListener('pointerdown', (e) => {
    if (midi.learn) return;
    pressed = true; momentary = false;
    prev = st.on[name]; y0 = e.clientY; a0 = st.amt[name];
    peek = true; focus = { kind, name }; fxRefresh();      // the amount bar appears at once: move it with another finger
    try { b.elt.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    clearTimeout(timer);
    timer = setTimeout(() => { momentary = true; setToggle(kind, name, true); }, 300);
  });
  b.elt.addEventListener('pointermove', (e) => {
    if (!momentary) return;
    st.amt[name] = constrain(a0 + (y0 - e.clientY) / 160 * (rg.hi - rg.lo), rg.lo, rg.hi);
    fxRefresh();
  });
  const end = (e, cancel) => {
    clearTimeout(timer);
    if (!pressed) return;
    pressed = false;
    peek = false;
    if (momentary) {
      momentary = false;
      if (!prev) setToggle(kind, name, false);
      else fxRefresh();
      return;
    }
    if (!cancel) setToggle(kind, name, !st.on[name]);
    else { if (!st.on[name] && focus && focus.name === name) focus = null; fxRefresh(); }
  };
  b.elt.addEventListener('pointerup', (e) => end(e, false));
  b.elt.addEventListener('pointercancel', (e) => end(e, true));
  return b;
}

function fxRefresh() {
  for (const f of FX) {
    const b = fxBtns[f];
    if (!b) continue;
    setOn(b, fxOn[f]);
    b.elt.classList.toggle('focus', !!focus && focus.kind === 'fx' && focus.name === f);
    b.meter.style.width = round(fxAmt[f] * 100) + '%';
  }
  for (const a of AX) {
    const b = axBtns[a];
    if (!b) continue;
    const wanted = axWanted(a);
    const sounding = !!axAct[a];
    setOn(b, axOn[a]);
    b.elt.classList.toggle('link', wanted && !axOn[a] && sounding);
    b.elt.classList.toggle('wait', wanted && !sounding);
    b.elt.classList.toggle('focus', !!focus && focus.kind === 'ax' && focus.name === a);
    b.meter.style.width = round(Math.abs(axAmt[a]) * 100) + '%';
    if (axSl[a] && Math.abs(axSl[a].value() - axAmt[a]) > 1e-6) axSl[a].value(axAmt[a]);
  }
  const show = focus && (stateOf(focus.kind).on[focus.name] || peek || midi.learn);
  fxPanel.elt.style.display = show ? 'block' : 'none';
  if (show) {
    const rg = rangeOf(focus.kind, focus.name), v = stateOf(focus.kind).amt[focus.name];
    fxSlider.elt.min = rg.lo; fxSlider.elt.max = rg.hi;
    fxSlider.value(v);
    fxLabel.html((focus.kind === 'ax' ? 'sound · ' + AX_LABEL[focus.name] : fxName(focus.name)) + ' · amount');
    fxVal.html(focus.name === 'filter' ? (Math.abs(v) < 0.06 ? 'off' : (v < 0 ? 'low-pass ' : 'high-pass ') + Math.abs(v).toFixed(2)) : v.toFixed(2));
    fxPanel.elt.dataset.mid = (focus.kind === 'fx' ? 'fa:' : 'aa:') + focus.name;
  }
  for (const k in menuTg) {
    const p = k.indexOf(':'), kind = k.slice(0, p), name = k.slice(p + 1), on = stateOf(kind).on[name];
    const tg = menuTg[k];
    tg.html(on ? 'on' : 'off');
    tg.elt.classList.toggle('on', on);
  }
  for (const f in fxSl) { if (Math.abs(fxSl[f].value() - fxAmt[f]) > 1e-6) fxSl[f].value(fxAmt[f]); }
  if (menuLink) {
    menuLink.html(linkOn ? 'link on' : 'link off'); setOn(menuLink, linkOn);
  }
  if (linkBtn) {
    setOn(linkBtn, linkOn);
    linkBtn.t.textContent = linkOn ? 'link on' : 'link off';
  }
}

// ---------- looks: four saved states, a tween between them, random ----------
const LOOK_IDS = ['depth', 'relief', 'planes', 'density', 'circle', 'variety', 'shape', 'saturation', 'weight'];
let tween = null;

function snapshot() {
  const o = { sl: {}, fxOn: Object.assign({}, fxOn), fxAmt: Object.assign({}, fxAmt), axOn: Object.assign({}, axOn), axAmt: Object.assign({}, axAmt),
    form: formMode, arr: arrMode, arrV: 2, style: styleMode, pal: palMode, fill: fillMode, lines: showLines, shapes: showShapes, locks: {}, link: linkOn, bpm,
    view: { zoom, panX, panY, roll, rx, ry } };
  for (const id of LOOK_IDS) { o.sl[id] = SL[id].sl.value(); }
  for (const id in SL) { if (SL[id].driven) o.locks[id] = !!locked[id]; }
  return o;
}

function applyLook(o) {
  if (!o) return;
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  for (const f of FX) {
    fxOn[f] = !!(o.fxOn && o.fxOn[f]);
    if (o.fxAmt && Number.isFinite(o.fxAmt[f])) fxAmt[f] = o.fxAmt[f];
  }
  if (!fxOn.pull) pull.active = false;
  for (const a of AX) {
    axOn[a] = !!(o.axOn && o.axOn[a]);
    if (o.axAmt && Number.isFinite(o.axAmt[a])) axAmt[a] = o.axAmt[a];
  }
  if (Number.isInteger(o.form) && o.form >= 0 && o.form < FORMS.length && !(o.form === 4 && !modelFull)) formMode = o.form;
  if (Number.isInteger(o.arr)) {
    const a = o.arrV === 2 ? o.arr : (o.arr === 3 ? 1 : 0);   // looks saved before the nested options were removed
    if (a >= 0 && a < ARRS.length) arrMode = a;
  }
  if (Number.isInteger(o.style) && o.style >= 0 && o.style < STYLES.length) styleMode = o.style;
  if (Number.isInteger(o.pal) && o.pal >= 0 && o.pal < PALS.length) palMode = o.pal;
  if (Number.isInteger(o.fill) && o.fill >= 0 && o.fill < 3) fillMode = o.fill;
  if (typeof o.lines === 'boolean') showLines = o.lines;
  if (typeof o.shapes === 'boolean') showShapes = o.shapes;
  if (!showLines && !showShapes) showLines = true;
  refreshLayers();
  if (o.locks) {
    for (const id in o.locks) { if (SL[id]) setLock(id, !!o.locks[id]); }
  }
  if (typeof o.link === 'boolean') linkOn = o.link;
  if (Number.isFinite(o.bpm)) { bpm = o.bpm; if (bpmSlider) bpmSlider.value(bpm); setLabel2(); }
  focus = null;
  refreshTop();
  fxRefresh();
  // sliders and the view glide to the new values
  const snd = soundActive();
  const from = {}, to = {};
  for (const id of LOOK_IDS) {
    if (o.sl && Number.isFinite(o.sl[id]) && !(snd && SL[id].driven && !locked[id])) { from[id] = SL[id].sl.value(); to[id] = o.sl[id]; }
  }
  const v = o.view || {};
  tween = { t0: millis(), dur: 700, from, to,
    vf: { zoom, panX, panY, roll, rx, ry },
    vt: { zoom: num(v.zoom, zoom), panX: num(v.panX, panX), panY: num(v.panY, panY), roll: num(v.roll, roll), rx: num(v.rx, rx), ry: num(v.ry, ry) } };
}

function updateTween() {
  if (!tween) return;
  const k = constrain((millis() - tween.t0) / tween.dur, 0, 1), e = k * k * (3 - 2 * k);
  for (const id in tween.to) { SL[id].sl.value(tween.from[id] + (tween.to[id] - tween.from[id]) * e); }
  zoom = lerp(tween.vf.zoom, tween.vt.zoom, e);
  panX = lerp(tween.vf.panX, tween.vt.panX, e);
  panY = lerp(tween.vf.panY, tween.vt.panY, e);
  roll = lerp(tween.vf.roll, tween.vt.roll, e);
  rx = lerp(tween.vf.rx, tween.vt.rx, e);
  ry = lerp(tween.vf.ry, tween.vt.ry, e);
  vRx = 0; vRy = 0;
  if (k >= 1) tween = null;
}

function refreshLooks() {
  for (let i = 0; i < 4; i++) {
    lookBtns[i].elt.classList.toggle('has', !!LOOKS[i]);
    lookBtns[i].elt.classList.toggle('cur', i === curLook);
    lookBtns[i].t.textContent = String(i + 1);
  }
}

function saveLook(i) {
  LOOKS[i] = snapshot();
  store('look' + i, LOOKS[i]);
  lookBtns[i].t.textContent = 'saved';
  setTimeout(refreshLooks, 700);
  refreshLooks();
  lookBtns[i].t.textContent = 'saved';
}

let curLook = -1;
function recallLook(i) {
  if (LOOKS[i]) { applyLook(LOOKS[i]); curLook = i; refreshLooks(); }
  else { lookBtns[i].t.textContent = 'empty'; setTimeout(refreshLooks, 700); }
}

function lookSlot(b, i) {
  let timer = null, pressed = false, saved = false;
  b.elt.dataset.mid = 'act:look' + (i + 1);
  ACTIONS['act:look' + (i + 1)] = () => recallLook(i);
  b.elt.style.touchAction = 'none';
  b.elt.addEventListener('pointerdown', () => {
    if (midi.learn) return;
    pressed = true; saved = false;
    clearTimeout(timer);
    timer = setTimeout(() => { saved = true; saveLook(i); }, 600);   // hold = save
  });
  const end = (cancel) => {
    clearTimeout(timer);
    if (!pressed) return;
    pressed = false;
    if (!saved && !cancel) recallLook(i);                           // tap = recall
  };
  b.elt.addEventListener('pointerup', () => end(false));
  b.elt.addEventListener('pointercancel', () => end(true));
}
const LOOKS = [null, null, null, null];

function randomLook() {
  const r = (a, b) => a + Math.random() * (b - a);
  const o = snapshot();
  o.sl = { depth: r(0.6, 5), relief: r(0.2, 1.6), planes: round(r(2, 6)), density: round(r(24, 60)), circle: r(0, 1), variety: r(0, 1), shape: r(0, 1), saturation: r(0.6, 1.6), weight: r(0.7, 2) };
  o.form = floor(Math.random() * (modelFull ? 5 : 4));
  o.arr = floor(Math.random() * ARRS.length);
  o.style = floor(Math.random() * STYLES.length);
  o.pal = floor(Math.random() * PALS.length);
  const pool = ['kaleido', 'echo', 'ripple', 'hue', 'trails', 'explode', 'twist', 'invert'];
  for (const f of FX) { o.fxOn[f] = false; }
  const n = floor(Math.random() * 3);                              // 0 to 2 effects, never strobe or pull
  for (let i = 0; i < n; i++) { o.fxOn[pool[floor(Math.random() * pool.length)]] = true; }
  o.fill = floor(Math.random() * 3);
  o.view = { zoom, panX, panY, roll, rx: r(-0.7, 0.3), ry: r(-1.2, 1.2) };
  applyLook(o);
}

// ---------- input device (line-in from an audio interface) ----------
let inputs = [], inputIdx = -1, inputId = null;
async function cycleInput() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) throw new Error('none');
    const devs = await navigator.mediaDevices.enumerateDevices();
    inputs = devs.filter((d) => d.kind === 'audioinput');
  } catch (e) { inputs = []; }
  if (!inputs.length) { inBtn.t.textContent = 'input · none found'; return; }
  inputIdx = (inputIdx + 1) % inputs.length;
  inputId = inputs[inputIdx].deviceId;
  const nm = (inputs[inputIdx].label || 'input ' + (inputIdx + 1)).replace(/\(.*?\)/g, '').trim();
  inBtn.t.textContent = 'input · ' + nm.slice(0, 24);
  inBtn.elt.title = inputs[inputIdx].label || '';
  if (micOn) { await toggleMic(); await toggleMic(); }              // restart on the new input
}

// ---------- midi: learn any control ----------
const midi = { access: null, on: false, learn: false, map: recallMap(), target: null, prev: {} };
const ACTIONS = {};
function recallMap() { return recall('midi') || {}; }

async function toggleMidi() {
  if (!navigator.requestMIDIAccess) { midiBtn.t.textContent = 'midi n/a'; return; }
  if (midi.access) {
    midi.on = !midi.on;
    midiRefresh();
    return;
  }
  midiBtn.t.textContent = 'midi…';
  try {
    midi.access = await navigator.requestMIDIAccess();
    midi.on = true;
    const hook = () => {
      for (const inp of midi.access.inputs.values()) { inp.onmidimessage = onMidi; }
      midiRefresh();
    };
    midi.access.onstatechange = hook;
    hook();
  } catch (e) { midiBtn.t.textContent = 'midi blocked'; }
}

function midiRefresh() {
  const n = midi.access ? Array.from(midi.access.inputs.values()).length : 0;
  midiBtn.t.textContent = midi.on ? 'midi on · ' + n + ' in' : 'midi off';
  setOn(midiBtn, midi.on);
  setOn(learnBtn, midi.learn);
  const cnt = Object.keys(midi.map).length;
  if (midiNote) midiNote.html(cnt + ' controls mapped' + (midi.on ? '' : ' · midi is off'));
}

function toggleLearn() {
  if (!midi.on) toggleMidi();
  midi.learn = !midi.learn;
  if (!midi.learn) midi.target = null;
  document.body.classList.toggle('learning', midi.learn);
  document.querySelectorAll('.pick').forEach((e) => e.classList.remove('pick'));
  midiRefresh();
  fxRefresh();
}

function onMidi(ev) {
  if (!midi.on) return;
  const d = ev.data;
  if (!d || d.length < 2) return;
  const st = d[0] & 0xf0, d1 = d[1], d2 = d.length > 2 ? d[2] : 0;
  let mkey = null, v = 0;
  if (st === 0xb0) { mkey = 'cc:' + d1; v = d2 / 127; }
  else if (st === 0x90 && d2 > 0) { mkey = 'n:' + d1; v = 1; }
  else return;
  if (midi.learn) {
    if (midi.target) {
      midi.map[mkey] = midi.target;
      store('midi', midi.map);
      midi.target = null;
      document.querySelectorAll('.pick').forEach((e) => e.classList.remove('pick'));
      midiRefresh();
    }
    return;
  }
  const id = midi.map[mkey];
  if (id) {
    try { runTarget(id, v, mkey); } catch (e) { /* a stale mapping must never stop the show */ }
  }
}

function runTarget(id, v, mkey) {
  const p = id.indexOf(':'), kind = id.slice(0, p), name = id.slice(p + 1);
  if ((kind === 'fx' || kind === 'fa') && !FX.includes(name)) return;
  if ((kind === 'ax' || kind === 'aa') && !AX.includes(name)) return;
  const trig = () => {                      // a knob counts as a button when it crosses the middle
    const was = midi.prev[mkey] || 0;
    midi.prev[mkey] = v;
    return mkey.charAt(0) === 'n' || (was < 0.5 && v >= 0.5);
  };
  if (kind === 'sl' && SL[name]) {
    const s = SL[name].sl, lo = parseFloat(s.elt.min), hi = parseFloat(s.elt.max);
    s.value(lo + v * (hi - lo));
    if (SL[name].driven) setLock(name, true);       // a knob you touch stays yours
  } else if (kind === 'fa' || kind === 'aa') {
    const k = kind === 'fa' ? 'fx' : 'ax', rg = rangeOf(k, name);
    stateOf(k).amt[name] = rg.lo + v * (rg.hi - rg.lo);
    fxRefresh();
  } else if (kind === 'fx' || kind === 'ax') {
    if (trig()) setToggle(kind, name, !stateOf(kind).on[name]);
  } else if (kind === 'act' && ACTIONS[id]) {
    if (trig()) ACTIONS[id]();
  }
}

function setupLearnCapture() {
  const grab = (e) => {
    if (!midi.learn) return;
    const t = e.target.closest ? e.target.closest('[data-mid]') : null;
    e.stopPropagation();
    e.preventDefault();
    if (e.type !== 'pointerdown' || !t || !t.dataset.mid) return;
    midi.target = t.dataset.mid;
    document.querySelectorAll('.pick').forEach((x) => x.classList.remove('pick'));
    t.classList.add('pick');
    const m = /^(fx|ax):(.+)$/.exec(midi.target);
    if (m) { focus = { kind: m[1], name: m[2] }; fxRefresh(); }     // so its amount bar can be picked next
  };
  for (const ev of ['pointerdown', 'pointerup', 'click', 'mousedown', 'touchstart']) {
    document.addEventListener(ev, (e) => {
      if (!midi.learn) return;
      const t = e.target.closest ? e.target.closest('#learn-exit') : null;
      if (e.target.closest && e.target.closest('[data-mid="act:learn"]')) return;   // the learn button itself still works
      if (t) return;
      // only controls that can be mapped are picked; the menu, its tabs and everything else keep working
      if (!(e.target.closest && e.target.closest('[data-mid]'))) return;
      grab(e);
    }, true);
  }
}
let midiNote = null;

// ---------- full screen, projector window, keep awake ----------
function goFullscreen() {
  const el = document.documentElement;
  const f = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!f) { fsBtn.t.textContent = 'full screen · n/a'; return; }
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    try { const p = f.call(el); if (p && p.catch) p.catch(() => { fsBtn.t.textContent = 'full screen · n/a'; }); } catch (e) { fsBtn.t.textContent = 'full screen · n/a'; }
  }
}

function toggleOutput() {
  if (outWin && !outWin.closed) { try { outWin.close(); } catch (e) { /* ignore */ } outWin = null; outBtn.html('output window'); setOn(outBtn, false); return; }
  const cv = document.querySelector('canvas');
  let w = null;
  try { w = window.open('', 'polychoron_output', 'width=960,height=540'); } catch (e) { w = null; }
  if (!w || !cv.captureStream) { outBtn.html('output · blocked'); return; }
  try {
    w.document.title = 'polychoron output';
    w.document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
    const v = w.document.createElement('video');
    v.muted = true; v.autoplay = true; v.playsInline = true;
    v.style.cssText = 'width:100vw;height:100vh;object-fit:contain;cursor:none;background:#000';
    v.srcObject = cv.captureStream(30);
    v.addEventListener('click', () => { if (v.requestFullscreen) v.requestFullscreen(); });   // click the window for full screen
    w.document.body.appendChild(v);
    const pr = v.play();
    if (pr && pr.catch) pr.catch(() => { /* ignore */ });
    outWin = w;
    outBtn.html('output · close');
    setOn(outBtn, true);
  } catch (e) {
    outBtn.html('output · blocked');
  }
}

let wake = null;
async function keepAwake() {
  try {
    if (navigator.wakeLock && !wake) {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    }
  } catch (e) { /* ignore */ }
}

// ---------- hide the controls (clean picture for the projector) ----------
function setHidden(h) {
  hidden = h;
  const top = document.getElementById('top'), dock = document.getElementById('dock');
  if (top) top.style.display = h ? 'none' : '';
  if (dock) dock.style.display = h ? 'none' : '';
  if (restoreBtn) restoreBtn.style.display = h ? 'block' : 'none';
  if (hideBtn) setOn(hideBtn, h);
}

// keyboard for live use (by key position, so it works on any keyboard layout, Greek included)
// Q W E R T Y U I O P = the ten visual effects, Z X C V = filter echo reverb chorus.
// tap a key = on / off; hold it = on only while held. 1-4 = looks (shift = save), 0 = panic (everything off),
// B = tap tempo, N = random look, , . / = style, colour, form, space = play / pause, H = hide, F = full screen.
const KEY_FX = { KeyQ: 'kaleido', KeyW: 'echo', KeyE: 'ripple', KeyR: 'hue', KeyT: 'trails', KeyY: 'explode', KeyU: 'twist', KeyI: 'pull', KeyO: 'invert', KeyP: 'strobe' };
const KEY_AX = { KeyZ: 'filter', KeyX: 'echo', KeyC: 'reverb', KeyV: 'chorus' };
const keyDown = {};

function panic() {
  for (const f of FX) { fxOn[f] = false; }
  for (const a of AX) { axOn[a] = false; }
  pull.active = false;
  strobeFlip = false;
  focus = null;
  fxRefresh();
}

function setupKeys() {
  const typing = (e) => {
    const tg = e.target;
    return tg && ((tg.tagName === 'INPUT' && tg.type !== 'range') || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
  };
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    const c = e.code;
    const fx = KEY_FX[c], axn = KEY_AX[c];
    if (fx || axn) {
      e.preventDefault();
      if (e.repeat || keyDown[c]) return;
      const kind = fx ? 'fx' : 'ax', name = fx || axn;
      const was = stateOf(kind).on[name];
      keyDown[c] = { t: performance.now(), was, kind, name };
      if (!was) setToggle(kind, name, true);
      else focus = { kind, name };
      fxRefresh();
      return;
    }
    if (e.repeat) return;
    if (c === 'KeyH') setHidden(!hidden);
    else if (c === 'Escape') { if (hidden) setHidden(false); }
    else if (/^Digit[1-4]$/.test(c)) { const i = parseInt(c.slice(5), 10) - 1; if (e.shiftKey) saveLook(i); else recallLook(i); }
    else if (c === 'Digit0' || c === 'Backspace') { e.preventDefault(); panic(); }
    else if (c === 'Space') { e.preventDefault(); if (micOn) toggleMic(); else togglePlay(); }
    else if (c === 'KeyF') goFullscreen();
    else if (c === 'KeyB') tapTempo();
    else if (c === 'Semicolon') { bcToggle(); setLabel2(); }
    else if (c === 'KeyN') randomLook();
    else if (c === 'Comma') { styleMode = (styleMode + 1) % STYLES.length; refreshTop(); }
    else if (c === 'Period') { palMode = (palMode + 1) % PALS.length; refreshTop(); }
    else if (c === 'Slash') { formMode = (formMode + 1) % FORMS.length; if (formMode === 4 && !modelFull) formMode = 0; refreshTop(); }
    else if (c === 'ArrowUp' || c === 'ArrowDown') {          // arrows: amount of the effect you touched last
      if (!focus) return;
      e.preventDefault();
      const st = stateOf(focus.kind), rg = rangeOf(focus.kind, focus.name);
      st.amt[focus.name] = constrain(st.amt[focus.name] + (c === 'ArrowUp' ? 0.05 : -0.05) * (rg.hi - rg.lo) / 1, rg.lo, rg.hi);
      fxRefresh();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = keyDown[e.code];
    if (!k) return;
    delete keyDown[e.code];
    const held = performance.now() - k.t > 300;
    if (held) { if (!k.was) setToggle(k.kind, k.name, false); }   // held: back to how it was
    else if (k.was) setToggle(k.kind, k.name, false);               // tapped an effect that was on: off
    fxRefresh();
  });
  window.addEventListener('blur', () => {                           // switching window while holding a key: release it
    for (const c in keyDown) {
      const k = keyDown[c];
      if (!k.was) setToggle(k.kind, k.name, false);
      delete keyDown[c];
    }
  });
}

// ---------- control panel: minimal, industrial ----------
const UI_CSS = `
#top{position:fixed;left:0;top:0;right:0;z-index:10;pointer-events:none;padding-top:env(safe-area-inset-top,0px)}
#top>*{pointer-events:auto}
#bar,#ui,#dock,#restore{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font:10px/1.2 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.09em;text-transform:uppercase;
  -webkit-user-select:none;user-select:none}
#bar{display:flex;flex-wrap:wrap;gap:1px;background:#23262a;border-bottom:1px solid #34373c}
#bar button{touch-action:manipulation;flex:1 1 18%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:rgba(13,14,16,.9);color:#b9bdc2;
  border:0;border-radius:0;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:center;padding:7px 4px 8px;cursor:pointer}
#bar button small{display:block;font-size:8px;letter-spacing:.14em;color:#5a5f65;margin-bottom:3px}
#bar button.on{background:#ff5a1f;color:#0d0e10}
#bar button.on small{color:#0d0e10;opacity:.6}
#bar button:active{background:#1b1d20}
#ui{width:min(260px,92vw);max-height:calc(100vh - 250px);overflow-y:auto;background:rgba(13,14,16,.94);color:#8b9096;
  border-right:1px solid #34373c;border-bottom:1px solid #34373c;touch-action:pan-y}
#ui *{box-sizing:border-box}
#ui .tabs{display:flex;gap:1px;background:#23262a;position:sticky;top:0;z-index:2}
#ui .tabs button{flex:1;min-width:0;letter-spacing:.04em;background:#0d0e10;color:#8b9096;border:0;border-radius:0;font:inherit;letter-spacing:inherit;text-transform:inherit;padding:9px 0;cursor:pointer}
#ui .tabs button.on{background:#1b1d20;color:#ff5a1f;box-shadow:inset 0 -2px 0 #ff5a1f}
#ui .sec{padding:9px 10px 5px;color:#5a5f65;border-top:1px solid #23262a}
#ui .btns{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#23262a;border-top:1px solid #23262a;border-bottom:1px solid #23262a}
#ui .btns button{background:#0d0e10;color:#b9bdc2;border:0;border-radius:0;font:inherit;letter-spacing:inherit;
  text-transform:inherit;text-align:left;cursor:pointer;padding:9px 10px}
#ui .btns button:active{background:#1b1d20}
#ui .btns button.on{background:#ff5a1f;color:#0d0e10}
#ui .full{grid-column:1 / -1}
#ui .note{padding:6px 10px 9px;line-height:1.7;letter-spacing:.04em;color:#8b9096}
#ui .row{padding:7px 10px 6px}
#ui .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px}
#ui .rt{display:flex;align-items:center;gap:8px}
#ui .val{color:#e8eaec}
#ui .val.drv{color:#ff5a1f}
#ui button.lk{background:#0d0e10;color:#5a5f65;border:1px solid #34373c;border-radius:0;font:inherit;font-size:8px;letter-spacing:.1em;text-transform:uppercase;padding:2px 5px;cursor:pointer}
#ui button.lk.on{background:#e8eaec;color:#0d0e10;border-color:#e8eaec}
#ui input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:16px;margin:0;background:transparent}
#ui input[type=range]::-webkit-slider-runnable-track{height:1px;background:#52565c}
#ui input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:7px;height:15px;margin-top:-7px;background:#e8eaec;border:0;border-radius:0}
#ui input[type=range]:active::-webkit-slider-thumb{background:#ff5a1f}
#ui input[type=range]::-moz-range-track{height:1px;background:#52565c}
#ui input[type=range]::-moz-range-thumb{width:7px;height:15px;background:#e8eaec;border:0;border-radius:0}
#ui input[type=file]{width:100%;font:inherit;letter-spacing:inherit;color:#8b9096;text-transform:none;padding:7px 10px}
#ui input[type=file]::file-selector-button{background:#0d0e10;color:#b9bdc2;border:1px solid #34373c;border-radius:0;padding:6px 8px;
  margin-right:8px;font:inherit;letter-spacing:inherit;text-transform:uppercase}
#amt .top{display:flex;justify-content:space-between;margin-bottom:3px}
#amt .val{color:#e8eaec}
#amt{touch-action:none}
#amt input[type=range]{-webkit-appearance:none;appearance:none;display:block;width:100%;height:44px;margin:0;background:transparent;touch-action:none}
#amt input[type=range]::-webkit-slider-runnable-track{height:1px;background:#52565c}
#amt input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:26px;margin-top:-13px;background:#e8eaec;border:0;border-radius:0}
#amt input[type=range]:active::-webkit-slider-thumb{background:#ff5a1f}
#amt input[type=range]::-moz-range-track{height:1px;background:#52565c}
#amt input[type=range]::-moz-range-thumb{width:7px;height:15px;background:#e8eaec;border:0;border-radius:0}
#dock{position:fixed;left:0;right:0;bottom:0;z-index:10;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)}
#dock>*{pointer-events:auto}
#amt{background:rgba(13,14,16,.92);border-top:1px solid #34373c;padding:8px 12px 6px;color:#8b9096}
#dock .pg{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:#23262a;border-top:1px solid #34373c}
#dock .pg.pg7{grid-template-columns:repeat(7,1fr)}
#dock button{position:relative;background:rgba(13,14,16,.9);color:#b9bdc2;border:0;border-radius:0;font:inherit;letter-spacing:inherit;
  text-transform:inherit;text-align:center;padding:14px 2px 12px;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  overflow:hidden;white-space:nowrap}
#dock button:active{background:#1b1d20}
#dock button.on{background:#ff5a1f;color:#0d0e10}
#dock button.link{box-shadow:inset 0 0 0 1px #ff5a1f;color:#ff5a1f}
#dock button.wait{opacity:.45}
#dock button.focus{box-shadow:inset 0 2px 0 #e8eaec}
#dock button.has{box-shadow:inset 0 -2px 0 #e8eaec}
#dock button.cur{color:#ff5a1f;box-shadow:inset 0 -2px 0 #ff5a1f}
#dock .looks button{padding:11px 2px 10px}
#dock .meter{position:absolute;left:0;bottom:0;height:2px;background:#ff5a1f;width:0}
#dock button.on .meter{background:#0d0e10}
#restore{position:fixed;right:8px;top:8px;z-index:11;width:30px;height:30px;display:none;background:rgba(13,14,16,.5);color:#b9bdc2;
  border:1px solid #34373c;border-radius:0;opacity:.35;padding:0;cursor:pointer}
#restore:active,#restore:hover{opacity:1}
body.learning #bar,body.learning #dock{box-shadow:inset 0 0 0 1px #ff5a1f}
.pick{outline:2px solid #ff5a1f;outline-offset:-2px}
`;

function buildUI() {
  const css = document.createElement('style');
  css.textContent = UI_CSS;
  document.head.appendChild(css);

  // top bar: always on screen
  const wrap = createDiv();
  wrap.id('top');
  const bar = createDiv();
  bar.id('bar');
  bar.parent(wrap);
  const bt = (cap, val, fn, mid) => {
    const b = createButton('');
    b.parent(bar);
    b.elt.addEventListener('click', () => fn());
    if (mid) { b.elt.dataset.mid = mid; ACTIONS[mid] = fn; }
    setLabel(b, cap, val);
    return b;
  };
  formBtn = bt('form', 'planes', () => {
    formMode = (formMode + 1) % FORMS.length;
    if (formMode === 4 && !modelFull) formMode = 0;                // no 'model' until one is loaded
    refreshTop();
  }, 'act:form');
  arrBtn = bt('arrange', 'stacked in 4D', () => { arrMode = (arrMode + 1) % ARRS.length; refreshTop(); }, 'act:arr');
  styleBtn = bt('style', 'mesh', () => { styleMode = (styleMode + 1) % STYLES.length; refreshTop(); }, 'act:style');
  palBtn = bt('colour', 'original', () => { palMode = (palMode + 1) % PALS.length; refreshTop(); }, 'act:pal');
  imageBtn = bt('image', 'camera', () => {
    if (!imgPx) { setLabel(imageBtn, 'image', 'add in menu'); return; }
    imgMode = (imgMode + 1) % IMAGE_MODES.length;
    refreshTop();
  }, 'act:image');
  playBtn = bt('music', 'play', () => { keepAwake(); togglePlay(); }, 'act:play');
  micBtn = bt('mic', 'off', () => { keepAwake(); toggleMic(); }, 'act:mic');
  recBtn = bt('rec', 'start', toggleRecord, 'act:rec');
    hideBtn = bt('ui', 'hide', () => setHidden(true), 'act:hide');
  ACTIONS['act:hide'] = () => setHidden(!hidden);
  const menuBtn = bt('menu', 'open', () => {
    const open = uiBody.elt.style.display === 'none';
    uiBody.elt.style.display = open ? 'block' : 'none';
    setLabel(menuBtn, 'menu', open ? 'close' : 'open');
    setOn(menuBtn, open);
  });

  restoreBtn = document.createElement('button');
  restoreBtn.id = 'restore';
  restoreBtn.textContent = '+';
  restoreBtn.addEventListener('click', () => setHidden(false));
  document.body.appendChild(restoreBtn);

  // menu in tabs
  uiBody = createDiv();
  uiBody.id('ui');
  uiBody.parent(wrap);
  uiBody.elt.style.display = 'none';
  const tb = createDiv();
  tb.class('tabs');
  tb.parent(uiBody);
  const names = ['look', 'fx', 'sound', 'source', 'perf', 'help'];
  for (const n of names) {
    const b = createButton(n);
    b.parent(tb);
    b.elt.addEventListener('click', () => showTab(n));
    tabs[n] = b;
    const p = createDiv();
    p.parent(uiBody);
    p.elt.style.display = 'none';
    panes[n] = p;
  }

  const f2 = (v) => v.toFixed(2), f0 = (v) => String(round(v));

  // look
  menuSection(panes.look, 'levels · orange = follows the sound · lock to hold');
  depthSlider = createSlider(0, 8, 3, 0.01);        // distance between the two ends
  reliefSlider = createSlider(0, 2, 0.8, 0.01);     // brightness -> height
  planesSlider = createSlider(2, 10, 3, 1);         // planes between the ends
  densitySlider = createSlider(16, 96, 48, 1);      // grid columns (rows follow 4:3)
  circleSlider = createSlider(0, 1, 0, 0.01);       // 0 = line grid, 1 = shapes
  varietySlider = createSlider(0, 1, 1, 0.01);      // 0 = all the same size, 1 = wide range of sizes
  shapeSlider = createSlider(0, 1, 1, 0.01);        // 0 = only circles, 1 = equal mix of circles, squares, triangles
  saturationSlider = createSlider(0, 2, 1, 0.01);   // 0 = grayscale, 1 = camera colours, 2 = boosted
  sensSlider = createSlider(0.2, 3, 1, 0.01);       // sound sensitivity
  weightSlider = createSlider(0.5, 4, 1, 0.05);     // line weight
  addSlider(panes.look, 'depth', '4D depth', depthSlider, f2, true);
  addSlider(panes.look, 'relief', 'relief', reliefSlider, f2, true);
  addSlider(panes.look, 'planes', 'planes', planesSlider, f0, true);
  addSlider(panes.look, 'density', 'density', densitySlider, f0, false);
  addSlider(panes.look, 'circle', 'lines → shapes', circleSlider, f2, true);
  addSlider(panes.look, 'variety', 'size variety', varietySlider, f2, true);
  addSlider(panes.look, 'shape', 'shape mix', shapeSlider, f2, false);
  addSlider(panes.look, 'saturation', 'saturation', saturationSlider, f2, true);
  addSlider(panes.look, 'weight', 'line weight', weightSlider, f2, false);
  const gl = btnGrid(panes.look);
  addButton(gl, 'reset view', resetView, true);

  // source
  menuSection(panes.source, 'camera');
  const gc = btnGrid(panes.source);
  camBtn = mbtn(gc, 'camera · front', flipCamera, 'act:cam', true);
  menuSection(panes.source, 'music file');
  createFileInput(handleFile).parent(panes.source);
  menuSection(panes.source, 'model · obj');
  createFileInput(handleModel).parent(panes.source);
  menuSection(panes.source, 'image · png / jpg');
  createFileInput(handleImage).parent(panes.source);
  const sn = createDiv('music: press music in the top bar to play. mic: also takes a line-in from an audio interface (choose it in the sound tab, input). Only the music file goes through the sound rack; the mic is only listened to, never played back.');
  sn.class('note');
  sn.parent(panes.source);

  // fx: every visual effect with its switch and amount
  menuSection(panes.fx, 'visual effects · tap = on / off');
  for (const f of FX) { addFxRow(panes.fx, 'fx', f, fxName(f)); }
  const gfx = btnGrid(panes.fx);
  addButton(gfx, 'all off (panic)', panic, true);

  // sound
  menuSection(panes.sound, 'sensitivity');
  addSlider(panes.sound, 'sens', 'sound sensitivity', sensSlider, f2, false);
  menuSection(panes.sound, 'sound rack · on the music file · two at a time');
  for (const a of AX) { addFxRow(panes.sound, 'ax', a, AX_LABEL[a]); }
  const gs = btnGrid(panes.sound);
  menuLink = addButton(gs, 'link on', () => { linkOn = !linkOn; fxRefresh(); });
  bcBtn = mbtn(gs, 'beat clock · auto', () => { bcToggle(); setLabel2(); }, 'act:beatclock');
  addButton(gs, 'tap tempo', tapTempo);
  menuSection(panes.sound, 'input for the mic button · line-in from an audio interface');
  const gi = btnGrid(panes.sound);
  inBtn = mbtn(gi, 'input · default', cycleInput, 'act:input', true);
  bpmSlider = createSlider(50, 220, 120, 1);
  bpmSlider.input(() => { bpm = bpmSlider.value(); bpmSet = true; setLabel2(); });
  addSlider(panes.sound, 'bpm', 'tempo · bpm (echo time)', bpmSlider, f0, false);
  menuSection(panes.sound, 'midi');
  midiNote = createDiv('');
  midiNote.class('note');
  midiNote.parent(panes.sound);
  const gm = btnGrid(panes.sound);
  midiBtn = mbtn(gm, 'midi', toggleMidi, 'act:midi');
  learnBtn = mbtn(gm, 'learn', toggleLearn, 'act:learn');
  addButton(gm, 'clear mapping', () => { midi.map = {}; store('midi', {}); midiRefresh(); }, true);

  // perf
  menuSection(panes.perf, 'performance');
  const g4 = btnGrid(panes.perf);
  autoBtn = addButton(g4, 'auto quality · 100%', () => {
    autoQ = !autoQ;
    setOn(autoBtn, autoQ);
    autoBtn.html(autoQ ? 'auto quality · ' + round(Q * 100) + '%' : 'auto quality · off');
  }, true);
  setOn(autoBtn, true);
  fpsBtn = addButton(g4, 'fps · 60', () => {
    targetFps = targetFps === 60 ? 30 : 60;
    frameRate(targetFps);
    fpsBtn.html('fps · ' + targetFps);
  });
  resBtn = addButton(g4, 'resolution · 100%', () => {
    resScale = resScale === 1 ? 0.75 : (resScale === 0.75 ? 0.5 : 1);
    resBtn.html('resolution · ' + round(resScale * 100) + '%');
    applyCanvasSize();
  });
  liftBtn = addButton(g4, 'dock lift · 0 px', () => {
    const steps = [0, 40, 84, 130];
    dockLift = steps[(steps.indexOf(dockLift) + 1) % steps.length];
    store('lift', dockLift);
    applyLift();
  }, true);
  fsBtn = mbtn(g4, 'full screen', goFullscreen, 'act:full');
  outBtn = addButton(g4, 'output window', toggleOutput);

  // help
  menuSection(panes.help, 'gestures');
  const h1 = createDiv('1 finger · orbit<br>2 fingers · zoom, move, twist<br>double tap · reset view<br>mouse · drag orbit, shift-drag move, wheel zoom<br>pull on · 1 finger pulls the points');
  h1.class('note');
  h1.parent(panes.help);
  menuSection(panes.help, 'effects & sound');
  const h2 = createDiv('tap · on / off<br>hold · on while held, drag up / down for the amount<br>link · sound effects follow the visual effect with the same idea (pull→filter, ghost→echo, trails→reverb, ripple→chorus)<br>two sound effects at most at once (dimmed = waiting)<br>a 2nd finger on the amount bar sets it while you hold an effect<br>all off · every visual and sound effect off<br>looks 1-4 · tap to recall, hold to save · rnd · a random look');
  h2.class('note');
  h2.parent(panes.help);
  menuSection(panes.help, 'keys');
  const h3 = createDiv('q w e r t y u i o p · the ten visual effects<br>z x c v · filter, echo, reverb, chorus<br>tap a key = on / off · hold = only while held<br>↑ ↓ · amount of the last effect<br>1-4 · recall a look · shift + 1-4 · save<br>0 or backspace · panic: everything off<br>b · tap tempo · ; · beat clock auto / off · n · random look<br>, . / · style, colour, form<br>space · play / pause · h · hide · f · full screen<br>esc · show controls');
  h3.class('note');
  h3.parent(panes.help);
  menuSection(panes.help, 'midi learn');
  const h4 = createDiv('chrome on a computer or android. press midi, then learn. tap a control (a slider, a button), then move a knob or press a mkey. To map an effect\'s amount: tap the effect, then tap its amount bar. Press learn again to finish.');
  h4.class('note');
  h4.parent(panes.help);

  showTab('look');
  buildDock();
  setupLearnCapture();
  setupKeys();
  for (let i = 0; i < 4; i++) { LOOKS[i] = recall('look' + i); }
  refreshLooks();
  initLift();
  bcLoad();
  setLabel2();
  midiRefresh();
  window.addEventListener('pointerdown', keepAwake, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
}

function showTab(n) {
  for (const k in panes) {
    panes[k].elt.style.display = k === n ? 'block' : 'none';
    tabs[k].elt.classList.toggle('on', k === n);
  }
}

function refreshTop() {
  setLabel(formBtn, 'form', FORMS[formMode]);
  setLabel(arrBtn, 'arrange', ARRS[arrMode]);
  setLabel(imageBtn, 'image', IMAGE_MODES[imgMode]);
  setLabel(styleBtn, 'style', STYLES[styleMode]);
  setLabel(palBtn, 'colour', PALS[palMode]);
}
function setLabel2() {
  if (tapBtn) tapBtn.t.textContent = BC.on ? (BC.mode === 'tap' ? 'tap ' + Math.round(BC.bpm) : 'auto ' + (BC.locked ? Math.round(BC.bpm) : '…')) : 'tap ' + Math.round(bpm);
  if (bcBtn) { bcBtn.t.textContent = 'beat clock · ' + bcLabel(); setOn(bcBtn, bcActive()); }
}
let bcBtn = null;


// orbit (one finger / mouse) and zoom (two-finger pinch / wheel) on the canvas itself
function setupGestures() {
  const cv = document.querySelector('canvas');
  cv.style.touchAction = 'none';                                      // we handle gestures
  document.addEventListener('gesturestart', (e) => e.preventDefault()); // no page zoom on iOS
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  const pts = new Map();
  let g2 = null, lastTap = 0, lastMove = 0, downT = 0, moved = 0, maxPts = 0; // for telling a tap from a drag
  const toCanvas = (e) => {   // screen pixels -> canvas pixels
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (width / r.width), y: (e.clientY - r.top) * (height / r.height), k: width / r.width };
  };
  const two = () => {         // centre, distance and angle of the two fingers
    const [a, b] = [...pts.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2 }); // mouse: shift or right button moves
    const c = toCanvas(e);
    pull.x = c.x; pull.y = c.y;
    pull.active = fxOn.pull && pts.size === 1;
    orbiting = pts.size === 1;
    vRx = 0; vRy = 0;
    if (pts.size === 2) g2 = two();
    if (pts.size === 1) { downT = performance.now(); moved = 0; maxPts = 1; }
    maxPts = Math.max(maxPts, pts.size);
  });

  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const c = toCanvas(e);
    moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 2) {                                              // two fingers: zoom, move and twist together
      pull.active = false;
      const cur = two();
      zoom = constrain(zoom * cur.d / g2.d, 0.2, 10);
      panX += (cur.cx - g2.cx) * c.k;
      panY += (cur.cy - g2.cy) * c.k;
      let da = cur.ang - g2.ang;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      roll += da;
      g2 = cur;
    } else if (pts.size === 1) {
      if (fxOn.pull) { pull.x = c.x; pull.y = c.y; }                   // pull effect: the finger pulls the points
      else if (p.pan) { panX += dx * c.k; panY += dy * c.k; }          // mouse: shift / right-drag moves the object
      else {                                                           // one finger: orbit
        ry += dx * 0.01; rx += dy * 0.01;
        vRy = dx * 0.01; vRx = dy * 0.01;
        lastMove = performance.now();
      }
    }
  });

  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size === 0 && maxPts === 1) {                              // a quick, still tap; two in a row reset the view
      const now = performance.now();
      if (now - downT < 250 && moved < 12) {
        if (now - lastTap < 350) { resetView(); lastTap = 0; } else lastTap = now;
      }
    }
    pull.active = false;
    orbiting = false;
    if (pts.size > 0 || performance.now() - lastMove > 90) { vRx = 0; vRy = 0; } // glide only after a flick
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = constrain(zoom * (e.deltaY > 0 ? 0.93 : 1.07), 0.2, 10);
  }, { passive: false });
}

// back to the starting view
function resetView() {
  zoom = 1; panX = 0; panY = 0; roll = 0;
  rx = -0.2; ry = 0.5; vRx = 0; vRy = 0;
}

// front / back camera
function startCamera() {
  if (cam) {
    if (cam.elt && cam.elt.srcObject) cam.elt.srcObject.getTracks().forEach((t) => t.stop());
    cam.remove();
  }
  cam = createCapture({ video: { facingMode: { ideal: camFacing } }, audio: false });
  cam.size(CAM_W, CAM_H);
  cam.hide();
}

function flipCamera() {
  camFacing = camFacing === 'user' ? 'environment' : 'user';
  hist = [];
  histHead = -1;
  startCamera();
  camBtn.t.textContent = 'camera · ' + (camFacing === 'user' ? 'front' : 'back');
}

// ---------- uploaded image (png / jpg) ----------
// the image is fitted into the same 160 x 120 frame as the camera
function handleImage(file) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = CAM_W; c.height = CAM_H;
    const g = c.getContext('2d', { willReadFrequently: true });
    const k = Math.min(CAM_W / img.width, CAM_H / img.height) * 0.96;
    const w = img.width * k, h = img.height * k;
    g.drawImage(img, (CAM_W - w) / 2, (CAM_H - h) / 2, w, h);
    imgPx = g.getImageData(0, 0, CAM_W, CAM_H).data;
    imgHasAlpha = false;                       // does it have any transparent pixels (a cut-out)?
    for (let i = 3; i < imgPx.length; i += 4) {
      if (imgPx[i] < 250) { imgHasAlpha = true; break; }
    }
    imgMode = 1;
    imgVersion++;
    imgMode = 1; refreshTop();
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => setLabel(imageBtn, 'image', 'unreadable');
  img.src = URL.createObjectURL(file.file);
}

// is this point inside the image's shape? (transparent PNG: opaque pixels; JPG: bright pixels)
function insideShape(o) {
  if (!imgPx || imgMode < 2) return 1;
  if (imgHasAlpha) return imgPx[o + 3] > 40 ? 1 : 0;
  return (0.299 * imgPx[o] + 0.587 * imgPx[o + 1] + 0.114 * imgPx[o + 2]) > 60 ? 1 : 0;
}

// ---------- uploaded 3D model (.obj) ----------
// read vertices and edges, then centre it and scale it to fit (y flipped so it stands upright)
// reads the file in slices, so a big model shows its progress and the page never freezes
async function parseOBJ(objText, onProgress) {
  const vs = [], edgeSet = new Set(), triList = [];
  const addEdge = (a, b) => { if (a !== b) edgeSet.add(a < b ? a * 16777216 + b : b * 16777216 + a); };
  const lines = objText.split('\n');
  const SLICE = 60000;
  for (let from = 0; from < lines.length; from += SLICE) {
    const to = Math.min(lines.length, from + SLICE);
    for (let li = from; li < to; li++) {
      const ln = lines[li].trim();
      if (ln.startsWith('v ')) {
        const t = ln.split(/\s+/);
        vs.push(+t[1], +t[2], +t[3]);
      } else if (ln.startsWith('f ') || ln.startsWith('l ')) {
        const nv = vs.length / 3;
        const idx = ln.split(/\s+/).slice(1).map((t) => {
          const k = parseInt(t.split('/')[0], 10);
          return k < 0 ? nv + k : k - 1;
        });
        const closed = ln[0] === 'f';
        if (closed) {                                    // faces as triangles
          for (let k = 1; k < idx.length - 1; k++) { triList.push(idx[0], idx[k], idx[k + 1]); }
        }
        for (let i = 0; i < idx.length - (closed ? 0 : 1); i++) { addEdge(idx[i], idx[(i + 1) % idx.length]); }
      }
    }
    if (onProgress) onProgress(to / lines.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  const n = vs.length / 3;
  if (n < 3) return null;
  let mn = [Infinity, Infinity, Infinity], mxv = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], vs[3 * i + k]); mxv[k] = Math.max(mxv[k], vs[3 * i + k]); }
  }
  const half = Math.max(mxv[0] - mn[0], mxv[1] - mn[1], mxv[2] - mn[2]) / 2 || 1;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[3 * i] = ((vs[3 * i] - (mn[0] + mxv[0]) / 2) / half) * 0.95;
    pos[3 * i + 1] = -((vs[3 * i + 1] - (mn[1] + mxv[1]) / 2) / half) * 0.95;
    pos[3 * i + 2] = ((vs[3 * i + 2] - (mn[2] + mxv[2]) / 2) / half) * 0.95;
  }
  const edges = [];
  for (const k of edgeSet) {
    const a = Math.floor(k / 16777216), b = k - a * 16777216;
    if (a < n && b < n) edges.push(a, b);
  }
  const tris = [];
  for (let t = 0; t < triList.length; t += 3) {
    if (triList[t] < n && triList[t + 1] < n && triList[t + 2] < n && triList[t] >= 0 && triList[t + 1] >= 0 && triList[t + 2] >= 0) tris.push(triList[t], triList[t + 1], triList[t + 2]);
  }
  return { pos, edges: Int32Array.from(edges), n, tris: Int32Array.from(tris) };
}

function handleModel(file) {
  const name = (file.name || (file.file && file.file.name) || '').toLowerCase();
  if (name && !name.endsWith('.obj')) { setLabel(formBtn, 'form', 'needs .obj'); return; }
  if (file.file && file.file.size > 250e6) { setLabel(formBtn, 'form', 'over 250 MB'); return; }
  setLabel(formBtn, 'form', 'reading…');
  file.file.text().then((txt) => parseOBJ(txt, (f) => setLabel(formBtn, 'form', 'reading ' + Math.round(f * 100) + '%'))).then((mdl) => {
    if (!mdl) { setLabel(formBtn, 'form', 'not an .obj'); return; }
    setLabel(formBtn, 'form', 'building…');
    return new Promise((r) => setTimeout(r, 0)).then(() => {
      modelFull = mdl;
      modelTarget = -1;
      modelVersion++;
      formMode = 4;
      refreshTop();
    });
  }).catch((e) => {
    console.error('model error:', e);
    setLabel(formBtn, 'form', 'model failed');
  });
}

// how many points the model gets follows the density slider
function modelCount(cols) {
  const target = Math.min(MAXC * MAXR, Math.round(cols * cols * 0.75));
  if (target !== modelTarget) { buildModel(target); modelTarget = target; }
  return modelN;
}

// thin the model out by merging vertices that share a small 3D cell
function buildModel(target) {
  const { pos, edges, n, tris } = modelFull;
  if (n <= target) { modelPts = pos; modelEdges = edges; modelN = n; modelTris = tris; modelDir = edgeDirs(pos, edges); return; }
  let c = 2 / Math.sqrt(target), cell, cnt = 0;
  for (let it = 0; it < 14; it++) {
    const cells = new Map();
    cell = new Int32Array(n);
    cnt = 0;
    for (let i = 0; i < n; i++) {
      const cellKey = ((Math.floor((pos[3 * i] + 2) / c) * 4096) + Math.floor((pos[3 * i + 1] + 2) / c)) * 4096 + Math.floor((pos[3 * i + 2] + 2) / c);
      let id = cells.get(cellKey);
      if (id === undefined) { id = cnt++; cells.set(cellKey, id); }
      cell[i] = id;
    }
    const ratio = cnt / target;
    if (cnt <= MAXC * MAXR && ratio > 0.85 && ratio < 1.1) break;
    c = Math.max(c * Math.sqrt(ratio), 0.002);
  }
  const sum = new Float32Array(cnt * 3), num = new Int32Array(cnt);
  for (let i = 0; i < n; i++) {
    const id = cell[i];
    sum[3 * id] += pos[3 * i]; sum[3 * id + 1] += pos[3 * i + 1]; sum[3 * id + 2] += pos[3 * i + 2];
    num[id]++;
  }
  for (let id = 0; id < cnt; id++) {
    for (let k = 0; k < 3; k++) { sum[3 * id + k] /= num[id]; }
  }
  const seen = new Set(), out = [];
  for (let e = 0; e < edges.length; e += 2) {
    const a = cell[edges[e]], b = cell[edges[e + 1]];
    if (a === b) continue;
    const k = a < b ? a * 8192 + b : b * 8192 + a;
    if (!seen.has(k)) { seen.add(k); out.push(a, b); }
  }
  modelPts = sum;
  modelEdges = Int32Array.from(out);
  modelN = Math.min(cnt, MAXC * MAXR);
  modelDir = edgeDirs(sum, modelEdges);
  const seenT = new Set(), tout = [];
  for (let t = 0; t < tris.length; t += 3) {
    const a = cell[tris[t]], b = cell[tris[t + 1]], c = cell[tris[t + 2]];
    if (a === b || b === c || a === c || a >= modelN || b >= modelN || c >= modelN) continue;
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mi = a + b + c - lo - hi;
    const k = (lo * 8192 + mi) * 8192 + hi;
    if (!seenT.has(k)) { seenT.add(k); tout.push(a, b, c); }
  }
  modelTris = Int32Array.from(tout);
}

// is each model edge more sideways (0) or more up-and-down (1)? (for the rows and columns styles)
function edgeDirs(pts, edges) {
  const d = new Uint8Array(edges.length / 2);
  for (let e = 0; e < edges.length; e += 2) {
    const a = edges[e], b = edges[e + 1];
    const dy = Math.abs(pts[3 * a + 1] - pts[3 * b + 1]);
    const dx = pts[3 * a] - pts[3 * b], dz = pts[3 * a + 2] - pts[3 * b + 2];
    d[e / 2] = Math.sqrt(dx * dx + dz * dz) >= dy ? 0 : 1;
  }
  return d;
}

// positions that only change with the form, density or model (not every frame)
function buildPositions(COLS, ROWS, n) {
  if (formMode === 4) {            // an uploaded 3D model, painted by the camera from the front
    for (let id = 0; id < n; id++) {
      const mx = modelPts[3 * id], my = modelPts[3 * id + 1], mz = modelPts[3 * id + 2];
      bsu[id] = 1 - (0.5 + mx * 0.42);   // mirrored, like a mirror
      bsv[id] = 0.5 + my * 0.5;
      spx[id] = mx; spy[id] = my; spz[id] = mz;
      dst[id] = Math.sqrt(mx * mx + my * my) * 1.4;
    }
    return;
  }
  for (let j = 0; j < ROWS; j++) {
    const v = j / (ROWS - 1);
    for (let i = 0; i < COLS; i++) {
      const id = j * COLS + i, u = i / (COLS - 1);
      bsu[id] = 1 - u;
      bsv[id] = v;
      bx[id] = (u - 0.5) * 2.66;
      by[id] = (v - 0.5) * 2.0;
      dst[id] = Math.sqrt(((u - 0.5) * 1.33) ** 2 + (v - 0.5) ** 2) * 2;
      if (formMode > 0) { // wrap the image around a closed form (one full turn of longitude)
        const th = (i / COLS) * TWO_PI - PI, ph = (0.5 - v) * PI;
        const dx = cos(ph) * sin(th), dy = -sin(ph), dz = cos(ph) * cos(th); // sphere direction
        let sc = 1;                                                         // push it out to the form's surface
        if (formMode === 2) sc = 0.8 / max(abs(dx), abs(dy), abs(dz));      // cube
        else if (formMode === 3) sc = pyramidT(dx, dy, dz);                 // pyramid
        spx[id] = dx * sc; spy[id] = dy * sc; spz[id] = dz * sc;
      }
    }
  }
}

// where each point reads the camera / image; only redone when the kaleidoscope or image changes
function buildSources(n) {
  const seg = TWO_PI / KN[kIdx];
  for (let id = 0; id < n; id++) {
    let su = bsu[id], sv = bsv[id];
    if (fxOn.kaleido) {                                  // fold the picture into mirrored slices
      const cx = su - 0.5, cy = sv - 0.5, rad = Math.sqrt(cx * cx + cy * cy) * 0.75;
      let a = Math.atan2(cy, cx) + kRot;
      a = Math.abs((((a % seg) + seg) % seg) - seg / 2);
      su = 0.5 + rad * Math.cos(a);
      sv = 0.5 + rad * Math.sin(a);
    }
    const sx = constrain(round(su * (CAM_W - 1)), 0, CAM_W - 1);
    const sy = constrain(round(sv * (CAM_H - 1)), 0, CAM_H - 1);
    src[id] = 4 * (sy * CAM_W + (camFacing === 'user' ? sx : CAM_W - 1 - sx)); // front camera mirrored, back camera true view
    srcI[id] = 4 * (sy * CAM_W + constrain(round((1 - su) * (CAM_W - 1)), 0, CAM_W - 1)); // image is not mirrored
    vis[id] = insideShape(srcI[id]);
  }
}

// echo: keep a few recent camera frames; plane l shows the frame l steps back
function pushHistory(px) {
  if (frameCount % (1 + Math.round(fxAmt.echo * 9)) !== 0) return; // amount = how far apart the saved frames are
  histHead = (histHead + 1) % ECHO_K;
  if (!hist[histHead] || hist[histHead].length !== px.length) hist[histHead] = new Uint8ClampedArray(px.length);
  hist[histHead].set(px);
}

function frameFor(l, px) {
  if (!fxOn.echo || l === 0 || histHead < 0) return px;
  return hist[(histHead - (l - 1) + ECHO_K * 2) % ECHO_K] || px;
}

// ---------- video recording: the canvas + the music (or mic) sound ----------
function pickMime() {
  const types = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// tap once to record, tap again to stop, then tap "save video" to download
function toggleRecord() {
  if (recState === 'recording') { rec.stop(); return; }
  if (recState === 'ready') { saveRecording(); return; }
  if (!window.MediaRecorder) { setLabel(recBtn, 'rec', 'n/a'); return; }
  setupAudio();
  actx.resume();
  const stream = document.querySelector('canvas').captureStream(30);
  recDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  recMime = pickMime();
  recChunks = [];
  const opts = recMime ? { mimeType: recMime, videoBitsPerSecond: 6000000 } : { videoBitsPerSecond: 6000000 };
  rec = new MediaRecorder(stream, opts);
  rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  rec.onstop = () => {
    stream.getVideoTracks().forEach((t) => t.stop());
    recBlob = new Blob(recChunks, { type: rec.mimeType || recMime || 'video/webm' });
    rec = null;
    recState = 'ready';
    setLabel(recBtn, 'rec', 'save');
    setOn(recBtn, false);
  };
  rec.start(1000);
  recStart = millis();
  recState = 'recording';
  recLast = '';
  setOn(recBtn, true);
}

function saveRecording() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(recBlob);
  a.download = 'polychoron-' + Date.now() + (recBlob.type.includes('mp4') ? '.mp4' : '.webm');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  recState = 'idle';
  setLabel(recBtn, 'rec', 'start');
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

// ---------- sound rack: four soft effects on the music file ----------
// filter = DJ filter (low-pass one way, high-pass the other), echo = tempo-synced delay with darker repeats,
// reverb = small airy room, chorus = gentle stereo shimmer. Each is blended in (the music stays at full level),
// fades in and out, and at most two sound at once. They can follow a visual effect (link): pull -> filter,
// echo -> echo, trails -> reverb, ripple -> chorus.
const AX = ['filter', 'echo', 'reverb', 'chorus'];
const axOn = { filter: false, echo: false, reverb: false, chorus: false };
const axAmt = { filter: 0.5, echo: 0.5, reverb: 0.5, chorus: 0.5 };   // filter: -1 (low-pass) .. +1 (high-pass); others 0..1
const AX_LINK = { filter: 'pull', echo: 'echo', reverb: 'trails', chorus: 'ripple' };
const AX_LABEL = { filter: 'filter', echo: 'echo', reverb: 'reverb', chorus: 'chorus' };
const axSince = {}, axAct = {}, axWait = {};
let linkOn = true, bpm = 120, bpmSet = false, tapTimes = [], dj = null, axTick = 0;

function makeImpulse(sec, decay) {            // a made-up room for the reverb: soft, darkening noise
  const len = Math.floor(actx.sampleRate * sec), buf = actx.createBuffer(2, len, actx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lpf = 0;
    for (let i = 0; i < len; i++) {
      const k = 0.62 - 0.45 * (i / len);       // the tail gets darker as it fades
      lpf += (Math.random() * 2 - 1 - lpf) * k;
      d[i] = lpf * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function buildAudioFx(srcNode) {
  const gn = (v) => { const n = actx.createGain(); n.gain.value = v; return n; };
  const bq = (type, f, q) => {
    const n = actx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q === undefined ? 0.707 : q;
    return n;
  };
  const bus = gn(1), dry = gn(1);
  srcNode.connect(dry); dry.connect(bus);                                 // the music itself (dips a little under a big reverb or chorus)

  const dly = actx.createDelay(2), fbLp = bq('lowpass', 2800), fbHp = bq('highpass', 160), fb = gn(0), eWet = gn(0);
  dly.delayTime.value = 0.375;                                            // echo: repeats get darker, like dub
  srcNode.connect(dly); dly.connect(fbLp); fbLp.connect(fbHp); fbHp.connect(fb); fb.connect(dly);
  fbHp.connect(eWet); eWet.connect(bus);

  const pre = actx.createDelay(0.2), rHp = bq('highpass', 220), conv = actx.createConvolver(), rLp = bq('lowpass', 7000), rWet = gn(0);
  pre.delayTime.value = 0.02;                                             // reverb: small, airy, no mud
  conv.buffer = makeImpulse(1.9, 2.6);
  srcNode.connect(pre); pre.connect(rHp); rHp.connect(conv); conv.connect(rLp); rLp.connect(rWet); rWet.connect(bus);

  const cWet = gn(0);                                                     // chorus: two slowly moving delays, spread left and right
  const voice = (base, rate, depth, pan) => {
    const d = actx.createDelay(0.1);
    d.delayTime.value = base;
    const lfo = actx.createOscillator(), lg = gn(depth);
    lfo.frequency.value = rate;
    lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
    srcNode.connect(d);
    if (actx.createStereoPanner) {
      const pn = actx.createStereoPanner();
      pn.pan.value = pan;
      d.connect(pn); pn.connect(cWet);
    } else {
      d.connect(cWet);
    }
  };
  voice(0.020, 0.55, 0.0060, -0.6);                                       // deeper, faster wobble so it is heard on a phone speaker too
  voice(0.031, 0.83, 0.0075, 0.6);
  cWet.connect(bus);

  const hp = bq('highpass', 20), lp = bq('lowpass', 20000);               // the DJ filter sits on everything
  const comp = actx.createDynamicsCompressor(), out = gn(1);
  comp.threshold.value = -6; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25; // only catches peaks
  out.gain.value = 0.9;
  bus.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(out);
  out.connect(analyser);      // the visuals hear the processed sound
  out.connect(actx.destination);
  out.connect(recDest);
  dj = { dly, fb, eWet, rWet, cWet, hp, lp, comp, bus, dry };
}

// is this sound effect asked for (by its own button, or by the visual effect it follows)?
function axWanted(n) {
  if (axOn[n]) return true;
  if (linkOn && fxOn[AX_LINK[n]]) return n === 'filter' ? pull.active : true; // the filter follows pull only while a finger is down
  return false;
}

function tapTempo() {
  const now = performance.now();
  if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes = [];
  tapTimes.push(now);
  if (tapTimes.length > 6) tapTimes.shift();
  if (tapTimes.length >= 2) {
    let sum = 0;
    for (let i = 1; i < tapTimes.length; i++) { sum += tapTimes[i] - tapTimes[i - 1]; }
    bpm = constrain(round(60000 / (sum / (tapTimes.length - 1))), 50, 220);
    bpmSet = true;
  }
  bcTap(now);
  setLabel2();
  if (bpmSlider) bpmSlider.value(bpm);
}

function updateAudioFx() {
  const now = millis();
  // which of the wanted effects get to sound: the two newest
  const want = [];
  for (const n of AX) {
    if (axWanted(n)) {
      if (axSince[n] === undefined) axSince[n] = now;
      want.push(n);
    } else {
      delete axSince[n];
    }
  }
  want.sort((a, b) => axSince[b] - axSince[a]);
  for (const n of AX) { axAct[n] = false; axWait[n] = false; }
  for (let i = 0; i < want.length; i++) {
    if (i < 2) axAct[want[i]] = true; else axWait[want[i]] = true;
  }
  if (++axTick % 4 === 0) fxRefresh();
  if (!dj || !actx) return;

  const t = actx.currentTime, tc = 0.15;
  const setP = (param, v) => {                  // only schedule a change when the target really moves (keeps the audio thread light)
    v = Number.isFinite(v) ? v : 0;
    const last = param.__t;
    if (last !== undefined && Math.abs(v - last) <= Math.abs(last) * 0.002 + 1e-5) return;
    param.__t = v;
    param.setTargetAtTime(v, t, tc);
  };

  // filter: the knob, or your finger when pull is linked (high on the screen = high-pass, low = low-pass)
  let fv = 0;
  if (axAct.filter) {
    fv = (linkOn && fxOn.pull && pull.active && Number.isFinite(pull.y)) ? constrain((0.5 - pull.y / height) * 2.4, -1, 1) : axAmt.filter;
    if (Math.abs(fv) < 0.06) fv = 0;
  }
  setP(dj.lp.frequency, fv < 0 ? 20000 * Math.pow(0.011, -fv) : 20000);   // down to about 220 Hz
  setP(dj.hp.frequency, fv > 0 ? 20 * Math.pow(150, fv) : 20);            // up to about 3 kHz
  setP(dj.lp.Q, 0.707 + 0.5 * Math.abs(fv));                              // barely any resonance: no whistling
  setP(dj.hp.Q, 0.707 + 0.5 * Math.abs(fv));

  if (bcActive() && BC.bpm && Math.abs(BC.bpm - bpm) > 0.4) { bpm = Math.round(BC.bpm * 10) / 10; bpmSet = true; if (bpmSlider) bpmSlider.value(bpm); }   // the clock sets the echo time
  const beatSec = constrain(60 / bpm * 0.75, 0.05, 1.9);                 // dotted eighth note
  if (dj.dly.__t !== beatSec) { dj.dly.__t = beatSec; dj.dly.delayTime.setTargetAtTime(beatSec, t, 0.08); }
  setP(dj.eWet.gain, axAct.echo ? 0.8 * axAmt.echo : 0);
  setP(dj.fb.gain, (axAct.echo && millis() > flushUntil) ? 0.2 + 0.3 * axAmt.echo : 0);     // never above 0.5; off while the echo runs dry
  const rv = axAct.reverb ? axAmt.reverb : 0, ch = axAct.chorus ? axAmt.chorus : 0;
  setP(dj.rWet.gain, 2.2 * rv);
  setP(dj.cWet.gain, 1.0 * ch);
  setP(dj.dry.gain, 1 - 0.3 * Math.max(rv, ch));                           // a big reverb or chorus takes a little of the dry sound's place
}

// strobe: flashes the inversion. With sound it flashes on every beat; without sound (or in a quiet part) it runs on a timer
function updateStrobe() {
  if (!fxOn.strobe) { strobeFlip = false; return; }
  const now = millis();
  // photosensitivity: a flash (on, then off) never repeats faster than about 3 times a second
  const MIN_ON = 340;
  if (soundActive() && pulse > 0.9) lastBeat = now;
  if (soundActive() && now - lastBeat < 1500) {
    const want = pulse > 0.45;
    if (want && !strobeFlip) {
      if (now - strobeLast >= MIN_ON) { strobeFlip = true; strobeLast = now; }
    } else if (!want && strobeFlip) {
      strobeFlip = false;
    }
  } else {
    const half = bpmSet ? max(170, 30000 / bpm) : lerp(520, 170, fxAmt.strobe);   // follows the tapped tempo when there is one
    if (now - strobeLast > half) {
      strobeFlip = !strobeFlip;
      strobeLast = now;
    }
  }
}

function soundActive() {
  return micOn || (audioEl && !audioEl.paused);
}

// explode and twist bend the points before they are projected
function projectFx(o, x, y, z, w) {
  if (exAmt > 0) {                        // explode: points burst outward and scatter in 4D
    const sc = 1 + exAmt * (0.4 + rnd2[o]);
    x *= sc; y *= sc; z *= sc;
    w += exAmt * (rnd[o] - 0.5) * 2;
  }
  if (twAmt !== 0) {                      // twist: the form wrings around its vertical axis
    const a = twAmt * y, c = Math.cos(a), sn = Math.sin(a);
    const nx = x * c + z * sn;
    z = -x * sn + z * c;
    x = nx;
  }
  projectInto(o, x, y, z, w);
}

function setOn(btn, on) {
  btn.elt.classList.toggle('on', !!on);
}

// distance from the centre to the surface of a square pyramid (apex up) along a direction
function pyramidT(dx, dy, dz) {
  const yb = 0.6, ya = -0.95, b = 0.9, k = 1 / (yb - ya); // base height, apex height, base half-width
  const m = Math.max(Math.abs(dx), Math.abs(dz));
  let t = Infinity;
  const den = m / b - dy * k;
  if (den > 1e-6) t = (-ya * k) / den;          // the ray leaves through a side face
  if (dy > 1e-6) t = Math.min(t, yb / dy);      // ...or through the base
  return t;
}

// 4D rotation -> 4D perspective -> 3D orbit -> 3D perspective, written into PX/PY
function projectInto(o, x, y, z, w) {
  let t = cax * x - sax * w; w = sax * x + cax * w; x = t;
  t = caz * z - saz * w; w = saz * z + caz * w; z = t;
  t = cay * y - say * w; w = say * y + cay * w; y = t;

  const k = D / (D - w);
  x *= k; y *= k; z *= k;

  const x2 = cvy * x + svy * z, z2 = -svy * x + cvy * z;
  const y3 = cvx * y - svx * z2, z3 = svx * y + cvx * z2;

  const xr = x2 * cro - y3 * sro, yr = x2 * sro + y3 * cro; // roll around the line of sight
  const f = 9 / (9 - z3);
  PX[o] = width / 2 + panX + xr * f * S * zoom;
  PY[o] = height / 2 + panY + yr * f * S * zoom;
}

// Colours are quantised so thousands of lines / circles draw in a few batches.
// The batches are kept from frame to frame (typed arrays, no garbage), and drawn in small chunks,
// which the browser fills and strokes much faster than one huge path.
const LS = { m: new Map(), a: [], stride: 4 }, QS = { m: new Map(), a: [], stride: 8 }, CS = { m: new Map(), a: [], stride: 2 };
let frameNo = 0;
let LINE_CHUNK = 512, QUAD_CHUNK = 64, SHAPE_CHUNK = 128;   // path sizes the browser draws fastest
function bucketFor(store, bkey, qr, qg, qb, qa) {
  let bk = store.m.get(bkey);
  if (!bk) {
    bk = { css: `rgba(${qr * 32 + 16},${qg * 32 + 16},${qb * 32 + 16},${(qa * 64 + 32) / 255})`, d: new Float32Array(store.stride * 128), n: 0, f: -1, sl: 0, kind: 0 };
    store.m.set(bkey, bk);
  }
  if (bk.f !== frameNo) { bk.f = frameNo; bk.n = 0; store.a.push(bk); }
  if (bk.n + store.stride > bk.d.length) {
    const nd = new Float32Array(bk.d.length * 2);
    nd.set(bk.d);
    bk.d = nd;
  }
  return bk;
}
function resetBuckets() {
  frameNo++;
  LS.a.length = 0; QS.a.length = 0; CS.a.length = 0;
}

function addLine(store, r, g, b, a, x1, y1, x2, y2) {
  if (a < 8) return;
  const mg = 40; // off screen on the same side: not worth drawing
  if ((x1 < -mg && x2 < -mg) || (x1 > width + mg && x2 > width + mg) || (y1 < -mg && y2 < -mg) || (y1 > height + mg && y2 > height + mg)) return;
  if (x1 !== x1 || y1 !== y1 || x2 !== x2 || y2 !== y2) return;     // NaN guard
  const qr = r >> 5, qg = g >> 5, qb = b >> 5, qa = a >= 192 ? 3 : a >> 6;
  const bk = bucketFor(store, ((qr * 8 + qg) * 8 + qb) * 4 + qa, qr, qg, qb, qa);
  const d = bk.d, n = bk.n;
  d[n] = x1; d[n + 1] = y1; d[n + 2] = x2; d[n + 3] = y2;
  bk.n = n + 4;
}

function addQuad(store, r, g, b, a, x1, y1, x2, y2, x3, y3, x4, y4) {
  if (a < 8) return;
  const mg = 40;
  const mnx = Math.min(x1, x2, x3, x4), mxx = Math.max(x1, x2, x3, x4), mny = Math.min(y1, y2, y3, y4), mxy = Math.max(y1, y2, y3, y4);
  if (mxx < -mg || mnx > width + mg || mxy < -mg || mny > height + mg || mnx !== mnx || mny !== mny) return;
  const qr = r >> 5, qg = g >> 5, qb = b >> 5, qa = a >= 192 ? 3 : a >> 6;
  const bk = bucketFor(store, ((qr * 8 + qg) * 8 + qb) * 4 + qa, qr, qg, qb, qa);
  const d = bk.d, n = bk.n;
  d[n] = x1; d[n + 1] = y1; d[n + 2] = x2; d[n + 3] = y2; d[n + 4] = x3; d[n + 5] = y3; d[n + 6] = x4; d[n + 7] = y4;
  bk.n = n + 8;
}

function addCircle(store, r, g, b, a, sizeLevel, kind, x, y) {
  if (a < 8) return;
  if (x < -40 || x > width + 40 || y < -40 || y > height + 40 || x !== x || y !== y) return; // off screen
  const qr = r >> 5, qg = g >> 5, qb = b >> 5, qa = a >= 192 ? 3 : a >> 6;
  const bk = bucketFor(store, ((((qr * 8 + qg) * 8 + qb) * 4 + qa) * 8 + sizeLevel) * 3 + kind, qr, qg, qb, qa);
  bk.sl = sizeLevel; bk.kind = kind;
  bk.d[bk.n] = x; bk.d[bk.n + 1] = y;
  bk.n += 2;
}

let lastErr = '';

function draw() {
  try {
    drawFrame();
  } catch (e) {                          // keep the sketch alive, and say what went wrong (once)
    if (e && e.message !== lastErr) { lastErr = e.message; console.error('sketch error:', e); }
  }
}

let wasSound = false, flushUntil = 0, camSeen = 0;
// a soft moving pattern used when there is no camera picture
const fbPx = new Uint8ClampedArray(CAM_W * CAM_H * 4);
function fallbackPixels() {
  if (frameCount % 3 !== 0 && fbPx[3] === 255) return fbPx;
  const t = millis() * 0.0006;
  for (let y = 0; y < CAM_H; y++) {
    for (let x = 0; x < CAM_W; x++) {
      const i = (y * CAM_W + x) * 4, u = x / CAM_W - 0.5, v = y / CAM_H - 0.5;
      const d = Math.sqrt(u * u + v * v);
      const w = 0.5 + 0.5 * Math.sin(d * 14 - t * 3) * Math.cos(u * 6 + t), z = 0.5 + 0.5 * Math.sin(v * 8 - t * 2);
      fbPx[i] = 40 + 200 * w * (1 - d); fbPx[i + 1] = 30 + 160 * z * w; fbPx[i + 2] = 90 + 150 * (1 - w); fbPx[i + 3] = 255;
    }
  }
  return fbPx;
}

// when the music stops: let the echo run dry, and let the sound-driven sliders settle back to rest
function onSoundStopped() {
  flushUntil = millis() + 2200;
  pulse = 0;
  if (tween) return;                       // a look is already gliding in: let it finish
  const rest = { depth: 3, relief: 0.8, planes: 3, circle: 0, variety: 1, saturation: 1 };
  const from = {}, to = {};
  for (const id in rest) {
    if (SL[id] && !locked[id]) { from[id] = SL[id].sl.value(); to[id] = rest[id]; }
  }
  const cur = { zoom, panX, panY, roll, rx, ry };
  tween = { t0: millis(), dur: 1100, from, to, vf: cur, vt: Object.assign({}, cur) };
}

function drawFrame() {
  const nowSound = soundActive();
  if (wasSound && !nowSound) onSoundStopped();
  wasSound = nowSound;
  updateTween();
  applySound();
  if (frameCount % 2 === 0) updateAudioFx();
  updateReadouts();
  updateStrobe();
  inv = strobeFlip ? 1 - (fxOn.invert ? fxAmt.invert : 0) : (fxOn.invert ? fxAmt.invert : 0); // 0 = normal, 1 = fully inverted
  const bgR = round(lerp(12, 243, inv)), bgG = round(lerp(13, 242, inv)), bgB = round(lerp(18, 237, inv));
  if (fxOn.trails) {                       // trails: fade the old picture instead of clearing it
    const len = soundActive() ? fxAmt.trails * (0.4 + 0.6 * sLevel) : fxAmt.trails;
    drawingContext.globalAlpha = lerp(0.5, 0.06, constrain(len, 0, 1));
    drawingContext.fillStyle = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
    drawingContext.fillRect(0, 0, width, height);
    drawingContext.globalAlpha = 1;
  } else {
    background(bgR, bgG, bgB);
  }

  let camPx = null;
  try {
    cam.loadPixels();
    if (cam.pixels && cam.pixels.length >= CAM_W * CAM_H * 4) camPx = cam.pixels;
  } catch (e) { camPx = null; }
  if (camPx) camSeen = millis();
  const noCam = !camPx;
  if (noCam) camPx = fallbackPixels();            // no camera (yet, or blocked): a moving pattern keeps the show going

  const h = depthSlider.value() / 2;
  const relief = reliefSlider.value();
  updateQuality();
  const L = arrMode === 1 ? 1 : max(2, round(planesSlider.value() * (0.5 + 0.5 * (Q - 0.4) / 0.6)));
  const COLS = max(16, round(densitySlider.value() * Q));
  const ROWS = round(COLS * 0.75);
  const m = !showShapes ? 0 : (!showLines ? 1 : circleSlider.value()); // 0 = lines, 1 = shapes (the lines / shapes buttons can force either)
  const variety = varietySlider.value(), shapeMix = shapeSlider.value();
  const sat = saturationSlider.value();
  const fillAmt = fillMode === 0 ? 1 : (fillMode === 1 ? 0 : ((micOn || (audioEl && !audioEl.paused)) ? fillState : 1)); // 0 = outline, 1 = solid; auto = flips with the music
  const n = (formMode === 4 && modelFull) ? modelCount(COLS) : COLS * ROWS;
  D = 5 + h * 1.5; // keep far planes in front of the 4D camera
  if (!orbiting && (Math.abs(vRx) > 0.0002 || Math.abs(vRy) > 0.0002)) { // glide after letting go
    rx += vRx; ry += vRy;
    vRx *= 0.92; vRy *= 0.92;
  }
  cvx = cos(rx); svx = sin(rx); cvy = cos(ry); svy = sin(ry);
  cro = Math.cos(roll); sro = Math.sin(roll);
  const snd = soundActive();
  if (!snd) {                                        // no music: the effects still move, gently
    const k60 = Math.min(3, deltaTime / 16.7);
    if (fxOn.kaleido) kRot += 0.004 * (0.2 + 1.6 * fxAmt.kaleido) * k60;
    if (fxOn.hue) hueRot += 0.006 * (0.2 + 1.8 * fxAmt.hue) * k60;
    if (fxOn.ripple) { rippleT += 0.06 * k60; rippleAmp = 0.15; }
  }
  exAmt = fxOn.explode ? fxAmt.explode * (snd ? exDrive : 0.5) : 0;
  twAmt = fxOn.twist ? fxAmt.twist * 2.5 * (snd ? twDrive : 1) : 0;
  rippleScale = 0.3 + 1.4 * fxAmt.ripple;

  // 1. geometry (cached: rebuilt only when form, density or model change) and camera lookups
  const px = camPx;
  if (fxOn.echo) pushHistory(px);
  const gKey = formMode + '|' + COLS + '|' + modelVersion + '|' + modelTarget;
  if (gKey !== geoKey) { buildPositions(COLS, ROWS, n); geoKey = gKey; srcKey = ''; }
  const sKey = (fxOn.kaleido ? 'k' + kIdx + ':' + kRot.toFixed(3) : 'p') + '|' + imgMode + '|' + imgVersion + '|' + camFacing;
  if (sKey !== srcKey) { buildSources(n); srcKey = sKey; }

  // 2. colour, brightness and relief for every plane (with echo, each plane shows an older frame)
  for (let l = 0; l < L; l++) {
    const fromImg = imgPx && (imgMode === 1 || imgMode === 2); // the image replaces the camera's colours
    const off = l * n, buf = fromImg ? imgPx : frameFor(l, px);
    const ang = fxOn.hue ? hueRot + l * 0.5 : 0, ca = Math.cos(ang), sa = Math.sin(ang); // hue rotation
    const m00 = 0.213 + ca * 0.787 - sa * 0.213, m01 = 0.715 - ca * 0.715 - sa * 0.715, m02 = 0.072 - ca * 0.072 + sa * 0.928;
    const m10 = 0.213 - ca * 0.213 + sa * 0.143, m11 = 0.715 + ca * 0.285 + sa * 0.140, m12 = 0.072 - ca * 0.072 - sa * 0.283;
    const m20 = 0.213 - ca * 0.213 - sa * 0.787, m21 = 0.715 - ca * 0.715 + sa * 0.715, m22 = 0.072 + ca * 0.928 + sa * 0.072;
    let dR = 0, dG = 0, dB = 0;
    if (palMode === 4) { [dR, dG, dB] = hsv2rgb((((l / Math.max(1, L - 1)) * 0.8 + (fxOn.hue ? hueRot * 0.1 : 0)) % 1 + 1) % 1, 0.8, 1); }
    for (let id = 0; id < n; id++) {
      const o = fromImg ? srcI[id] : src[id];
      const r = buf[o], g = buf[o + 1], b = buf[o + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const bright = gray / 255;
      let rr = gray + (r - gray) * sat, gg = gray + (g - gray) * sat, bb = gray + (b - gray) * sat; // saturation
      if (fxOn.hue) {
        const r3 = m00 * rr + m01 * gg + m02 * bb, g3 = m10 * rr + m11 * gg + m12 * bb, b3 = m20 * rr + m21 * gg + m22 * bb;
        rr = r3; gg = g3; bb = b3;
      }
      if (palMode > 0) {                       // colour palettes (hue shifts their colours round)
        if (palMode === 1) { rr = gg = bb = 35 + 220 * bright; }
        else if (palMode === 5) {
          const gy = 0.299 * rr + 0.587 * gg + 0.114 * bb;
          rr = gy + (rr - gy) * 1.8; gg = gy + (gg - gy) * 1.8; bb = gy + (bb - gy) * 1.8;
          const kk = 255 * (0.35 + 0.65 * bright) / Math.max(rr, gg, bb, 1);
          rr = Math.max(0, rr * kk); gg = Math.max(0, gg * kk); bb = Math.max(0, bb * kk);
        } else if (palMode === 4) {
          const kk = 0.2 + 0.8 * bright;
          rr = dR * kk; gg = dG * kk; bb = dB * kk;
        } else {
          const tt = fxOn.hue ? ((bright + hueRot * 0.15) % 1 + 1) % 1 : bright, li = (tt * 255) | 0, lut = palLut[palMode];
          rr = lut[li * 3]; gg = lut[li * 3 + 1]; bb = lut[li * 3 + 2];
        }
      }
      rr = rr < 0 ? 0 : (rr > 255 ? 255 : rr); gg = gg < 0 ? 0 : (gg > 255 ? 255 : gg); bb = bb < 0 ? 0 : (bb > 255 ? 255 : bb);
      if (inv > 0.001) {                       // invert: shapes and lines flip (the background flips too)
        rr += (255 - 2 * rr) * inv; gg += (255 - 2 * gg) * inv; bb += (255 - 2 * bb) * inv;
      }
      cr[off + id] = rr;
      cg[off + id] = gg;
      cb[off + id] = bb;
      br[off + id] = bright;
      let rel = (bright - 0.5) * relief;
      if (fxOn.ripple) rel += rippleAmp * rippleScale * Math.sin(dst[id] * 9 - rippleT + l * 0.8); // waves across the surface
      bz[off + id] = rel;
      spr[off + id] = rel * 0.5;
    }
  }

  // one projected copy per plane, spread along the 4th axis
  for (let l = 0; l < L; l++) {
    const t = L > 1 ? l / (L - 1) : 0.5, off = l * n;
    if (formMode === 0) {
      const w = lerp(-h, h, t);
      for (let id = 0; id < n; id++) { projectFx(off + id, bx[id], by[id], bz[off + id], w); }
    } else {
      // nested: different sizes, same 4D position; stacked: same size, spread in 4D; both
      const R = 1.0;                                   // same size, spread through the 4th dimension (solo: one copy)
      const w = arrMode === 1 ? 0 : lerp(-h, h, t);
      for (let id = 0; id < n; id++) {
        const rr = R + spr[off + id];
        projectFx(off + id, spx[id] * rr, spy[id] * rr, spz[id] * rr, w);
      }
    }
  }

  // touch pull: points near your finger are drawn toward it (the amount sets how wide the pull is)
  pull.str += (((pull.active && fxOn.pull) ? 0.85 : 0) - pull.str) * 0.25;
  if (pull.str > 0.01) {
    const pr = Math.min(width, height) * lerp(0.12, 0.35, fxAmt.pull), pr2 = pr * pr, tot = L * n;
    for (let q = 0; q < tot; q++) {
      const ddx = pull.x - PX[q], ddy = pull.y - PY[q], d2 = ddx * ddx + ddy * ddy;
      if (d2 < pr2) {
        const f = 1 - Math.sqrt(d2) / pr, g = f * f * pull.str;
        PX[q] += ddx * g;
        PY[q] += ddy * g;
      }
    }
  }

  resetBuckets();
  const lines = LS, circles = CS;
  const lineFade = showLines ? 1 - m : 0;
  const es = COLS > 64 ? 2 : 1;      // at high density draw the grid lines on every second row and column
  const ms = n > 3500 ? 2 : 1;       // ...and every second edge of a model

  const quads = QS;
  if (lineFade > 0.02) {
    const sty = (formMode === 4 && styleMode === 1 && !(modelTris && modelTris.length)) ? 0 : styleMode; // a model without faces falls back to the mesh
    if (sty === 0 || sty === 4) {
    // struts between neighbouring planes (every 4th vertex keeps it readable)
    for (let l = 0; l < L - 1; l++) {
      const o1 = l * n, o2 = (l + 1) * n;
      if (formMode === 4) {
        for (let id = 0; id < n; id += 4) {
          if (vis[id]) addLine(lines, cr[o1 + id], cg[o1 + id], cb[o1 + id], (25 + 90 * br[o1 + id]) * lineFade,
            PX[o1 + id], PY[o1 + id], PX[o2 + id], PY[o2 + id]);
        }
      } else {
    for (let j = 0; j < ROWS; j += 4) {
        for (let i = 0; i < COLS; i += 4) {
          const id = j * COLS + i;
          if (vis[id]) addLine(lines, cr[o1 + id], cg[o1 + id], cb[o1 + id], (25 + 90 * br[o1 + id]) * lineFade,
            PX[o1 + id], PY[o1 + id], PX[o2 + id], PY[o2 + id]);
        }
      }
  }
    }
    // the camera meshes, one per plane
    for (let l = 0; l < L; l++) {
      const off = l * n;
      if (formMode === 4) {
        for (let e = 0; e < modelEdges.length; e += 2 * ms) { meshEdge(lines, off, modelEdges[e], modelEdges[e + 1], lineFade); }
      } else {
    for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const a = j * COLS + i;
          if (i < COLS - 1) {
            if (j % es === 0) meshEdge(lines, off, a, a + 1, lineFade);
          } else if (formMode > 0 && j % es === 0) meshEdge(lines, off, a, a - (COLS - 1), lineFade); // close the sphere seam
          if (j < ROWS - 1 && i % es === 0) meshEdge(lines, off, a, a + COLS, lineFade);
        }
      }
  }
    }
    } else if (sty === 1 && formMode === 4) {
      // faces of the model: its triangles, flat coloured
      const ts = modelTris.length / 3 > 9000 ? 2 : 1;
      for (let l = 0; l < L; l++) {
        const off = l * n;
        for (let t = 0; t < modelTris.length; t += 3 * ts) {
          const a = modelTris[t], b = modelTris[t + 1], c = modelTris[t + 2];
          if (!vis[a] || !vis[b] || !vis[c]) continue;
          const ia = off + a, ib = off + b, ic = off + c;
          addQuad(quads, (cr[ia] + cr[ib] + cr[ic]) / 3, (cg[ia] + cg[ib] + cg[ic]) / 3, (cb[ia] + cb[ib] + cb[ic]) / 3,
            (70 + 150 * (br[ia] + br[ib] + br[ic]) / 3) * lineFade, PX[ia], PY[ia], PX[ib], PY[ib], PX[ic], PY[ic], PX[ic], PY[ic]);
        }
      }
    } else if ((sty === 2 || sty === 3) && formMode === 4) {
      // rows / columns of the model: its sideways or up-and-down edges
      for (let l = 0; l < L; l++) {
        const off = l * n;
        for (let e = 0; e < modelEdges.length; e += 2 * ms) {
          if (modelDir[e / 2] === (sty === 2 ? 0 : 1)) meshEdge(lines, off, modelEdges[e], modelEdges[e + 1], lineFade);
        }
      }
    } else if (sty === 1) {
      // faces: every cell of the mesh as a flat coloured patch (solid or outline, like the shapes)
      const fs = COLS > 64 ? 2 : 1, iEnd = formMode > 0 ? COLS : COLS - fs;
      for (let l = 0; l < L; l++) {
        const off = l * n;
        for (let j = 0; j < ROWS - fs; j += fs) {
          for (let i = 0; i < iEnd; i += fs) {
            const a = j * COLS + i, b = j * COLS + (i + fs) % COLS, c = (j + fs) * COLS + (i + fs) % COLS, d = (j + fs) * COLS + i;
            if (!vis[a] || !vis[b] || !vis[c] || !vis[d]) continue;
            addQuad(quads, cr[off + a], cg[off + a], cb[off + a], (70 + 150 * br[off + a]) * lineFade,
              PX[off + a], PY[off + a], PX[off + b], PY[off + b], PX[off + c], PY[off + c], PX[off + d], PY[off + d]);
          }
        }
      }
    } else if (sty === 2 || sty === 3) {
      // rows (like a ridge plot) or columns only
      for (let l = 0; l < L; l++) {
        const off = l * n;
        for (let j = 0; j < ROWS; j++) {
          for (let i = 0; i < COLS; i++) {
            const a = j * COLS + i;
            if (sty === 2) {
              if (j % es !== 0) continue;
              if (i < COLS - 1) meshEdge(lines, off, a, a + 1, lineFade);
              else if (formMode > 0) meshEdge(lines, off, a, a - (COLS - 1), lineFade);
            } else if (j < ROWS - 1 && i % es === 0) {
              meshEdge(lines, off, a, a + COLS, lineFade);
            }
          }
        }
      }
    } else if (sty === 5) {
      // strokes: a short pen stroke on every point, longer where it is brighter
      const lenScale = sqrt(64 / COLS) * zoom * 0.7;
      for (let l = 0; l < L; l++) {
        const off = l * n;
        for (let id = 0; id < n; id += ms) {
          if (!vis[id]) continue;
          const bb = br[off + id], ang = rnd[off + id] * 3.14159 + bb * 1.2 + (fxOn.ripple ? rippleT * 0.2 : 0), len = (2 + 12 * bb) * lenScale;
          const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
          addLine(lines, cr[off + id], cg[off + id], cb[off + id], (60 + 190 * bb) * lineFade, PX[off + id] - dx, PY[off + id] - dy, PX[off + id] + dx, PY[off + id] + dy);
        }
      }
    }
  }

  if (m > 0.02) {
    for (let l = 0; l < L; l++) {
      const off = l * n;
      for (let id = 0; id < n; id++) {
        if (!vis[id]) continue;
        const t = 0.6 * br[off + id] + 0.4 * rnd[off + id];                  // brightness + a little chance
        const sl = constrain(floor(lerp(0.5, t, variety) * 8), 0, 7); // 8 size steps
        const r2 = rnd2[off + id];                               // circles stay one of three shapes
        const kind = r2 < 1 - shapeMix * 2 / 3 ? 0 : (r2 < 1 - shapeMix / 3 ? 1 : 2); // 0 circle, 1 square, 2 triangle
        addCircle(circles, cr[off + id], cg[off + id], cb[off + id], 255 * m, sl, kind, PX[off + id], PY[off + id]);
      }
    }
  }

  const ctx = drawingContext;
  if (noCam && !(imgPx && (imgMode === 1 || imgMode === 2)) && !hidden) {
    ctx.fillStyle = inv > 0.5 ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.45)';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillText(millis() > 4000 && camSeen === 0 ? 'NO CAMERA · ALLOW IT, OR USE AN IMAGE / MODEL' : 'WAITING FOR CAMERA', 12, height - 12 - dockLift);
  }
  const lw = weightSlider.value() * (snd ? 1 + pulse * 0.5 : 1);
  for (const bk of QS.a) {
    const pts = bk.d, len = bk.n;
    ctx.fillStyle = bk.css;
    ctx.strokeStyle = bk.css;
    ctx.lineWidth = Math.max(1, lw);
    for (let s0 = 0; s0 < len; s0 += 8 * QUAD_CHUNK) {
      ctx.beginPath();
      const e0 = Math.min(len, s0 + 8 * QUAD_CHUNK);
      for (let s = s0; s < e0; s += 8) {
        ctx.moveTo(pts[s], pts[s + 1]);
        ctx.lineTo(pts[s + 2], pts[s + 3]);
        ctx.lineTo(pts[s + 4], pts[s + 5]);
        ctx.lineTo(pts[s + 6], pts[s + 7]);
        ctx.closePath();
      }
      if (fillAmt > 0.02) { ctx.globalAlpha = fillAmt; ctx.fill(); ctx.globalAlpha = 1; }
      if (fillAmt < 0.98) ctx.stroke();
    }
  }
  const glow = styleMode === 4 && inv < 0.5;      // glow: a soft wide pass added on top of a thin one
  for (let pass = glow ? 0 : 1; pass < 2; pass++) {
    if (pass === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.lineWidth = lw * 4; }
    else { ctx.globalAlpha = 1; ctx.lineWidth = lw; }
    for (const bk of LS.a) {
      const seg = bk.d, len = bk.n;
      ctx.strokeStyle = bk.css;
      for (let s0 = 0; s0 < len; s0 += 4 * LINE_CHUNK) {
        ctx.beginPath();
        const e0 = Math.min(len, s0 + 4 * LINE_CHUNK);
        for (let s = s0; s < e0; s += 4) {
          ctx.moveTo(seg[s], seg[s + 1]);
          ctx.lineTo(seg[s + 2], seg[s + 3]);
        }
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  const rScale = sqrt(64 / COLS) * 0.5 * zoom; // fewer shapes -> bigger ones
  ctx.lineWidth = 1.2;
  for (const bk of CS.a) {
    const rad = (0.6 + bk.sl * 0.75) * rScale, kind = bk.kind, pts = bk.d, len = bk.n;
    ctx.fillStyle = bk.css;
    ctx.strokeStyle = bk.css;
    for (let s0 = 0; s0 < len; s0 += 2 * SHAPE_CHUNK) {
      ctx.beginPath();
      const e0 = Math.min(len, s0 + 2 * SHAPE_CHUNK);
      for (let s = s0; s < e0; s += 2) {
        const x = pts[s], y = pts[s + 1];
        if (kind === 0 && rad > 1.6) {
          ctx.moveTo(x + rad, y);
          ctx.arc(x, y, rad, 0, TWO_PI);
        } else if (kind <= 1) {                       // squares (and circles too small to tell apart from one)
          ctx.rect(x - rad * 0.9, y - rad * 0.9, rad * 1.8, rad * 1.8);
        } else {
          ctx.moveTo(x, y - rad * 1.2);
          ctx.lineTo(x + rad * 1.05, y + rad * 0.75);
          ctx.lineTo(x - rad * 1.05, y + rad * 0.75);
          ctx.closePath();
        }
      }
      if (fillAmt > 0.02) { ctx.globalAlpha = fillAmt; ctx.fill(); ctx.globalAlpha = 1; }   // solid part
      if (fillAmt < 0.98) ctx.stroke();                                                    // outline part
    }
  }
}

function meshEdge(buckets, off, a, b, fade) {
  if (!vis[a] || !vis[b]) return; // cut away by the image's shape
  const ia = off + a, ib = off + b;
  addLine(
    buckets,
    (cr[ia] + cr[ib]) >> 1, (cg[ia] + cg[ib]) >> 1, (cb[ia] + cb[ib]) >> 1,
    (40 + 200 * (br[ia] + br[ib]) / 2) * fade,
    PX[ia], PY[ia], PX[ib], PY[ib]
  );
}

function setupAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = actx.createAnalyser();
  recDest = actx.createMediaStreamDestination(); // the sound that goes into the video
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.8;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
}

// a music file from your device, played through a normal audio element
function handleFile(file) {
  if (file.type !== 'audio') { setLabel(playBtn, 'music', 'not audio'); return; }
  setupAudio();
  actx.resume();
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.loop = true;
    const src = actx.createMediaElementSource(audioEl);
    buildAudioFx(src);                       // music -> DJ effects -> analysed, heard and recorded
  }
  audioEl.pause();
  if (audioEl.src && audioEl.src.startsWith('blob:')) URL.revokeObjectURL(audioEl.src);
  audioEl.src = URL.createObjectURL(file.file);
  audioEl.load();
  fileLoaded = true;
  setLabel(playBtn, 'music', 'play'); setOn(playBtn, false);
}

function togglePlay() {
  if (!fileLoaded) { setLabel(playBtn, 'music', 'pick file'); return; }
  actx.resume();
  if (micOn) toggleMic(); // one source at a time
  if (audioEl.paused) {
    const pr = audioEl.play();
    if (pr && pr.catch) pr.catch(() => { setLabel(playBtn, 'music', 'tap again'); setOn(playBtn, false); });
    setLabel(playBtn, 'music', 'pause'); setOn(playBtn, true);
  } else {
    audioEl.pause();
    setLabel(playBtn, 'music', 'play'); setOn(playBtn, false);
  }
}

async function toggleMic() {
  if (micOn) {
    micStream.getTracks().forEach((t) => t.stop());
    micSrc.disconnect();
    micOn = false;
    setLabel(micBtn, 'mic', 'off'); setOn(micBtn, false);
    return;
  }
  try {
    setupAudio();
    await actx.resume();
    if (audioEl && !audioEl.paused) { audioEl.pause(); setLabel(playBtn, 'music', 'play'); setOn(playBtn, false); }
    // turn off the phone's voice processing so music is not filtered out
    const base = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: inputId ? Object.assign({ deviceId: { exact: inputId } }, base) : base });
    } catch (e1) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: base });   // that input is gone: use the default
    }
    micSrc = actx.createMediaStreamSource(micStream);
    micSrc.connect(analyser); // analysed and recorded, never played back (no feedback)
    micSrc.connect(recDest);
    micOn = true;
    setLabel(micBtn, 'mic', 'on'); setOn(micBtn, true);
  } catch (e) {
    setLabel(micBtn, 'mic', 'blocked');
  }
}

// average energy (0..1) between two frequencies in Hz
function bandEnergy(lo, hi) {
  const hz = actx.sampleRate / analyser.fftSize;
  const i0 = max(0, floor(lo / hz)), i1 = min(freqData.length - 1, ceil(hi / hz));
  let sum = 0;
  for (let i = i0; i <= i1; i++) { sum += freqData[i]; }
  return sum / ((i1 - i0 + 1) * 255);
}

// overall loudness (0..1) from the waveform
function loudness() {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  return sqrt(sum / timeData.length);
}

// fast attack, slow release, so the visuals punch on beats and settle gently
function follow(cur, target) {
  return cur + (target - cur) * (target > cur ? 0.75 : 0.12);
}

// slower follower for the grid (planes / density), so it does not flicker
function followSlow(cur, target) {
  return cur + (target - cur) * (target > cur ? 0.25 : 0.05);
}

// adaptive range: each band is stretched between its own recent low and high, so it
// keeps swinging over the full 0..1 range instead of sticking at the top
const ranges = {};
function normalise(name, v) {
  const r = ranges[name] || (ranges[name] = { lo: v, hi: v + 0.05 });
  r.hi = v > r.hi ? v : r.hi + (v - r.hi) * 0.004;
  r.lo = v < r.lo ? v : r.lo + (v - r.lo) * 0.004;
  const span = max(r.hi - r.lo, 0.05);
  return pow(constrain((v - r.lo) / span, 0, 1), 1.3);
}

// onset detector: true when the whole spectrum suddenly gets louder (a hit, a note, a clap)
function onset(k) {
  if (!prevFreq) prevFreq = new Float32Array(freqData.length);
  let flux = 0;
  for (let i = 0; i < freqData.length; i++) {
    const d = freqData[i] - prevFreq[i];
    if (d > 0) flux += d;
    prevFreq[i] = freqData[i];
  }
  flux /= freqData.length * 255;
  fluxAvg += (flux - fluxAvg) * 0.05;
  return flux > fluxAvg * (1 + 0.8 / k) + 0.004;
}

// while a file plays or the mic is on, the sliders are driven by the sound
function applySound() {
  if (!(micOn || (audioEl && !audioEl.paused))) return;
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);
  const k = sensSlider.value();
  const bass = normalise('bass', bandEnergy(20, 140));
  sBass = follow(sBass, bass);
  sMid = follow(sMid, normalise('mid', bandEnergy(400, 2600)));
  sTreble = follow(sTreble, normalise('treble', bandEnergy(5200, 14000)));
  sLevel = follow(sLevel, normalise('level', loudness()));

  // beat: bass jumps clearly above its running average -> a big pulse that fades out
  bassAvg += (bass - bassAvg) * 0.05;
  beatCool = max(0, beatCool - 1);
  const nowBC = performance.now();
  bcFeed(freqData, nowBC);
  pulse *= 0.88;                                                         // the last beat fades (before a new one can arrive)
  if (bcActive()) { if (bcTick(nowBC)) pulse = 1; }                          // the beat clock: on the predicted beats
  else if (beatCool === 0 && bass > 0.45 && bass > bassAvg * 1.2) { pulse = 1; beatCool = 10; }   // off: react to bass hits

  drive('depth', constrain(0.4 + sBass * k * 6 + pulse * k * 2.5, 0, 8));
  drive('relief', constrain(0.05 + sMid * k * 2, 0, 2));
  drive('variety', constrain(0.1 + sTreble * k * 1.2, 0, 1)); // treble -> how varied the sizes are
  drive('circle', constrain(sLevel * k * 0.9, 0, 1));
  // saturation: louder = more vivid, and every beat flashes the colours
  drive('saturation', constrain(0.2 + sLevel * k * 1.2 + pulse * k * 0.8, 0, 2));
  // solid <-> outline: an on-off switch that flips on every hit in the music
  // (any beat, note or clap, not only bass), so it always reacts to the sound
  const hit = onset(k);
  fillCool = max(0, fillCool - 1);
  if (fillCool === 0 && (hit || pulse > 0.95)) { fillState = 1 - fillState; fillCool = 9; }

  // planes: upper-mids (hi-hats, cymbals) change how many planes are stacked.
  // Density stays manual.
  sHigh = followSlow(sHigh, normalise('high', bandEnergy(2600, 5200)));
  drive('planes', round(constrain(2 + sHigh * k * 6, 2, 8))); // 2..8

  // effects follow the music while they are switched on
  if (fxOn.kaleido) {
    kRot += (0.004 + sBass * k * 0.05) * (0.2 + 1.6 * fxAmt.kaleido);                                 // slices turn with the bass
    kCool = max(0, kCool - 1);
    if (kCool === 0 && pulse > 0.8) { kIdx = (kIdx + 1) % KN.length; kCool = 20; } // new slice count on strong beats
  }
  if (fxOn.hue) hueRot += (0.004 + sTreble * k * 0.06 + pulse * 0.08) * (0.2 + 1.8 * fxAmt.hue);
  exDrive = constrain(sBass * 0.8 + pulse * 0.9, 0, 1.2);        // explode follows bass and beats
  twistT += 0.03 + sMid * k * 0.12;                               // twist swings back and forth with the mids
  twDrive = Math.sin(twistT) * (0.5 + sBass * 0.8);      // colours cycle with the treble
  if (fxOn.ripple) { rippleT += 0.05 + sMid * k * 0.2 + pulse * 0.2; rippleAmp = 0.08 + sBass * k * 0.4; } // waves with mids + bass
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
})();
