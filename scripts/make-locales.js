// Writes extension/_locales/<lang>/messages.json (store name + short description)
// from store/<lang>.json. Chrome only accepts its own locale list, so app-only
// languages (like Cantonese) are skipped here; they still work inside Beepo.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url).pathname;
const CHROME_LOCALES = new Set("ar am bg bn ca cs da de el en en_AU en_GB en_US es es_419 et fa fi fil fr gu he hi hr hu id it ja kn ko lt lv ml mr ms nl no pl pt_BR pt_PT ro ru sk sl sr sv sw ta te th tr uk vi zh_CN zh_TW".split(" "));

rmSync(root + "extension/_locales", { recursive: true, force: true });
for (const f of readdirSync(root + "store").filter((f) => f.endsWith(".json"))) {
  const lang = f.replace(".json", "");
  if (!CHROME_LOCALES.has(lang)) continue;
  const s = JSON.parse(readFileSync(root + "store/" + f, "utf8"));
  const dir = `${root}extension/_locales/${lang}`;
  mkdirSync(dir, { recursive: true });
  const messages = {
    extName: { message: s.name },
    extDesc: { message: s.short },
  };
  writeFileSync(dir + "/messages.json", JSON.stringify(messages, null, 2) + "\n");
  console.log(`_locales/${lang}`);
}
