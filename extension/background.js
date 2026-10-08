// Service worker: the single owner of usage, history and the wallet (stars, cosmetics,
// badges). Every read-modify-write goes through `serial()` so tabs never race.
//
// storage.sync:  rules, settings, wallet   (follow you across Chrome profiles)
// storage.local: day, history, custom, pending  (per device)

import * as core from "./lib/core.js";

let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

const getJSON = (path) => fetch(chrome.runtime.getURL(path)).then((r) => r.json());

let assetsPromise = null;
function loadAssets() {
  assetsPromise ||= getJSON("data/sprites.json").then((sprites) => ({ sprites }));
  return assetsPromise;
}

// Strings for one language, with English filling any gaps (per key, per message pool).
const i18nCache = {};
function loadI18n(lang) {
  i18nCache[lang] ||= Promise.all([getJSON("data/i18n/en.json"), lang === "en" ? null : getJSON(`data/i18n/${lang}.json`).catch(() => null)]).then(
    ([en, t]) => {
      if (!t) return { lang: "en", ...en };
      const merged = { lang, name: t.name, locale: t.locale, dir: t.dir };
      for (const k of ["ui", "badges", "items", "evolve", "messages"]) merged[k] = { ...en[k], ...t[k] };
      return merged;
    }
  );
  return i18nCache[lang];
}

async function currentI18n() {
  const { settings } = await chrome.storage.sync.get("settings");
  return loadI18n(core.resolveLang(settings?.lang, chrome.i18n.getUILanguage()));
}

// ---------- state ----------

async function loadState() {
  const [sync, local] = await Promise.all([
    chrome.storage.sync.get(["rules", "settings", "wallet"]),
    chrome.storage.local.get(["day", "history", "custom", "pending", "sites", "stars"]),
  ]);

  let { rules, wallet } = sync;
  if (!rules && local.sites) {
    // v0.1 -> v0.2 migration
    ({ rules, wallet } = core.migrateV1(local.sites, local.stars));
    await chrome.storage.sync.set({ rules, wallet });
    await chrome.storage.local.remove(["sites", "stars"]);
  }
  let day = local.day;
  if (day && !day.bonus) {
    // v0.1 day shape (usage keyed by domain)
    day = core.normalizeDay(core.migrateDayV1(day, rules || []));
    await chrome.storage.local.set({ day });
  }

  const st = {
    rules: rules || [],
    settings: { ...core.DEFAULT_SETTINGS, ...sync.settings },
    wallet: { ...core.DEFAULT_WALLET, ...wallet, equipped: { ...core.DEFAULT_WALLET.equipped, ...wallet?.equipped } },
    day,
    history: local.history || [],
    custom: local.custom || [],
    pending: local.pending || [],
  };
  st.today = core.dateKey(Date.now(), st.settings.resetHour);
  if (!st.day || st.day.date !== st.today) await rollover(st);
  return st;
}

const saveWallet = (st) => chrome.storage.sync.set({ wallet: st.wallet });
const saveDay = (st) => chrome.storage.local.set({ day: st.day });
const savePending = (st) => chrome.storage.local.set({ pending: st.pending });

function award(st, n) {
  st.wallet.stars += n;
  st.wallet.earned += n;
}

async function rollover(st) {
  if (st.day) {
    const { sprites } = await loadAssets();
    const before = core.evolution(sprites.evolve, core.streaks(st.history, st.day.date));
    const entry = core.finalizeDay(st.day, st.rules);
    st.history = [...st.history.filter((h) => h.date !== entry.date), entry].slice(-core.HISTORY_DAYS);

    const kept = Object.values(entry.results).filter((r) => r.mode === "limit" && r.ok).length;
    if (kept) {
      award(st, kept);
      st.pending.push({ key: "kept", vars: { n: kept } });
    }
    const s = core.streaks(st.history, st.today);
    const best = Math.max(s.limitStreak, s.goalStreak);
    if (best >= 2) st.pending.push({ key: "streak", vars: { n: best } });

    const after = core.evolution(sprites.evolve, s);
    for (const e of sprites.evolve) {
      const was = e.grow ? before.grow : before.evolve.includes(e.id);
      const is = e.grow ? after.grow : after.evolve.includes(e.id);
      if (is && !was) st.pending.push({ key: "evolve", vars: { id: e.id, name: e.name } });
    }
    checkBadges(st, s);
  }
  st.day = core.newDay(st.today);
  st.pending = st.pending.slice(-5);
  await chrome.storage.local.set({ day: st.day, history: st.history, pending: st.pending });
  await saveWallet(st);
}

function checkBadges(st, s = core.streaks(st.history, st.today)) {
  for (let found = true; found; ) {
    // Loop: a badge reward can itself unlock "first_star".
    const fresh = core.newBadges({ wallet: st.wallet, history: st.history, today: st.today, ...s });
    found = fresh.length > 0;
    for (const b of fresh) {
      st.wallet.badges.push(b.id);
      award(st, core.BADGE_REWARD);
      st.pending.push({ key: "badge", vars: { id: b.id, name: b.name } });
      st.pendingDirty = true;
    }
  }
}

// ---------- views ----------

async function lookFor(st) {
  const { sprites } = await loadAssets();
  const s = core.streaks(st.history, st.today);
  return { equipped: st.wallet.equipped, ...core.evolution(sprites.evolve, s), ...s };
}

/** Everything a content script needs to render Beepo for `href`. */
async function view(st, href, events = []) {
  const rule = core.matchRule(st.rules, href);
  const now = Date.now();
  // Queued news (stars, badges, streaks) is only handed to a tab that actually shows Beepo.
  const visible = rule ? !rule.hidden : st.settings.everywhere;
  const v = {
    settings: st.settings,
    stars: st.wallet.stars,
    look: await lookFor(st),
    night: core.isNight(now),
    events: visible ? [...st.pending, ...events] : events,
    rule: null,
  };
  if (visible && st.pending.length) {
    st.pending = [];
    st.pendingDirty = true;
  }
  if (st.pendingDirty) await savePending(st);
  if (!rule) return v;

  const base = core.baseLimitSecs(rule, st.today);
  const bonus = st.day.bonus[rule.id] || 0;
  const used = st.day.usage[rule.id] || 0;
  const unlockUntil = st.day.unlockUntil[rule.id] || 0;
  return {
    ...v,
    rule: { id: rule.id, name: rule.name, mode: rule.mode, hidden: rule.hidden, block: rule.block, focus: rule.focus },
    used,
    base,
    limit: base + bonus,
    snoozes: st.day.snoozes[rule.id] || 0,
    state: core.blockState({ rule, used, base, bonus, now, unlockUntil }),
    unlockLeft: Math.max(0, unlockUntil - now),
  };
}

// ---------- handlers ----------

async function isIdle(st, media) {
  if (media) return false;
  try {
    return (await chrome.idle.queryState(Math.max(15, st.settings.idleSeconds))) !== "active";
  } catch {
    return false;
  }
}

// Only one tab counts at a time: the active tab of the last-focused window. Otherwise two
// visible windows (side by side, or one behind another) would both add time.
async function isCounting(tab) {
  if (!tab?.active) return false;
  try {
    return (await chrome.windows.getLastFocused()).id === tab.windowId;
  } catch {
    return true;
  }
}

async function tick(href, seconds, media, tab) {
  const st = await loadState();
  const host = core.hostOf(href);
  if (!host || !(await isCounting(tab)) || (await isIdle(st, media))) return view(st, href);

  const now = Date.now();
  const rule = core.matchRule(st.rules, href);
  const events = [];

  if (rule) {
    const base = core.baseLimitSecs(rule, st.today);
    const bonus = st.day.bonus[rule.id] || 0;
    const unlockUntil = st.day.unlockUntil[rule.id] || 0;
    const blocked = core.blockState({ rule, used: st.day.usage[rule.id] || 0, base, bonus, now, unlockUntil }) !== "ok";
    if (blocked) return view(st, href);

    const used = (st.day.usage[rule.id] || 0) + seconds;
    st.day.usage[rule.id] = used;
    const notified = (st.day.notified[rule.id] ||= []);
    const key = core.milestone({ mode: rule.mode, used, base, bonus, notified, nagMinutes: st.settings.nagMinutes });
    if (key) {
      const vars = { m: Math.round(base / 60), name: rule.name };
      events.push({ key, vars });
      if (key === "goal100") {
        award(st, 1);
        st.wallet.goalsMet++;
        checkBadges(st);
        await saveWallet(st);
      }
    }
    if (core.isNight(now)) {
      st.day.night += seconds;
      const g = (st.day.notified._global ||= []);
      if (!g.includes("night")) {
        g.push("night");
        events.push({ key: "night" });
      }
    }
  }
  st.day.domains[host] = (st.day.domains[host] || 0) + seconds;
  await saveDay(st);
  return view(st, href, events);
}

async function snooze(href, ruleId) {
  const st = await loadState();
  const n = (st.day.snoozes[ruleId] || 0) + 1;
  st.day.snoozes[ruleId] = n;
  st.day.bonus[ruleId] = (st.day.bonus[ruleId] || 0) + core.SNOOZE_SECS;
  await saveDay(st);
  return view(st, href, [{ key: n === 1 ? "snooze1" : n === 2 ? "snooze2" : "snooze3", vars: { n } }]);
}

async function unlock(href, ruleId) {
  const st = await loadState();
  if (st.wallet.stars < core.UNLOCK_COST) return view(st, href);
  st.wallet.stars -= core.UNLOCK_COST;
  st.day.unlockUntil[ruleId] = Date.now() + core.UNLOCK_SECS * 1000;
  st.day.snoozes[ruleId] = (st.day.snoozes[ruleId] || 0) + 1;
  await Promise.all([saveDay(st), saveWallet(st)]);
  return view(st, href, [{ key: "unlock" }]);
}

async function popupState() {
  const st = await loadState();
  const s = core.streaks(st.history, st.today);
  const today = Object.fromEntries(
    st.rules.map((r) => [
      r.id,
      { used: st.day.usage[r.id] || 0, base: core.baseLimitSecs(r, st.today), bonus: st.day.bonus[r.id] || 0 },
    ])
  );
  return {
    rules: st.rules,
    settings: st.settings,
    wallet: st.wallet,
    custom: st.custom,
    today,
    streaks: s,
    look: await lookFor(st),
    suggestions: core.suggestions(st.history, st.day, st.rules, st.settings.dismissed),
    report: core.weeklyReport(st.history, st.day, st.rules, st.today),
    badges: core.BADGES.map(({ id, name, desc }) => ({ id, name, desc, earned: st.wallet.badges.includes(id) })),
  };
}

async function buy(itemId) {
  const st = await loadState();
  const { sprites } = await loadAssets();
  const item = sprites.items[itemId];
  if (!item || st.wallet.owned.includes(itemId)) return { ok: false };
  if (st.wallet.stars < item.price) return { ok: false, reason: "stars" };
  st.wallet.stars -= item.price;
  st.wallet.owned.push(itemId);
  st.wallet.equipped[item.slot] = itemId;
  checkBadges(st);
  await Promise.all([saveWallet(st), st.pendingDirty && savePending(st)]);
  return { ok: true };
}

async function equip(slot, itemId) {
  const st = await loadState();
  const owned = !itemId || st.wallet.owned.includes(itemId) || st.custom.some((c) => c.id === itemId);
  if (!owned) return { ok: false };
  st.wallet.equipped[slot] = itemId || (slot === "color" ? "color-blue" : null);
  await saveWallet(st);
  return { ok: true };
}

async function saveCustom(item) {
  const st = await loadState();
  const custom = st.custom.filter((c) => c.id !== item.id);
  const id = item.id || "custom-" + core.newId();
  custom.push({ id, slot: item.slot, name: item.name, rows: item.rows, custom: true });
  await chrome.storage.local.set({ custom });
  return { ok: true, id };
}

async function deleteCustom(id) {
  const st = await loadState();
  await chrome.storage.local.set({ custom: st.custom.filter((c) => c.id !== id) });
  for (const [slot, eq] of Object.entries(st.wallet.equipped)) if (eq === id) st.wallet.equipped[slot] = null;
  await saveWallet(st);
  return { ok: true };
}

async function exportData() {
  const [sync, local] = await Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]);
  return { app: "beepo", version: 2, exportedAt: new Date().toISOString(), sync, local };
}

async function importData(data) {
  if (data?.app !== "beepo" || !data.sync || !data.local) return { ok: false };
  await Promise.all([chrome.storage.sync.clear(), chrome.storage.local.clear()]);
  await Promise.all([chrome.storage.sync.set(data.sync), chrome.storage.local.set(data.local)]);
  return { ok: true };
}

const handlers = {
  assets: async () => {
    const [{ sprites }, i18n, { custom }] = await Promise.all([loadAssets(), currentI18n(), chrome.storage.local.get("custom")]);
    return { sprites, i18n, messages: i18n.messages, custom: custom || [] };
  },
  status: (m) => loadState().then((st) => view(st, m.href)),
  tick: (m, sender) => tick(m.href, m.seconds, m.media, sender.tab),
  snooze: (m) => snooze(m.href, m.ruleId),
  unlock: (m) => unlock(m.href, m.ruleId),
  closeTab: (_m, sender) => chrome.tabs.remove(sender.tab.id),
  popupState,
  buy: (m) => buy(m.itemId),
  equip: (m) => equip(m.slot, m.itemId),
  saveCustom: (m) => saveCustom(m.item),
  deleteCustom: (m) => deleteCustom(m.id),
  exportData,
  importData: (m) => importData(m.data),
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  serial(() => h(msg, sender))
    .then(reply)
    .catch((e) => {
      console.error("beepo:", msg.type, e);
      reply(null);
    });
  return true; // async reply
});

// Chrome only injects content scripts into pages loaded after install/update, so tabs
// that were already open would show no Beepo (or a dead one) and count nothing.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install" && reason !== "update") return;
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"], discarded: false });
  for (const t of tabs) {
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["render/sprite.js", "content.js"] }).catch(() => {});
  }
});
