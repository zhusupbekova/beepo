# Beepo — Improvement Ideas

Status: ✅ done (v0.2) · ⏳ not started

## 1. Beepo's personality

- ✅ **Lots more lines.** Random pools per event in `data/messages.json`, time-of-day greetings, late-night lines.
- ✅ **Toolbar icon** generated from the sprite (`npm run icons`).
- ✅ **More moods & animations.** Sleepy, bored, proud, sad, look-left/right; blinking, waving, sitting, "z z z" when idle.
- ✅ **Walking along the bottom.** Wanders, sits, runs home when you scroll fast (toggle in settings).
- ✅ **Reacts to the page.** Peeks over the edge at 80%, holds a STOP sign over the limit, confetti on goals/badges.
- ✅ **Evolving Beepo.** Rosy cheeks at 3-day streak, grows at 7, golden collar at 14; scruffy after 2+ bad days.
- ✅ **Sound effects** (opt-in 8-bit beeps).

## 2. Limits & tracking

- ✅ **Weekday/weekend limits.**
- ✅ **Snooze "5 more minutes"**, counted per day; Beepo comments on repeat snoozes. Snoozed days don't count as "kept".
- ✅ **Site groups.** A rule can list several sites sharing one limit.
- ✅ **Focus hours.** Site fully off-limits in a time window (optionally weekdays only).
- ✅ **Optional hard block** with "unlock 5 min for ⭐1" and "Close tab".
- ✅ **Idle detection** via `chrome.idle`; playing media still counts.
- ✅ **Path-level rules.** `youtube.com/shorts` — most specific pattern wins.
- ✅ **Smart suggestions.** Untracked domains with 45+ min on 3 of the last 4 days (local only, dismissible).

## 3. Rewards & motivation

- ✅ **Streaks** (limits kept / goals met), shown in popup and by Beepo.
- ✅ **Star shop.** Colors, hats, antennas, accessories, pets. (Backgrounds not done.)
- ✅ **Badges.** 9 badges, +3 ⭐ each.
- ✅ **Weekly report.** Daily chart, per-rule this vs last week, best day, time saved.
- ✅ **Pets.** Mochi the cat, Boo the ghost, Gloop the slime follow Beepo around.

## 4. Popup & settings

- ✅ **Edit a rule.**
- ✅ **Quick add** current site with 15/30/60 presets.
- ✅ **Settings page:** side, size, quiet mode, nag interval, day reset hour, idle threshold, wander, sounds, show everywhere.
- ✅ **Hide Beepo on a site** but still track (block screen still shows).
- ✅ **Export / import** JSON.

## 5. Cross-device & Android

- ✅ **Sync** rules, settings and wallet via `chrome.storage.sync`; usage stays per device.
- ⏳ **Android app (Kotlin + Compose).** `UsageStatsManager` for per-app time, overlay (`SYSTEM_ALERT_WINDOW`) or notification/widget for Beepo; reuse `data/sprites.json` + `data/messages.json`.
- ⏳ **Shared account** so stars/cosmetics follow you across browser + phone (needs a backend).

## 6. Technical

- ✅ **Tests** for `lib/core.js` (`npm test`).
- ✅ **Sprites/messages as data files.**
- ✅ **Sprite editor** (`editor.html`) — custom hats/accessories saved into the shop, or copy JSON for `sprites.json`.
- ✅ **Firefox / Edge builds** (`npm run build`). Firefox build untested in a real Firefox yet.
- ⏳ **Store release.** Listing copy + privacy policy ready in `docs/`; publishing needs a developer account.

## New ideas (from building v0.2)

- Background themes for the popup / shop preview.
- Beepo reacts to specific sites (e.g. sunglasses on YouTube, reading glasses on docs).
- Weekly recap bubble on Monday morning.
- A "commitment" mode where raising a limit takes effect tomorrow, not today.
- Per-rule message tone (gentle vs strict).

## Decisions on the old open questions

- **Blocking:** nudge by default, block opt-in per rule.
- **Stars:** never taken away; only spent (shop, unlocks).
- **Everywhere:** off by default, setting "Show Beepo on every site".
