// Detección de Easy Apply / Applied en la UI de LinkedIn (idioma base: inglés).

import type { Page } from "playwright";

const APPLIED_RE =
  /Applied|Application submitted|You applied|Already applied|Application sent|Solicitud enviada|Ya postulaste|Postulad[oa]|Aplicaste/i;

/** ¿La página indica que ya se aplicó? (EN prioritario + ES). */
export async function detectAlreadyApplied(page: Page): Promise<boolean> {
  const body = await page.locator("body").innerText().catch(() => "");
  if (APPLIED_RE.test(body.slice(0, 8000))) return true;

  const badge = page.getByText(/^(Applied|Application submitted|Ya postulaste|Solicitud enviada)$/i).first();
  return badge.isVisible({ timeout: 1200 }).catch(() => false);
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
  // Prefer role locators (EN).
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
