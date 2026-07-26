/** Flags Excel legacy (B-38-3). Default: tracker web canónico, Excel oculto. */

function envTruthy(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Abrir Excel mid-campaña (paso excel). Default off. */
export function isDesktopExcelEnabled(): boolean {
  return envTruthy("OPEN_DESKTOP_EXCEL");
}

/** Abrir Excel al cierre productivo / reconcile. Default off. */
export function isExcelOpenAtEndEnabled(): boolean {
  return envTruthy("OPEN_EXCEL");
}

export const TRACKER_WEB_URL =
  process.env.TRACKER_WEB_URL ?? `http://localhost:${process.env.DASHBOARD_PORT ?? 3847}/tracker`;
