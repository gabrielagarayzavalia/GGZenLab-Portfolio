// Controles del modal Easy Apply: LinkedIn a veces usa <a> en vez de <button>.

import type { Locator, Page } from "playwright";

type Scope = Page | Locator;

export const MODAL_LABELS = {
  submit: /Submit application|Enviar solicitud/i,
  review: /Review your application|Revisar/i,
  continue: /Continue to next step|Continuar|Siguiente/i,
  /** Solo dentro de dialog — "Next" suelto choca con el carrusel. */
  next: /^(Next|Siguiente)$/i,
  done: /^Done$|^Listo$/i,
  dismiss: /^(Dismiss|Cerrar|Close)$/i,
} as const;

/** Primer control visible: button, si no link (mismo accessible name). */
export async function findButtonOrLink(
  scope: Scope,
  name: string | RegExp,
  timeoutMs = 800
): Promise<Locator | null> {
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
  timeoutMs = 800
): Promise<boolean> {
  const el = await findButtonOrLink(scope, name, timeoutMs);
  if (!el) return false;
  await el.click({ timeout: 5000 });
  return true;
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
