# Store listing (Chrome Web Store / Edge Add-ons / Firefox AMO)

Release checklist and copy. Publishing itself is manual (needs the developer account).

## Checklist

1. Bump `version` in `extension/manifest.json`.
2. `npm test && npm run check`
3. `npm run icons` (if the sprite changed) and `npm run build`
4. Upload `dist/beepo-chrome.zip` to Chrome Web Store and Edge Add-ons; `dist/beepo-firefox.zip` to AMO.
5. Privacy policy URL → host `docs/PRIVACY.md` (e.g. GitHub Pages / gist).
6. Screenshots (1280×800): page with Beepo + bubble, STOP sign, block screen, popup Today, popup Shop.
7. Promo tile 440×280: Beepo at scale 10 on `#f4f1e8`, wordmark "Beepo" in a monospace font.

## Name
Beepo — pixel buddy for your screen time

## Short description (≤132 chars)
A tiny pixel robot lives at the bottom of your websites, nudges you when time's up, and cheers when you hit your goals.

## Description
Meet Beepo, a little pixel robot who keeps you company on the sites you choose.

• Set daily limits (spend less) or goals (spend more) for any site, group of sites, or even a path like youtube.com/shorts
• Beepo checks in at 50% and 80%, holds up a STOP sign when time's up, and gently nags if you stay
• "5 more minutes" snooze — Beepo remembers how many times you hit it
• Optional hard block and focus hours, with a star-powered 5-minute unlock
• Earn stars for keeping limits and hitting goals; build streaks; unlock badges
• Spend stars on hats, colors, antennas, accessories, and pets (Mochi the cat says hi)
• Beepo evolves with your streaks — and gets a little scruffy when you slip
• Weekly report: time per day, per site, and time saved vs last week
• Draw your own hats in the built-in sprite editor
• Weekday/weekend limits, idle detection, quiet mode, 8-bit sounds, custom day reset hour

Private by design: no accounts, no servers, no analytics. Everything stays in your browser.

## Category
Productivity (Chrome) / Productivity (AMO)

## Single purpose (Chrome)
Help users manage time spent on websites with an on-page companion that shows reminders and rewards.

## Permission justifications (Chrome)
- Host permissions / content script on all sites: show the companion and measure time on user-chosen sites; domain-level time on other sites for local-only suggestions.
- storage: persist rules, settings and usage locally.
- idle: stop counting when the user is away.
- activeTab: prefill the current site in the popup.
