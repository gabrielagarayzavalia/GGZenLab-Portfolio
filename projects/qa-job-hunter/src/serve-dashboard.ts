// ============================================================
//  serve-dashboard.ts — Servidor web del dashboard
//  Comando: npm run dashboard
// ============================================================

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  addRejection,
  loadFeedback,
  removeRejection,
  type MatchFeedbackStore,
} from "./feedback.js";
import {
  loadApplicationStatus,
  setApplicationStatus,
  type ApplicationStatus,
  type ApplicationStatusStore,
} from "./application-status.js";
import { connect } from "./db/client.js";
import { listJobs } from "./db/jobs.js";

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

function send(
  res: ServerResponse,
  status: number,
  body: string,
  contentType = "text/plain; charset=utf-8"
): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  send(res, status, JSON.stringify(data), "application/json");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function serveStatic(res: ServerResponse, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    send(res, 404, "Not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  res.end(fs.readFileSync(filePath));
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (pathname === "/api/jobs" && method === "GET") {
    try {
      await connect();
      const sort = url.searchParams.get("sort") ?? "matchPercent";
      const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
      const jobs = await listJobs({ sort, order });
      sendJson(res, 200, { jobs, count: jobs.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "MongoDB unavailable";
      sendJson(res, 503, { error: message, hint: "Run docker compose up and npm run db:seed" });
    }
    return;
  }

  if (pathname === "/api/results" && method === "GET") {
    if (!fs.existsSync(RESULTS_PATH)) {
      sendJson(res, 404, { error: "No se encontró output/jobs-result.json" });
      return;
    }
    const result = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
    const feedback = loadFeedback();
    const applicationStatus = loadApplicationStatus();
    const rejectedIds = new Set(feedback.rejections.map((r) => r.jobId));
    sendJson(res, 200, {
      ...result,
      feedback: {
        rejectionCount: feedback.rejections.length,
        rejectedJobIds: [...rejectedIds],
        rejections: feedback.rejections,
      },
      applicationStatus: {
        updatedAt: applicationStatus.updatedAt,
        entries: applicationStatus.entries,
      },
    });
    return;
  }

  if (pathname === "/api/feedback" && method === "GET") {
    sendJson(res, 200, loadFeedback());
    return;
  }

  if (pathname === "/api/feedback/reject" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        jobId: string;
        title: string;
        company: string;
        searchTerm: string;
        matchPercent: number;
        reason?: string;
      };
      if (!body.jobId || !body.title) {
        sendJson(res, 400, { error: "Faltan jobId o title" });
        return;
      }
      const store = addRejection(
        {
          id: body.jobId,
          title: body.title,
          company: body.company,
          searchTerm: body.searchTerm,
          matchPercent: body.matchPercent,
        },
        body.reason
      );
      sendJson(res, 200, store);
    } catch {
      sendJson(res, 400, { error: "JSON inválido" });
    }
    return;
  }

  if (pathname.startsWith("/api/feedback/reject/") && method === "DELETE") {
    const jobId = decodeURIComponent(pathname.replace("/api/feedback/reject/", ""));
    const store: MatchFeedbackStore = removeRejection(jobId);
    sendJson(res, 200, store);
    return;
  }

  if (pathname === "/api/application-status" && method === "GET") {
    sendJson(res, 200, loadApplicationStatus());
    return;
  }

  if (pathname === "/api/application-status" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        jobId: string;
        title: string;
        company: string;
        status: ApplicationStatus | null;
      };
      if (!body.jobId || !body.title) {
        sendJson(res, 400, { error: "Faltan jobId o title" });
        return;
      }
      const store = setApplicationStatus(
        { id: body.jobId, title: body.title, company: body.company },
        body.status
      );
      sendJson(res, 200, store);
    } catch {
      sendJson(res, 400, { error: "JSON inválido" });
    }
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    serveStatic(res, path.join(DASHBOARD_DIR, "index.html"));
    return;
  }

  if (pathname === "/config" || pathname === "/config.html") {
    serveStatic(res, path.join(DASHBOARD_DIR, "config.html"));
    return;
  }

  if (
    pathname === "/styles.css" ||
    pathname === "/app.js" ||
    pathname === "/config.js"
  ) {
    serveStatic(res, path.join(DASHBOARD_DIR, pathname.slice(1)));
    return;
  }

  send(res, 404, "Not found");
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error(err);
    sendJson(res, 500, { error: "Error interno del servidor" });
  });
}).listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║           QA JOB HUNTER — Dashboard web                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\n  URL: ${url}`);

  if (fs.existsSync(RESULTS_PATH)) {
    const data = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
    const fb = loadFeedback();
    console.log(`  Empleos con match: ${data.matchedJobs?.length ?? 0}`);
    if (fb.rejections.length > 0) {
      console.log(`  Feedback activo  : ${fb.rejections.length} rechazo(s)`);
    }
  } else {
    console.log("\n  ⚠️  No hay output/jobs-result.json — ejecutá el análisis primero.");
  }

  console.log("\n  Ctrl+C para detener\n");
  openBrowser(url);
});
