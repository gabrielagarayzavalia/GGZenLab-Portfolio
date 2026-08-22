import ExcelJS from "exceljs";
import type { TrackerApplication } from "../types/tracker-application.js";
import { listApplications } from "../db/applications.js";
import { extractJobId } from "./linkedin-url.js";
import { resolveEmpleosTrackerTemplatePath } from "./excel-template-path.js";
import { finalizeCanonicalWorkbook } from "./excel-canonical-finalize.js";
import {
  COL,
  COL_LAST,
  addEstadoValidation,
  copyRowStyle,
  ensureEmpleosSchemaColumns,
  ensureMeta,
  findTemplateRow,
  getEmpleos,
  lastDataRow,
  linkedInValue,
  upsertMeta,
} from "../../../qa-job-applied-list/scripts/excel/internal.js";

/** Headers canónicos (11 cols) — mismo orden que COL en applied-list. */
export const EMPLEOS_HEADERS = [
  "Match",
  "Puesto",
  "Empresa",
  "LinkedIn",
  "Canal",
  "Estado",
  "Fecha Aplicación",
  "Portal externo",
  "Próximo paso",
  "Notas",
  "Mis comentarios",
] as const;

function clearDataRows(ws: ExcelJS.Worksheet): void {
  const last = lastDataRow(ws);
  for (let r = 2; r <= last; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= COL_LAST; c++) {
      row.getCell(c).value = null;
    }
  }
}

function clearMetaRows(meta: ExcelJS.Worksheet): void {
  for (let r = 2; r <= meta.rowCount; r++) {
    const row = meta.getRow(r);
    for (let c = 1; c <= 5; c++) {
      row.getCell(c).value = null;
    }
  }
}

/** Mapping inverso de import-xlsx: TrackerApplication → fila Empleos. */
function writeApplicationRow(row: ExcelJS.Row, app: TrackerApplication): void {
  row.getCell(COL.Match).value = `${app.matchPercent}%`;
  row.getCell(COL.Puesto).value = app.puesto;
  row.getCell(COL.Empresa).value = app.empresa;
  row.getCell(COL.LinkedIn).value = linkedInValue(app.linkedinUrl || "—");
  row.getCell(COL.Canal).value = app.canal || "—";
  row.getCell(COL.Estado).value = app.estado;
  row.getCell(COL.FechaAplicacion).value = app.fechaAplicacion ?? "";
  row.getCell(COL.PortalExterno).value = app.portalExterno ?? "—";
  row.getCell(COL.ProximoPaso).value = app.proximoPaso ?? "";
  row.getCell(COL.Notas).value = app.notas ?? "";
  row.getCell(COL.MisComentarios).value = app.misComentarios ?? "";
}

/** Genera .xlsx canónico desde template Empleos_Tracker (backup / transición B-38-7 / #391). */
export async function buildApplicationsXlsxBuffer(
  applications?: TrackerApplication[]
): Promise<Buffer> {
  const rows = applications ?? (await listApplications({ limit: 10000 }));
  const templatePath = resolveEmpleosTrackerTemplatePath();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const ws = getEmpleos(wb);
  ensureEmpleosSchemaColumns(ws);
  const styleTemplate = findTemplateRow(ws);
  clearDataRows(ws);

  const meta = ensureMeta(wb);
  clearMetaRows(meta);

  let rowNum = 2;
  for (const app of rows) {
    const row = ws.getRow(rowNum);
    copyRowStyle(styleTemplate, row);
    writeApplicationRow(row, app);
    addEstadoValidation(ws, rowNum);

    const jobId = app.jobId ?? extractJobId(app.linkedinUrl) ?? app.id;
    if (jobId || app.linkedinUrl) {
      upsertMeta(meta, {
        jobId,
        gmailId: app.gmailId,
        cvType: app.cvType,
        applyType: app.applyType,
        linkedin: app.linkedinUrl,
      });
    }
    rowNum++;
  }

  finalizeCanonicalWorkbook(wb);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
