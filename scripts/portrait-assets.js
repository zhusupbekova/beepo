// The store screenshots in 3:4 (1080×1440) for Threads / Instagram carousels:
//   dist/social/portrait/<lang>/1-page.png … 6-report.png
// Same scenes and captions as store-assets.js. Usage: node scripts/portrait-assets.js [ja en …]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import * as core from "../extension/lib/core.js";
import { root, ext, wait, render, png, esc, launch } from "./capture.js";

const W = 1080, H = 1440;
const out = root + "dist/social/portrait/";
const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(core.LANGUAGES);

const caption = (text, size) =>
  `<div style="font-size:${size}px;font-weight:bold;max-width:960px;text-align:center;line-height:1.3;word-break:auto-phrase;text-wrap:balance">${esc(text)}</div>`;

function pageSlide(text, shot, dir, lang) {
  return {
    w: W, h: H,
    html: `<div dir="${dir}" lang="${lang.replace("_", "-")}" style="height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;padding:0 60px">
      ${caption(text, 54)}
      <img class="shot" src="${png(shot)}" style="width:900px;height:1050px">
    </div>`,
  };
}

function popupSlide(text, shot, dir, lang, mood) {
  return {
    w: W, h: H,
    html: `<div dir="${dir}" lang="${lang.replace("_", "-")}" style="height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px;padding:0 60px">
      ${caption(text, 54)}
      <div style="position:relative">
        <div style="max-height:1080px;overflow:hidden" class="shot"><img src="${png(shot)}" style="width:600px;display:block"></div>
        <canvas id="b" style="position:absolute;left:-110px;bottom:-30px"></canvas>
      </div>
    </div>`,
    beepo: [{ id: "b", scale: 9, mood, equipped: { antenna: "antenna-heart", accessory: "acc-scarf" } }],
  };
}

const { ctx, extId, composer, seed } = await launch();

for (const lang of langs) {
  const i18n = JSON.parse(readFileSync(`${ext}/data/i18n/${lang}.json`, "utf8"));
  const store = JSON.parse(readFileSync(`${root}store/${lang}.json`, "utf8"));
  const dir = `${out}${lang}/`;
  mkdirSync(dir, { recursive: true });
  const save = (name, buf) => writeFileSync(dir + name, buf);

  await seed(lang);

  // A small 6:7 window, scaled up so Beepo and his bubble fill the frame.
  const site = async (host, settle = 2200) => {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 450, height: 525 });
    await p.goto(`https://${host}/`);
    await wait(settle);
    const buf = await p.screenshot({ scale: "device" });
    await p.close();
    return buf;
  };
  save("1-page.png", await render(composer, pageSlide(store.captions.page, await site("feed.example"), i18n.dir, lang)));
  save("2-stop.png", await render(composer, pageSlide(store.captions.stop, await site("videos.example"), i18n.dir, lang)));
  save("3-block.png", await render(composer, pageSlide(store.captions.block, await site("news.example", 1500), i18n.dir, lang)));

  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 384, height: 720 });
  popup.on("pageerror", (e) => console.error(`popup (${lang}):`, e.message));
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("#list .rule");
  // Cropped to the content, so short tabs don't leave an empty frame.
  const shoot = async () => {
    const height = await popup.evaluate(() =>
      Math.ceil(Math.max(...[...document.body.querySelectorAll("*")].map((e) => e.getBoundingClientRect().bottom)) + 12)
    );
    return popup.screenshot({ scale: "device", fullPage: true, clip: { x: 0, y: 0, width: 384, height } });
  };
  const tab = async (name) => {
    await popup.click(`nav [data-tab="${name}"]`);
    await wait(300);
    return shoot();
  };
  save("4-today.png", await render(composer, popupSlide(store.captions.today, await tab("today"), i18n.dir, lang, "happy")));
  await popup.click(`nav [data-tab="shop"]`);
  await popup.hover(".item:has(canvas) >> nth=7");
  await wait(200);
  save("5-shop.png", await render(composer, popupSlide(store.captions.shop, await shoot(), i18n.dir, lang, "proud")));
  save("6-report.png", await render(composer, popupSlide(store.captions.report, await tab("report"), i18n.dir, lang, "party")));
  await popup.close();
  console.log(`portrait/${lang}`);
}

await ctx.close();
