// Reddit images (4:3, shown uncropped in the feed):
//   hero.png    what Beepo does: the STOP sign on a website, the Android app, his wardrobe, where to get him
//   lineup.png  just the pixel art (no logos, no screenshots) for art subs
// Uses dist/store/en/2-stop.png (npm run store -- en) and dist/play/raw/en/1-stop.png (docs/PLAY.md).
// Out: dist/social/reddit/. Usage: node scripts/reddit-assets.js
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { root, render, png, esc, launch, STORES } from "./capture.js";

const INK = "#1b1b2f";
const BG = `background:repeating-linear-gradient(0deg,#0000 0 23px,#1b1b2f08 23px 24px),#f4f1e8`;
const MONO = `ui-monospace, Menlo, monospace`;
const LOOKS = [
  { color: "color-blue", accessory: "acc-scarf", pet: "pet-cat" },
  { color: "color-pink", hat: "hat-crown", accessory: "acc-shades", pet: "pet-slime" },
  { color: "color-mint", hat: "hat-cap", accessory: "acc-scarf" },
  { color: "color-purple", hat: "hat-witch", pet: "pet-bat" },
  { color: "color-gold", antenna: "antenna-heart", accessory: "acc-shades" },
];
const MOODS = ["happy", "party", "proud", "lookLeft", "blink"];
const pair = (i, pet) => `<div style="display:flex;align-items:flex-end;gap:12px">${pet ? `<canvas id="p${i}"></canvas>` : ""}<canvas id="b${i}"></canvas></div>`;
const bot = (i, look, mood, scale) => [
  { id: `b${i}`, mood, equipped: look, scale },
  ...(look.pet ? [{ id: `p${i}`, pet: look.pet, scale: Math.round(scale * 0.62) }] : []),
];
const label = (s, bg = "#ffd84a") =>
  `<div style="display:inline-block;background:${bg};border:3px solid ${INK};box-shadow:5px 5px 0 ${INK};padding:6px 16px;font-size:24px;font-weight:700">${esc(s)}</div>`;

const W = 1600, H = 1200;
const web = png(readFileSync(`${root}dist/store/en/2-stop.png`));
const phone = png(readFileSync(`${root}dist/play/raw/en/1-stop.png`));

const hero = {
  w: W, h: H,
  beepo: LOOKS.flatMap((look, i) => bot(i, look, MOODS[i], 7)),
  html: `<div style="height:${H}px;${BG};font-family:${MONO};padding:48px 56px;display:flex;flex-direction:column;gap:34px">
    <div style="font-size:52px;font-weight:800;line-height:1.2">Beepo: a tiny pixel robot that nudges you<br>when you've been scrolling too long</div>
    <div style="display:flex;gap:44px;align-items:flex-start">
      <div style="display:flex;flex-direction:column;gap:18px">
        ${label("on websites (browser extension)")}
        <div style="width:1070px;height:666px;overflow:hidden"><img src="${web}" style="width:1352px;margin:-118px 0 0 -148px;display:block"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        ${label("on Android")}
        <div class="shot" style="border-radius:24px;overflow:hidden;height:662px;display:flex;flex-direction:column;justify-content:flex-end"><img src="${phone}" style="width:327px;display:block"></div>
      </div>
    </div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:auto">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="font-size:26px;font-weight:700">keep your limits → earn stars → buy him hats</div>
        <div style="display:flex;align-items:flex-end;gap:34px">${LOOKS.map((l, i) => pair(i, !!l.pet)).join("")}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:14px">
        <div style="font-size:26px;font-weight:700">free · no account · no tracking</div>
        <div style="display:flex;gap:18px">${STORES.map((s) => `<div style="display:flex;align-items:center;gap:8px;font-size:22px;font-weight:700"><img src="${s.logo}" style="width:34px;height:34px">${esc(s.name)}</div>`).join("")}</div>
      </div>
    </div>
  </div>`,
};

const ALL = [...LOOKS, {}, { color: "color-blue", hat: "hat-party", pet: "pet-ghost" }, { color: "color-mint", antenna: "antenna-star" }];
const ALL_MOODS = ["happy", "party", "proud", "lookLeft", "blink", "sleepy", "worried", "sad"];
const lineup = {
  w: W, h: H,
  beepo: ALL.flatMap((look, i) => bot(i, look, ALL_MOODS[i], 13)),
  html: `<div style="height:${H}px;${BG};display:grid;grid-template-columns:repeat(4,1fr);align-content:center;align-items:end;justify-items:center;row-gap:150px;padding:0 60px">
    ${ALL.map((l, i) => pair(i, !!l.pet)).join("")}</div>`,
};

const dir = `${root}dist/social/reddit/`;
mkdirSync(dir, { recursive: true });
const { ctx, composer } = await launch();
writeFileSync(`${dir}hero.png`, await render(composer, hero));
writeFileSync(`${dir}lineup.png`, await render(composer, lineup));
await ctx.close();
console.log("dist/social/reddit/hero.png, lineup.png");
