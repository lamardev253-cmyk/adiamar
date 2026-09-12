import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const DATA_FILE = join(DATA_DIR, "stats.json");

const clients = new Set();
let stats = await loadStats();

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

async function loadStats() {
  if (!existsSync(DATA_FILE)) return defaultStats();

  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    return defaultStats();
  }
}

async function saveStats() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(stats, null, 2));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) break;
  }

  return body ? JSON.parse(body) : {};
}

function broadcast() {
  const message = `data: ${JSON.stringify(stats)}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

async function handleTrack(request, response) {
  const body = await readBody(request);

  if (body.stats) {
    stats = body.stats;
  } else if (body.delta) {
    applyDelta(body.delta);
  }

  stats.updatedAt = Date.now();
  await saveStats();
  broadcast();
  sendJson(response, 200, { ok: true, stats });
}

function applyDelta(delta) {
  const meters = Number(delta.meters) || 0;
  if (meters <= 0 || meters > 20) return;

  const date = delta.date || todayKey();
  const site = delta.site || "Unknown";

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
  day.thumbPixels += Number(delta.thumbPixels) || 0;
  day.scrollPixels += Number(delta.scrollPixels) || 0;
  day.events += Number(delta.events) || 1;
  day.sites[site] = (day.sites[site] || 0) + meters;
}

async function handleReset(response) {
  stats = defaultStats();
  await saveStats();
  broadcast();
  sendJson(response, 200, { ok: true, stats });
}

function handleStream(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  response.write(`data: ${JSON.stringify(stats)}\n\n`);
  clients.add(response);

  request.on("close", () => {
    clients.delete(response);
  });
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType(filePath)
    });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function contentType(filePath) {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8"
  };

  return types[extname(filePath)] || "application/octet-stream";
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/stats") {
      sendJson(response, 200, { ok: true, stats });
      return;
    }

    if (request.method === "GET" && request.url === "/api/stream") {
      handleStream(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/track") {
      await handleTrack(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/reset") {
      await handleReset(response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Marathon Doomscroller app running at http://localhost:${PORT}`);
});
