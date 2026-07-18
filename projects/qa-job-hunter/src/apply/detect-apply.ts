// Detección de Easy Apply / Applied / aviso cerrado en LinkedIn (idioma base: inglés).

import type { Locator, Page } from "playwright";

/** Ya postulada (EN prioritario + ES). Incluye "Application submitted". */
const APPLIED_RE =
  /\bApplied\b|Application submitted|You applied|Already applied|Application sent|Solicitud enviada|Ya postulaste|\bPostulad[oa]\b|\bAplicaste\b/i;

/**
 * Aviso cerrado / ya no acepta / no disponible.
 * → Excel: cerrada
 */
const CLOSED_RE =
  /no longer accepting applications|no longer accepting applications?|job is no longer available|this job is closed|position has been filled|not accepting applications|ya no acepta postulaciones|ya no acepta solicitudes|esta oferta (ya )?no est[aá] disponible|aviso cerrado|puesto cubierto|oferta cerrada|this posting is no longer|has expired/i;

export type PageApplySignal = "applied" | "closed" | "unknown";

/** Top card del aviso (no el feed de similares). */
function topCard(page: Page): Locator {
  return page
    .locator(
      [
        ".jobs-unified-top-card",
        ".job-details-jobs-unified-top-card",
        ".jobs-details-top-card",
        "div.job-view-layout .jobs-unified-top-card",
      ].join(", ")
    )
    .first();
}

async function detailsText(page: Page): Promise<string> {
  const card = topCard(page);
  if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
    return (await card.innerText().catch(() => "")).slice(0, 6000);
  }
  const main = page.locator("main").first();
  if (await main.isVisible({ timeout: 1000 }).catch(() => false)) {
    return (await main.innerText().catch(() => "")).slice(0, 4000);
  }
  return "";
}

export async function detectAlreadyApplied(page: Page): Promise<boolean> {
  const text = await detailsText(page);
  if (APPLIED_RE.test(text)) return true;
  const card = topCard(page);
  const badge = card
    .getByText(/Application submitted|\bApplied\b|Ya postulaste|Solicitud enviada|Application sent/i)
    .first();
  return badge.isVisible({ timeout: 800 }).catch(() => false);
}

export async function detectJobClosed(page: Page): Promise<boolean> {
  const text = await detailsText(page);
  if (CLOSED_RE.test(text)) return true;
  const card = topCard(page);
  const banner = card
    .getByText(
      /no longer accepting|no longer available|job is closed|ya no acepta|no est[aá] disponible|puesto cubierto/i
    )
    .first();
  return banner.isVisible({ timeout: 800 }).catch(() => false);
}

export async function detectPageApplySignal(page: Page): Promise<PageApplySignal> {
  if (await detectAlreadyApplied(page)) return "applied";
  if (await detectJobClosed(page)) return "closed";
  return "unknown";
}

/**
 * Solo el Easy Apply del aviso actual (botón top-card).
 * Evita links de "similar jobs" que navegan a search-results.
 */
export function easyApplyCandidates(page: Page): Locator[] {
  const card = topCard(page);
  const main = page.locator("main").first();
  return [
    // Botón real del top card (como en tu captura)
    card.locator("button.jobs-apply-button"),
    card.getByRole("button", { name: /Easy Apply/i }),
    card.locator("button:has-text('Easy Apply')"),
    card.locator('[class*="jobs-apply-button"]'),
    // Link legacy con nombre explícito del aviso actual (no similares)
    card.getByRole("link", { name: /Easy Apply to this job/i }),
    // Fallbacks: botón en main (UI nueva puede no usar .jobs-unified-top-card)
    page.locator("button.jobs-apply-button--top-card"),
    page.locator(".jobs-unified-top-card button.jobs-apply-button"),
    main.getByRole("button", { name: /^Easy Apply$/i }),
    main.locator("button:has-text('Easy Apply')").first(),
    page.getByRole("button", { name: /^Easy Apply$/i }),
  ];
}

async function isSafeEasyApply(el: Locator): Promise<boolean> {
  if (!(await el.isVisible({ timeout: 300 }).catch(() => false))) return false;
  const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => "");
  if (tag === "a") {
    const href = (await el.getAttribute("href").catch(() => "")) ?? "";
    // Links a search/similares NO son el Easy Apply del aviso
    if (/search-results|similar|JobSearchOrigin/i.test(href)) return false;
  }
  return true;
}

export async function findEasyApplyControl(
  page: Page,
  timeoutMs = 10000
): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 1000));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.isClosed()) return false;
    for (const loc of easyApplyCandidates(page)) {
      if (await isSafeEasyApply(loc.first())) return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function clickEasyApply(page: Page): Promise<boolean> {
  for (const loc of easyApplyCandidates(page)) {
    const el = loc.first();
    if (!(await isSafeEasyApply(el))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click({ timeout: 5000 });
    // Si navegó a search, no era el botón correcto
    await new Promise((r) => setTimeout(r, 800));
    if (/search-results/i.test(page.url())) {
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      continue;
    }
    return true;
  }
  return false;
}
