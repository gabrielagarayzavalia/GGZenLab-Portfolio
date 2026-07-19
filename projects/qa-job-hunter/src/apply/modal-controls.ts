// Controles del modal Easy Apply: LinkedIn a veces usa <a> en vez de <button>.
// UI nueva (SDUI /apply/) puede no usar role=dialog.

import type { Locator, Page } from "playwright";

type Scope = Page | Locator;

export const MODAL_LABELS = {
  /** UI EN/ES: a veces solo "Submit" / "Enviar" en el footer. */
  submit: /Submit application|^Submit$|Enviar solicitud|^Enviar$/i,
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
  // Prioridad explícita: evitar que un `[role=dialog]` del chrome gane con .first().
  return page
    .locator(".jobs-easy-apply-modal")
    .or(page.locator("[data-test-modal].jobs-easy-apply-modal"))
    .or(page.locator(".jobs-easy-apply-content"))
    .or(page.locator("div[class*='jobs-easy-apply']"))
    .or(page.locator("div[class*='EasyApply']"))
    .or(
      page.locator("[role='dialog']").filter({
        hasText:
          /Apply to|Postular|Contact info|Resume|Curr[ií]culum|Additional Questions|Preguntas|Review/i,
      })
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

/**
 * ¿El nodo es clickeable del flujo Easy Apply?
 * Modal + portales de listbox/typeahead + Save/Discard. Nunca el feed detrás.
 */
export async function isInsideEasyApplySurface(el: Locator): Promise<boolean> {
  return el
    .evaluate((node) => {
      const n = node as Element;
      if (n.closest?.(".jobs-easy-apply-modal")) return true;
      if (n.closest?.("[class*='jobs-easy-apply']")) return true;
      if (n.closest?.("[data-test-modal]")) return true;
      if (n.closest?.("[role='listbox']")) return true;
      if (n.closest?.("[role='option']")) return true;
      if (n.closest?.("[data-test-single-typeahead-entity-form-search-result]")) return true;
      if (n.closest?.(".basic-typeahead__selectable")) return true;
      if (n.closest?.(".search-typeahead-v2__hit")) return true;
      const saveDiscard = n.closest?.(".artdeco-modal, [role='dialog']");
      if (
        saveDiscard &&
        /save this application|save or discard|guardar|descartar|unsaved/i.test(
          saveDiscard.textContent || ""
        )
      ) {
        return true;
      }
      return false;
    })
    .catch(() => false);
}

/** Click solo si el objetivo está en el modal / typeahead (bloquea links del feed). */
export async function clickSafeInEasyApply(
  el: Locator,
  opts?: { force?: boolean; timeoutMs?: number }
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 4000;
  const href = ((await el.getAttribute("href").catch(() => null)) ?? "").trim();
  if (href && /\/jobs\/view\/|\/company\/|linkedin\.com\/in\/|\/jobs\/collections\//i.test(href)) {
    console.log(`   ↳ click bloqueado (link de feed/perfil): ${href.slice(0, 90)}`);
    return false;
  }
  if (href && /help\.linkedin|\/help\/|\/legal\//i.test(href)) {
    console.log(`   ↳ click bloqueado (Help/legal fuera del form)`);
    return false;
  }
  if (!(await isInsideEasyApplySurface(el))) {
    console.log("   ↳ click bloqueado: objetivo fuera del modal Easy Apply");
    return false;
  }
  await el.scrollIntoViewIfNeeded().catch(() => {});
  if (
    await el
      .click({ timeout: timeoutMs, noWaitAfter: true })
      .then(() => true)
      .catch(() => false)
  ) {
    return true;
  }
  if (opts?.force === false) return false;
  return el
    .click({ force: true, timeout: timeoutMs, noWaitAfter: true })
    .then(() => true)
    .catch(() => false);
}

function isPageScope(scope: Scope): scope is Page {
  return typeof (scope as Page).goto === "function";
}

/** Primer control visible: data-* LinkedIn, button, o link. */
export async function findButtonOrLink(
  scope: Scope,
  name: string | RegExp,
  timeoutMs = 800
): Promise<Locator | null> {
  // Si nos pasan Page, buscar PRIMERO en el modal (evita Next/links del carrusel).
  if (isPageScope(scope)) {
    const modal = easyApplyModalRoot(scope);
    if (await modal.isVisible({ timeout: 350 }).catch(() => false)) {
      const inModal = await findButtonOrLinkInScope(modal, name, timeoutMs);
      if (inModal) return inModal;
    }
  }
  return findButtonOrLinkInScope(scope, name, timeoutMs);
}

async function findButtonOrLinkInScope(
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
    const submitBare = scope
      .locator(
        "button[data-live-test-easy-apply-submit-button], button[data-easy-apply-submit-button]"
      )
      .first();
    if (await submitBare.isVisible({ timeout: Math.min(timeoutMs, 600) }).catch(() => false)) {
      return submitBare;
    }
    const submitAria = scope
      .locator(
        "button[aria-label*='Submit application'], button[aria-label*='Enviar solicitud']"
      )
      .first();
    if (await submitAria.isVisible({ timeout: Math.min(timeoutMs, 400) }).catch(() => false)) {
      return submitAria;
    }
    const submitFooter = scope
      .locator(".jobs-easy-apply-footer button.artdeco-button--primary")
      .filter({ hasText: /Submit|Enviar/i })
      .first();
    if (await submitFooter.isVisible({ timeout: Math.min(timeoutMs, 400) }).catch(() => false)) {
      return submitFooter;
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
    pageForEscape ?? (isPageScope(scope) ? scope : undefined);
  if (page) await dismissModalOverlays(page);

  return clickSafeInEasyApply(el, { timeoutMs: 4000 });
}

/**
 * Fallback CSS: aria-label / texto en button o <a> (scoped al dialog si se pasa).
 */
export function cssPrimaryActions(scope: Scope): Locator {
  return scope
    .locator(
      [
        "button[data-easy-apply-next-button]",
        "button[data-live-test-easy-apply-next-button]",
        "button[data-live-test-easy-apply-submit-button]",
        ".jobs-easy-apply-footer button.artdeco-button--primary",
        "footer button.artdeco-button--primary",
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

/** Shell atascado: solo selector de idioma (borrador LinkedIn sin form real). */
export function isLanguageOnlyShell(
  fields: { label: string }[]
): boolean {
  if (fields.length === 0) return false;
  return fields.every((f) => /select language|seleccionar idioma|\bidioma\b/i.test(f.label));
}
