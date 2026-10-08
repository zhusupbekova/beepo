// Social media assets into dist/social/:
//   xhs/                 Xiaohongshu (zh_CN): 1-6.png at 1080×1440 (3:4) + video.mp4
//   threads/<lang>/      Threads (en, ru, yue, zh_TW): 1-4.png at 1080×1350 (4:5) + video.mp4
//   tiktok/              TikTok / Reels / Shorts (en): video.mp4 at 1080×1920 (9:16), ~25s, silent
// Uses the real extension (see capture.js). Needs ffmpeg for the videos.
// Usage: npm run social [-- xhs en ru yue zh_TW tiktok]
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { root, wait, render, png, esc, launch } from "./capture.js";

const out = root + "dist/social/";
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["xhs", "en", "ru", "yue", "zh_TW", "tiktok"];

const MONO = `ui-monospace, Menlo, monospace`;
const FONTS = {
  zh_CN: `"PingFang SC", "Hiragino Sans GB", sans-serif`,
  zh_TW: `"PingFang TC", sans-serif`,
  yue: `"PingFang HK", "PingFang TC", sans-serif`,
};

// On-image copy. Written per language, not translated line by line.
const COPY = {
  zh_CN: {
    title: "我给浏览器养了只\n像素小机器人",
    sub: "它叫 Beepo，专门盯着我别刷太久",
    page: "平时就蹲在网页右下角\n点它一下会跟你聊天",
    stop: "时间一到直接举「停」牌\n还会气鼓鼓地抖两下",
    block: "自制力为零的话\n还能开强制锁站（我开了）",
    shop: "守住限额攒星星\n给它买帽子、领养小猫",
    report: "每周报告\n看看这周省下多少时间",
    end: "Chrome · Edge · Firefox｜免费",
  },
  en: {
    title: "I made a tiny pixel robot\nthat lives on my websites",
    sub: "his name is Beepo and he keeps an eye on my screen time (kindly)",
    page: "he hangs out at the bottom of the page.\npoke him and he talks",
    stop: "when time's up he holds up\na tiny STOP sign",
    shop: "keep your limits, earn stars,\nbuy him hats (and a cat)",
    report: "a weekly report of\nthe time you got back",
    end: "free on Chrome · Edge · Firefox",
  },
  ru: {
    title: "Я сделала крошечного\nпиксельного робота",
    sub: "Его зовут Beepo, он живёт внизу сайтов и следит, чтобы я не залипала",
    page: "Сидит внизу страницы.\nТыкнешь — заговорит",
    stop: "Время вышло —\nподнимает табличку СТОП",
    shop: "Держишь лимит — получаешь звёзды.\nНа звёзды — шляпы и котик",
    report: "Недельный отчёт:\nсколько времени удалось вернуть",
    end: "Бесплатно · Chrome · Edge · Firefox",
  },
  yue: {
    title: "我整咗隻\n像素小機械人",
    sub: "佢叫 Beepo，住喺網頁底，專登睇住我唔好碌咁耐",
    page: "平時就喺網頁右下角\n㩒吓佢會同你傾偈",
    stop: "夠鐘就舉「停」牌\n仲會嬲到震吓震",
    shop: "守到限額就儲星星\n買帽俾佢、仲可以養貓",
    report: "每週報告\n睇吓今個禮拜慳返幾多時間",
    end: "Chrome · Edge · Firefox｜免費",
  },
  zh_TW: {
    title: "我做了一隻\n住在網頁裡的像素機器人",
    sub: "它叫 Beepo，負責盯著我不要一直滑",
    page: "平常就待在網頁右下角\n戳一下會跟你聊天",
    stop: "時間到就舉「停」牌\n還會氣到發抖",
    shop: "守住限額就能存星星\n幫它買帽子、還能養貓",
    report: "每週報告\n看看這週省下多少時間",
    end: "Chrome · Edge · Firefox｜免費",
  },
};

const lines = (s) => esc(s).replace(/\n/g, "<br>");
const LOOK = { hat: "hat-party", accessory: "acc-scarf" };
const BG = `background:repeating-linear-gradient(0deg,#0000 0 23px,#1b1b2f08 23px 24px),#f4f1e8`;

function cover(c, font, w, h) {
  return {
    w, h,
    html: `<div style="height:${h}px;${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;padding:0 70px;text-align:center;font-family:${font}">
      <div style="font-size:${font === MONO ? 60 : 76}px;font-weight:800;line-height:1.2">${lines(c.title)}</div>
      <div style="display:flex;align-items:flex-end;gap:24px"><canvas id="p"></canvas><canvas id="b"></canvas></div>
      <div style="font-size:38px;line-height:1.4;max-width:900px;opacity:.8">${lines(c.sub)}</div>
    </div>`,
    beepo: [{ id: "b", scale: 24, mood: "happy", equipped: LOOK }, { id: "p", pet: "pet-cat", scale: 16 }],
  };
}

function slide(caption, shot, font, w, h, shotWidth) {
  return {
    w, h,
    html: `<div style="height:${h}px;${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px;font-family:${font}">
      <div style="font-size:${font === MONO ? 50 : 60}px;font-weight:800;line-height:1.3;text-align:center;padding:0 60px">${lines(caption)}</div>
      <div class="shot" style="max-height:${h - 380}px;overflow:hidden"><img src="${png(shot)}" style="width:${shotWidth}px;display:block"></div>
    </div>`,
  };
}

function endCard(c, font, w, h) {
  return {
    w, h,
    html: `<div style="height:${h}px;${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:50px;font-family:${font}">
      <div style="display:flex;align-items:flex-end;gap:24px"><canvas id="p"></canvas><canvas id="b"></canvas></div>
      <div style="font:bold 120px ${MONO}">Beepo</div>
      <div style="font-size:44px">${esc(c.end)}</div>
    </div>`,
    beepo: [{ id: "b", scale: 22, mood: "proud", equipped: LOOK }, { id: "p", pet: "pet-cat", scale: 15 }],
  };
}

const { ctx, sw, extId, composer, seed } = await launch();

// Raw captures in one language. Phone-ish viewport so Beepo reads well in a feed.
async function captures(lang, vw, vh) {
  await seed(lang);
  const site = async (host, settle = 2200) => {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: vw, height: vh });
    await p.goto(`https://${host}/`);
    await wait(settle);
    const buf = await p.screenshot({ scale: "device" });
    await p.close();
    return buf;
  };
  const shots = { page: await site("feed.example"), stop: await site("videos.example"), block: await site("news.example", 1500) };
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 384, height: 720 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("#list .rule");
  for (const tab of ["shop", "report"]) {
    await popup.click(`nav [data-tab="${tab}"]`);
    await wait(300);
    if (tab === "shop") {
      await popup.hover(".item:has(canvas) >> nth=7");
      await wait(200);
    }
    shots[tab] = await popup.screenshot({ scale: "device", fullPage: true });
  }
  await popup.close();
  return shots;
}

// Screenshots a page as fast as it can for `ms` (counted from when `ready()` first
// holds, if given); returns entries for ffmpeg's concat demuxer.
async function record(p, ms, prefix, ready) {
  const list = [];
  let t0 = ready ? Infinity : Date.now();
  let last = Date.now();
  const cap = Date.now() + 30000;
  while (Date.now() - Math.min(t0, cap) < ms) {
    if (t0 === Infinity && (await ready())) t0 = Date.now();
    const file = `${prefix}${String(list.length).padStart(4, "0")}.png`;
    writeFileSync(file, await p.screenshot({ scale: "device" }));
    const now = Date.now();
    if (list.length) list[list.length - 1].d = (now - last) / 1000;
    list.push({ file, d: 0.1 });
    last = now;
  }
  return list;
}

// The last file is repeated so its duration is honored.
const concatList = (list) =>
  list.map((f) => `file '${f.file}'\nduration ${f.d.toFixed(3)}`).join("\n") + `\nfile '${list[list.length - 1].file}'\n`;

// Beepo counting down the last seconds of a 2-minute limit, then hitting it.
async function video(lang, c, font, vw, vh, dir) {
  const frames = `${dir}frames/`;
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  await seed(lang, { idleSeconds: 3600 });
  await sw.evaluate(async () => {
    const { rules } = await chrome.storage.sync.get("rules");
    await chrome.storage.sync.set({ rules: rules.map((r) => (r.id === "videos" ? { ...r, minutes: 2 } : r)) });
    const { day } = await chrome.storage.local.get("day");
    day.usage.videos = 111;
    day.notified.videos = ["limit50", "limit80"];
    await chrome.storage.local.set({ day });
  });
  const p = await ctx.newPage();
  await p.setViewportSize({ width: vw, height: vh });
  await p.goto(`https://videos.example/`);
  const list = await record(p, 15500, frames);
  await p.close();
  const endFile = `${frames}end.png`;
  writeFileSync(endFile, await render(composer, endCard(c, font, vw * 2, vh * 2)));
  list.push({ file: endFile, d: 3 });
  writeFileSync(`${frames}list.txt`, concatList(list));
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${frames}list.txt`,
    "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "18", "-movflags", "+faststart", `${dir}video.mp4`,
  ]);
  rmSync(frames, { recursive: true, force: true });
}

// ---------- TikTok (9:16) ----------
// Captions sit high and footage stays left of center, clear of TikTok's own
// buttons (right edge) and caption/username overlay (bottom ~400px).

const TIKTOK = {
  en: {
    hook: "POV: you can't stop\ndoomscrolling, so you\nadopt a tiny robot",
    page: "he lives at the bottom\nof every website\nand checks in on you",
    stop: "set a limit. when time's up\nhe holds up a tiny STOP sign",
    block: "still scrolling?\nhe can lock the site\n(kindly)",
    shop: "keep your limits, earn stars,\nbuy him hats (and a cat)",
    report: "and see how much time\nyou got back",
    end: "free on Chrome · Edge · Firefox",
    cta: "link in bio",
  },
};

const TT_W = 1080, TT_H = 1920;
const SLOT = { x: 140, y: 600, w: 800, h: 1000 }; // live footage, 400×500 viewport at 2x

function ttCard(caption, inner = "", beepo = []) {
  return {
    w: TT_W, h: TT_H, beepo,
    html: `<div style="position:relative;height:${TT_H}px;${BG}">
      <div style="position:absolute;left:50px;right:50px;top:220px;height:340px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 52px/1.3 ${MONO}">${lines(caption)}</div>
      ${inner}
    </div>`,
  };
}

const slotFrame = `<div class="shot" style="position:absolute;left:${SLOT.x - 4}px;top:${SLOT.y - 4}px;width:${SLOT.w + 8}px;height:${SLOT.h + 8}px;background:#fff"></div>`;
const popupFrame = (shot) =>
  `<div class="shot" style="position:absolute;left:240px;top:${SLOT.y}px;max-height:${SLOT.h}px;overflow:hidden"><img src="${png(shot)}" style="width:600px;display:block"></div>`;

// Big Beepo in the middle of the frame; `up` lifts him for a two-step bob.
function ttHero(top, bottom, mood, up, extra = "") {
  return ttCard(
    top,
    `${extra}<div style="position:absolute;left:0;right:0;top:${720 - (up ? 18 : 0)}px;display:flex;justify-content:center;align-items:flex-end;gap:28px"><canvas id="p"></canvas><canvas id="b"></canvas></div>
     <div style="position:absolute;left:0;right:0;top:1300px;text-align:center;font:${bottom.big ? "bold 120px" : "40px"} ${MONO}">${esc(bottom.text)}</div>
     ${bottom.sub ? `<div style="position:absolute;left:0;right:0;top:1460px;text-align:center;font:40px ${MONO}">${esc(bottom.sub)}</div>` : ""}`,
    [{ id: "b", scale: 26, mood, equipped: LOOK }, { id: "p", pet: "pet-cat", scale: 16 }]
  );
}

const ENC = ["-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", "-an"];

async function tiktok(lang) {
  const c = TIKTOK[lang];
  const dir = `${out}tiktok/`;
  const tmp = `${dir}tmp/`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const segments = [];
  const vw = SLOT.w / 2, vh = SLOT.h / 2;

  // A card scene: a few rendered frames looped for `seconds`.
  async function cardScene(name, cards, seconds, step = 0.3) {
    const files = [];
    for (const [i, card] of cards.entries()) {
      files.push(`${tmp}${name}-${i}.png`);
      writeFileSync(files[i], await render(composer, card));
    }
    const list = Array.from({ length: Math.round(seconds / step) }, (_, i) => ({ file: files[i % files.length], d: step }));
    writeFileSync(`${tmp}${name}.txt`, concatList(list));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${tmp}${name}.txt`, "-vf", "fps=30", ...ENC, `${tmp}${name}.mp4`]);
    segments.push(`${tmp}${name}.mp4`);
  }

  // A live scene: real footage of a page, framed under a caption.
  async function liveScene(name, caption, host, ms, settle = 1500, ready) {
    const bg = `${tmp}${name}-bg.png`;
    writeFileSync(bg, await render(composer, ttCard(caption, slotFrame)));
    const p = await ctx.newPage();
    await p.setViewportSize({ width: vw, height: vh });
    await p.goto(`https://${host}/`);
    await wait(settle);
    const list = await record(p, ms, `${tmp}${name}-`, ready);
    await p.close();
    writeFileSync(`${tmp}${name}.txt`, concatList(list));
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-loop", "1", "-i", bg, "-f", "concat", "-safe", "0", "-i", `${tmp}${name}.txt`,
      "-filter_complex", `[1:v]fps=30,scale=${SLOT.w}:${SLOT.h}[v];[0:v][v]overlay=${SLOT.x}:${SLOT.y}:shortest=1`,
      ...ENC, `${tmp}${name}.mp4`,
    ]);
    segments.push(`${tmp}${name}.mp4`);
  }

  await seed(lang, { idleSeconds: 3600 });
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 384, height: 720 });
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector("#list .rule");
  const shots = {};
  for (const tab of ["shop", "report"]) {
    await popup.click(`nav [data-tab="${tab}"]`);
    await wait(300);
    if (tab === "shop") {
      await popup.hover(".item:has(canvas) >> nth=7");
      await wait(200);
    }
    shots[tab] = await popup.screenshot({ scale: "device", fullPage: true });
  }
  await popup.close();

  const hero = (mood, up) => ttHero(c.hook, { text: "meet Beepo" }, mood, up);
  await cardScene("1-hook", [hero("happy", false), hero("happy", true), hero("happy", false), hero("blink", true)], 2.4);
  // From page load: Beepo waves and greets with how the day is going.
  await liveScene("2-page", c.page, "feed.example", 4000, 200);

  // A 2-minute limit with 4 seconds left: the first 5s tick goes over.
  await seed(lang, { idleSeconds: 3600 });
  await sw.evaluate(async () => {
    const { rules } = await chrome.storage.sync.get("rules");
    await chrome.storage.sync.set({ rules: rules.map((r) => (r.id === "videos" ? { ...r, minutes: 2 } : r)) });
    const { day } = await chrome.storage.local.get("day");
    day.usage.videos = 116;
    day.notified.videos = ["limit50", "limit80"];
    await chrome.storage.local.set({ day });
  });
  const limitHit = () =>
    sw.evaluate(async () => (await chrome.storage.local.get("day")).day.notified.videos.includes("limit100"));
  await liveScene("3-stop", c.stop, "videos.example", 4000, 1500, limitHit);
  await liveScene("4-block", c.block, "news.example", 2800);
  await cardScene("5-shop", [ttCard(c.shop, popupFrame(shots.shop))], 3);
  await cardScene("6-report", [ttCard(c.report, popupFrame(shots.report))], 2.7);
  const cta = `<div style="position:absolute;left:0;right:0;top:340px;text-align:center;font:800 64px ${MONO}">${esc(c.cta)} ↓</div>`;
  const end = (mood, up) => ttHero("", { text: "Beepo", big: true, sub: c.end }, mood, up, cta);
  await cardScene("7-end", [end("proud", false), end("proud", true)], 3.2);

  writeFileSync(`${tmp}all.txt`, segments.map((f) => `file '${f}'`).join("\n") + "\n");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${tmp}all.txt`, "-c", "copy", "-movflags", "+faststart", `${dir}video.mp4`]);
  rmSync(tmp, { recursive: true, force: true });
}

for (const target of targets) {
  if (target === "tiktok") {
    await tiktok("en");
    console.log("social/tiktok");
    continue;
  }
  const xhs = target === "xhs";
  const lang = xhs ? "zh_CN" : target;
  const c = COPY[lang];
  const font = FONTS[lang] || MONO;
  const [w, h] = xhs ? [1080, 1440] : [1080, 1350];
  const dir = xhs ? `${out}xhs/` : `${out}threads/${lang}/`;
  mkdirSync(dir, { recursive: true });
  const save = (name, buf) => writeFileSync(dir + name, buf);

  const vw = 540, vh = xhs ? 720 : 675;
  const s = await captures(lang, vw, vh);
  const order = xhs ? ["page", "stop", "block", "shop", "report"] : ["stop", "shop", "report"];
  save("1.png", await render(composer, cover(c, font, w, h)));
  for (const [i, key] of order.entries()) {
    const popupShot = key === "shop" || key === "report";
    save(`${i + 2}.png`, await render(composer, slide(c[key], s[key], font, w, h, popupShot ? 560 : 800)));
  }
  await video(lang, c, font, vw, vh, dir);
  console.log(`social/${target}`);
}

await ctx.close();
