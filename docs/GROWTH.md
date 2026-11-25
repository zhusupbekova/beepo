# Growth plan: free tools for installs and engagement

Status 2026-10-19. Extension live on Chrome / Edge / Firefox (2026-10-12/13), Android live on Play (2026-10-13). One person, no ad budget.

## Play Points: verdict

Play Points developer promotions (coupons, perks, boosts, quests, stamp cards) are a games-only program, and product promotions also need "premium growth tools" eligibility (1.6M+ MAU or $40k+/month). Beepo is an app far below both bars. The only thing to do is passive:

- Fill in the Play Points developer interest form (developer.android.com/guide/playpoints). Five minutes, nothing to lose, no known app has been admitted.
- Users already earn points on the Plus purchase (Google-funded). Nothing to implement; RevenueCat would pick up a Play Points redemption like any other Play purchase.

The adjacent tools that *do* work for a one-time product are below (promo codes, discount offers, price experiments).

## Phase 1: console-only, this week (no code)

1. **Chrome Web Store Featured badge.** Self-nominate via One Stop Support → "My item" → nominate for Featured. Needs the 1400×560 marquee (we have it), MV3, free core. One nomination per 6 months, answer in days to ~2 weeks. Reported ~2× daily installs. Highest-leverage item on this list.
2. **Firefox Recommended.** Email amo-featured@mozilla.org with the AMO link and why (17 languages, no data leaves the device, no tracking). Low odds, zero cost.
3. **Edge Add-ons collections.** Request via aka.ms/AAb9fne with the 1400×560 tile; reviewed every 15 days. Don't resubmit repeatedly.
4. **UTM on every store link.** Play: `&referrer=utm_source%3Dtiktok%26utm_medium%3Dsocial%26utm_campaign%3Dlaunch` (double-encoded). Chrome: opt in to GA4 under Store listing → Additional metrics, then `?utm_source=...` on listing URLs. Update `dist/social/promo/posts.md`, Threads/XHS/TikTok drafts, Reddit drafts. Play Console → Grow users → Store performance filters by UTM source/campaign.
5. **Play developer page** (512px icon, 4096×2304 header, 140 chars, featured app) and CWS publisher spotlight once the Established Publisher badge appears (automatic).
6. **Promo codes.** Monetize → Promotions → Create: 500 codes/quarter for Plus. Use for reviewers, Reddit AMAs, newsletter swaps, "first 50 commenters". Unused codes don't roll over, so mint a batch each quarter.
7. **Store listing experiment.** One at a time, icon first, then the first two screenshots. Up to 2 variants, metric = install clicks. With our traffic expect 30–90 days per result; just let it run.
8. **Custom store listings.** (a) Keyword-targeted listings from Console's recommendations ("app blocker", "screen time", "digital wellbeing"), reusing the alt title in `docs/PLAY.md`. (b) URL listings with `&listing=social` / `&listing=extension` for traffic from social and from the extension, with copy that assumes the visitor already knows Beepo.
9. **Tags.** Fill all 5 Play tags (Digital Wellbeing, Productivity, Habit tracker, Focus, Pixel art if offered).

Skip: promotional content / LiveOps (needs 1.6M MAU), Engage SDK (tools excluded, 100k DAU), Play Games Services (games only), Firebase (sends device ids off-phone; breaks the Data Safety form and the privacy promise), Quick Settings tile (Google says not for launching apps), Live Updates (policy says reminders are a poor fit).

## Phase 2: small code, Android (one release)

1. **In-app review** (`com.google.android.play:review-ktx`). Trigger at a happy, idle moment: after the rollover awards a star for a kept limit or a streak/badge news is shown, once `history` has ≥7 days and at most once per 60 days (`settings.reviewAsked` date). No "do you like it?" gate, no button. Mirrors the extension's `askReview` rule.
2. **Share Beepo.** Settings → "Tell a friend": `ACTION_SEND` text with the Play link (`referrer=utm_source%3Dshare`) and the Chrome link. Pixel button, `android` i18n key in all 17 languages.
3. **Cross-promo card to the extension.** Settings section "Beepo in your browser" with official Chrome / Edge / Firefox badges (badge rules: link to the listing, resize only). Links from `STORES` in capture.js are logos only; add URLs.
4. **Widget pin prompt and Android 15 generated previews.** `requestPinGlanceAppWidget` after onboarding and from Today (free shows the Plus invite widget already); `providePreview` so the widget picker shows a real Beepo. Google's 2026 case study: widget users retain ~25% better.
5. **Static app shortcuts** (`res/xml/shortcuts.xml`): Today, Shop, Report. Long-press the icon. Needs a `?tab=` extra in MainActivity.
6. **One-time product discount offer** (Play Console → Plus → Buy option → Add offer): e.g. launch-month 30% off. Only shows in-app via Billing 8 purchase options, so first verify RevenueCat 10.26 exposes one-time discount offers in `StoreProduct`; otherwise the paywall keeps showing the base price (and old app versions always show the base price). Alternative with zero code: a **price experiment** (Monetize → one-time products → Price experiments, ≤6 months).
7. **Play Install Referrer:** do not add. Console UTM reports are enough and the in-app API would mean collecting data.

## Phase 3: small code, extension (done 2026-10-19, ships with the next extension release)

1. **"Get Beepo on your phone" card** in the popup Today tab footer and the options page: official Play badge + QR to `play.google.com/store/apps/details?id=studio.panikka.beepo&referrer=utm_source%3Dextension%26utm_campaign%3Dcard&listing=extension`. Show after 3+ history days, dismissible (`settings.phoneCardSeen`). Badge rule: ≥28px, don't recolor, Play legal line where space allows.
2. **Share from the popup** (`navigator.share` where available, else copy link): weekly report "I saved Xh this week with Beepo" + Chrome link with UTM.
3. **Review prompt in Edge/Firefox** already picks the right store via `reviewUrl()`; keep.

## Phase 4: launches (one-off spikes)

- **Product Hunt**: Tue/Wed 00:01 PT, Coming Soon page a week before, reply to every comment, promo codes for commenters. Pair with the Oct 25 / Nov 8 hero clips.
- **Show HN**: only as "Show HN: pixel buddy that nudges you off doomscrolling, no data leaves the device", weekday morning PT, be ready to discuss the tech (closed shadow DOM, UsageStats, no backend).
- **AlternativeTo**: list as alternative to Digital Wellbeing / StayFocusd / Forest; free queue takes months.

## Measuring

- Weekly: Play Console store performance by UTM; CWS GA4 traffic sources; installs/uninstalls per store; review count.
- Keep a `dist/social/metrics.md` log (installs per week per store, which UTM source converts).

## Open questions

- RevenueCat support for one-time discount offers (check the SDK changelog before Phase 2 §6).
- Edge badge guidelines say the badge is for clickable links, not videos; the promo videos end on store logos. Plain logos under Microsoft trademark rules are probably fine, but worth a glance.
