import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import ExcelJS from "exceljs";
import { buildApplicationsXlsxBuffer, EMPLEOS_HEADERS } from "../../src/tracker/export-xlsx.js";
import { FIXTURE_TEMPLATE } from "../../src/tracker/excel-template-path.js";
import { readEmpleosFromXlsx } from "../../src/tracker/import-xlsx.js";
import type { TrackerApplication } from "../../src/types/tracker-application.js";
import { COL } from "../../../qa-job-applied-list/scripts/excel/internal.js";

const SAMPLE: TrackerApplication[] = [
  {
    id: "abc123",
    jobId: "4439380038",
    gmailId: "msg-1",
    cvType: "QA",
    applyType: "easy_apply",
    matchPercent: 82,
    puesto: "QA Engineer",
    empresa: "Acme",
    linkedinUrl: "https://www.linkedin.com/jobs/view/4439380038/",
    canal: "Easy Apply",
    estado: "Pendiente",
    fechaAplicacion: "2026-01-15",
    portalExterno: "—",
    proximoPaso: "Revisar",
    notas: "Bot hint",
    misComentarios: "Mi nota",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

async function loadExportedWorkbook(applications = SAMPLE): Promise<ExcelJS.Workbook> {
  const buffer = await buildApplicationsXlsxBuffer(applications);
  assert.ok(buffer.length > 0);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

test("fixture template existe y tiene hojas canónicas", () => {
  assert.ok(fs.existsSync(FIXTURE_TEMPLATE), `falta fixture: ${FIXTURE_TEMPLATE}`);
});

test("buildApplicationsXlsxBuffer usa template: headers y hojas vs fixture", async () => {
  const fixtureWb = new ExcelJS.Workbook();
  await fixtureWb.xlsx.readFile(FIXTURE_TEMPLATE);
  const fixtureWs = fixtureWb.getWorksheet("Empleos");
  assert.ok(fixtureWs, "fixture sin hoja Empleos");

  const exported = await loadExportedWorkbook();
  const ws = exported.getWorksheet("Empleos");
  assert.ok(ws);

  for (let c = 1; c <= EMPLEOS_HEADERS.length; c++) {
    const fixtureHeader = fixtureWs!.getRow(1).getCell(c).text;
    const expected = fixtureHeader || EMPLEOS_HEADERS[c - 1];
    assert.equal(ws!.getRow(1).getCell(c).text, expected, `header col ${c}`);
    assert.equal(ws!.getRow(1).getCell(c).text, EMPLEOS_HEADERS[c - 1]);
  }

  assert.ok(exported.getWorksheet("meta"), "export debe incluir hoja meta");
  assert.ok(exported.getWorksheet("Leyenda"), "export debe incluir hoja Leyenda");

  const fixtureSheets = fixtureWb.worksheets.map((s) => s.name);
  const exportSheets = exported.worksheets.map((s) => s.name);
  for (const name of ["Empleos", "Leyenda"]) {
    assert.ok(fixtureSheets.includes(name), `fixture debe tener ${name}`);
    assert.ok(exportSheets.includes(name), `export debe tener ${name}`);
  }
  assert.ok(exportSheets.includes("meta"), "export debe crear hoja meta");
});

test("buildApplicationsXlsxBuffer escribe fila de datos en columnas COL", async () => {
  const wb = await loadExportedWorkbook();
  const ws = wb.getWorksheet("Empleos")!;
  const row = ws.getRow(2);

  assert.equal(row.getCell(COL.Match).text, "82%");
  assert.equal(row.getCell(COL.Puesto).text, "QA Engineer");
  assert.equal(row.getCell(COL.Empresa).text, "Acme");
  assert.match(row.getCell(COL.LinkedIn).text, /4439380038/);
  assert.equal(row.getCell(COL.Canal).text, "Easy Apply");
  assert.equal(row.getCell(COL.Estado).text, "Pendiente");
  assert.equal(row.getCell(COL.FechaAplicacion).text, "2026-01-15");
  assert.equal(row.getCell(COL.ProximoPaso).text, "Revisar");
  assert.equal(row.getCell(COL.Notas).text, "Bot hint");
  assert.equal(row.getCell(COL.MisComentarios).text, "Mi nota");
});

test("REG-V1-43 roundtrip export → import reconoce datos", async () => {
  const buffer = await buildApplicationsXlsxBuffer(SAMPLE);
  const tmp = path.join(os.tmpdir(), `empleos-export-roundtrip-${Date.now()}.xlsx`);
  fs.writeFileSync(tmp, buffer);
  try {
    const imported = await readEmpleosFromXlsx(tmp);
    assert.equal(imported.length, 1);
    const row = imported[0];
    assert.equal(row.matchPercent, 82);
    assert.equal(row.puesto, "QA Engineer");
    assert.equal(row.empresa, "Acme");
    assert.equal(row.estado, "Pendiente");
    assert.equal(row.canal, "Easy Apply");
    assert.equal(row.proximoPaso, "Revisar");
    assert.equal(row.notas, "Bot hint");
    assert.equal(row.misComentarios, "Mi nota");
    assert.equal(row.jobId, "4439380038");
  } finally {
    fs.unlinkSync(tmp);
  }
});

test("export vacío conserva estructura canónica (solo header)", async () => {
  const wb = await loadExportedWorkbook([]);
  const ws = wb.getWorksheet("Empleos")!;
  assert.equal(ws.getRow(1).getCell(COL.Match).text, "Match");
  assert.equal(ws.getRow(2).getCell(COL.Puesto).text, "");
});
