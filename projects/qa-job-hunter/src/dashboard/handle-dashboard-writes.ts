import type { IncomingMessage, ServerResponse } from "http";
import { ObjectId } from "mongodb";
import type { ApplicationStatus } from "../application-status.js";
import { connect } from "../db/client.js";
import { ensureIndexes } from "../db/indexes.js";
import {
  getApplicationById,
  patchApplication,
  resolveApplicationByDashboardJobId,
} from "../db/applications.js";
import {
  patchForApplicationStatus,
  patchForRejectMatch,
  patchForUndoReject,
} from "./application-writes.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

function isDashboardWriteRoute(pathname: string, method: string): boolean {
  if (pathname === "/api/dashboard/application-status" && method === "POST") return true;
  if (pathname === "/api/dashboard/reject-match" && method === "POST") return true;
  if (method === "DELETE" && /^\/api\/dashboard\/reject-match\/.+/.test(pathname)) return true;
  return false;
}

function isUserRequest(req: IncomingMessage): boolean {
  const h = req.headers["x-tracker-user"];
  return h === "1" || h === "true";
}

async function ensureDb(): Promise<void> {
  await connect();
  await ensureIndexes();
}

export async function handleDashboardWrites(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  readBody: (req: IncomingMessage) => Promise<string>,
  sendJson: SendJson
): Promise<boolean> {
  if (!isDashboardWriteRoute(pathname, method)) return false;

  if (!isUserRequest(req)) {
    sendJson(res, 403, { error: "Requiere header X-Tracker-User: 1" });
    return true;
  }

  try {
    await ensureDb();
  } catch (err) {
    const message = err instanceof Error ? err.message : "MongoDB unavailable";
    sendJson(res, 503, { error: message, hint: "docker compose up -d && npm run tracker:seed" });
    return true;
  }

  if (pathname === "/api/dashboard/reject-match" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        jobId: string;
        reason?: string;
      };
      if (!body.jobId?.trim()) {
        sendJson(res, 400, { error: "Falta jobId" });
        return true;
      }
      const existing = await resolveApplicationByDashboardJobId(body.jobId.trim());
      if (!existing) {
        sendJson(res, 404, { error: "Application no encontrada" });
        return true;
      }
      const patch = patchForRejectMatch(body.reason, existing);
      const result = await patchApplication(existing.id, patch, "user");
      if (!result) {
        sendJson(res, 404, { error: "Application no encontrada" });
        return true;
      }
      sendJson(res, 200, { application: result.application, warnings: result.warnings });
    } catch {
      sendJson(res, 400, { error: "JSON inválido" });
    }
    return true;
  }

  const undoMatch = pathname.match(/^\/api\/dashboard\/reject-match\/(.+)$/);
  if (undoMatch && method === "DELETE") {
    const jobId = decodeURIComponent(undoMatch[1]);
    const existing = await resolveApplicationByDashboardJobId(jobId);
    if (!existing) {
      sendJson(res, 404, { error: "Application no encontrada" });
      return true;
    }
    const patch = patchForUndoReject(existing);
    const result = await patchApplication(existing.id, patch, "user");
    if (!result) {
      sendJson(res, 404, { error: "Application no encontrada" });
      return true;
    }
    sendJson(res, 200, { application: result.application, warnings: result.warnings });
    return true;
  }

  if (pathname === "/api/dashboard/application-status" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        applicationId?: string;
        jobId?: string;
        status: ApplicationStatus | null;
      };
      const lookupId = body.applicationId?.trim() || body.jobId?.trim();
      if (!lookupId) {
        sendJson(res, 400, { error: "Falta applicationId o jobId" });
        return true;
      }
      const existing =
        body.applicationId?.trim() && ObjectId.isValid(body.applicationId.trim())
          ? await getApplicationById(body.applicationId.trim())
          : await resolveApplicationByDashboardJobId(lookupId);
      if (!existing) {
        sendJson(res, 404, { error: "Application no encontrada" });
        return true;
      }
      const { patch, error } = patchForApplicationStatus(body.status, existing);
      if (error) {
        sendJson(res, 409, { error });
        return true;
      }
      const result = await patchApplication(existing.id, patch, "user");
      if (!result) {
        sendJson(res, 404, { error: "Application no encontrada" });
        return true;
      }
      sendJson(res, 200, { application: result.application, warnings: result.warnings });
    } catch {
      sendJson(res, 400, { error: "JSON inválido" });
    }
    return true;
  }

  sendJson(res, 404, { error: "Dashboard write route not found" });
  return true;
}
