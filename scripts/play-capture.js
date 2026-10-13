// Phone captures for the Play screenshots, per language, into dist/play/raw/<lang>/ (then `npm run play`).
// Drives a debug build on an emulator: seeds files/*.json via run-as, switches settings.lang, and
// screenshots each scene. Needs, once, by hand: onboarding done, Usage access and "display over other
// apps" allowed, the Beepo widget on the home screen, and a few real minutes today in YouTube, Chrome,
// Photos, Gmail and Docs (Android counts them, Beepo only reads the log). Optional: Maps, Messages.
// Usage: ANDROID_SERIAL=emulator-5558 node scripts/play-capture.js [en ja …]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import * as core from "../extension/lib/core.js";

const root = new URL("../", import.meta.url).pathname;
// --only=screens or --only=chrome runs one phase.
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const langs = args.filter((a) => !a.startsWith("--")).length ? args.filter((a) => !a.startsWith("--")) : Object.keys(core.LANGUAGES);
const PKG = "studio.panikka.beepo";
const PORT = 8765;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...a) => execFileSync("adb", a, { encoding: "utf8" });
const sh = (cmd) => adb("shell", cmd);

// ---------- seeded data ----------

// Rule names are typed by the user, so they follow the language; brand names stay.
const PICS = {
  en: "Photos & Gmail", es: "Fotos y Gmail", fr: "Photos et Gmail", de: "Fotos & Gmail", it: "Foto e Gmail",
  pt_BR: "Fotos e Gmail", ru: "Фото и Gmail", uk: "Фото й Gmail", tr: "Fotoğraflar ve Gmail", ar: "الصور وGmail",
  hi: "फ़ोटो और Gmail", id: "Foto & Gmail", ja: "フォトとGmail", ko: "포토·Gmail", zh_CN: "相册和 Gmail",
  zh_TW: "相簿和 Gmail", yue: "相簿同 Gmail",
};
const DOCS = { ru: "Документы", uk: "Документи", ja: "ドキュメント", ko: "문서", zh_CN: "文档", zh_TW: "文件", yue: "文件" };

const rule = (id, name, apps, mode, minutes, extra = {}) => ({
  id, name, patterns: [], apps, mode, minutes, weekendMinutes: null, block: false, hidden: false, focus: null, ...extra,
});
const rules = (lang, chrome = {}) => [
  rule("yt", "YouTube", ["com.google.android.youtube"], "limit", 15, { weekendMinutes: 30 }),
  rule("web", "Chrome", ["com.android.chrome"], "limit", 20, { block: true, ...chrome }),
  rule("pics", PICS[lang], ["com.google.android.apps.photos", "com.google.android.gm"], "limit", 20),
  rule("read", DOCS[lang] || "Docs", ["com.google.android.apps.docs"], "goal", 5),
];

// Two weeks: a rough start, then nine days under every limit (cheeks + growth spurt).
function history() {
  const today = core.dateKey(Date.now(), 4);
  const daily = [
    [28, 22, 30, 2], [24, 19, 26, 6], [31, 12, 22, 0], [16, 8, 18, 7],
    [14, 9, 17, 6], [12, 7, 15, 8], [15, 10, 19, 5], [13, 6, 12, 9], [11, 8, 16, 6], [14, 5, 14, 7], [9, 7, 11, 10], [12, 6, 13, 6], [10, 4, 12, 8],
  ];
  const pkgs = ["com.google.android.youtube", "com.android.chrome", "com.google.android.apps.photos", "com.google.android.apps.docs"];
  const rs = rules("en");
  return daily.map((m, i) => {
    const date = core.addDays(today, i - daily.length);
    const domains = { ...Object.fromEntries(pkgs.map((p, j) => [p, m[j] * 60])), "com.google.android.apps.messaging": (20 + (i % 4) * 5) * 60 };
    return core.finalizeDay({ ...core.newDay(date), usage: Object.fromEntries(rs.map((r, j) => [r.id, m[j] * 60])), domains }, rs);
  });
}

// Free items everywhere except the Plus shot.
const wallet = (plus) => ({
  stars: 23, earned: 47, goalsMet: 9,
  owned: ["color-blue", "color-pink", "acc-scarf", "antenna-heart", "hat-party", "pet-cat", "hat-witch", "scene-night"],
  equipped: plus
    ? { color: "color-blue", hat: "hat-witch", antenna: null, accessory: "acc-scarf", pet: "pet-cat", scene: "scene-night" }
    : { color: "color-blue", hat: "hat-party", antenna: null, accessory: "acc-scarf", pet: null, scene: null },
  badges: ["first_star", "streak3", "week_clean", "unsnoozable", "fashionista"],
  seen: ["hat-witch", "pet-bat"],
});

function put(name, data) {
  const tmp = "/tmp/beepo-seed.json";
  writeFileSync(tmp, JSON.stringify(data));
  adb("push", "-q", tmp, "/data/local/tmp/seed.json");
  sh(`run-as ${PKG} sh -c 'mkdir -p files && cat /data/local/tmp/seed.json > files/${name}'`);
}

// ---------- device ----------

function nodes() {
  try {
    sh("uiautomator dump /sdcard/ui.xml >/dev/null");
  } catch {
    return []; // "null root node" while the screen changes; the caller retries
  }
  const xml = adb("exec-out", "cat", "/sdcard/ui.xml");
  const unesc = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return [...xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
    .map((m) => ({ text: unesc(m[1] || m[2]), x: (+m[3] + +m[5]) >> 1, y: (+m[4] + +m[6]) >> 1 }))
    .filter((n) => n.text);
}

async function find(text, tries = 10) {
  for (let i = 0; i < tries; i++) {
    const all = nodes();
    const n = all.find((n) => n.text === text) || all.find((n) => n.text.includes(text));
    if (n) return n;
    await wait(800);
  }
  throw new Error(`"${text}" not on screen`);
}

async function tap(text) {
  const n = await find(text);
  sh(`input tap ${n.x} ${n.y}`);
}

const top = () => sh("dumpsys activity activities").match(/topResumedActivity=ActivityRecord\{\S+ \S+ (\S+)/)?.[1] || "";
const stop = () => sh(`am force-stop ${PKG}`);
const home = () => sh("input keyevent HOME");
async function launch(ms = 5000) {
  sh(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1`);
  await wait(ms);
}
function shot(file) {
  writeFileSync(file, execFileSync("adb", ["exec-out", "screencap", "-p"], { maxBuffer: 64 << 20 }));
}

/** Counts pixels in a box of a screenshot that pass `test(r, g, b)`. */
function countPixels(file, [x, y, w, h], test) {
  const rgb = execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", `crop=${w}:${h}:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 });
  let n = 0;
  for (let i = 0; i < rgb.length; i += 3) if (test(rgb[i], rgb[i + 1], rgb[i + 2])) n++;
  return n;
}
// Beepo's ink (#1b1b2f): his overlay isn't in uiautomator's dump, so look for it.
const ink = (r, g, b) => Math.abs(r - 27) + Math.abs(g - 27) + Math.abs(b - 47) < 30;
const colorful = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 40;

function demoBar(on) {
  const b = (args) => sh(`am broadcast -a com.android.systemui.demo ${args} >/dev/null`);
  if (!on) return b("-e command exit");
  sh("settings put global sysui_demo_allowed 1");
  b("-e command enter");
  b("-e command clock -e hhmm 0941");
  b("-e command battery -e level 100 -e plugged false");
  b("-e command network -e wifi show -e level 4 -e fully true -e mobile hide");
  b("-e command notifications -e visible false");
}

// A wordless feed for Beepo to stand on (the emulator needs no internet for it).
function feedPage() {
  const bar = (w, h, c) => `<div style="width:${w}%;height:${h}px;border-radius:5px;background:${c};margin-top:8px"></div>`;
  const card = (i) => `<div style="background:#fff;border-radius:16px;margin:14px;padding:12px;box-shadow:0 1px 4px #0001">
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div style="width:36px;height:36px;border-radius:50%;background:hsl(${(330 + i * 53) % 360} 60% 70%)"></div>
    <div style="flex:1">${bar(40, 10, "#0002")}${bar(25, 8, "#0001")}</div></div>
    <div style="aspect-ratio:1;border-radius:12px;background:linear-gradient(135deg,hsl(${(330 + i * 37) % 360} 75% 78%),hsl(${(380 + i * 37) % 360} 70% 62%))"></div>
    ${bar(80, 10, "#0002")}${bar(50, 10, "#0001")}</div>`;
  const story = (i) => `<div style="flex:none;width:62px;height:62px;border-radius:50%;border:3px solid hsl(${(330 + i * 30) % 360} 80% 60%);background:hsl(${(200 + i * 40) % 360} 50% 85%)"></div>`;
  return `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>feed</title>
<body style="margin:0;background:hsl(330 30% 97%)">
<div style="position:sticky;top:0;height:56px;background:#fff;display:flex;align-items:center;gap:12px;padding:0 16px;box-shadow:0 1px 0 #0001">
<div style="width:30px;height:30px;border-radius:9px;background:hsl(330 70% 60%)"></div><div style="flex:1;height:32px;border-radius:16px;background:#0000000d"></div>
<div style="width:32px;height:32px;border-radius:50%;background:hsl(30 60% 75%)"></div></div>
<div style="display:flex;gap:14px;padding:14px 14px 0;overflow:hidden">${Array.from({ length: 6 }, (_, i) => story(i)).join("")}</div>
${Array.from({ length: 8 }, (_, i) => card(i)).join("")}</body>`;
}

const openFeed = () => sh(`am start -a android.intent.action.VIEW -d http://localhost:${PORT}/ com.android.chrome >/dev/null`);

// ---------- scenes ----------

function context(lang) {
  const i18n = JSON.parse(readFileSync(`${root}extension/data/i18n/${lang}.json`, "utf8"));
  const dir = `${root}dist/play/raw/${lang}/`;
  mkdirSync(dir, { recursive: true });
  const seed = (plus = false, chrome = {}, settings = {}) => {
    stop();
    put("rules.json", rules(lang, chrome));
    put("history.json", history());
    put("wallet.json", wallet(plus));
    put("settings.json", { onboarded: true, overlay: true, stayOut: false, scale: 4, lang, ...settings });
    put("pending.json", []);
    // A fresh day for today, so launching doesn't roll an old one into the seeded history (news, stars).
    put("day.json", { date: core.dateKey(Date.now(), 4) });
  };
  return { i18n, dir, seed };
}

// Beepo's own screens. Run for every language before the Chrome scenes, which add real Chrome time.
async function screens(lang) {
  const { i18n, dir, seed } = context(lang);

  // Tabs. The first refresh reads the usage log, so give it a moment.
  seed();
  await launch(4000);
  await find("Maps", 20).catch(() => {}); // "Today on your phone" fills in a moment later
  await wait(1000);
  shot(dir + "2-limits.png");
  for (const [tab, name] of [["tab_report", "6-report"], ["tab_badges", "4-streaks"], ["tab_shop", "3-shop"]]) {
    await tap(i18n.ui[tab]);
    await wait(1500);
    shot(dir + name + ".png");
  }

  // Plus: the widget with a scene and a pet. Plus itself is the debug toggle in settings.
  seed(true);
  await launch(5000);
  await tap("⚙️");
  await wait(1200);
  for (let i = 0; i < 3; i++) sh("input swipe 540 2000 540 300 300");
  await wait(800);
  await tap("Dev: Plus off");
  await wait(1000);
  home();
  await wait(3000);
  shot(dir + "7-plus.png");

  // Privacy: the usage access page of the intro.
  seed(false, {}, { onboarded: false });
  await launch(5000);
  for (let i = 0; i < 2; i++) {
    await tap(i18n.android.next);
    await wait(1500);
  }
  shot(dir + "8-private.png");
  seed();
}

async function chromeScenes(lang) {
  const { i18n, dir, seed } = context(lang);

  // STOP sign: Chrome over its limit, not blocking. Beepo pops up (bubble + sign) each time the app
  // comes to the front; retried until the feed is drawn and the bubble is up.
  seed(false, { minutes: 1, block: false });
  await launch(4000);
  home();
  openFeed();
  await wait(8000);
  sh("input swipe 300 1400 300 1150 400");
  await wait(1000);
  const full = dir + "1-stop.full.png";
  for (let attempt = 1; ; attempt++) {
    home();
    await wait(2000);
    sh("monkey -p com.android.chrome -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1");
    await wait(3500);
    if (nodes().some((n) => n.text.includes("isn't responding"))) {
      await tap("Wait");
    } else {
      shot(full);
      // The first card's picture, and the bubble's border above him in the bottom right.
      const drawn = countPixels(full, [60, 700, 960, 500], colorful) > 200000;
      if (drawn && countPixels(full, [300, 1650, 760, 500], ink) > 2000) break;
    }
    if (attempt === 5) throw new Error("no STOP bubble");
  }
  // Chrome's address bar (localhost) and the status bar come off; the feed has its own header.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", full, "-vf", "crop=iw:ih-212:0:212", dir + "1-stop.png"]);
  rmSync(full);

  // Block screen: Chrome closes and Beepo stays over the home screen. How long that takes varies, so retry.
  seed(false, { minutes: 1, block: true });
  await launch(4000);
  for (let attempt = 1; ; attempt++) {
    sh("am force-stop com.android.chrome");
    home();
    openFeed();
    for (let i = 0; i < 20 && !top().includes("chrome"); i++) await wait(500);
    for (let i = 0; i < 80 && !top().includes("launcher"); i++) await wait(500);
    try {
      await find(i18n.ui.unlock.split(/[（(]/)[0].trim(), 15);
      break;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
  await wait(800);
  shot(dir + "5-block.png");
  sh("input keyevent BACK");

  seed();
}

// ---------- main ----------

const server = createServer((_, res) => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(feedPage())).listen(PORT);
adb("reverse", `tcp:${PORT}`, `tcp:${PORT}`);
demoBar(true);
try {
  if (only !== "chrome") {
    for (const lang of langs) {
      await screens(lang);
      console.log(`raw/${lang}: screens`);
    }
  }
  if (only !== "screens") {
    for (const lang of langs) {
      await chromeScenes(lang);
      console.log(`raw/${lang}: chrome`);
    }
  }
} finally {
  stop();
  home();
  demoBar(false);
  adb("reverse", "--remove", `tcp:${PORT}`);
  server.close();
}
