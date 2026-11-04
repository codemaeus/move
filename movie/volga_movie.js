// Promo movie director for Volga Rampage (borga.html).
// Runs inside the game page: drives the real engine for gameplay shots, adds comic-book panels, lettering,
// kaiju close-ups and a choreographed kaiju wrestling bout, and renders sound offline. Used by movie/render.js.
(() => {
  "use strict";
  const L = Game.lib, G = Game.G, K = Game.K, keys = Game.keys;
  const { W, H, GY, SW, AX, AY, KW, KH, PI } = L, lerp = L.lerp, clamp = L.clamp, rgba = L.rgba, col = L.col, hash = L.hash;
  const FPS = 60;
  const MC = document.createElement("canvas"); MC.width = W; MC.height = H; const m = MC.getContext("2d"); m.imageSmoothingEnabled = false;
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t), easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3), easeIn = t => Math.pow(clamp(t, 0, 1), 2.2);

  // ---------- sound: the game's own synth, rendered offline against the movie clock ----------
  let CLOCK = 0, OFF = null;
  function setupAudio(sec) {
    OFF = new OfflineAudioContext(2, Math.ceil(44100 * sec), 44100);
    const prox = new Proxy(OFF, { get(o, k) { if (k === "currentTime") return CLOCK; const v = o[k]; return typeof v === "function" ? v.bind(o) : v; } });
    const Orig = window.AudioContext; window.AudioContext = function () { return prox; }; window.webkitAudioContext = window.AudioContext;
    L.initAudio(); L.A.on = true; window.AudioContext = Orig;
  }
  const S = (k, s) => L.sfx(k, s);

  // ---------- pixel lettering ----------
  const TC = new Map();
  function letters(str, px, fill, outline = [12, 8, 14], shadow = null, ow = 2) {
    const key = [str, px, fill, outline, shadow, ow].join("|"); if (TC.has(key)) return TC.get(key); if (TC.size > 300) TC.clear();
    const c0 = document.createElement("canvas"), x0 = c0.getContext("2d"); x0.font = `${px}px "DotGothic16"`; const tw = Math.ceil(x0.measureText(str).width) + 2, th = px + 6;
    c0.width = tw; c0.height = th; x0.font = `${px}px "DotGothic16"`; x0.textBaseline = "top"; x0.fillStyle = "#000"; x0.fillText(str, 1, 1);
    const src = x0.getImageData(0, 0, tw, th).data, pad = ow + 3, cw = tw + pad * 2, ch = th + pad * 2, out = document.createElement("canvas"); out.width = cw; out.height = ch; const o = out.getContext("2d"), img = o.createImageData(cw, ch), d = img.data;
    const on = new Uint8Array(cw * ch); for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (src[(y * tw + x) * 4 + 3] > 110) on[(y + pad) * cw + x + pad] = 1;
    const put = (i, c) => { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; };
    if (shadow) for (let i = 0; i < cw * ch; i++) if (on[i]) for (let k = 1; k <= ow + 1; k++) { const j = i + k * cw + k; if (j < cw * ch) put(j, shadow); }
    if (outline) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { if (on[y * cw + x]) continue; let hit = false; for (let dy = -ow; dy <= ow && !hit; dy++) for (let dx = -ow; dx <= ow; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < cw && yy < ch && on[yy * cw + xx] && dx * dx + dy * dy <= ow * ow + 1) { hit = true; break; } } if (hit) put(y * cw + x, outline); }
    for (let i = 0; i < cw * ch; i++) if (on[i]) { const y = (i / cw) | 0, k = (y - pad) / th; put(i, Array.isArray(fill[0]) ? (k < 0.5 ? fill[0] : fill[1]) : fill); }
    o.putImageData(img, 0, 0); TC.set(key, out); return out;
  }
  // comic sound effect: big letters, scaled and tilted, popping in
  function bang(str, x, y, px, fill, t, o = {}) {
    const c = letters(str, px, fill, o.outline || [12, 8, 14], o.shadow || [120, 20, 20], o.ow || 2), pop = t < 0.12 ? 1.6 - t / 0.12 * 0.6 : 1 + (o.grow || 0) * t, sc = (o.sc || 1) * pop;
    const al = o.fade && t > o.fade ? clamp(1 - (t - o.fade) / 0.25, 0, 1) : 1; if (al <= 0) return;
    m.save(); m.globalAlpha = al; m.translate(Math.round(x), Math.round(y)); m.rotate(o.rot || 0); if (o.shake) m.translate(Math.round(L.rnd(-o.shake, o.shake)), Math.round(L.rnd(-o.shake, o.shake))); m.drawImage(c, Math.round(-c.width * sc / 2), Math.round(-c.height * sc / 2), Math.round(c.width * sc), Math.round(c.height * sc)); m.restore();
  }
  function caption(str, x, y, t, o = {}) {
    const n = Math.min(str.length, Math.floor(t * (o.speed || 24))); if (n <= 0) return; const s = str.slice(0, n), c = letters(s, o.px || 12, o.ink || [24, 16, 20], null), full = letters(str, o.px || 12, [0, 0, 0], null);
    const bw = full.width - 4, bh = full.height - 4; m.fillStyle = "rgb(12,8,14)"; m.fillRect(x - 2, y - 2, bw + 4, bh + 4); m.fillStyle = col(o.bg || [255, 232, 120]); m.fillRect(x, y, bw, bh); m.drawImage(c, x - 3, y - 3);
  }
  function bubble(str, x, y, tx, ty, t, o = {}) {
    if (t < 0) return; const c = letters(str, o.px || 12, [20, 14, 18], null), bw = c.width - 2, bh = c.height - 4, sc = t < 0.1 ? 0.6 + t * 4 : 1, X = Math.round(x - bw * sc / 2), Y = Math.round(y - bh * sc / 2), Wd = Math.round(bw * sc), Hd = Math.round(bh * sc);
    m.fillStyle = "rgb(12,8,14)"; m.beginPath(); m.moveTo(x - 6, y + bh * sc / 2 - 2); m.lineTo(tx, ty); m.lineTo(x + 6, y + bh * sc / 2 - 2); m.fill();
    m.fillRect(X - 2, Y, Wd + 4, Hd); m.fillRect(X, Y - 2, Wd, Hd + 4); m.fillStyle = col(o.bg || [255, 255, 250]); m.fillRect(X, Y, Wd, Hd); m.fillRect(X - 1, Y + 1, Wd + 2, Hd - 2);
    m.beginPath(); m.moveTo(x - 4, y + bh * sc / 2 - 3); m.lineTo(tx + (x - tx) * 0.2, ty + (y - ty) * 0.2); m.lineTo(x + 4, y + bh * sc / 2 - 3); m.fill();
    m.drawImage(c, X - 2, Y - 2, Math.round(c.width * sc), Math.round(c.height * sc));
  }
  // Ben-Day dots: a flat colour with a dot screen that thickens toward a focus point
  function halftone(x, y, w, h, bg, dot, fx, fy, k = 1) {
    m.fillStyle = col(bg); m.fillRect(x, y, w, h); m.fillStyle = col(dot); const R = Math.hypot(w, h) * 0.7;
    for (let yy = y; yy < y + h; yy += 4) for (let xx = x + ((yy - y) / 4 % 2 ? 2 : 0); xx < x + w; xx += 4) { const v = clamp(Math.hypot(xx - fx, yy - fy) / R * k, 0, 1), r = Math.round(v * 2.6); if (r <= 0) continue; if (r === 1) m.fillRect(xx, yy, 1, 1); else if (r === 2) { m.fillRect(xx - 1, yy, 3, 1); m.fillRect(xx, yy - 1, 1, 3); } else m.fillRect(xx - 1, yy - 1, 3, 3); }
  }
  function speedLines(cx, cy, t, n = 50, r0 = 50, seed = 1, cols = [[255, 255, 255], [20, 10, 14]], al = 0.8) {
    for (let i = 0; i < n; i++) { const a = hash(i + seed) * PI * 2 + t * 0.02, rr = r0 + hash(i * 3 + seed) * 40 + Math.sin(t * 9 + i) * 8, wd = 0.008 + hash(i * 7 + seed) * 0.016; m.fillStyle = rgba(cols[i % 3 ? 0 : 1], al); m.beginPath(); m.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); m.lineTo(cx + Math.cos(a - wd) * 520, cy + Math.sin(a - wd) * 520); m.lineTo(cx + Math.cos(a + wd) * 520, cy + Math.sin(a + wd) * 520); m.fill(); }
  }
  function hLines(t, dir, cols = [[255, 255, 255]], al = 0.6, y0 = 0, y1 = H) { for (let i = 0; i < 40; i++) { const y = y0 + hash(i * 5) * (y1 - y0), len = 40 + hash(i) * 140, x = ((hash(i * 9) * 900 + t * 1400 * dir) % 900 + 900) % 900 - 260; m.fillStyle = rgba(cols[i % cols.length], al * (0.4 + hash(i * 2) * 0.6)); m.fillRect(Math.round(x), Math.round(y), Math.round(len), 1); } }
  function burstShape(cx, cy, r, spikes, fill, t = 0, line = [12, 8, 14]) {
    const pts = []; for (let i = 0; i < spikes * 2; i++) { const a = i / (spikes * 2) * PI * 2 + t, rr = i % 2 ? r * (0.55 + 0.1 * hash(i)) : r * (0.9 + 0.2 * hash(i + 7)); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]); }
    const path = k => { m.beginPath(); pts.forEach(([x, y], i) => { const X = cx + (x - cx) * k, Y = cy + (y - cy) * k; i ? m.lineTo(X, Y) : m.moveTo(X, Y); }); m.closePath(); };
    m.fillStyle = col(line); path(1.08); m.fill(); m.fillStyle = col(fill); path(1); m.fill();
  }
  // a comic panel: black border, white gutter, content drawn inside a clip
  function panel(x, y, w, h, draw, o = {}) {
    m.save(); if (o.tilt) { m.translate(x + w / 2, y + h / 2); m.rotate(o.tilt); m.translate(-(x + w / 2), -(y + h / 2)); }
    if (o.gutter !== false) { m.fillStyle = "rgb(250,246,236)"; m.fillRect(x - 4, y - 4, w + 8, h + 8); }
    m.fillStyle = "rgb(12,8,14)"; m.fillRect(x - 2, y - 2, w + 4, h + 4); m.save(); m.beginPath(); m.rect(x, y, w, h); m.clip(); draw(x, y, w, h); m.restore(); m.restore();
  }
  function letterbox(k) { const h = Math.round(22 * k); if (h <= 0) return; m.fillStyle = "rgb(0,0,0)"; m.fillRect(0, 0, W, h); m.fillRect(0, H - h, W, h); }
  function fade(a, c = [0, 0, 0]) { if (a <= 0) return; m.fillStyle = rgba(c, a); m.fillRect(0, 0, W, H); }
  function snap() { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(MC, 0, 0); return c; }

  // ---------- kaiju close-ups: a big hand-pixelled profile head with expressions ----------
  const FW = 128, FH = 96, FCACHE = new Map(), mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function faceArt(C, ex) {
    const key = (C === L.JC ? "J" : C === L.SC ? "S" : "V") + JSON.stringify(ex); if (FCACHE.has(key)) return FCACHE.get(key); if (FCACHE.size > 200) FCACHE.clear();
    const p = L.painter(FW, FH), q = L.painter(FW, FH), jaw = ex.jaw || 0, brow = ex.brow || 0, snarl = ex.snarl || 0;
    const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k], same = (c, d) => c && c[0] === d[0] && c[1] === d[1] && c[2] === d[2];
    const spike = (b, d, len, wd, glow = true) => { const pr = [-d[1], d[0]], tip = add(b, d, len); p.poly([add(b, pr, wd), tip, add(b, pr, -wd)], C.spB); p.poly([add(add(b, pr, wd * 0.6), d, 1.5), add(tip, d, -1.5), add(add(b, pr, -wd * 0.6), d, 1.5)], C.sp); if (glow) { q.poly([add(add(b, pr, wd * 0.6), d, 1.5), add(tip, d, -1.5), add(add(b, pr, -wd * 0.6), d, 1.5)], C.sp); q.line(...add(b, d, len * 0.3), ...add(tip, d, -3), C.spC); } };
    const rimC = C === L.JC ? [120, 220, 255] : C === L.SC ? [255, 200, 110] : [255, 170, 90];
    // neck: a thick column with dorsal plates
    for (let i = 0; i <= 30; i++) { const t = i / 30; p.E(lerp(8, 48, t) + 2, lerp(106, 60, t) + 3, lerp(34, 22, t), lerp(34, 22, t), C.bodyD); }
    [[12, 72, 24, 8.5], [22, 55, 22, 7.5], [34, 41, 19, 6.5], [46, 30, 14, 5]].forEach(([x, y, l, wd]) => spike([x, y], [-0.55, -0.83], l * (C.plate || 1), wd * (C.plate || 1)));
    for (let i = 0; i <= 30; i++) { const t = i / 30; p.E(lerp(8, 48, t), lerp(106, 60, t), lerp(34, 22, t) - 1, lerp(34, 22, t) - 1, C.body); }
    for (let i = 0; i <= 30; i++) { const t = i / 30; p.E(lerp(2, 40, t), lerp(98, 54, t), lerp(11, 6, t), lerp(11, 6, t), C.bodyL); }
    // neck scale rows (arcs) for texture
    for (let r = 0; r < 5; r++) for (let i = 0; i < 6; i++) { const cx = 16 + i * 8 + r * 4, cy = 96 - r * 9 - i * 2; p.line(cx - 3, cy, cx, cy + 2, C.bodyD); p.line(cx, cy + 2, cx + 3, cy, C.bodyD); }
    // lower jaw: an angular slab hinged under the cheek
    const hg = [56, 60], ja = jaw * 0.6, rot = v => [hg[0] + v[0] * Math.cos(ja) - v[1] * Math.sin(ja), hg[1] + v[0] * Math.sin(ja) + v[1] * Math.cos(ja)];
    const jawPts = [[-4, -4], [62, -3], [64, 2], [54, 8], [10, 13], [-6, 8]].map(rot); p.poly(jawPts.map(v => [v[0] + 1, v[1] + 2]), C.bodyDD); p.poly(jawPts, C.bodyD);
    p.poly([[2, 6], [56, 5], [50, 9], [10, 12]].map(rot), C.bellyD); p.line(...rot([4, 2]), ...rot([58, 1]), C.bodyL);
    const FANG_L = [5, 6.5, 11, 5, 6.5, 5.5, 9, 5];
    if (jaw > 0.06) {
      const lipU = [[64, 56], [121, 52]], l0 = rot([6, -3]), l1 = rot([60, -2]);
      p.poly([lipU[0], lipU[1], l1, l0], C.mouthD); p.poly([add(lipU[0], [4, 3]), add(lipU[1], [-10, 3]), add(l1, [-10, -2]), add(l0, [6, -2])], C.mouth);
      if (ex.fire) { q.poly([add(lipU[0], [6, 3]), add(lipU[1], [-8, 3]), add(l1, [-12, -2]), add(l0, [8, -2])], [255, 200, 90]); q.poly([add(lipU[0], [18, 5]), add(lipU[1], [-20, 4]), add(l1, [-22, -3]), add(l0, [18, -3])], [255, 250, 220]); }
      else { p.E2(...rot([34, -6]), 14, 3.6, ja * 0.7, [200, 76, 92]); p.E2(...rot([30, -7]), 9, 1.2, ja * 0.7, [236, 120, 130]); }
      // saliva strands between the jaws
      if (!ex.fire) for (const u of [0.62]) { const top = [lerp(66, 118, u), lerp(57, 53, u)], bot = rot([lerp(8, 58, u), -3]); if (bot[1] - top[1] > 6) { p.line(top[0], top[1] + 3, top[0] + (bot[0] - top[0]) * 0.5 + 1, (top[1] + bot[1]) / 2 + 2, [236, 206, 216]); p.line(top[0] + (bot[0] - top[0]) * 0.5 + 1, (top[1] + bot[1]) / 2 + 2, bot[0], bot[1] - 3, [236, 206, 216]); } }
      FANG_L.forEach((L2, i) => { const b0 = rot([10 + i * 6.6, -3]), d = [Math.sin(ja), -Math.cos(ja)]; p.poly([add(b0, [-2.4, 0]), add(b0, [2.4, 0]), add(b0, d, L2 * 0.75)], C.teeth); p.line(...add(b0, [1.4, 0]), ...add(b0, d, L2 * 0.6), [190, 184, 170]); p.P(...add(b0, d, 1), [255, 255, 255]); });
    }
    // skull: an angular wedge with a heavy brow and a deep snout
    const skull = [[36, 44], [44, 26], [60, 16], [80, 15], [98, 22], [114, 32], [124, 40], [127, 47], [122, 54], [64, 58], [50, 62], [38, 56]];
    p.poly(skull.map(v => [v[0] + 1, v[1] + 2]), C.bodyDD); p.poly(skull, C.body);
    p.poly([[46, 27], [61, 18], [80, 17], [97, 24], [113, 34], [122, 41], [108, 38], [88, 30], [66, 27], [50, 32]], C.bodyL); // the lit top plane
    p.poly([[40, 50], [62, 46], [92, 48], [122, 50], [121, 54], [64, 58], [50, 62], [38, 56]], C.bodyD); // shadowed cheek and lip
    p.line(56, 44, 92, 41, C.bodyL); p.line(56, 45, 92, 42, C.bodyD); // cheekbone ridge
    if (snarl > 0.05) { p.poly([[68, 55], [118, 51], [116, 51 - snarl * 2.5], [70, 53 - snarl * 3]], [176, 64, 78]); for (let i = 0; i < 4; i++) { const x = 90 + i * 7; p.line(x, 33 - snarl * 1, x + 4, 40 - snarl * 1, C.bodyDD); p.line(x + 1, 33 - snarl, x + 5, 40 - snarl, C.bodyL); } }
    // upper fangs: uneven, with two long canines; when the mouth is shut they overlap the lower jaw
    FANG_L.forEach((L2, i) => { const x = 68 + i * 6.6, y = 55 - (x - 68) * 0.07; p.poly([[x - 2.6, y], [x + 2.6, y], [x + 0.4, y + L2 + snarl * 2]], C.teeth); p.line(x + 1.5, y + 1, x + 0.6, y + L2 * 0.8, [190, 184, 170]); p.P(x - 1.2, y + 1, [255, 255, 255]); });
    if (jaw <= 0.06) FANG_L.forEach((L2, i) => { if (i % 2) return; const x = 71 + i * 6.6, y = 60 - (x - 68) * 0.06; p.poly([[x - 2.4, y + 1], [x + 2.4, y + 1], [x, y - L2 * 0.65]], C.teeth); });
    p.poly([[118, 42], [123, 41], [121, 44]], C.bodyDD); p.P(119, 41, C.bodyL); // nostril
    spike([40, 34], [-0.95, -0.3], 13, 4.2, true); // cheek spike
    if (C.horn) { spike([56, 21], [-0.42, -0.9], 28, 5, false); spike([46, 25], [-0.75, -0.66], 21, 4.2, false); }
    // eye set deep under the brow, glowing out of the shadow
    const eh = ex.eyeH != null ? ex.eyeH : { open: 4.2, narrow: 2.4, wide: 6, closed: 0, glow: 3.6 }[ex.eye || "open"], ey = [76, 34], tilt = 0.12 + Math.max(0, brow) * 0.2;
    const sl = Math.max(0, brow) * 0.7, alm = (w2, h2, dx = 0, dy = 0) => [[-w2, -0.1 * h2], [-0.35 * w2, -h2], [0.55 * w2, -h2 * (1 - sl)], [w2, h2 * (0.15 + sl * 0.5)], [0.25 * w2, h2], [-0.6 * w2, 0.8 * h2]].map(([x, y]) => [ey[0] + x + dx, ey[1] + y + dy]);
    p.poly(alm(12.5, Math.max(3.4, eh + 3)), C.bodyDD);
    if (eh > 0.4) {
      const ec = ex.eye === "glow" ? [255, 255, 255] : C.eye; q.poly(alm(11, eh + 1.6), ex.eye === "glow" ? [255, 150, 70] : mixc(C.eye, [255, 110, 30], 0.55)); p.poly(alm(9.5, eh), ec); q.poly(alm(9.5, eh), ec);
      p.poly(alm(7, eh * 0.45, -1, eh * 0.5), mixc(ec, [190, 80, 20], 0.4));
      if (ex.eye === "glow") { q.poly(alm(9.5, eh), [255, 255, 255]); q.line(ey[0] + 9, ey[1] - 1, ey[0] + 28, ey[1] - 4, [255, 230, 190]); q.line(ey[0] + 9, ey[1], ey[0] + 22, ey[1] - 1, [255, 200, 140]); }
      else if (ex.eye === "wide") { p.R(ey[0] + 1, ey[1] - 1, 2, 2, [10, 6, 6]); q.R(ey[0] + 1, ey[1] - 1, 2, 2, [10, 6, 6]); }
      else { const ph = Math.max(1, Math.round(eh * 2) - 1); p.R(ey[0] + 1, ey[1] - Math.round(eh) + 1, 2, ph, [10, 6, 6]); q.R(ey[0] + 1, ey[1] - Math.round(eh) + 1, 2, ph, [30, 8, 8]); }
      if (ex.eye !== "glow") { q.P(ey[0] - 4, ey[1] - Math.round(eh * 0.4), [255, 255, 255]); q.P(ey[0] - 3, ey[1] - Math.round(eh * 0.4), [255, 255, 240]); }
    } else { p.line(ey[0] - 9, ey[1] - 1, ey[0] + 9, ey[1] + 2, C.bodyDD, 2); p.line(ey[0] - 9, ey[1] + 1, ey[0] - 12, ey[1] + 3, C.bodyDD); }
    // the brow ridge: a hard overhang that slants down toward the snout when angry
    const bf = Math.max(0, brow) * 5, bu = Math.max(0, -brow) * 4, by0 = ey[1] - eh * (brow > 0 ? 0.45 : 1) - 3;
    p.poly([[58, by0 - 3 - bu], [80, by0 - 5 - bu], [94, by0 - 1 + bf - bu], [93, by0 + 2.5 + bf - bu], [80, by0 + 1.5 - bu * 0.5], [61, by0 + 2.5]], C.bodyDD);
    p.line(61, by0 - 3 - bu, 91, by0 - 2 + bf - bu, C.bodyL);
    // texture, lava veins, ink hatching in the shadows, outline and rim light
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const c = p.G(x, y); if (!c) continue;
      const isB = same(c, C.body), isD = same(c, C.bodyD), isL = same(c, C.bodyL);
      if (C.veins && (isB || isD) && ((x + (y >> 1) + ((hash(x * 31 + (y >> 3)) * 3) | 0)) % 15 === 0)) { p.P(x, y, C.veinsD); q.P(x, y, C.veins); continue; }
      if (isD && (x - y + 400) % 4 === 0 && hash(x * 7 + y * 13) > 0.25) p.P(x, y, C.bodyDD);
      else if (isB && hash(x * 977 + y * 131) > 0.86) p.P(x, y, C.bodyD); else if (isL && hash(x * 13 + y * 7919) > 0.88) p.P(x, y, C.body); }
    const rim = []; for (let y = 1; y < FH; y++) for (let x = 0; x < FW - 1; x++) { const c = p.G(x, y); if (c && !p.G(x, y - 1) && !p.G(x + 1, y - 1) && (same(c, C.body) || same(c, C.bodyL))) rim.push([x, y]); }
    p.outline(C.out); p.outline(C.out);
    for (const [x, y] of rim) { p.P(x, y, mixc(C.bodyL, rimC, 0.55)); q.P(x, y, mixc(rimC, [0, 0, 0], 0.35)); }
    const out = { r: p.done(), gr: q.done() }; FCACHE.set(key, out); return out;
  }
  function face(C, ex, x, y, sc = 1, flipX = false, glowA = 0.9) {
    const F = faceArt(C, ex), w = FW * sc, h = FH * sc; m.save(); m.translate(Math.round(x), Math.round(y)); if (flipX) m.scale(-1, 1);
    m.drawImage(F.r, Math.round(-w / 2), Math.round(-h / 2), w, h); m.globalCompositeOperation = "lighter"; m.globalAlpha = glowA; m.drawImage(F.gr, Math.round(-w / 2), Math.round(-h / 2), w, h); m.restore();
  }
  function sweat(x, y, s = 1, t = 0) { const yy = y + (t * 30 % 12); m.fillStyle = "rgb(12,8,14)"; m.fillRect(x - 2 * s, yy - 4 * s, 5 * s, 7 * s); m.fillStyle = "rgb(150,220,255)"; m.fillRect(x - s, yy - 3 * s, 3 * s, 5 * s); m.fillRect(x, yy - 5 * s, s, 2 * s); m.fillStyle = "rgb(240,250,255)"; m.fillRect(x - s, yy - 2 * s, s, s); }
  function vein(x, y, s = 1, t = 0) { const k = 1 + 0.15 * Math.sin(t * 30); s *= k; m.fillStyle = "rgb(12,8,14)"; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { m.fillRect(Math.round(x + dx * 3 * s - s * 1.5), Math.round(y + dy * 3 * s - s * 1.5), Math.round(3 * s + 1), Math.round(3 * s + 1)); } m.fillStyle = "rgb(240,40,50)"; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.fillRect(Math.round(x + dx * 3 * s - s), Math.round(y + dy * 3 * s - s), Math.round(2 * s), Math.round(2 * s)); }
  function sparkle(x, y, r, t) { const k = Math.max(0, Math.sin(clamp(t, 0, 1) * PI)); if (k <= 0) return; m.fillStyle = rgba([255, 255, 240], k); m.fillRect(Math.round(x - r * k), Math.round(y), Math.round(r * 2 * k) + 1, 1); m.fillRect(Math.round(x), Math.round(y - r * k), 1, Math.round(r * 2 * k) + 1); m.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3); }

  window.__MV = { L, G, K, keys, W, H, GY, SW, AX, AY, KW, KH, PI, FPS, MC, m, lerp, clamp, rgba, col, hash, ease, easeOut, easeIn, setupAudio, S, letters, bang, caption, bubble, halftone, speedLines, hLines, burstShape, panel, letterbox, fade, snap, faceArt, face, sweat, vein, sparkle, get CLOCK() { return CLOCK; }, set CLOCK(v) { CLOCK = v; }, get OFF() { return OFF; } };
})();
