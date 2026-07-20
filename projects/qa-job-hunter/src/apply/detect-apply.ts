// Detección de Easy Apply / Applied / aviso cerrado en LinkedIn (idioma base: inglés).

import type { Locator, Page } from "playwright";
import { resolveApplyScope } from "./modal-controls.js";

/** Ya postulada (EN prioritario + ES). Incluye "Application submitted". */
const APPLIED_RE =
  /\bApplied\b|Application submitted|You applied|Already applied|Application sent|Solicitud enviada|Ya postulaste|\bPostulad[oa]\b|\bAplicaste\b/i;

/**
 * Aviso cerrado / ya no acepta / no disponible.
 * → Excel: cerrada
 */
const CLOSED_RE =
  /no longer accepting applications|no longer accepting applications?|job is no longer available|this job is closed|position has been filled|not accepting applications|applications?\s+are\s+closed|ya no acepta postulaciones|ya no acepta solicitudes|esta oferta (ya )?no est[aá] disponible|aviso cerrado|puesto cubierto|oferta cerrada|this posting is no longer|has expired/i;

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

/** Confirmado en codegen: NO es button — es link con este accessible name. */
export const EASY_APPLY_LINK_NAME = "Easy Apply to this job";

/** Selector primario (misma línea que codegen). */
export function primaryEasyApplyLink(page: Page): Locator {
  return page.getByRole("link", { name: EASY_APPLY_LINK_NAME });
}

/**
 * Easy Apply del aviso actual.
 * Primario: link "Easy Apply to this job" (grabación real).
 * Fallbacks: otros links/botones; filtra search-results.
 */
export function easyApplyCandidates(page: Page): Locator[] {
  const card = topCard(page);
  const main = page.locator("main").first();
  return [
    primaryEasyApplyLink(page),
    page.getByRole("link", { name: /Easy Apply to this job/i }),
    page.getByRole("link", { name: /^Easy Apply$/i }),
    main.getByRole("link", { name: /Easy Apply/i }),
    card.getByRole("link", { name: /Easy Apply/i }),
    // Fallbacks legacy (algunas UIs aún usan button)
    card.locator("button.jobs-apply-button"),
    card.getByRole("button", { name: /Easy Apply/i }),
    page.locator("button.jobs-apply-button--top-card"),
    page.getByRole("button", { name: /Easy Apply/i }),
    page.locator("[aria-label*='Easy Apply']").first(),
  ];
}

async function isSafeEasyApply(el: Locator): Promise<boolean> {
  if (!(await el.isVisible({ timeout: 500 }).catch(() => false))) return false;
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
  timeoutMs = 15000
): Promise<boolean> {
  // Primario: waitFor explícito (más fiable que poll corto)
  const primary = primaryEasyApplyLink(page).first();
  if (
    await primary
      .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 12000) })
      .then(() => true)
      .catch(() => false)
  ) {
    return true;
  }

  const deadline = Date.now() + Math.max(2000, timeoutMs - 12000);
  while (Date.now() < deadline) {
    if (page.isClosed()) return false;
    for (const loc of easyApplyCandidates(page)) {
      if (await isSafeEasyApply(loc.first())) return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function applyFlowOpened(page: Page): Promise<boolean> {
  return Boolean(await resolveApplyScope(page, 2500));
}

/** Click robusto: overlay intercepta click; si no abre flujo, goto /apply/. */
async function clickEasyApplyElement(page: Page, el: Locator): Promise<boolean> {
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const href = (await el.getAttribute("href").catch(() => "")) ?? "";

  const tryClick = (force: boolean) =>
    el.click({ timeout: 5000, force }).then(() => true).catch(() => false);

  if ((await tryClick(false)) || (await tryClick(true))) {
    await new Promise((r) => setTimeout(r, 1500));
    if (/search-results/i.test(page.url())) {
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    } else if (await applyFlowOpened(page)) {
      return true;
    }
    // Click “ok” pero no abrió modal → seguir a href
  }

  const applyHref = /\/apply\//i.test(href)
    ? href.startsWith("http")
      ? href
      : new URL(href, page.url()).href
    : (() => {
        const m = page.url().match(/\/jobs\/view\/(\d+)/);
        return m
          ? `https://www.linkedin.com/jobs/view/${m[1]}/apply/?openSDUIApplyFlow=true`
          : "";
      })();

  if (applyHref) {
    console.log(`   Fallback: navegando a ${applyHref}`);
    await page.goto(applyHref, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2000));
    if (/search-results/i.test(page.url())) return false;
    return applyFlowOpened(page);
  }

  return false;
}

export async function clickEasyApply(page: Page): Promise<boolean> {
  const primary = primaryEasyApplyLink(page).first();
  if (await isSafeEasyApply(primary)) {
    if (await clickEasyApplyElement(page, primary)) return true;
  }

  for (const loc of easyApplyCandidates(page)) {
    const el = loc.first();
    if (!(await isSafeEasyApply(el))) continue;
    if (await clickEasyApplyElement(page, el)) return true;
  }
  return false;
}
