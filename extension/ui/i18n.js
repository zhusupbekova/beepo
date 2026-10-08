// Translation helpers for extension pages. Strings come from the `assets` message
// (background picks the language and fills gaps with English).

/** t("key", { var }) → text. Unknown vars stay as `{var}` so callers can split on them. */
export function makeT(i18n) {
  return (key, vars = {}) => (i18n.ui[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** Fills [data-i18n], [data-i18n-title], [data-i18n-placeholder] and sets lang/dir. */
export function localize(i18n, root = document) {
  const t = makeT(i18n);
  document.documentElement.lang = i18n.locale;
  document.documentElement.dir = i18n.dir;
  for (const n of root.querySelectorAll("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  for (const n of root.querySelectorAll("[data-i18n-title]")) n.title = t(n.dataset.i18nTitle);
  for (const n of root.querySelectorAll("[data-i18n-placeholder]")) n.placeholder = t(n.dataset.i18nPlaceholder);
  return t;
}
