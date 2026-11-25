// Raw desktop clips for X: a real feed (Bluesky's logged-out Discover), Beepo at full size, no
// captions, logos or end card. Usage: node scripts/hero-clips.js [stop door panic]
//   stop  — limit hit, STOP sign with the snooze buttons, scrolling goes on anyway
//   door  — same on a blocking rule: the page closes, a star reopens it for 5 min
//   panic — a doomscroll burst: "Doomscroll detected!" and he runs home
// Writes dist/social/hero/raw/<name>.webm plus one frame a second in dist/social/hero/frames/ to pick
// the cut; trim with ffmpeg afterwards (see dist/social/hero/README.md).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { ext, root, wait, seedData } from "./capture.js";
import * as core from "../extension/lib/core.js";

const OUT = root + "dist/social/hero/";
const W = 1024, H = 576; // Beepo is capped at 8 px per pixel: a smaller viewport makes him bigger on screen
const names = process.argv.slice(2).length ? process.argv.slice(2) : ["stop", "door", "panic"];

const RULE = { id: "bsky", name: "Bluesky", patterns: ["bsky.app"], apps: [], mode: "limit", minutes: 1, weekendMinutes: null, block: false, hidden: false, focus: null };

async function start(name, { usedSecs, block, minutes = 1 }) {
  rmSync(OUT + "raw/tmp", { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: "en-US",
    recordVideo: { dir: OUT + "raw/tmp", size: { width: W, height: H } },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  sw ||= await ctx.waitForEvent("serviceworker");
  const data = seedData("en", { scale: 8, wander: true, sound: false, idleSeconds: 3600, nagMinutes: 1, lang: "en" });
  data.sync.rules = [{ ...RULE, block, minutes }];
  data.sync.wallet.equipped = { color: "color-blue", hat: null, antenna: null, accessory: "acc-scarf", pet: null };
  data.local.day = { ...core.newDay(data.local.day.date), usage: { bsky: usedSecs }, domains: { "bsky.app": usedSecs } };
  await sw.evaluate(async ({ sync, local }) => {
    await chrome.storage.sync.clear();
    await chrome.storage.local.clear();
    await chrome.storage.sync.set(sync);
    await chrome.storage.local.set(local);
  }, data);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const log = (msg) => console.log(`${name} ${((Date.now() - t0) / 1000).toFixed(1)}s ${msg}`);
  await page.goto("https://bsky.app/", { waitUntil: "domcontentloaded" });
  // The sign-in modal shows up once the app has loaded; close it (and again if it comes back).
  const closeModal = async (timeout) => {
    try {
      await page.locator('[aria-label="Close welcome modal"]').first().click({ timeout });
      await wait(400);
    } catch {}
  };
  await closeModal(15000);
  await wait(1500);
  await closeModal(1000);
  await page.mouse.move(W / 2, 200);
  log("feed");
  const finish = async (file) => {
    // The context's initial blank tab is recorded too: take this page's own video.
    const video = page.video();
    await ctx.close();
    renameSync(await video.path(), OUT + "raw/" + file);
    rmSync(OUT + "raw/tmp", { recursive: true, force: true });
    mkdirSync(OUT + "frames", { recursive: true });
    for (const f of readdirSync(OUT + "frames")) if (f.startsWith(name + "-")) rmSync(OUT + "frames/" + f);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", OUT + "raw/" + file, "-vf", "fps=1", OUT + `frames/${name}-%03d.png`]);
    // Full take as 720p H.264; the posted cut is trimmed from this (see README.md).
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", OUT + "raw/" + file, "-vf", "scale=1280:720:flags=lanczos", "-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", "-an", OUT + `raw/${name}-full.mp4`]);
    console.log(`${name}: raw/${file}`);
  };
  // Slow, human-ish reading scroll.
  const browse = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await page.mouse.wheel(0, 90 + Math.random() * 160);
      await wait(350 + Math.random() * 500);
      if (await page.locator('[role="dialog"]').count()) await closeModal(800);
    }
  };
  const setSide = (side) => sw.evaluate(async (side) => {
    const { settings } = await chrome.storage.sync.get("settings");
    await chrome.storage.sync.set({ settings: { ...settings, side } });
  }, side);
  return { page, log, finish, browse, t0, setSide };
}

// Centre x of Beepo's ink (#1b1b2f) along the bottom of the page, or null if he isn't drawn there.
async function beepoX(page) {
  const png = await page.screenshot();
  const rgb = execFileSync("ffmpeg", ["-loglevel", "error", "-i", "pipe:0", "-vf", `crop=${W}:120:0:${H - 120}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { input: png, maxBuffer: 64 << 20 });
  let n = 0, sum = 0;
  for (let i = 0; i < rgb.length; i += 3) {
    if (Math.abs(rgb[i] - 27) + Math.abs(rgb[i + 1] - 27) + Math.abs(rgb[i + 2] - 47) < 30) {
      n++;
      sum += (i / 3) % W;
    }
  }
  return n > 150 ? Math.round(sum / n) : null;
}

const clips = {
  // Usage 49 s of a 1-minute limit: 80% bubble on the first tick (5 s), STOP on the third (15 s).
  async stop() {
    const { page, log, finish, browse } = await start("stop", { usedSecs: 49, block: false });
    await browse(22000);
    log("after stop");
    await browse(6000);
    await finish("stop.webm");
  },
  async door() {
    const { page, log, finish, browse } = await start("door", { usedSecs: 49, block: true });
    await browse(9000);
    log("door should be closed");
    await wait(3500);
    // The unlock button sits under the big Beepo in the middle of the block screen.
    const btn = (process.env.UNLOCK || "455,452").split(",").map(Number);
    {
      await page.mouse.move(btn[0], btn[1], { steps: 20 });
      await wait(900);
      await page.mouse.click(btn[0], btn[1]);
      log("unlock clicked");
      await wait(2500);
      await browse(5000);
    }
    await finish("door.webm");
  },
  // No limit pressure. Moving his home corner makes him walk across the page; a scroll burst over
  // 4000 px/s mid-walk makes him sprint the rest of the way with "Doomscroll detected!".
  async panic() {
    const { page, log, finish, browse, setSide } = await start("panic", { usedSecs: 0, block: false, minutes: 30 });
    await browse(10000);
    await setSide("left");
    log("walking left");
    await browse(3600);
    const x = await beepoX(page);
    log(`burst (beepo at x=${x})`);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 1800);
      await wait(80);
    }
    await browse(7000);
    await finish("panic.webm");
  },
};

mkdirSync(OUT + "raw", { recursive: true });
for (const n of names) {
  if (!clips[n]) throw new Error(`unknown clip ${n}`);
  await clips[n]();
}
