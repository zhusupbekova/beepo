import { normalizePattern, newId, hostOf } from "../lib/core.js";
import { localize } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
let t = (k) => k;
const fmtMin = (secs) => {
  const m = Math.round(secs / 60);
  return m >= 60 ? t("hm", { h: Math.floor(m / 60), m: m % 60 }) : t("m", { m });
};

/** Tiny DOM builder: el("div", { class: "x", onclick }, child, "text") */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.flat().filter((k) => k != null && k !== false));
  return n;
}

let assets;
let st; // popupState from background
let currentHost = null;
let tab = "today";
let previewItem = null;

async function load() {
  [assets, st] = await Promise.all([send({ type: "assets" }), send({ type: "popupState" })]);
  if (!assets || !st) {
    document.body.replaceChildren(
      el("div", { class: "box empty" }, "Beepo tripped over a wire. Try reloading the extension — details are in the service worker console.")
    );
    return;
  }
  t = localize(assets.i18n);
  render();
}

function render() {
  $("stars").textContent = `⭐ ${st.wallet.stars}`;
  const { limitStreak, goalStreak, missStreak } = st.streaks;
  $("streak").textContent =
    missStreak >= 2
      ? t("streakRough", { n: missStreak })
      : t("streakLine", { limit: limitStreak, goal: goalStreak });
  BeepoSprite.draw($("beepo"), assets, { mood: missStreak >= 2 ? "sad" : "happy", look: st.look, scale: 2 });

  for (const b of document.querySelectorAll("nav button")) b.classList.toggle("on", b.dataset.tab === tab);
  for (const name of ["today", "report", "shop", "badges"]) $("tab-" + name).hidden = name !== tab;
  ({ today: renderToday, report: renderReport, shop: renderShop, badges: renderBadges })[tab]();
}

// ---------- today ----------

/** Splits `text` at `marker` and puts `bold` there in a <b>. */
function withBold(text, marker, bold) {
  const [a, b = ""] = text.split(marker);
  return [a, el("b", {}, bold), b];
}

async function saveRules(rules) {
  await chrome.storage.sync.set({ rules });
  st = await send({ type: "popupState" });
  render();
}

function renderToday() {
  // Quick add
  const existing = currentHost && st.rules.find((r) => r.patterns.includes(currentHost));
  $("quick").querySelector(".row").hidden = !currentHost || !!existing;
  $("quickDomain").textContent = currentHost || "";

  // Suggestions
  $("suggestions").replaceChildren(
    ...st.suggestions.map((s) =>
      el(
        "div",
        { class: "box suggest" },
        el("div", {}, ...withBold(t("suggest", { n: s.avgMinutes }), "{domain}", s.domain)),
        el(
          "div",
          { class: "row", style: "margin-top:6px" },
          el("button", { onclick: () => addQuick(s.domain, 30) }, t("suggestAdd")),
          el("button", { class: "ghost", onclick: () => dismiss(s.domain) }, t("suggestNo"))
        )
      )
    )
  );

  // Rules
  const list = $("list");
  if (!st.rules.length) {
    list.replaceChildren(el("div", { class: "empty" }, t("noRulesYet")));
    return;
  }
  list.replaceChildren(
    ...st.rules.map((r) => {
      const u = st.today[r.id] || { used: 0, base: r.minutes * 60, bonus: 0 };
      const ratio = u.used / Math.max(1, u.base);
      const total = u.base + u.bonus;
      const flags = [
        r.block && t("flagBlock"),
        r.hidden && t("flagHidden"),
        r.focus && `🎯 ${r.focus.start}–${r.focus.end}`,
        r.weekendMinutes != null && t("flagWeekend", { m: r.weekendMinutes }),
      ].filter(Boolean);
      return el(
        "div",
        { class: "rule" },
        el(
          "div",
          { class: "row" },
          el("span", { class: "name grow", title: r.patterns.join(", ") }, r.name),
          el("span", { class: "tag" }, t("mode_" + r.mode)),
          el("span", {}, `${fmtMin(u.used)}/${fmtMin(u.base)}`),
          el("button", { class: "icon", title: t("edit"), onclick: () => openEditor(r) }, "✎"),
          el("button", { class: "icon", title: t("remove"), onclick: () => removeRule(r.id) }, "×")
        ),
        !!(r.patterns.length > 1 || r.patterns[0] !== r.name || flags.length) &&
          el("div", { class: "sub" }, [r.patterns.join(", "), ...flags].join(" · ")),
        el(
          "div",
          { class: `bar ${r.mode} ${r.mode === "limit" && ratio > 1 ? "over" : ""}` },
          el("div", { style: `width:${Math.min(100, ratio * 100)}%` }),
          u.bonus > 0 && el("span", { class: "bonus", style: `left:${(u.base / total) * 100}%;right:0`, title: t("snoozedTime") })
        )
      );
    })
  );
}

async function addQuick(pattern, minutes) {
  const rules = st.rules.filter((r) => !(r.patterns.length === 1 && r.patterns[0] === pattern));
  rules.push({ id: newId(), name: pattern, patterns: [pattern], mode: "limit", minutes, weekendMinutes: null, block: false, hidden: false, focus: null });
  await saveRules(rules);
}

async function removeRule(id) {
  await saveRules(st.rules.filter((r) => r.id !== id));
}

async function dismiss(domain) {
  const settings = { ...st.settings, dismissed: [...st.settings.dismissed, domain] };
  await chrome.storage.sync.set({ settings });
  st = await send({ type: "popupState" });
  render();
}

function openEditor(rule) {
  const r = rule || { id: null, name: "", patterns: currentHost ? [currentHost] : [], mode: "limit", minutes: 30, weekendMinutes: null, block: false, hidden: false, focus: null };
  const f = $("editor");
  f.hidden = false;
  f.replaceChildren(
    el("h2", { class: "full" }, t(rule ? "editRule" : "newRule")),
    el("label", { class: "field full" }, t("fieldSites"),
      el("textarea", { name: "patterns", rows: 2, required: true }, r.patterns.join("\n"))),
    el("label", { class: "field" }, t("fieldName"), el("input", { name: "name", value: r.name, placeholder: t("namePlaceholder") })),
    el("label", { class: "field" }, t("fieldType"),
      el("select", { name: "mode" },
        el("option", { value: "limit", selected: r.mode === "limit" }, t("typeLimit")),
        el("option", { value: "goal", selected: r.mode === "goal" }, t("typeGoal")))),
    el("label", { class: "field" }, t("fieldMinutes"), el("input", { name: "minutes", type: "number", min: 1, value: r.minutes, required: true })),
    el("label", { class: "field" }, t("fieldWeekend"), el("input", { name: "weekendMinutes", type: "number", min: 0, value: r.weekendMinutes ?? "", placeholder: t("weekendPlaceholder") })),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "block", checked: r.block }), t("blockWhenOver")),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "hidden", checked: r.hidden }), t("hideHere")),
    el("fieldset", {},
      el("legend", {}, t("focusLegend")),
      el("input", { type: "time", name: "focusStart", value: r.focus?.start || "" }),
      "–",
      el("input", { type: "time", name: "focusEnd", value: r.focus?.end || "" }),
      el("label", { class: "check" }, el("input", { type: "checkbox", name: "weekdaysOnly", checked: r.focus?.weekdaysOnly ?? true }), t("weekdays"))),
    el("div", { class: "row full" },
      el("button", { type: "submit" }, t("save")),
      el("button", { type: "button", class: "ghost", onclick: () => (f.hidden = true) }, t("cancel")),
      el("span", { class: "muted grow", id: "editorError" }))
  );
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const patterns = [...new Set(String(d.get("patterns")).split(/[\n,]+/).map(normalizePattern).filter(Boolean))];
    if (!patterns.length) return ($("editorError").textContent = t("errSites"));
    const wk = String(d.get("weekendMinutes")).trim();
    const start = d.get("focusStart");
    const end = d.get("focusEnd");
    const next = {
      id: r.id || newId(),
      name: String(d.get("name")).trim() || (patterns.length > 1 ? patterns.map((p) => p.split(".")[0]).join(" + ") : patterns[0]),
      patterns,
      mode: d.get("mode"),
      minutes: Math.max(1, parseInt(d.get("minutes"), 10) || 30),
      weekendMinutes: wk === "" ? null : Math.max(0, parseInt(wk, 10) || 0),
      block: d.has("block"),
      hidden: d.has("hidden"),
      focus: start && end ? { start, end, weekdaysOnly: d.has("weekdaysOnly") } : null,
    };
    f.hidden = true;
    await saveRules(r.id ? st.rules.map((x) => (x.id === r.id ? next : x)) : [...st.rules, next]);
  };
  f.scrollIntoView({ behavior: "smooth" });
}

// ---------- report ----------

function renderReport() {
  const { days, perRule, bestDay, savedSecs } = st.report;
  const max = Math.max(60, ...days.map((d) => d.total));
  const weekTotal = days.reduce((a, d) => a + d.total, 0);
  const dayName = (k) => new Date(k + "T12:00").toLocaleDateString(assets.i18n.locale, { weekday: "short" });

  $("tab-report").replaceChildren(
    el("div", { class: "stat", style: "margin-bottom:10px" },
      el("div", {}, el("span", { class: "muted" }, t("thisWeek")), el("b", {}, fmtMin(weekTotal)), el("span", { class: "muted" }, t("onTracked"))),
      el("div", {}, el("span", { class: "muted" }, t(savedSecs >= 0 ? "saved" : "extra")), el("b", {}, fmtMin(Math.abs(savedSecs))), el("span", { class: "muted" }, t("vsLastWeek"))),
      el("div", {}, el("span", { class: "muted" }, t("bestDay")), el("b", {}, bestDay ? dayName(bestDay.date) : "–"),
        el("span", { class: "muted" }, bestDay ? t("rulesKept", { score: bestDay.score, of: bestDay.of }) : t("notEnough")))),
    el("div", { class: "box" },
      el("h2", {}, t("perDay")),
      el("div", { class: "chart", role: "img", "aria-label": t("perDayAria") },
        days.map((d, i) =>
          el("div", { class: `col ${i === days.length - 1 ? "today" : ""}` },
            el("span", { class: "tip" }, `${dayName(d.date)}: ${fmtMin(d.total)}`),
            el("div", { class: "b", style: `height:${(d.total / max) * 100}%` })))),
      el("div", { class: "days" }, days.map((d, i) => el("span", {}, i === days.length - 1 ? t("today") : dayName(d.date))))),
    el("div", { class: "box" },
      el("h2", {}, t("perRule")),
      perRule.length
        ? el("table", {},
            el("tr", {}, el("th", {}, t("colRule")), el("th", { class: "num" }, t("colThisWk")), el("th", { class: "num" }, t("colLastWk")), el("th", { class: "num" }, "Δ")),
            perRule.map((r) => {
              const delta = r.thisWeek - r.lastWeek;
              const good = r.mode === "limit" ? delta <= 0 : delta >= 0;
              return el("tr", {},
                el("td", {}, r.name),
                el("td", { class: "num" }, fmtMin(r.thisWeek)),
                el("td", { class: "num" }, fmtMin(r.lastWeek)),
                el("td", { class: "num" }, `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${fmtMin(Math.abs(delta))} ${delta === 0 ? "" : good ? "👍" : "👀"}`));
            }))
        : el("div", { class: "empty" }, t("noRules")))
  );
}

// ---------- shop ----------

const SLOTS = ["color", "hat", "antenna", "accessory", "pet"];

function lookWith(itemId) {
  if (!itemId) return st.look;
  const item = BeepoSprite.findItem(assets, itemId);
  const equipped = { ...st.look.equipped, [item.slot]: itemId };
  if (item.slot === "antenna") equipped.hat = null; // hats cover the antenna
  return { ...st.look, equipped };
}

function itemCanvas(id, item) {
  const c = el("canvas");
  if (item.slot === "pet") BeepoSprite.drawPet(c, assets, id, 0, 3);
  else BeepoSprite.draw(c, assets, { mood: "happy", look: lookWith(id), scale: 2 });
  return c;
}

function renderPreview() {
  const box = $("shopPreview");
  if (!box) return;
  const look = lookWith(previewItem);
  const beepo = el("canvas");
  BeepoSprite.draw(beepo, assets, { mood: previewItem ? "proud" : "happy", look, scale: 4 });
  const pet = el("canvas");
  const hasPet = BeepoSprite.drawPet(pet, assets, look.equipped.pet, 0, 3, true);
  box.replaceChildren(...(hasPet ? [pet, beepo] : [beepo]));
  pet.style.alignSelf = "flex-end";
}

async function shopAction(fn) {
  await fn();
  st = await send({ type: "popupState" });
  render();
}

function renderShop() {
  const w = st.wallet;
  const all = { ...assets.sprites.items };
  for (const c of st.custom) all[c.id] = c;

  $("tab-shop").replaceChildren(
    el("div", { class: "preview", id: "shopPreview" }),
    ...SLOTS.map((slot) => {
      const items = Object.entries(all).filter(([id, it]) => it.slot === slot && (!it.season || w.seen.includes(id)));
      if (!items.length) return null;
      return el("div", { class: "box" },
        el("h2", {}, t("slot_" + slot)),
        el("div", { class: "shopGrid" },
          items.map(([id, it]) => {
            const owned = it.custom || w.owned.includes(id);
            const on = w.equipped[slot] === id;
            let btn;
            if (on) btn = slot === "color" ? el("button", { disabled: true }, t("wearing")) : el("button", { class: "ghost", onclick: () => shopAction(() => send({ type: "equip", slot, itemId: null })) }, t("takeOff"));
            else if (owned) btn = el("button", { onclick: () => shopAction(() => send({ type: "equip", slot, itemId: id })) }, t("wear"));
            else btn = el("button", { disabled: w.stars < it.price, onclick: () => shopAction(() => send({ type: "buy", itemId: id })) }, `⭐ ${it.price}`);
            return el("div", {
                class: `item ${on ? "on" : ""}`,
                onmouseenter: () => ((previewItem = id), renderPreview()),
                onmouseleave: () => ((previewItem = null), renderPreview()),
              },
              itemCanvas(id, it),
              el("span", { class: "nm" }, it.custom ? `${it.name} ✏` : assets.i18n.items[id] ?? it.name),
              btn);
          })));
    }),
    el("div", { class: "row" },
      el("a", { href: chrome.runtime.getURL("editor.html"), target: "_blank" }, t("drawOwn")),
    )
  );
  renderPreview();
}

// ---------- badges ----------

function renderBadges() {
  const s = st.streaks;
  const best = Math.max(s.limitStreak, s.goalStreak);
  $("tab-badges").replaceChildren(
    el("div", { class: "badges" },
      st.badges.map((b) => el("div", { class: `badge ${b.earned ? "" : "locked"}` }, el("b", {}, (b.earned ? "🏅 " : "🔒 ") + (assets.i18n.badges[b.id]?.name ?? b.name)), el("span", { class: "muted" }, assets.i18n.badges[b.id]?.desc ?? b.desc)))),
    el("div", { class: "box evo" },
      el("h2", {}, t("evoTitle")),
      el("div", { class: "muted" }, t("evoIntro", { n: best })),
      assets.sprites.evolve.map((e) => el("div", {}, best >= e.minStreak ? "✅ " : "⬜ ", t("evoStep", { name: assets.i18n.evolve[e.id] ?? e.name, n: e.minStreak }))),
      el("div", {}, s.missStreak >= 2 ? "😿 " : "⬜ ", t("scruffy")))
  );
}

// ---------- wiring ----------

for (const b of document.querySelectorAll("nav button")) {
  b.addEventListener("click", () => {
    tab = b.dataset.tab;
    render();
  });
}
for (const b of document.querySelectorAll("#quick button[data-min]")) {
  b.addEventListener("click", () => addQuick(currentHost, Number(b.dataset.min)));
}
$("customBtn").addEventListener("click", () => openEditor(null));
$("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

chrome.tabs.query({ active: true, currentWindow: true }, ([t]) => {
  if (t?.url?.startsWith("http")) currentHost = hostOf(t.url);
  load();
});
