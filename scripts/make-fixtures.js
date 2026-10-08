// Runs the extension's JS over sample inputs and saves inputs + outputs into tests/fixtures/,
// so ports (android/) can check they behave exactly the same.
//   sprite-cases.json  render/sprite.js: composed grids and pet frames
//   core-cases.json    lib/core.js: { fn: [{ args, out }] }
// Times are local "YYYY-MM-DDTHH:MM" strings (no DST edges), so the files don't depend on the time zone.
// `--check` only compares with the files on disk and fails if they're stale (run by npm test).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as core from "../extension/lib/core.js";

await import("../extension/render/sprite.js");
const { compose, findItem } = globalThis.BeepoSprite;
const sprites = JSON.parse(readFileSync(new URL("../extension/data/sprites.json", import.meta.url)));
const check = process.argv.includes("--check");
const stale = [];
// One case per line: small enough to commit, readable in diffs.
const write = (name, data) => {
  const groups = Object.entries(data).map(([k, list]) => `${JSON.stringify(k)}: [\n${list.map((c) => JSON.stringify(c)).join(",\n")}\n]`);
  const text = `{\n${groups.join(",\n")}\n}\n`;
  const file = new URL(`../tests/fixtures/${name}`, import.meta.url);
  if (!check) writeFileSync(file, text);
  else if (!existsSync(file) || readFileSync(file, "utf8") !== text) stale.push(name);
};
const log = (msg) => check || console.log(msg);

// ---------- sprites ----------

const assets = { sprites };
const ids = (slot) => Object.keys(sprites.items).filter((id) => sprites.items[id].slot === slot);

const cases = [];
const add = (name, opts) => {
  const { grid, palette } = compose(assets, opts);
  cases.push({ name, opts, grid: grid.map((r) => r.join("")), palette });
};

for (const mood of Object.keys(sprites.faces)) add(`mood ${mood}`, { mood });
add("unknown mood", { mood: "nope" });
for (const pose of Object.keys(sprites.poses)) add(`pose ${pose}`, { mood: "happy", pose });
for (const slot of ["color", "antenna", "hat", "accessory"]) {
  for (const id of ids(slot)) add(`${slot} ${id}`, { mood: "neutral", look: { equipped: { [slot]: id } } });
}
add("everything", {
  mood: "party",
  pose: "wave",
  look: {
    equipped: { color: "color-gold", antenna: ids("antenna")[0], hat: ids("hat")[0], accessory: ids("accessory")[0] },
    evolve: sprites.evolve.map((e) => e.id),
    scruffy: true,
  },
});
add("scruffy", { mood: "sad", look: { scruffy: true } });

const pets = ids("pet").flatMap((id) =>
  findItem(assets, id).frames.map((f, frame) => ({ id, frame, grid: f })),
);

write("sprite-cases.json", { cases, pets });
log(`sprites: ${cases.length} cases, ${pets.length} pet frames`);

// ---------- core ----------

// Seeded so regenerating only changes the file when the logic changes.
let seed = 42;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (n) => Math.floor(rand() * n);
const pick = (a) => a[int(a.length)];

const local = (s) => {
  const [d, t = "00:00"] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = t.split(":").map(Number);
  return new Date(y, m - 1, day, h, min).getTime();
};
const times = (from, days, everyMin) => {
  const out = [];
  for (let i = 0; i < (days * 24 * 60) / everyMin; i++) {
    const mins = i * everyMin;
    const d = core.addDays(from, Math.floor(mins / 1440));
    const hm = mins % 1440;
    out.push(`${d}T${String(Math.floor(hm / 60)).padStart(2, "0")}:${String(hm % 60).padStart(2, "0")}`);
  }
  return out;
};

const rule = (over = {}) => ({
  id: "r1", name: "yt", patterns: ["youtube.com"], mode: "limit", minutes: 30,
  weekendMinutes: null, block: false, hidden: false, focus: null, ...over,
});
const out = {};
const run = (fn, args, f) => (out[fn] ||= []).push({ args, out: f() });

for (const now of ["2026-10-02T03:00", "2026-10-02T03:59", "2026-10-02T04:00", "2026-10-02T05:00", "2026-10-02T00:30",
  "2026-01-01T02:00", "2026-03-01T00:00", "2026-12-31T23:59", "2027-01-01T03:30"]) {
  for (const resetHour of [0, 4, 6]) run("dateKey", { now, resetHour }, () => core.dateKey(local(now), resetHour));
}

for (const key of ["2026-03-01", "2026-12-31", "2024-02-28", "2026-10-05", "2028-02-29"]) {
  for (const n of [-400, -31, -1, 0, 1, 7, 60, 366]) run("addDays", { key, n }, () => core.addDays(key, n));
}

for (let i = 0; i < 14; i++) {
  const key = core.addDays("2026-10-01", i);
  run("isWeekend", { key }, () => core.isWeekend(key));
}

const seasons = { "hat-witch": ["10-01", "10-31"], "hat-santa": ["12-01", "01-06"], "x-day": ["02-14", "02-14"] };
for (const key of ["2026-09-30", "2026-10-01", "2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01", "2026-12-31",
  "2027-01-01", "2027-01-06", "2027-01-07", "2027-02-13", "2027-02-14", "2027-02-15"]) {
  for (const id of Object.keys(seasons)) run("inSeason", { season: seasons[id], key }, () => core.inSeason(seasons[id], key));
  for (const seen of [[], ["hat-witch"], ["hat-santa", "x-day"]]) {
    run("revealSeasonal", { seasons, key, seen }, () => core.revealSeasonal(seasons, key, seen));
  }
}

for (const r of [rule(), rule({ weekendMinutes: 60 }), rule({ weekendMinutes: 0 }), rule({ minutes: 0, weekendMinutes: 15 })]) {
  for (const key of ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-09"]) {
    run("baseLimitSecs", { rule: r, key }, () => core.baseLimitSecs(r, key));
  }
}

const focuses = [
  null,
  { start: "09:00", end: "17:00", weekdaysOnly: true },
  { start: "09:00", end: "17:00" },
  { start: "23:00", end: "06:00" },
  { start: "22:30", end: "07:15", weekdaysOnly: true },
  { start: "00:00", end: "00:00" },
  { start: "", end: "" },
];
for (const focus of focuses) {
  for (const now of times("2026-10-03", 3, 75)) run("inFocus", { focus, now }, () => core.inFocus(focus, local(now)));
}

for (const now of times("2026-10-05", 1, 30)) run("isNight", { now }, () => core.isNight(local(now)));

// Milestones mutate `notified`, so each case is a sequence of ticks sharing it: one event per tick, then the final list.
const milestoneRun = (mode, base, nagMinutes, ticks) => {
  const notified = [];
  run("milestone", { mode, base, nagMinutes, ticks }, () => {
    const events = ticks.map(({ used, bonus }) => core.milestone({ mode, used, base, bonus, notified, nagMinutes }));
    return { events, notified };
  });
};
const ramp = (to, step, bonusAt = Infinity, bonus = 0) =>
  Array.from({ length: Math.floor(to / step) + 1 }, (_, i) => ({ used: i * step, bonus: i * step >= bonusAt ? bonus : 0 }));
milestoneRun("limit", 600, 5, ramp(2400, 60));
milestoneRun("limit", 600, 5, ramp(3000, 30, 700, 300));
milestoneRun("limit", 600, 5, ramp(3000, 30, 700, 600));
milestoneRun("limit", 601, 3, ramp(2000, 5));
milestoneRun("limit", 600, 0, ramp(2400, 60));
milestoneRun("limit", 0, 5, ramp(900, 30));
milestoneRun("goal", 600, 5, ramp(2400, 60));
milestoneRun("goal", 900, 5, [{ used: 0 }, { used: 2000 }, { used: 2100 }].map((t) => ({ ...t, bonus: 0 })));
milestoneRun("limit", 600, 5, [{ used: 0 }, { used: 700 }, { used: 5000 }, { used: 5100 }].map((t) => ({ ...t, bonus: 0 })));
for (let i = 0; i < 10; i++) {
  let used = 0;
  let bonus = 0;
  const ticks = [];
  for (let t = 0; t < 80; t++) {
    used += pick([5, 15, 60, 120]);
    if (rand() < 0.04) bonus += 300;
    ticks.push({ used, bonus });
  }
  milestoneRun(pick(["limit", "goal"]), pick([300, 600, 1800]), pick([0, 1, 5, 10]), ticks);
}

for (const now of ["2026-10-05T12:00", "2026-10-05T08:00", "2026-10-04T12:00", "2026-10-05T23:30"]) {
  for (const r of [rule(), rule({ block: true }), rule({ block: true, mode: "goal" }),
    rule({ focus: { start: "09:00", end: "17:00", weekdaysOnly: true } }), rule({ block: true, focus: { start: "23:00", end: "06:00" } })]) {
    for (const [used, base, bonus] of [[0, 60, 0], [59, 60, 0], [60, 60, 0], [60, 60, 300], [400, 60, 300], [9999, 60, 0]]) {
      for (const unlockIn of [0, 1, -1]) {
        const args = { rule: r, used, base, bonus, now, unlockIn };
        run("blockState", args, () =>
          core.blockState({ rule: r, used, base, bonus, now: local(now), unlockUntil: unlockIn ? local(now) + unlockIn : 0 }),
        );
      }
    }
  }
}

const rules = [
  rule(),
  rule({ id: "r2", name: "reddit", patterns: ["reddit.com"], weekendMinutes: 60 }),
  rule({ id: "g1", name: "duo", patterns: ["duolingo.com"], mode: "goal", minutes: 15 }),
];
const hosts = Array.from({ length: 36 }, (_, i) => `s${i}.com`);
const randomDay = (date) => {
  const day = core.newDay(date);
  for (const r of rules) if (rand() < 0.8) day.usage[r.id] = int(5400);
  for (const h of hosts) if (rand() < 0.5) day.domains[h] = pick([60, 600, 2700, 3600, int(7200)]);
  for (const r of rules) if (rand() < 0.2) day.snoozes[r.id] = 1 + int(3);
  if (rand() < 0.3) day.night = int(1800);
  return day;
};
run("finalizeDay", { day: { ...core.newDay("2026-10-05"), usage: { r1: 1900 }, bonus: { r1: 300 }, snoozes: { r1: 1 } }, rules: [rule()] },
  () => core.finalizeDay({ ...core.newDay("2026-10-05"), usage: { r1: 1900 }, bonus: { r1: 300 }, snoozes: { r1: 1 } }, [rule()]));
for (let i = 0; i < 8; i++) {
  const day = randomDay(core.addDays("2026-10-01", i));
  run("finalizeDay", { day, rules }, () => core.finalizeDay(day, rules));
}

// Random histories: gaps, mixed results, sometimes no limit rules at all.
const L = (ok) => ({ mode: "limit", ok, used: 0, limit: 60 });
const G = (ok) => ({ mode: "goal", ok, used: 0, limit: 60 });
const randomHistory = (today, n) => {
  const h = [];
  for (let i = n; i >= 1; i--) {
    if (rand() < 0.15) continue;
    const date = core.addDays(today, -i);
    const results = {};
    if (rand() < 0.85) results.a = L(rand() < 0.75);
    if (rand() < 0.5) results.b = L(rand() < 0.85);
    if (rand() < 0.6) results.g = G(rand() < 0.7);
    const usage = { r1: int(4000), g1: int(1800) };
    const domains = {};
    for (const host of ["reddit.com", "youtube.com", "news.com", "x.com"]) if (rand() < 0.7) domains[host] = pick([600, 2700, 3600]);
    h.push({ date, usage, domains, snoozes: rand() < 0.2 ? 1 : 0, night: rand() < 0.2 ? 300 : 0, results });
  }
  return h;
};
const histories = [
  [],
  [{ date: "2026-10-01", results: { a: L(false) } }, { date: "2026-10-02", results: { a: L(true), g: G(true) } },
    { date: "2026-10-04", results: { a: L(true), g: G(true) } }],
  [{ date: "2026-10-03", results: { a: L(false) } }, { date: "2026-10-04", results: { a: L(false) } }],
  [{ date: "2026-10-03", results: {} }, { date: "2026-10-04", results: { g: G(true) } }],
  ...Array.from({ length: 30 }, () => randomHistory("2026-10-05", 5 + int(25))),
];
// Each function only gets the history fields it reads.
const only = (history, ...keys) => history.map((h) => Object.fromEntries(keys.filter((k) => k in h).map((k) => [k, h[k]])));
for (const full of histories) {
  const history = only(full, "date", "results");
  run("streaks", { history, today: "2026-10-05" }, () => core.streaks(history, "2026-10-05"));
}

const wallets = [
  { ...core.DEFAULT_WALLET },
  { ...core.DEFAULT_WALLET, earned: 1 },
  { ...core.DEFAULT_WALLET, earned: 20, goalsMet: 10, owned: ["color-blue", "hat-cap", "hat-top", "pet-cat"] },
  { ...core.DEFAULT_WALLET, earned: 20, goalsMet: 12, badges: ["first_star", "goal_crusher", "streak3"] },
];
const weekClean = Array.from({ length: 7 }, (_, i) => ({ date: core.addDays("2026-10-05", -1 - i), usage: {}, domains: {}, snoozes: 0, night: 0, results: {} }));
for (const wallet of wallets) {
  for (const history of [[], weekClean, histories[5], histories[6], histories[7]].map((h) => only(h, "date", "snoozes", "night"))) {
    for (const [limitStreak, goalStreak] of [[0, 0], [3, 0], [7, 7], [30, 2]]) {
      const ctx = { wallet, history, today: "2026-10-05", limitStreak, goalStreak };
      run("newBadges", ctx, () => core.newBadges(ctx).map((b) => b.id));
    }
  }
}

const testDefs = [{ id: "cheeks", minStreak: 3, rows: {} }, { id: "grow", minStreak: 7, grow: 1 }];
for (const defs of [sprites.evolve, testDefs]) {
  for (const limitStreak of [0, 3, 7, 14, 30]) {
    for (const goalStreak of [0, 5, 20]) {
      for (const missStreak of [0, 1, 2]) {
        const s = { limitStreak, goalStreak, missStreak };
        run("evolution", { defs, ...s }, () => core.evolution(defs, s));
      }
    }
  }
}

// Android passes "is this tracked?" instead of URL matching, so rule patterns here are plain hosts.
const sd = (date, domains) => ({ date, domains, results: {} });
const big = { "reddit.com": 3600, "youtube.com": 3600, "news.com": 3600 };
run("suggestions", { history: [sd("1", big), sd("2", big), sd("3", big)], day: { domains: {} }, rules: [rule()], dismissed: ["news.com"] },
  () => core.suggestions([sd("1", big), sd("2", big), sd("3", big)], { domains: {} }, [rule()], ["news.com"]));
for (const history of histories.slice(4, 16).map((h) => only(h, "date", "domains"))) {
  for (const dismissed of [[], ["reddit.com"]]) {
    const day = { domains: { "x.com": 3000, "twitch.tv": 600 } };
    run("suggestions", { history, day, rules: [rule()], dismissed }, () => core.suggestions(history, day, [rule()], dismissed));
  }
}

const reportHistory = [
  { date: "2026-09-28", usage: { r1: 3600 }, results: { r1: L(false) } },
  { date: "2026-10-04", usage: { r1: 600 }, results: { r1: L(true) } },
];
const reportDay = { ...core.newDay("2026-10-05"), usage: { r1: 300 } };
run("weeklyReport", { history: reportHistory, day: reportDay, rules: [rule()], today: "2026-10-05" },
  () => core.weeklyReport(reportHistory, reportDay, [rule()], "2026-10-05"));
for (const history of histories.slice(4, 20).map((h) => only(h, "date", "usage", "results"))) {
  const day = { ...core.newDay("2026-10-05"), usage: { r1: int(3000), g1: int(900) } };
  run("weeklyReport", { history, day, rules, today: "2026-10-05" }, () => core.weeklyReport(history, day, rules, "2026-10-05"));
}

for (const [text, vars] of [["{m} min on {name}", { m: 30, name: "yt" }], ["no vars", {}], ["{missing} stays", {}],
  ["{a}{a}{b}", { a: "x", b: 0 }], ["{ spaced } {x_1}", { x_1: "ok" }]]) {
  run("fillTemplate", { text, vars }, () => core.fillTemplate(text, vars));
}

for (const day of [{ date: "2026-10-05" }, { date: "2026-10-05", usage: { r1: 5 }, night: null },
  { date: "2026-10-05", usage: null, notified: { r1: ["limit50"] }, unlockUntil: { r1: 123 } }, core.newDay("2026-10-05")]) {
  run("normalizeDay", { day }, () => core.normalizeDay(day));
}

for (const [pref, uiLang] of [["ja", "de-DE"], ["auto", "de-DE"], ["auto", "zh-HK"], ["auto", "zh-MO"], ["auto", "zh-TW"],
  ["auto", "zh-Hant"], ["auto", "zh-Hant-HK"], ["auto", "zh-CN"], ["auto", "zh"], ["auto", "pt-PT"], ["auto", "pt_BR"],
  ["auto", "uk"], ["auto", "nl-NL"], ["xx", "fr"], [null, "AR-eg"], ["auto", "yue"], ["auto", "en-GB"], ["zh_TW", "en"]]) {
  run("resolveLang", { pref, uiLang }, () => core.resolveLang(pref, uiLang));
}

write("core-cases.json", out);
log(`core: ${Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
if (stale.length) {
  console.error(`Stale fixtures: ${stale.join(", ")}. Run npm run fixtures.`);
  process.exit(1);
}
