/**
 * LinkedIn / Playwright: headless por defecto.
 * Ventana visible: `--headed` o `PLAYWRIGHT_HEADED=1` (login 2FA, debug).
 */
export function resolvePlaywrightHeadless(): boolean {
  if (process.argv.includes("--headed")) return false;

  const headed = (process.env.PLAYWRIGHT_HEADED ?? "").trim().toLowerCase();
  if (headed === "1" || headed === "true" || headed === "yes") return false;

  const raw = (process.env.PLAYWRIGHT_HEADLESS ?? process.env.EA_HEADLESS ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;

  return true;
}
