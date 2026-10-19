// Store pages and feedback emails, for whichever browser Beepo is running in.

const REVIEWS = {
  chrome: "https://chromewebstore.google.com/detail/akiejmhndfgcfbgjebcfkbaoeffkhdpj/reviews",
  edge: "https://microsoftedge.microsoft.com/addons/detail/pnnhepbnimbeneejgachdemhcpbelhgn",
  firefox: "https://addons.mozilla.org/firefox/addon/beepo-screen-time-buddy/",
};
const LISTINGS = {
  chrome: "https://chromewebstore.google.com/detail/akiejmhndfgcfbgjebcfkbaoeffkhdpj",
  edge: "https://microsoftedge.microsoft.com/addons/detail/pnnhepbnimbeneejgachdemhcpbelhgn",
  firefox: "https://addons.mozilla.org/firefox/addon/beepo-screen-time-buddy/",
};
// The Android app, from the "Beepo on your phone" card (also encoded in icons/play-qr.svg: `npm run badges`).
export const PLAY_URL =
  "https://play.google.com/store/apps/details?id=studio.panikka.beepo&referrer=utm_source%3Dextension%26utm_campaign%3Dcard&listing=extension";
const EMAIL = "beepo@panikka.studio";
export const DONATE_URL = "https://buymeacoffee.com/zhusupbekovalina";

export function browser() {
  if (location.protocol === "moz-extension:") return "firefox";
  if (navigator.userAgent.includes("Edg/")) return "edge";
  return "chrome";
}

export const reviewUrl = () => REVIEWS[browser()];
/** This browser's store listing, for sharing from the popup. */
export const shareUrl = () => `${LISTINGS[browser()]}?utm_source=share&utm_medium=extension&utm_campaign=report`;

/** mailto: link with the subject filled in and version/browser/language at the bottom. */
export function feedbackUrl(subject, lang) {
  const info = [`Beepo ${chrome.runtime.getManifest().version}`, browser(), navigator.platform, lang].join(" · ");
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n\n—\n${info}`)}`;
}
