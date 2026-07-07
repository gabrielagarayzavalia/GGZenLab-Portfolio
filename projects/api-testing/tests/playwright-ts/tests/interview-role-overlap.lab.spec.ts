import { expect, test } from "@playwright/test";
import { InterviewLabPage } from "../pages/InterviewLabPage";

/**
 * LAB-04b — Entrevista en vivo: getByRole + solapamiento
 *
 * Completá cada test (están en test.fixme). Corré solo este archivo:
 *   npx playwright test interview-role-overlap.lab.spec.ts
 *
 * Cuando pase uno, cambiá test.fixme → test.
 */

test.describe("Interview lab — roles & overlap", () => {
  test.beforeEach(async ({ page }) => {
    await new InterviewLabPage(page).open();
  });

  // E1 — "Escribí login con getByRole" (chat en Zoom)
  test.fixme("E1: login con getByRole — status Signed in", async ({ page }) => {
    // TODO: solo getByRole (textbox + button). Sin CSS.
    // await page.getByRole("textbox", { name: "Email" }).fill("qa@example.com");
    // ...
    // await expect(page.locator("#status")).toHaveText("Signed in");
  });

  // E2 — strict mode: dos botones "Save"
  test.fixme("E2: click Save and publish sin strict violation", async ({ page }) => {
    // TODO: getByRole('button', { name: '...' }) — ¿name visible o accessible name?
    // await expect(page.locator("#status")).toHaveText("Published");
  });

  // E3 — overlay intercepta click (pointer events)
  test.fixme("E3: checkout con overlay — dismiss primero", async ({ page }) => {
    // TODO: click directo a Checkout falla. Cerrá overlay, después checkout.
    // await expect(page.locator("#status")).toHaveText("Checked out");
  });

  // E4 — dialog fijo (cookie banner) cubre Buy now
  test.fixme("E4: buy now con cookie banner", async ({ page }) => {
    // TODO: getByRole('dialog') + Accept all, luego Buy now
    // await expect(page.locator("#status")).toHaveText("Purchased");
  });
});
