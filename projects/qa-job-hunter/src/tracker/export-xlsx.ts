import ExcelJS from "exceljs";
import type { TrackerApplication } from "../types/tracker-application.js";
import { listApplications } from "../db/applications.js";

const HEADERS = [
  "Match",
  "Puesto",
  "Empresa",
  "LinkedIn",
  "Canal",
  "Estado",
  "Fecha aplicación",
  "Portal externo",
  "Próximo paso",
  "Notas",
  "Mis comentarios",
] as const;

function rowFromApplication(app: TrackerApplication): (string | number)[] {
  return [
    app.matchPercent,
    app.puesto,
    app.empresa,
    app.linkedinUrl,
    app.canal,
    app.estado,
    app.fechaAplicacion ?? "",
    app.portalExterno ?? "",
    app.proximoPaso ?? "",
    app.notas ?? "",
    app.misComentarios ?? "",
  ];
}

/** Genera .xlsx compatible con hoja Empleos (backup / transición B-38-7). */
export async function buildApplicationsXlsxBuffer(
  applications?: TrackerApplication[]
): Promise<Buffer> {
  const rows = applications ?? (await listApplications({ limit: 10000 }));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Empleos");
  ws.addRow([...HEADERS]);
  for (const app of rows) {
    ws.addRow(rowFromApplication(app));
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
