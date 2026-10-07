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
npm run build    # dist/beepo-chrome.zip + dist/beepo-firefox.zip
```

No build step for development; the extension is plain JS. Sprites and Beepo's lines live in `extension/data/`, and there's a sprite editor in the extension for drawing new hats.

See `IDEAS.md` for the roadmap.
