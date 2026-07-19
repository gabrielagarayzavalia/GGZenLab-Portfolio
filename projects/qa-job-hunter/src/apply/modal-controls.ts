// Controles del modal Easy Apply: LinkedIn a veces usa <a> en vez de <button>.
// UI nueva (SDUI /apply/) puede no usar role=dialog.

import type { Locator, Page } from "playwright";

type Scope = Page | Locator;

export const MODAL_LABELS = {
  submit: /Submit application|Enviar solicitud/i,
  /**
   * Aparece cuando ya no hay Next/Continue; antes de Submit.
   * A veces solo "Review", a veces "Review your application".
   */
  review: /^Review$|Review your application|Revisar( solicitud)?/i,
  continue: /Continue to next step|Continuar|Siguiente/i,
  /** Solo dentro de dialog — "Next" suelto choca con el carrusel. */
  next: /^(Next|Siguiente)$/i,
  done: /^Done$|^Listo$/i,
  dismiss: /^(Dismiss|Cerrar|Close)$/i,
  /** Modal al salir con campos incompletos — NO avanzar; descartar. */
  discard: /^Discard$|Discard changes|Descartar/i,
  saveDraft: /^Save$|Save for later|Guardar/i,
} as const;

/** Contenedores conocidos del flujo Easy Apply (modal clásico + SDUI). */
export function easyApplyModalRoot(page: Page): Locator {
  return page
    .locator(
      [
        ".jobs-easy-apply-modal",
        "[data-test-modal]",
        "[role='dialog']",
        ".jobs-easy-apply-content",
        "div[class*='jobs-easy-apply']",
        "div[class*='EasyApply']",
      ].join(", ")
    )
    .first();
}

export function isOnApplyUrl(page: Page): boolean {
  return /\/jobs\/view\/\d+\/apply/i.test(page.url());
}

/**
 * Scope donde viven Next/Submit: dialog/modal, o la página entera si es /apply/ (SDUI).
 */
export async function resolveApplyScope(
  page: Page,
  timeoutMs = 10000
): Promise<Scope | null> {
  const root = easyApplyModalRoot(page);
  if (await root.isVisible({ timeout: timeoutMs }).catch(() => false)) {
    return root;
  }

  // Flujo SDUI: URL …/apply/ o controles de apply visibles en page
  const deadline = Date.now() + Math.min(4000, timeoutMs);
  while (Date.now() < deadline) {
    if (isOnApplyUrl(page)) {
      if (
        (await findButtonOrLink(page, MODAL_LABELS.submit, 400)) ||
        (await findButtonOrLink(page, MODAL_LABELS.continue, 400)) ||
        (await findButtonOrLink(page, MODAL_LABELS.review, 400)) ||
        (await findButtonOrLink(page, MODAL_LABELS.next, 300))
      ) {
        return page;
      }
    }
    if (
      (await findButtonOrLink(page, MODAL_LABELS.submit, 300)) ||
      (await findButtonOrLink(page, MODAL_LABELS.continue, 300))
    ) {
      return page;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

/** Cierra typeahead solo si está abierto. NO Escape a ciegas (rompe Location GEO). */
export async function dismissModalOverlays(page: Page): Promise<void> {
  const hit = page
    .locator(
      "[data-test-single-typeahead-entity-form-search-result], .basic-typeahead__selectable, [role='listbox'] [role='option']"
    )
    .first();
  if (!(await hit.isVisible({ timeout: 250 }).catch(() => false))) return;
  await page.keyboard.press("Escape").catch(() => {});
  await new Promise((r) => setTimeout(r, 250));
}

/** Primer control visible: data-* LinkedIn, button, o link. */
export async function findButtonOrLink(
  scope: Scope,
  name: string | RegExp,
  timeoutMs = 800
): Promise<Locator | null> {
  // Atributos estables del modal Easy Apply
  if (name === MODAL_LABELS.continue || name === MODAL_LABELS.next) {
    const nextData = scope
      .locator(
        "button[data-easy-apply-next-button], button[data-live-test-easy-apply-next-button], [data-easy-apply-next-button]"
      )
      .first();
    if (await nextData.isVisible({ timeout: Math.min(timeoutMs, 600) }).catch(() => false)) {
      return nextData;
    }
  }
  if (name === MODAL_LABELS.submit) {
    const submitData = scope
      .locator(
        "button[data-live-test-easy-apply-submit-button], button[aria-label*='Submit application'], button[aria-label*='Enviar solicitud']"
      )
      .first();
    if (await submitData.isVisible({ timeout: Math.min(timeoutMs, 600) }).catch(() => false)) {
      return submitData;
    }
  }

  const button = scope.getByRole("button", { name }).first();
  if (await button.isVisible({ timeout: timeoutMs }).catch(() => false)) {
    return button;
  }
  const link = scope.getByRole("link", { name }).first();
  if (await link.isVisible({ timeout: Math.min(timeoutMs, 600) }).catch(() => false)) {
    return link;
  }
  return null;
}

export async function clickButtonOrLink(
  scope: Scope,
  name: string | RegExp,
  timeoutMs = 800,
  pageForEscape?: Page
): Promise<boolean> {
  const el = await findButtonOrLink(scope, name, timeoutMs);
  if (!el) return false;

  const page =
    pageForEscape ??
    ("keyboard" in scope ? (scope as Page) : undefined);
  if (page) await dismissModalOverlays(page);

  await el.scrollIntoViewIfNeeded().catch(() => {});
  if (await el.click({ timeout: 4000 }).then(() => true).catch(() => false)) {
    return true;
  }
  // Typeahead u overlay intercepta → force
  return el.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false);
}

/**
 * Fallback CSS: aria-label / texto en button o <a> (scoped al dialog si se pasa).
 */
export function cssPrimaryActions(scope: Scope): Locator {
  return scope
    .locator(
      [
        "button[aria-label*='Continue']",
        "button[aria-label*='Continuar']",
        "button[aria-label*='Next']",
        "button[aria-label*='Review']",
        "button[aria-label*='Submit']",
        "button[aria-label*='Enviar']",
        "a[aria-label*='Continue']",
        "a[aria-label*='Continuar']",
        "a[aria-label*='Next']",
        "a[aria-label*='Review']",
        "a[aria-label*='Submit']",
        "a[aria-label*='Enviar']",
        "button.artdeco-button--primary",
        "a.artdeco-button--primary",
      ].join(", ")
    )
    .first();
}
