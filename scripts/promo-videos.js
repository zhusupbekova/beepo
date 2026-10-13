// Promo videos into dist/social/promo/<id>.mp4: 1080×1920 (9:16), 15–25s, silent.
// All end on the stores (Chrome, Firefox, Edge, Google Play):
//   en     POV meme (cream, monospace)
//   ko     arcade (dark, stages, PRESS START)
//   ja     diary (grid paper, timestamps, tape)
//   zh_CN  Xiaohongshu (pink, numbered stickers)
//   halloween-<en|ko|ja|zh_CN>  costume reveal (rejected hats, countdown, witch + bat)
//   texts-en     lock-screen texts signed "—B" (the "-A" hook)
//   oneword-ko   "answer in one word" chat
//   flip-ja      before/after with an upside-down flip
//   moyu-zh_CN   caught slacking off at work (spreadsheet background)
// Live footage comes from the real extension (see capture.js); phone shots are the Android
// screenshots in dist/play/raw/<lang>/ (see docs/PLAY.md). Needs ffmpeg.
// Usage: npm run promo [-- en halloween-ko ...]
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { root, wait, render, png, esc, launch, record, concatList, STORES } from "./capture.js";

const out = root + "dist/social/promo/";
const ids = process.argv.slice(2);

const W = 1080, H = 1920;
const MONO = `ui-monospace, Menlo, monospace`;
const LOOK = { hat: "hat-party", accessory: "acc-scarf" };
const ENC = ["-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "18", "-an"];
const SLOT = { x: 140, y: 640, w: 800, h: 1000 }; // live footage, 400×500 viewport at 2x
const PHONE = { w: 540, y: 620 }; // Android screenshots (1080 wide), shown at half size

// `*word*` gets a highlighter stroke.
const lines = (s, hl = "#ffd84a") =>
  esc(s).replace(/\n/g, "<br>").replace(/\*(.+?)\*/g, `<span style="background:linear-gradient(#0000 58%,${hl} 58%)">$1</span>`);
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);

const { ctx, sw, composer, seed } = await launch();

// ---------- scenes ----------

let tmp, segments, n;

// Rendered cards, each shown for its own duration: [[card, seconds], ...]
async function cards(seq) {
  const name = `${tmp}${++n}`;
  const seen = new Map();
  const list = [];
  for (const [card, d] of seq) {
    const key = JSON.stringify(card);
    if (!seen.has(key)) {
      seen.set(key, `${name}-${seen.size}.png`);
      writeFileSync(seen.get(key), await render(composer, card));
    }
    list.push({ file: seen.get(key), d });
  }
  writeFileSync(`${name}.txt`, concatList(list));
  const total = seq.reduce((s, [, d]) => s + d, 0);
  ff(["-f", "concat", "-safe", "0", "-i", `${name}.txt`, "-vf", "fps=30", "-t", total.toFixed(3), ...ENC, `${name}.mp4`]);
  segments.push(`${name}.mp4`);
}

// Alternates `make(i)` every `step` seconds (bobbing, blinking).
const loop = (make, count, seconds, step = 0.3) =>
  Array.from({ length: Math.round(seconds / step) }, (_, i) => [make(i % count), step]);

// Slides in from below in pixel steps, then holds.
const popIn = (make, hold) => [[make(110), 0.07], [make(40), 0.07], [make(0), hold]];

// Real footage of a mock site, over a background card with an empty frame at SLOT.
async function live(bg, host, ms, { settle = 1500, ready } = {}) {
  const name = `${tmp}${++n}`;
  writeFileSync(`${name}-bg.png`, await render(composer, bg));
  const p = await ctx.newPage();
  await p.setViewportSize({ width: SLOT.w / 2, height: SLOT.h / 2 });
  await p.goto(`https://${host}/`);
  await wait(settle);
  let list = await record(p, ms, `${name}-`, ready);
  await p.close();
  // Waiting for `ready` can take a whole tick: keep only the last ~1.2s before it.
  if (list.readyAt) {
    let from = list.readyAt;
    for (let t = 0; from > 0 && t < 1.2; ) t += list[--from].d;
    list = list.slice(from);
  }
  writeFileSync(`${name}.txt`, concatList(list));
  ff([
    "-loop", "1", "-i", `${name}-bg.png`, "-f", "concat", "-safe", "0", "-i", `${name}.txt`,
    "-filter_complex", `[1:v]fps=30,scale=${SLOT.w}:${SLOT.h}[v];[0:v][v]overlay=${SLOT.x}:${SLOT.y}:shortest=1`,
    ...ENC, `${name}.mp4`,
  ]);
  segments.push(`${name}.mp4`);
}

// Beepo greeting on page load.
async function greet(lang, bg) {
  await seed(lang, { idleSeconds: 3600 });
  await live(bg, "feed.example", 4000, { settle: 200 });
}

// A 2-minute limit with 4 seconds left: the first 5s tick goes over and the STOP sign comes up.
async function stop(lang, bg) {
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
  await live(bg, "videos.example", 4000, { ready: limitHit });
}

// ---------- pieces ----------

const buddy = (mood, scale = 26, { look = LOOK, pet = "pet-cat", frame = 0 } = {}) => [
  { id: "b", scale, mood, equipped: look },
  ...(pet ? [{ id: "p", pet, frame, scale: Math.round(scale * 0.62) }] : []),
];
const beepoRow = (top, up, style = "", pet = true) =>
  `<div style="position:absolute;left:0;right:0;top:${top - (up ? 18 : 0)}px;display:flex;justify-content:center;align-items:flex-end;gap:28px;${style}">${pet ? `<canvas id="p"></canvas>` : ""}<canvas id="b"></canvas></div>`;
// A light pixel outline so Beepo's dark edges read on a dark background.
const GLOW = ["6px 0", "-6px 0", "0 6px", "0 -6px"].map((o) => `drop-shadow(${o} 0 #fff)`).join(" ");

const slotFrame = (style = "") =>
  `<div class="shot" style="position:absolute;left:${SLOT.x - 4}px;top:${SLOT.y - 4}px;width:${SLOT.w + 8}px;height:${SLOT.h + 8}px;background:#fff;${style}"></div>`;

function shot(lang, file) {
  const path = `${root}dist/play/raw/${lang}/${file}.png`;
  if (!existsSync(path)) throw new Error(`missing ${path} (run scripts/play-capture.js, see docs/PLAY.md)`);
  return png(readFileSync(path));
}
// `crop`: visible height in source pixels (the report is half empty below).
const phone = (src, dy, style = "", crop = 2400) =>
  `<div class="shot" style="position:absolute;left:${(W - PHONE.w) / 2 - 4}px;top:${PHONE.y + dy}px;max-height:${crop / 2 + 8}px;overflow:hidden;${style}"><img src="${src}" style="width:${PHONE.w}px;display:block"></div>`;

const storeBadges = (shadow) =>
  `<div style="display:grid;grid-template-columns:1fr 1fr;gap:34px;width:920px;margin:0 auto">${STORES.map(
    ({ name, logo }) => `<div style="display:flex;align-items:center;gap:20px;padding:20px 26px;background:#fff;color:#1b1b2f;border:5px solid #1b1b2f;box-shadow:8px 8px 0 ${shadow};font:800 42px ${MONO};white-space:nowrap">
      <img src="${logo}" style="width:58px;height:58px;object-fit:contain;flex:none">${name}</div>`
  ).join("")}</div>`;

// Shared end card; the theme brings background, ink and fonts.
function endCard(t, mood, up) {
  return {
    w: W, h: H, beepo: buddy(mood, 26, t.buddy),
    html: `<div style="position:relative;height:${H}px;${t.bg};color:${t.ink}">
      ${t.top || ""}
      ${beepoRow(400, up, t.beepo || "")}
      <div style="position:absolute;left:0;right:0;top:960px;text-align:center;font:bold 150px ${MONO}">Beepo</div>
      <div style="position:absolute;left:60px;right:60px;top:1150px;text-align:center;font:600 46px/1.4 ${t.font}">${lines(t.tagline, t.hl)}</div>
      <div style="position:absolute;left:0;right:0;top:1300px;text-align:center;font:800 40px ${t.font};letter-spacing:2px;opacity:.75">${esc(t.avail)}</div>
      <div style="position:absolute;left:0;right:0;top:1390px">${storeBadges(t.shadow)}</div>
    </div>`,
  };
}
const ending = (t) => cards(loop((i) => endCard(t, "proud", i === 1), 2, 3.6));

// ---------- en: POV meme ----------

const CREAM = `background:repeating-linear-gradient(0deg,#0000 0 23px,#1b1b2f08 23px 24px),#f4f1e8`;
function enCard(caption, inner = "", beepo = []) {
  return {
    w: W, h: H, beepo,
    html: `<div style="position:relative;height:${H}px;${CREAM}">
      <div style="position:absolute;left:60px;right:60px;top:180px;height:400px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 56px/1.3 ${MONO}"><div>${lines(caption)}</div></div>
      ${inner}</div>`,
  };
}

async function en() {
  const L = "en";
  await cards([
    [enCard(`me: "just 5 more\nminutes"`), 1.4],
    [enCard(`me: "just 5 more\nminutes"\n\n*also me, 2 hours later:*`), 1.4],
  ]);
  await cards(loop((i) => enCard("so I got a tiny robot\nto keep an eye on me", `${beepoRow(760, i % 2)}<div style="position:absolute;left:0;right:0;top:1340px;text-align:center;font:40px ${MONO}">meet Beepo (he's kind)</div>`, buddy(i === 3 ? "blink" : "happy")), 4, 2.6));
  await greet(L, enCard("he lives at the bottom\nof every website", slotFrame()));
  await stop(L, enCard("set a limit.\ntime's up? *tiny STOP sign*", slotFrame()));
  await cards(popIn((dy) => enCard("on your phone too:\nhe closes the app\n(kindly)", phone(shot(L, "5-block"), dy, "", 2000)), 2.8));
  await cards(popIn((dy) => enCard("keep your limits,\nearn stars,\n*buy him hats*", phone(shot(L, "3-shop"), dy)), 2.8));
  await ending({ bg: CREAM, ink: "#1b1b2f", font: MONO, shadow: "#1b1b2f", tagline: "a tiny buddy for\nyour screen time", avail: "AVAILABLE ON" });
}

// ---------- ko: arcade ----------

const KO = `'Apple SD Gothic Neo', sans-serif`;
const NIGHT = `background:radial-gradient(#ffffff26 2px,#0000 3px) 0 0/56px 56px,radial-gradient(#ffd84a33 2px,#0000 3px) 28px 28px/112px 112px,#1b1b2f`;
const ARCADE_SHOT = "border-color:#fff;box-shadow:10px 10px 0 #ffd84a";
const hud = (stars) =>
  `<div style="position:absolute;left:60px;right:60px;top:80px;display:flex;justify-content:space-between;font:800 36px ${MONO};color:#ffd84a"><span>1UP</span><span>⭐ ${String(stars).padStart(3, "0")}</span><span style="color:#ff5c8a">♥♥♥</span></div>`;
function koCard(stage, caption, inner = "", { stars = 0, beepo = [] } = {}) {
  return {
    w: W, h: H, beepo,
    html: `<div style="position:relative;height:${H}px;${NIGHT};color:#fff">
      ${hud(stars)}
      <div style="position:absolute;left:60px;right:60px;top:190px;height:400px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center">
        ${stage ? `<div style="font:800 40px ${MONO};color:#ff5c8a;letter-spacing:6px">${esc(stage)}</div>` : ""}
        <div style="font:800 62px/1.35 ${KO}">${lines(caption, "#7a4dff")}</div>
      </div>
      ${inner}</div>`,
  };
}

async function ko() {
  const L = "ko";
  const start = (on) => `<div style="position:absolute;left:0;right:0;top:1380px;text-align:center;font:800 56px ${MONO};color:#ffd84a;visibility:${on ? "visible" : "hidden"}">PRESS START</div>`;
  await cards(loop((i) => koCard("WARNING!", "보스 등장:\n*무한 스크롤*", `${start(i === 0)}`), 2, 2, 0.4));
  await cards(loop((i) => koCard("PLAYER 2", "도우미 *Beepo* 합류!", beepoRow(720, i % 2, `filter:${GLOW}`), { beepo: buddy(i === 3 ? "blink" : "happy") }), 4, 2.4));
  await cards(popIn((dy) => koCard("STAGE 1", "앱마다 하루 제한 시간 설정", phone(shot(L, "2-limits"), dy, ARCADE_SHOT), { stars: 5 }), 2.6));
  await stop(L, koCard("STAGE 2", "시간 초과? *멈춰!* 표지판", slotFrame(ARCADE_SHOT), { stars: 9 }));
  await cards(popIn((dy) => koCard("STAGE 3", "그래도 계속하면… 앱 잠금", phone(shot(L, "5-block"), dy, ARCADE_SHOT, 2000), { stars: 14 }), 2.6));
  await cards(popIn((dy) => koCard("BONUS", "지킨 날만큼 ⭐ 획득\n모자 쇼핑!", phone(shot(L, "3-shop"), dy, ARCADE_SHOT), { stars: 23 }), 2.8));
  await cards(popIn((dy) => koCard("STAGE CLEAR", "이번 주 *2시간 46분* 절약", phone(shot(L, "6-report"), dy, ARCADE_SHOT, 1340), { stars: 23 }), 2.6));
  await ending({
    bg: NIGHT, ink: "#fff", font: KO, shadow: "#ffd84a", hl: "#7a4dff", beepo: `filter:${GLOW}`,
    top: `<div style="position:absolute;left:0;right:0;top:170px;text-align:center;font:800 64px ${MONO};color:#ffd84a">CONTINUE? ▶</div>`,
    tagline: "스크린 타임을 지켜 주는\n작은 친구", avail: "지금 만나 보세요",
  });
}

// ---------- ja: diary ----------

const JA = `'Hiragino Sans', 'Hiragino Kaku Gothic ProN', sans-serif`;
const PAPER = `background:linear-gradient(90deg,#0000 108px,#ff8f8f88 108px 112px,#0000 112px),linear-gradient(#9cc3ff50 2px,#0000 2px) 0 0/60px 60px,linear-gradient(90deg,#9cc3ff50 2px,#0000 2px) 0 0/60px 60px,#fffdf6`;
const tape = (top, left, rot) =>
  `<div style="position:absolute;top:${top}px;left:${left}px;width:220px;height:60px;background:#ffd84abb;transform:rotate(${rot}deg);z-index:2"></div>`;
function jaCard(time, caption, inner = "", beepo = []) {
  return {
    w: W, h: H, beepo,
    html: `<div style="position:relative;height:${H}px;${PAPER};color:#23305e">
      <div style="position:absolute;left:150px;right:60px;top:180px;height:400px;display:flex;flex-direction:column;justify-content:center;gap:26px">
        ${time ? `<div style="align-self:flex-start;padding:8px 22px;background:#ff5c5c;color:#fff;font:800 44px ${MONO};transform:rotate(-3deg)">${esc(time)}</div>` : ""}
        <div style="font:700 58px/1.45 ${JA}">${lines(caption, "#ffe46b")}</div>
      </div>
      ${inner}</div>`,
  };
}
const taped = (frame, top) => frame + tape(top - 28, 180, -6) + tape(top - 28, 690, 5);

async function ja() {
  const L = "ja";
  await cards(loop((i) => jaCard("", "Beepoと過ごす\n*ある1日*", `${beepoRow(780, i % 2)}<div style="position:absolute;left:150px;right:60px;top:1360px;text-align:center;font:500 42px/1.5 ${JA}">${lines("スクリーンタイムを見守る\nちいさなロボット")}</div>`, buddy(i === 3 ? "blink" : "happy")), 4, 2.8));
  await greet(L, jaCard("20:30", "ブラウザを開くと\nBeepoがごあいさつ", taped(slotFrame(), SLOT.y)));
  await stop(L, jaCard("21:15", "動画を見すぎて\n*「ストップ」の札*", taped(slotFrame(), SLOT.y)));
  await cards(popIn((dy) => jaCard("22:00", "スマホのアプリも\n今日はおやすみ", taped(phone(shot(L, "5-block"), dy, "", 2000), PHONE.y + dy)), 2.6));
  await cards(popIn((dy) => jaCard("翌朝", "たまった星で\n*帽子を買った*", taped(phone(shot(L, "3-shop"), dy), PHONE.y + dy)), 2.6));
  await cards(popIn((dy) => jaCard("日曜日", "今週取り戻した時間を\nレポートでチェック", taped(phone(shot(L, "6-report"), dy, "", 1340), PHONE.y + dy)), 2.6));
  await ending({ bg: PAPER, ink: "#23305e", font: JA, shadow: "#ff5c5c", hl: "#ffe46b", tagline: "ちいさな相棒と\nほどよいスクリーンタイム", avail: "配信中" });
}

// ---------- zh_CN: Xiaohongshu ----------

const ZH = `'PingFang SC', 'Hiragino Sans GB', sans-serif`;
const PINK = `background:radial-gradient(#ff8fb14d 3px,#0000 4px) 0 0/44px 44px,#ffe8ef`;
const ZH_SHOT = "box-shadow:10px 10px 0 #ff5c8a";
const sticker = (num) =>
  `<div style="position:absolute;left:70px;top:200px;width:110px;height:110px;border-radius:50%;background:#ff3d6e;color:#fff;border:5px solid #1b1b2f;display:flex;align-items:center;justify-content:center;font:800 64px ${MONO};transform:rotate(-10deg);z-index:2">${num}</div>`;
function zhCard(num, caption, inner = "", beepo = []) {
  return {
    w: W, h: H, beepo,
    html: `<div style="position:relative;height:${H}px;${PINK};color:#1b1b2f">
      ${num ? sticker(num) : ""}
      <div style="position:absolute;left:70px;right:70px;top:180px;height:410px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 66px/1.35 ${ZH}"><div>${lines(caption)}</div></div>
      ${inner}</div>`,
  };
}

async function zh() {
  const L = "zh_CN";
  const stamp = `<div style="position:absolute;right:80px;top:1320px;padding:12px 26px;border:6px solid #ff3d6e;color:#ff3d6e;font:900 54px ${ZH};transform:rotate(-12deg)">亲测有用</div>`;
  await cards(loop((i) => zhCard("", "*自律神器*｜一只管着我\n别刷手机的像素小机器人", beepoRow(760, i % 2) + (i >= 4 ? stamp : ""), buddy(i === 7 ? "blink" : "happy")), 10, 3));
  await greet(L, zhCard("1", "住在网页右下角\n*点它还会聊天*", slotFrame(ZH_SHOT)));
  await stop(L, zhCard("2", "时间一到\n直接举起*「停」牌*", slotFrame(ZH_SHOT)));
  await cards(popIn((dy) => zhCard("3", "手机上也能管\n超时*直接关掉 App*", phone(shot(L, "5-block"), dy, ZH_SHOT, 2000)), 2.6));
  await cards(popIn((dy) => zhCard("4", "守住限额攒星星\n*给它买帽子*", phone(shot(L, "3-shop"), dy, ZH_SHOT)), 2.6));
  await ending({ bg: PINK, ink: "#1b1b2f", font: ZH, shadow: "#ff5c8a", tagline: "陪你好好用屏幕的\n像素小伙伴", avail: "现已上线" });
}

// ---------- halloween: costume reveal ----------

const SPOOKY = `background:radial-gradient(#ffffff30 2px,#0000 3px) 0 0/64px 64px,radial-gradient(#ff8a3d40 3px,#0000 4px) 32px 32px/128px 128px,#1e1433`;
const ORANGE = "#ff8a3d";
const WITCH = { color: "color-purple", hat: "hat-witch" };
const REJECTED = ["hat-cap", "hat-top", "hat-crown", "hat-santa", "hat-bunny", "hat-snorkel", "hat-straw"];
const HALLOWEEN = {
  en: {
    font: MONO, hook: "Beepo's Halloween\ncostume reveal", sub: "he's been planning\nthis all month", rejected: "rejected costumes:",
    reveal: "WITCH BEEPO", bait: "rate it 1–10 👇", note: "Halloween items just dropped in the shop",
    tagline: "a tiny buddy for\nyour screen time", avail: "AVAILABLE ON",
  },
  ko: {
    font: KO, hook: "Beepo의 핼러윈\n코스튬 공개", sub: "한 달 내내 고민했대요", rejected: "탈락한 후보들:",
    reveal: "마녀 Beepo", bait: "몇 점? 1–10 👇", note: "핼러윈 아이템 상점에 등장!",
    tagline: "스크린 타임을 지켜 주는\n작은 친구", avail: "지금 만나 보세요",
  },
  ja: {
    font: JA, hook: "Beepoの\nハロウィン仮装発表", sub: "1か月かけて悩んだらしい", rejected: "ボツになった衣装:",
    reveal: "魔女Beepo", bait: "何点？1〜10でコメントして👇", note: "ハロウィンアイテム、ショップに登場中",
    tagline: "ちいさな相棒と\nほどよいスクリーンタイム", avail: "配信中",
  },
  zh_CN: {
    font: ZH, hook: "Beepo 的\n万圣节变装揭晓", sub: "据说它纠结了一整个月", rejected: "落选造型：",
    reveal: "小巫师 Beepo", bait: "打几分？1–10 评论区见👇", note: "万圣节装扮已上架商店",
    tagline: "陪你好好用屏幕的\n像素小伙伴", avail: "现已上线",
  },
};

// Pixel confetti that falls a little each frame.
const confetti = (frame) =>
  Array.from({ length: 36 }, (_, i) => {
    const x = (i * 263) % 1040, y = ((i * 397) % 1500) + frame * 40;
    const c = [ORANGE, "#9b6bff", "#7dff8a", "#ffd84a"][i % 4];
    return `<div style="position:absolute;left:${x}px;top:${(y % 1500) + 120}px;width:22px;height:22px;background:${c}"></div>`;
  }).join("");

async function halloween(L) {
  const c = HALLOWEEN[L];
  const cap = (text, size = 66, color = "#fff") =>
    `<div style="position:absolute;left:70px;right:70px;top:200px;height:380px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 ${size}px/1.3 ${c.font};color:${color}"><div>${lines(text, "#7a3dff")}</div></div>`;
  const small = (text, top = 1360) =>
    `<div style="position:absolute;left:70px;right:70px;top:${top}px;text-align:center;font:600 42px/1.4 ${c.font};opacity:.85">${lines(text)}</div>`;
  const card = (inner, beepo = []) => ({ w: W, h: H, beepo, html: `<div style="position:relative;height:${H}px;${SPOOKY};color:#fff">${inner}</div>` });
  const glow = `filter:${GLOW}`;

  // Nervous glances.
  await cards(loop((i) => card(cap(c.hook) + beepoRow(760, i % 2, glow, false) + small(c.sub), [{ id: "b", scale: 28, mood: ["lookLeft", "lookRight", "lookLeft", "blink"][i] }]), 4, 2.4));
  // Rejected hats, each crossed out.
  const x = `<div style="position:absolute;left:0;right:0;top:560px;text-align:center;font:900 560px/1 ${MONO};color:#ff3d5a;text-shadow:10px 10px 0 #000">✕</div>`;
  await cards(REJECTED.flatMap((hat) => {
    const beepo = [{ id: "b", scale: 28, mood: "neutral", equipped: { hat } }];
    return [[card(cap(c.rejected) + beepoRow(760, false, glow, false), beepo), 0.2], [card(cap(c.rejected) + beepoRow(760, false, glow, false) + x, beepo), 0.16]];
  }));
  // 3, 2, 1, flash.
  const digit = (d) => card(`<div style="position:absolute;left:0;right:0;top:600px;text-align:center;font:900 460px/1 ${MONO};color:${ORANGE};text-shadow:12px 12px 0 #000">${d}</div>`);
  await cards([[digit(3), 0.33], [digit(2), 0.33], [digit(1), 0.33], [{ w: W, h: H, html: `<div style="height:${H}px;background:#fff"></div>` }, 0.07]]);
  // The reveal: witch hat, grape body, bat.
  const witch = (mood, i) => buddy(mood, 28, { look: WITCH, pet: "pet-bat", frame: i % 2 });
  await cards(loop((i) => card(confetti(i) + cap(c.reveal, 92, ORANGE) + beepoRow(740, i % 2, glow), witch("party", i)), 10, 3, 0.25));
  await cards(loop((i) => card(cap(c.bait) + beepoRow(740, i % 2, glow) + small(c.note), witch(i === 3 ? "blink" : "proud", i)), 4, 2.6));
  await ending({ bg: SPOOKY, ink: "#fff", font: c.font, shadow: ORANGE, hl: "#7a3dff", beepo: glow, buddy: { look: WITCH, pet: "pet-bat" }, tagline: c.tagline, avail: c.avail });
}

// ---------- texts-en: "—B" ----------

const LOCK = `background:linear-gradient(#2a1f4f,#0f0f1f)`;
const NOTES = [
  `you said "one more video"\n14 times today. —B`,
  `it's 1:47am.\nyour alarm is at 7. —B`,
  `you closed that app and\nopened it again 4 sec later. —B`,
  `I'm not mad.\nI believe in you. —B`,
];

function lockCard(inner, beepo = [], clock = true) {
  return {
    w: W, h: H, beepo,
    html: `<div style="position:relative;height:${H}px;${LOCK};color:#fff;overflow:hidden">
      ${clock ? `<div style="position:absolute;left:0;right:0;top:150px;text-align:center;font:700 190px/1 ${MONO}">1:47</div>
      <div style="position:absolute;left:0;right:0;top:360px;text-align:center;font:600 38px ${MONO};opacity:.7">Saturday, October 10</div>` : ""}
      ${inner}</div>`,
  };
}
const note = (text, dy = 0) =>
  `<div style="margin:0 70px 28px;padding:22px 28px;background:#f4f1e8;color:#1b1b2f;border:4px solid #1b1b2f;box-shadow:8px 8px 0 #000;transform:translateY(${-dy}px)">
    <div style="display:flex;justify-content:space-between;font:700 28px ${MONO};opacity:.55"><span>💬 UNKNOWN</span><span>now</span></div>
    <div style="font:700 38px/1.35 ${MONO};margin-top:10px">${lines(text, "#ff5c8a")}</div></div>`;
const noteStack = (count, dy = 0) =>
  `<div style="position:absolute;left:0;right:0;top:470px">${NOTES.slice(0, count).map((t, i) => note(t, i === count - 1 ? dy : 0)).join("")}</div>`;
const lockCap = (text, top = 470) =>
  `<div style="position:absolute;left:70px;right:70px;top:${top}px;text-align:center;font:800 56px/1.35 ${MONO}">${lines(text, "#ff5c8a")}</div>`;

async function texts() {
  const L = "en";
  await cards([[lockCard(lockCap(`someone keeps\ntexting me and\nsigning it "—B"`, 640)), 1.8]]);
  for (let i = 1; i <= NOTES.length; i++) await cards([[lockCard(noteStack(i, 70)), 0.08], [lockCard(noteStack(i)), i === NOTES.length ? 2.2 : 1.7]]);
  // Beepo peeks up from the bottom edge.
  const peek = (top, mood) => lockCard(lockCap("who is B? 👀", 560) + beepoRow(top, false, `filter:${GLOW}`, false), [{ id: "b", scale: 30, mood }], false);
  await cards([[peek(1700, "lookLeft"), 0.6], [peek(1560, "lookRight"), 0.6], [peek(1560, "lookLeft"), 0.4]]);
  await cards(loop((i) => lockCard(lockCap("it's Beepo.\nhe lives on your screen\nand he's *on your side*", 300) + beepoRow(860, i % 2, `filter:${GLOW}`), buddy(i === 3 ? "blink" : "happy", 28), false), 4, 2.6));
  await stop(L, lockCard(lockCap("his love language:\na tiny *STOP sign*", 260) + slotFrame("border-color:#fff;box-shadow:10px 10px 0 #ff5c8a"), [], false));
  await cards(popIn((dy) => lockCard(lockCap("he's on your\nphone too", 260) + phone(shot(L, "5-block"), dy, "border-color:#fff;box-shadow:10px 10px 0 #ff5c8a", 2000), [], false), 2.6));
  await ending({
    bg: LOCK, ink: "#fff", font: MONO, shadow: "#ff5c8a", hl: "#ff5c8a", beepo: `filter:${GLOW}`,
    top: `<div style="position:absolute;left:0;right:0;top:180px;text-align:center;font:800 60px ${MONO}">xoxo, —B 💌</div>`,
    tagline: "a tiny buddy for\nyour screen time", avail: "AVAILABLE ON",
  });
}

// ---------- oneword-ko: chat ----------

const CHAT = `background:linear-gradient(#ffffff40 2px,#0000 2px) 0 0/48px 48px,linear-gradient(90deg,#ffffff40 2px,#0000 2px) 0 0/48px 48px,#b9d3ea`;
const CHAT_MSGS = [
  [0, "질문 하나 할게.\n한 단어로만 대답해"], [1, "ㅇㅋ"],
  [0, "오늘 스크린 타임?"], [1, "6시간"],
  [0, "그중 쇼츠는?"], [1, "…4시간"],
  [0, "내일 목표는?"], [1, "덜 보기"],
  [0, "좋아. 내가 도와줄게 🤖"],
];

function chatCard(msgs, typing = false, mood = "happy") {
  const bubble = ([me, text]) =>
    `<div style="align-self:${me ? "flex-end" : "flex-start"};max-width:760px;padding:22px 30px;background:${me ? "#ffd84a" : "#fff"};border:4px solid #1b1b2f;box-shadow:6px 6px 0 #1b1b2f;font:700 48px/1.35 ${KO}">${lines(text)}</div>`;
  const dots = `<div style="align-self:flex-start;padding:22px 30px;background:#fff;border:4px solid #1b1b2f;box-shadow:6px 6px 0 #1b1b2f;font:800 48px ${MONO};letter-spacing:8px">• • •</div>`;
  return {
    w: W, h: H, beepo: [{ id: "b", scale: 6, mood }],
    html: `<div style="position:relative;height:${H}px;${CHAT};color:#1b1b2f">
      <div style="position:absolute;left:0;right:0;top:0;height:230px;padding:90px 60px 0;display:flex;align-items:center;gap:26px;background:#fff;border-bottom:4px solid #1b1b2f">
        <canvas id="b"></canvas><div><div style="font:800 46px ${KO}">Beepo</div><div style="font:600 30px ${MONO};color:#2fa84f">● online</div></div></div>
      <div style="position:absolute;left:60px;right:60px;top:260px;height:1240px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:30px">
        ${msgs.map(bubble).join("")}${typing ? dots : ""}</div></div>`,
  };
}
const chatCap = (caption, inner = "", beepo = []) => ({
  w: W, h: H, beepo,
  html: `<div style="position:relative;height:${H}px;${CHAT};color:#1b1b2f">
    <div style="position:absolute;left:60px;right:60px;top:180px;height:400px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 64px/1.35 ${KO}"><div>${lines(caption)}</div></div>${inner}</div>`,
});

async function oneword() {
  const L = "ko";
  const seq = [];
  CHAT_MSGS.forEach(([me], i) => {
    const shown = CHAT_MSGS.slice(0, i + 1);
    if (!me) seq.push([chatCard(CHAT_MSGS.slice(0, i), true), 0.35]);
    seq.push([chatCard(shown, false, i === 5 ? "worried" : "happy"), i === CHAT_MSGS.length - 1 ? 1.6 : me ? 0.75 : 0.9]);
  });
  await cards(seq);
  await cards(popIn((dy) => chatCap("앱마다 하루 시간을 정하면", phone(shot(L, "2-limits"), dy)), 2.4));
  await stop(L, chatCap("시간 다 되면 *멈춰!*", slotFrame()));
  await cards(popIn((dy) => chatCap("그래도 계속 보면? 앱 잠금", phone(shot(L, "5-block"), dy, "", 2000)), 2.4));
  await ending({ bg: CHAT, ink: "#1b1b2f", font: KO, shadow: "#1b1b2f", tagline: "스크린 타임을 지켜 주는\n작은 친구", avail: "지금 만나 보세요" });
}

// ---------- flip-ja: before / after ----------

const BEFORE_BG = `background:repeating-linear-gradient(45deg,#0000 0 18px,#00000008 18px 36px),#cfcbc4`;
const AFTER_BG = `background:radial-gradient(#ffd84a66 3px,#0000 4px) 0 0/48px 48px,#fff6d8`;

function statCard(bg, tag, title, stats, inner = "", beepo = []) {
  return {
    w: W, h: H, beepo,
    html: `<div style="position:relative;height:${H}px;${bg};color:#1b1b2f">
      <div style="position:absolute;left:0;right:0;top:190px;text-align:center"><span style="padding:8px 26px;background:#1b1b2f;color:#fff;font:800 46px ${MONO};letter-spacing:6px">${tag}</span></div>
      <div style="position:absolute;left:60px;right:60px;top:300px;text-align:center;font:800 64px/1.35 ${JA}">${lines(title)}</div>
      <div style="position:absolute;left:110px;right:110px;top:470px;display:flex;flex-direction:column;gap:26px">
        ${stats.map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:22px 30px;background:#fff;border:4px solid #1b1b2f;box-shadow:8px 8px 0 #1b1b2f"><span style="font:600 40px ${JA}">${esc(k)}</span><span style="font:800 50px ${JA}">${esc(v)}</span></div>`).join("")}
      </div>
      ${inner}
      <div style="position:absolute;right:60px;top:1500px;font:500 30px ${JA};opacity:.55">※イメージです</div></div>`,
  };
}

async function flip() {
  const L = "ja";
  const before = statCard(BEFORE_BG, "BEFORE", "Beepoを入れる前の私", [["スクリーンタイム", "6時間12分"], ["寝る時間", "2:30"], ["「あと1本だけ」", "∞回"]],
    beepoRow(1060, false, "filter:grayscale(1) opacity(.5)", false), [{ id: "b", scale: 18, mood: "sleepy" }]);
  const after = (up, mood) => statCard(AFTER_BG, "AFTER", "入れた後の私", [["スクリーンタイム", "3時間26分"], ["寝る時間", "0:00"], ["たまった星", "⭐ 23"]],
    beepoRow(1060, up), buddy(mood, 18));
  // The upside-down flip: the "before" card spins away and the "after" card lands upright.
  const spin = (card, deg, scale) => ({ ...card, html: `<div style="height:${H}px;background:#1b1b2f;overflow:hidden"><div style="transform:rotate(${deg}deg) scale(${scale})">${card.html}</div></div>` });
  await cards([[before, 2.6], [spin(before, 60, 0.8), 0.06], [spin(before, 120, 0.6), 0.06], [spin(after(false, "party"), -120, 0.6), 0.06], [spin(after(false, "party"), -60, 0.8), 0.06]]);
  await cards(loop((i) => after(i % 2, i === 3 ? "blink" : "party"), 4, 2.6));
  const jaCap = (caption, inner) => ({ w: W, h: H, html: `<div style="position:relative;height:${H}px;${AFTER_BG};color:#1b1b2f"><div style="position:absolute;left:60px;right:60px;top:180px;height:400px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 62px/1.4 ${JA}"><div>${lines(caption)}</div></div>${inner}</div>` });
  await cards(popIn((dy) => jaCap("時間になると\nBeepoがそっと声をかける", phone(shot(L, "1-stop"), dy, "", 2188)), 2.6));
  await stop(L, jaCap("パソコンのブラウザでも\n*「ストップ」*", slotFrame()));
  await cards(popIn((dy) => jaCap("取り戻した時間は\n週のレポートで", phone(shot(L, "6-report"), dy, "", 1340)), 2.6));
  await ending({ bg: AFTER_BG, ink: "#1b1b2f", font: JA, shadow: "#1b1b2f", tagline: "ちいさな相棒と\nほどよいスクリーンタイム", avail: "配信中" });
}

// ---------- moyu-zh_CN: caught at work ----------

const SHEET = `background:linear-gradient(#0000 54px,#d4dae3 54px 56px) 0 0/100% 56px,linear-gradient(90deg,#0000 178px,#d4dae3 178px 180px) 0 0/180px 100%,#fff`;
const sheetHead = `<div style="position:absolute;left:0;right:0;top:0;height:56px;display:flex;background:#e9edf3;border-bottom:3px solid #b9c2cf;font:700 28px ${MONO};color:#6b7686">${"ABCDEF".split("").map((l) => `<div style="width:180px;text-align:center;line-height:56px">${l}</div>`).join("")}</div>`;
const note2 = (caption) =>
  `<div style="position:absolute;left:80px;right:80px;top:190px;min-height:340px;padding:30px;display:flex;align-items:center;justify-content:center;text-align:center;background:#fff3a8;border:4px solid #1b1b2f;box-shadow:10px 10px 0 #1b1b2f;transform:rotate(-1.5deg);font:800 60px/1.4 ${ZH}"><div>${lines(caption, "#ff9ab5")}</div></div>`;
const sheetCard = (caption, inner = "", beepo = []) => ({
  w: W, h: H, beepo,
  html: `<div style="position:relative;height:${H}px;${SHEET};color:#1b1b2f">${sheetHead}${note2(caption)}${inner}</div>`,
});
const SHEET_SHOT = "box-shadow:10px 10px 0 #2f9e5a";

async function moyu() {
  const L = "zh_CN";
  await cards(loop((i) => sheetCard("上班摸鱼刷视频\n被一只像素机器人*抓包*了😭", beepoRow(820, i % 2), buddy(["lookLeft", "lookRight", "proud", "proud"][i], 26)), 4, 2.6));
  await stop(L, sheetCard("14:32 老板开会，我偷偷看视频\n14:47 它举起了*「停」牌*", slotFrame(SHEET_SHOT)));
  const say = (me, text) =>
    `<div style="align-self:${me ? "flex-end" : "flex-start"};max-width:700px;padding:22px 30px;background:${me ? "#9be7b4" : "#fff"};border:4px solid #1b1b2f;box-shadow:6px 6px 0 #1b1b2f;font:700 50px/1.35 ${ZH}">${lines(text)}</div>`;
  const talk = (n, up) => sheetCard("然后……",
    `<div style="position:absolute;left:80px;right:80px;top:640px;display:flex;flex-direction:column;gap:34px">${[say(1, "我：再看 5 分钟！"), say(0, "Beepo：好～就 5 分钟哦\n我相信你 ✨")].slice(0, n).join("")}</div>` + beepoRow(1220, up),
    buddy("happy", 18));
  await cards([[talk(1, false), 0.9], [talk(2, false), 0.4], [talk(2, true), 0.3], [talk(2, false), 0.3], [talk(2, true), 0.3], [talk(2, false), 0.5]]);
  await cards(popIn((dy) => sheetCard("下班路上想刷手机\nApp 直接*关门*了", phone(shot(L, "5-block"), dy, SHEET_SHOT, 2000)), 2.6));
  await cards(popIn((dy) => sheetCard("结果：这周少刷了\n*2小时46分*", phone(shot(L, "6-report"), dy, SHEET_SHOT, 1340)), 2.6));
  await ending({ bg: SHEET, ink: "#1b1b2f", font: ZH, shadow: "#2f9e5a", top: sheetHead, tagline: "陪你好好用屏幕的\n像素小伙伴", avail: "现已上线" });
}

// ---------- run ----------

const VIDEOS = {
  en, ko, ja, zh_CN: zh,
  ...Object.fromEntries(Object.keys(HALLOWEEN).map((l) => [`halloween-${l}`, () => halloween(l)])),
  "texts-en": texts, "oneword-ko": oneword, "flip-ja": flip, "moyu-zh_CN": moyu,
};
mkdirSync(out, { recursive: true });
for (const id of ids.length ? ids : Object.keys(VIDEOS)) {
  if (!VIDEOS[id]) throw new Error(`no promo ${id} (have: ${Object.keys(VIDEOS).join(", ")})`);
  tmp = `${out}tmp-${id}/`;
  segments = [];
  n = 0;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  await VIDEOS[id]();
  writeFileSync(`${tmp}all.txt`, segments.map((f) => `file '${f}'`).join("\n") + "\n");
  ff(["-f", "concat", "-safe", "0", "-i", `${tmp}all.txt`, "-c", "copy", "-movflags", "+faststart", `${out}${id}.mp4`]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`social/promo/${id}.mp4`);
}
await ctx.close();
