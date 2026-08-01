/**
 * Post-proceso del workbook exportado: tabla Postulaciones, CF, Leyenda, validación Estado.
 * Alineado con saveWb de applied-list (sin dedupe/sort ni write a Desktop).
 */

import type ExcelJS from "exceljs";
import {
  COL,
  COL_LAST,
  cellText,
  colLetter,
  ensureEmpleosSchemaColumns,
  ensureEstadoValidations,
  expandConditionalFormatting,
  getEmpleos,
  lastDataRow,
} from "../../../qa-job-applied-list/scripts/excel/internal.js";

function disableTableRowStripes(ws: ExcelJS.Worksheet): void {
  const tables = ws.getTables() as unknown as { table?: { style?: { showRowStripes?: boolean } } }[];
  for (const t of tables) {
    if (t.table?.style) t.table.style.showRowStripes = false;
  }
}

/** Repara rango Tabla Postulaciones + AutoFilter (round-trip ExcelJS). */
function repairEmpleosTable(ws: ExcelJS.Worksheet): void {
  ensureEmpleosSchemaColumns(ws);
  const last = lastDataRow(ws);
  const ref = `A1:${colLetter(COL_LAST)}${last}`;

  type TableModel = {
    name?: string;
    headerRow?: boolean;
    totalsRow?: boolean;
    ref?: string;
    tableRef?: string;
    autoFilterRef?: string;
    style?: { showRowStripes?: boolean };
    columns?: { filterButton?: boolean; name?: string }[];
  };

  const tables = ws.getTables() as unknown as { name: string; table: TableModel }[];
  if (!tables.length) {
    expandConditionalFormatting(ws, last);
    ensureEstadoValidations(ws, last);
    return;
  }

  for (const t of tables) {
    const m = t.table;
    if (!m) continue;
    const name = (m.name ?? t.name ?? "").toLowerCase();
    if (tables.length > 1 && name !== "postulaciones") continue;

    m.headerRow = true;
    m.totalsRow = false;
    m.ref = ref;
    m.tableRef = ref;
    m.autoFilterRef = ref;
    if (m.style) m.style.showRowStripes = false;
    if (Array.isArray(m.columns)) {
      const hasNotas = m.columns.some((c) => /^notas$/i.test(String(c.name ?? "")));
      if (!hasNotas) m.columns.push({ name: "Notas", filterButton: true });
      const hasMis = m.columns.some((c) => /^mis comentarios$/i.test(String(c.name ?? "")));
      if (!hasMis) m.columns.push({ name: "Mis comentarios", filterButton: true });
      for (const col of m.columns) col.filterButton = true;
    }
  }

  disableTableRowStripes(ws);
  expandConditionalFormatting(ws, last);
  ensureEstadoValidations(ws, last);
}

function syncLeyenda(wb: ExcelJS.Workbook): void {
  const ley = wb.getWorksheet("Leyenda");
  if (!ley) return;

  const wanted: { estado: string; color: string; desc: string }[] = [
    { estado: "Pendiente", color: "Sin color", desc: "Sin acción tomada aún" },
    { estado: "Stand-by", color: "Azul claro", desc: "En espera / pausa (Gmail Empleo/StandBy)" },
    { estado: "Enviada", color: "Verde", desc: "Aplicación enviada (Postulaciones-en-proceso)" },
    { estado: "Borrador abierto", color: "Amarillo/Ámbar", desc: "Formulario iniciado pero no enviado" },
    { estado: "A-pendiente", color: "Naranja claro", desc: "Assessment / prueba pendiente" },
    { estado: "A-realizado", color: "Violeta claro", desc: "Assessment / prueba realizado" },
    { estado: "Cerrado", color: "Gris oscuro + tachado", desc: "No seleccionada / posición cerrada" },
    {
      estado: "Duplicado",
      color: "Azul grisáceo",
      desc: "Mismo puesto+empresa (republicación); no aplicar",
    },
    {
      estado: "Descartado",
      color: "Gris oscuro + tachado",
      desc: "Solo manual (usuaria) — el bot no escribe este estado",
    },
  ];

  const byEstado = new Map<string, number>();
  ley.eachRow((row, n) => {
    if (n === 1) return;
    byEstado.set(cellText(row.getCell(1)).trim().toLowerCase(), n);
  });

  for (const w of wanted) {
    const key = w.estado.toLowerCase();
    let n = byEstado.get(key);
    if (!n) {
      n = (ley.rowCount || 1) + 1;
      byEstado.set(key, n);
    }
    const row = ley.getRow(n);
    row.getCell(1).value = w.estado;
    row.getCell(2).value = w.color;
    row.getCell(3).value = w.desc;
  }
}

/** Aplica formato canónico post-carga de filas (export hunter). */
export function finalizeCanonicalWorkbook(wb: ExcelJS.Workbook): void {
  const ws = getEmpleos(wb);
  repairEmpleosTable(ws);
  syncLeyenda(wb);
}
