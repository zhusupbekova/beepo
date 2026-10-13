// Google Play listing graphics into dist/play/ (see docs/PLAY.md):
//   icon-512.png                     app icon, 512×512
//   <lang>/feature-1024x500.png      feature graphic (24-bit, no alpha)
//   <lang>/<n>-<name>.png            phone screenshots, 1080×1920, captioned
// Copy comes from store/<lang>.json (`play`). Screenshots frame the phone captures in
// dist/play/raw/<lang>/<n>-<name>.png (scripts/play-capture.js); missing ones are skipped.
// Usage: npm run play [-- en ja …]
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as core from "../extension/lib/core.js";
import { root, render, png, esc, launch, FONT } from "./capture.js";

const out = root + "dist/play/";
const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(core.LANGUAGES);
mkdirSync(out, { recursive: true });

const MONO = `ui-monospace, Menlo, monospace`;
const TEXT = FONT.replace(/"/g, "'"); // goes inside style="…"
const BG = `background:repeating-linear-gradient(0deg,#0000 0 23px,#1b1b2f08 23px 24px),#f4f1e8`;
const LOOK = { hat: "hat-party", accessory: "acc-scarf" };

const SHOTS = [
  ["1-stop", "stop"],
  ["2-limits", "limits"],
  ["3-shop", "shop"],
  ["4-streaks", "streaks"],
  ["5-block", "block"],
  ["6-report", "report"],
  ["7-plus", "plus"],
  ["8-private", "private"],
];

// Shrinks [data-fit] text until it's no taller than data-fit pixels (long languages).
const FIT = `<script>for (const el of document.querySelectorAll("[data-fit]")) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.offsetHeight > +el.dataset.fit && size > 16) el.style.fontSize = (size -= 2) + "px";
}</script>`;

// Play wants the feature graphic and screenshots without alpha.
function opaque(file, buf) {
  const tmp = file + ".tmp.png";
  writeFileSync(tmp, buf);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-pix_fmt", "rgb24", file]);
  rmSync(tmp);
}

const stopSign = (scale, word) => `<div style="display:flex;flex-direction:column;align-items:center;margin-bottom:${scale * 2}px">
  <div style="background:#ff5c7a;color:#fff;font:bold ${scale * 5}px ${MONO};white-space:nowrap;padding:${scale * 2.4}px ${scale * 1.6}px;
    clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)">${esc(word)}</div>
  <div style="width:${scale * 1.2}px;height:${scale * 9}px;background:#1b1b2f"></div></div>`;

const { ctx, composer } = await launch();

writeFileSync(
  out + "icon-512.png",
  await render(composer, {
    // The canvas has empty hat headroom on top; nudge so the visible pixels are centered.
    w: 512, h: 512,
    html: `<div style="height:512px;display:flex;align-items:center;justify-content:center;background:#f4f1e8"><canvas id="b" style="translate:0 -30px"></canvas></div>`,
    beepo: [{ id: "b", scale: 20 }],
  })
);

// The phone capture keeps its aspect; it's scaled to fit under the caption.
const W = 1080, H = 1920, PH = 1500;

for (const lang of langs) {
  const { play } = JSON.parse(readFileSync(`${root}store/${lang}.json`, "utf8"));
  const i18n = JSON.parse(readFileSync(`${root}extension/data/i18n/${lang}.json`, "utf8"));
  const dir = `${out}${lang}/`;
  const raw = `${out}raw/${lang}/`;
  // lang picks the right CJK glyphs; Japanese and Korean wrap between phrases, not inside words.
  const attrs = `dir="${i18n.dir}" lang="${lang.replace("_", "-")}"`;
  const wrap = `text-wrap:balance;word-break:${{ ja: "auto-phrase", ko: "keep-all" }[lang] || "normal"}`;
  mkdirSync(dir, { recursive: true });

  opaque(
    dir + "feature-1024x500.png",
    await render(composer, {
      w: 1024, h: 500,
      html: `<div ${attrs} style="height:500px;${BG};display:flex;align-items:center;justify-content:center;gap:56px;padding:0 50px">
        <div style="display:flex;align-items:flex-end;gap:10px">${stopSign(7, i18n.ui.stop)}<canvas id="b"></canvas></div>
        <div style="display:flex;flex-direction:column;gap:18px;max-width:520px">
          <div style="font:bold 104px/1 ${MONO}">Beepo</div>
          <div data-fit="140" style="font:34px/1.3 ${TEXT};${wrap}">${esc(play.tagline)}</div>
        </div></div>${FIT}`,
      beepo: [{ id: "b", scale: 14, mood: "happy", equipped: LOOK }],
    })
  );

  for (const [name, key] of SHOTS) {
    const file = `${raw}${name}.png`;
    if (!existsSync(file)) {
      console.warn(`skipped ${lang}/${name} (no ${file})`);
      continue;
    }
    const buf = readFileSync(file);
    const [pw, ph] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    const w = Math.round((PH * pw) / ph);
    opaque(
      `${dir}${name}.png`,
      await render(composer, {
        w: W, h: H,
        html: `<div ${attrs} style="height:${H}px;${BG};display:flex;flex-direction:column;align-items:center">
          <div style="height:330px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 70px">
            <div data-fit="260" style="font:800 68px/1.25 ${TEXT};${wrap}">${esc(play.captions[key])}</div>
          </div>
          <img class="shot" src="${png(buf)}" style="width:${w}px;height:${PH}px;border-width:6px;box-shadow:14px 14px 0 #1b1b2f">
        </div>${FIT}`,
      })
    );
  }
  console.log(`play/${lang}`);
}

await ctx.close();
