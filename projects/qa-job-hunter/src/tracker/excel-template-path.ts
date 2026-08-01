import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ORIGINAL_TEMPLATE } from "../../../qa-job-applied-list/scripts/excel/internal.js";
import { resolveExcelDesktopPath } from "./excel-path.js";

const HUNTER_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/** Template canónico versionado para tests/CI (#391). */
export const FIXTURE_TEMPLATE = path.join(
  HUNTER_ROOT,
  "tests/fixtures/Empleos_Tracker-template.xlsx"
);

/** Resuelve template Empleos_Tracker (fixture → original → Desktop). */
export function resolveEmpleosTrackerTemplatePath(): string {
  if (process.env.EMPLEOS_TRACKER_TEMPLATE) {
    const custom = path.resolve(process.env.EMPLEOS_TRACKER_TEMPLATE);
    if (fs.existsSync(custom)) return custom;
    throw new Error(`EMPLEOS_TRACKER_TEMPLATE no existe: ${custom}`);
  }
  if (fs.existsSync(FIXTURE_TEMPLATE)) return FIXTURE_TEMPLATE;
  if (fs.existsSync(ORIGINAL_TEMPLATE)) return ORIGINAL_TEMPLATE;
  const desktop = resolveExcelDesktopPath();
  if (fs.existsSync(desktop)) return desktop;
  throw new Error(
    "No se encontró template Empleos_Tracker. " +
      "Definí EMPLEOS_TRACKER_TEMPLATE o copiá Empleos_Tracker-original.xlsx a tests/fixtures."
  );
}
