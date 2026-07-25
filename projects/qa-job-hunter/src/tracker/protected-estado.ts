import type { TrackerEstado } from "../types/tracker-application.js";

/** Misma política que qa-job-applied-list/scripts/excel/internal.ts PROTECTED */
const PROTECTED = new Set([
  "enviada",
  "cerrado",
  "descartado",
  "duplicado",
  "stand-by",
  "standby",
  "borrador abierto",
  "a-pendiente",
  "a-realizado",
]);

export function isProtectedEstado(estado: string | TrackerEstado | undefined): boolean {
  return PROTECTED.has((estado ?? "").trim().toLowerCase());
}
