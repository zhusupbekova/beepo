# Beepo

A tiny pixel robot that lives at the bottom of your websites. Set daily limits (or goals) for sites, and Beepo checks in, holds up a STOP sign when time's up, and cheers when you hit your goals. Earn stars, keep streaks, and spend them on hats and pets.

## Install (dev)

1. Open `chrome://extensions` and turn on **Developer mode**
2. **Load unpacked** → pick the `extension/` folder
3. Click the Beepo icon to add a site

## Development

```sh
npm test         # core logic tests
npm run check    # syntax check
npm run icons    # regenerate toolbar icons from the sprite
npm run locales  # regenerate extension/_locales from store/*.json
npm run build    # dist/beepo-chrome.zip + dist/beepo-firefox.zip
npm run store    # screenshots, promo tiles and listing text in dist/store/
npm run social   # Xiaohongshu + Threads images and videos in dist/social/ (needs ffmpeg)
```

No build step for development; the extension is plain JS. Sprites live in `extension/data/`, and there's a sprite editor in the extension for drawing new hats.

## Languages

Beepo speaks 17 languages: English, Spanish, French, German, Italian, Portuguese (Brazil), Russian, Ukrainian, Turkish, Arabic, Hindi, Indonesian, Japanese, Korean, Chinese (Simplified), Chinese (Traditional, Taiwan) and Cantonese (Hong Kong). The language follows the browser, or can be picked in Settings.

- App text and Beepo's lines: `extension/data/i18n/<lang>.json` (English is the source; missing keys fall back to it).
- Store listing text: `store/<lang>.json`. The name and short description also go into `extension/_locales/` via `npm run locales` (Chrome has no Cantonese locale, so that one is app-only).
- `npm test` checks every language has the same keys and `{placeholders}` as English, and that store text fits the length limits.

To add a language: add it to `LANGUAGES` in `lib/core.js`, add both JSON files, then `npm run locales`.

See `IDEAS.md` for the roadmap.
