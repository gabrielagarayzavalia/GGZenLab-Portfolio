/** Headless Playwright: PLAYWRIGHT_HEADLESS o EA_HEADLESS = 1|true|yes */
export function resolvePlaywrightHeadless(defaultHeadless = false): boolean {
  const raw = (process.env.PLAYWRIGHT_HEADLESS ?? process.env.EA_HEADLESS ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return defaultHeadless;
}
