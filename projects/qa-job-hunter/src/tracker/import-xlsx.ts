import ExcelJS from "exceljs";
import type { TrackerApplication, TrackerEstado } from "../types/tracker-application.js";
import { normalizeTrackerEstado } from "./estado-policy.js";
import { extractJobId, normalizeLinkedInUrl } from "./linkedin-url.js";

const HEADER_MAP: Record<string, keyof TrackerApplication | "match"> = {
  match: "match",
  "% match": "match",
  puesto: "puesto",
  empresa: "empresa",
  linkedin: "linkedinUrl",
  canal: "canal",
  estado: "estado",
  "fecha aplicación": "fechaAplicacion",
  "fecha aplicacion": "fechaAplicacion",
  "portal externo": "portalExterno",
  "próximo paso": "proximoPaso",
  "proximo paso": "proximoPaso",
  notas: "notas",
  "mis comentarios": "misComentarios",
};

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as ExcelJS.CellHyperlinkValue & { richText?: { text: string }[] };
    if (o.hyperlink) return String(o.hyperlink);
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
  }
  return String(v);
}

function parseMatchPercent(raw: string): number {
  const n = parseInt(String(raw).replace("%", "").trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export interface ImportXlsxRow {
  matchPercent: number;
  puesto: string;
  empresa: string;
  linkedinUrl: string;
  canal: string;
  estado: TrackerEstado;
  fechaAplicacion?: string;
  portalExterno?: string;
  proximoPaso?: string;
  notas?: string;
  misComentarios?: string;
  jobId?: string;
}

/** Lee hoja Empleos de un .xlsx (sin escribir ni tocar Desktop). */
export async function readEmpleosFromXlsx(xlsxPath: string): Promise<ImportXlsxRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet("Empleos") ?? wb.worksheets[0];
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, col) => {
    const key = cellText(cell).trim().toLowerCase();
    const field = HEADER_MAP[key];
    if (field) colIndex[field] = col;
  });

  const rows: ImportXlsxRow[] = [];
  const now = new Date().toISOString();

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;

    const get = (field: string): string => {
      const col = colIndex[field];
      if (!col) return "";
      const v = row.getCell(col).value;
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return cellText(row.getCell(col)).trim();
    };

    const linkedinUrl = get("linkedinUrl");
    const puesto = get("puesto");
    const empresa = get("empresa");
    if (!puesto && !empresa && !linkedinUrl) return;

    const matchRaw = colIndex.match != null ? cellText(row.getCell(colIndex.match)) : "";
    const estadoRaw = get("estado") || "Pendiente";
    const estado = normalizeTrackerEstado(estadoRaw) ?? "Pendiente";

    rows.push({
      matchPercent: parseMatchPercent(matchRaw),
      puesto,
      empresa,
      linkedinUrl,
      canal: get("canal") || "—",
      estado,
      fechaAplicacion: get("fechaAplicacion") || undefined,
      portalExterno: get("portalExterno") || undefined,
      proximoPaso: get("proximoPaso") || undefined,
      notas: get("notas") || undefined,
      misComentarios: get("misComentarios") || undefined,
      jobId: extractJobId(linkedinUrl),
    });
  });

  void now;
  return rows;
}

export function importRowToApplicationInput(
  row: ImportXlsxRow
): Omit<TrackerApplication, "id" | "createdAt" | "updatedAt"> {
  const linkedinUrl = row.linkedinUrl && row.linkedinUrl !== "—" ? row.linkedinUrl : "";
  return {
    jobId: row.jobId ?? extractJobId(linkedinUrl),
    matchPercent: row.matchPercent,
    puesto: row.puesto,
    empresa: row.empresa,
    linkedinUrl,
    canal: row.canal,
    estado: row.estado,
    fechaAplicacion: row.fechaAplicacion,
    portalExterno: row.portalExterno,
    proximoPaso: row.proximoPaso,
    notas: row.notas,
    misComentarios: row.misComentarios,
    updatedBy: "import",
  };
}

export function dedupeKeyForRow(row: ImportXlsxRow): string {
  const norm = normalizeLinkedInUrl(row.linkedinUrl);
  if (norm) return `url:${norm}`;
  return `pe:${row.puesto.trim().toLowerCase()}|${row.empresa.trim().toLowerCase()}`;
}
