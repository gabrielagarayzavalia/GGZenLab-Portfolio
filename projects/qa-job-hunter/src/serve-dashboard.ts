// serve-dashboard.ts - Fase 1
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DASHBOARD_DIR = path.join(ROOT, "dashboard");
const RESULTS_PATH = path.join(ROOT, "output", "jobs-result.json");
const PORT = Number(process.env.DASHBOARD_PORT ?? 3847);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function serveStatic(res: ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath)) { send(res, 404, "Not found"); return; }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === "/api/results") {
    if (!fs.existsSync(RESULTS_PATH)) {
      send(res, 404, JSON.stringify({ error: "No se encontro output/jobs-result.json" }), "application/json");
      return;
    }
    send(res, 200, fs.readFileSync(RESULTS_PATH, "utf-8"), "application/json");
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    serveStatic(res, path.join(DASHBOARD_DIR, "index.html"));
    return;
  }

  if (pathname === "/styles.css" || pathname === "/app.js") {
    serveStatic(res, path.join(DASHBOARD_DIR, pathname.slice(1)));
    return;
  }

  send(res, 404, "Not found");
}

function openBrowser(url: string): void {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

createServer(handleRequest).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  QA JOB HUNTER Dashboard: ${url}`);
  if (fs.existsSync(RESULTS_PATH)) {
    const data = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
    console.log(`  Empleos con match: ${data.matchedJobs?.length ?? 0}`);
  } else {
    console.log("  No hay output/jobs-result.json - ejecuta el analisis primero");
  }
  console.log("  Ctrl+C para detener\n");
  openBrowser(url);
});
