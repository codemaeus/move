// Renders the Volga Rampage promo movie to MP4 (1920x1080, 60 fps) with the game's own synthesized sound.
//   node movie/render.js out.mp4                -> full movie
//   node movie/render.js --stills 12.5,40 dir   -> PNG stills at those seconds (for checking shots)
// Needs Playwright (Chromium) and ffmpeg with libx264.
const path = require("path"), fs = require("fs"), { spawn } = require("child_process");
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const ROOT = path.resolve(__dirname, ".."), args = process.argv.slice(2);
const stills = args[0] === "--stills" ? args[1].split(",").map(Number) : null, out = stills ? args[2] : args[0] || "volga_promo.mp4";

(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 800, height: 600 } }), errs = [];
  page.on("pageerror", e => errs.push(e.message + " " + (e.stack || "").split("\n")[1]));
  // deterministic: seeded Math.random, and the game's own frame loop switched off (the director steps it)
  await page.addInitScript(() => { let a = 20260; Math.random = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; window.requestAnimationFrame = () => 0; });
  await page.goto("file://" + path.join(ROOT, "borga.html"));
  await page.waitForFunction(() => window.Game && Game.lib, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: path.join(__dirname, "volga_movie.js") });
  await page.addScriptTag({ path: path.join(__dirname, "volga_movie_timeline.js") });
  const info = await page.evaluate(() => { MOVIE.setupAudio(); return { frames: MOVIE.FRAMES, total: MOVIE.TOTAL, scenes: MOVIE.scenes }; });
  console.log(`movie: ${info.total.toFixed(1)} s, ${info.frames} frames, ${info.scenes.length} shots`); if (process.env.SHOTS) console.log(info.scenes.map(([s, d]) => s.toFixed(1) + "+" + d).join(" "));

  if (stills) {
    fs.mkdirSync(out, { recursive: true }); const want = stills.map(s => Math.round(s * 60)).sort((a, b) => a - b); let f = 0;
    for (const target of want) { const url = await page.evaluate(([a, b]) => { for (let i = a; i <= b; i++) MOVIE.frame(i); return MOVIE.canvas.toDataURL("image/png"); }, [f, target]); f = target + 1; fs.writeFileSync(path.join(out, `s_${(target / 60).toFixed(2)}.png`), Buffer.from(url.split(",")[1], "base64")); }
    console.log(errs.length ? errs.slice(0, 5) : "no errors"); await browser.close(); return;
  }

  const tmp = out.replace(/\.mp4$/, "") + ".video.mp4";
  const ff = spawn("ffmpeg", ["-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "60", "-c:v", "png", "-i", "-", "-vf", "scale=1920:1080:flags=neighbor", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-tune", "animation", "-pix_fmt", "yuv420p", tmp], { stdio: ["pipe", "inherit", "inherit"] });
  const B = 30, t0 = Date.now();
  for (let f = 0; f < info.frames; f += B) {
    const urls = await page.evaluate(([a, n]) => { const r = []; for (let i = a; i < a + n && i < MOVIE.FRAMES; i++) { MOVIE.frame(i); r.push(MOVIE.canvas.toDataURL("image/png")); } return r; }, [f, B]);
    for (const u of urls) if (!ff.stdin.write(Buffer.from(u.split(",")[1], "base64"))) await new Promise(r => ff.stdin.once("drain", r));
    if (f % 1800 === 0) console.log(`  ${(f / 60).toFixed(0)} s  (${((Date.now() - t0) / 1000).toFixed(0)} s elapsed)`);
  }
  ff.stdin.end(); await new Promise(r => ff.on("close", r));
  // sound: render the offline audio graph and pull it out in chunks
  const n = await page.evaluate(async () => { window.__pcm = await MOVIE.audioWav(); return window.__pcm.length; });
  const pcm = Buffer.alloc(n * 2); const CH = 1 << 21;
  for (let i = 0; i < n; i += CH) { const b64 = await page.evaluate(([a, c]) => { const s = window.__pcm.subarray(a, a + c), u8 = new Uint8Array(s.buffer, s.byteOffset, s.byteLength); let str = ""; for (let k = 0; k < u8.length; k += 0x8000) str += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000)); return btoa(str); }, [i, CH]); Buffer.from(b64, "base64").copy(pcm, i * 2); }
  const wav = out.replace(/\.mp4$/, "") + ".wav", hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(44100, 24); hdr.writeUInt32LE(44100 * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(wav, Buffer.concat([hdr, pcm]));
  await new Promise(r => spawn("ffmpeg", ["-loglevel", "error", "-y", "-i", tmp, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out], { stdio: "inherit" }).on("close", r));
  fs.unlinkSync(tmp); fs.unlinkSync(wav);
  console.log(`done: ${out}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`, errs.length ? errs.slice(0, 5) : "no errors");
  await browser.close();
})();
