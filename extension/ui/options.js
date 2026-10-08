import { DEFAULT_SETTINGS, LANGUAGES } from "../lib/core.js";
import { localize } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const form = $("settings");
const send = (msg) => chrome.runtime.sendMessage(msg);
const assets = await send({ type: "assets" });
const t = localize(assets.i18n);

for (const [code, name] of Object.entries(LANGUAGES)) form.elements.lang.append(new Option(name, code));

for (let h = 0; h < 12; h++) {
  form.resetHour.append(new Option(`${String(h).padStart(2, "0")}:00`, h));
}

async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get("settings")).settings };
}

async function fill() {
  const s = await getSettings();
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") el.checked = !!s[el.name];
    else el.value = s[el.name];
  }
}

let flashTimer;
function flash(msg) {
  $("saved").textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => ($("saved").textContent = ""), 1500);
}

form.addEventListener("change", async () => {
  const s = await getSettings();
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") s[el.name] = el.checked;
    else if (el.type === "number" || el.name === "scale" || el.name === "resetHour") s[el.name] = Number(el.value);
    else s[el.name] = el.value;
  }
  s.idleSeconds = Math.max(15, s.idleSeconds || 60);
  const langChanged = s.lang !== (await getSettings()).lang;
  await chrome.storage.sync.set({ settings: s });
  if (langChanged) return location.reload();
  flash(t("savedTick"));
});

$("export").addEventListener("click", async () => {
  const data = await send({ type: "exportData" });
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `beepo-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(url);
});

$("import").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return flash(t("badJson"));
  }
  if (!confirm(t("confirmImport"))) return;
  const res = await send({ type: "importData", data });
  flash(res?.ok ? t("imported") : t("notExport"));
  fill();
});

BeepoSprite.draw($("beepo"), assets, { mood: "happy", scale: 3 });
fill();
