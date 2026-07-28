import type { IncomingMessage, ServerResponse } from "http";
import type { TrackerApplicationPatch } from "../types/tracker-application.js";
import { buildApplicationsXlsxBuffer } from "./export-xlsx.js";
import {
  countApplications,
  createApplication,
  getApplicationById,
  listApplications,
  patchApplication,
  upsertApplicationsBulk,
  type UpsertApplicationInput,
} from "../db/applications.js";
import { connect } from "../db/client.js";
import { ensureIndexes } from "../db/indexes.js";
import { assertExcelReadable } from "./excel-path.js";
import {
  importRowToApplicationInput,
  readEmpleosFromXlsx,
} from "./import-xlsx.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

function isUserRequest(req: IncomingMessage): boolean {
  const h = req.headers["x-tracker-user"];
  return h === "1" || h === "true";
}

async function ensureTrackerDb(): Promise<void> {
  await connect();
  await ensureIndexes();
}

export async function handleTrackerApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  url: URL,
  readBody: (req: IncomingMessage) => Promise<string>,
  sendJson: SendJson
): Promise<boolean> {
  if (!pathname.startsWith("/api/tracker/")) return false;

  try {
    await ensureTrackerDb();
  } catch (err) {
    const message = err instanceof Error ? err.message : "MongoDB unavailable";
    sendJson(res, 503, { error: message, hint: "docker compose up -d && npm run tracker:seed" });
    return true;
  }

  const source = isUserRequest(req) ? "user" : "automation";

  if (pathname === "/api/tracker/applications" && method === "GET") {
    const mr = url.searchParams.get("matchRejected");
    const ila = url.searchParams.get("inLatestAnalysis");
    const minMatch = url.searchParams.get("minMatchPercent");
    const applications = await listApplications({
      estado: url.searchParams.get("estado") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      sort: (url.searchParams.get("sort") as "matchPercent" | "updatedAt" | "estado") ?? "matchPercent",
      order: url.searchParams.get("order") === "asc" ? "asc" : "desc",
      matchRejected: mr === "true" ? true : mr === "false" ? false : undefined,
      inLatestAnalysis: ila === "true" ? true : ila === "false" ? false : undefined,
      minMatchPercent: minMatch != null ? Number(minMatch) : undefined,
    });
    sendJson(res, 200, { applications, count: applications.length });
    return true;
  }

  if (pathname === "/api/tracker/applications" && method === "POST") {
    try {
      const body = JSON.parse(await readBody(req)) as UpsertApplicationInput;
      if (!body.puesto?.trim() && !body.empresa?.trim()) {
        sendJson(res, 400, { error: "Faltan puesto o empresa" });
        return true;
      }
      const application = await createApplication(body, source);
      sendJson(res, 201, application);
    } catch (err) {
      const message = err instanceof Error ? err.message : "JSON inválido";
      sendJson(res, 400, { error: message });
    }
    return true;
  }

  if (pathname === "/api/tracker/export/xlsx" && method === "GET") {
    try {
      const buffer = await buildApplicationsXlsxBuffer();
      res.writeHead(200, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Empleos_Tracker_export.xlsx"',
        "Access-Control-Allow-Origin": "*",
      });
      res.end(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export falló";
      sendJson(res, 500, { error: message });
    }
    return true;
  }

  if (pathname === "/api/tracker/import/xlsx" && method === "POST") {
    try {
      const xlsxPath = assertExcelReadable();
      const rows = await readEmpleosFromXlsx(xlsxPath);
      const inputs = rows.map(importRowToApplicationInput);
      const result = await upsertApplicationsBulk(inputs, "import");
      const count = await countApplications();
      sendJson(res, 200, {
        ok: true,
        source: xlsxPath,
        rowsRead: rows.length,
        ...result,
        total: count,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import falló";
      sendJson(res, 400, { error: message });
    }
    return true;
  }

  const appMatch = pathname.match(/^\/api\/tracker\/applications\/([a-f0-9]{24})$/);
  if (appMatch) {
    const id = appMatch[1];

    if (method === "GET") {
      const application = await getApplicationById(id);
      if (!application) {
        sendJson(res, 404, { error: "Application no encontrada" });
        return true;
      }
      sendJson(res, 200, application);
      return true;
    }

    if (method === "PATCH") {
      try {
        const body = JSON.parse(await readBody(req)) as TrackerApplicationPatch;
        const result = await patchApplication(id, body, source);
        if (!result) {
          sendJson(res, 404, { error: "Application no encontrada" });
          return true;
        }
        sendJson(res, 200, result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "JSON inválido";
        sendJson(res, 400, { error: message });
      }
      return true;
    }
  }

  sendJson(res, 404, { error: "Tracker API route not found" });
  return true;
}
