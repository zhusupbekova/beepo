// Renders store assets for every language into dist/store/:
//   <lang>/1-page.png … 6-report.png   screenshots, 1280×800
//   <lang>/promo-440x280.png           small promo tile (Chrome, Edge)
//   <lang>/marquee-1400x560.png        marquee tile (Chrome, Edge)
//   <lang>/listing.txt                 name, short and full description
//   icon-128.png, logo-300.png         store icon / Edge logo
//
// Drives the real extension in Playwright's Chromium on mock sites (*.example),
// with seeded storage. Usage: npm run store [-- en ja …]
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import * as core from "../extension/lib/core.js";
import { root, ext, wait, render, png, esc, launch } from "./capture.js";

const out = root + "dist/store/";
const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(core.LANGUAGES);

function pageSlide(caption, shot, dir) {
  return {
    w: 1280, h: 800,
    html: `<div dir="${dir}" style="height:800px;display:flex;flex-direction:column;align-items:center;padding-top:34px;gap:30px">
      <div style="font-size:38px;font-weight:bold;max-width:1150px;text-align:center;line-height:1.25">${esc(caption)}</div>
      <img class="shot" src="${png(shot)}" style="width:1000px;height:625px">
    </div>`,
  };
}

function popupSlide(caption, shot, dir, mood) {
  return {
    w: 1280, h: 800,
    html: `<div dir="${dir}" style="height:800px;display:flex;align-items:center;justify-content:center;gap:90px;padding:0 70px">
      <div style="flex:1;display:flex;flex-direction:column;gap:40px;align-items:center;text-align:center">
        <div style="font-size:44px;font-weight:bold;line-height:1.25">${esc(caption)}</div>
        <canvas id="b"></canvas>
      </div>
      <div style="max-height:720px;overflow:hidden" class="shot"><img src="${png(shot)}" style="width:384px;display:block"></div>
    </div>`,
    beepo: [{ id: "b", scale: 10, mood, equipped: { antenna: "antenna-heart", accessory: "acc-scarf" } }],
  };
}

// ---------- main ----------

const { ctx, sw, extId, composer, seed } = await launch();

mkdirSync(out, { recursive: true });
copyFileSync(ext + "/icons/icon128.png", out + "icon-128.png");
writeFileSync(
  out + "logo-300.png",
  await render(composer, {
    w: 300, h: 300,
    html: `<div style="height:300px;display:flex;align-items:center;justify-content:center"><canvas id="b"></canvas></div>`,
    beepo: [{ id: "b", scale: 12 }],
  })
);

for (const lang of langs) {
  const i18n = JSON.parse(readFileSync(`${ext}/data/i18n/${lang}.json`, "utf8"));
  const store = JSON.parse(readFileSync(`${root}store/${lang}.json`, "utf8"));
  const dir = `${out}${lang}/`;
  mkdirSync(dir, { recursive: true });
  const save = (name, buf) => writeFileSync(dir + name, buf);

  await seed(lang);

  // On-page scenes: Beepo greets with the site's status on load.
  const site = async (host, settle = 2200) => {
    // A smaller window at 2× so Beepo and his bubble read well once framed.
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 960, height: 600 });
    await p.goto(`https://${host}/`);
    await wait(settle);
    const buf = await p.screenshot({ scale: "device" });
    await p.close();
    return buf;
  };
  save("1-page.png", await render(composer, pageSlide(store.captions.page, await site("feed.example"), i18n.dir)));
  save("2-stop.png", await render(composer, pageSlide(store.captions.stop, await site("videos.example"), i18n.dir)));
  save("3-block.png", await render(composer, pageSlide(store.captions.block, await site("news.example", 1500), i18n.dir)));

  // Popup scenes, rendered at popup width and 2× for crisp text.
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 384, height: 720 });
  popup.on("pageerror", (e) => console.error(`popup (${lang}):`, e.message));
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("#list .rule");
  const tab = async (name) => {
    await popup.click(`nav [data-tab="${name}"]`);
    await wait(300);
    return popup.screenshot({ scale: "device", fullPage: true });
  };
  save("4-today.png", await render(composer, popupSlide(store.captions.today, await tab("today"), i18n.dir, "happy")));
  await popup.click(`nav [data-tab="shop"]`);
  await popup.hover(".item:has(canvas) >> nth=7"); // preview a hat
  await wait(200);
  save("5-shop.png", await render(composer, popupSlide(store.captions.shop, await popup.screenshot({ scale: "device", fullPage: true }), i18n.dir, "proud")));
  save("6-report.png", await render(composer, popupSlide(store.captions.report, await tab("report"), i18n.dir, "party")));
  await popup.close();

  // Promo tiles.
  const tile = (w, h, scale, nameSize, tagSize) => ({
    w, h,
    html: `<div dir="${i18n.dir}" style="height:${h}px;display:flex;align-items:center;justify-content:center;gap:${scale * 4}px;padding:0 ${scale * 3}px;
        background:repeating-linear-gradient(0deg,#0000 0 ${scale * 2 - 1}px,#1b1b2f08 ${scale * 2 - 1}px ${scale * 2}px),#f4f1e8">
      <div style="display:flex;align-items:flex-end;gap:${scale}px"><canvas id="p"></canvas><canvas id="b"></canvas></div>
      <div style="display:flex;flex-direction:column;gap:${scale}px;max-width:${w * 0.55}px">
        <div style="font-size:${nameSize}px;font-weight:bold;line-height:1">Beepo</div>
        <div style="font-size:${tagSize}px;line-height:1.3">${esc(store.tagline)}</div>
      </div></div>`,
    beepo: [
      { id: "b", scale, mood: "happy", equipped: { hat: "hat-party" } },
      { id: "p", pet: "pet-cat", scale: Math.round(scale * 0.75) },
    ],
  });
  save("promo-440x280.png", await render(composer, tile(440, 280, 6, 48, 17)));
  save("marquee-1400x560.png", await render(composer, tile(1400, 560, 16, 120, 40)));

  writeFileSync(
    dir + "listing.txt",
    `NAME\n${store.name}\n\nSHORT DESCRIPTION / SUMMARY\n${store.short}\n\nDESCRIPTION\n${store.description}\n`
  );
  console.log(`store/${lang}`);
}

await ctx.close();
