// Detección de Easy Apply / Applied / aviso cerrado en LinkedIn (idioma base: inglés).

import type { Page } from "playwright";

/** Ya postulada (EN prioritario + ES). Incluye "Application submitted". */
const APPLIED_RE =
  /Applied|Application submitted|You applied|Already applied|Application sent|Solicitud enviada|Ya postulaste|Postulad[oa]|Aplicaste/i;

/**
 * Aviso cerrado / ya no acepta / no disponible.
 * → Excel: cerrada
 */
const CLOSED_RE =
  /no longer accepting applications|no longer accepting|job is no longer available|this job is closed|position has been filled|no longer available|not accepting applications|ya no acepta postulaciones|ya no acepta solicitudes|esta oferta (ya )?no est[aá] disponible|aviso cerrado|puesto cubierto|oferta cerrada|this posting is no longer|has expired/i;

export type PageApplySignal = "applied" | "closed" | "unknown";

async function pageSnippet(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).slice(0, 10000);
}

/** ¿La página indica que ya se aplicó? (Applied / Application submitted / …). */
export async function detectAlreadyApplied(page: Page): Promise<boolean> {
  const body = await pageSnippet(page);
  if (APPLIED_RE.test(body)) return true;

  const badge = page
    .getByText(/Application submitted|Applied|Ya postulaste|Solicitud enviada|Application sent/i)
    .first();
  return badge.isVisible({ timeout: 1200 }).catch(() => false);
}

/** ¿La empresa ya no recibe postulaciones / aviso inexistente? */
export async function detectJobClosed(page: Page): Promise<boolean> {
  const body = await pageSnippet(page);
  if (CLOSED_RE.test(body)) return true;

  const banner = page
    .getByText(
      /no longer accepting|no longer available|job is closed|ya no acepta|no est[aá] disponible|puesto cubierto/i
    )
    .first();
  return banner.isVisible({ timeout: 1200 }).catch(() => false);
}

/**
 * Señal combinada: applied tiene prioridad sobre closed
 * (si ya aplicaste, aunque el aviso cierre después).
 */
export async function detectPageApplySignal(page: Page): Promise<PageApplySignal> {
  if (await detectAlreadyApplied(page)) return "applied";
  if (await detectJobClosed(page)) return "closed";
  return "unknown";
}

/** Localiza el control Easy Apply (link o button; EN primero). */
export function easyApplyLocator(page: Page) {
  return page
    .locator(
      [
        "a:has-text('Easy Apply')",
        "button:has-text('Easy Apply')",
        "button[aria-label*='Easy Apply']",
        "a[aria-label*='Easy Apply']",
        "button.jobs-apply-button",
        "button[aria-label*='Solicitud sencilla']",
      ].join(", ")
    )
    .first();
}

export async function findEasyApplyControl(
  page: Page,
  timeoutMs = 5000
): Promise<boolean> {
  const byRoleLink = page.getByRole("link", { name: /Easy Apply/i }).first();
  if (await byRoleLink.isVisible({ timeout: 800 }).catch(() => false)) return true;

  const byRoleBtn = page.getByRole("button", { name: /Easy Apply/i }).first();
  if (await byRoleBtn.isVisible({ timeout: 800 }).catch(() => false)) return true;

  return easyApplyLocator(page).isVisible({ timeout: timeoutMs }).catch(() => false);
}

export async function clickEasyApply(page: Page): Promise<boolean> {
  const byRoleLink = page.getByRole("link", { name: /Easy Apply/i }).first();
  if (await byRoleLink.isVisible({ timeout: 800 }).catch(() => false)) {
    await byRoleLink.click();
    return true;
  }
  const byRoleBtn = page.getByRole("button", { name: /Easy Apply/i }).first();
  if (await byRoleBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await byRoleBtn.click();
    return true;
  }
  const loc = easyApplyLocator(page);
  if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loc.click();
    return true;
  }
  return false;
}
