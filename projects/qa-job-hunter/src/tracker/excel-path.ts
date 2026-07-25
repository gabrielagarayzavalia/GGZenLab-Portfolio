import fs from "fs";
import path from "path";

/** Ruta canónica Empleos_Tracker.xlsx (Desktop / EXCEL_DESKTOP_DIR). Solo lectura en MVP. */
export function resolveExcelDesktopPath(): string {
  if (process.env.EXCEL_DESKTOP_DIR) {
    return path.join(path.resolve(process.env.EXCEL_DESKTOP_DIR), "Empleos_Tracker.xlsx");
  }
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  return path.join(home, "OneDrive", "Escritorio", "Empleos_Tracker.xlsx");
}

export function assertExcelReadable(xlsxPath = resolveExcelDesktopPath()): string {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `No se encontró Excel en: ${xlsxPath}\n` +
        "Definí EXCEL_DESKTOP_DIR o copiá Empleos_Tracker.xlsx al Escritorio."
    );
  }
  return xlsxPath;
}
