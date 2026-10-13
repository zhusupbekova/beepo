// Store review page and feedback emails, for whichever browser Beepo is running in.

const STORES = {
  chrome: "https://chromewebstore.google.com/detail/akiejmhndfgcfbgjebcfkbaoeffkhdpj/reviews",
  edge: "https://microsoftedge.microsoft.com/addons/detail/pnnhepbnimbeneejgachdemhcpbelhgn",
  firefox: "https://addons.mozilla.org/firefox/addon/beepo-screen-time-buddy/",
};
const EMAIL = "beepo@panikka.studio";
export const DONATE_URL = "https://buymeacoffee.com/zhusupbekovalina";

export function browser() {
  if (location.protocol === "moz-extension:") return "firefox";
  if (navigator.userAgent.includes("Edg/")) return "edge";
  return "chrome";
}

export const reviewUrl = () => STORES[browser()];

/** mailto: link with the subject filled in and version/browser/language at the bottom. */
export function feedbackUrl(subject, lang) {
  const info = [`Beepo ${chrome.runtime.getManifest().version}`, browser(), navigator.platform, lang].join(" · ");
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n\n—\n${info}`)}`;
}
