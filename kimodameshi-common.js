// Shared world, events, sound, UI and export for the two first-person temple walks.
// kimodameshi-ray.html draws it with a raycaster, kimodameshi-3d.html with Three.js.
window.KIMO = (() => {
  "use strict";
  const W = 256, H = 144, EYE = 0.6, FOV = 1.2;
  const PROJ = (W / 2) / Math.tan(FOV / 2);
  const TEXEL = 32; // texture pixels per world unit

  // ---------- map ----------
  // T forest, H hall wall, D hall door, S low stone wall, G gate pillar, w pond, . ground
  const MAP = [
    "TTTTTTTTTTTTTTTTTTTT",
    "TTT..............TTT",
    "TT......HHHHHH....TT",
    "T.......HHHHHH.....T",
    "T.......HHHHHH.....T",
    "T.......HDHHDH.....T",
    "T..................T",
    "T..................T",
    "TSSSS.........SSSSST",
    "T...S.........S....T",
    "T...S.........S.ww.T",
    "T.............S.ww.T",
    "T...S..............T",
    "T...S.........S....T",
    "TSSSS.........SSSSST",
    "T..................T",
    "T..................T",
    "TTTTTTTG....GTTTTTTT",
    "TTTTTTTT....TTTTTTTT",
    "TTTTTTTTTTTTTTTTTTTT",
  ];
  const MW = 20, MH = 20;
  MAP.forEach((r, i) => { if (r.length !== MW) throw new Error(`map row ${i} has ${r.length} cells`); });
  const HGT = { T: 3, H: 2, D: 2, S: 0.45, G: 2.4 };
  const cell = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? "T" : MAP[y | 0][x | 0];

  // props: static things standing in the grounds (sprites in the raycaster, models in 3D)
  const PROPS = [
    ...[9.5, 12.5, 15.5].flatMap(y => [{ k: "toro", x: 8.2, y }, { k: "toro", x: 11.8, y }]),
    { k: "koro", x: 10.5, y: 8.4 }, { k: "saisen", x: 10.5, y: 6.2 },
    { k: "jizo", x: 1.4, y: 3.4 }, { k: "jizo", x: 1.4, y: 4.4 }, { k: "jizo", x: 1.4, y: 5.4 },
    { k: "grave", x: 1.5, y: 9.4 }, { k: "grave", x: 2.5, y: 9.5 }, { k: "grave", x: 1.4, y: 10.6 }, { k: "grave", x: 2.6, y: 12.6 }, { k: "grave", x: 1.5, y: 13.4 }, { k: "grave", x: 3.4, y: 13.5 },
    { k: "willow", x: 3.4, y: 9.4 },
    { k: "bell", x: 16.5, y: 3.5 },
    { k: "chozu", x: 18.4, y: 9.4 },
    { k: "pine", x: 6.5, y: 1.5 }, { k: "pine", x: 15.5, y: 1.6 }, { k: "pine", x: 1.5, y: 7.4 }, { k: "pine", x: 18.4, y: 15.5 }, { k: "pine", x: 1.5, y: 15.6 }, { k: "pine", x: 6.4, y: 16.4 }, { k: "pine", x: 13.6, y: 16.4 },
    { k: "gateroof", x: 10, y: 17.5, pass: true },
  ];
  const BLOCK = new Set(PROPS.filter(p => !p.pass).map(p => `${p.x | 0},${p.y | 0}`));
  const walkable = (x, y) => cell(x, y) === "." && !BLOCK.has(`${x | 0},${y | 0}`);
  const POIS = [
    { x: 10.5, y: 16.5, look: -Math.PI / 2, name: "山門" },
    { x: 9.5, y: 12.5, name: "参道" },
    { x: 15.5, y: 12.5, look: -0.5, name: "池のほとり" },
    { x: 10.5, y: 7.5, look: -Math.PI / 2, name: "本堂の前" },
    { x: 16.5, y: 5.5, look: -Math.PI / 2, name: "鐘楼" },
    { x: 11.5, y: 1.5, look: Math.PI, name: "本堂の裏" },
    { x: 3.5, y: 4.5, look: Math.PI, name: "地蔵の前" },
    { x: 2.5, y: 11.5, look: Math.PI / 2, name: "墓地" },
    { x: 9.5, y: 15.5, look: Math.PI / 2, name: "参道" },
  ];

  // ---------- helpers ----------
  function hash(i) { let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  const h2 = (x, y) => hash(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.imageSmoothingEnabled = false; return [c, x]; };

  // ---------- wall textures (shared by both renderers) ----------
  // Each texture: w x h texels, rgb data plus an emissive mask; row 0 is the top of the wall.
  function makeTex(h, fn) {
    const w = TEXEL, th = Math.round(h * TEXEL), data = new Uint8Array(w * th * 3), em = new Uint8Array(w * th);
    for (let y = 0; y < th; y++) for (let x = 0; x < w; x++) { const [c, e] = fn(x, y, th); const o = y * w + x; data[o * 3] = c[0]; data[o * 3 + 1] = c[1]; data[o * 3 + 2] = c[2]; em[o] = e ? 1 : 0; }
    return { w, h: th, data, em };
  }
  const TEX = {
    T: makeTex(3, (x, y, th) => {
      const n = h2(x, y), trunk = (x % 11) < 2 && y > th * 0.55;
      if (trunk) return [[34 + n * 10, 26, 22], 0];
      const leaf = h2(x >> 2, y >> 2) > 0.45 ? [22, 38 + n * 14, 32] : [16, 28, 26];
      return [y < 10 && h2(x >> 1, 9) * 10 > y ? [14, 16, 34] : leaf, 0];
    }),
    H: makeTex(2, (x, y) => roofOr(x, y, () => {
      if (x < 3) return [[150, 52, 40], 0];
      if (y < 24) return [[66, 40, 28], 0];
      if (y > 57) return [[74, 46, 32], 0];
      const g = (x - 3) % 7 === 0 || (y - 24) % 6 === 0;
      return g ? [[170, 120, 70], 1] : [[246, 206, 140], 1];
    })),
    D: makeTex(2, (x, y) => roofOr(x, y, () => {
      if (x < 3) return [[150, 52, 40], 0];
      if (y < 24) return [[66, 40, 28], 0];
      if (y > 60) return [[74, 46, 32], 0];
      const lat = (x % 4 === 0) || (y % 4 === 0);
      return lat ? [[90, 56, 34], 0] : [[255, 196, 120], 1];
    })),
    S: makeTex(0.45, (x, y) => { const row = (y / 5) | 0, off = row % 2 ? 4 : 0, mortar = y % 5 === 4 || (x + off) % 8 === 0; const n = h2(x, y); return [mortar ? [50, 50, 56] : n > 0.85 ? [60, 84, 56] : [96 + n * 18, 96 + n * 16, 102 + n * 12], 0]; }),
    G: makeTex(2.4, (x, y, th) => { if (y > th - 7) return [[30, 26, 26], 0]; if (y < 4) return [[40, 30, 30], 0]; const n = h2(x, y); return [x < 3 || x > 28 ? [120, 30, 28] : [176 + n * 16, 44, 36], 0]; }),
  };
  function roofOr(x, y, wall) {
    if (y < 19) { const n = h2(x, y); return [y % 3 === 0 ? [30, 34, 46] : [46 + n * 8, 50 + n * 8, 64 + n * 8], 0]; }
    if (y === 19) return [[190, 150, 76], 0];
    return wall();
  }

  // ---------- ground ----------
  const isPath = (wx, wy) => wx > 9 && wx < 11 && wy > 6.3 && wy < 19;
  function ground(wx, wy) {
    const cx = Math.floor(wx * 16), cy = Math.floor(wy * 16), n = h2(cx, cy);
    if (isPath(wx, wy)) { const sx = Math.floor(wx * 2), sy = Math.floor(wy * 2 + (sx % 2) * 0.5), edge = (wx * 2 % 1) < 0.07 || ((wy * 2 + (sx % 2) * 0.5) % 1) < 0.07; const m = h2(sx, sy) * 16; return edge ? [40, 38, 40] : [86 + m + n * 8, 84 + m + n * 8, 86 + m + n * 6]; }
    const c = cell(wx, wy);
    if (wy > 8 && wy < 14 && wx < 4) return n > 0.7 ? [44, 62, 40] : [50 + n * 14, 56 + n * 10, 44 + n * 8]; // mossy graveyard
    if (wy > 5.8 && wy < 8 && wx > 6 && wx < 15) { const rake = Math.floor(wy * 12) % 2; return rake ? [96 + n * 18, 94 + n * 16, 90 + n * 14] : [78 + n * 14, 76 + n * 12, 74 + n * 12]; }
    if (c === "T") return [22 + n * 12, 30 + n * 10, 24 + n * 8];
    return n > 0.93 ? [120, 116, 110] : [70 + n * 22, 68 + n * 20, 64 + n * 18];
  }

  // ---------- sky panorama (shared) ----------
  const SKYW = 512, SKYH = 80;
  const [skyC, skyX] = mkCanvas(SKYW, SKYH);
  let skyData = null;
  function updateSky() {
    const cloud = clamp(S.rain * 1.4, 0, 1), x = skyX;
    const g = x.createLinearGradient(0, 0, 0, SKYH);
    g.addColorStop(0, rgb(mix([8, 10, 30], [16, 16, 24], cloud))); g.addColorStop(0.7, rgb(mix([26, 26, 70], [30, 30, 44], cloud))); g.addColorStop(1, rgb(mix([54, 46, 96], [44, 44, 58], cloud)));
    x.fillStyle = g; x.fillRect(0, 0, SKYW, SKYH);
    if (S.flash > 0) { x.fillStyle = rgba([210, 210, 250], S.flash * 0.6); x.fillRect(0, 0, SKYW, SKYH); }
    for (let i = 0; i < 160; i++) { const tw = hash(i * 3 + 1); x.fillStyle = rgba([235, 230, 255], (1 - cloud) * (0.35 + 0.65 * Math.abs(Math.sin(S.time * (0.5 + tw * 2) + i))) * (tw > 0.9 ? 1 : 0.5)); x.fillRect((hash(i * 3) * SKYW) | 0, (hash(i * 3 + 2) * 58) | 0, 1, 1); }
    const mx = 128, my = 22, ma = 1 - cloud * 0.85;
    const mg = x.createRadialGradient(mx, my, 0, mx, my, 30); mg.addColorStop(0, rgba([230, 220, 255], 0.5 * ma)); mg.addColorStop(1, rgba([230, 220, 255], 0));
    x.fillStyle = mg; x.fillRect(mx - 30, my - 30, 60, 60);
    x.fillStyle = rgba([250, 244, 220], ma); x.beginPath(); x.arc(mx, my, 7, 0, Math.PI * 2); x.fill();
    x.fillStyle = rgb(mix([26, 26, 70], [30, 30, 44], cloud)); x.beginPath(); x.arc(mx + 4, my - 2, 6, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 12; i++) { const w = 40 + hash(i * 7) * 90, cx = (hash(i * 11) * SKYW + S.time * (1 + hash(i) * 2)) % (SKYW + 120) - 60, cy = 10 + hash(i * 13) * 50; x.fillStyle = rgba(mix([60, 50, 100], [50, 50, 64], cloud), 0.35 + cloud * 0.5); x.fillRect(cx | 0, cy | 0, w | 0, 2 + (i % 2) * 2); }
    if (S.bolt) { x.fillStyle = "rgb(240,236,255)"; for (const [bx, by] of S.bolt) x.fillRect(bx | 0, by | 0, 1, 4); }
    const mt = mix([20, 22, 44], [30, 32, 44], cloud);
    x.fillStyle = rgb(mt); for (let i = 0; i < SKYW; i++) { const hh = 8 + Math.sin(i * 0.03) * 5 + Math.sin(i * 0.11 + 2) * 3 + Math.sin(i * 0.004 * Math.PI * 2 * 3) * 4; x.fillRect(i, SKYH - hh, 1, hh); }
    skyData = x.getImageData(0, 0, SKYW, SKYH).data;
  }

  // ---------- sprite art ----------
  function artCanvas(pw, ph) { const [c, x] = mkCanvas(pw, ph), [ec, ex] = mkCanvas(pw, ph); return { c, x, ec, ex, pw, ph }; }
  function R(g, x, y, w, h, col, em) { g.x.fillStyle = typeof col === "string" ? col : rgb(col); g.x.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); if (em) { g.ex.fillStyle = g.x.fillStyle; g.ex.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } }
  function D(g, x, y, r, col, em) { for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8)); R(g, x - w, y + dy, w * 2 + 1, 1, col, em); } }
  const clr = g => { g.x.clearRect(0, 0, g.pw, g.ph); g.ex.clearRect(0, 0, g.pw, g.ph); };
  // static props
  const PROPART = {};
  function propArt(k) {
    if (PROPART[k]) return PROPART[k];
    let g, w, h, z = 0;
    switch (k) {
      case "toro": g = artCanvas(16, 36); w = 0.5; h = 1.1;
        R(g, 3, 32, 10, 4, [100, 98, 94]); R(g, 6, 18, 4, 14, [110, 108, 102]); R(g, 2, 16, 12, 3, [120, 118, 112]); R(g, 4, 9, 8, 7, [100, 98, 94]); R(g, 6, 10, 4, 5, [255, 200, 110], true);
        R(g, 1, 6, 14, 3, [120, 118, 112]); R(g, 3, 4, 10, 2, [110, 108, 104]); R(g, 7, 1, 2, 3, [120, 118, 112]); break;
      case "koro": g = artCanvas(24, 24); w = 0.75; h = 0.75;
        R(g, 4, 20, 16, 4, [90, 84, 60]); R(g, 3, 10, 18, 10, [120, 104, 60]); R(g, 2, 9, 20, 2, [150, 130, 76]); R(g, 6, 4, 12, 5, [80, 70, 50]); R(g, 4, 2, 16, 2, [110, 96, 60]); R(g, 11, 0, 2, 2, [150, 130, 76]); R(g, 8, 12, 8, 2, [255, 150, 80], true); break;
      case "saisen": g = artCanvas(28, 14); w = 0.9; h = 0.45;
        R(g, 0, 2, 28, 12, [110, 70, 44]); for (let i = 2; i < 28; i += 3) R(g, i, 2, 1, 5, [60, 36, 24]); R(g, 0, 0, 28, 2, [140, 96, 60]); R(g, 10, 8, 8, 3, [230, 230, 220]); break;
      case "jizo": g = artCanvas(12, 20); w = 0.38; h = 0.62;
        R(g, 2, 8, 8, 12, [120, 118, 116]); D(g, 6, 5, 3, [132, 130, 126]); R(g, 1, 9, 10, 5, [200, 40, 40]); R(g, 4, 5, 1, 1, [70, 70, 70]); R(g, 7, 5, 1, 1, [70, 70, 70]); R(g, 1, 18, 10, 2, [80, 80, 80]); break;
      case "grave": g = artCanvas(14, 30); w = 0.44; h = 0.95;
        R(g, 0, 26, 14, 4, [90, 90, 94]); R(g, 2, 22, 10, 4, [104, 104, 108]); R(g, 3, 4, 8, 18, [116, 116, 122]); R(g, 3, 4, 8, 1, [140, 140, 146]); for (let i = 7; i < 20; i += 3) R(g, 6, i, 2, 2, [60, 60, 66]);
        R(g, 12, 0, 1, 26, [170, 150, 110]); R(g, 11, 2, 3, 1, [170, 150, 110]); R(g, 1, 20, 2, 3, [80, 120, 70]); break;
      case "willow": g = artCanvas(48, 96); w = 1.5; h = 3;
        R(g, 22, 40, 5, 56, [50, 40, 34]); for (let i = 0; i < 40; i++) { const x = 4 + hash(i) * 40, len = 20 + hash(i + 9) * 50; for (let y = 0; y < len; y++) R(g, x + Math.sin(y * 0.1 + i) * 1.5, 6 + hash(i + 3) * 10 + y, 1, 1, hash(i + 5) > 0.5 ? [60, 100, 70] : [44, 80, 56]); } break;
      case "bell": g = artCanvas(64, 80); w = 2; h = 2.5;
        R(g, 6, 26, 4, 54, [100, 60, 40]); R(g, 54, 26, 4, 54, [100, 60, 40]); R(g, 16, 30, 3, 50, [80, 50, 34]); R(g, 45, 30, 3, 50, [80, 50, 34]);
        for (let r = 0; r < 20; r++) { const ww = 10 + r * 1.6; R(g, 32 - ww, 6 + r, ww * 2, 1, r % 3 ? [46, 50, 64] : [34, 36, 48]); } R(g, 0, 26, 64, 2, [190, 150, 76]); R(g, 24, 2, 16, 4, [40, 44, 56]);
        R(g, 2, 60, 60, 3, [90, 56, 36]); R(g, 0, 76, 64, 4, [70, 68, 70]); break;
      case "chozu": g = artCanvas(28, 20); w = 0.9; h = 0.65;
        R(g, 2, 8, 24, 10, [104, 102, 100]); R(g, 3, 8, 22, 2, [70, 110, 150]); R(g, 1, 18, 26, 2, [80, 80, 80]); for (const x of [6, 12, 18]) { R(g, x, 4, 1, 5, [170, 140, 90]); R(g, x - 1, 3, 3, 2, [170, 140, 90]); } R(g, 20, 0, 2, 9, [60, 90, 80]); break;
      case "pine": g = artCanvas(56, 104); w = 1.75; h = 3.25;
        R(g, 25, 44, 6, 60, [60, 44, 36]); for (let i = 0; i < 6; i++) { const y = 6 + i * 11, ww = 10 + i * 3 + hash(i) * 6, x = 28 + (hash(i + 4) - 0.5) * 14; D(g, x - ww * 0.4, y + 3, 5, [24, 44, 34]); R(g, x - ww, y, ww * 2, 6, [28, 52, 38]); R(g, x - ww + 2, y, ww * 2 - 4, 2, [40, 70, 50]); } break;
      case "gateroof": g = artCanvas(176, 30); w = 5.5; h = 0.95; z = 1.95;
        for (let r = 0; r < 12; r++) { const ww = 70 + r * 1.5 + (r > 8 ? (r - 8) * 2 : 0); R(g, 88 - ww, r, ww * 2, 1, r % 3 ? [46, 50, 64] : [34, 36, 48]); } R(g, 0, 12, 176, 2, [190, 150, 76]);
        R(g, 10, 16, 156, 4, [176, 44, 36]); R(g, 16, 24, 144, 3, [150, 38, 30]); R(g, 76, 14, 24, 12, [40, 26, 26]); R(g, 77, 15, 22, 10, [60, 40, 30]); g.x.fillStyle = "rgb(230,200,120)"; g.x.font = '8px "DotGothic16", monospace'; g.x.textAlign = "center"; g.x.fillText("月影寺", 88, 23); break;
    }
    return (PROPART[k] = { c: g.c, ec: g.ec, w, h, z, id: k, ver: 0 });
  }

  // ---------- state ----------
  const P = { x: 10.5, y: 18.4, a: -Math.PI / 2, walk: 0, bob: 0, speed: 0 };
  const S = {
    time: 0, weather: "auto", rain: 0, lastWx: 0, flash: 0, bolt: null, boltT: 0,
    auto: true, manualT: 0, poi: 0, path: [], look: null, hold: 0, shake: 0, fear: 0,
    lamp: 1, lampOff: 0, bellSwing: 0, ents: [], words: [], nextEvent: 5, turnBack: 0, paused: false, keys: {}, drag: 0,
  };

  // ---------- walking ----------
  function bfs(sx, sy, tx, ty) {
    const key = (x, y) => y * MW + x, prev = new Int16Array(MW * MH).fill(-1), q = [key(sx, sy)]; prev[key(sx, sy)] = key(sx, sy);
    while (q.length) {
      const k = q.shift(), x = k % MW, y = (k / MW) | 0;
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (walkable(nx, ny) && prev[key(nx, ny)] < 0) { prev[key(nx, ny)] = k; q.push(key(nx, ny)); } }
    }
    if (prev[key(tx, ty)] < 0) return [];
    const out = []; for (let k = key(tx, ty); k !== key(sx, sy); k = prev[k]) out.push([k % MW + 0.5, ((k / MW) | 0) + 0.5]);
    return out.reverse();
  }
  function turnToward(target, rate, dt) { const d = wrap(target - P.a); P.a = wrap(P.a + clamp(d, -rate * dt, rate * dt)); return d; }
  function autoWalk(dt) {
    let moved = 0;
    if (S.hold > 0) { S.hold -= dt; return 0; }
    if (S.turnBack > 0) { S.turnBack -= dt; turnToward(S.turnBase, 2.4, dt); return 0; }
    if (S.look) {
      const L = S.look; L.t += dt;
      turnToward(L.base + Math.sin(L.t * 0.9) * 0.8 * Math.min(1, L.t / 1.5), 1.6, dt);
      if (L.t > L.dur) { S.look = null; S.poi = (S.poi + 1) % POIS.length; S.path = []; }
      return 0;
    }
    if (!S.path.length) {
      const t = POIS[S.poi]; S.path = bfs(P.x | 0, P.y | 0, t.x | 0, t.y | 0);
      if (!S.path.length) { S.look = { t: 0, base: t.look ?? P.a, dur: 3 }; return 0; }
      S.path[S.path.length - 1] = [t.x, t.y];
    }
    const [tx, ty] = S.path[0], dx = tx - P.x, dy = ty - P.y, dist = Math.hypot(dx, dy);
    if (dist < (S.path.length > 1 ? 0.45 : 0.08)) {
      S.path.shift();
      if (!S.path.length) { const t = POIS[S.poi]; S.look = { t: 0, base: t.look ?? P.a, dur: rnd(3, 4.5) }; log(`${t.name}に着いた`, "wx"); }
      return 0;
    }
    const diff = turnToward(Math.atan2(dy, dx), 2.0, dt);
    const sp = 1.05 * Math.pow(Math.max(0, Math.cos(diff)), 3);
    const step = Math.min(dist, sp * dt); P.x += dx / dist * step; P.y += dy / dist * step; moved = step;
    return moved;
  }
  function manualWalk(dt) {
    const k = S.keys; let moved = 0;
    const turn = (k.ArrowLeft || k.KeyA ? -1 : 0) + (k.ArrowRight || k.KeyD ? 1 : 0);
    P.a = wrap(P.a + turn * 2.2 * dt + S.drag); S.drag = 0;
    const fw = (k.ArrowUp || k.KeyW ? 1 : 0) - (k.ArrowDown || k.KeyS ? 1 : 0);
    if (fw && S.hold <= 0) {
      const sp = 1.3 * fw * dt, nx = P.x + Math.cos(P.a) * sp, ny = P.y + Math.sin(P.a) * sp, r = 0.22 * Math.sign(fw);
      if (walkable(nx + Math.cos(P.a) * r, P.y)) P.x = nx;
      if (walkable(P.x, ny + Math.sin(P.a) * r)) P.y = ny;
      moved = Math.abs(sp);
    }
    return moved;
  }

  // ---------- events and yokai ----------
  const logEl = () => document.getElementById("log");
  const clock = () => { const m = 23 * 60 + 30 + Math.floor(S.time / 10); return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  function log(msg, cls = "ev") {
    const el = logEl(); if (!el) return;
    const li = document.createElement("li"); li.className = cls;
    const t = document.createElement("time"); t.textContent = clock();
    const sp = document.createElement("span"); sp.textContent = msg;
    li.append(t, sp); el.prepend(li);
    while (el.children.length > 9) el.lastChild.remove();
  }
  const word = (str, x, y, z, c = [255, 236, 210], life = 1.4) => S.words.push({ str, x, y, z, c, t: 0, life });
  function ahead(d, side = 0) {
    const c = Math.cos(P.a), s = Math.sin(P.a); let free = 0;
    for (let k = 0.2; k <= d; k += 0.1) { const x = P.x + c * k, y = P.y + s * k; if (cell(x, y) !== "." && cell(x, y) !== "w") break; free = k; }
    const dd = clamp(free - 0.3, Math.min(0.9, d), d);
    return { x: P.x + c * dd - s * side, y: P.y + s * dd + c * side, d: dd };
  }
  function ent(kind, x, y, z, dur, pw, ph, w, h, extra = {}) { const g = artCanvas(pw, ph); const e = { kind, x, y, z, t: 0, dur, g, w, h, alpha: 1, id: Math.random(), ver: 0, ...extra }; S.ents.push(e); return e; }
  const active = k => S.ents.some(e => e.kind === k);
  function startEvent(kind) {
    switch (kind) {
      case "chochin": { if (active("chochin")) return; const p = ahead(2.6, 0.45); ent("chochin", p.x, p.y, 0.55, 8, 16, 26, 0.5, 0.8); log("木の枝に古い提灯が下がっている…と思ったら、目が開いた", "yo"); break; }
      case "kasa": { if (active("kasa")) return; const p = ahead(3, 0); const c = Math.cos(P.a), s = Math.sin(P.a); ent("kasa", p.x + s * 2.4, p.y - c * 2.4, 0, 5.5, 16, 28, 0.5, 0.9, { vx: -s * 0.9, vy: c * 0.9 }); log("一本足の傘お化けが ぴょんぴょん横切っていく", "yo"); break; }
      case "hitotsume": { if (active("hitotsume")) return; const p = ahead(1.6, 0); ent("hitotsume", p.x, p.y, 0, 3.8, 16, 26, 0.5, 0.82, { vx: Math.cos(P.a), vy: Math.sin(P.a) }); S.hold = Math.max(S.hold, 1.6); S.shake = 0.6; S.fear = 1; sfx("sting"); sfx("baa", p.x, p.y); word("ばあ！", p.x, p.y, 1.1, [255, 240, 200], 1.2); log("暗がりから一つ目小僧が飛び出した！", "yo"); break; }
      case "rokuro": { if (active("rokuro")) return; const p = ahead(3.2, 0.7); ent("rokuro", p.x, p.y, 0, 9, 18, 72, 0.56, 2.25); sfx("nyu", p.x, p.y); log("着物の女の人…の首が にゅうっと伸びていく", "yo"); break; }
      case "noppera": { if (active("noppera")) return; const p = ahead(2.4, 0.2); ent("noppera", p.x, p.y, 0, 8, 16, 40, 0.5, 1.25); log("石灯籠のかげに 後ろ向きの娘が立っている", "yo"); break; }
      case "kitsunebi": { for (let i = 0; i < 6; i++) { const p = ahead(rnd(4.5, 7), rnd(-2.2, 2.2)); ent("kitsunebi", p.x, p.y, rnd(0.3, 0.9), 11, 10, 12, 0.3, 0.36, { ph: rnd(0, 6) }); } sfx("hyu"); log("暗い森の奥に 狐火がいくつも灯った", "yo"); break; }
      case "nurikabe": { if (active("nurikabe")) return; const p = ahead(2.1, 0); ent("nurikabe", p.x, p.y, 0, 6.5, 64, 56, 2, 1.75); S.hold = Math.max(S.hold, 5.5); S.shake = 0.4; sfx("thud", p.x, p.y); word("ぬりかべ〜", p.x, p.y, 1.9, [220, 220, 220], 2.4); log("急に目の前に壁が…ぬりかべだ。通してくれない", "yo"); break; }
      case "ittan": { if (active("ittan")) return; const p = ahead(3, 0); const c = Math.cos(P.a), s = Math.sin(P.a); ent("ittan", p.x - s * 3.5, p.y + c * 3.5, 1.15, 5, 48, 14, 1.5, 0.44, { vx: s * 1.6, vy: -c * 1.6 }); sfx("whoosh"); log("白い布が ひらひらと頭上を飛んでいった…一反木綿", "yo"); break; }
      case "yurei": { if (active("yurei")) return; const p = ahead(3.4, -0.3); ent("yurei", p.x, p.y, 0.12, 9, 22, 46, 0.7, 1.45); sfx("urameshi", p.x, p.y); word("うらめしや〜", p.x, p.y, 1.8, [200, 220, 255], 2.6); log("柳の下に 白い着物の幽霊が…", "yo"); break; }
      case "bell": S.bellSwing = 7; sfx("bell", 16.5, 3.5); word("ゴーン…", 16.5, 3.5, 2.6, [220, 220, 255], 2.6); log("誰もいない鐘楼で 鐘がひとりでに鳴った", "yo"); break;
      case "lampout": if (S.lampOff > 0) return; S.lampOff = 3.4; sfx("fuu"); S.fear = 1; log("ふっ…と提灯の火が消えた。暗闇にたくさんの目が…", "yo"); break;
      case "kappa": { if (active("kappa")) return; const near = Math.hypot(P.x - 16.5, P.y - 10.5) < 5; const p = near ? { x: 16.5, y: 10.6 } : ahead(2.6, 0.4); ent("kappa", p.x, p.y, 0, 8, 16, 24, 0.5, 0.75); sfx("splash", p.x, p.y); word("キュウリ…ある？", p.x, p.y, 1.1, [190, 250, 170], 2.4); log(near ? "池から河童が顔を出した" : "濡れた足音…河童がついてきていた", "yo"); break; }
      case "tanuki": { if (active("tanuki")) return; const p = ahead(2.6, -0.4); ent("tanuki", p.x, p.y, 0, 8, 18, 24, 0.56, 0.75); log("お地蔵さまかと思ったら 化け狸が腹鼓を打ちはじめた", "yo"); break; }
      case "footsteps": S.steps = [0.3, 0.8, 1.3, 1.8]; S.stepT = 0; log("後ろから ひた…ひた…と足音がする", "yo"); break;
    }
  }
  function trySpecial() {
    const dry = S.rain < 0.15, grave = P.x < 5 && P.y > 8 && P.y < 14, pond = Math.hypot(P.x - 16.5, P.y - 10.5) < 5;
    const c = [["chochin", 1.3], ["kasa", dry ? 0.5 : 2], ["hitotsume", 1], ["rokuro", 1], ["noppera", 1], ["kitsunebi", dry ? 1.2 : 0.3], ["nurikabe", 0.8], ["ittan", 1], ["yurei", grave ? 3 : 0.8],
      ["bell", 0.9], ["lampout", 0.8], ["kappa", pond ? 2.5 : !dry ? 0.8 : 0.2], ["tanuki", 1], ["footsteps", 1]];
    let r = Math.random() * c.reduce((a, x) => a + x[1], 0), t = c[0][0];
    for (const [k, w] of c) if ((r -= w) <= 0) { t = k; break; }
    startEvent(t);
  }
  // per-frame art for each yokai
  function drawEnt(e) {
    const g = e.g, t = e.t; clr(g); e.ver++;
    switch (e.kind) {
      case "chochin": {
        const face = t > 1.2, sw = Math.sin(S.time * 2) * 1;
        R(g, 7 + sw, 0, 1, 3, [60, 50, 40]); R(g, 3, 3, 10, 2, [30, 24, 24]);
        for (let y = 5; y < 22; y++) { const ww = 6 - Math.abs(y - 13) * 0.25; R(g, 8 - ww, y, ww * 2, 1, (y - 5) % 4 === 0 ? [150, 90, 50] : [246, 196, 120], true); }
        R(g, 3, 22, 10, 2, [30, 24, 24]);
        if (face) { R(g, 4, 9, 3, 3, [255, 255, 240]); R(g, 5, 10, 1, 1, [20, 10, 10]); R(g, 9, 10, 3, 2, [255, 255, 240]); R(g, 10, 10, 1, 1, [20, 10, 10]); R(g, 4, 15, 8, 2, [110, 20, 30]); const tl = Math.min(9, (t - 1.2) * 12); R(g, 7 + Math.sin(S.time * 5) * 1.5, 16, 3, tl, [230, 70, 90]); }
        else R(g, 6, 11, 4, 3, [180, 30, 30], true);
        if (Math.abs(t - 1.5) < 0.02) { word("ベロ〜ン", e.x, e.y, 1.5, [255, 210, 170], 1.6); sfx("bero", e.x, e.y); }
        break;
      }
      case "kasa": {
        const hop = Math.abs(Math.sin(t * 5)); e.z = hop * 0.28;
        for (let r = 0; r < 14; r++) { const ww = 1 + r * 0.55; R(g, 8 - ww, r, ww * 2, 1, (r % 4 < 2) ? [196, 56, 56] : [226, 196, 140]); }
        R(g, 5, 6, 5, 4, [255, 255, 240]); R(g, 7, 7, 2, 2, [20, 10, 20]); R(g, 9, 11, 3, 6, [230, 60, 80]);
        R(g, 7, 14, 2, 11, [150, 110, 70]); R(g, 5, 25, 6, 3, [100, 70, 40]); break;
      }
      case "hitotsume": {
        const run = t > 1.7; e.alpha = run ? Math.max(0, 1 - (t - 1.7) / 2) : 1;
        R(g, 3, 12, 10, 14, [70, 92, 150]); R(g, 3, 18, 10, 2, [230, 200, 110]); D(g, 8, 6, 5, [238, 214, 190]);
        R(g, 5, 3, 7, 5, [255, 255, 250]); R(g, 7 + (run ? 0 : Math.round(Math.sin(t * 3))), 4, 3, 3, [20, 16, 30]); R(g, 6, 9, 5, 2, [120, 30, 40]); R(g, 7, 10, 3, 4, [230, 70, 90]);
        R(g, 1, 13 + (t < 1.7 ? -3 : 0), 2, 5, [238, 214, 190]); R(g, 13, 13 + (t < 1.7 ? -3 : 0), 2, 5, [238, 214, 190]); break;
      }
      case "rokuro": {
        const ext = Math.min(1, t / 3, Math.max(0, (9 - t) / 2)), hy = Math.round(lerp(46, 2, ext));
        R(g, 3, 52, 12, 20, [110, 64, 120]); R(g, 3, 60, 12, 2, [220, 190, 110]); R(g, 1, 54, 2, 10, [110, 64, 120]); R(g, 15, 54, 2, 10, [110, 64, 120]);
        for (let y = hy + 8; y < 54; y++) R(g, 7 + Math.round(Math.sin(y * 0.15 + S.time * 1.5) * 3 * ext), y, 3, 1, [242, 228, 214]);
        const hx = 8 + Math.round(Math.sin(hy * 0.15 + S.time * 1.5) * 3 * ext);
        R(g, hx - 4, hy, 9, 9, [20, 16, 24]); R(g, hx - 3, hy + 3, 7, 6, [244, 232, 220]); R(g, hx - 2, hy + 5, 2, 1, [30, 20, 30]); R(g, hx + 1, hy + 5, 2, 1, [30, 20, 30]); R(g, hx - 1, hy + 7, 2, 1, [200, 40, 60]); R(g, hx - 2, hy - 2, 5, 3, [20, 16, 24]);
        if (Math.abs(t - 2.2) < 0.02) word("にゅ〜", e.x, e.y, 2.4, [255, 220, 230], 1.6);
        break;
      }
      case "noppera": {
        const turned = t > 3.5; e.alpha = t > 6.5 ? Math.max(0, 1 - (t - 6.5) / 1.5) : 1;
        R(g, 3, 14, 10, 26, [84, 72, 108]); R(g, 3, 24, 10, 3, [190, 160, 210]); R(g, 1, 16, 2, 12, [84, 72, 108]); R(g, 13, 16, 2, 12, [84, 72, 108]);
        if (!turned) { R(g, 3, 1, 10, 16, [18, 14, 22]); }
        else { R(g, 3, 1, 10, 4, [18, 14, 22]); R(g, 2, 3, 2, 12, [18, 14, 22]); R(g, 12, 3, 2, 12, [18, 14, 22]); R(g, 4, 4, 8, 10, [244, 236, 226]); R(g, 5, 13, 6, 1, [230, 220, 210]); }
        if (Math.abs(t - 3.5) < 0.02) { sfx("sting"); S.fear = 1; word("顔が…ない！", e.x, e.y, 1.6, [255, 230, 230], 2); }
        break;
      }
      case "kitsunebi": {
        e.alpha = Math.min(1, t, e.dur - t) * (0.7 + 0.3 * Math.sin(S.time * 7 + e.ph)); e.z += Math.sin(S.time * 1.5 + e.ph) * 0.002;
        for (let y = 0; y < 12; y++) { const ww = Math.max(0, (y < 6 ? y * 0.6 : (12 - y) * 0.7) + Math.sin(S.time * 9 + y + e.ph) * 0.6); R(g, 5 - ww, y, ww * 2 + 1, 1, y > 5 ? [200, 240, 255] : [120, 190, 255], true); }
        break;
      }
      case "nurikabe": {
        e.alpha = t > 5.5 ? Math.max(0, 1 - (t - 5.5)) : Math.min(1, t * 3);
        R(g, 2, 2, 60, 48, [150, 146, 136]); for (let i = 0; i < 40; i++) R(g, 2 + hash(i) * 58, 2 + hash(i + 40) * 46, 3, 1, [128, 124, 116]);
        R(g, 2, 2, 60, 2, [170, 166, 156]); const bl = Math.floor(S.time * 0.8) % 5 === 0 && (S.time % 1.25) < 0.15;
        R(g, 22, 18, 4, bl ? 1 : 3, [30, 30, 30]); R(g, 38, 18, 4, bl ? 1 : 3, [30, 30, 30]); R(g, 28, 28, 8, 1, [70, 60, 60]);
        R(g, 12, 50, 8, 6, [120, 116, 108]); R(g, 44, 50, 8, 6, [120, 116, 108]); break;
      }
      case "ittan": {
        e.alpha = Math.min(1, t * 2, (e.dur - t) * 2);
        for (let x = 0; x < 48; x++) { const y = 5 + Math.sin(x * 0.25 - S.time * 8) * 3 * (x / 48); R(g, x, y, 1, 4 - (x > 40 ? 1 : 0), [240, 240, 236]); }
        R(g, 4, 6, 1, 1, [30, 30, 30]); R(g, 7, 6, 1, 1, [30, 30, 30]); break;
      }
      case "yurei": {
        e.alpha = 0.85 * Math.min(1, t / 1.5, (e.dur - t) / 1.5); e.z = 0.12 + Math.sin(S.time * 1.2) * 0.05;
        for (let y = 12; y < 46; y++) { const ww = 5 + (y - 12) * 0.12; R(g, 11 - ww, y, ww * 2, 1, y > 38 ? [150, 170, 200] : [214, 224, 240], true); }
        R(g, 5, 2, 12, 20, [16, 14, 22]); R(g, 7, 5, 8, 9, [226, 232, 240], true); R(g, 8, 8, 2, 1, [60, 60, 80]); R(g, 12, 8, 2, 1, [60, 60, 80]); R(g, 10, 11, 2, 1, [120, 60, 80]);
        R(g, 6, 18, 2, 7, [16, 14, 22]); R(g, 14, 18, 2, 7, [16, 14, 22]); R(g, 3, 18, 3, 2, [226, 232, 240], true); R(g, 16, 18, 3, 2, [226, 232, 240], true); R(g, 2, 20, 2, 3, [226, 232, 240], true); R(g, 18, 20, 2, 3, [226, 232, 240], true);
        break;
      }
      case "kappa": {
        const up = Math.min(1, t * 2, (e.dur - t) * 2); e.z = -0.3 * (1 - up);
        R(g, 3, 10, 10, 14, [80, 146, 90]); R(g, 11, 12, 4, 10, [90, 110, 60]); D(g, 8, 7, 4, [96, 160, 100]); R(g, 3, 2, 10, 3, [230, 220, 190]); R(g, 5, 1, 6, 2, [170, 210, 240]);
        R(g, 5, 6, 2, 2, [255, 255, 255]); R(g, 9, 6, 2, 2, [255, 255, 255]); R(g, 6, 7, 1, 1, [20, 20, 20]); R(g, 10, 7, 1, 1, [20, 20, 20]); R(g, 6, 9, 5, 2, [230, 190, 60]); break;
      }
      case "tanuki": {
        const beat = Math.floor(t * 3) % 2;
        D(g, 9, 15, 7, [130, 98, 66]); D(g, 9, 16, 4, [230, 210, 176]); D(g, 9, 6, 5, [130, 98, 66]); R(g, 4, 1, 2, 2, [130, 98, 66]); R(g, 12, 1, 2, 2, [130, 98, 66]);
        R(g, 5, 5, 3, 2, [40, 30, 26]); R(g, 10, 5, 3, 2, [40, 30, 26]); R(g, 6, 5, 1, 1, [255, 255, 255]); R(g, 11, 5, 1, 1, [255, 255, 255]); R(g, 8, 8, 2, 1, [30, 20, 20]); R(g, 6, 0, 5, 2, [100, 170, 70]);
        R(g, beat ? 3 : 1, 13, 3, 3, [130, 98, 66]); R(g, beat ? 13 : 15, 13, 3, 3, [130, 98, 66]); R(g, 5, 21, 3, 3, [90, 70, 50]); R(g, 11, 21, 3, 3, [90, 70, 50]);
        break;
      }
    }
  }
  function updateEnt(e, dt) {
    e.t += dt;
    if (e.vx) { const sp = e.kind === "hitotsume" ? (e.t > 1.7 ? 3 : 0) : 1; e.x += e.vx * dt * sp; e.y += e.vy * dt * sp; }
    if (e.kind === "kasa" && Math.floor(e.t * 5 / Math.PI) !== Math.floor((e.t - dt) * 5 / Math.PI)) sfx("pyon", e.x, e.y);
    if (e.kind === "kasa" && Math.abs(e.t - 2) < dt) word("ケケケ", e.x, e.y, 1.2, [255, 200, 200], 1.2);
    if (e.kind === "tanuki" && e.t > 1 && e.t < 7 && Math.floor(e.t * 3) !== Math.floor((e.t - dt) * 3)) { sfx("ponpoko", e.x, e.y); if (Math.floor(e.t * 3) % 2) word(pick(["ポン", "ポコ", "ポンポコ"]), e.x, e.y, 1, [255, 220, 160], 0.7); }
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d < 2.5 && e.kind !== "kitsunebi") S.fear = Math.max(S.fear, 0.6);
  }

  // ---------- update ----------
  function weatherTarget() {
    if (S.weather === "rain") return 0.8;
    if (S.weather === "dry") return 0;
    const c = S.time % 140; return c < 60 ? 0 : c < 67 ? (c - 60) / 7 * 0.8 : c < 122 ? 0.8 : Math.max(0, 0.8 - (c - 122) / 7);
  }
  function step(dt) {
    S.time += dt;
    S.rain += (weatherTarget() - S.rain) * Math.min(1, dt * 0.5);
    if (S.lastWx === 0 && S.rain > 0.2) { S.lastWx = 1; log("ぽつぽつと雨が降ってきた。提灯の灯りが雨粒を照らす", "wx"); }
    else if (S.lastWx === 1 && S.rain < 0.08) { S.lastWx = 0; log("雨がやみ、雲の切れ間から月がのぞいた", "wx"); }
    S.flash = Math.max(0, S.flash - dt * 2.2);
    if (S.rain > 0.7 && Math.random() < dt * 0.035) { S.flash = 1; const b = []; let x = rnd(0, SKYW), y = 0; while (y < 60) { b.push([x, y]); x += rnd(-5, 5); y += rnd(3, 6); } S.bolt = b; S.boltT = 0.2; log("稲妻が境内を照らした", "wx"); setTimeout(() => sfx("thunder"), 500); }
    if (S.bolt) { S.boltT -= dt; if (S.boltT <= 0) S.bolt = null; }
    // walking
    S.manualT = Math.max(0, S.manualT - dt);
    const manual = !S.auto || S.manualT > 0;
    if (!manual && S.wasManual) { S.path = []; S.look = null; }
    S.wasManual = manual;
    const moved = manual ? manualWalk(dt) : autoWalk(dt);
    const pw = P.walk; P.walk += moved; P.speed = lerp(P.speed, moved / Math.max(dt, 1e-3), Math.min(1, dt * 6));
    P.bob = Math.sin(P.walk * Math.PI * 1.7) * Math.min(1, P.speed);
    if (Math.floor(pw * 1.7) !== Math.floor(P.walk * 1.7)) sfx(isPath(P.x, P.y) ? "stone" : "gravel");
    // footsteps behind: stop, then turn around to look
    if (S.steps) { S.stepT += dt; while (S.steps.length && S.stepT > S.steps[0]) { S.steps.shift(); const bx = P.x - Math.cos(P.a) * 1.6, by = P.y - Math.sin(P.a) * 1.6; sfx("hita", bx, by); } if (!S.steps.length) { S.steps = null; if (!manual) { S.turnBack = 2.6; S.turnBase = wrap(P.a + Math.PI); S.hold = 0; log("振り返ったが…誰もいない", "yo"); } } }
    // lantern
    S.lampOff = Math.max(0, S.lampOff - dt);
    const lampTarget = S.lampOff > 0.4 ? 0 : 1;
    S.lamp += (lampTarget - S.lamp) * Math.min(1, dt * (lampTarget ? 3 : 14));
    S.flick = 0.86 + 0.08 * Math.sin(S.time * 11) * Math.sin(S.time * 4.3) + 0.06 * Math.sin(S.time * 23);
    S.bellSwing = Math.max(0, S.bellSwing - dt);
    S.shake = Math.max(0, S.shake - dt); S.fear = Math.max(0, S.fear - dt * 0.12);
    for (const e of S.ents) updateEnt(e, dt);
    S.ents = S.ents.filter(e => e.t < e.dur);
    for (const e of S.ents) drawEnt(e);
    for (let i = S.words.length - 1; i >= 0; i--) { S.words[i].t += dt; if (S.words[i].t > S.words[i].life) S.words.splice(i, 1); }
    S.nextEvent -= dt; if (S.nextEvent <= 0) { S.nextEvent = rnd(7, 12); trySpecial(); }
    updateSky();
    audioUpdate(dt);
  }

  // ---------- lighting shared by both renderers ----------
  const AMB = [0.27, 0.29, 0.46], LAMPC = [1.15, 0.78, 0.46], FOGC = [12, 12, 28], FOGK = 0.1;
  const lampTerm = d => S.lamp * S.flick * 1.05 / (1 + d * d * 0.4);
  // project a world point to screen (identical camera model in both renderers)
  function horizon() { return H / 2 + P.bob * 1.4; }
  function project(x, y, z) {
    const dx = x - P.x, dy = y - P.y, c = Math.cos(P.a), s = Math.sin(P.a);
    const depth = dx * c + dy * s, lat = -dx * s + dy * c;
    if (depth < 0.1) return null;
    return { x: W / 2 + lat / depth * PROJ, y: horizon() + (EYE - z) / depth * PROJ, depth };
  }

  // ---------- 2D overlay: hand lantern, rain, words, fear ----------
  let PFONT = '"DotGothic16", "MS Gothic", monospace';
  const EYES = Array.from({ length: 14 }, (_, i) => ({ x: 10 + hash(i * 3) * 236, y: 10 + hash(i * 3 + 1) * 100, ph: hash(i * 3 + 2) * 6, c: hash(i) > 0.5 ? [255, 60, 40] : [255, 220, 90] }));
  function overlay(ctx) {
    const sway = Math.sin(S.time * 1.6) * 2 + P.bob * 2, lx = 196 + sway, ly = 104 + Math.abs(P.bob) * 2;
    // warm light around the lantern and a cold vignette
    if (S.lamp > 0.05) { const g = ctx.createRadialGradient(lx + 6, ly - 20, 2, lx + 6, ly - 20, 90); g.addColorStop(0, rgba([255, 170, 90], 0.28 * S.lamp * S.flick)); g.addColorStop(1, rgba([255, 170, 90], 0)); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
    // rain streaks
    if (S.rain > 0.05) { ctx.fillStyle = rgba([180, 190, 230], 0.35); const n = Math.round(S.rain * 70); for (let i = 0; i < n; i++) { const x = (hash(i * 7) * W + S.time * 30 + P.a * 60) % W, y = (hash(i * 5) * H + S.time * (180 + hash(i) * 80)) % H; ctx.fillRect(x | 0, y | 0, 1, 4); } }
    // eyes in the dark
    if (S.lampOff > 0) { const a = Math.min(1, (3.4 - S.lampOff) * 2, S.lampOff * 2); for (const e of EYES) { const bl = Math.sin(S.time * 3 + e.ph) > -0.9; if (!bl) continue; ctx.fillStyle = rgba(e.c, a); ctx.fillRect(e.x | 0, e.y | 0, 2, 1); ctx.fillRect((e.x + 5) | 0, e.y | 0, 2, 1); } }
    // the lantern hangs from a stick held in the right hand
    const tipX = lx + 6, tipY = ly - 44;
    ctx.fillStyle = "rgb(84,60,40)"; for (let i = 0; i <= 60; i++) { const k = i / 60; ctx.fillRect(Math.round(lerp(lx + 34, tipX, k)), Math.round(lerp(ly + 50, tipY, k)), 2, 1); }
    ctx.fillStyle = "rgb(40,34,50)"; ctx.beginPath(); ctx.ellipse(lx + 44, ly + 52, 16, 10, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgb(214,176,146)"; ctx.fillRect(lx + 30, ly + 36, 9, 8); ctx.fillStyle = "rgb(190,150,122)"; ctx.fillRect(lx + 30, ly + 40, 9, 1);
    ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(Math.sin(S.time * 1.6 + 0.6) * 0.1 - P.bob * 0.05);
    ctx.fillStyle = "rgb(40,30,26)"; ctx.fillRect(0, 0, 1, 6);
    ctx.fillStyle = "rgb(30,22,20)"; ctx.fillRect(-7, 6, 15, 3); ctx.fillRect(-7, 40, 15, 3);
    const lc = S.lamp > 0.3 ? mix([120, 60, 40], [255, 214, 150], S.lamp * S.flick) : [70, 50, 44];
    for (let y = 9; y < 40; y++) { const ww = 10 - Math.pow(Math.abs(y - 24.5) / 15.5, 2) * 4; ctx.fillStyle = (y - 9) % 5 === 0 ? rgb(mix(lc, [90, 50, 30], 0.5)) : rgb(lc); ctx.fillRect(Math.round(-ww), y, Math.round(ww * 2) + 1, 1); }
    ctx.fillStyle = S.lamp > 0.3 ? "rgb(170,40,36)" : "rgb(70,30,30)"; ctx.font = `10px ${PFONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("寺", 0, 25);
    ctx.restore();
    // words floating at world positions
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `8px ${PFONT}`;
    for (const w of S.words) { const p = project(w.x, w.y, w.z); if (!p || p.x < -20 || p.x > W + 20) continue; const k = w.t / w.life, y = clamp(p.y - k * 8, 8, H - 10); ctx.lineWidth = 2; ctx.strokeStyle = rgba([10, 8, 16], 0.9 * (1 - k)); ctx.strokeText(w.str, p.x, y); ctx.fillStyle = rgba(w.c, 1 - k); ctx.fillText(w.str, p.x, y); }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    if (S.flash > 0.6) { ctx.fillStyle = rgba([220, 220, 255], (S.flash - 0.6) * 0.5); ctx.fillRect(0, 0, W, H); }
    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 160);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(6,2,14,${(0.55 + S.fear * 0.25).toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- post-process ----------
  const LEVELS = [0, 28, 66, 118, 182, 255];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const LO = new Uint8Array(256), FR = new Uint8Array(256);
  for (let v = 0; v < 256; v++) { let i = 0; while (i < 4 && v >= LEVELS[i + 1]) i++; const a = LEVELS[i], b = LEVELS[i + 1]; LO[v] = i; FR[v] = Math.round(((v - a) / (b - a)) * 16); }
  const indexBuf = new Uint8Array(W * H);
  function postProcess(ctx) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p++) {
      const o = p * 4, th = BAYER[(x & 3) + ((y & 3) << 2)];
      let r = LO[d[o]] + (FR[d[o]] > th ? 1 : 0), g = LO[d[o + 1]] + (FR[d[o + 1]] > th ? 1 : 0), b = LO[d[o + 2]] + (FR[d[o + 2]] > th ? 1 : 0);
      if (r > 5) r = 5; if (g > 5) g = 5; if (b > 5) b = 5;
      indexBuf[p] = r * 36 + g * 6 + b;
      d[o] = LEVELS[r]; d[o + 1] = LEVELS[g]; d[o + 2] = LEVELS[b]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return indexBuf;
  }

  // ---------- sound ----------
  const Snd = { ac: null, on: false, vol: 0.7, bgm: true, n: null, nextNote: 0, nextDrone: 0, nextHeart: 0, nextAmb: 0 };
  let busy = false;
  const live = () => Snd.on && Snd.ac && !busy;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const INSEN = [62, 63, 67, 69, 72, 74, 75, 79];
  function audioInit() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ac = new AC(); Snd.ac = ac;
    const master = ac.createGain(); master.gain.value = Snd.vol;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; master.connect(comp); comp.connect(ac.destination);
    const conv = ac.createConvolver(), len = ac.sampleRate * 3.5, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
    conv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.5; conv.connect(wet); wet.connect(master);
    const music = ac.createGain(); music.gain.value = 0.8; music.connect(master); music.connect(conv);
    const white = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), wd = white.getChannelData(0); for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    const pink = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), pd = pink.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < pd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; pd[i] = (b0 + b1 + b2) * 0.9; }
    const loop = (buf, type, f) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return { g, fl }; };
    const wind = loop(pink, "bandpass", 400); wind.fl.Q.value = 0.8;
    Snd.n = { master, music, conv, white, pink, rain: loop(pink, "lowpass", 2200), hiss: loop(white, "highpass", 5500), wind };
    Snd.nextNote = ac.currentTime + 1; Snd.nextDrone = ac.currentTime;
    return true;
  }
  function envG(t0, a, peak, dur, dest) { const g = Snd.ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur); g.connect(dest); return g; }
  function osc(type, f, t0, dur, g) { const o = Snd.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.connect(g); o.start(t0); o.stop(t0 + dur + 0.05); return o; }
  function spatial(x, y) {
    // stereo pan and distance gain for a sound at a world position
    const pan = Snd.ac.createStereoPanner(), g = Snd.ac.createGain();
    if (x === undefined) { pan.pan.value = 0; g.gain.value = 1; }
    else { const dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy), rel = wrap(Math.atan2(dy, dx) - P.a); pan.pan.value = clamp(Math.sin(rel), -1, 1) * 0.9; g.gain.value = clamp(1.6 / (1 + d * 0.6), 0.05, 1) * (Math.cos(rel) < 0 ? 0.8 : 1); }
    pan.connect(g); g.connect(Snd.n.master); const send = Snd.ac.createGain(); send.gain.value = 0.35; g.connect(send); send.connect(Snd.n.conv);
    return pan;
  }
  function koto(m, t0, vel) {
    const d = Snd.n.music, f = mf(m);
    osc("triangle", f, t0, 2.6, envG(t0, 0.003, 0.05 * vel, 2.6, d)); osc("sine", f * 2, t0, 0.9, envG(t0, 0.002, 0.025 * vel, 0.9, d));
    const o = osc("sine", f * 3.01, t0, 0.3, envG(t0, 0.001, 0.012 * vel, 0.3, d)); o.detune.value = 8;
  }
  function drone(t0, dur) {
    const g = Snd.ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.01, t0 + 3); g.gain.setValueAtTime(0.01, t0 + dur - 3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); g.connect(Snd.n.music);
    for (const m of pick([[62, 63, 69, 74], [62, 67, 68, 74], [60, 62, 67, 75]])) { const o = Snd.ac.createOscillator(); o.type = "sine"; o.frequency.value = mf(m); o.detune.value = rnd(-6, 6); o.connect(g); o.start(t0); o.stop(t0 + dur); }
  }
  let melIdx = 3;
  function audioUpdate(dt) {
    if (!live()) return;
    const ac = Snd.ac, n = Snd.n, t = ac.currentTime;
    if (Snd.bgm) {
      if (t > Snd.nextDrone) { drone(t, 16); Snd.nextDrone = t + 13; }
      while (Snd.nextNote < t + 0.3) {
        let tt = Snd.nextNote; const k = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < k; i++) { melIdx = clamp(melIdx + pick([-2, -1, 1, 1, 2, -3]), 0, INSEN.length - 1); koto(INSEN[melIdx] - (Math.random() < 0.3 ? 12 : 0), tt, i ? 0.7 : 1); tt += pick([0.4, 0.6, 0.9, 1.3]); }
        Snd.nextNote = tt + rnd(3, 7);
      }
    }
    n.wind.g.gain.setTargetAtTime(0.04 + 0.03 * Math.sin(S.time * 0.23) + 0.02 * Math.sin(S.time * 0.71), t, 0.5); n.wind.fl.frequency.setTargetAtTime(300 + 200 * Math.sin(S.time * 0.3), t, 0.5);
    n.rain.g.gain.setTargetAtTime(S.rain * 0.3, t, 0.3); n.hiss.g.gain.setTargetAtTime(S.rain * 0.035, t, 0.3);
    if (S.rain < 0.1 && Math.random() < dt * 1.6) for (let i = 0; i < 3; i++) osc("sine", 4500 + Math.random() * 300, t + i * 0.08, 0.06, envG(t + i * 0.08, 0.005, 0.005, 0.06, n.master));
    const pond = Math.hypot(P.x - 16.5, P.y - 10.5);
    if (Math.random() < dt * 0.6 * clamp(1.5 - pond * 0.15, 0.1, 1)) { const g = envG(t, 0.01, 0.02, 0.2, spatial(16.5, 10.5)); const o = osc("square", 110, t, 0.2, g); const am = ac.createOscillator(), ag = ac.createGain(); am.frequency.value = 26; ag.gain.value = 50; am.connect(ag); ag.connect(o.frequency); am.start(t); am.stop(t + 0.22); }
    if (t > Snd.nextAmb) { Snd.nextAmb = t + rnd(10, 20); const x = P.x + rnd(-6, 6), y = P.y + rnd(-6, 6); if (Math.random() < 0.5) { for (const [d, f] of [[0, 380], [0.5, 360], [0.75, 360]]) osc("sine", f, t + d, 0.35, envG(t + d, 0.05, 0.05, 0.35, spatial(x, y))); } else { const g = envG(t, 0.01, 0.04, 0.3, spatial(x, y)), bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 2; bp.connect(g); const o = osc("sawtooth", 680, t, 0.3, bp); o.frequency.linearRampToValueAtTime(460, t + 0.3); } }
    if (S.fear > 0.3 && t > Snd.nextHeart) { const g = n.master; for (const d of [0, 0.18]) { const o = osc("sine", 60, t + d, 0.15, envG(t + d, 0.005, 0.3 * S.fear, 0.15, g)); o.frequency.exponentialRampToValueAtTime(40, t + d + 0.12); } Snd.nextHeart = t + lerp(1.1, 0.55, S.fear); }
  }
  function sfx(kind, x, y) {
    if (!live()) return;
    const ac = Snd.ac, t0 = ac.currentTime, out = spatial(x, y), m = Snd.n.master;
    const noise = (type, f, q, dur, vol, dest = out, at = t0) => { const s = ac.createBufferSource(); s.buffer = Snd.n.white; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); fl.connect(envG(at, 0.002, vol, dur, dest)); s.start(at, Math.random()); s.stop(at + dur + 0.05); };
    const voice = (f0, f1, dur, vol, fm1 = 700, fm2 = 1200) => { const o = osc("sawtooth", f0, t0, dur, ac.createGain()); o.frequency.linearRampToValueAtTime(f1, t0 + dur); o.disconnect(); const g = envG(t0, 0.05, vol, dur, out); for (const [f, q] of [[fm1, 5], [fm2, 7]]) { const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q; o.connect(bp); bp.connect(g); } return o; };
    switch (kind) {
      case "gravel": noise("bandpass", 1800, 0.9, 0.09, 0.05, m); noise("lowpass", 500, 0.7, 0.06, 0.04, m); break;
      case "stone": osc("triangle", 900, t0, 0.05, envG(t0, 0.001, 0.03, 0.05, m)); noise("highpass", 2500, 0.7, 0.04, 0.02, m); break;
      case "hita": noise("lowpass", 700, 0.7, 0.12, 0.25); break;
      case "sting": for (const f of [311, 330, 466, 622]) osc("sawtooth", f, t0, 1.2, envG(t0, 0.005, 0.03, 1.2, Snd.n.conv)); noise("highpass", 3000, 0.7, 0.4, 0.08, m); break;
      case "baa": voice(420, 300, 0.5, 0.12, 800, 1300); break;
      case "bero": { const o = osc("sine", 700, t0, 0.8, envG(t0, 0.01, 0.06, 0.8, out)); o.frequency.exponentialRampToValueAtTime(180, t0 + 0.7); break; }
      case "pyon": { const o = osc("sine", 300, t0, 0.12, envG(t0, 0.002, 0.08, 0.12, out)); o.frequency.exponentialRampToValueAtTime(800, t0 + 0.1); osc("triangle", 1200, t0, 0.04, envG(t0, 0.001, 0.04, 0.04, out)); break; }
      case "nyu": { const g = envG(t0, 0.2, 0.05, 2.4, out), o = osc("sine", 280, t0, 2.4, g); o.frequency.exponentialRampToValueAtTime(900, t0 + 2.2); const v = ac.createOscillator(), vg = ac.createGain(); v.frequency.value = 6; vg.gain.value = 30; v.connect(vg); vg.connect(o.detune); v.start(t0); v.stop(t0 + 2.4); break; }
      case "hyu": for (let i = 0; i < 3; i++) { const o = osc("sine", 600 + i * 90, t0 + i * 0.4, 1.4, envG(t0 + i * 0.4, 0.3, 0.02, 1.4, Snd.n.conv)); o.frequency.linearRampToValueAtTime(900 + i * 90, t0 + i * 0.4 + 1.4); } break;
      case "thud": { const o = osc("sine", 70, t0, 0.8, envG(t0, 0.003, 0.5, 0.8, out)); o.frequency.exponentialRampToValueAtTime(35, t0 + 0.6); noise("lowpass", 300, 0.7, 0.3, 0.3); setTimeout(() => { if (live()) voice(90, 70, 1.6, 0.18, 400, 800); }, 700); break; }
      case "whoosh": { const s = ac.createBufferSource(); s.buffer = Snd.n.pink; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(1600, t0 + 1.5); f.frequency.exponentialRampToValueAtTime(400, t0 + 3); s.connect(f); f.connect(envG(t0, 0.8, 0.25, 3.2, out)); s.start(t0); s.stop(t0 + 3.3); break; }
      case "urameshi": { const o = voice(230, 170, 2.8, 0.09, 500, 900); const v = ac.createOscillator(), vg = ac.createGain(); v.frequency.value = 5; vg.gain.value = 40; v.connect(vg); vg.connect(o.detune); v.start(t0); v.stop(t0 + 2.8); for (const f of [1320, 1760, 2090]) osc("sine", f, t0 + 0.4, 2, envG(t0 + 0.4, 0.01, 0.01, 2, Snd.n.conv)); break; }
      case "bell": noise("lowpass", 300, 0.7, 0.3, 0.3); for (const [f, a, d] of [[82, 0.24, 12], [84.5, 0.18, 12], [168, 0.1, 9], [230, 0.08, 7], [318, 0.05, 5], [433, 0.03, 4]]) osc("sine", f, t0, d, envG(t0, 0.02, a, d, out)); break;
      case "fuu": noise("bandpass", 900, 0.6, 0.5, 0.12, m); break;
      case "splash": noise("bandpass", 1200, 0.8, 0.4, 0.2); break;
      case "ponpoko": { const o = osc("sine", 140, t0, 0.2, envG(t0, 0.002, 0.3, 0.2, out)); o.frequency.exponentialRampToValueAtTime(90, t0 + 0.18); break; }
      case "thunder": { const s = ac.createBufferSource(); s.buffer = Snd.n.pink; const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(800, t0); f.frequency.exponentialRampToValueAtTime(100, t0 + 3); s.connect(f); f.connect(envG(t0, 0.05, 0.5, 3.5, m)); s.start(t0); s.stop(t0 + 3.6); break; }
    }
  }

  // ---------- GIF ----------
  const PALETTE = new Uint8Array(768);
  for (let i = 0; i < 216; i++) { PALETTE[i * 3] = LEVELS[(i / 36) | 0]; PALETTE[i * 3 + 1] = LEVELS[((i / 6) | 0) % 6]; PALETTE[i * 3 + 2] = LEVELS[i % 6]; }
  function lzw(ix, out) {
    let size = 9, next = 258, cur = 0, bits = 0; const dict = new Map(), bytes = [];
    const emit = c => { cur |= c << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(256); let prefix = ix[0];
    for (let i = 1; i < ix.length; i++) {
      const k = ix[i], key = prefix * 256 + k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix);
      if (next < 4095) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(256); dict.clear(); size = 9; next = 258; }
      prefix = k;
    }
    emit(prefix); emit(257); if (bits > 0) bytes.push(cur & 255);
    out.push(8);
    for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
    out.push(0);
  }
  function upscale(ix, k) {
    if (k === 1) return ix.slice();
    const w = W * k, o = new Uint8Array(w * H * k);
    for (let y = 0; y < H * k; y++) { const sy = ((y / k) | 0) * W, row = y * w; for (let x = 0; x < w; x++) o[row + x] = ix[sy + ((x / k) | 0)]; }
    return o;
  }

  // ---------- page shell ----------
  function buildPage(title, sub, hint) {
    document.body.insertAdjacentHTML("beforeend", `
<div class="wrap">
  <div class="screen"><canvas id="view" width="1024" height="576" tabindex="0" aria-label="一人称視点の境内。矢印キーかWASDで歩き、ドラッグで見回せます"></canvas>
    <div class="hud" aria-hidden="true"><span id="hud-t">23:30</span><span id="hud-p"></span><span id="hud-w">晴れ</span></div></div>
  <div class="side">
    <div><h1>${title}</h1><p class="sub">${sub}</p></div>
    <div class="group"><button id="music" class="play" aria-pressed="false">音を出す</button><label class="label" for="vol">音量</label><input id="vol" type="range" min="0" max="100" value="70"><button id="bgm" aria-pressed="true">音楽</button><button id="auto" aria-pressed="true">自動で歩く</button></div>
    <div class="group" role="group" aria-label="天気"><span class="label">天気</span><button data-w="auto" aria-pressed="true">自動</button><button data-w="rain" aria-pressed="false">雨あり</button><button data-w="dry" aria-pressed="false">雨なし</button></div>
    <div class="group" role="group" aria-label="妖怪を呼ぶ"><span class="label">妖怪</span>
      <button data-ev="chochin">提灯お化け</button><button data-ev="kasa">傘お化け</button><button data-ev="hitotsume">一つ目小僧</button><button data-ev="rokuro">ろくろ首</button><button data-ev="noppera">のっぺらぼう</button><button data-ev="kitsunebi">狐火</button>
      <button data-ev="nurikabe">ぬりかべ</button><button data-ev="ittan">一反木綿</button><button data-ev="yurei">幽霊</button><button data-ev="kappa">河童</button><button data-ev="tanuki">化け狸</button><button data-ev="bell">ひとりでに鳴る鐘</button><button data-ev="lampout">提灯が消える</button><button data-ev="footsteps">背後の足音</button></div>
    <div class="group"><button id="pause" aria-pressed="false">一時停止</button><label class="label" for="gifsec">GIF</label>
      <select id="gifsec"><option value="4">4秒</option><option value="8" selected>8秒</option><option value="12">12秒</option></select>
      <select id="gifscale" aria-label="GIFサイズ"><option value="1">256×144</option><option value="2" selected>512×288</option></select>
      <button id="gif">GIFを作る</button><button id="webm">動画を録画</button><span class="label" id="perf"></span></div>
    <ul class="log" id="log" aria-live="polite"></ul>
    <p class="hint">${hint}</p>
    <div id="status" role="status"></div><div class="out" id="out"></div>
  </div>
</div>`);
  }
  const CSS = `
  :root { color-scheme: dark; --ink: #eee9f2; --dim: #9a92ae; --ground: #09080f; --panel: #15121f; --line: #332b46; --gold: #f0c070; --cool: #a4d0ff;
    --font: "DotGothic16", "MS Gothic", "Osaka-Mono", ui-monospace, monospace; }
  html, body { height: 100%; }
  body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--font); font-size: 15px; padding-inline: 16px; padding-block: 16px 24px; box-sizing: border-box; }
  .wrap { max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
  .screen { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; border: 1px solid var(--line); }
  #view { width: 100%; height: 100%; display: block; image-rendering: pixelated; image-rendering: crisp-edges; cursor: grab; touch-action: none; }
  #view:focus-visible { outline: 2px solid var(--cool); outline-offset: 2px; }
  .hud { position: absolute; left: 10px; top: 8px; display: flex; gap: 12px; font-size: 13px; color: var(--gold); text-shadow: 0 0 4px #000; pointer-events: none; }
  .hud span:nth-child(2) { color: var(--ink); } .hud span:last-child { color: var(--cool); }
  .side { display: flex; flex-direction: column; gap: 10px; }
  h1 { margin: 0; font-size: 22px; font-weight: 400; letter-spacing: 0.08em; color: var(--gold); }
  .sub { color: var(--dim); font-size: 13px; margin: 4px 0 0; }
  .group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .label { color: var(--dim); font-size: 12px; letter-spacing: 0.1em; }
  button, select { font-family: var(--font); font-size: 14px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); padding: 6px 10px; cursor: pointer; }
  button[aria-pressed="true"] { border-color: var(--gold); color: var(--gold); }
  button.play { border-color: #7a4a3a; }
  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid var(--cool); outline-offset: 2px; }
  button:disabled { opacity: 0.5; cursor: wait; }
  input[type="range"] { accent-color: var(--gold); width: 110px; }
  .log { margin: 0; padding: 10px 12px; list-style: none; background: var(--panel); border: 1px solid var(--line); min-height: 150px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
  .log li { display: flex; gap: 8px; } .log time { color: var(--dim); font-variant-numeric: tabular-nums; flex: none; }
  .log li.wx { color: var(--cool); } .log li.ev { color: var(--gold); } .log li.yo { color: #e0a0ff; }
  #status { color: var(--cool); font-size: 13px; min-height: 1.2em; }
  .out { display: flex; flex-direction: column; gap: 8px; } .out img, .out video { max-width: 100%; image-rendering: pixelated; border: 1px solid var(--line); }
  .hint { color: var(--dim); font-size: 12px; line-height: 1.6; margin: 0; }`;

  function start({ title, sub, hint, render }) {
    const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
    buildPage(title, sub, hint);
    if (document.fonts && document.fonts.load) document.fonts.load(`8px ${PFONT}`).catch(() => {});
    const [low, lctx] = mkCanvas(W, H);
    const view = document.getElementById("view"), vctx = view.getContext("2d"); vctx.imageSmoothingEnabled = false;
    const hudT = document.getElementById("hud-t"), hudP = document.getElementById("hud-p"), hudW = document.getElementById("hud-w"), perf = document.getElementById("perf");
    let msAvg = 0;
    function frame(dt) {
      step(dt);
      const t0 = performance.now();
      render(lctx);
      overlay(lctx);
      const idx = postProcess(lctx);
      msAvg = lerp(msAvg, performance.now() - t0, 0.05);
      const sx = S.shake > 0 ? Math.round(rnd(-2, 2) * S.shake * 4) : 0, sy = S.shake > 0 ? Math.round(rnd(-2, 2) * S.shake * 4) : 0;
      vctx.fillStyle = "#000"; vctx.fillRect(0, 0, view.width, view.height);
      vctx.drawImage(low, sx * 4, sy * 4, view.width, view.height);
      hudT.textContent = clock();
      let best = POIS[0], bd = 1e9; for (const p of POIS) { const d = Math.hypot(p.x - P.x, p.y - P.y); if (d < bd) { bd = d; best = p; } } hudP.textContent = best.name;
      hudW.textContent = S.rain > 0.5 ? "雨" : S.rain > 0.12 ? "小雨" : "晴れ";
      return idx;
    }
    async function makeGif(seconds = 8, scale = 2, fps = 15, onProgress) {
      const n = Math.round(seconds * fps), w = W * scale, h = H * scale, delay = Math.round(100 / fps);
      const out = []; for (const ch of "GIF89a") out.push(ch.charCodeAt(0));
      out.push(w & 255, w >> 8, h & 255, h >> 8, 0xf7, 0, 0); for (let i = 0; i < 768; i++) out.push(PALETTE[i]);
      out.push(0x21, 0xff, 0x0b); for (const ch of "NETSCAPE2.0") out.push(ch.charCodeAt(0)); out.push(3, 1, 0, 0, 0);
      for (let i = 0; i < n; i++) {
        const ix = frame(1 / fps);
        out.push(0x21, 0xf9, 4, 4, delay & 255, delay >> 8, 0, 0, 0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0);
        lzw(upscale(ix, scale), out);
        if (i % 4 === 3) { onProgress && onProgress(i + 1, n); await new Promise(r => setTimeout(r, 0)); }
      }
      out.push(0x3b); return new Uint8Array(out);
    }
    let last = performance.now(), perfT = 0;
    function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!S.paused && !busy) frame(dt); perfT += dt; if (perfT > 1) { perfT = 0; perf.textContent = `描画 ${msAvg.toFixed(1)} ms/フレーム`; } requestAnimationFrame(loop); }
    const status = document.getElementById("status"), outEl = document.getElementById("out");
    const mBtn = document.getElementById("music");
    mBtn.addEventListener("click", async () => {
      if (!Snd.ac && !audioInit()) { status.textContent = "このブラウザでは音を鳴らせません。"; return; }
      Snd.on = !Snd.on;
      if (Snd.on) { await Snd.ac.resume(); Snd.nextNote = Snd.ac.currentTime + 0.5; } else await Snd.ac.suspend();
      mBtn.setAttribute("aria-pressed", String(Snd.on)); mBtn.textContent = Snd.on ? "音を止める" : "音を出す";
    });
    const bgmBtn = document.getElementById("bgm");
    bgmBtn.addEventListener("click", () => { Snd.bgm = !Snd.bgm; bgmBtn.setAttribute("aria-pressed", String(Snd.bgm)); });
    const autoBtn = document.getElementById("auto");
    autoBtn.addEventListener("click", () => { S.auto = !S.auto; S.manualT = 0; autoBtn.setAttribute("aria-pressed", String(S.auto)); status.textContent = S.auto ? "自動で境内を歩きます。キー操作をすると少しの間だけ手動になります。" : "手動で歩きます。矢印キーかWASDで移動、ドラッグで見回せます。"; });
    document.getElementById("vol").addEventListener("input", e => { Snd.vol = e.target.value / 100; if (Snd.n) Snd.n.master.gain.setTargetAtTime(Snd.vol, Snd.ac.currentTime, 0.05); });
    const wButtons = [...document.querySelectorAll("[data-w]")];
    wButtons.forEach(b => b.addEventListener("click", () => { S.weather = b.dataset.w; wButtons.forEach(x => x.setAttribute("aria-pressed", String(x === b))); }));
    document.querySelectorAll("[data-ev]").forEach(b => b.addEventListener("click", () => startEvent(b.dataset.ev)));
    const pBtn = document.getElementById("pause");
    function togglePause() { S.paused = !S.paused; pBtn.setAttribute("aria-pressed", String(S.paused)); pBtn.textContent = S.paused ? "再生" : "一時停止"; }
    pBtn.addEventListener("click", togglePause);
    const MOVE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];
    window.addEventListener("keydown", e => {
      if (e.code === "Space" && (e.target === document.body || e.target === view)) { e.preventDefault(); togglePause(); return; }
      if (MOVE.includes(e.code) && (e.target === document.body || e.target === view)) { e.preventDefault(); S.keys[e.code] = true; S.manualT = 8; }
    });
    window.addEventListener("keyup", e => { S.keys[e.code] = false; });
    let dragX = null;
    view.addEventListener("pointerdown", e => { dragX = e.clientX; view.setPointerCapture(e.pointerId); view.focus(); });
    view.addEventListener("pointermove", e => { if (dragX === null) return; S.drag += (e.clientX - dragX) * 0.006; dragX = e.clientX; S.manualT = 8; });
    view.addEventListener("pointerup", () => { dragX = null; });
    const gifBtn = document.getElementById("gif");
    gifBtn.addEventListener("click", async () => {
      busy = true; gifBtn.disabled = true;
      try {
        const bytes = await makeGif(+document.getElementById("gifsec").value, +document.getElementById("gifscale").value, 15, (i, n) => { status.textContent = `GIF 生成中… ${i}/${n} フレーム`; });
        const img = new Image(); img.src = URL.createObjectURL(new Blob([bytes], { type: "image/gif" })); img.alt = "書き出した肝試しのGIF"; outEl.prepend(img);
        status.textContent = `GIF ができました（${(bytes.length / 1048576).toFixed(1)} MB）。右クリック／長押しで保存できます。`;
      } catch (err) { status.textContent = `GIF の生成に失敗しました: ${err.message}`; }
      finally { busy = false; gifBtn.disabled = false; last = performance.now(); }
    });
    const webmBtn = document.getElementById("webm"); let rec = null;
    webmBtn.addEventListener("click", () => {
      if (rec) { rec.stop(); return; }
      if (!view.captureStream || typeof MediaRecorder === "undefined") { status.textContent = "このブラウザは動画録画に対応していません。GIF をお使いください。"; return; }
      const chunks = [], type = ["video/webm;codecs=vp9", "video/webm", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t)) || "";
      rec = new MediaRecorder(view.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 6e6 } : undefined);
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = () => { const v = document.createElement("video"); v.src = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || "video/webm" })); v.controls = v.loop = v.muted = v.autoplay = true; outEl.prepend(v); status.textContent = "録画しました（映像のみ）。動画の右クリック／長押しで保存できます。"; rec = null; webmBtn.textContent = "動画を録画"; };
      rec.start(); webmBtn.textContent = "録画を止める"; status.textContent = "録画中… もう一度押すと停止します。";
    });
    log("丑三つ時の少し前。提灯を手に、月影寺の山門をくぐる", "wx");
    updateSky();
    window.KIMO.frame = frame; window.KIMO.makeGif = makeGif; window.KIMO.msAvg = () => msAvg;
    requestAnimationFrame(loop);
  }

  return { W, H, EYE, FOV, PROJ, TEXEL, MAP, MW, MH, HGT, cell, TEX, PROPS, ground, isPath, skyC, skyInfo: () => ({ data: skyData, w: SKYW, h: SKYH }), propArt, P, S, AMB, LAMPC, FOGC, FOGK, lampTerm, horizon, project, startEvent, hash, h2, clamp, lerp, mix, wrap, mkCanvas, start };
})();
