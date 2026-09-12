# Marathon Doomscroller Extension

This simple browser extension estimates how far your thumb travels while scrolling:

- Instagram web: `instagram.com`
- YouTube Shorts web: `youtube.com/shorts`

Current build: `1.0.5`

It cannot track the native Instagram, YouTube, or TikTok phone apps. It only works on web pages where the extension is allowed to run.

## How to run it

1. Open Chrome or Edge on desktop.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select this folder: `thumb-mileage-extension`.
6. Open `https://www.instagram.com/` or `https://www.youtube.com/shorts`.
7. If the box does not appear, click the extension icon and press Start tracking this tab.
8. Scroll. A small mileage box appears at the bottom-right of the page.
9. Click the extension icon to see today, week, lifetime, calories, and achievement stats.
10. Click Open live dashboard to view the app interface at `http://localhost:3000`.

## Connect to the app interface

Run the dashboard app first:

```bash
cd ../thumb-mileage-app
npm start
```

Keep `http://localhost:3000` open while you scroll Instagram web or YouTube Shorts web in another tab. The extension sends each scroll batch to the app so the dashboard updates live.

## Quick test

If live tracking does not work:

1. Make sure the dashboard app is running at `http://localhost:3000`.
2. Click the extension icon.
3. Confirm the popup says `Connected to localhost:3000`.
4. Click Send test upload.
5. The dashboard should increase by about `10 cm`.
6. Reload the Instagram or YouTube Shorts tab after reloading the extension.

The extension will not run inside the Codex in-app browser. It must be loaded in Chrome or Edge.

If the dashboard opens but values do not change, reload the extension and reload the Instagram/YouTube tab. The content script only starts after the tracked page is loaded, and Chrome Manifest V3 can pause background work unless the extension is using the latest patched files.

## Debug Instagram and Shorts tracking

If the dashboard opens but scrolling still does not increase:

1. Check that the small Marathon Doomscroller box appears on the Instagram or YouTube tab.
2. If the box does not appear, reload the tab after reloading the extension.
3. For YouTube, use a Shorts URL like `https://www.youtube.com/shorts/...`.
4. For Instagram, the extension now tracks both the home feed and Reels pages.
5. Open DevTools Console on that page and look for `Marathon Doomscroller active`.
6. While scrolling, the console should show `Marathon Doomscroller captured`.

If the box is missing, the content script is not injected. The usual fix is:

1. Open `chrome://extensions`.
2. Check that Marathon Doomscroller says version `1.0.5`.
3. Click Reload.
4. Go back to Instagram or YouTube Shorts.
5. Hard reload the page with `Ctrl+Shift+R`.
6. Click the extension icon and press Start tracking this tab.

## How it measures

- On touch screens, it measures finger movement using touch events.
- On desktop, it estimates thumb distance from wheel and page scroll movement.
- The number is an estimate, not a medical or scientific measurement.

## Why this must be an extension

A normal website cannot read scrolling from Instagram or YouTube in another tab. Browser security blocks that. An extension can run a small content script inside allowed sites after the user installs it.
