# Beepo Privacy Policy

_Last updated: 2026-10-08_

Beepo is a browser extension that shows a pixel companion on websites and tracks how much time you spend on them. The Android app does the same for apps on your phone.

**Beepo does not collect, transmit, sell or share any data.** There is no server, no analytics and no tracking.

## Browser extension

### What is stored, and where

All data stays in your browser's extension storage:

| Data | Stored in | Purpose |
|---|---|---|
| Your rules (sites, limits, goals), settings, stars, cosmetics, badges | `chrome.storage.sync` | So your setup follows you between your own signed-in browsers. Synced by your browser vendor's sync service, never by us. |
| Time spent per rule and per domain (today + last 60 days), custom sprites | `chrome.storage.local` | Reports, streaks, and suggestions. Never leaves your device. |

Beepo records **domain names and seconds spent**, not page contents, full URLs, titles or keystrokes.

### Permissions

- **Read and change website data (host access to all http/https sites):** to show Beepo and measure time on the sites you choose. Untracked sites are measured by domain only, to power "Beepo noticed you spend a lot of time on…" suggestions.
- **scripting:** after installing or updating, add Beepo to tabs that were already open, so they're tracked without a reload.
- **storage:** save your settings and usage.
- **idle:** pause counting when you're away from the computer.
- **activeTab:** prefill the current site when you open the popup.

### Deleting your data

Removing the extension deletes all of its data. Use **Settings → Your data → Export JSON** first if you want a copy.

## Android app

The Android app has no internet permission: it cannot send anything anywhere.

### What is stored, and where

Everything is kept in the app's private storage on your phone:

| Data | Purpose |
|---|---|
| Your rules (apps, limits, goals), settings, stars, cosmetics, badges | Your setup. |
| Time spent per rule and per app (today + last 60 days) | Today's progress, reports, streaks and stars. |

Beepo records **app package names and seconds spent**, not what you do inside apps, notifications, messages or keystrokes.

### Permissions

- **Usage access** (you turn it on in Android's settings): to read Android's own record of which app was on screen and when. Beepo only turns it into seconds per app, for the apps you track and for the "Today on your phone" list. If Beepo isn't opened for a few days, it uses the same record to fill in those days (Android keeps about a week).
- **List of installed apps with a launcher icon:** to show app names and icons when you pick apps for a rule. Only the package names you pick are saved.

### Deleting your data

Uninstalling the app deletes all of its data. You can also turn off Usage access at any time in Android's settings; Beepo then stops counting.

## Contact

Questions: [beepo@panikka.studio](mailto:beepo@panikka.studio)
