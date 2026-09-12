const emptyStats = {
  lifetimeMeters: 0,
  daily: {},
  updatedAt: Date.now()
};

const certificateGoals = [
  {
    name: "First Flick",
    type: "Starter Certificate",
    meters: 1,
    initial: "F",
    tone: "green",
    description: "Log your first 100 cm of thumb travel."
  },
  {
    name: "Scroll Rookie",
    type: "Bronze Certificate",
    meters: 100,
    initial: "R",
    tone: "amber",
    description: "Complete 10,000 cm of scrolling."
  },
  {
    name: "Eiffel Thumb",
    type: "World Landmark Certificate",
    meters: 330,
    initial: "E",
    tone: "purple",
    description: "Scroll farther than the Eiffel Tower is tall."
  },
  {
    name: "Thumb Athlete",
    type: "Silver Certificate",
    meters: 1000,
    initial: "A",
    tone: "blue",
    description: "Reach 1 km of lifetime thumb distance."
  },
  {
    name: "Reels Marathoner",
    type: "Endurance Certificate",
    meters: 10000,
    initial: "M",
    tone: "red",
    description: "Finish a 10 km thumb endurance run."
  },
  {
    name: "Marathon Finisher",
    type: "Pace Certificate",
    meters: 42195,
    initial: "P",
    tone: "green",
    description: "Complete a full 42.195 km thumb marathon."
  },
  {
    name: "Legendary Thumb",
    type: "Mythic Certificate",
    meters: 100000,
    initial: "L",
    tone: "purple",
    description: "Reach 100 km of lifetime thumb travel."
  }
];

let activeAchievementFilter = "all";

const elements = {
  status: document.getElementById("status"),
  todayDistance: document.getElementById("todayDistance"),
  analyticsToday: document.getElementById("analyticsToday"),
  weekDistance: document.getElementById("weekDistance"),
  lifetimeDistance: document.getElementById("lifetimeDistance"),
  profileLifetime: document.getElementById("profileLifetime"),
  profileWeek: document.getElementById("profileWeek"),
  leaderboardYou: document.getElementById("leaderboardYou"),
  allTimeDistance: document.getElementById("allTimeDistance"),
  calories: document.getElementById("calories"),
  allTimeCalories: document.getElementById("allTimeCalories"),
  todayEvents: document.getElementById("todayEvents"),
  reelsWatched: document.getElementById("reelsWatched"),
  profileEvents: document.getElementById("profileEvents"),
  allTimeScrolls: document.getElementById("allTimeScrolls"),
  timeSpent: document.getElementById("timeSpent"),
  thumbSpeed: document.getElementById("thumbSpeed"),
  avgSpeed: document.getElementById("avgSpeed"),
  profileBadges: document.getElementById("profileBadges"),
  achievement: document.getElementById("achievement"),
  nextGoal: document.getElementById("nextGoal"),
  milestoneFill: document.getElementById("milestoneFill"),
  dailyGoalFill: document.getElementById("dailyGoalFill"),
  lapDistance: document.getElementById("lapDistance"),
  lapFill: document.getElementById("lapFill"),
  pacePerKm: document.getElementById("pacePerKm"),
  marathonEta: document.getElementById("marathonEta"),
  marathonRemaining: document.getElementById("marathonRemaining"),
  marathonProgress: document.getElementById("marathonProgress"),
  marathonFill: document.getElementById("marathonFill"),
  legendaryFill: document.getElementById("legendaryFill"),
  factText: document.getElementById("factText"),
  certificateTitle: document.getElementById("certificateTitle"),
  certificateBody: document.getElementById("certificateBody"),
  certificateDistance: document.getElementById("certificateDistance"),
  certificateDate: document.getElementById("certificateDate"),
  certificateInitial: document.getElementById("certificateInitial"),
  achievementVault: document.getElementById("achievementVault"),
  achievementVaultSummary: document.getElementById("achievementVaultSummary"),
  comparison: document.getElementById("comparison"),
  updatedAt: document.getElementById("updatedAt"),
  topSite: document.getElementById("topSite"),
  sites: document.getElementById("sites"),
  chart: document.getElementById("chart"),
  resetButton: document.getElementById("resetButton")
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKeyDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  const centimeters = meters * 100;
  if (centimeters < 10) return `${centimeters.toFixed(1)} cm`;
  return `${new Intl.NumberFormat().format(Math.round(centimeters))} cm`;
}

function weeklyMeters(stats) {
  let total = 0;
  for (let index = 0; index < 7; index += 1) {
    total += stats.daily?.[dateKeyDaysAgo(index)]?.meters || 0;
  }
  return total;
}

function allTimeEvents(stats) {
  return Object.values(stats.daily || {}).reduce((total, day) => total + (day.events || 0), 0);
}

function formatTimeFromEvents(events) {
  const minutes = Math.round((events * 8) / 60);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "No pace yet";

  const rounded = Math.round(minutes);
  const days = Math.floor(rounded / 1440);
  const hoursAfterDays = Math.floor((rounded % 1440) / 60);
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;

  if (days > 0) return `${days}d ${hoursAfterDays}h`;
  if (hours <= 0) return `${remaining} min`;
  return `${hours}h ${remaining}m`;
}

function achievementFor(meters) {
  if (meters >= 10000) return "Reels Marathoner";
  if (meters >= 1000) return "Thumb Athlete";
  if (meters >= 100) return "Scroll Rookie";
  return "Rookie";
}

function certificateFor(meters) {
  const achievement = achievementFor(meters);
  const body = {
    "Reels Marathoner": "This certifies that your thumb has completed a truly unnecessary endurance event.",
    "Thumb Athlete": "This certifies that your thumb has achieved certified scrolling fitness.",
    "Scroll Rookie": "This certifies that your thumb has officially joined the scrolling league.",
    "Rookie": "This certifies that your thumb has entered the scrolling arena."
  };

  return {
    title: `Certified ${achievement}`,
    body: body[achievement],
    initial: achievement[0]
  };
}

function milestoneFor(meters) {
  const goals = [
    { name: "Scroll Rookie", meters: 100 },
    { name: "Thumb Athlete", meters: 1000 },
    { name: "Reels Marathoner", meters: 10000 }
  ];

  const next = goals.find((goal) => meters < goal.meters);
  if (!next) {
    return {
      percent: 100,
      label: "All launch milestones unlocked"
    };
  }

  const previousGoalMeters = goals
    .filter((goal) => goal.meters < next.meters)
    .at(-1)?.meters || 0;
  const range = next.meters - previousGoalMeters;
  const progress = meters - previousGoalMeters;
  const percent = Math.max(0, Math.min(100, (progress / range) * 100));

  return {
    percent,
    label: `${formatDistance(next.meters - meters)} to ${next.name}`
  };
}

function comparisonFor(meters) {
  if (meters >= 330) return "Your thumb has traveled farther than the Eiffel Tower is tall.";
  if (meters >= 105) return "Your thumb has crossed a football field.";
  if (meters >= 10) return "Your thumb has crossed a small room many times.";
  if (meters > 0) return "It has begun. The thumb journey is real.";
  return "Start scrolling Instagram web or YouTube Shorts web.";
}

function render(stats = emptyStats) {
  const today = stats.daily?.[todayKey()] || {};
  const todayMeters = today.meters || 0;
  const todayEvents = today.events || 0;
  const weekMeters = weeklyMeters(stats);
  const lifetimeMeters = stats.lifetimeMeters || 0;
  const totalEvents = allTimeEvents(stats);
  const calories = todayMeters * 0.03;
  const allTimeCalories = lifetimeMeters * 0.03;
  const minutesEstimate = Math.max(1, Math.round((todayEvents * 8) / 60));
  const speed = todayMeters > 0 ? todayMeters / minutesEstimate : 0;
  const milestone = milestoneFor(lifetimeMeters);
  const topSite = topSiteFor(today.sites || {});
  const certificate = certificateFor(lifetimeMeters);
  const unlockedCertificates = certificateGoals.filter((goal) => lifetimeMeters >= goal.meters).length;
  const badgeCount = Math.max(1, unlockedCertificates);
  const lapMeters = lifetimeMeters % 100;
  const lapCentimeters = lapMeters * 100;
  const marathonMeters = 42195;
  const marathonRemaining = Math.max(0, marathonMeters - lifetimeMeters);
  const pacePerKm = speed > 0 ? 1000 / speed : 0;
  const marathonEta = speed > 0 ? marathonRemaining / speed : 0;

  elements.todayDistance.textContent = formatDistance(todayMeters);
  elements.analyticsToday.textContent = formatDistance(todayMeters);
  elements.weekDistance.textContent = formatDistance(weekMeters);
  elements.lifetimeDistance.textContent = formatDistance(lifetimeMeters);
  elements.profileLifetime.textContent = formatDistance(lifetimeMeters);
  elements.profileWeek.textContent = formatDistance(weekMeters);
  elements.leaderboardYou.textContent = formatDistance(lifetimeMeters);
  elements.allTimeDistance.textContent = formatDistance(lifetimeMeters);
  elements.todayEvents.textContent = new Intl.NumberFormat().format(todayEvents);
  elements.reelsWatched.textContent = new Intl.NumberFormat().format(Math.round(todayEvents / 5));
  elements.profileEvents.textContent = new Intl.NumberFormat().format(todayEvents);
  elements.allTimeScrolls.textContent = new Intl.NumberFormat().format(totalEvents);
  elements.timeSpent.textContent = formatTimeFromEvents(todayEvents);
  elements.thumbSpeed.textContent = `${(speed * 100).toFixed(1)} cm/min`;
  elements.avgSpeed.textContent = `${(speed * 100).toFixed(1)} cm/min`;
  elements.profileBadges.textContent = String(badgeCount);
  elements.calories.textContent = `${calories.toFixed(2)} kcal`;
  elements.allTimeCalories.textContent = `${allTimeCalories.toFixed(2)} kcal`;
  elements.achievement.textContent = achievementFor(lifetimeMeters);
  elements.nextGoal.textContent = milestone.label;
  elements.milestoneFill.style.width = `${milestone.percent}%`;
  elements.dailyGoalFill.style.width = `${Math.min(100, (todayMeters / 35) * 100)}%`;
  elements.lapDistance.textContent = `${new Intl.NumberFormat().format(Math.round(lapCentimeters))} cm / 10,000 cm`;
  elements.lapFill.style.width = `${Math.min(100, lapMeters)}%`;
  elements.pacePerKm.textContent = speed > 0 ? `${formatDuration(pacePerKm)} / km` : "Waiting for scrolls";
  elements.marathonEta.textContent = formatDuration(marathonEta);
  elements.marathonRemaining.textContent = `${formatDistance(marathonRemaining)} left`;
  elements.marathonProgress.textContent = `${formatDistance(lifetimeMeters)} / 10 km`;
  elements.marathonFill.style.width = `${Math.min(100, (lifetimeMeters / 10000) * 100)}%`;
  elements.legendaryFill.style.width = `${Math.min(100, (lifetimeMeters / 100000) * 100)}%`;
  elements.certificateTitle.textContent = certificate.title;
  elements.certificateBody.textContent = certificate.body;
  elements.certificateDistance.textContent = `${formatDistance(lifetimeMeters)} logged`;
  elements.certificateDate.textContent = `Issued ${new Date().toLocaleDateString()}`;
  elements.certificateInitial.textContent = certificate.initial;
  elements.comparison.textContent = comparisonFor(lifetimeMeters);
  elements.factText.textContent = comparisonFor(lifetimeMeters);
  elements.topSite.textContent = topSite ? `${topSite[0]} leads today` : "No top site";
  elements.updatedAt.textContent = stats.updatedAt
    ? `Updated ${new Date(stats.updatedAt).toLocaleTimeString()}`
    : "No data yet";

  renderSites(today.sites || {});
  renderChart(stats);
  renderAchievementVault(lifetimeMeters);
}

function topSiteFor(sites) {
  return Object.entries(sites).sort((a, b) => b[1] - a[1])[0] || null;
}

function renderSites(sites) {
  const entries = Object.entries(sites).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    elements.sites.innerHTML = `<p class="empty">No site data yet</p>`;
    return;
  }

  elements.sites.innerHTML = entries
    .map(([site, meters]) => `
      <div class="site-row">
        <div>
          <strong>${escapeHtml(site)}</strong>
          <span>today</span>
        </div>
        <strong>${formatDistance(meters)}</strong>
      </div>
    `)
    .join("");
}

function renderChart(stats) {
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const key = dateKeyDaysAgo(index);
    days.push({
      key,
      label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }),
      meters: stats.daily?.[key]?.meters || 0
    });
  }

  const max = Math.max(...days.map((day) => day.meters), 1);

  elements.chart.innerHTML = days
    .map((day) => {
      const height = Math.max(4, (day.meters / max) * 100);
      return `
        <div class="bar" title="${formatDistance(day.meters)}">
          <div class="bar-fill" style="height: ${height}%"></div>
          <label>${day.label}</label>
        </div>
      `;
    })
    .join("");
}

function renderAchievementVault(lifetimeMeters) {
  const unlockedCount = certificateGoals.filter((goal) => lifetimeMeters >= goal.meters).length;
  const lockedCount = certificateGoals.length - unlockedCount;
  const visibleGoals = certificateGoals.filter((goal) => {
    const unlocked = lifetimeMeters >= goal.meters;
    if (activeAchievementFilter === "unlocked") return unlocked;
    if (activeAchievementFilter === "locked") return !unlocked;
    return true;
  });

  elements.achievementVaultSummary.textContent = `${unlockedCount} unlocked, ${lockedCount} locked`;

  elements.achievementVault.innerHTML = visibleGoals
    .map((goal, index) => {
      const unlocked = lifetimeMeters >= goal.meters;
      const remaining = Math.max(0, goal.meters - lifetimeMeters);
      const percent = Math.min(100, (lifetimeMeters / goal.meters) * 100);
      const status = unlocked ? "Unlocked" : `${formatDistance(remaining)} left`;

      return `
        <article class="certificate-card ${unlocked ? "unlocked" : "locked"} ${goal.tone}" style="--stagger: ${index * 35}ms">
          <div class="certificate-badge" aria-hidden="true">${unlocked ? goal.initial : "?"}</div>
          <div>
            <div class="certificate-card-top">
              <span>${escapeHtml(goal.type)}</span>
              <strong>${status}</strong>
            </div>
            <h3>${escapeHtml(goal.name)}</h3>
            <p>${escapeHtml(goal.description)}</p>
            <div class="mini-track"><div style="width: ${percent}%"></div></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function setupAchievementTabs() {
  const buttons = [...document.querySelectorAll("[data-achievement-filter]")];

  for (const button of buttons) {
    button.addEventListener("click", () => {
      activeAchievementFilter = button.dataset.achievementFilter;

      for (const currentButton of buttons) {
        const isActive = currentButton === button;
        currentButton.classList.toggle("active", isActive);
        currentButton.setAttribute("aria-selected", String(isActive));
      }

      loadStats();
    });
  }
}

function setStatus(text, className) {
  elements.status.textContent = text;
  elements.status.className = `status ${className}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadStats() {
  const response = await fetch("/api/stats");
  const data = await response.json();
  render(data.stats);
}

function connectStream() {
  const stream = new EventSource("/api/stream");

  stream.addEventListener("open", () => {
    setStatus("Live", "live");
  });

  stream.addEventListener("message", (event) => {
    render(JSON.parse(event.data));
  });

  stream.addEventListener("error", () => {
    setStatus("Offline", "offline");
  });
}

elements.resetButton.addEventListener("click", async () => {
  await fetch("/api/reset", { method: "POST" });
  await loadStats();
});

setupAchievementTabs();
loadStats().catch(() => setStatus("Offline", "offline"));
connectStream();
