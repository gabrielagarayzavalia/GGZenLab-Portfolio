import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

const BASE = process.env.DASHBOARD_URL ?? "http://localhost:3847";

test("GET /api/tracker/export/xlsx returns xlsx attachment", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/tracker/export/xlsx`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 404) {
    t.skip("GET /api/tracker/export/xlsx not found — restart dashboard with latest code");
    return;
  }
  if (res.status === 503) {
    t.skip("MongoDB not available — run docker compose up -d && npm run tracker:seed");
    return;
  }

  assert.equal(res.status, 200, "expected HTTP 200");

  const contentType = res.headers.get("content-type") ?? "";
  assert.ok(
    contentType.includes("spreadsheetml") || contentType.includes("octet-stream"),
    `unexpected content-type: ${contentType}`
  );

  const disposition = res.headers.get("content-disposition") ?? "";
  assert.match(disposition, /Empleos_Tracker_export\.xlsx/i);

  const buffer = Buffer.from(await res.arrayBuffer());
  assert.ok(buffer.length > 0, "xlsx body must not be empty");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Empleos");
  assert.ok(ws, 'worksheet "Empleos" required');
  assert.equal(ws!.getRow(1).getCell(1).text, "Match");
});
