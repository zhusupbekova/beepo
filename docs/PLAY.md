# Google Play release (Android)

The privacy policy is shared with the extension (PRIVACY.md); its URL is `https://panikka.studio/apps/privacy-policy`. This file covers what the Play Console asks for on top of that.

## Checklist
- [ ] Release build with `revenuecatKey` (Play public SDK key) in `~/.gradle/gradle.properties`, signed with the upload key, as an `.aab`.
- [ ] RevenueCat: Play product (one-time, non-consumable) attached to the `beepo_pro` entitlement and the current offering's lifetime package; service account credentials uploaded.
- [ ] App content: privacy policy, ads (none), data safety, content rating, target audience (not for children), foreground service declaration (below).
- [ ] A short screen recording for the foreground service declaration (below).
- [ ] Category: Productivity. Tags: pick the closest five from Play's list (screen time / digital wellbeing, time management, habit tracker, focus, virtual pet).
- [ ] Internal testing track first: check onboarding, usage access, overlay, block screen, Plus purchase + restore, widget.

## Store listing (English)
Play indexes the title, short description and full description. The title weighs most, then the short description, which should add keywords the title doesn't have. Terms in this category: "screen time" and "app blocker" are the big ones (StayFree, AppBlock, Opal, ScreenZen own them); "doomscrolling" and "phone addiction" are growing; "screen time pet" is small, but only Zima competes on it, and it's what makes Beepo different. No "#1", "best" or "free" claims and no other app names (Play policy).

The "app blocker" copy needs the block toggle (and focus hours) in the Android rule editor; `BeepoService` already handles `block`, but `RuleEditor` doesn't set it. Until then use the fallback short description and drop the block-screen bullet.

**Title** (30 max): `Beepo: Screen Time Pixel Pet` (28)
- Alternative, if installs from generic searches matter more than standing out: `Beepo: Screen Time & App Limit` (30)

**Short description** (80 max): `Cute pixel robot that blocks apps when time is up. Stop doomscrolling, earn hats` (80)
- Fallback without blocking: `Cute pixel robot for app limits. Stop doomscrolling, earn stars, dress him up!` (78)

**Full description** (4000 max, 2383 chars):

```
Beepo is a tiny pixel robot who helps you cut your screen time and stay focused, kindly. Pick the apps that eat your day and set a daily limit. When time's up, Beepo pops up over the app with a STOP sign. Keep your limits, earn stars, and dress him up.

No guilt, no lectures. Beepo nudges, cheers, and never shames. Stars are only ever earned and spent, never taken away.

⏱ APP LIMITS & APP BLOCKER
• Daily time limits for any app or group of apps: social media, video, games
• Goals too: set a minimum for apps you want more of, like reading or language learning
• Different limits for weekends
• Beepo checks in at 50% and 80% and holds up a STOP sign at 100%
• "5 more minutes" snooze, and he remembers how many times you hit it
• Block screen: when the limit is up, the app closes. Spend a star to unlock 5 more minutes
• Long-press Beepo and he jumps into your camera hole and hangs there upside down, still keeping watch

⭐ STARS, STREAKS & BADGES
• Earn stars for every limit you keep and every goal you hit
• Build daily streaks and unlock badges
• Spend stars in the shop: hats, colors, antennas, accessories
• Beepo evolves as your streak grows, and gets a little scruffy when you slip

📊 SCREEN TIME REPORT
• Today's time per app, read from Android's own usage stats
• Weekly report: time per day, per app, and the time you saved compared with last week

✨ BEEPO PLUS: ONE-TIME PURCHASE, NO SUBSCRIPTION
• Beepo stays out in your tracked apps and walks along the bottom of the screen
• Pets that follow him around, starting with Mochi the cat
• Seasonal hats and pets for holidays all year round
• Home-screen widget with pixel scenes: meadow, starry night, beach, snowy hill, cozy room, outer space
• Draw your own hats in the sprite editor
• Full report history, week by week
• Dark mode

🔒 PRIVATE BY DESIGN
• No account, no ads, no tracking
• Your app time never leaves your phone. Beepo only goes online to check Beepo Plus purchases
• Usage access: lets Beepo see how long each app has been open (package names and minutes only)
• Display over other apps: lets Beepo pop up over the app you're using. He never reads your screen

A screen time pet for your digital wellbeing: a cute way to stop doomscrolling, break your phone addiction, and build better focus habits. Beepo also lives in Chrome, Edge and Firefox as a browser extension, and he speaks 17 languages.
```

**Screenshots** (phone, up to 8; the first three show in search results, so lead with Beepo over an app). Captions of 5 words or fewer so they stay big enough to read as thumbnails:
1. Beepo stops your doomscrolling
2. Daily limits for any app
3. Earn stars, dress him up
4. Streaks make him evolve
5. A kind block screen
6. Your weekly screen time
7. Plus: widget, pets, scenes
8. No account, no ads

**Feature graphic** (1024×500): Beepo with the STOP sign + tagline "Your pixel buddy for screen time".

**Later:** custom store listings (Play Console → Grow → Store presence) can target search keywords; good candidates are "screen time pet" (lean on the pet and the widget) and "app blocker" (lead with the STOP sign and the block screen). Store listing experiments: A/B the two titles (Play ranks on click-through rate since July 2026).

## Foreground service (App content → Foreground service permissions)
Type: **Special use** (`FOREGROUND_SERVICE_SPECIAL_USE`). The manifest's `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` says the same thing in short.

- **What it does:** Beepo is an on-screen companion for screen-time limits the user sets. While "Beepo on screen" is on, the service watches which app is in front (from Usage access). When a tracked app is open, it shows Beepo over it: reminders at 50 / 80 / 100 % of the user's limit, a "5 more minutes" button, and the block screen for apps the user chose to block.
- **Why it has to run in the foreground:** the reminder has to appear the moment the user opens or keeps using a tracked app. It's user-initiated (the user picks the apps and turns the feature on), user-visible (an ongoing notification and Beepo himself), and runs only while the screen is on. No other FGS type fits: it isn't media, location, data sync, health or a phone call. A WorkManager job or alarm can't react when an app is opened, and Android doesn't send a broadcast for that.
- **If it were stopped or deferred:** limits and the block screen wouldn't work while the user is in the tracked app; they'd only find out later in Beepo's own screen.
- **User control:** Settings → "Beepo on screen" off stops the service; so does revoking "Display over other apps" or Usage access, or removing all rules.
- **Video:** turn on Beepo on screen → open a tracked app → Beepo pops up with a reminder → reach the limit → STOP sign + snooze → a blocked app shows the block screen.

## Usage access (`PACKAGE_USAGE_STATS`)
There's no Play declaration form for this. Policy wants a prominent disclosure before the user is sent to system settings, which onboarding does (step "Beepo needs Usage access": what it reads, that it stays on the phone, privacy policy link), as does the Today card. Only package names and seconds are kept.

## Display over other apps (`SYSTEM_ALERT_WINDOW`)
There's no declaration form either. Onboarding explains it before sending the user to settings ("Let me pop up over your apps"), and "Not now" works: the app stays fully usable without it. The overlay never reads screen content and takes no touches outside Beepo, his bubble and the block screen.

## Other permissions
- `RECEIVE_BOOT_COMPLETED`: restarts the service after a reboot, only if Beepo on screen is on (`specialUse` may be started from boot; Android 15 only restricts other types).
- `INTERNET`, `ACCESS_NETWORK_STATE`, `com.android.vending.BILLING` (merged in from the RevenueCat SDK): Beepo Plus purchases.
- `<queries>` for launcher activities: names and icons in the app picker. No `QUERY_ALL_PACKAGES`.

## Data safety
Usage data never leaves the phone, so it isn't "collected" in Play's sense. Only RevenueCat sends anything (for Beepo Plus):

| Data type | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Purchase history | Yes | No (RevenueCat is a service provider) | App functionality (unlock Plus) | Yes, only if the user buys or restores |
| Device or other IDs (RevenueCat's random app user ID) | Yes | No | App functionality | No (set up when the app starts) |

- Encrypted in transit: yes. Users can ask for deletion: yes, by email (beepo@panikka.studio); uninstalling removes everything on the phone.
- Not collected: app activity, installed apps, location, personal info, messages, files, health.
- Check RevenueCat's current Play data safety guidance before submitting, in case it lists more for the SDK version in use.
