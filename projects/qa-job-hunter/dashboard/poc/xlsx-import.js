import { EXCEL_HEADER_MAP, parseMatchPercent } from "./sample-data.js";

/**
 * Importa hoja "Empleos" de un .xlsx (File) → filas para grilla PoC.
 * Usa SheetJS (XLSX) vía CDN global.
 */
export async function importEmpleosXlsx(file) {
  if (!window.XLSX) throw new Error("SheetJS (XLSX) no cargado");
  const buf = await file.arrayBuffer();
  const wb = window.XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.includes("Empleos") ? "Empleos" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!matrix.length) return [];

  const headerRow = matrix[0].map((h) => String(h ?? "").trim().toLowerCase());
  const colIndex = {};
  headerRow.forEach((h, i) => {
    const field = EXCEL_HEADER_MAP[h];
    if (field) colIndex[field] = i;
  });

  const rows = [];
  for (let r = 1; r < matrix.length; r++) {
    const raw = matrix[r];
    if (!raw || raw.every((c) => c === "" || c == null)) continue;

    const get = (field) => {
      const idx = colIndex[field];
      if (idx == null) return "";
      const v = raw[idx];
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v ?? "").trim();
    };

    const linkedinUrl = get("linkedinUrl");
    const puesto = get("puesto");
    const empresa = get("empresa");
    if (!puesto && !empresa && !linkedinUrl) continue;

    const jobIdMatch = linkedinUrl.match(/(\d{8,})/);
    rows.push({
      id: jobIdMatch ? jobIdMatch[1] : `row-${r}`,
      matchPercent: parseMatchPercent(get("matchPercent") || raw[colIndex.matchPercent ?? 0]),
      puesto,
      empresa,
      linkedinUrl,
      canal: get("canal") || "—",
      estado: get("estado") || "Pendiente",
      fechaAplicacion: get("fechaAplicacion"),
      portalExterno: get("portalExterno"),
      proximoPaso: get("proximoPaso"),
      notas: get("notas"),
      misComentarios: get("misComentarios"),
    });
  }
  return rows;
}
