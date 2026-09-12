const STORAGE_KEY = "thumbMileageStatsV1";
const DASHBOARD_URL = "http://localhost:3000";

let saveQueue = Promise.resolve();
let lastUpload = {
  ok: null,
  message: "No upload yet",
  updatedAt: null
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStats() {
  return {
    lifetimeMeters: 0,
    daily: {},
    updatedAt: Date.now()
  };
}

function getFromStorage(key) {
  return chrome.storage.local.get(key);
}

function setInStorage(value) {
  return chrome.storage.local.set(value);
}

async function getStats() {
  const result = await getFromStorage(STORAGE_KEY);
  return result[STORAGE_KEY] || defaultStats();
}

async function saveDistance(message, sender) {
  const meters = Number(message.meters) || 0;
  if (meters <= 0 || meters > 20) return;

  const stats = await getStats();
  const date = todayKey();
  const site = message.site || new URL(sender.tab?.url || "https://unknown.local").hostname;

  if (!stats.daily[date]) {
    stats.daily[date] = {
      meters: 0,
      thumbPixels: 0,
      scrollPixels: 0,
      events: 0,
      sites: {}
    };
  }

  const day = stats.daily[date];

  stats.lifetimeMeters += meters;
  day.meters += meters;
  day.thumbPixels += Number(message.thumbPixels) || 0;
  day.scrollPixels += Number(message.scrollPixels) || 0;
  day.events += Number(message.events) || 1;
  day.sites[site] = (day.sites[site] || 0) + meters;
  stats.updatedAt = Date.now();

  await setInStorage({ [STORAGE_KEY]: stats });
  await syncDashboard("/api/track", {
    delta: {
      meters,
      thumbPixels: Number(message.thumbPixels) || 0,
      scrollPixels: Number(message.scrollPixels) || 0,
      events: Number(message.events) || 1,
      site,
      date,
      timestamp: Date.now()
    },
    stats
  });
}

async function syncDashboard(path, body) {
  try {
    const response = await fetch(`${DASHBOARD_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Dashboard returned ${response.status}`);
    }

    lastUpload = {
      ok: true,
      message: "Dashboard connected",
      updatedAt: Date.now()
    };

    return { ok: true };
  } catch (error) {
    lastUpload = {
      ok: false,
      message: error.message || "Dashboard offline",
      updatedAt: Date.now()
    };

    // The dashboard is optional. Tracking still works if localhost:3000 is closed.
    return { ok: false, error: lastUpload.message };
  }
}

function sendStats(sendResponse) {
  getStats()
    .then((stats) => sendResponse({ ok: true, stats, lastUpload }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
}

function resetStats(sendResponse) {
  setInStorage({ [STORAGE_KEY]: defaultStats() })
    .then(() => {
      syncDashboard("/api/reset", {});
      sendResponse({ ok: true });
    })
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
}

function testDashboard(sendResponse) {
  fetch(`${DASHBOARD_URL}/api/stats`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Dashboard returned ${response.status}`);
      }

      lastUpload = {
        ok: true,
        message: "Dashboard connected",
        updatedAt: Date.now()
      };

      sendResponse({ ok: true, dashboardUrl: DASHBOARD_URL, lastUpload });
    })
    .catch((error) => {
      lastUpload = {
        ok: false,
        message: error.message || "Dashboard offline",
        updatedAt: Date.now()
      };

      sendResponse({ ok: false, dashboardUrl: DASHBOARD_URL, lastUpload });
    });

  return true;
}

function testUpload(sendResponse) {
  saveQueue = saveQueue
    .then(() => saveDistance({
      meters: 0.1,
      thumbPixels: 625,
      scrollPixels: 1250,
      events: 1,
      site: "Extension Test"
    }, { tab: { url: "https://extension-test.local" } }))
    .then(() => sendResponse({ ok: true, lastUpload }))
    .catch((error) => sendResponse({ ok: false, error: error.message, lastUpload }));

  return true;
}

function startTrackingTab(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];

    if (!tab?.id || !isSupportedUrl(tab.url)) {
      sendResponse({
        ok: false,
        error: "Open Instagram web or YouTube Shorts, then click this again."
      });
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
  });

  return true;
}

function isSupportedUrl(url = "") {
  return /^https:\/\/(www\.)?instagram\.com\//.test(url) ||
    /^https:\/\/(www\.|m\.)?youtube\.com\/shorts/.test(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "thumb:add-distance") {
    const saveTask = saveQueue
      .catch(() => {})
      .then(() => saveDistance(message, sender));

    saveQueue = saveTask.catch((error) => {
      console.error("Marathon Doomscroller save failed:", error);
    });

    saveTask
      .then(() => sendResponse({ ok: true, lastUpload }))
      .catch((error) => sendResponse({ ok: false, error: error.message, lastUpload }));

    return true;
  }

  if (message?.type === "thumb:get-stats") {
    return sendStats(sendResponse);
  }

  if (message?.type === "thumb:reset") {
    return resetStats(sendResponse);
  }

  if (message?.type === "thumb:test-dashboard") {
    return testDashboard(sendResponse);
  }

  if (message?.type === "thumb:test-upload") {
    return testUpload(sendResponse);
  }

  if (message?.type === "thumb:start-tab") {
    return startTrackingTab(sendResponse);
  }

  if (message?.type === "thumb:open-dashboard") {
    chrome.tabs.create({ url: DASHBOARD_URL });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
