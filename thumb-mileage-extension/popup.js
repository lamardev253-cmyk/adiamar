const STORAGE_KEY = "thumbMileageStatsV1";

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  const centimeters = meters * 100;
  if (centimeters < 10) return `${centimeters.toFixed(1)} cm`;
  return `${new Intl.NumberFormat().format(Math.round(centimeters))} cm`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKeyDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function weeklyMeters(stats) {
  let total = 0;
  for (let index = 0; index < 7; index += 1) {
    total += stats.daily?.[dateKeyDaysAgo(index)]?.meters || 0;
  }
  return total;
}

function achievementFor(meters) {
  if (meters >= 10000) return "Reels Marathoner";
  if (meters >= 1000) return "Thumb Athlete";
  if (meters >= 100) return "Scroll Rookie";
  return "Rookie";
}

function render(stats) {
  const todayMeters = stats.daily?.[todayKey()]?.meters || 0;
  const weekMeters = weeklyMeters(stats);
  const lifetimeMeters = stats.lifetimeMeters || 0;

  document.getElementById("todayDistance").textContent = formatDistance(todayMeters);
  document.getElementById("weekDistance").textContent = formatDistance(weekMeters);
  document.getElementById("lifetimeDistance").textContent = formatDistance(lifetimeMeters);
  document.getElementById("calories").textContent = `${(todayMeters * 0.03).toFixed(2)} kcal`;
  document.getElementById("achievement").textContent = achievementFor(lifetimeMeters);
}

function renderDashboardStatus(response) {
  const status = document.getElementById("dashboardStatus");
  const box = status.closest(".connection");

  if (response?.ok) {
    box.classList.remove("offline");
    status.textContent = "Connected to localhost:3000";
    return;
  }

  box.classList.add("offline");
  status.textContent = "Not connected. Start the dashboard app.";
}

function loadStats() {
  chrome.runtime.sendMessage({ type: "thumb:get-stats" }, (response) => {
    if (response?.ok) {
      render(response.stats);
      renderDashboardStatus({ ok: response.lastUpload?.ok !== false });
    }
  });
}

function checkDashboard() {
  chrome.runtime.sendMessage({ type: "thumb:test-dashboard" }, renderDashboardStatus);
}

function setActionStatus(text) {
  document.getElementById("actionStatus").textContent = text;
}

document.getElementById("startButton").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "thumb:start-tab" }, (response) => {
    if (response?.ok) {
      setActionStatus("Tracker injected. Scroll the page and watch the widget.");
      return;
    }

    setActionStatus(response?.error || "Could not inject tracker on this tab.");
  });
});

document.getElementById("resetButton").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "thumb:reset" }, loadStats);
});

document.getElementById("dashboardButton").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "thumb:open-dashboard" });
});

document.getElementById("testButton").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "thumb:test-upload" }, (response) => {
    renderDashboardStatus(response);
    loadStats();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) {
    render(changes[STORAGE_KEY].newValue);
  }
});

loadStats();
checkDashboard();
window.setInterval(loadStats, 1000);
