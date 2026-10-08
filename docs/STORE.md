# Store release (Chrome Web Store / Edge Add-ons / Firefox AMO)

Publishing itself is manual (needs the developer accounts).

## Checklist

1. Bump `version` in `extension/manifest.json`.
2. `npm test && npm run check`
3. `npm run icons` (if the sprite changed), `npm run locales` (if `store/*.json` changed)
4. `npm run build` → `dist/beepo-chrome.zip` (Chrome + Edge), `dist/beepo-firefox.zip` (AMO)
5. `npm run store` → `dist/store/` (screenshots, tiles, listing text for every language)
6. Privacy policy URL (all three stores): https://panikka.studio/apps/privacy-policy — keep it in sync with `docs/PRIVACY.md`. Support email: beepo@panikka.studio

## What's in dist/store/

| File | Size | Used by |
|---|---|---|
| `icon-128.png` | 128×128 | Chrome store icon |
| `logo-300.png` | 300×300 | Edge extension logo |
| `<lang>/1-page.png` … `6-report.png` | 1280×800 | Screenshots (all stores) |
| `<lang>/promo-440x280.png` | 440×280 | Chrome small promo tile (required), Edge small promo tile |
| `<lang>/marquee-1400x560.png` | 1400×560 | Chrome marquee, Edge large promo tile (both optional) |
| `<lang>/listing.txt` | | Name, short description / summary, full description |

Chrome takes at most 5 screenshots: use 1, 2, 4, 5, 6 (skip `3-block`). Edge and AMO take all 6.

## Languages

Default listing language is English. Add each translation in the store's listing-language picker and paste `listing.txt` + upload that folder's images.

| Folder | Chrome / Edge | AMO |
|---|---|---|
| `en` | English | English (US) |
| `es` | Spanish (Latin America `es_419` and Spain `es`) | Español (es-ES, es-MX…) |
| `fr` | French | Français |
| `de` | German | Deutsch |
| `it` | Italian | Italiano |
| `pt_BR` | Portuguese (Brazil) | Português (do Brasil) |
| `ru` | Russian | Русский |
| `uk` | Ukrainian | Українська |
| `tr` | Turkish | Türkçe |
| `ar` | Arabic | عربي |
| `hi` | Hindi | हिन्दी |
| `id` | Indonesian | Bahasa Indonesia |
| `ja` | Japanese | 日本語 |
| `ko` | Korean | 한국어 |
| `zh_CN` | Chinese (Simplified) | 中文 (简体) |
| `zh_TW` | Chinese (Traditional) | 正體中文 (繁體) |
| `yue` | Chinese (Hong Kong) if the store offers it | — |

The name and short description are also in `extension/_locales/`, so the stores pick them up from the package automatically. Cantonese isn't a Chrome locale: it works inside Beepo (auto-picked for zh-HK/zh-MO browsers) but has no package locale.

## Category
Productivity (all three stores).

## Single purpose (Chrome)
Help users manage time spent on websites with an on-page companion that shows reminders and rewards.

## Permission justifications (Chrome / Edge)
- **Host permissions (http/https) and content script on all sites:** show the companion and measure time on user-chosen sites; domain-level time on other sites for local-only suggestions.
- **scripting:** on install/update, inject the companion into tabs that were already open so they're tracked without a reload.
- **storage:** persist rules, settings and usage locally.
- **idle:** stop counting when the user is away.
- **activeTab:** prefill the current site in the popup.
- **Remote code:** none. All code ships in the package.

## Data usage (Chrome privacy tab)
Collects nothing. Tick none of the data categories, and certify: not sold, not used for unrelated purposes, not used for creditworthiness. Firefox: the manifest declares `data_collection_permissions: { required: ["none"] }`.

## Firefox notes
- Upload `dist/beepo-firefox.zip`. No source-code upload needed: the code isn't minified or bundled.
- "Summary" = the short description.
- Host permissions are shown in the install prompt (Firefox 127+); users can revoke them in about:addons, which would stop Beepo from showing.
