// Downloads Google's official "Get it on Google Play" badge for every app language into
// extension/icons/play/<lang>.png and writes a QR code for the same link to extension/icons/play-qr.svg.
// Run after changing PLAY_URL in extension/ui/links.js or adding a language.
import { writeFileSync, mkdirSync } from "node:fs";
import QRCode from "qrcode";
import { LANGUAGES } from "../extension/lib/core.js";
import { PLAY_URL } from "../extension/ui/links.js";

const out = new URL("../extension/icons/", import.meta.url).pathname;
mkdirSync(out + "play", { recursive: true });

// App language → Google's badge code. Google has no Cantonese badge; Hong Kong Chinese is the closest.
const BADGE = { pt_BR: "pt-br", zh_CN: "zh-cn", zh_TW: "zh-tw", yue: "zh-hk", uk: "ua" };

for (const lang of Object.keys(LANGUAGES)) {
  const code = BADGE[lang] || lang;
  const res = await fetch(`https://play.google.com/intl/en_us/badges/static/images/badges/${code}_badge_web_generic.png`);
  if (!res.ok) throw new Error(`${lang} (${code}): HTTP ${res.status}`);
  writeFileSync(`${out}play/${lang}.png`, Buffer.from(await res.arrayBuffer()));
  console.log(`icons/play/${lang}.png`);
}

const svg = await QRCode.toString(PLAY_URL, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1b1b2f", light: "#ffffff" } });
writeFileSync(out + "play-qr.svg", svg);
console.log("icons/play-qr.svg");
