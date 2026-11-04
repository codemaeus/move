// Promo movie timeline for Volga Rampage: a comic-book style short built from the game's own art.
// Loaded after volga_movie.js; defines window.MOVIE. Most shots use a small stage renderer with its own
// camera (zoom, low angles, tilt) so we get close-ups and staging the side-on game camera cannot show.
(() => {
  "use strict";
  const V = window.__MV, { L, G, K, keys, W, H, GY, SW, AX, AY, KW, PI, FPS, m, lerp, clamp, rgba, col, hash, ease, easeOut, easeIn, S } = V;
  const { bang, caption, bubble, halftone, speedLines, burstShape, panel, letterbox, fade, face, sweat, vein, sparkle } = V;
  const KP = L.KPOSE, KB = KP.idle0, rnd = L.rnd;
  const cv = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };

  // ---------- kaiju frames ----------
  const FC = new Map(), PAL = new Map([[L.KC, "V"], [L.JC, "J"], [L.SC, "S"]]);
  function kfr(pose, pal) {
    const key = PAL.get(pal) + JSON.stringify(pose, (k, v) => typeof v === "number" ? Math.round(v * 50) / 50 : v);
    let f = FC.get(key); if (f) { FC.delete(key); FC.set(key, f); return f; } f = L.kaijuFrame(pose, pal); FC.set(key, f); if (FC.size > 260) FC.delete(FC.keys().next().value); return f;
  }
  const mix = (a, b, t) => L.mixPose(a, b, clamp(t, 0, 1));
  const seqPose = (S2, t) => { let i = 0; while (i < S2.length - 1 && t >= S2[i + 1][0]) i++; if (i === S2.length - 1) return S2[i][1]; const [t0, a] = S2[i], [t1, b] = S2[i + 1]; return mix(a, b, (t - t0) / (t1 - t0)); };
  const idle = tt => mix(KP.idle0, KP.idle1, (1 - Math.cos(tt * 2.2)) / 2);
  const walk = ph => L.KD.poseOf(L.KD.cyc("w", 16, ph, 3)), dash = ph => L.KD.poseOf(L.KD.cyc("d", 16, ph, 3));
  const P = {
    grap: { ...KB, lean: 0.55, af: -0.35, ab: -0.25, fold: -0.25, ha: 0.1, jaw: 0.45, ff: [18, 0], fb: [-18, 0], by: 5, neck: -0.1 },
    lift: { ...KB, lean: -0.15, af: -1.8, ab: -1.65, fold: -0.25, ha: -0.55, jaw: 0.9, by: 5, ff: [17, 0], fb: [-16, 0] },
    bridge: { ...KB, lean: -0.55, af: -2.3, ab: -2.2, fold: -0.1, ha: -0.9, jaw: 0.75, by: 12, ff: [22, 0], fb: [-22, 0], ta: PI + 0.35 },
    charge: { ...KB, lean: 0.32, ha: -0.45, jaw: 0.95, af: 0.9, ab: 1.0, fold: -1.0, by: 6, ff: [15, 0], fb: [-16, 0] },
    flat: { ...KP.hurt, eye: 0, jaw: 0.9, af: -1.2, ab: -1.0 },
    swim: { ...KB, lean: 0.9, neck: -0.2, ha: 0.15, af: 1.6, ab: 1.6, fold: -0.2, by: 26, jaw: 0.1 },
  };
  P.grap2 = { ...P.grap, lean: 0.64, af: -0.12, ab: -0.02, jaw: 0.7, ff: [21, 0], fb: [-23, 0], by: 8 };
  const PUNCH = [[0, KP.s0], [0.18, KP.s01], [0.27, KP.s1], [0.4, KP.s2], [0.7, KP.idle0]];

  // ---------- the stage: sky, skyline, buildings, sea, road, actors and particles under a free camera ----------
  const [WL, w] = cv(), [EL, e] = cv(), [OUT, oc] = cv(), BL = document.createElement("canvas"); BL.width = W / 4; BL.height = H / 4; const b4 = BL.getContext("2d"); b4.imageSmoothingEnabled = true;
  const CITY = []; let seed = 70;
  function buildCity(x0, x1, types) { CITY.length = 0; let x = x0; while (x < x1) { const b = L.makeBuilding(x, types[(seed * 7) % types.length], seed++); b.burn = 0; CITY.push(b); x += b.w + 2 + (seed % 3) * 4; } }
  const PS = []; // particles
  const part = o => { if (PS.length < 1400) PS.push(Object.assign({ t: 0, g: 0, sz: 2, glow: 0 }, o)); };
  const dust = (x, y, n, s = 1) => { for (let i = 0; i < n; i++) part({ x: x + rnd(-10, 10) * s, y: y - rnd(0, 4), vx: rnd(-1, 1) * s, vy: rnd(-0.7, -0.1), life: rnd(40, 80) | 0, c: [120, 110, 120], sz: rnd(4, 9) * s, k: "puff" }); };
  const debris = (x, y, n, c = [110, 100, 96], sp = 3) => { for (let i = 0; i < n; i++) part({ x, y, vx: rnd(-sp, sp), vy: rnd(-sp * 1.5, -0.5), g: 0.2, life: rnd(40, 80) | 0, c, sz: Math.random() < 0.3 ? 3 : 2 }); };
  const sparks = (x, y, n, c = [255, 220, 140], sp = 3) => { for (let i = 0; i < n; i++) { const a = rnd(0, PI * 2), v = rnd(0.4, 1) * sp; part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 0.08, life: rnd(12, 26) | 0, c, sz: 1, glow: 1 }); } };
  const splash = (x, y, n, sp = 3) => { for (let i = 0; i < n; i++) part({ x: x + rnd(-30, 30), y, vx: rnd(-1.2, 1.2) * sp * 0.4, vy: -rnd(1, 3) * sp * 0.6, g: 0.14, life: rnd(40, 70) | 0, c: Math.random() < 0.5 ? [200, 230, 255] : [120, 170, 230], sz: rnd(1, 3) }); };
  const flame = (x, y, vx, vy, life, hot) => part({ x, y, vx, vy, life, k: "flame", hot, sz: 2 });
  function stepParts() { for (const p of PS) { p.t++; if (p.k === "flame") { p.vx *= 0.975; p.vy = p.vy * 0.975 - 0.03; p.sz += 0.28; } else if (p.k === "puff") { p.vx *= 0.97; p.vy *= 0.97; p.sz += 0.06; } else p.vy += p.g; p.x += p.vx; p.y += p.vy; if (p.g && p.y > GY + 6) { p.y = GY + 6; p.vy *= -0.3; p.vx *= 0.6; } } for (let i = PS.length - 1; i >= 0; i--) if (PS[i].t >= PS[i].life) PS.splice(i, 1); }
  const HOR = 176;
  function camT(c, C, par = 1) { c.setTransform(1, 0, 0, 1, 0, 0); c.translate(W / 2, H / 2); if (C.rot) c.rotate(C.rot); const s = 1 + (C.z - 1) * par; c.scale(s, s); c.translate(-C.x * par, -(C.y * par + (1 - par) * HOR)); }
  // actor: { pal, pose, x, y, dir, rot, px, py, sq, flash, glow, sil, sink (cut at waterline) }
  function drawActor(a) {
    const F = kfr(a.pose, a.pal), ox = a.dir > 0 ? AX : KW - AX, img = a.sil ? (a.dir > 0 ? F.sr : F.sl) : a.flash ? (a.dir > 0 ? F.wr : F.wl) : a.dir > 0 ? F.r : F.l, gl = a.dir > 0 ? F.gr : F.gl, Y = GY - (a.y || 0);
    if (!a.noShadow && !a.sea) { w.fillStyle = "rgba(0,0,0,0.35)"; w.beginPath(); w.ellipse(a.x, GY + 2, Math.max(8, 34 - (a.y || 0) * 0.2), 4, 0, 0, PI * 2); w.fill(); }
    for (const [c, im, al, cut] of [[w, img, 1], [e, img, 1, 1], [e, gl, a.glow == null ? 0.8 : a.glow]]) { if (al <= 0) continue; c.save(); c.globalAlpha = al; if (cut) c.globalCompositeOperation = "destination-out"; c.translate(a.x + (a.px || 0), Y + (a.py || 0)); if (a.rot) c.rotate(a.rot); if (a.sq && a.sq < 0.999) c.scale(a.sq, 1); c.translate(-(a.px || 0), -(a.py || 0)); c.drawImage(im, -ox, -AY); c.restore(); }
    if (a.aura) { w.save(); w.globalAlpha = 0.35 + 0.15 * Math.sin(Tm * 20); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) w.drawImage(a.dir > 0 ? F.hr : F.hl, a.x - ox + dx, Y - AY + dy); w.restore(); }
    a.F = F;
  }
  const mouthOf = a => { const F = a.F || kfr(a.pose, a.pal); return [a.x + F.mouth[0] * a.dir, GY - (a.y || 0) + F.mouth[1]]; };
  const handOf = a => { const F = a.F || kfr(a.pose, a.pal); return [a.x + F.hand[0] * a.dir, GY - (a.y || 0) + F.hand[1]]; };
  let Tm = 0;
  function person(c, x, y, t, o = {}) { // a 6x12 citizen; feet at (x, y)
    const run = o.run ? Math.floor(t * 12 + x) % 2 : 0, d = o.dir || 1, sk = [230, 190, 160], sh = o.shirt || [[200, 60, 60], [60, 110, 200], [230, 230, 220], [90, 160, 90]][Math.abs(Math.round(x)) % 4];
    c.fillStyle = "rgb(20,18,26)"; c.fillRect(x - 2 + (run ? -1 : 0), y - 4, 2, 4); c.fillRect(x + (run ? 1 : 0), y - 4, 2, 4);
    c.fillStyle = col(sh); c.fillRect(x - 2, y - 9, 5, 5); c.fillStyle = col(sk); c.fillRect(x - 2, y - 12, 4, 3); c.fillStyle = col(o.helmet ? [70, 90, 60] : [40, 30, 30]); c.fillRect(x - 2, y - 13, 4, 2);
    c.fillStyle = col(o.helmet ? [70, 90, 60] : sh); if (o.up) { c.fillRect(x - 3, y - 14 + run, 1, 5); c.fillRect(x + 3, y - 14 + (1 - run), 1, 5); } else { c.fillRect(x - 3, y - 9, 1, 4); c.fillRect(x + 3, y - 9, 1, 4); }
    if (o.point) { c.fillStyle = col(sk); c.fillRect(x + 3 * d, y - 10, 4 * d, 1); }
  }
  function stage(C, o = {}) {
    Tm += 1 / FPS; for (const c of [w, e]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); }
    // sky (screen space)
    w.drawImage(L.SKY, 0, 0); if (o.redSky) { w.fillStyle = rgba([255, 80, 40], o.redSky * 0.35); w.fillRect(0, 0, W, H); } if (o.storm) { w.fillStyle = rgba([10, 10, 20], 0.5 * o.storm); w.fillRect(0, 0, W, H); }
    // skylines with parallax
    for (const [S2, par] of [[L.FAR, 0.15], [L.MID, 0.4]]) { camT(w, C, par); camT(e, C, par); const x0 = Math.floor((C.x * par - W) / S2.w) * S2.w; for (let x = x0; x < C.x * par + W * 1.5; x += S2.w) { w.drawImage(S2.c, x, 0); e.drawImage(S2.l, x, 0); } }
    camT(w, C); camT(e, C);
    // sea and road
    const seaX = o.seaX == null ? -1e9 : o.seaX, L0 = C.x - W * 2, L1 = C.x + W * 2;
    if (seaX > L0) { w.fillStyle = "rgb(18,24,48)"; w.fillRect(L0, 176, seaX - L0, 120); }
    if (L1 > seaX) { const x0 = Math.max(L0, seaX); w.fillStyle = "rgb(96,92,100)"; w.fillRect(x0, SW, L1 - x0, 7); w.fillStyle = "rgb(150,146,150)"; w.fillRect(x0, SW + 7, L1 - x0, 1); w.fillStyle = "rgb(40,40,48)"; w.fillRect(x0, SW + 9, L1 - x0, 120); w.fillStyle = "rgb(210,200,150)"; for (let x = Math.ceil(x0 / 40) * 40; x < L1; x += 40) w.fillRect(x, 208, 18, 1); w.fillStyle = "rgb(128,128,140)"; w.fillRect(x0, 202, L1 - x0, 1); }
    // buildings
    for (const b of CITY) { if (b.gone) continue; const top = SW - b.h + (b.sink || 0); w.save(); if (b.rot) { const px = b.x + (b.rot > 0 ? b.w : 0); w.translate(px, SW); w.rotate(b.rot); w.translate(-px, -SW); } w.drawImage(b.c, b.x, top); w.restore(); if (!b.dark) e.drawImage(b.l, b.x, top);
      if (b.burn > 0) for (let i = 0; i < 3 + b.w / 14; i++) { const fx = b.x + hash(i * 5 + b.seed) * b.w, fy = top + 10 + hash(i * 3 + b.seed) * (b.h - 16); if (hash(i + b.seed * 3) < b.burn) flameSprite(e, fx, fy, 1); } }
    if (o.props) o.props(w, e);
    // actors
    for (const a of o.actors || []) drawActor(a);
    if (o.front) o.front(w, e);
    // particles
    for (const p of PS) { const k = p.t / p.life;
      if (p.k === "flame") { const c = p.hot ? (k < 0.14 ? [255, 255, 255] : k < 0.32 ? [200, 240, 255] : k < 0.52 ? [110, 180, 255] : [110, 80, 230]) : k < 0.12 ? [255, 255, 230] : k < 0.3 ? [255, 230, 110] : k < 0.5 ? [255, 160, 50] : [220, 70, 30]; if (k > 0.75) { w.fillStyle = rgba([60, 40, 40], (1 - k) * 2); w.fillRect(p.x - p.sz, p.y - p.sz, p.sz * 2, p.sz * 2); } else { e.fillStyle = col(c); const r = p.sz * (k < 0.5 ? 1 : 1.5 - k); e.fillRect(Math.round(p.x - r), Math.round(p.y - r * 0.8), Math.round(r * 2) + 1, Math.round(r * 1.6) + 1); } continue; }
      if (p.k === "puff") { w.fillStyle = rgba(p.c, 0.5 * (1 - k)); w.fillRect(Math.round(p.x - p.sz / 2), Math.round(p.y - p.sz / 2), Math.round(p.sz), Math.round(p.sz)); continue; }
      (p.glow ? e : w).fillStyle = rgba(p.c, p.glow ? 1 - k : 1); (p.glow ? e : w).fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz); }
    // the sea surface sits in front of anything wading in it
    if (seaX > L0) { const top = o.seaY || 176; w.fillStyle = "rgba(14,20,44,0.92)"; w.fillRect(L0, top, seaX - L0, 140); w.fillStyle = "rgba(120,150,210,0.55)"; for (let i = 0; i < 90; i++) { const x = L0 + ((hash(i) * 1400 + Tm * 8 * (0.4 + hash(i + 3))) % (seaX - L0 + 1)), y = top + 2 + hash(i * 7) * 34; w.fillRect(Math.round(x), Math.round(y), 3 + Math.round(hash(i * 2) * 6), 1); } w.fillStyle = "rgba(200,220,255,0.6)"; w.fillRect(L0, top, seaX - L0, 1); }
    // compose: night grade, glow, bloom
    oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalCompositeOperation = "source-over"; oc.drawImage(WL, 0, 0); oc.globalCompositeOperation = "multiply"; oc.fillStyle = col(o.grade || [168, 158, 212]); oc.fillRect(0, 0, W, H); oc.globalCompositeOperation = "lighter"; oc.drawImage(EL, 0, 0);
    b4.clearRect(0, 0, W / 4, H / 4); b4.drawImage(EL, 0, 0, W / 4, H / 4); oc.globalAlpha = 0.6; oc.imageSmoothingEnabled = true; oc.drawImage(BL, -2, -2, W + 4, H + 4); oc.imageSmoothingEnabled = false; oc.globalAlpha = 1; oc.globalCompositeOperation = "source-over";
    if (o.fg) { camT(oc, C, o.fgPar || 1.6); o.fg(oc); oc.setTransform(1, 0, 0, 1, 0, 0); }
    if (!o.noDraw) m.drawImage(OUT, 0, 0); return OUT;
  }
  function flameSprite(c, x, y, s) { const f = Math.floor(Tm * 12 + x) % 3, h2 = 6 + f; c.fillStyle = "rgb(220,70,30)"; c.fillRect(Math.round(x - 3 * s), Math.round(y - h2 * s * 0.6), Math.round(6 * s), Math.round(h2 * s * 0.6)); c.fillStyle = "rgb(255,170,60)"; c.fillRect(Math.round(x - 2 * s), Math.round(y - h2 * s * 0.5), Math.round(4 * s), Math.round(h2 * s * 0.4)); c.fillStyle = "rgb(255,240,170)"; c.fillRect(Math.round(x - s), Math.round(y - 3 * s), Math.round(2 * s), Math.round(2 * s)); }
  function bolt(x0, y0, x1, y1, seedv, wd = 2) { m.save(); m.globalCompositeOperation = "lighter"; for (const [lw, c] of [[wd + 3, [120, 160, 255]], [wd, [255, 255, 255]]]) { m.strokeStyle = col(c); m.lineWidth = lw; m.beginPath(); m.moveTo(x0, y0); for (let i = 1; i <= 9; i++) { const u = i / 9; m.lineTo(lerp(x0, x1, u) + (i < 9 ? (hash(i + seedv) - 0.5) * 30 : 0), lerp(y0, y1, u)); } m.stroke(); } m.restore(); }
  const shake = k => { m.translate(Math.round(rnd(-k, k)), Math.round(rnd(-k, k))); };
  function soldierFace(x, y, s, t) { // comic close-up of a shouting soldier
    const R = (a, b, c2, d, c) => { m.fillStyle = col(c); m.fillRect(Math.round(x + a * s), Math.round(y + b * s), Math.round(c2 * s), Math.round(d * s)); };
    R(-13, -2, 26, 22, [230, 186, 150]); R(-15, -14, 30, 12, [70, 92, 58]); R(-17, -4, 34, 3, [50, 66, 40]); R(-11, -12, 8, 2, [100, 124, 84]);
    R(-9, 2, 6, 2, [30, 20, 20]); R(3, 2, 6, 2, [30, 20, 20]); R(-8, 5, 3, 3, [255, 255, 255]); R(4, 5, 3, 3, [255, 255, 255]); R(-7, 6, 1, 1, [0, 0, 0]); R(5, 6, 1, 1, [0, 0, 0]);
    const mo = 4 + Math.round(Math.abs(Math.sin(t * 18)) * 3); R(-6, 11, 12, mo, [120, 20, 30]); R(-5, 11, 10, 1, [250, 250, 250]); R(-13, 18, 26, 2, [200, 156, 124]); R(-18, 20, 36, 10, [70, 92, 58]);
  }

  // ---------- timeline ----------
  const SC = [], scene = (d, f, init) => SC.push({ d, f, init });
  let A = {}; // per-shot actors
  const V0 = () => ({ pal: L.KC, pose: KB, x: 0, dir: 1 }), J0 = () => ({ pal: L.JC, pose: KB, x: 0, dir: -1 });
  let CARS = [];
  const roadProps = (cars, people) => (w2) => { for (const c of cars) { if (c.dead) { w2.save(); w2.translate(c.x, 210); w2.scale(1, 0.35); w2.drawImage(c.img, -10, -10); w2.restore(); continue; } w2.save(); if (c.fly) { w2.translate(c.x, c.y); w2.rotate(c.r); w2.drawImage(c.img, -10, -5); } else w2.drawImage(c.img, Math.round(c.x - 10), Math.round((c.y || 210) - 10)); w2.restore(); } for (const p of people) person(w2, p.x, p.y, Tm, p); };

  // 1. black, typed caption, a distant rumble
  scene(3.2, (t) => { m.fillStyle = "rgb(0,0,0)"; m.fillRect(0, 0, W, H); if (t > 0.3) caption("その夜――", 150, 98, t - 0.3, { px: 16, speed: 8 }); if (t > 2.2 && t < 2.22) S("thunder"); });
  // 2. establishing pan over the harbour
  scene(6.5, (t, n) => { stepParts(); const C = { x: 260 + t * 22, y: 120, z: 1 }; for (const c of CARS) c.x += c.v;
    stage(C, { seaX: 330, props: roadProps(CARS, A.people) }); letterbox(1); if (t > 0.5) caption("港町は いつもの夜を むかえていた", 8, 28, t - 0.5, { speed: 18 }); fade(1 - t * 1.5); },
    () => { buildCity(340, 1200, ["warehouse", "office", "crane", "factory", "apart", "office"]); CARS = [0, 1, 2, 3, 4].map(i => ({ x: 360 + i * 90, v: i % 2 ? 0.5 : -0.4, img: L.SPR.cars[i % 6], y: i % 2 ? 212 : 207 })); A.people = [{ x: 300, y: 194 }, { x: 308, y: 194 }, { x: 318, y: 194, dir: -1 }].map(p => ({ ...p, y: 176 })); });
  // 3. on the pier: something in the water
  scene(4.6, (t, n) => { stepParts(); if (n % 4 === 0) part({ x: 250 + rnd(-20, 20), y: 182, vx: 0, vy: -0.4, life: 30, c: [180, 210, 255], sz: 2 });
    const C = { x: 290, y: 150, z: 2.4 }; const ppl = [{ x: 300, y: 176, point: t > 1.6, dir: -1 }, { x: 310, y: 176 }, { x: 320, y: 176, dir: -1 }];
    stage(C, { seaX: 330, seaY: 176 + Math.sin(t * 3) * 1, props: (w2) => { w2.fillStyle = "rgb(70,56,48)"; w2.fillRect(280, 176, 50, 3); for (let x = 282; x < 330; x += 10) w2.fillRect(x, 179, 2, 12); for (const p of ppl) person(w2, p.x, p.y, Tm, p); } });
    if (t > 1.0) bubble("…ん？ 海が……", 120, 50, 170, 92, t - 1.0); if (t > 2.6) bang("ゴボゴボ……", 120, 150, 12, [[200, 230, 255], [90, 140, 220]], t - 2.6, { sc: 1.6, rot: 0.1 }); letterbox(1); },
    () => { PS.length = 0; });
  // 4. the dorsal plates cut through the water
  scene(4.2, (t, n) => { stepParts(); A.v.x = 120 + t * 34; A.v.pose = P.swim; A.v.y = -34; if (n % 2 === 0) splash(A.v.x + 10, 178, 2, 1.2);
    stage({ x: 150 + t * 30, y: 160, z: 2 }, { seaX: 330, actors: [A.v] }); if (t > 0.6) bang("ザザザザ……", 270, 160, 12, [[220, 240, 255], [120, 170, 240]], t - 0.6, { sc: 1.8, rot: -0.05 }); letterbox(1); },
    () => { A.v = { ...V0(), glow: 1.2 }; });
  // 5. low angle: Volga rises out of the bay
  scene(5.6, (t, n) => { stepParts(); const u = clamp(t / 3.2, 0, 1); A.v.x = 250; A.v.y = -110 * (1 - easeOut(u)); A.v.pose = mix(P.swim, KP.roar1, ease(u)); if (u < 1 && n % 2 === 0) splash(250, 176, 6, 2.4); if (t < 3.4) for (let i = 0; i < 2; i++) part({ x: 250 + rnd(-30, 30), y: 176 + A.v.y - rnd(40, 120), vx: rnd(-0.3, 0.3), vy: rnd(0.5, 2), g: 0.12, life: 30, c: [150, 190, 240], sz: 1 });
    const flash = t > 3.3 && t < 3.6; if (t > 3.3 && t < 3.32) { S("thunder"); S("roar", 1.6); }
    m.save(); if (t > 3.3 && t < 4.3) shake(3); stage({ x: 250, y: 120 - ease(u) * 10, z: 1.6, rot: -0.04 }, { seaX: 600, storm: 0.4, actors: [A.v], fg: (c) => { for (let i = 0; i < 5; i++) { c.fillStyle = "rgb(10,8,14)"; c.fillRect(140 + i * 60, 196, 14, 30); c.fillRect(136 + i * 60, 190, 22, 8); } } }); m.restore();
    if (flash) { bolt(330, 0, 300, 150, 3, 2); fade(0.5, [220, 230, 255]); }
    if (t > 0.3 && t < 0.32) S("whoosh"); if (t > 1.0) bang("ザバァァァン!!", 104, 60, 16, [[230, 245, 255], [110, 170, 240]], t - 1.0, { sc: 2.2, rot: -0.1, fade: 1.8 }); letterbox(1); },
    () => { PS.length = 0; A.v = { ...V0(), sea: 1, glow: 1 }; });
  // 6. the eye opens
  scene(2.8, (t) => { halftone(0, 0, W, H, [20, 14, 30], [70, 40, 90], W / 2, H / 2, 1); const eh = Math.round(clamp((t - 0.4) / 0.9, 0, 1) * 5 * 4) / 4;
    panel(16, 14, W - 32, H - 28, (x, y, w2, h) => { halftone(x, y, w2, h, [30, 50, 36], [16, 28, 20], x + w2 * 0.7, y + h / 2, 1); face(L.KC, { jaw: 0.05, eyeH: eh, brow: 0.7 }, W / 2 + 40 - 30, H / 2 + 48, 3); sparkle(W / 2 + 41, H / 2 + 6, 24, (t - 1.3) / 0.5); });
    if (t > 1.3) bang("ギラッ", 90, 50, 16, [[255, 255, 200], [255, 200, 80]], t - 1.3, { sc: 2, rot: -0.15 }); if (t > 1.28 && t < 1.3) S("zap"); });
  // 7. the roar, and the people running
  scene(4.6, (t) => {
    if (t < 3) { const jaw = ease(t / 0.6); halftone(0, 0, W, H, [255, 210, 70], [235, 80, 40], 250, 110, 1.4); speedLines(250, 108, t, 60, 70, 4, [[255, 250, 220], [120, 20, 20]], 0.7); burstShape(104, 64, 64, 14, [255, 250, 230], t * 0.4);
      m.save(); if (t > 0.5) shake(3); face(L.KC, { jaw, eye: "narrow", brow: 1, snarl: 1 }, 250, 118, 2.2); m.restore(); if (t > 0.45) bang("グオオオオ!!", 104, 64, 16, [[255, 255, 255], [255, 220, 120]], t - 0.45, { sc: 2, rot: -0.12, shake: 1.5 }); if (t < 0.02) S("roar", 1.8); }
    else { const u = t - 3; halftone(0, 0, W, H, [255, 240, 220], [240, 150, 150], W / 2, H, 1.2); speedLines(W / 2, -40, u, 40, 60, 5, [[255, 255, 255], [60, 20, 20]], 0.5);
      for (let i = 0; i < 7; i++) { m.save(); m.translate(40 + i * 50 + u * 30 * (i % 2 ? 1 : 0.6), 200); m.scale(3, 3); person(m, 0, 0, u + i * 0.3, { run: 1, up: 1 }); m.restore(); } bang("うわああああ!!", W / 2, 60, 16, [[255, 255, 255], [255, 200, 200]], u, { sc: 1.8, shake: 1.2, shadow: [160, 20, 40] }); if (u < 0.02) S("siren"); }
    if (t > 4.2) fade((t - 4.2) * 2.5, [255, 255, 255]); });
  // 8. title card
  scene(6, (t) => { halftone(0, 0, W, H, [60, 14, 24], [140, 40, 40], W * 0.3, H * 0.75, 1.2); speedLines(96, 120, t, 50, 90, 9, [[255, 170, 80], [20, 6, 8]], 0.35);
    const F = kfr(mix(KP.roar0, KP.roar1, (Math.sin(t * 6) + 1) / 2), L.KC); m.drawImage(F.r, 104 - AX, H + 2 - AY); m.save(); m.globalCompositeOperation = "lighter"; m.globalAlpha = 0.6 + 0.3 * Math.sin(t * 6); m.drawImage(F.gr, 104 - AX, H + 2 - AY); m.restore();
    const k = easeOut(t / 0.5); bang("VOLGA", 268, 52 - (1 - k) * 80, 16, [[255, 236, 120], [255, 120, 40]], t, { sc: 3.2, rot: -0.05, shadow: [90, 10, 10] });
    if (t > 0.35) bang("RAMPAGE", 278, 102, 16, [[255, 250, 230], [255, 180, 90]], t - 0.35, { sc: 2.6, rot: -0.05, shadow: [90, 10, 10] }); if (t > 0.9) bang("怪獣ボルガ　夜の街", 272, 146, 12, [255, 240, 220], t - 0.9, { sc: 1.5, shadow: [60, 10, 10] });
    if (t < 0.02) { S("boom", 2); S("impact"); L.music("march"); } if (t > 0.4 && t < 0.42) S("impact"); if (t < 0.15) fade(1 - t / 0.15, [255, 255, 255]); if (t > 5.6) fade((t - 5.6) * 2.5); });
  // 9. a foot comes down on the street
  scene(3.6, (t, n) => { stepParts(); const u = clamp((t - 0.4) / 0.5, 0, 1); A.v.x = 300; A.v.pose = walk(4 + easeIn(u) * 2);
    if (u >= 1 && !A.hit) { A.hit = 1; CARS[0].dead = 1; dust(330, GY, 14, 1.6); debris(330, GY - 2, 18, [120, 110, 110]); S("pound"); S("crash"); }
    m.save(); if (A.hit && t < 1.6) shake(4 * (1.6 - t)); stage({ x: 324, y: 184, z: 3.2 }, { props: roadProps(CARS, []), actors: [A.v] }); m.restore(); if (A.hit) bang("ズシン!!", 110, 60, 16, [[255, 240, 200], [255, 160, 60]], t - 0.9, { sc: 2.4, rot: -0.08 }); letterbox(1); },
    () => { PS.length = 0; buildCity(80, 900, ["shop", "house", "izakaya", "apart", "shop", "neon"]); CARS = [{ x: 334, img: L.SPR.cars[0], y: 212 }, { x: 380, img: L.SPR.cars[2], y: 207 }]; A = { v: V0(), hit: 0 }; });
  // 10. low angle walk through the shopping street, people fleeing in the foreground
  scene(5.2, (t, n) => { stepParts(); A.v.x = 260 + t * 26; A.v.pose = walk(t * 60 / 2.6); if (n % 26 === 0) { dust(A.v.x + 12, GY, 3, 1); S("step"); }
    stage({ x: A.v.x + 10, y: 128, z: 1.7, rot: 0.035 }, { actors: [A.v], props: roadProps(CARS, A.ppl), fg: (c) => { for (let i = 0; i < 6; i++) { const x = 200 + i * 70 + Tm * 0; c.fillStyle = "rgb(12,10,16)"; c.fillRect(x, 160, 3, 60); c.fillRect(x - 6, 158, 12, 3); } }, fgPar: 1.5 });
    if (t > 0.4) caption("怪獣ボルガ、上陸――", 8, 30, t - 0.4, { speed: 16 }); letterbox(1); },
    () => { CARS = [{ x: 420, img: L.SPR.bus, y: 210 }]; A = { v: V0(), ppl: [0, 1, 2, 3, 4].map(i => ({ x: 330 + i * 12, y: 193, run: 1, up: i % 2 })) }; });
  // 11. claws through a facade
  scene(3.4, (t, n) => { stepParts(); const u = t - 0.5; A.v.x = 300; A.v.pose = u < 0 ? KP.s0 : seqPose([[0, KP.s0], [0.1, KP.s01], [0.15, KP.s1], [0.22, KP.s12], [0.3, KP.s2]], u);
    const b = CITY.find(c => c.x > 310); if (u > 0.15 && !A.hit && b) { A.hit = 1; const cx = b.cx; cx.fillStyle = "rgb(16,12,18)"; for (let i = 0; i < 3; i++) { cx.save(); cx.translate(6 + i * 7, b.h - 100); cx.rotate(0.9); cx.fillRect(0, 0, 40, 3); cx.restore(); } b.lx.clearRect(0, b.h - 110, 40, 50); sparks(b.x + 10, SW - 90, 14); debris(b.x + 8, SW - 90, 20, [170, 200, 230], 3); S("slash"); S("glass"); }
    m.save(); if (A.hit && t < 1.4) shake(3); stage({ x: 322, y: 110, z: 2.6 }, { actors: [A.v] }); m.restore(); if (A.hit) bang("ザシュッ!!", 120, 60, 16, [[255, 255, 230], [255, 200, 120]], u - 0.15, { sc: 2.4, rot: -0.15 }); letterbox(1); },
    () => { PS.length = 0; buildCity(310, 700, ["office", "apart", "office"]); A = { v: V0(), hit: 0 }; });
  // 12. a building goes over: three panels
  scene(5.4, (t, n) => { stepParts(); m.fillStyle = "rgb(250,246,236)"; m.fillRect(0, 0, W, H);
    const b = A.b, frames = [[0.0, "グラッ……", 0, 0.05], [1.4, "ゴゴゴゴ……", 0.32, 0.3], [2.8, "ズドォォン!!", 1.5, 1]];
    frames.forEach(([t0, s2, rot, k], i) => { if (t < t0) return; const u = t - t0, x = 8 + i * 126, pw = 116;
      panel(x, 12, pw, H - 24, (px, py, pw2, ph) => { b.rot = i === 2 ? Math.min(1.5, rot * easeIn(u / 0.5) + 0.5) : rot * (i === 1 ? ease(u / 1.2) : 0); if (i === 2 && u > 0.5 && !A.crash) { A.crash = 1; for (let x2 = b.x + b.w; x2 < b.x + b.w + b.h; x2 += 10) { dust(x2, GY, 2, 1.6); debris(x2, GY - 4, 3); } S("impact"); S("collapse"); }
        if (i === 0 && n % 8 === 0) debris(b.x + b.w, SW - 10, 2); A.v.pose = i === 0 ? KP.s2 : idle(Tm); A.v.x = b.x - 34;
        const img = stage({ x: b.x + b.w / 2 + (i === 2 ? 60 : 10), y: 132, z: i === 0 ? 1.4 : 1.0 }, { actors: [A.v], noDraw: 1 }), sw = H * pw2 / ph; m.drawImage(img, (W - sw) / 2, 0, sw, H, px, py, pw2, ph);
        if (i === 2 && u > 0.5) { m.fillStyle = rgba([255, 240, 200], Math.max(0, 0.6 - (u - 0.5))); m.fillRect(px, py, pw2, ph); } });
      bang(s2, x + 58, H - 40, i === 2 ? 16 : 12, i === 2 ? [[255, 250, 170], [255, 120, 40]] : [[255, 255, 255], [200, 200, 220]], u, { sc: i === 2 ? 1.5 : 1.3, rot: -0.1 }); if (u < 0.02 && i < 2) S("creak"); });
  }, () => { PS.length = 0; buildCity(330, 700, ["office"]); A = { b: CITY[0], v: V0(), crash: 0 }; A.b.rot = 0; });
  // 13. the spines light up, tail to head
  scene(3.2, (t) => { const F = kfr(KB, L.KC), cx = 196, cy = 120, s = 2.5; halftone(0, 0, W, H, [16, 10, 20], [60, 30, 40], cx, cy, 1);
    m.save(); m.translate(cx, cy); m.scale(s, s); m.translate(-(AX - 4), -(AY - 74)); m.drawImage(F.r, 0, 0); m.globalCompositeOperation = "lighter"; m.globalAlpha = 0.3; m.drawImage(F.gr, 0, 0); m.globalAlpha = 1;
    const lit = t * 9; F.tips.forEach((tp, i) => { const on = clamp(lit - (F.tips.length - 1 - i) * 0.5, 0, 1); if (on <= 0) return; const x = AX + tp[0], y = AY + tp[1], v = on * (0.7 + 0.3 * Math.sin(t * 20 + i)); m.fillStyle = rgba([255, 140, 50], 0.6 * v); m.fillRect(x - 3, y - 3, 7, 7); m.fillStyle = rgba([255, 230, 150], v); m.fillRect(x - 1, y - 1, 3, 3); m.fillStyle = rgba([255, 255, 245], v); m.fillRect(x, y, 1, 1); });
    m.restore(); if (t > 0.3) bang("ゴォォォ……", 290, 180, 12, [[255, 230, 170], [255, 120, 40]], t - 0.3, { sc: 1.8, rot: -0.05, shake: 1 }); if (t < 0.02) S("fireStart"); letterbox(1); });
  // 14. fire breath: the mouth, then the skyline
  scene(6.6, (t, n) => { stepParts();
    if (t < 1.7) { halftone(0, 0, W, H, [255, 200, 80], [230, 80, 30], 300, 110, 1.3); speedLines(330, 100, t, 50, 60, 13, [[255, 250, 220], [120, 30, 10]], 0.6); face(L.KC, { jaw: ease(t / 0.4) * 0.95, eye: "narrow", brow: 1, snarl: 1, fire: t > 0.4 ? 1 : 0 }, 190, 112, 2.4, false, 1); if (t > 0.5) bang("ボォッ!!", 300, 60, 16, [[255, 255, 230], [255, 160, 60]], t - 0.5, { sc: 2.4, rot: 0.1 }); }
    else { const u = t - 1.7; A.v.pose = KP.b3; A.v.x = 140; const [mx, my] = mouthOf(A.v); for (let i = 0; i < 5; i++) { const a = 0.32 + Math.sin(u * 1.6) * 0.12 + rnd(-0.06, 0.06), sp = rnd(4.4, 5.6); flame(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, rnd(30, 42) | 0); }
      for (const b of CITY) if (b.x < 140 + u * 90 && b.x > 150) b.burn = Math.min(1, b.burn + 0.02); stage({ x: 260, y: 120, z: 1.05 }, { actors: [A.v], redSky: clamp(u / 3, 0, 1) }); if (u > 0.3) caption("火炎放射が 夜の街を焼く", 8, 30, u - 0.3, { speed: 18 }); letterbox(1); }
    if (t > 1.7 && t < 1.72) S("fireStart"); if (t > 6.4) fade((t - 6.4) * 5); },
    () => { PS.length = 0; buildCity(170, 700, ["office", "neon", "apart", "tower", "office"]); A = { v: V0() }; });
  // 15. the defence force: tanks, a shouting soldier, missiles, and a shrug
  scene(9.4, (t, n) => { stepParts(); A.v.x = 190; A.v.pose = idle(t);
    if (t < 2.6) { for (const tk of A.tanks) if (n % 40 === tk.ph) { tk.flash = 4; sparks(tk.x - 14, 196, 4, [255, 230, 160]); part({ x: tk.x - 14, y: 196, vx: -5, vy: -0.6, life: 30, c: [255, 230, 160], sz: 2, glow: 1 }); S("tank"); } }
    if (t > 2.6 && t < 4.6) { soldierCard(t - 2.6); return; }
    if (t > 4.6 && t < 6.4) { const u = t - 4.6; if (n % 6 === 0) { part({ x: 330, y: 150 + rnd(-20, 20), vx: -6, vy: rnd(-0.5, 0.5), life: 30, c: [255, 220, 150], sz: 2, glow: 1 }); S("missile"); } if (n % 5 === 0) { const hx = A.v.x + rnd(-10, 20), hy = GY - rnd(30, 120); sparks(hx, hy, 8, [255, 200, 110], 3); dust(hx, hy, 3, 1.2); S("boom", 0.6); } }
    stage({ x: 250, y: 140, z: 1.45 }, { actors: [A.v], props: (w2) => { for (const tk of A.tanks) { w2.drawImage(L.SPR.tank[(n >> 3) % 2], tk.x - 15, 196); if (tk.flash > 0) { tk.flash--; e.fillStyle = "rgb(255,240,180)"; e.fillRect(tk.x - 20, 197, 5, 3); } } for (const hl of A.helis) { hl.x -= 0.4; w2.drawImage(L.SPR.heli[(n >> 1) % 3], hl.x - 17, hl.y - 8); e.fillStyle = "rgba(220,230,255,0.08)"; e.beginPath(); e.moveTo(hl.x, hl.y + 6); e.lineTo(A.v.x - 20, GY); e.lineTo(A.v.x + 30, GY); e.fill(); } } });
    if (t < 2.6) caption("防衛軍、出動!!", 8, 30, t, { speed: 14 });
    if (t > 6.4) { const u = t - 6.4; for (let i = 0; i < 2; i++) dust(A.v.x + rnd(-30, 30), GY - rnd(20, 120), 1, 1.6); if (u > 0.8) { panel(W - 150, 70, 136, 84, (x, y, w2, h) => { halftone(x, y, w2, h, [255, 240, 200], [230, 170, 120], x + w2, y, 1); face(L.KC, { jaw: 0.1, eye: "narrow", brow: 0.5, snarl: 0.5 }, x + 70, y + 48, 1.05); }); bubble("…フン", W - 160, 62, W - 130, 80, u - 1.1); } }
    letterbox(1); },
    () => { PS.length = 0; buildCity(60, 700, ["office", "apart", "office"]); A = { v: V0(), tanks: [0, 1, 2].map(i => ({ x: 290 + i * 34, ph: i * 13, flash: 0 })), helis: [{ x: 300, y: 96 }, { x: 340, y: 84 }] }; });
  function soldierCard(u) { halftone(0, 0, W, H, [240, 230, 180], [160, 150, 90], W / 2, H / 2, 1.1); speedLines(W / 2, H / 2 + 20, u, 50, 60, 17, [[255, 255, 255], [60, 50, 20]], 0.6);
    panel(60, 16, W - 120, H - 32, (x, y, w2, h) => { halftone(x, y, w2, h, [200, 210, 170], [120, 130, 90], x + w2 / 2, y + h, 1); m.save(); shake(1); soldierFace(W / 2, H / 2 + 4, 4.4, u); m.restore(); }, { tilt: -0.03 });
    bubble("撃てーっ!!", 90, 36, 140, 70, u, { px: 16 }); if (u < 0.02) S("siren"); }
  // 16. tail sweep through the helicopters
  scene(4.4, (t, n) => { stepParts(); const tk = Math.min(60, t * 60 * 0.9), turn = tk < 10 ? 1 : tk < 15 ? 1 - (tk - 10) / 5 * 2 : tk < 42 ? -1 : tk < 48 ? -1 + (tk - 42) / 6 * 2 : 1;
    A.v.x = 220; A.v.pose = L.KD.poseOf(L.KD.seq(L.ACT.tail.frames, tk)); A.v.sq = Math.max(0.12, Math.abs(turn)); A.v.dir = turn < 0 ? -1 : 1;
    if (tk > 22 && !A.hit) { A.hit = 1; for (const h of A.helis) { h.fly = 1; h.vx = rnd(2, 4); h.vy = rnd(-3, -1); } S("sweep"); S("crash"); }
    for (const h of A.helis) if (h.fly) { h.x += h.vx; h.y += h.vy; h.vy += 0.08; h.r = (h.r || 0) + 0.2; if (n % 4 === 0) sparks(h.x, h.y, 3, [255, 180, 80]); if (h.y > GY - 10 && !h.boom) { h.boom = 1; dust(h.x, GY, 8, 1.4); sparks(h.x, GY - 6, 16); S("boom", 1); } }
    stage({ x: 230, y: 118, z: 1.25 }, { actors: [A.v], props: (w2) => { for (const h of A.helis) { if (h.boom) continue; w2.save(); w2.translate(h.x, h.y); w2.rotate(h.r || 0); w2.drawImage(L.SPR.heli[(n >> 1) % 3], -17, -8); w2.restore(); } } });
    if (A.hit) bang("バシィィッ!!", 270, 60, 16, [[255, 255, 230], [255, 170, 70]], t - 0.42, { sc: 2.2, rot: 0.1, fade: 2 }); letterbox(1); if (t > 4.1) fade((t - 4.1) * 3.4); },
    () => { PS.length = 0; buildCity(60, 600, ["office", "apart"]); A = { v: V0(), hit: 0, helis: [{ x: 260, y: 120 }, { x: 290, y: 96 }, { x: 250, y: 84 }] }; });
  // 17. lightning, and a silhouette on the rooftops
  scene(4.6, (t, n) => { stepParts(); const fl = [0.8, 2.2, 3.4].some(f => t > f && t < f + 0.12); if ([0.8, 2.2, 3.4].some(f => t > f && t < f + 1 / FPS)) S("thunder"); A.j.x = 300; A.j.pose = idle(t); A.j.sil = !fl && t < 3.4; A.j.glow = A.j.sil ? 0.9 : 1;
    stage({ x: 260, y: 118, z: 1.3 }, { storm: 1, actors: [A.j], grade: fl ? [255, 255, 255] : [110, 110, 170] });
    if (fl) { bolt(280 + hash(n) * 60, 0, 300, 120, n, 3); fade(0.35, [200, 220, 255]); } if (t > 0.3) bang("ゴロゴロ……", 100, 40, 12, [[220, 230, 255], [120, 130, 220]], t - 0.3, { sc: 1.6, rot: -0.05 }); if (t > 3.4) caption("雷鳴とともに――", 8, 30, t - 3.4, { speed: 14 }); letterbox(1); },
    () => { PS.length = 0; buildCity(150, 700, ["neon", "office", "tower"]); A = { j: J0() }; L.A.fast = true; });
  // 18. Jinrai close-up, crackling
  scene(3.2, (t, n) => { halftone(0, 0, W, H, [20, 30, 70], [70, 110, 220], 100, 100, 1.2); speedLines(140, 100, t, 50, 60, 19, [[180, 230, 255], [10, 20, 60]], 0.6);
    face(L.JC, { jaw: ease(t / 0.8) * 0.7, eye: "glow", brow: 1, snarl: 1 }, 220, 116, 2.3, true, 1); for (let i = 0; i < 3; i++) if ((n + i * 5) % 9 < 4) { m.setTransform(1, 0, 0, 1, 0, 0); e.setTransform(1, 0, 0, 1, 0, 0); m.strokeStyle = "rgb(200,240,255)"; m.lineWidth = 2; m.beginPath(); let x = 250 + i * 20, y = 30; m.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-10, 10); y += rnd(6, 14); m.lineTo(x, y); } m.stroke(); }
    if (t > 0.6) caption("雷獣 ジンライ", 14, H - 28, t - 0.6, { speed: 12, bg: [190, 230, 255] }); if (t > 0.3 && t < 0.32) S("roar", 1.2); if (n % 12 === 0) S("zap"); });
  // 19. VS
  scene(4.2, (t) => {
    const s = easeOut(t / 0.35); m.save(); m.beginPath(); m.moveTo(0, 0); m.lineTo(W / 2 + 40, 0); m.lineTo(W / 2 - 40, H); m.lineTo(0, H); m.clip(); m.translate(-(1 - s) * 200, 0);
    halftone(0, 0, W, H, [255, 180, 60], [220, 70, 30], 0, H, 1.2); face(L.KC, { jaw: 0.35, eye: "narrow", brow: 1, snarl: 1 }, 110, 112, 1.7); m.restore();
    m.save(); m.beginPath(); m.moveTo(W / 2 + 40, 0); m.lineTo(W, 0); m.lineTo(W, H); m.lineTo(W / 2 - 40, H); m.clip(); m.translate((1 - s) * 200, 0);
    halftone(0, 0, W, H, [90, 170, 255], [30, 60, 160], W, 0, 1.2); face(L.JC, { jaw: 0.35, eye: "narrow", brow: 1, snarl: 1 }, 276, 104, 1.7, true); m.restore();
    m.fillStyle = "rgb(12,8,14)"; m.beginPath(); m.moveTo(W / 2 + 36, 0); m.lineTo(W / 2 + 44, 0); m.lineTo(W / 2 - 36, H); m.lineTo(W / 2 - 44, H); m.fill();
    if (t > 0.35) { burstShape(W / 2, H / 2, 44, 12, [255, 250, 200], t); bang("VS", W / 2, H / 2, 16, [[255, 80, 60], [200, 20, 20]], t - 0.35, { sc: 3, rot: -0.1 }); }
    if (t > 0.6) caption("溶岩怪獣 ボルガ", 10, H - 26, t - 0.6, { bg: [255, 220, 120] }); if (t > 0.9) caption("雷獣 ジンライ", W - 106, 10, t - 0.9, { bg: [190, 230, 255] });
    if (t > 0.35 && t < 0.37) { S("thunder"); S("impact"); } if (t > 3.9) fade((t - 3.9) * 3.4, [255, 255, 255]); });

  // 20. the bout. Each shot is its own camera on the same two actors.
  let X0 = 300;
  const bout = (d, fn, init) => scene(d, (t, n) => { stepParts(); const Va = A.v, Ja = A.j; Va.flash = Ja.flash = 0; Va.rot = Ja.rot = 0; Va.y = Ja.y = 0; Va.px = Va.py = Ja.px = Ja.py = 0; Va.sq = Ja.sq = 1; Va.dir = 1; Ja.dir = -1; Va.noShadow = Ja.noShadow = false; fn(t, n, Va, Ja); }, init);
  const stageB = (C, o = {}) => stage(C, { actors: [A.v, A.j], ...o });
  const hitFx = (x, y, big) => { sparks(x, y, big ? 24 : 12, [255, 230, 160], big ? 4 : 3); dust(x, GY, big ? 10 : 4, big ? 1.6 : 1); if (big) { S("impact"); S("boom", 1.5); } else S("crash"); };
  bout(3.2, (t, n, Va, Ja) => { Va.x = X0 - 80; Ja.x = X0 + 80; Va.pose = idle(t); Ja.pose = idle(t + 1); stageB({ x: X0, y: 124, z: 1.12 + t * 0.03 }); if (t > 0.6) bang("ゴゴゴゴ……", 300, 176, 12, [[255, 230, 200], [200, 120, 220]], t - 0.6, { sc: 1.6, rot: 0.08, shake: 1 }); letterbox(1); },
    () => { PS.length = 0; buildCity(60, 700, ["office", "neon", "apart", "tower", "office", "neon"]); CITY.forEach(b => { if (Math.abs(b.x + b.w / 2 - X0) < 90) b.gone = 1; }); A = { v: V0(), j: J0() }; });
  bout(2.2, (t, n) => { m.fillStyle = "rgb(12,8,14)"; m.fillRect(0, 0, W, H); // eye strips
    panel(6, 14, W - 12, 88, (x, y, w2, h) => { halftone(x, y, w2, h, [255, 200, 90], [220, 80, 30], x + w2, y + h / 2, 1.2); face(L.KC, { jaw: 0.05, eye: "narrow", brow: 1, snarl: 0.6 }, x + w2 / 2 - 32, y + h / 2 + 45, 3.2); });
    panel(6, 114, W - 12, 88, (x, y, w2, h) => { halftone(x, y, w2, h, [120, 190, 255], [30, 70, 170], x, y + h / 2, 1.2); face(L.JC, { jaw: 0.05, eye: "narrow", brow: 1, snarl: 0.6 }, x + w2 / 2 + 32, y + h / 2 + 45, 3.2, true); }); if (t < 0.02) S("zap"); });
  bout(1.4, (t, n, Va, Ja) => { const ph = t * 20; Va.x = X0 - 80 + t * 30; Va.pose = dash(ph); if (n % 4 === 0) dust(Va.x - 20, GY, 2, 1); stage({ x: Va.x + 6, y: 190, z: 3 }, { actors: [Va] }); hLinesM(t); if (n % 10 === 0) S("step"); });
  bout(1.6, (t, n, Va, Ja) => { const u = clamp(t / 0.7, 0, 1); Va.x = X0 - 70 + easeIn(u) * 36; Ja.x = X0 + 70 - easeIn(u) * 36; Va.pose = dash(t * 20); Ja.pose = dash(t * 20 + 4); if (u >= 1) { Va.pose = P.grap2; Ja.pose = P.grap2; if (!A.hit) { A.hit = 1; hitFx(X0, GY - 60, true); } }
    m.save(); if (A.hit) shake(4); stageB({ x: X0, y: 126, z: 1.2 }); m.restore(); if (A.hit) { speedLines(W / 2, H / 2 - 10, t, 40, 50, 23, [[255, 255, 255], [20, 10, 14]], 0.5); bang("ドガァァン!!", W / 2, 46, 16, [[255, 250, 170], [255, 140, 40]], t - 0.7, { sc: 2.4, rot: -0.08 }); } letterbox(1); });
  bout(3.8, (t, n, Va, Ja) => { A.hit = 0; const push = Math.sin(t * 2.3) * 9 + Math.sin(t * 5.1) * 2; Va.x = X0 - 34 + push; Ja.x = X0 + 34 + push; Va.pose = mix(P.grap, P.grap2, (Math.sin(t * 4) + 1) / 2); Ja.pose = mix(P.grap2, P.grap, (Math.sin(t * 4) + 1) / 2); if (n % 6 === 0) { dust(Va.x - 18, GY, 1, 1); dust(Ja.x + 18, GY, 1, 1); }
    m.save(); shake(1); stageB({ x: X0 + push, y: 132, z: 1.9 }); m.restore(); if (t > 0.8) caption("がっぷり 四つ!!", 8, 30, t - 0.8, { speed: 14 }); letterbox(1); if (n % 30 === 0) S("step"); });
  bout(2.0, (t, n, Va, Ja) => { const push = Math.sin(t * 2.3) * 3; Va.x = X0 - 34 + push; Ja.x = X0 + 34 + push; Va.pose = P.grap2; Ja.pose = P.grap2; const hx = X0 + push, hy = GY - 78;
    m.save(); shake(1.5); stageB({ x: hx + 4, y: hy + 4, z: 3.6 }); m.restore(); bang("ギリギリ……", 280, 180, 12, [[255, 255, 240], [230, 200, 170]], t, { sc: 1.6, shake: 1 }); letterbox(1); });
  bout(2.6, (t, n) => { m.fillStyle = "rgb(250,246,236)"; m.fillRect(0, 0, W, H); panel(10, 20, W - 20, H - 40, (x, y, w2, h) => { halftone(x, y, w2, h, [255, 240, 220], [220, 170, 140], x + w2 / 2, y + h / 2, 1); face(L.KC, { jaw: 0.04, eye: "closed", brow: 1, snarl: 1 }, x + 96, y + 92, 1.55); face(L.JC, { jaw: 0.04, eye: "narrow", brow: 1, snarl: 1 }, x + w2 - 96, y + 92, 1.55, true); sweat(x + 178, y + 40, 2, t); sweat(x + w2 - 170, y + 46, 2, t + 0.3); vein(x + 50, y + 30, 1.6, t); });
    if (t > 0.3) bubble("ぐぬぬぬ……!!", W / 2, 34, W / 2 - 40, 60, t - 0.3, { px: 16 }); });
  bout(3.2, (t, n, Va, Ja) => { const lp = t < 1.1 ? t : t - 1.1; Ja.pose = seqPose(PUNCH, lp); Ja.x = X0 + 30; const hits = [0.27, 1.37], hurt = hits.some(h => t > h && t < h + 0.3); Va.x = X0 - 30 - (t > 0.27 ? 10 : 0) - (t > 1.37 ? 10 : 0); Va.pose = hurt ? KP.hurt : idle(t); Va.flash = hurt && n % 4 < 2;
    hits.forEach(h => { if (t >= h && t - h < 1 / FPS) hitFx(Va.x + 14, GY - 80, false); });
    m.save(); if (hurt) shake(3); stageB({ x: X0, y: 116, z: 1.7 }); m.restore(); if (t > 0.27 && t < 1) bang("ドゴッ!", 130, 64, 16, [[255, 255, 200], [255, 160, 60]], t - 0.27, { sc: 2, rot: 0.12 }); if (t > 1.37) bang("バキィッ!", 140, 60, 16, [[255, 255, 200], [255, 160, 60]], t - 1.37, { sc: 2.2, rot: -0.1 }); letterbox(1); });
  bout(1.8, (t) => { halftone(0, 0, W, H, [255, 230, 230], [230, 140, 160], 0, 0, 1.2); speedLines(W * 0.45, H * 0.5, t, 40, 60, 29, [[255, 255, 255], [80, 20, 30]], 0.5); m.save(); m.translate(Math.round(-t * 20), 0); face(L.KC, { jaw: 0.6, eye: "closed", brow: -0.6 }, 200, 120, 2); m.restore(); for (let i = 0; i < 4; i++) { m.fillStyle = "rgb(240,250,255)"; m.fillRect(Math.round(300 + i * 9 + t * 40), Math.round(100 + i * 5 - t * 20 + t * t * 60), 3, 3); } bubble("ぐはっ!?", 90, 50, 140, 80, t - 0.1, { px: 16 }); });
  bout(1.6, (t) => { m.fillStyle = "rgb(12,8,14)"; m.fillRect(0, 0, W, H); halftone(0, 0, W, H, [140, 20, 20], [255, 80, 40], W * 0.65, H / 2, 1.3); speedLines(W * 0.65, H * 0.45, t, 50, 60, 11, [[255, 220, 180], [40, 6, 6]], 0.6); face(L.KC, { jaw: 0.22, eye: "narrow", brow: 1, snarl: 1 }, W * 0.6, H * 0.55, 2.1); vein(W * 0.6 - 70, H * 0.55 - 70, 2.2, t); bubble("ゆるさん……!!", 96, 60, 140, 86, t - 0.2, { px: 16 }); if (t < 0.02) S("roar", 1.1); });
  bout(3.4, (t, n, Va, Ja) => { const tk = Math.min(60, t * 60 * 0.9), turn = tk < 10 ? 1 : tk < 15 ? 1 - (tk - 10) / 5 * 2 : tk < 42 ? -1 : tk < 48 ? -1 + (tk - 42) / 6 * 2 : 1; Va.x = X0 - 50; Ja.x = X0 + 30; Ja.pose = idle(t); Va.pose = L.KD.poseOf(L.KD.seq(L.ACT.tail.frames, tk)); Va.sq = Math.max(0.12, Math.abs(turn)); Va.dir = turn < 0 ? -1 : 1;
    if (tk >= 26) { const v = clamp((tk - 26) / 26, 0, 1); Ja.pose = P.flat; Ja.rot = easeIn(v) * 1.45; Ja.x = X0 + 30 + v * 26; if (!A.sw) { A.sw = 1; hitFx(Ja.x - 10, GY - 50, false); S("sweep"); } if (v >= 1 && !A.land) { A.land = 1; hitFx(Ja.x + 50, GY - 4, true); } }
    m.save(); if (A.land) shake(4); stageB({ x: X0, y: 120, z: 1.25 }); m.restore(); if (t > 0.5 && t < 1.3) bang("ブンッ!!", 120, 70, 16, [[255, 255, 230], [180, 230, 255]], t - 0.5, { sc: 2, rot: -0.15 }); if (A.land) bang("ズシィィン!!", 270, 60, 16, [[255, 236, 170], [255, 150, 60]], t - 1.4, { sc: 2.2, rot: 0.08, fade: 1.2 }); letterbox(1); });
  bout(2.2, (t, n, Va, Ja) => { A.sw = A.land = 0; const u = t / 2.2; Va.x = X0 - 50; Ja.x = X0 + 56 - ease(u) * 6; Va.pose = idle(t); Ja.pose = u < 0.6 ? KP.kneel : mix(KP.kneel, KB, (u - 0.6) / 0.4); Ja.rot = (1 - ease(u / 0.5)) * 1.45; stageB({ x: X0 + 10, y: 124, z: 1.3 }); letterbox(1); });
  bout(4.6, (t, n, Va, Ja) => { Va.x = X0 - 60; Ja.x = X0 + 50; Ja.pose = t < 1 ? mix(KB, P.charge, t) : KP.b2; Va.pose = t < 1 ? idle(t) : KP.b2; if (t < 1 && n % 3 === 0) sparks(Ja.x - 6, GY - 92, 3, [150, 230, 255], 2); if (t < 0.02) S("charge");
    let cx = 0, cy = GY - 70, beam = null; if (t >= 1) { const fl = t < 3.6 ? Math.sin(t * 3) * 14 : -14 + (t - 3.6) * 170; cx = X0 - 4 + clamp(fl, -20, 120); Va.F = kfr(Va.pose, Va.pal); Ja.F = kfr(Ja.pose, Ja.pal); const [mx, my] = mouthOf(Va), [jx, jy] = mouthOf(Ja); cy = (my + jy) / 2; for (let i = 0; i < 4; i++) { const a = Math.atan2(cy - my, cx - mx) + rnd(-0.06, 0.06), sp = rnd(4.4, 5.4); flame(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, Math.max(6, Math.round(Math.hypot(cx - mx, cy - my) / sp * 1.1))); } if (n % 2 === 0) sparks(cx, cy, 5, n % 4 ? [200, 240, 255] : [255, 200, 120], 3); beam = [jx, jy]; if (t - 1 < 1 / FPS) S("hbeam"); if (cx > Ja.x - 20) { beam = null; Ja.pose = KP.hurt; Ja.flash = n % 4 < 2; if (!A.burnt) { A.burnt = 1; hitFx(Ja.x, GY - 70, true); } } }
    m.save(); if (t > 1) shake(1.5); stageB({ x: X0, y: 122, z: 1.15 }, { front: beam ? () => { e.save(); e.globalCompositeOperation = "lighter"; for (const [lw, c] of [[9, [60, 140, 255]], [5, [150, 220, 255]], [2, [255, 255, 255]]]) { e.strokeStyle = rgba(c, 0.9); e.lineWidth = lw; e.beginPath(); e.moveTo(beam[0], beam[1]); for (let i = 1; i <= 8; i++) { const u2 = i / 8; e.lineTo(lerp(beam[0], cx, u2) + (i < 8 ? rnd(-2, 2) : 0), lerp(beam[1], cy, u2) + (i < 8 ? rnd(-3, 3) : 0)); } e.stroke(); } const r = 10 + Math.sin(n * 0.9) * 3; e.fillStyle = "rgba(255,240,200,0.9)"; e.beginPath(); e.arc(cx, cy, r, 0, PI * 2); e.fill(); e.restore(); } : null }); m.restore();
    if (t > 1.6 && t < 3.4) { const u = t - 1.6; panel(8, 28, 150, 52, (x, y, w2, h) => { halftone(x, y, w2, h, [255, 220, 120], [230, 90, 40], x + w2, y + h / 2, 1); face(L.KC, { jaw: 0.95, eye: "narrow", brow: 1, snarl: 1, fire: 1 }, x + 74, y + 34, 0.8); }); panel(W - 158, 28, 150, 52, (x, y, w2, h) => { halftone(x, y, w2, h, [170, 220, 255], [40, 90, 200], x, y + h / 2, 1); face(L.JC, { jaw: 0.95, eye: "glow", brow: 1, snarl: 1 }, x + 76, y + 34, 0.8, true); }); bang("ズガガガガ!!", W / 2, 100, 12, [[255, 255, 255], [180, 230, 255]], u, { sc: 1.8, shake: 1.5 }); }
    if (A.burnt) bang("ドカァン!!", 300, 60, 16, [[255, 250, 170], [255, 140, 40]], t - 3.7, { sc: 2, rot: 0.1 }); letterbox(1); });
  // the vertical suplex: grab, lift (low angle, slow), and slam
  const SUP = [[0, 32, 0, 0], [0.45, 6, 70, -3.05], [1, -76, 30, -4.5]];
  bout(1.4, (t, n, Va, Ja) => { A.burnt = 0; const k = ease(t / 1.2); Va.x = X0 - 10 + k * 20; Ja.x = X0 + 66 - k * 24; Ja.pose = KP.hurt; Va.pose = mix(KB, P.grap, k); if (t > 1.0 && t < 1.02) S("grab"); stageB({ x: X0 + 20, y: 120, z: 1.6 }); if (t > 0.9) bang("ガシッ!", 300, 60, 16, [[255, 255, 230], [255, 200, 120]], t - 0.9, { sc: 2, rot: 0.1 }); letterbox(1); });
  bout(3.4, (t, n, Va, Ja) => { const k = clamp(t / 3.4, 0, 1), kk = k < 0.4 ? ease(k / 0.4) * 0.45 : 0.45 + easeIn((k - 0.4) / 0.6) * 0.0; Va.x = X0 + 10; Va.pose = mix(P.grap, P.lift, kk / 0.45); Ja.py = -50; const a = SUP[0], b = SUP[1], v = kk / 0.45; Ja.x = X0 + 10 + lerp(a[1], b[1], v); Ja.y = lerp(a[2], b[2], v); Ja.rot = lerp(a[3], b[3], v); Ja.pose = P.flat; Ja.noShadow = Ja.y > 30;
    stageB({ x: X0 + 14, y: 98 + t * 2, z: 1.15, rot: -0.05 }, { fg: (c) => { c.fillStyle = "rgb(10,8,14)"; for (let i = 0; i < 4; i++) c.fillRect(X0 - 120 + i * 80, 196, 8, 40); } }); speedLines(W / 2, H * 0.3, t, 30, 90, 37, [[255, 255, 255], [30, 10, 20]], 0.3);
    if (t > 0.6) bang("持ち上げたァ!!", 120, 186, 12, [[255, 255, 240], [255, 210, 120]], t - 0.6, { sc: 1.8, rot: -0.06 }); if (t < 0.02) S("whoosh"); letterbox(1); });
  bout(3.0, (t, n, Va, Ja) => { const k = clamp(t / 0.55, 0, 1), kk = 0.45 + easeIn(k) * 0.55, v = (kk - 0.45) / 0.55; Va.x = X0 + 10; Va.pose = mix(P.lift, P.bridge, v); Va.rot = -ease(v) * 0.55; Ja.py = -50; const a = SUP[1], b = SUP[2]; Ja.x = X0 + 10 + lerp(a[1], b[1], v); Ja.y = lerp(a[2], b[2], v); Ja.rot = lerp(a[3], b[3], v); Ja.pose = P.flat; Ja.noShadow = Ja.y > 30;
    if (k >= 1) { Ja.x = X0 - 66; Ja.y = 0; Ja.rot = -4.71; Ja.py = -20; if (!A.slam) { A.slam = 1; hitFx(Ja.x - 30, GY - 10, true); for (let i = 0; i < 4; i++) dust(Ja.x - 60 + i * 30, GY, 6, 2); const bb = CITY.filter(b2 => !b2.gone && b2.x < X0 - 100 && b2.x > X0 - 260); if (bb.length) { const b2 = bb[bb.length - 1]; b2.sinkV = 1; } S("collapse"); } }
    for (const b2 of CITY) if (b2.sinkV) { b2.sink = (b2.sink || 0) + b2.sinkV; b2.sinkV = Math.min(3, b2.sinkV + 0.08); if (n % 3 === 0) dust(b2.x + rnd(0, b2.w), GY, 2, 1.6); if (b2.sink > b2.h) { b2.gone = 1; b2.sinkV = 0; } }
    m.save(); if (A.slam) shake(Math.max(0, 6 - (t - 0.55) * 4)); stageB({ x: X0 - 30, y: 124, z: 1.2 }); m.restore(); if (A.slam && t < 1.4) { speedLines(W / 2 - 60, H * 0.7, t, 50, 40, 41, [[255, 255, 255], [20, 10, 14]], 0.6); fade(Math.max(0, 0.7 - (t - 0.55) * 2), [255, 250, 230]); }
    if (A.slam) bang("ズドドドーン!!!", W / 2 + 30, 54, 16, [[255, 250, 170], [255, 120, 40]], t - 0.55, { sc: 2.6, rot: -0.08, shake: t < 1.2 ? 2 : 0 }); letterbox(1); });
  bout(2.6, (t, n, Va, Ja) => { A.slam = 0; Ja.x = X0 - 66; Ja.rot = -4.71; Ja.py = -20; Ja.pose = P.flat; Va.dir = -1; const k = clamp((t - 0.3) / 1.3, 0, 1); Va.x = lerp(X0 + 10, X0 - 62, k); Va.y = Math.sin(k * PI) * 90; Va.pose = t < 0.3 ? mix(KB, KP.pound, t / 0.3) : k < 1 ? KP.jump : KP.pound; if (t > 0.3 && t < 0.32) S("jump");
    if (k >= 1 && !A.pr) { A.pr = 1; hitFx(Va.x, GY - 6, true); for (let i = 0; i < 4; i++) dust(Va.x - 60 + i * 40, GY, 5, 2); S("pound"); } if (A.pr) Ja.flash = n % 4 < 2;
    m.save(); if (A.pr) shake(Math.max(0, 6 - (t - 1.6) * 6)); const C = k < 1 ? { x: X0 - 30, y: 80 + (1 - Math.sin(k * PI)) * 40, z: 1.15 } : { x: X0 - 50, y: 124, z: 1.3 }; stageB(C); m.restore(); if (A.pr) bang("グシャァッ!!", W / 2, 50, 16, [[255, 250, 170], [255, 120, 50]], t - 1.6, { sc: 2.3, rot: -0.1 }); letterbox(1); });
  bout(4.2, (t, n, Va, Ja) => { A.pr = 0; Ja.x = X0 - 66; Ja.rot = -4.71; Ja.py = -20; Ja.pose = P.flat; Va.x = X0 - 30; Va.pose = t < 0.4 ? mix(KP.pound, KP.roar1, t / 0.4) : mix(KP.roar0, KP.roar1, (Math.sin(t * 7) + 1) / 2); if (n % 9 === 0 && t < 3) { sparks(Ja.x - 40 + rnd(-30, 30), GY - rnd(6, 30), 10, [150, 230, 255], 3); S("boom", 0.8); } if (t > 0.4 && t < 0.42) S("roar", 1.5);
    stageB({ x: X0 - 20, y: 110, z: 1.5, rot: 0.03 }); burstShape(W / 2 + 60, 54, 50, 14, [255, 236, 90], t * 0.5); bang("K.O.!!", W / 2 + 60, 54, 16, [[255, 80, 60], [190, 20, 20]], t, { sc: 3, rot: -0.08 }); if (t < 0.02) S("tier", 5); letterbox(1); if (t > 3.8) fade((t - 3.8) * 2.5); });
  // 21. transformation
  scene(10, (t, n) => { stepParts();
    if (t < 3) { const u = t; A.v.x = 200; A.v.pose = mix(KB, KP.kneel, ease(u / 0.6)); A.v.glow = 0.8 + u * 0.4; if (n % 2 === 0) { const a = rnd(0, PI * 2), r = rnd(60, 120); part({ x: 200 + Math.cos(a) * r, y: GY - 50 + Math.sin(a) * r * 0.6, vx: -Math.cos(a) * r / 30, vy: -Math.sin(a) * r * 0.6 / 30, life: 30, c: [255, 190, 90], sz: 2, glow: 1 }); } if (n % 10 === 0) debris(200 + rnd(-80, 80), GY, 3, [90, 70, 60], 2.4);
      m.save(); shake(u * 1.2); stage({ x: 210, y: 130, z: 1.4 }, { actors: [A.v], redSky: u / 3 }); m.restore(); if (u > 0.5) caption("ボルガの 体の奥で 何かが燃え上がる――", 8, 30, u - 0.5, { speed: 18 }); if (u < 0.02) S("novaCharge"); }
    else if (t < 5.6) { const u = t - 3; halftone(0, 0, W, H, [40, 8, 8], [200, 40, 20], W / 2, H / 2, 1.1); speedLines(W * 0.55, H * 0.45, u, 70, 40, 21, [[255, 230, 180], [30, 4, 4]], 0.7);
      panel(14, 30, W - 28, H - 60, (x, y, w2, h) => { halftone(x, y, w2, h, [60, 20, 18], [120, 40, 30], x + w2 / 2, y + h / 2, 1); const k = clamp(u / 1.2, 0, 1); face(L.KC, { jaw: 0.25, eye: "narrow", brow: 1, snarl: 1 }, W / 2 - 16, H / 2 + 40, 2.6, false, 1); m.save(); m.globalAlpha = k; face(L.SC, { jaw: 0.25, eye: k > 0.8 ? "glow" : "narrow", brow: 1, snarl: 1 }, W / 2 - 16, H / 2 + 40, 2.6, false, 1); m.restore(); }, { tilt: 0.02 });
      if (u > 1.2) bang("カッ!!", W * 0.25, H * 0.3, 16, [[255, 255, 255], [255, 200, 120]], u - 1.2, { sc: 2.6, rot: -0.15 }); if (u > 1.6) bang("覚醒", W * 0.78, H * 0.8, 16, [[255, 240, 150], [255, 120, 40]], u - 1.6, { sc: 2.2, rot: 0.08 }); if (u > 1.2 && u < 1.22) S("zap"); }
    else { const u = t - 5.6; if (u < 0.02) { S("nova"); S("roar", 1.6); for (let i = 0; i < 40; i++) sparks(200, GY - 60, 2, [255, 200, 120], 5); } A.v.pal = L.SC; A.v.aura = 1; A.v.glow = 1.2; A.v.x = 200; A.v.pose = mix(KP.roar0, KP.roar1, (Math.sin(u * 7) + 1) / 2); if (n % 2 === 0) part({ x: 200 + rnd(-40, 40), y: GY - rnd(10, 120), vx: rnd(-0.3, 0.3), vy: rnd(-1.8, -0.6), life: 34, c: [255, 170, 70], sz: 1, glow: 1 });
      stage({ x: 200, y: 96, z: 1.8, rot: -0.04 }, { actors: [A.v], redSky: 1, grade: [190, 150, 180] }); if (u < 0.5) fade(1 - u * 2, [255, 255, 255]); bang("超ボルガ!!", 296, 176, 16, [[255, 240, 170], [255, 110, 40]], u - 0.3, { sc: 2.2, rot: -0.06 }); }
    letterbox(1); }, () => { PS.length = 0; buildCity(60, 600, ["office", "apart", "neon", "office"]); A = { v: V0() }; L.A.fast = false; });
  // 22. blue fire across the skyline, then the Magma Nova
  scene(6.8, (t, n) => { stepParts();
    if (t < 3.6) { A.v.pose = KP.b2; A.v.x = 120; A.v.pal = L.SC; A.v.aura = 1; const [mx, my] = mouthOf(A.v); for (let i = 0; i < 6; i++) { const a = 0.22 + Math.sin(t * 1.4) * 0.12 + rnd(-0.08, 0.08), sp = rnd(5.5, 7); flame(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, rnd(34, 48) | 0, true); } for (const b of CITY) if (b.x < 120 + t * 130 && b.x > 130) b.burn = Math.min(1, b.burn + 0.03);
      stage({ x: 250, y: 118, z: 1.05 }, { actors: [A.v], redSky: 1 }); if (t > 0.3) caption("青白い火炎が 夜空を焦がす", 8, 30, t - 0.3, { speed: 18 }); if (t < 0.02) S("fireStart"); }
    else { const u = t - 3.6; A.v.x = 200; A.v.pose = KP.nova1; stage({ x: 200, y: 120, z: 1.2 }, { actors: [A.v], redSky: 1 }); m.save(); m.globalCompositeOperation = "lighter"; for (let i = 0; i < 3; i++) { const r = (u - i * 0.15) * 340; if (r <= 0) continue; m.strokeStyle = rgba([255, 230, 180], Math.max(0, 1 - u / 2)); m.lineWidth = 6 - i * 2; m.beginPath(); m.ellipse(W / 2, H * 0.6, r, r * 0.55, 0, 0, PI * 2); m.stroke(); } m.restore(); fade(clamp(1 - Math.abs(u - 0.6) * 2, 0, 1), [255, 250, 230]); if (u < 0.02) { S("nova"); S("boom", 3); } bang("マグマノヴァ!!", W / 2, 60, 16, [[255, 250, 200], [255, 120, 40]], u - 0.4, { sc: 2.4, rot: -0.06, shake: 1.5 }); }
    letterbox(1); }, () => { PS.length = 0; buildCity(130, 700, ["office", "tower", "neon", "apart", "tower"]); A = { v: { ...V0(), pal: L.SC } }; });
  // 23. what the game looks like: live footage in comic panels
  const GCAP = ["爪・しっぽ・火炎で 街をこわせ", "ビルは 8通りに 崩れ落ちる", "破壊コンボで 被害総額を 稼げ！"];
  const [GT, gtx] = cv(); let GS = [];
  scene(14, (t, n) => {
    release(); const b = ahead(), d = b ? b.x - K.x : 999;
    if (d > 34 || !b) keys.right = true; else if (n % 16 === 0) press(n % 64 === 0 ? "tail" : "claw"); if (t > 4.5 && t < 8.5) { keys.fire = true; K.aim = [2, 3, 2, 1][(n / 30 | 0) % 4]; }
    if ([5.2, 6.3, 7.4].some(tk => t >= tk && t - tk < 1 / FPS)) { const c = inView(56)[0]; if (c) L.epicCollapse(c, ["split", "snap", "pancake"][Math.round((t - 5.2) / 1.1)]); }
    Game.update(); Game.render(); gtx.clearRect(0, 0, W, H); L.blit(gtx);
    const idx = Math.min(2, Math.floor(t / 4.6)); if (!GS[idx]) GS[idx] = cv(); GS[idx][1].drawImage(GT, 0, 0);
    m.fillStyle = "rgb(250,246,236)"; m.fillRect(0, 0, W, H); halftone(0, 0, W, H, [250, 240, 220], [230, 200, 170], W, H, 1);
    const R2 = [[8, 8, 200, 112], [214, 8, 162, 112], [8, 128, 368, 80]];
    for (let i = 0; i <= idx; i++) { const [x, y, w2, h] = R2[i]; panel(x, y, w2, h, (px, py, pw, ph) => { const src = GS[i][0], ar = pw / ph, sh = Math.min(H, W / ar), sw = sh * ar; m.drawImage(src, (W - sw) / 2, (H - sh) / 2, sw, sh, px, py, pw, ph); }); caption(GCAP[i], x + 4, y + h - 18, t - i * 4.6, { speed: 20 }); }
    if (t < 0.4) fade(1 - t / 0.4, [255, 255, 255]); if (t > 13.6) fade((t - 13.6) * 2.5);
  }, () => { L.A.on = false; Game.resetWorld(); G.mode = "play"; G.noHUD = false; G.noActors = false; G.hook = null; G.camLock = null; for (let i = 0; i < 460; i++) { if (i > 300) keys.right = true; Game.update(); } keys.right = false; L.A.on = true; GS = []; });
  // 24. the giant of light
  scene(5.4, (t, n) => { stepParts(); const u = clamp(t / 3, 0, 1);
    const pa = u < 1 ? 1 : Math.max(0.15, 1 - (t - 3) * 0.6); stage({ x: 220, y: 118, z: 1.55 }, { storm: 0.6, grade: [140, 140, 190], front: () => { e.save(); e.globalCompositeOperation = "lighter"; e.fillStyle = rgba([255, 240, 200], (0.25 + 0.1 * Math.sin(t * 10)) * pa); e.fillRect(195, -100, 50, 320); e.fillStyle = rgba([255, 255, 255], 0.4 * pa); e.fillRect(212, -100, 16, 320); e.restore(); const F = L.HF.fly, hy = GY - 40 - (1 - easeOut(u)) * 160 - AY; w.drawImage(F.r, 220 - AX, hy); e.drawImage(F.gr, 220 - AX, hy); } });
    if (t > 0.4) caption("そして 空から――", 8, 30, t - 0.4, { speed: 14 }); if (t > 2.6) caption("光の巨人 アステル", 220, 170, t - 2.6, { speed: 14, bg: [255, 240, 190] }); if (t < 0.02) S("hdescend"); letterbox(1); if (t > 5) fade((t - 5) * 2.5, [255, 255, 255]); },
    () => { PS.length = 0; buildCity(60, 600, ["tower", "office", "neon"]); });
  // 25. ending card
  const FEAT = ["8通りに崩れ落ちる ビル", "変身！ 60秒の 超ボルガ", "破壊コンボと 被害総額", "雷獣ジンライ・光の巨人アステル", "ゲームパッド・タッチ操作 対応"];
  scene(13, (t) => {
    halftone(0, 0, W, H, [24, 10, 26], [90, 30, 60], W * 0.25, H, 1.1); speedLines(90, 150, t, 40, 100, 31, [[255, 150, 70], [10, 4, 8]], 0.25);
    const F = kfr(mix(KP.roar0, KP.roar1, (Math.sin(t * 5) + 1) / 2), L.KC); m.drawImage(F.r, -AX + 92, H + 4 - AY); m.save(); m.globalCompositeOperation = "lighter"; m.globalAlpha = 0.7; m.drawImage(F.gr, -AX + 92, H + 4 - AY); m.restore();
    bang("VOLGA RAMPAGE", 270, 30, 16, [[255, 236, 120], [255, 120, 40]], t, { sc: 1.6, shadow: [90, 10, 10] });
    FEAT.forEach((s2, i) => { const tt = t - 0.8 - i * 0.7; if (tt > 0) { m.fillStyle = "rgb(255,150,60)"; m.fillRect(186, 60 + i * 20, 5, 5); m.drawImage(V.letters(s2, 12, [255, 240, 225], [20, 10, 14], null, 1), 192, 52 + i * 20); if (tt < 0.02) S("chain", 4 + i * 3); } });
    if (t > 5.2) { const u = t - 5.2; burstShape(272, 178, 46 + Math.sin(u * 6) * 2, 16, [255, 230, 80], u * 0.3); bang("いますぐ 夜の街へ！", 272, 178, 12, [[255, 60, 40], [180, 10, 10]], u, { sc: 1.5, outline: [255, 255, 240], shadow: [60, 10, 10] }); if (u < 0.02) { S("roar", 1.4); S("boom", 1.5); } }
    if (t > 11.6) { fade((t - 11.6) / 1.4); if (t < 11.62 && L.A.master) L.A.master.gain.setTargetAtTime(0.0001, V.CLOCK, 0.4); }
  });

  // ---------- helpers that need the game ----------
  function hLinesM(t) { for (let i = 0; i < 30; i++) { const y = hash(i * 5) * H, len = 40 + hash(i) * 120, x = ((hash(i * 9) * 900 - t * 1600) % 900 + 900) % 900 - 200; m.fillStyle = rgba([255, 255, 255], 0.25 + hash(i * 2) * 0.35); m.fillRect(Math.round(x), Math.round(y), Math.round(len), 1); } }
  let PULSE = []; const press = k => { keys[k] = true; PULSE.push(k); }; const release = () => { for (const k of ["left", "right", "up", "down", "fire", "claw", "tail", "jump", "roar", "grab", "trans"]) keys[k] = false; };
  const ahead = () => { let best = null; for (const b of G.blds) if (b.state === "stand" && b.x + b.w > K.x - 6 && (!best || b.x < best.x)) best = b; return best; };
  const inView = (minH = 0) => G.blds.filter(b => b.state === "stand" && b.h >= minH && b.type !== "gastank" && b.x > G.cam + 40 && b.x + b.w < G.cam + W - 20);

  // ---------- frame driver ----------
  let start = 0; for (const s of SC) { s.start = start; start += s.d; } const TOTAL = start, FRAMES = Math.round(TOTAL * FPS);
  let cur = null, ln = 0;
  function frame(i) {
    const t = i / FPS; V.CLOCK = t; for (const k of PULSE) keys[k] = false; PULSE = [];
    let s = SC[SC.length - 1]; for (const c of SC) if (t >= c.start && t < c.start + c.d) { s = c; break; }
    if (s !== cur) { cur = s; ln = 0; if (s.init) s.init(); }
    m.setTransform(1, 0, 0, 1, 0, 0); m.save(); s.f(t - s.start, ln++); m.restore(); m.setTransform(1, 0, 0, 1, 0, 0); L.audioTick();
  }
  window.MOVIE = { TOTAL, FRAMES, FPS, frame, canvas: V.MC, setupAudio: () => V.setupAudio(TOTAL + 1.5), scenes: SC.map(s => [s.start, s.d]),
    async audioWav() { const buf = await V.OFF.startRendering(), n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)], out = new Int16Array(n * 2); for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) out[i * 2 + c] = Math.max(-32768, Math.min(32767, Math.round(ch[c][i] * 32767))); return out; } };
})();
