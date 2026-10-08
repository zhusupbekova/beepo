// Shared by store-assets.js and social-assets.js: launches Playwright's Chromium with
// the extension, serves wordless mock sites (*.example), seeds storage, and renders
// HTML compositions (with Beepo drawn by the real sprite code) to PNG.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import * as core from "../extension/lib/core.js";

export const root = new URL("../", import.meta.url).pathname;
export const ext = root + "extension";
export const spriteJs = readFileSync(ext + "/render/sprite.js", "utf8");
export const sprites = JSON.parse(readFileSync(ext + "/data/sprites.json", "utf8"));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- seeded data ----------

const rule = (id, pattern, mode, minutes, extra = {}) => ({
  id, name: pattern, patterns: [pattern], mode, minutes, weekendMinutes: null, block: false, hidden: false, focus: null, ...extra,
});
const RULES = [
  rule("feed", "feed.example", "limit", 30),
  rule("videos", "videos.example", "limit", 45),
  rule("news", "news.example", "limit", 20, { block: true }),
  rule("learn", "learn.example", "goal", 20),
];

export function seedData(lang, settings = {}) {
  const today = core.dateKey(Date.now(), core.DEFAULT_SETTINGS.resetHour);
  const history = [];
  // Two weeks: rough start, then four good days in a row (rosy cheeks).
  const daily = [
    [41, 70, 25, 5], [38, 62, 30, 10], [44, 55, 22, 0], [35, 58, 18, 12], [40, 66, 26, 8], [29, 50, 21, 20], [36, 52, 24, 14],
    [33, 49, 19, 22], [31, 47, 23, 18], [34, 51, 17, 25], [27, 40, 15, 21], [25, 38, 12, 24], [22, 44, 16, 30],
  ];
  daily.forEach((mins, i) => {
    const date = core.addDays(today, i - daily.length);
    const day = { ...core.newDay(date), usage: Object.fromEntries(RULES.map((r, j) => [r.id, mins[j] * 60])) };
    day.domains = { "shop.example": (52 + (i % 3) * 6) * 60 };
    history.push(core.finalizeDay(day, RULES));
  });
  const day = {
    ...core.newDay(today),
    usage: { feed: 12 * 60, videos: 49 * 60, news: 21 * 60, learn: 14 * 60 },
    domains: { "feed.example": 720, "videos.example": 2940, "news.example": 1260, "learn.example": 840, "shop.example": 3100 },
    notified: { feed: [], videos: ["limit50", "limit80", "limit100", "over"], news: ["limit50", "limit80", "limit100"], learn: ["goal50"] },
  };
  const owned = ["color-blue", "acc-scarf", "pet-cat", "antenna-heart", "hat-party"];
  const wallet = {
    ...core.DEFAULT_WALLET, stars: 23, earned: 41, goalsMet: 6, owned,
    equipped: { color: "color-blue", hat: null, antenna: "antenna-heart", accessory: "acc-scarf", pet: "pet-cat" },
    badges: ["first_star", "streak3"],
  };
  settings = { ...core.DEFAULT_SETTINGS, lang, wander: false, sound: false, scale: 5, ...settings };
  return { sync: { rules: RULES, settings, wallet }, local: { day, history, pending: [], custom: [] } };
}

// ---------- mock sites (no words, so they suit every language) ----------

export function mockSite(host) {
  const hue = { "feed.example": 330, "videos.example": 0, "news.example": 210 }[host] ?? 150;
  const bar = (w, h = 10, c = "#0001") => `<div style="width:${w}%;height:${h}px;background:${c};border-radius:5px;margin:8px 0"></div>`;
  const card = (i) => {
    const media = `<div style="aspect-ratio:${host === "videos.example" ? "16/9" : "4/3"};border-radius:12px;background:linear-gradient(135deg,hsl(${(hue + i * 37) % 360} 70% 80%),hsl(${(hue + i * 37 + 40) % 360} 70% 65%))"></div>`;
    return `<div style="background:#fff;border-radius:14px;padding:12px;box-shadow:0 1px 4px #0001">${media}${bar(85, 12, "#0002")}${bar(55)}</div>`;
  };
  const cols = host === "news.example" ? 2 : 4;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${host}</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:hsl(${hue} 30% 97%)">
<header style="height:60px;display:flex;align-items:center;gap:16px;padding:0 28px;background:#fff;box-shadow:0 1px 0 #0001">
  <div style="width:30px;height:30px;border-radius:8px;background:hsl(${hue} 70% 60%)"></div>
  <b style="font-size:18px;color:#333">${host}</b>
  <div style="flex:1"></div><div style="width:280px;height:34px;border-radius:17px;background:#0000000d"></div>
  <div style="width:34px;height:34px;border-radius:50%;background:hsl(${hue + 60} 50% 75%)"></div>
</header>
<main style="max-width:1120px;margin:24px auto;display:grid;grid-template-columns:repeat(${cols},1fr);gap:20px;padding:0 24px">
  ${Array.from({ length: cols * 3 }, (_, i) => card(i)).join("")}
</main></body></html>`;
}

// ---------- framing ----------

export const png = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
export const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
export const FONT = `ui-monospace, Menlo, "PingFang TC", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", "Geeza Pro", "Kohinoor Devanagari", monospace`;
export const BASE_CSS = `*{box-sizing:border-box} body{margin:0;background:#f4f1e8;color:#1b1b2f;font-family:${FONT};overflow:hidden}
canvas{image-rendering:pixelated} .shot{border:4px solid #1b1b2f;box-shadow:8px 8px 0 #1b1b2f;display:block}`;

export async function render(page, { w, h, html, beepo = [] }) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${html}</body></html>`);
  await page.addScriptTag({ content: spriteJs });
  await page.evaluate(
    ({ sprites, beepo }) => {
      for (const b of beepo) {
        const c = document.getElementById(b.id);
        if (b.pet) BeepoSprite.drawPet(c, { sprites }, b.pet, 0, b.scale);
        else BeepoSprite.draw(c, { sprites }, { mood: b.mood || "happy", scale: b.scale, look: { equipped: b.equipped || {} } });
      }
    },
    { sprites, beepo }
  );
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  return page.screenshot({ scale: "css" });
}

/** Starts the browser with the extension loaded. `seed(lang, settings)` resets storage. */
export async function launch() {
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  sw ||= await ctx.waitForEvent("serviceworker");
  const extId = new URL(sw.url()).host;
  await ctx.route(/^https:\/\/[a-z]+\.example\//, (route) =>
    route.fulfill({ contentType: "text/html", body: mockSite(new URL(route.request().url()).host) })
  );
  const composer = await ctx.newPage();
  const seed = (lang, settings) =>
    sw.evaluate(async ({ sync, local }) => {
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      await chrome.storage.sync.set(sync);
      await chrome.storage.local.set(local);
    }, seedData(lang, settings));
  return { ctx, sw, extId, composer, seed };
}
