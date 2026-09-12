# Marathon Doomscroller App Interface

This is the live dashboard for the Marathon Doomscroller extension.

The flow is:

1. You scroll Instagram web or YouTube Shorts web.
2. The extension measures thumb/scroll distance.
3. The extension sends the data to `http://localhost:3000`.
4. This dashboard updates live.

## Run the app

```bash
npm start
```

Then open:

```txt
http://localhost:3000
```

## Connect the extension

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Turn on Developer mode.
4. Click Reload on the Marathon Doomscroller extension.
5. Open `http://localhost:3000` in one tab.
6. Open `https://www.youtube.com/shorts` or `https://www.instagram.com/` in another tab.
7. Scroll. The dashboard should update live.

## Important limitation

This receives data from web pages where the extension runs. It does not track native phone apps.
