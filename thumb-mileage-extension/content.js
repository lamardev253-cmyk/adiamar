(() => {
if (window.__thumbMileageTrackerLoaded) {
  console.info("Marathon Doomscroller tracker is already loaded on this tab.");
  return;
}

window.__thumbMileageTrackerLoaded = true;

const SCROLL_PIXEL_TO_THUMB_METER = 0.00008;
const TOUCH_PIXEL_TO_METER = 0.00016;
const SHORT_CHANGE_METERS = 0.12;
const SAVE_EVERY_MS = 500;
const VIDEO_CHECK_EVERY_MS = 800;
const SCROLL_CONTAINER_SCAN_MS = 1500;
const NAVIGATION_GESTURE_METERS = 0.12;

const passiveCapture = { passive: true, capture: true };
const elementScrollPositions = new WeakMap();
const watchedScrollElements = new WeakSet();

let lastScrollY = window.scrollY;
let lastTouch = null;
let lastTouchAt = 0;
let lastPointer = null;
let lastPointerAt = 0;
let lastWheelAt = 0;
let lastVideoKey = "";
let lastUrl = location.href;
let lastShortChangeAt = 0;
let sessionMeters = 0;
let sessionEvents = 0;
let pendingMeters = 0;
let pendingThumbPixels = 0;
let pendingScrollPixels = 0;
let pendingEvents = 0;
let saveTimer = null;
let widget = null;
let enabled = false;

function isInstagram() {
  return location.hostname.includes("instagram.com");
}

function isInstagramReels() {
  return isInstagram() && /^\/(reel|reels)(\/|$)/.test(location.pathname);
}

function isYouTube() {
  return location.hostname.includes("youtube.com");
}

function isYouTubeShorts() {
  return isYouTube() && location.pathname.startsWith("/shorts");
}

function isTrackedPage() {
  return isInstagram() || isYouTubeShorts();
}

function siteName() {
  if (isInstagramReels()) return "Instagram Reels";
  if (isInstagram()) return "Instagram";
  if (isYouTubeShorts()) return "YouTube Shorts";
  return "Tracked page";
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  const centimeters = meters * 100;
  if (centimeters < 10) return `${centimeters.toFixed(1)} cm`;
  return `${new Intl.NumberFormat().format(Math.round(centimeters))} cm`;
}

function createWidget() {
  if (widget || !document.body) return;

  widget = document.createElement("div");
  widget.id = "thumb-mileage-widget";
  widget.innerHTML = `
    <div class="tmw-top">
      <div>
        <div class="tmw-label">Marathon Doomscroller</div>
        <div class="tmw-distance">0 cm</div>
      </div>
      <div class="tmw-dot"></div>
    </div>
    <div class="tmw-site">Listening</div>
    <div class="tmw-debug">0 events captured</div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #thumb-mileage-widget {
      position: fixed;
      right: 12px;
      bottom: 16px;
      z-index: 2147483647;
      width: 172px;
      box-sizing: border-box;
      padding: 11px 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(20, 33, 61, 0.94);
      color: #f8fafc;
      font-family: Arial, Helvetica, sans-serif;
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      user-select: none;
      pointer-events: none;
    }

    #thumb-mileage-widget .tmw-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    #thumb-mileage-widget .tmw-dot {
      width: 9px;
      height: 9px;
      flex: 0 0 auto;
      margin-top: 3px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
    }

    #thumb-mileage-widget .tmw-label,
    #thumb-mileage-widget .tmw-debug {
      font-size: 11px;
      line-height: 1.2;
      color: #cbd5e1;
    }

    #thumb-mileage-widget .tmw-distance {
      margin-top: 4px;
      font-size: 24px;
      line-height: 1.05;
      font-weight: 700;
      letter-spacing: 0;
      white-space: nowrap;
    }

    #thumb-mileage-widget .tmw-site {
      margin-top: 6px;
      font-size: 12px;
      line-height: 1.25;
      color: #99f6e4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #thumb-mileage-widget .tmw-debug {
      margin-top: 4px;
    }
  `;

  document.documentElement.appendChild(style);
  document.body.appendChild(widget);
  updateWidget();
}

function removeWidget() {
  widget?.remove();
  widget = null;
}

function updateWidget() {
  if (!widget) return;
  widget.querySelector(".tmw-distance").textContent = formatDistance(sessionMeters);
  widget.querySelector(".tmw-site").textContent = siteName();
  widget.querySelector(".tmw-debug").textContent = `${sessionEvents} events captured`;
}

function queueSave() {
  if (saveTimer) return;

  saveTimer = window.setTimeout(() => {
    saveTimer = null;

    if (pendingMeters <= 0) return;

    const payload = {
      type: "thumb:add-distance",
      meters: pendingMeters,
      thumbPixels: pendingThumbPixels,
      scrollPixels: pendingScrollPixels,
      events: pendingEvents,
      site: siteName()
    };

    pendingMeters = 0;
    pendingThumbPixels = 0;
    pendingScrollPixels = 0;
    pendingEvents = 0;

    chrome.runtime.sendMessage(payload, () => {
      if (chrome.runtime.lastError) {
        console.warn("Marathon Doomscroller upload failed:", chrome.runtime.lastError.message);
      }
    });
  }, SAVE_EVERY_MS);
}

function addDistance(meters, details = {}) {
  if (!enabled || !Number.isFinite(meters) || meters <= 0) return;

  const cappedMeters = Math.min(meters, 3);

  sessionMeters += cappedMeters;
  sessionEvents += 1;
  pendingMeters += cappedMeters;
  pendingThumbPixels += details.thumbPixels || 0;
  pendingScrollPixels += details.scrollPixels || 0;
  pendingEvents += 1;

  if (sessionEvents <= 5 || sessionEvents % 25 === 0) {
    console.info("Marathon Doomscroller captured", {
      site: siteName(),
      sessionMeters: Number(sessionMeters.toFixed(4)),
      source: details.thumbPixels ? "touch" : "scroll"
    });
  }

  updateWidget();
  queueSave();
}

function addPixels(distancePixels, source) {
  if (!Number.isFinite(distancePixels) || distancePixels <= 0) return;

  const cappedPixels = Math.min(distancePixels, 2500);

  if (source === "touch") {
    addDistance(cappedPixels * TOUCH_PIXEL_TO_METER, {
      thumbPixels: cappedPixels
    });
    return;
  }

  addDistance(cappedPixels * SCROLL_PIXEL_TO_THUMB_METER, {
    scrollPixels: cappedPixels
  });
}

function handleTouchStart(event) {
  const touch = event.touches[0];
  if (!touch) return;

  lastTouch = { x: touch.clientX, y: touch.clientY };
  lastTouchAt = Date.now();
}

function handleTouchMove(event) {
  if (Date.now() - lastPointerAt < 80) return;

  const touch = event.touches[0];
  if (!touch || !lastTouch) return;

  const distancePixels = Math.hypot(touch.clientX - lastTouch.x, touch.clientY - lastTouch.y);

  lastTouch = { x: touch.clientX, y: touch.clientY };
  lastTouchAt = Date.now();
  addPixels(distancePixels, "touch");
}

function handleTouchEnd() {
  lastTouch = null;
}

function handlePointerDown(event) {
  if (event.pointerType !== "touch") return;

  lastPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  lastPointerAt = Date.now();
}

function handlePointerMove(event) {
  if (event.pointerType !== "touch" || !lastPointer || event.pointerId !== lastPointer.id) return;

  const distancePixels = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);

  lastPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  lastPointerAt = Date.now();
  addPixels(distancePixels, "touch");
}

function handlePointerEnd(event) {
  if (lastPointer?.id === event.pointerId) {
    lastPointer = null;
  }
}

function handleWheel(event) {
  lastWheelAt = Date.now();
  addPixels(normalizeWheelPixels(event), "scroll");
}

function normalizeWheelPixels(event) {
  const raw = Math.abs(event.deltaY || event.deltaX || 0);

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return raw * 18;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return raw * window.innerHeight;
  }

  return raw;
}

function handleWindowScroll() {
  const currentScrollY = window.scrollY;
  const delta = Math.abs(currentScrollY - lastScrollY);
  lastScrollY = currentScrollY;

  if (recentGestureAlreadyCounted()) return;
  addPixels(delta, "scroll");
}

function handleElementScroll(event) {
  if (recentGestureAlreadyCounted()) return;

  const target = scrollTargetFor(event.currentTarget || event.target);
  if (!target) return;

  const current = scrollTopFor(target);
  const last = elementScrollPositions.get(target);
  elementScrollPositions.set(target, current);

  if (last === undefined) return;
  addPixels(Math.abs(current - last), "scroll");
}

function recentGestureAlreadyCounted() {
  const now = Date.now();
  return now - lastTouchAt < 600 || now - lastPointerAt < 600 || now - lastWheelAt < 250;
}

function scrollTargetFor(target) {
  if (target === document || target === document.body || target === document.documentElement) {
    return document.scrollingElement || document.documentElement;
  }

  if (target instanceof Element) {
    return target;
  }

  return null;
}

function scrollTopFor(target) {
  if (target === document.scrollingElement || target === document.documentElement || target === document.body) {
    return window.scrollY || target.scrollTop || 0;
  }

  return target.scrollTop || 0;
}

function visibleVideoKey() {
  const videos = [...document.querySelectorAll("video")];
  let best = null;
  let bestArea = 0;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const area = width * height;

    if (area > bestArea) {
      bestArea = area;
      best = video;
    }
  }

  if (!best || bestArea < window.innerWidth * window.innerHeight * 0.08) return "";

  const linkedKey = shortLinkNear(best);
  if (linkedKey) return linkedKey;

  const source = best.currentSrc || best.src || "";
  const poster = best.poster || "";
  const rect = best.getBoundingClientRect();
  const mediaKey = source || poster || best.getAttribute("aria-label") || best.parentElement?.textContent?.slice(0, 80) || "visible-video";
  return `${mediaKey}|${Math.round(rect.top)}|${Math.round(rect.height)}|${location.pathname}`;
}

function shortLinkNear(element) {
  const container = element.closest("article, section, main, ytd-reel-video-renderer, ytd-shorts, ytd-page-manager, [role='main']") || document;
  const link = container.querySelector("a[href*='/reel/'], a[href*='/reels/'], a[href^='/shorts/'], a[href*='youtube.com/shorts/']");
  const href = link?.href || link?.getAttribute("href");

  if (!href) return "";
  return href;
}

function checkShortChange() {
  if (!enabled) return;

  const urlChanged = location.href !== lastUrl;
  const videoKey = visibleVideoKey();
  const videoChanged = videoKey && lastVideoKey && videoKey !== lastVideoKey;

  if ((urlChanged || videoChanged) && Date.now() - lastShortChangeAt > 900) {
    countNavigationGesture(SHORT_CHANGE_METERS);
    lastShortChangeAt = Date.now();
  }

  if (urlChanged) {
    lastUrl = location.href;
    checkPage();
  }

  if (videoKey) {
    lastVideoKey = videoKey;
  }
}

function countNavigationGesture(meters = NAVIGATION_GESTURE_METERS) {
  addDistance(meters, {
    scrollPixels: Math.round(meters / SCROLL_PIXEL_TO_THUMB_METER)
  });
}

function handleKeyDown(event) {
  const keys = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "j", "k"];
  if (!keys.includes(event.key)) return;
  checkPage();
  if (!enabled) return;
  countNavigationGesture(0.06);
  window.setTimeout(checkShortChange, 250);
}

function checkPage() {
  const wasEnabled = enabled;
  enabled = isTrackedPage();

  if (enabled) {
    createWidget();
    lastVideoKey = visibleVideoKey();
    if (!wasEnabled) {
      console.info(`Marathon Doomscroller active on ${siteName()}`);
    }
  } else {
    removeWidget();
  }
}

function watchUrlChanges() {
  const notify = () => window.dispatchEvent(new Event("thumb-mileage:url-change"));
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushStatePatched(...args) {
    const result = originalPushState.apply(this, args);
    notify();
    return result;
  };

  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplaceState.apply(this, args);
    notify();
    return result;
  };

  window.addEventListener("popstate", notify);
  window.addEventListener("thumb-mileage:url-change", () => {
    window.setTimeout(checkShortChange, 100);
  });
}

function watchScrollableElement(element) {
  if (!(element instanceof Element) || watchedScrollElements.has(element)) return;
  if (element.scrollHeight <= element.clientHeight + 16) return;

  watchedScrollElements.add(element);
  elementScrollPositions.set(element, scrollTopFor(element));
  element.addEventListener("scroll", handleElementScroll, passiveCapture);
}

function scanScrollableElements() {
  if (!enabled) return;

  const candidates = [
    document.scrollingElement || document.documentElement,
    ...document.querySelectorAll("main, section, article, div, ytd-page-manager, ytd-reel-video-renderer")
  ];

  for (const element of candidates.slice(0, 500)) {
    watchScrollableElement(element);
  }
}

function watchPageChanges() {
  const observer = new MutationObserver(() => {
    checkPage();
    checkShortChange();
    scanScrollableElements();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "href", "style", "class"]
  });
}

function startTracking() {
  elementScrollPositions.set(document.scrollingElement || document.documentElement, window.scrollY);

  window.addEventListener("touchstart", handleTouchStart, passiveCapture);
  window.addEventListener("touchmove", handleTouchMove, passiveCapture);
  window.addEventListener("touchend", handleTouchEnd, passiveCapture);
  window.addEventListener("touchcancel", handleTouchEnd, passiveCapture);
  window.addEventListener("pointerdown", handlePointerDown, passiveCapture);
  window.addEventListener("pointermove", handlePointerMove, passiveCapture);
  window.addEventListener("pointerup", handlePointerEnd, passiveCapture);
  window.addEventListener("pointercancel", handlePointerEnd, passiveCapture);
  window.addEventListener("wheel", handleWheel, passiveCapture);
  window.addEventListener("keydown", handleKeyDown, passiveCapture);
  window.addEventListener("scroll", handleWindowScroll, passiveCapture);
  document.addEventListener("scroll", handleElementScroll, passiveCapture);

  watchUrlChanges();
  watchPageChanges();
  checkPage();
  scanScrollableElements();
  window.setInterval(checkShortChange, VIDEO_CHECK_EVERY_MS);
  window.setInterval(scanScrollableElements, SCROLL_CONTAINER_SCAN_MS);
}

startTracking();
})();
