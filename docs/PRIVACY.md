# Beepo Privacy Policy

_Last updated: 2026-10-08_

Beepo is a browser extension that shows a pixel companion on websites and tracks how much time you spend on them.

**Beepo does not collect, transmit, sell or share any data.** There is no server, no analytics and no tracking.

## What is stored, and where

All data stays in your browser's extension storage:

| Data | Stored in | Purpose |
|---|---|---|
| Your rules (sites, limits, goals), settings, stars, cosmetics, badges | `chrome.storage.sync` | So your setup follows you between your own signed-in browsers. Synced by your browser vendor's sync service, never by us. |
| Time spent per rule and per domain (today + last 60 days), custom sprites | `chrome.storage.local` | Reports, streaks, and suggestions. Never leaves your device. |

Beepo records **domain names and seconds spent**, not page contents, full URLs, titles or keystrokes.

## Permissions

- **Read and change website data (host access to all http/https sites):** to show Beepo and measure time on the sites you choose. Untracked sites are measured by domain only, to power "Beepo noticed you spend a lot of time on…" suggestions.
- **scripting:** after installing or updating, add Beepo to tabs that were already open, so they're tracked without a reload.
- **storage:** save your settings and usage.
- **idle:** pause counting when you're away from the computer.
- **activeTab:** prefill the current site when you open the popup.

## Deleting your data

Removing the extension deletes all of its data. Use **Settings → Your data → Export JSON** first if you want a copy.

## Contact

Questions: [beepo@panikka.studio](mailto:beepo@panikka.studio)
