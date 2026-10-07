import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../extension/lib/core.js";

const rule = (over = {}) => ({
  id: "r1", name: "yt", patterns: ["youtube.com"], mode: "limit", minutes: 30,
  weekendMinutes: null, block: false, hidden: false, focus: null, ...over,
});
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

test("dateKey respects reset hour", () => {
  assert.equal(core.dateKey(at(2026, 10, 2, 3), 4), "2026-10-01");
  assert.equal(core.dateKey(at(2026, 10, 2, 5), 4), "2026-10-02");
  assert.equal(core.dateKey(at(2026, 10, 2, 0, 30), 0), "2026-10-02");
});

test("addDays crosses months and years", () => {
  assert.equal(core.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(core.addDays("2026-12-31", 1), "2027-01-01");
});

test("normalizePattern", () => {
  assert.equal(core.normalizePattern("https://www.YouTube.com/shorts/"), "youtube.com/shorts");
  assert.equal(core.normalizePattern("reddit.com"), "reddit.com");
  assert.equal(core.normalizePattern("  "), null);
  assert.equal(core.normalizePattern("notadomain"), null);
});

test("matchRule: subdomains and most specific path wins", () => {
  const yt = rule();
  const shorts = rule({ id: "r2", patterns: ["youtube.com/shorts"] });
  const rules = [yt, shorts];
  assert.equal(core.matchRule(rules, "https://m.youtube.com/watch?v=1").id, "r1");
  assert.equal(core.matchRule(rules, "https://www.youtube.com/shorts/abc").id, "r2");
  assert.equal(core.matchRule(rules, "https://youtube.com/shortsfoo").id, "r1");
  assert.equal(core.matchRule(rules, "https://notyoutube.com/"), null);
});

test("weekend limits", () => {
  const r = rule({ weekendMinutes: 60 });
  assert.equal(core.baseLimitSecs(r, "2026-10-03"), 3600); // Saturday
  assert.equal(core.baseLimitSecs(r, "2026-10-05"), 1800); // Monday
  assert.equal(core.baseLimitSecs(rule({ weekendMinutes: 0 }), "2026-10-04"), 0);
});

test("focus hours incl. overnight and weekdays only", () => {
  const f = { start: "09:00", end: "17:00", weekdaysOnly: true };
  assert.equal(core.inFocus(f, at(2026, 10, 5, 10)), true); // Mon
  assert.equal(core.inFocus(f, at(2026, 10, 5, 18)), false);
  assert.equal(core.inFocus(f, at(2026, 10, 4, 10)), false); // Sun
  const night = { start: "23:00", end: "06:00" };
  assert.equal(core.inFocus(night, at(2026, 10, 5, 2)), true);
  assert.equal(core.inFocus(night, at(2026, 10, 5, 12)), false);
});

test("milestones fire once, in order, then nag", () => {
  const notified = [];
  const m = (used, bonus = 0) => core.milestone({ mode: "limit", used, base: 600, bonus, notified, nagMinutes: 5 });
  assert.equal(m(100), null);
  assert.equal(m(300), "limit50");
  assert.equal(m(305), null);
  assert.equal(m(480), "limit80");
  assert.equal(m(600), "limit100");
  assert.equal(m(800), null);
  assert.equal(m(900), "over");
  assert.equal(m(905), null);
  assert.equal(m(1200), "over");
  // snoozed: 300s bonus -> snoozeOver at 1500
  assert.equal(m(1500, 300), "snoozeOver");
});

test("goal milestones", () => {
  const notified = [];
  assert.equal(core.milestone({ mode: "goal", used: 300, base: 600, notified }), "goal50");
  assert.equal(core.milestone({ mode: "goal", used: 600, base: 600, notified }), "goal100");
  assert.equal(core.milestone({ mode: "goal", used: 9999, base: 600, notified }), null);
});

test("blockState", () => {
  const now = at(2026, 10, 5, 12);
  assert.equal(core.blockState({ rule: rule(), used: 9999, base: 60, now }), "ok");
  assert.equal(core.blockState({ rule: rule({ block: true }), used: 60, base: 60, now }), "blocked-limit");
  assert.equal(core.blockState({ rule: rule({ block: true }), used: 60, base: 60, bonus: 300, now }), "ok");
  assert.equal(core.blockState({ rule: rule({ block: true }), used: 60, base: 60, now, unlockUntil: now + 1 }), "ok");
  const focus = rule({ focus: { start: "09:00", end: "17:00" } });
  assert.equal(core.blockState({ rule: focus, used: 0, base: 60, now }), "blocked-focus");
});

function entry(date, results, extra = {}) {
  return { date, usage: {}, domains: {}, snoozes: 0, night: 0, results, ...extra };
}
const L = (ok) => ({ mode: "limit", ok, used: 0, limit: 60 });
const G = (ok) => ({ mode: "goal", ok, used: 0, limit: 60 });

test("finalizeDay ignores snooze bonus when judging limits", () => {
  const day = { ...core.newDay("2026-10-05"), usage: { r1: 1900 }, bonus: { r1: 300 }, snoozes: { r1: 1 } };
  const e = core.finalizeDay(day, [rule()]);
  assert.equal(e.results.r1.ok, false);
  assert.equal(e.snoozes, 1);
});

test("streaks: consecutive, gaps count as kept, breaks", () => {
  const h = [
    entry("2026-10-01", { a: L(false) }),
    entry("2026-10-02", { a: L(true), g: G(true) }),
    // 10-03 missing (didn't browse)
    entry("2026-10-04", { a: L(true), g: G(true) }),
  ];
  assert.deepEqual(core.streaks(h, "2026-10-05"), { limitStreak: 3, goalStreak: 1, missStreak: 0 });

  const bad = [entry("2026-10-03", { a: L(false) }), entry("2026-10-04", { a: L(false) })];
  assert.deepEqual(core.streaks(bad, "2026-10-05"), { limitStreak: 0, goalStreak: 0, missStreak: 2 });
  assert.deepEqual(core.streaks([], "2026-10-05"), { limitStreak: 0, goalStreak: 0, missStreak: 0 });
});

test("badges", () => {
  const wallet = { ...core.DEFAULT_WALLET, earned: 1, badges: [] };
  const ids = core.newBadges({ wallet, history: [], today: "2026-10-05", limitStreak: 7, goalStreak: 0 }).map((b) => b.id);
  assert.deepEqual(ids, ["first_star", "streak3", "week_clean"]);

  const week = Array.from({ length: 7 }, (_, i) => entry(core.addDays("2026-10-05", -1 - i), {}));
  const w2 = { ...wallet, badges: ["first_star", "streak3", "week_clean"] };
  const ids2 = core.newBadges({ wallet: w2, history: week, today: "2026-10-05", limitStreak: 0, goalStreak: 0 }).map((b) => b.id);
  assert.deepEqual(ids2, ["night_owl_reformed", "unsnoozable"]);
});

test("evolution", () => {
  const defs = [{ id: "cheeks", minStreak: 3, rows: {} }, { id: "grow", minStreak: 7, grow: 1 }];
  assert.deepEqual(core.evolution(defs, { limitStreak: 7, goalStreak: 0, missStreak: 0 }), { evolve: ["cheeks"], grow: 1, scruffy: false });
  assert.equal(core.evolution(defs, { limitStreak: 0, goalStreak: 0, missStreak: 2 }).scruffy, true);
});

test("suggestions skip tracked and dismissed domains", () => {
  const d = (date, domains) => ({ date, domains, results: {} });
  const big = { "reddit.com": 3600, "youtube.com": 3600, "news.com": 3600 };
  const h = [d("1", big), d("2", big), d("3", big)];
  const s = core.suggestions(h, { domains: {} }, [rule()], ["news.com"]);
  assert.deepEqual(s.map((x) => x.domain), ["reddit.com"]);
});

test("weeklyReport totals and savings", () => {
  const h = [
    { date: "2026-09-28", usage: { r1: 3600 }, results: { r1: L(false) } }, // last week
    { date: "2026-10-04", usage: { r1: 600 }, results: { r1: L(true) } },
  ];
  const day = { ...core.newDay("2026-10-05"), usage: { r1: 300 } };
  const rep = core.weeklyReport(h, day, [rule()], "2026-10-05");
  assert.equal(rep.days.length, 7);
  assert.equal(rep.days.at(-1).total, 300);
  assert.equal(rep.perRule[0].thisWeek, 900);
  assert.equal(rep.perRule[0].lastWeek, 3600);
  assert.equal(rep.savedSecs, 2700);
  assert.equal(rep.bestDay.date, "2026-10-04");
});

test("migrateV1", () => {
  const { rules, wallet } = core.migrateV1([{ domain: "x.com", minutes: 10, mode: "limit" }], 4);
  assert.equal(rules[0].patterns[0], "x.com");
  assert.equal(wallet.stars, 4);
});

test("v0.1 day migrates to rule ids and keeps fired milestones", () => {
  const rules = [rule({ id: "abc", patterns: ["youtube.com"] })];
  const old = { date: "2026-10-02", usage: { "youtube.com": 900, "x.com": 5 }, notified: { "youtube.com": ["0.5", "0.8", "1", "nag1"] } };
  const d = core.normalizeDay(core.migrateDayV1(old, rules));
  assert.equal(d.usage.abc, 900);
  assert.deepEqual(d.notified.abc, ["limit50", "limit80", "limit100", "over1"]);
  assert.deepEqual(d.bonus, {});
  assert.equal(d.domains["x.com"], 5);
  assert.equal(core.milestone({ mode: "limit", used: 900, base: 600, notified: d.notified.abc }), null);
});
