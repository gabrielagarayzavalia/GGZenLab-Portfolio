// Maximizar, esperar carga completa y scroll del formulario Easy Apply.
// Evita clicks fallidos por viewport chico o controles fuera de pantalla.

import type { BrowserContext, Page } from "playwright";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Args de Chromium para ventana maximizada (usar con viewport: null en el context). */
export const MAXIMIZED_LAUNCH_ARGS = ["--start-maximized"] as const;

/** Context sin viewport fijo para respetar --start-maximized. */
export function maximizedContextOptions(
  storageState: string,
  locale = "en-US"
): {
  storageState: string;
  locale: string;
  viewport: null;
} {
  return { storageState, locale, viewport: null };
}

/** Refuerza maximize vía CDP (Windows/Linux). */
export async function maximizeWindow(page: Page): Promise<void> {
  try {
    const session = await page.context().newCDPSession(page);
    const { windowId } = (await session.send("Browser.getWindowForTarget")) as {
      windowId: number;
    };
    await session.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "maximized" },
    });
  } catch {
    // headless / sin CDP window: ignore
  }
}

/**
 * Espera a que el aviso LinkedIn esté desplegado (shell + red quieta).
 * Llamar tras goto del job view.
 */
export async function waitForJobPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  await page
    .locator("main, .jobs-details, .job-view-layout, .jobs-search__job-details")
    .first()
    .waitFor({ state: "visible", timeout: 20000 })
    .catch(() => {});

  // Scaffold del CTA (Easy Apply / Applied / etc.)
  await page
    .locator(
      "a[href*='/apply/'], button.jobs-apply-button, .jobs-apply-button, .jobs-s-apply, .jobs-details-top-card"
    )
    .first()
    .waitFor({ state: "visible", timeout: 12000 })
    .catch(() => {});

  await sleep(600);
}

/** Espera modal Easy Apply estable (contenido visible, no spinner eterno). */
export async function waitForEasyApplyModalReady(page: Page): Promise<boolean> {
  const modal = page
    .locator(".jobs-easy-apply-modal, [role='dialog'].jobs-easy-apply-modal, [role='dialog']")
    .first();
  const visible = await modal.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
  if (!visible) return false;

  await page
    .locator(".jobs-easy-apply-modal .artdeco-loader, [role='dialog'] .artdeco-loader")
    .first()
    .waitFor({ state: "hidden", timeout: 10000 })
    .catch(() => {});

  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await sleep(400);
  return true;
}

/**
 * Scrolldown del contenedor del formulario hasta el final para revelar
 * campos/preguntas que no entran en el viewport del modal.
 */
export async function scrollEasyApplyFormToEnd(page: Page): Promise<void> {
  const modal = page.locator(".jobs-easy-apply-modal, [role='dialog']").first();
  if (!(await modal.isVisible({ timeout: 1000 }).catch(() => false))) return;

  await modal
    .evaluate((node) => {
      const isScrollable = (el: Element) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        return (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          el.scrollHeight > el.clientHeight + 16
        );
      };

      const stack: HTMLElement[] = [];
      const walk = (el: Element) => {
        if (isScrollable(el)) stack.push(el as HTMLElement);
        for (const child of Array.from(el.children)) walk(child);
      };
      walk(node);
      if (node instanceof HTMLElement && isScrollable(node)) stack.unshift(node);

      for (const s of stack) {
        s.scrollTop = s.scrollHeight;
      }
    })
    .catch(() => {});

  // Asegurar último control en vista
  const fields = modal.locator(
    "input:not([type='hidden']), textarea, select, [role='combobox'], [contenteditable='true'], fieldset, label"
  );
  const n = await fields.count().catch(() => 0);
  if (n > 0) {
    await fields
      .nth(n - 1)
      .scrollIntoViewIfNeeded()
      .catch(() => {});
  }

  // Pase Extra: End / PageDown por si el foco está en el modal
  await modal.click({ position: { x: 20, y: 20 }, timeout: 800 }).catch(() => {});
  await page.keyboard.press("End").catch(() => {});
  await page.keyboard.press("PageDown").catch(() => {});
  await sleep(350);
}

/** Setup de página al inicio de la corrida: maximize + listo para navegar. */
export async function prepareApplyBrowserPage(
  context: BrowserContext
): Promise<Page> {
  const page = await context.newPage();
  await maximizeWindow(page);
  return page;
}
