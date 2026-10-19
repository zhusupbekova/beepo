// "Beepo on your phone" card for the popup and the options page: QR code + the official
// Google Play badge (Google's artwork, unmodified, at least 28px tall).
import { PLAY_URL } from "./links.js";

function el(tag, attrs, ...kids) {
  const n = Object.assign(document.createElement(tag), attrs);
  n.append(...kids.filter(Boolean));
  return n;
}

/** `onClose` adds a × that dismisses the card; `onOpen` runs when the badge is clicked. */
export function phoneCard(t, lang, { onClose, onOpen } = {}) {
  const link = el("a", { href: PLAY_URL, target: "_blank", className: "playBadge" },
    el("img", { src: `icons/play/${lang}.png`, alt: t("playBadgeAlt") }));
  if (onOpen) link.addEventListener("click", onOpen);
  return el("div", { className: "box phone" },
    el("div", { className: "row" },
      el("h2", { className: "grow", textContent: t("phoneTitle") }),
      onClose && el("button", { className: "icon", title: t("close"), textContent: "×", onclick: onClose })),
    el("div", { className: "row" },
      el("img", { className: "qr", src: "icons/play-qr.svg", alt: "" }),
      el("div", { className: "grow" }, el("div", { textContent: t("phoneText") }), link)),
    el("div", { className: "legal", textContent: t("playLegal") }));
}
