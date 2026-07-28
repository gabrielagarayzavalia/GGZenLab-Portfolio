import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildApplicationsXlsxBuffer } from "../../src/tracker/export-xlsx.js";
import type { TrackerApplication } from "../../src/types/tracker-application.js";

const SAMPLE: TrackerApplication[] = [
  {
    id: "abc123",
    matchPercent: 82,
    puesto: "QA Engineer",
    empresa: "Acme",
    linkedinUrl: "https://www.linkedin.com/jobs/view/1/",
    canal: "Easy Apply",
    estado: "Pendiente",
    proximoPaso: "Revisar",
    notas: "Bot hint",
    misComentarios: "Mi nota",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

test("buildApplicationsXlsxBuffer genera hoja Empleos con headers", async () => {
  const buffer = await buildApplicationsXlsxBuffer(SAMPLE);
  assert.ok(buffer.length > 0);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet("Empleos");
  assert.ok(ws);
  assert.equal(ws!.getRow(1).getCell(1).text, "Match");
  assert.equal(ws!.getRow(2).getCell(2).text, "QA Engineer");
  assert.equal(ws!.getRow(2).getCell(6).text, "Pendiente");
  assert.equal(ws!.getRow(2).getCell(11).text, "Mi nota");
});
