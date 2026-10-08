import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { LANGUAGES } from "../extension/lib/core.js";

const root = new URL("../", import.meta.url).pathname;
const load = (p) => JSON.parse(readFileSync(root + p, "utf8"));
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** Flattens to { "ui.key": "text", "messages.greetMorning.lines.0": "...", ... } */
function flat(o, pre = "", out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object") flat(v, `${pre}${k}.`, out);
    else out[pre + k] = v;
  }
  return out;
}

const en = flat(load("extension/data/i18n/en.json"));
const enStore = flat(load("store/en.json"));

test("every language has an app and a store file", () => {
  const app = readdirSync(root + "extension/data/i18n").map((f) => f.replace(".json", "")).sort();
  const store = readdirSync(root + "store").filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();
  assert.deepEqual(app, Object.keys(LANGUAGES).sort());
  assert.deepEqual(store, Object.keys(LANGUAGES).sort());
});

for (const lang of Object.keys(LANGUAGES)) {
  test(`${lang}: same keys and placeholders as English`, () => {
    const t = flat(load(`extension/data/i18n/${lang}.json`));
    // Message pools may have a different number of lines; everything else must match.
    const shape = (o) => Object.keys(o).filter((k) => !/^messages\.\w+\.lines\./.test(k)).sort();
    assert.deepEqual(shape(t), shape(en));
    for (const [k, v] of Object.entries(t)) {
      assert.ok(typeof v !== "string" || v.trim(), `${k} is empty`);
      if (/^messages\.(\w+)\.lines\./.test(k)) {
        const pool = k.split(".")[1];
        const allowed = new Set(Object.entries(en).filter(([ek]) => ek.startsWith(`messages.${pool}.lines.`)).flatMap(([, ev]) => vars(ev).split(",")));
        for (const name of vars(v).split(",").filter(Boolean)) assert.ok(allowed.has(name), `${k}: unknown {${name}}`);
      } else if (k.endsWith(".mood")) {
        assert.equal(v, en[k], `${k}: moods are sprite names, keep them in English`);
      } else {
        assert.equal(vars(v), vars(en[k]), `${k}: placeholders differ`);
      }
    }
  });

  test(`${lang}: store listing fits the stores' limits`, () => {
    const s = flat(load(`store/${lang}.json`));
    assert.deepEqual(Object.keys(s).sort(), Object.keys(enStore).sort());
    assert.ok([...s.name].length <= 75, `name is ${[...s.name].length} chars`);
    assert.ok([...s.short].length <= 132, `short is ${[...s.short].length} chars`);
    assert.ok(s.name.includes("Beepo"));
  });
}
