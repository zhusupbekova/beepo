// Pure logic shared by the background worker, popup and tests.
// No chrome.* APIs in here.

export const DEFAULT_SETTINGS = {
  side: "right", // home corner
  scale: 4, // pixel size
  quiet: false, // only speak up for the important stuff
  sound: false,
  wander: true,
  nagMinutes: 5,
  resetHour: 4, // day rolls over at 4am, not midnight
  everywhere: false, // show Beepo on untracked sites too
  idleSeconds: 60,
  dismissed: [], // suggestion domains the user said no to
};

export const DEFAULT_WALLET = {
  stars: 0, // spendable
  earned: 0, // lifetime
  goalsMet: 0,
  owned: ["color-blue"],
  equipped: { color: "color-blue", hat: null, antenna: null, accessory: null, pet: null },
  badges: [],
};

export const SNOOZE_SECS = 5 * 60;
export const UNLOCK_SECS = 5 * 60;
export const UNLOCK_COST = 1;
export const BADGE_REWARD = 3;
export const HISTORY_DAYS = 60;

// ---------- dates ----------

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local date key (YYYY-MM-DD) for `now`, where the day starts at `resetHour`. */
export function dateKey(now, resetHour = 0) {
  return fmtDate(new Date(now - resetHour * 3600_000));
}

export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return fmtDate(new Date(y, m - 1, d + n));
}

export function isWeekend(key) {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

// ---------- matching ----------

/** "https://www.YouTube.com/shorts/abc" or "youtube.com/shorts" -> "youtube.com/shorts". */
export function normalizePattern(input) {
  let s = String(input || "").trim().toLowerCase();
  if (!s) return null;
  try {
    if (!/^[a-z]+:\/\//.test(s)) s = "https://" + s;
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes(".") && host !== "localhost") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return host + path;
  } catch {
    return null;
  }
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function patternMatches(pattern, host, path) {
  const slash = pattern.indexOf("/");
  const pHost = slash < 0 ? pattern : pattern.slice(0, slash);
  const pPath = slash < 0 ? "" : pattern.slice(slash);
  if (host !== pHost && !host.endsWith("." + pHost)) return false;
  if (!pPath) return true;
  return path === pPath || path.startsWith(pPath + "/");
}

/** Most specific matching rule wins (longest pattern), so "youtube.com/shorts" beats "youtube.com". */
export function matchRule(rules, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname.toLowerCase();
  let best = null;
  let bestLen = -1;
  for (const rule of rules) {
    for (const p of rule.patterns) {
      if (p.length > bestLen && patternMatches(p, host, path)) {
        best = rule;
        bestLen = p.length;
      }
    }
  }
  return best;
}

// ---------- limits ----------

export function baseLimitSecs(rule, key) {
  const weekend = rule.weekendMinutes != null && rule.weekendMinutes !== "" && isWeekend(key);
  return (weekend ? Number(rule.weekendMinutes) : rule.minutes) * 60;
}

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Is `now` inside the rule's focus hours (when the site is off-limits)? Handles overnight ranges. */
export function inFocus(focus, now) {
  if (!focus || !focus.start || !focus.end) return false;
  const d = new Date(now);
  const day = d.getDay();
  if (focus.weekdaysOnly && (day === 0 || day === 6)) return false;
  const t = d.getHours() * 60 + d.getMinutes();
  const s = toMin(focus.start);
  const e = toMin(focus.end);
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

/**
 * Which milestone fires for this tick (at most one). Returns the event key or null
 * and pushes the dedupe key into `notified`.
 */
export function milestone({ mode, used, base, bonus = 0, notified, nagMinutes = 5 }) {
  const fire = (key, event = key) => {
    if (notified.includes(key)) return null;
    notified.push(key);
    return event;
  };
  let event = null;
  const steps = mode === "goal" ? [[0.5, "goal50"], [1, "goal100"]] : [[0.5, "limit50"], [0.8, "limit80"], [1, "limit100"]];
  for (const [at, key] of steps) {
    if (used >= base * at) event = fire(key) || event;
  }
  if (event || mode !== "limit") return event;

  const limit = base + bonus;
  if (bonus > 0 && used >= limit) {
    const e = fire("snoozeOver" + bonus, "snoozeOver");
    if (e) return e;
  }
  const overBy = used - limit;
  const nag = nagMinutes * 60;
  if (nag > 0 && overBy >= nag) return fire("over" + Math.floor(overBy / nag), "over");
  return null;
}

/** "ok" | "blocked-limit" | "blocked-focus" */
export function blockState({ rule, used, base, bonus = 0, now, unlockUntil = 0 }) {
  if (now < unlockUntil) return "ok";
  if (inFocus(rule.focus, now)) return "blocked-focus";
  if (rule.block && rule.mode === "limit" && used >= base + bonus) return "blocked-limit";
  return "ok";
}

export const isNight = (now) => new Date(now).getHours() < 5;

// ---------- days, streaks, badges ----------

export function newDay(key) {
  return { date: key, usage: {}, domains: {}, bonus: {}, snoozes: {}, notified: {}, unlockUntil: {}, night: 0 };
}

/** Compact history entry for a finished day. Limit results ignore snooze bonus time. */
export function finalizeDay(day, rules) {
  const results = {};
  for (const r of rules) {
    const used = day.usage[r.id] || 0;
    const limit = baseLimitSecs(r, day.date);
    results[r.id] = { mode: r.mode, limit, used, ok: r.mode === "goal" ? used >= limit : used <= limit };
  }
  const domains = Object.fromEntries(
    Object.entries(day.domains || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
  );
  const snoozes = Object.values(day.snoozes || {}).reduce((a, b) => a + b, 0);
  return { date: day.date, usage: { ...day.usage }, domains, snoozes, night: day.night || 0, results };
}

/**
 * Streaks over completed days (yesterday backwards). Missing days (browser not used) count as
 * limits kept but goals missed. Days with no limit rules neither extend nor break the limit streak.
 */
export function streaks(history, todayKey) {
  const byDate = new Map(history.map((h) => [h.date, h]));
  const first = history.reduce((min, h) => (h.date < min ? h.date : min), todayKey);
  let limitStreak = 0;
  let goalStreak = 0;
  let missStreak = 0;
  let limitDone = false;
  let goalDone = false;
  let missDone = false;
  for (let k = addDays(todayKey, -1); k >= first && !(limitDone && goalDone && missDone); k = addDays(k, -1)) {
    const h = byDate.get(k);
    const res = h ? Object.values(h.results) : [];
    const limits = res.filter((r) => r.mode === "limit");
    const goals = res.filter((r) => r.mode === "goal");
    const kept = limits.every((r) => r.ok);

    if (!limitDone && (!h || limits.length)) kept ? limitStreak++ : (limitDone = true);
    if (!goalDone) h && goals.length && goals.every((r) => r.ok) ? goalStreak++ : (goalDone = true);
    if (!missDone) h && limits.length && !kept ? missStreak++ : (missDone = true);
  }
  return { limitStreak, goalStreak, missStreak };
}

function lastNConsecutive(history, n, todayKey) {
  const out = [];
  const byDate = new Map(history.map((h) => [h.date, h]));
  for (let i = 1; i <= n; i++) {
    const h = byDate.get(addDays(todayKey, -i));
    if (!h) return null;
    out.push(h);
  }
  return out;
}

export const BADGES = [
  { id: "first_star", name: "First Star", desc: "Earn your very first star.", test: (c) => c.wallet.earned >= 1 },
  { id: "streak3", name: "Warming Up", desc: "Keep every limit 3 days in a row.", test: (c) => c.limitStreak >= 3 },
  { id: "week_clean", name: "First Week Clean", desc: "Keep every limit for 7 days.", test: (c) => c.limitStreak >= 7 },
  { id: "month_clean", name: "Iron Will", desc: "Keep every limit for 30 days.", test: (c) => c.limitStreak >= 30 },
  { id: "goal_crusher", name: "Goal Crusher", desc: "Hit 10 daily goals.", test: (c) => c.wallet.goalsMet >= 10 },
  { id: "on_a_roll", name: "On a Roll", desc: "Hit all goals 7 days in a row.", test: (c) => c.goalStreak >= 7 },
  {
    id: "night_owl_reformed",
    name: "Night Owl Reformed",
    desc: "A full week with no tracked sites after midnight.",
    test: (c) => !!lastNConsecutive(c.history, 7, c.today)?.every((h) => !h.night),
  },
  {
    id: "unsnoozable",
    name: "Unsnoozable",
    desc: "A full week without hitting snooze.",
    test: (c) => !!lastNConsecutive(c.history, 7, c.today)?.every((h) => !h.snoozes),
  },
  { id: "fashionista", name: "Fashionista", desc: "Own 3 cosmetics from the shop.", test: (c) => c.wallet.owned.length >= 4 },
];

/** Badges newly earned given the context { wallet, history, today, limitStreak, goalStreak }. */
export function newBadges(ctx) {
  return BADGES.filter((b) => !ctx.wallet.badges.includes(b.id) && b.test(ctx));
}

// ---------- evolution ----------

export function evolution(evolveDefs, { limitStreak, goalStreak, missStreak }) {
  const best = Math.max(limitStreak, goalStreak);
  const active = evolveDefs.filter((e) => best >= e.minStreak);
  return {
    evolve: active.filter((e) => e.rows).map((e) => e.id),
    grow: active.reduce((g, e) => g + (e.grow || 0), 0),
    scruffy: missStreak >= 2,
  };
}

// ---------- insights ----------

/** Untracked domains with lots of time on 3 of the last 4 days (plus today). */
export function suggestions(history, day, rules, dismissed = [], minMinutes = 45) {
  const recent = [...history.slice(-4), { domains: day.domains || {} }];
  const totals = {};
  for (const h of recent) {
    for (const [domain, secs] of Object.entries(h.domains || {})) {
      if (secs < minMinutes * 60) continue;
      totals[domain] ||= { days: 0, secs: 0 };
      totals[domain].days++;
      totals[domain].secs += secs;
    }
  }
  return Object.entries(totals)
    .filter(([d, t]) => t.days >= 3 && !dismissed.includes(d) && !matchRule(rules, "https://" + d + "/"))
    .map(([domain, t]) => ({ domain, days: t.days, avgMinutes: Math.round(t.secs / t.days / 60) }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, 3);
}

/** Last 7 days (incl. today) vs the 7 before that. */
export function weeklyReport(history, day, rules, todayKey) {
  const byDate = new Map(history.map((h) => [h.date, h]));
  byDate.set(day.date, { date: day.date, usage: day.usage, results: null });
  const usageOn = (k) => byDate.get(k)?.usage || {};

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(todayKey, -i);
    const usage = usageOn(k);
    days.push({ date: k, total: Object.values(usage).reduce((a, b) => a + b, 0), byRule: usage });
  }

  const sumRule = (id, from, to) => {
    let s = 0;
    for (let i = from; i <= to; i++) s += usageOn(addDays(todayKey, -i))[id] || 0;
    return s;
  };
  const perRule = rules.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    thisWeek: sumRule(r.id, 0, 6),
    lastWeek: sumRule(r.id, 7, 13),
  }));

  let bestDay = null;
  for (let i = 1; i <= 6; i++) {
    const h = byDate.get(addDays(todayKey, -i));
    if (!h?.results) continue;
    const res = Object.values(h.results);
    const score = res.filter((r) => r.ok).length;
    const limitTime = res.filter((r) => r.mode === "limit").reduce((a, r) => a + r.used, 0);
    if (!bestDay || score > bestDay.score || (score === bestDay.score && limitTime < bestDay.limitTime)) {
      bestDay = { date: h.date, score, of: res.length, limitTime };
    }
  }

  const limitIds = rules.filter((r) => r.mode === "limit");
  const savedSecs = limitIds.reduce((a, r) => a + sumRule(r.id, 7, 13) - sumRule(r.id, 0, 6), 0);
  return { days, perRule, bestDay, savedSecs };
}

// ---------- misc ----------

export function fillTemplate(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Fill in fields missing from a stored day (older versions stored fewer). */
export function normalizeDay(day) {
  const d = { ...newDay(day.date), ...day };
  for (const k of ["usage", "domains", "bonus", "snoozes", "notified", "unlockUntil"]) d[k] ||= {};
  d.night ||= 0;
  return d;
}

/** v0.1 day keyed usage/notified by domain; v0.2 keys them by rule id. */
export function migrateDayV1(day, rules) {
  const byDomain = day.usage || {};
  const notifiedByDomain = day.notified || {};
  const usage = {};
  const notified = {};
  for (const r of rules) {
    const domain = r.patterns.find((p) => byDomain[p] != null);
    if (!domain) continue;
    usage[r.id] = byDomain[domain];
    // v0.1 milestone keys were "0.5" / "0.8" / "1" (+ "nagN").
    const prefix = r.mode === "goal" ? "goal" : "limit";
    notified[r.id] = (notifiedByDomain[domain] || []).map((k) =>
      k.startsWith("nag") ? "over" + k.slice(3) : prefix + Math.round(Number(k) * 100)
    );
  }
  return { ...day, usage, notified, domains: { ...byDomain } };
}

/** Old v0.1 storage ({sites, stars}) -> rules + wallet. */
export function migrateV1(sites = [], stars = 0) {
  const rules = sites.map((s) => ({
    id: newId(),
    name: s.domain,
    patterns: [s.domain],
    mode: s.mode,
    minutes: s.minutes,
    weekendMinutes: null,
    block: false,
    hidden: false,
    focus: null,
  }));
  return { rules, wallet: { ...DEFAULT_WALLET, stars, earned: stars } };
}
