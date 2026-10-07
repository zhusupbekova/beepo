// Builds store-ready zips:
//   dist/beepo-chrome.zip   (Chrome + Edge; same MV3 package)
//   dist/beepo-firefox.zip  (Firefox: background.scripts + gecko id)
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const src = new URL("../extension/", import.meta.url).pathname;
const dist = new URL("../dist/", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(src + "manifest.json"));

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const targets = {
  chrome: manifest,
  firefox: {
    ...manifest,
    background: { scripts: ["background.js"], type: "module" },
    browser_specific_settings: { gecko: { id: "beepo@beepo.app", strict_min_version: "121.0" } },
  },
};

for (const [name, m] of Object.entries(targets)) {
  const out = `${dist}${name}/`;
  cpSync(src, out, { recursive: true });
  writeFileSync(out + "manifest.json", JSON.stringify(m, null, 2) + "\n");
  execFileSync("zip", ["-qr", `${dist}beepo-${name}.zip`, "."], { cwd: out });
  console.log(`dist/beepo-${name}.zip`);
}
