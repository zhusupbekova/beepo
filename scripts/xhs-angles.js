// Prototype XHS image sets (zh_CN, 1080×1440), one per content angle, to test which one lands:
//   kaoyan     focus hours lock Weibo on weekdays (study)
//   double11   Taobao closes at midnight (night shopping)
//   snooze     he remembers every "5 more minutes"
//   goal       goal mode: a study site you should use *more*
//   proof      two weeks of the Report tab (demo data: swap in real screenshots before posting)
//   challenge  21-day series template
//   order      comment-section custom Beepo orders
// Real extension shots on mock sites; the service worker's clock is faked for focus hours.
// Out: dist/social/xhs/angles/<angle>/1.png… + post.txt.
// Usage: node scripts/xhs-angles.js [kaoyan snooze …]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import * as core from "../extension/lib/core.js";
import { root, ext, wait, render, png, esc, launch, mockSite, sprites, STORES } from "./capture.js";

const W = 1080, H = 1440;
const FONT = `'PingFang SC', 'Hiragino Sans GB', sans-serif`;
const INK = "#1b1b2f";
const BG = `background:repeating-linear-gradient(0deg,#0000 0 23px,#1b1b2f08 23px 24px),#f4f1e8`;
const zh = JSON.parse(readFileSync(`${ext}/data/i18n/zh_CN.json`, "utf8"));
const fill = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const lines = (s) => esc(s).replace(/\n/g, "<br>");
const say = (key, idx, vars) => fill(zh.messages[key].lines[idx], vars);

// ---------- layout ----------

const page = (inner, beepo = [], gap = 56) => ({
  w: W, h: H, beepo,
  html: `<div style="height:${H}px;${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${gap}px;padding:0 70px;text-align:center;font-family:${FONT}">${inner}</div>`,
});
const title = (s, size = 100) => `<div style="font-size:${size}px;font-weight:800;line-height:1.25">${lines(s)}</div>`;
const sub = (s, size = 38) => `<div style="font-size:${size}px;line-height:1.45;opacity:.75">${lines(s)}</div>`;
const tag = (s, bg = "#ffd84a") =>
  `<div style="display:inline-block;background:${bg};border:4px solid ${INK};box-shadow:6px 6px 0 ${INK};padding:10px 26px;font-size:36px;font-weight:700">${esc(s)}</div>`;
const bubble = (s, size = 62) =>
  `<div style="position:relative;background:#fff;border:5px solid ${INK};box-shadow:12px 12px 0 ${INK};padding:50px 56px;max-width:900px;font-size:${size}px;font-weight:700;line-height:1.4">${esc(s)}
    <div style="position:absolute;left:50%;bottom:-34px;margin-left:-20px;width:40px;height:40px;background:#fff;border-right:5px solid ${INK};border-bottom:5px solid ${INK};transform:rotate(45deg)"></div></div>`;
// `zoom` > 1 crops to the middle (where the block screen sits).
const shot = (buf, width = 940, maxH = 900, zoom = 1) =>
  `<div class="shot" style="overflow:hidden;width:${width}px;max-height:${maxH}px;display:flex;align-items:${zoom > 1 ? "center" : "flex-start"};justify-content:center"><img src="${png(buf)}" style="width:${width * zoom}px;flex:none;display:block"></div>`;
const cv = (id) => `<canvas id="${id}"></canvas>`;
const row = (ids, gap = 30) => `<div style="display:flex;align-items:flex-end;justify-content:center;gap:${gap}px">${ids.map(cv).join("")}</div>`;
const b = (id, mood = "happy", look = {}, scale = 20, evolve) => ({ id, mood, equipped: look, scale, evolve });
const pet = (id, kind, scale) => ({ id, pet: kind, scale });
// Numbered steps, left-aligned inside the centered column.
const steps = (items) =>
  `<div style="display:flex;flex-direction:column;gap:30px;text-align:left;width:100%">${items
    .map((s, i) => `<div style="display:flex;gap:26px;align-items:flex-start;background:#fff;border:4px solid ${INK};box-shadow:6px 6px 0 ${INK};padding:26px 30px">
      <div style="flex:none;width:64px;height:64px;background:#ffd84a;border:4px solid ${INK};display:flex;align-items:center;justify-content:center;font:800 36px ${FONT}">${i + 1}</div>
      <div style="font-size:38px;line-height:1.45;font-weight:600">${lines(s)}</div></div>`)
    .join("")}</div>`;
const btn = (s) =>
  `<div style="display:inline-block;background:#fff;border:4px solid ${INK};box-shadow:6px 6px 0 ${INK};padding:14px 30px;font:700 38px ${FONT}">${esc(s)}</div>`;

// A browser window around a page shot, and below it the corner (where Beepo lives) magnified.
// Region = fractions of the shot [x, y, w, h]; Beepo lives bottom right.
const CORNER = [0.5, 0.52, 0.5, 0.48];
function framed(buf, host, { width = 900, region = CORNER, insetH = 490 } = {}) {
  const shotH = Math.round(width * 0.625);
  const [x, y, w, h] = region;
  const chrome = `<div style="display:flex;align-items:center;gap:10px;height:46px;padding:0 16px;background:#e6e1d3;border-bottom:4px solid ${INK}">
    ${["#ff6b6b", "#ffd84a", "#7ee08a"].map((c) => `<i style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid ${INK}"></i>`).join("")}
    <div style="flex:1;margin-left:12px;height:28px;border-radius:14px;background:#fff;font:600 18px ui-monospace,Menlo,monospace;display:flex;align-items:center;padding:0 16px;color:#555">🔒 ${esc(host)}</div></div>`;
  const win = `<div class="shot" style="width:${width}px;background:#fff">${chrome}<img src="${png(buf)}" style="width:${width}px;height:${shotH}px;display:block"></div>`;
  if (!insetH) return win;
  // Inset: same region, scaled to the column width.
  const k = width / w;
  const inset = `<div class="shot" style="width:${width}px;height:${insetH}px;overflow:hidden;position:relative">
    <img src="${png(buf)}" style="position:absolute;width:${k}px;height:${k * 0.625}px;left:${-x * k}px;top:${-(y + h) * k * 0.625 + insetH}px;max-width:none">
    <div style="position:absolute;left:14px;top:14px;background:#ffd84a;border:3px solid ${INK};padding:4px 14px;font:700 26px ${FONT}">🔍 放大</div></div>`;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:28px">${win}${inset}</div>`;
}
// Step slide: numbered heading, framed shot (+ inset), one line under it.
const how = (n, head, shotHtml, note) =>
  page(`<div style="display:flex;align-items:center;gap:22px"><div style="width:76px;height:76px;background:#ffd84a;border:4px solid ${INK};box-shadow:5px 5px 0 ${INK};display:flex;align-items:center;justify-content:center;font:800 44px ${FONT}">${n}</div>${title(head, 54)}</div>${shotHtml}${note ? sub(note, 34) : ""}`, [], 30);

const LOOK = { color: "color-blue", accessory: "acc-scarf", antenna: "antenna-heart" };

// ---------- seeded state ----------

const rule = (id, name, pattern, mode, minutes, extra = {}) => ({
  id, name, patterns: [pattern], mode, minutes, weekendMinutes: null, block: false, hidden: false, focus: null, ...extra,
});
const RULES = [
  rule("weibo", "微博", "weibo.com", "limit", 20, { block: true, focus: { start: "08:00", end: "18:00", weekdaysOnly: true } }),
  rule("bili", "B站", "bilibili.com", "limit", 45, { weekendMinutes: 90 }),
  rule("taobao", "淘宝", "taobao.com", "limit", 30, { block: true, focus: { start: "00:00", end: "07:00", weekdaysOnly: false } }),
  rule("jp", "日语学习", "learn.example", "goal", 20),
];

function state(now, dayPatch = {}) {
  const today = core.dateKey(now, core.DEFAULT_SETTINGS.resetHour);
  // Two weeks of demo data: Bilibili drifting from ~80 to ~40 minutes.
  const daily = [
    [26, 84, 35, 8], [22, 78, 41, 12], [24, 80, 30, 6], [19, 71, 28, 15], [21, 66, 33, 18], [18, 62, 25, 20], [15, 58, 22, 21],
    [14, 55, 20, 22], [16, 49, 26, 20], [12, 47, 18, 24], [11, 44, 21, 25], [13, 41, 17, 22], [10, 39, 16, 28], [9, 42, 15, 26],
  ];
  const history = daily.map((mins, i) => {
    const day = { ...core.newDay(core.addDays(today, i - daily.length)), usage: Object.fromEntries(RULES.map((r, j) => [r.id, mins[j] * 60])) };
    return core.finalizeDay(day, RULES);
  });
  const day = {
    ...core.newDay(today),
    usage: { weibo: 0, bili: 18 * 60, taobao: 6 * 60, jp: 20 * 60 },
    notified: { jp: ["goal50", "goal100"] },
    ...dayPatch,
  };
  const wallet = {
    ...core.DEFAULT_WALLET, stars: 31, earned: 52, goalsMet: 6,
    owned: ["color-blue", "acc-scarf", "antenna-heart", "pet-cat", "hat-cap"],
    equipped: { color: "color-blue", hat: null, antenna: "antenna-heart", accessory: "acc-scarf", pet: "pet-cat" },
    badges: core.BADGES.map((x) => x.id), // all earned: no badge news over the scenes
  };
  const settings = { ...core.DEFAULT_SETTINGS, lang: "zh_CN", wander: false, sound: false, scale: 5, idleSeconds: 3600, phoneCardSeen: true };
  return { sync: { rules: RULES, settings, wallet }, local: { day, history, pending: [], custom: [] } };
}

// ---------- capture ----------

const { ctx, sw, extId, composer } = await launch();
await ctx.route(/^https:\/\/(weibo|bilibili|taobao)\.com\//, (route) =>
  route.fulfill({ contentType: "text/html", body: mockSite(new URL(route.request().url()).host) })
);

/** Fakes the service worker's clock to `ts`, reseeds storage, reloads nothing (state is read per message). */
async function at(ts, dayPatch) {
  await sw.evaluate(
    async ({ ts, data }) => {
      const RD = (globalThis.__RealDate ||= Date);
      const off = ts - RD.now();
      globalThis.Date = class extends RD {
        constructor(...a) { a.length ? super(...a) : super(RD.now() + off); }
        static now() { return RD.now() + off; }
      };
      await chrome.storage.sync.clear();
      await chrome.storage.local.clear();
      await chrome.storage.sync.set(data.sync);
      await chrome.storage.local.set(data.local);
    },
    { ts, data: state(ts, dayPatch) }
  );
}
const clock = (h, m, dayOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
async function site(host, settle = 2200) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 960, height: 600 });
  await p.goto(`https://${host}/`);
  await wait(settle);
  const buf = await p.screenshot({ scale: "device" });
  await p.close();
  return buf;
}
// A live page at `ts` with today's state patched (usage in seconds, milestones already shown…).
// `settle` covers the greeting; one tick (5 s) fires the next milestone.
async function scene(host, ts, dayPatch, settle = 2200) {
  await at(ts, dayPatch);
  return site(host, settle);
}
async function popup(fn) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 384, height: 720 });
  p.on("pageerror", (e) => console.error("popup:", e.message));
  await p.goto(`chrome-extension://${extId}/popup.html`);
  await p.waitForSelector("#list .rule");
  const buf = await fn(p);
  await p.close();
  return buf;
}
const editRule = (name) => async (p) => {
  await p.evaluate((name) => {
    const r = [...document.querySelectorAll("#list .rule")].find((el) => el.textContent.includes(name));
    r.querySelector("button.icon").click();
  }, name);
  await wait(300);
  return p.locator("#editor").screenshot({ scale: "device" });
};

// ---------- live scenes (memoized: several sets reuse them) ----------

const DAY = clock(15, 0); // afternoon: no night lines
const BILI = 45 * 60;
const memo = {};
const once = (key, fn) => (memo[key] ||= fn());
const S = {
  hello: () => once("hello", () => scene("bilibili.com", DAY, { usage: { bili: 10 * 60 } })),
  nudge: () => once("nudge", () => scene("bilibili.com", DAY, { usage: { bili: BILI * 0.8 - 3 }, notified: { bili: ["limit50"] } }, 8800)), // after the peek: he ducks ~0.5–2.6 s after the nudge
  stop: () => once("stop", () => scene("bilibili.com", DAY, { usage: { bili: BILI - 3 }, notified: { bili: ["limit50", "limit80"] } }, 6800)),
  // Two snoozes used (+5 min each) and over again: the button offers the third.
  snooze3: () => once("snooze3", () => scene("bilibili.com", DAY, {
    usage: { bili: BILI + 600 + 40 }, snoozes: { bili: 2 }, bonus: { bili: 600 },
    notified: { bili: ["limit50", "limit80", "limit100", "over", "snoozeOver"] },
  })),
  goal: () => once("goal", () => scene("learn.example", DAY, { usage: { jp: 20 * 60 - 3 }, notified: { jp: ["goal50"] } }, 6300)),
  focusBlock: () => once("focusBlock", () => scene("weibo.com", clock(10, 20), {}, 1500)),
  nightBlock: () => once("nightBlock", () => scene("taobao.com", clock(0, 30, 1), {}, 1500)),
  today: () => once("today", async () => {
    await at(DAY);
    return popup(async (p) => p.screenshot({ scale: "device", fullPage: true }));
  }),
  shop: () => once("shop", async () => {
    await at(DAY);
    return popup(async (p) => {
      await p.click(`nav [data-tab="shop"]`);
      await p.hover(".item:has(canvas) >> nth=7");
      await wait(300);
      return p.screenshot({ scale: "device", fullPage: true });
    });
  }),
};
// Block screens sit mid-page: magnify the middle instead of the corner.
const door = (buf, host) => framed(buf, host, { region: [0.2, 0.255, 0.6, 0.535], insetH: 490 });
// Popup shots are 384 px wide: show them tall and narrow, cropped.
const pop = (buf, h = 1000) => shot(buf, 600, h);

// ---------- sets ----------

const SETS = {
  async howto() {
    return [
      page(`${title("Beepo 怎么用？\n一组图看懂👇")}<div style="display:flex;align-items:flex-end;gap:14px">${cv("p0")}${cv("b0")}</div>${sub("一只住在网页右下角的像素机器人\n帮你盯着别刷太久")}`,
        [b("b0", "happy", LOOK, 28), pet("p0", "pet-cat", 17)]),
      how(1, "它住在网页右下角", framed(await S.hello(), "bilibili.com"), "打开设了规则的网站，它会告诉你今天还剩多久"),
      how(2, "用到 80%，探头提醒", framed(await S.nudge(), "bilibili.com"), "50% 和 80% 各提醒一次，不弹窗不打断"),
      how(3, "时间到，举「停」牌", framed(await S.stop(), "bilibili.com"), "想再看会儿？点「再玩5分钟」，但它会记次数"),
      how(4, "勾了「屏蔽」的网站直接关门", door(await S.focusBlock(), "weibo.com"), "还能设专注时段，比如工作日 8–18 点\n实在要用：花 1 ⭐ 开门 5 分钟"),
      how(5, "点工具栏图标：规则和今日进度", pop(await S.today()), ""),
      how(6, "守住限额攒星星，给它买衣服", pop(await S.shop()), "帽子、颜色、小宠物，攒够了就换"),
    ];
  },

  async kaoyan() {
    const editor = await popup(editRule("微博"));
    return [
      page(`${title("考研党｜我让机器人\n帮我锁了微博🔒")}${row(["b0"])}${sub("工作日 8:00–18:00\n手滑点开就是这个画面👇")}`,
        [b("b0", "worried", { ...LOOK, hat: "hat-cap" }, 30)]),
      how(1, "上午 10:20，手又滑了", door(await S.focusBlock(), "weibo.com"), "它在门口站岗，18:00 才开门"),
      how(2, "其他网站照常，它在右下角报时", framed(await S.hello(), "bilibili.com"), "B站没设专注时段：只提醒今天还剩多久"),
      how(3, "点工具栏图标 → 编辑规则", shot(editor, 900, 1150), "勾「超额后屏蔽」+ 专注时段 + 工作日"),
      page(`${tag("它真的会这么说")}${bubble(say("focus", 1, { until: "18:00", name: "微博" }))}${row(["b0"])}`,
        [b("b0", zh.messages.focus.mood, LOOK, 26)]),
      page(`${title("我的设置", 64)}${steps([
        "Edge 扩展商店搜「Beepo」安装",
        "点工具栏的小机器人 → 自定义规则\n网站填 weibo.com",
        "勾「专注时段」08:00–18:00 + 工作日\n18:00 之后它会自己开门",
      ])}${sub("小红书 / B站 / 知乎 同理，想锁哪个加哪个")}`, [], 48),
    ];
  },

  async double11() {
    return [
      page(`${title("双十一别熬夜了\n它替我守着淘宝🛒")}${row(["b0"])}${sub("零点一过，购物车也该睡了")}`,
        [b("b0", "sleepy", { ...LOOK, hat: "hat-top" }, 30)]),
      how(1, "凌晨 00:30 打开淘宝", door(await S.nightBlock(), "taobao.com"), "想买的白天加购，晚上睡觉"),
      how(2, "白天用到 80%，它探头提醒", framed(await S.nudge(), "bilibili.com"), "（截图是 B站，淘宝一样）"),
      page(`${tag("凌晨还在刷的时候")}${bubble(say("statusNight", 0, { time: "00:30" }))}${row(["b0"])}`,
        [b("b0", "sleepy", LOOK, 26)]),
      page(`${title("我的双十一设置", 64)}${steps([
        "淘宝每天 30 分钟，到点举「停」牌",
        "专注时段 00:00–07:00\n半夜直接关门",
        "实在要付尾款？花 1 ⭐ 开门 5 分钟",
      ])}${sub("守住一天攒一颗星，给它买帽子🎩")}`, [], 48),
    ];
  },

  async snooze() {
    const look = { ...LOOK, pet: null };
    const one = (n, key, idx) =>
      page(`${btn(n === 1 ? zh.ui.snoozeBtn : fill(zh.ui.snoozeBtnN, { n }))}${bubble(say(key, idx, { n }))}${row(["b0"])}`,
        [b("b0", zh.messages[key].mood, look, 26)]);
    return [
      page(`${title("它记得我点了几次\n「再玩 5 分钟」🙃")}${row(["b0", "b1", "b2"])}${sub("第 1 次、第 2 次、第 3 次\n它的表情一次比一次……")}`,
        ["neutral", "worried", "sad"].map((m, i) => b(`b${i}`, m, look, 19))),
      how(1, "时间到，它举「停」牌", framed(await S.stop(), "bilibili.com"), "气泡里就是「再玩5分钟」按钮"),
      how(2, "第 3 次，按钮上写着 #3", framed(await S.snooze3(), "bilibili.com"), "每点一次，它都记着"),
      one(1, "snooze1", 2),
      one(2, "snooze2", 1),
      one(3, "snooze3", 2),
      page(`${title("你一般点到第几次？", 64)}${row(["b0"])}${sub("评论区报数👇\n我先来：3 次，然后改了限额")}`,
        [b("b0", "blink", LOOK, 24)]),
    ];
  },

  async goal() {
    await at(DAY);
    const today = await popup(async (p) => p.locator("#list").screenshot({ scale: "device" }));
    const done = await S.goal();
    return [
      page(`${title("反向用法：\n让它逼我多学会儿📖")}${row(["b0"])}${sub("不是所有网站都要少用")}`,
        [b("b0", "proud", { ...LOOK, hat: "hat-cap" }, 30)]),
      page(`${row(["b0", "b1"], 120)}<div style="display:flex;gap:40px;width:100%">${[
        ["限额（少用）", "微博、B站、淘宝\n到点举「停」牌", "#ffb4b4"],
        ["目标（多用）", "背单词、日语、网课\n学够了给星星⭐", "#b4f0c8"],
      ].map(([h, s, c]) => `<div style="flex:1;display:flex;flex-direction:column;gap:20px;align-items:center">${tag(h, c)}${sub(s, 36)}</div>`).join("")}</div>`,
        [b("b0", "angry", LOOK, 18), b("b1", "party", LOOK, 18)], 60),
      how(1, "学习网站设成「目标」", shot(today, 900, 1150), "日语每天 20 分钟；微博、B站是「限额」"),
      how(2, "学够 20 分钟：撒花 + 1 ⭐", framed(done, "learn.example"), "就在你学习的页面上，不用切出去"),
      page(`${tag("学够 20 分钟的那一刻")}${bubble(say("goal100", 0, { m: 20 }))}${row(["b0"])}`,
        [b("b0", "party", LOOK, 26)]),
    ];
  },

  async proof() {
    await at(DAY);
    const report = await popup(async (p) => {
      await p.click(`nav [data-tab="report"]`);
      await wait(400);
      return p.screenshot({ scale: "device", fullPage: true });
    });
    return [
      page(`${title("用了两周\nB站少刷了 ※ 小时📉")}${row(["b0", "b1"], 60)}${sub("第 1 天 vs 第 14 天")}`,
        [b("b0", "neutral", LOOK, 22), b("b1", "party", LOOK, 23, ["cheeks", "grow"])]),
      how(1, "它住在网页右下角，帮我盯着 B站", framed(await S.hello(), "bilibili.com"), "B站设了每天 45 分钟，周末 90 分钟"),
      how(2, "两周后的报告页 ※ 换成自己的", pop(report, 1100), "每周对比上周，省下多少一目了然"),
      page(`${title("变化最大的不是时间\n是我不再跟自己较劲", 60)}${row(["b0"])}${sub("它从来不骂人\n超了也不扣星星，明天重新来")}`,
        [b("b0", "happy", LOOK, 22, ["cheeks"])]),
    ];
  },

  async challenge() {
    const grid = Array.from({ length: 21 }, (_, i) =>
      `<div style="width:110px;height:110px;border:4px solid ${INK};display:flex;align-items:center;justify-content:center;font:800 34px ${FONT};background:${i === 0 ? "#ffd84a" : "#fff"}">${i === 0 ? "✓" : i + 1}</div>`
    ).join("");
    return [
      page(`${title("21 天少刷手机挑战\nDay 1 🥚")}${row(["b0"])}<div style="display:grid;grid-template-columns:repeat(7,110px);gap:14px">${grid}</div>`,
        [b("b0", "happy", {}, 18, [])], 44),
      page(`${title("挑战规则", 64)}${steps([
        "B站每天 45 分钟，周末 90 分钟",
        "守住一天 = 1 ⭐，每天在这里打卡",
        "第 3 / 7 / 14 天，它会悄悄变样",
      ])}${row(["b0", "b1", "b2", "b3"])}`,
        [[], ["cheeks"], ["cheeks", "grow"], ["cheeks", "grow", "collar"]].map((e, i) => b(`b${i}`, i ? "proud" : "happy", {}, e.includes("grow") ? 11 : 10, e)), 44),
      how(1, "装好后，它在网页右下角陪你", framed(await S.hello(), "bilibili.com"), "打开 B站 它就告诉你今天还剩多久"),
      how(2, "超时了，它举「停」牌", framed(await S.stop(), "bilibili.com"), "没守住也不扣星星，明天重新来"),
      page(`${tag("Day 1 战绩")}${title("※ 今天 B站 __ 分钟\n守住了 / 没守住", 60)}${row(["b0"])}${sub("一起来的评论区打卡👇")}`,
        [b("b0", "proud", {}, 22, [])]),
    ];
  },

  async order() {
    const looks = [
      { color: "color-pink", hat: "hat-crown", accessory: "acc-shades", pet: "pet-slime" },
      { color: "color-mint", hat: "hat-cap", accessory: "acc-scarf", pet: "pet-cat" },
      { color: "color-purple", hat: "hat-top", pet: "pet-ghost" },
      { color: "color-gold", antenna: "antenna-star", accessory: "acc-shades" },
    ];
    // Year-round items only: seasonal ones aren't in the shop most of the year (the extension ignores `plus`).
    const names = (slot) => Object.entries(sprites.items)
      .filter(([, it]) => it.slot === slot && !it.season)
      .slice(0, 6).map(([id]) => zh.items[id].replace(/ [A-Za-z]+$/, "")).join(" · ");
    return [
      page(`${title("评论区点单\n给你画专属 Beepo🎨")}<div style="display:flex;align-items:flex-end;gap:24px">${looks.map((l, i) => `<div style="display:flex;align-items:flex-end;gap:10px">${l.pet ? cv(`p${i}`) : ""}${cv(`b${i}`)}</div>`).join("")}</div>${sub("前 20 位，挨个画")}`,
        looks.flatMap((l, i) => [b(`b${i}`, ["proud", "happy", "party", "blink"][i], l, 10), ...(l.pet ? [pet(`p${i}`, l.pet, 6)] : [])])),
      page(`${title("点单格式", 64)}${steps([
        `颜色：${names("color")}`,
        `帽子：${names("hat")}`,
        `宠物：${names("pet")}`,
      ])}${sub("例：粉色 + 皇冠 + 史莱姆")}`, [], 48),
      how("⭐", "想自己养？在商店换装", pop(await S.shop(), 1050), "守住限额攒星星，点一下就能试穿"),
    ];
  },
};

const POSTS = {
  howto: `标题：
Beepo 怎么用？一组图看懂👇

正文：
好多人问这个像素小机器人到底怎么用，一次讲清楚👇

① 装好后它住在网页右下角，打开你设了规则的网站，它会说今天还剩多久
② 用到 50%、80% 探头提醒，不弹窗、不打断
③ 时间到举「停」牌。可以点「再玩5分钟」，但它会记次数🙃
④ 勾了「屏蔽」的网站直接关门，还能设专注时段（比如工作日 8–18 点）
⑤ 点浏览器工具栏的图标：加规则、看今天的进度
⑥ 守住限额攒星星，给它买帽子、换颜色、领养小猫

不用注册，不联网，数据只存在自己的浏览器里
电脑：Chrome / Edge / Firefox 扩展商店
手机：安卓 Google Play
搜「Beepo by Panikka Studio」，免费

还有什么想知道的评论区问我👇

#浏览器插件 #效率工具 #自律 #防沉迷 #像素风 #宝藏插件 #时间管理 #使用教程`,

  kaoyan: `标题：
考研党｜让机器人帮我锁了微博🔒

正文：
复习的时候最怕什么？手比脑子快😇
打开电脑第一件事就是点微博，一刷就是半小时

后来给浏览器装了个像素小机器人 Beepo，设了「专注时段」：
工作日 8:00–18:00，微博直接关门，它在门口站岗🤖
18:00 之后自动开门，不用自己记得解锁

最后一张是我的设置，30 秒就能弄好
小红书 / B站 / 知乎 也能这样锁

不联网不注册，数据只在自己设备上
电脑：Chrome / Edge / Firefox 扩展商店
手机：安卓 Google Play
搜「Beepo by Panikka Studio」，免费

你复习时最想锁哪个网站？👇

#考研 #考研党 #自律 #学习方法 #浏览器插件 #效率工具 #防沉迷 #像素风`,

  double11: `标题：
双十一别熬夜了，它替我守着淘宝🛒

正文：
每年双十一都是凌晨两点还在比价、凑满减😵
今年让我的像素小机器人 Beepo 帮我守门：
· 淘宝每天 30 分钟，到点它举「停」牌
· 00:00–07:00 直接关门，想买的白天加购
· 真要付尾款？花 1 颗星开门 5 分钟

守住一天就攒一颗星，星星能给它买帽子，比买给自己还开心🎩

电脑：Chrome / Edge / Firefox 扩展商店
手机：安卓 Google Play
搜「Beepo by Panikka Studio」，免费，不联网

你们今年双十一准备剁手多少？👇

#双十一 #熬夜 #省钱 #自律 #浏览器插件 #效率工具 #像素风 #打工人`,

  snooze: `标题：
它记得我点了几次"再玩5分钟"🙃

正文：
时间到了它会举「停」牌，但可以点「再玩 5 分钟」
问题是……它会记住你点了几次

第 1 次：5 分钟，然后就走，说好了哦？
第 2 次：又要 5 分钟？好吧，不过我都记着呢。
第 3 次：要不把限额改得诚实一点？

被一只像素机器人说中了，我真的改了限额😂
它从来不骂人，就是温柔地记账

你一般点到第几次？评论区报数👇

#自律 #拖延症 #戒手机 #浏览器插件 #像素风 #治愈系 #打工人日常 #效率工具`,

  goal: `标题：
反向用法：让它逼我多学会儿📖

正文：
大部分防沉迷工具都只会让你「少用」
但学日语的网站，我是想「多用」啊

Beepo 可以给网站设「目标」：
· 微博、B站这种设「限额」，到点举「停」牌
· 日语、背单词、网课设「目标」，每天学够 20 分钟它就给一颗星⭐
学够的那一刻它会放烟花🎉

星星攒着给它买帽子，学日语突然有了 KPI😂

电脑：Chrome / Edge / Firefox 扩展商店
手机：安卓 Google Play
搜「Beepo by Panikka Studio」，免费

你们会给哪个学习网站设目标？👇

#学日语 #日语学习 #自律 #学习打卡 #浏览器插件 #效率工具 #像素风`,

  proof: `标题：
用了两周，B站少刷了 ※ 小时📉

正文：
※ 这一条要用自己的真实数据：报告页截图 + 真实的小时数

两周前装了 Beepo，一只住在网页右下角的像素机器人
给 B站设了每天 45 分钟，周末 90 分钟

结果：※ 第一周平均 __ 分钟/天 → 第二周 __ 分钟/天

变化最大的不是时间，是我不再跟自己较劲
超了它也不骂人、不扣星星，明天重新来

电脑：Chrome / Edge / Firefox 扩展商店
手机：安卓 Google Play
搜「Beepo by Panikka Studio」，免费，数据只存在自己设备上

你每天刷 B站多久？👇

#自律 #戒手机 #时间管理 #B站 #浏览器插件 #效率工具 #自我提升`,

  challenge: `标题：
21天少刷手机挑战 Day1🥚

正文：
从今天开始，21 天
规则：B站每天 45 分钟（周末 90），守住一天 = 1 颗星
我的像素机器人 Beepo 会陪我：第 3 天脸红，第 7 天长高，第 14 天戴金项圈

Day 1 战绩：※

想一起的评论区打卡，每天来报到👇
（电脑：Chrome / Edge / Firefox 扩展商店；手机：安卓 Google Play；搜「Beepo by Panikka Studio」，免费）

#21天挑战 #自律打卡 #戒手机 #每日打卡 #自我提升 #像素风`,

  order: `标题：
评论区点单，给你画专属Beepo🎨

正文：
Beepo 是我做的浏览器像素小机器人，守住每日限额就攒星星换衣服
这次反过来：你点单，我来画👇

格式：颜色 + 帽子 + 宠物（看第 2 张）
例：粉色 + 皇冠 + 史莱姆

前 20 位，每个都画，画好发在评论区回复你
想养一只真的：
电脑：Chrome / Edge / Firefox 扩展商店
手机：安卓 Google Play
搜「Beepo by Panikka Studio」，免费

#像素风 #像素画 #评论区点单 #头像 #可爱 #治愈系 #独立开发`,
};

// Last image of every set: where to get him (official store logos, see STORES).
function endCard() {
  const tile = ({ name, logo }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;background:#fff;border:4px solid ${INK};box-shadow:6px 6px 0 ${INK};padding:26px 0 20px">
    <img src="${logo}" style="width:96px;height:96px;object-fit:contain"><div style="font:700 28px ${FONT};white-space:nowrap">${esc(name)}</div>
    <div style="font:600 24px ${FONT};opacity:.6">${name === "Google Play" ? "安卓手机" : "电脑浏览器"}</div></div>`;
  return page(`${title("电脑和手机都能养", 80)}<div style="display:flex;align-items:flex-end;gap:14px">${cv("p0")}${cv("b0")}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:22px;width:100%">${STORES.map(tile).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:center;background:#ffd84a;border:5px solid ${INK};box-shadow:8px 8px 0 ${INK};padding:24px 44px">
      <div style="font:700 34px ${FONT}">🔍 在商店里搜索</div>
      <div style="font:800 54px ${FONT}">Beepo by Panikka Studio</div></div>
    ${sub("免费 · 不用注册 · 数据只存在你自己的设备上", 34)}`,
    [b("b0", "party", { ...LOOK, hat: "hat-party" }, 18), pet("p0", "pet-cat", 11)], 56);
}

// ---------- run ----------

const pick = process.argv.slice(2).filter((a) => a in SETS);
for (const name of pick.length ? pick : Object.keys(SETS)) {
  const dir = `${root}dist/social/xhs/angles/${name}/`;
  mkdirSync(dir, { recursive: true });
  const cards = [...(await SETS[name]()), endCard()];
  for (const [i, card] of cards.entries()) writeFileSync(`${dir}${i + 1}.png`, await render(composer, card));
  writeFileSync(`${dir}post.txt`, `${POSTS[name]}\n\n---\nimages: 1.png–${cards.length}.png\n`);
  console.log(`${dir.slice(root.length)} (${cards.length})`);
}

await ctx.close();
