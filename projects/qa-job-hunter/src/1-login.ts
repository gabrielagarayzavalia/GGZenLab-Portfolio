// ============================================================
//  1-login.ts — EJECUTAR SOLO LA PRIMERA VEZ / cuando expire la sesión
//  Comando: npm run login
// ============================================================

import { chromium, type BrowserContext, type Page } from "playwright";
import fs from "fs";
import path from "path";
import { LINKEDIN_CREDENTIALS, SESSION_PATH } from "./config.js";

const FEED_WAIT_MS = 600_000; // 10 min (2FA / checkpoint manual)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isFeedUrl(url: string): boolean {
  return /linkedin\.com\/feed\/?/i.test(url) || /linkedin\.com\/(?:in|mynetwork|jobs)\//i.test(url);
}

function isCheckpointUrl(url: string): boolean {
  return /checkpoint|challenge|verification|challengeId/i.test(url);
}

async function saveSession(context: BrowserContext, reason: string): Promise<void> {
  const sessionDir = path.dirname(SESSION_PATH);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  await context.storageState({ path: SESSION_PATH });
  console.log(`💾 Sesión guardada (${reason}): ${SESSION_PATH}`);
}

/** Espera feed o deja que el usuario resuelva checkpoint (hasta 10 min). */
async function waitForLoggedIn(page: Page): Promise<boolean> {
  const deadline = Date.now() + FEED_WAIT_MS;
  let warnedCheckpoint = false;

  while (Date.now() < deadline) {
    const url = page.url();
    if (isFeedUrl(url)) {
      console.log(`✅ Login OK — URL: ${url}`);
      return true;
    }
    if (isCheckpointUrl(url) && !warnedCheckpoint) {
      warnedCheckpoint = true;
      console.log("\n⚠️  LinkedIn pide verificación (2FA / app / CAPTCHA).");
      console.log("👉 Completá en el navegador (app → Sí). Tenés hasta 10 minutos.\n");
    }
    await sleep(1500);
  }
  return isFeedUrl(page.url());
}

async function fillLoginForm(page: Page): Promise<void> {
  const emailInput = page.locator('input[type="email"], input[autocomplete="username"]').first();
  const passInput = page.locator('input[type="password"]').first();

  // attached basta: LinkedIn a menudo marca el input como "hidden" con CSS raro
  await emailInput.waitFor({ state: "attached", timeout: 60_000 });
  await passInput.waitFor({ state: "attached", timeout: 30_000 });

  console.log("⌨️  Llenando email (force)…");
  await emailInput.fill(LINKEDIN_CREDENTIALS.email, { force: true }).catch(async () => {
    await emailInput.evaluate((el, v) => {
      (el as HTMLInputElement).value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, LINKEDIN_CREDENTIALS.email);
  });
  await sleep(400);

  console.log("⌨️  Llenando contraseña (force)…");
  await passInput.fill(LINKEDIN_CREDENTIALS.password, { force: true }).catch(async () => {
    await passInput.evaluate((el, v) => {
      (el as HTMLInputElement).value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, LINKEDIN_CREDENTIALS.password);
  });
  await sleep(400);

  console.log("🖱️  Click Iniciar sesión…");
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click({ force: true, timeout: 15_000 }).catch(async () => {
    await page.keyboard.press("Enter");
  });
}

async function loginLinkedIn() {
  console.log("🔐 Iniciando login en LinkedIn...");

  const sessionDir = path.dirname(SESSION_PATH);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
    args: [
      "--disable-extensions",
      "--disable-translate",
      "--disable-features=Translate,TranslateUI,TranslateNewUX",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR",
  });

  const page = await context.newPage();
  let saved = false;

  try {
    console.log("📄 Navegando a LinkedIn login…");
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await sleep(800);

    // Ya logueado / redirect al feed
    if (isFeedUrl(page.url())) {
      console.log("✅ Ya estabas en el feed (sesión previa en el browser).");
      await saveSession(context, "ya en feed");
      saved = true;
      return;
    }

    // A veces el goto a /login redirige a checkpoint si hay cookie parcial
    if (isCheckpointUrl(page.url())) {
      console.log("⚠️  Checkpoint al abrir login — resolvé en el browser.");
      const ok = await waitForLoggedIn(page);
      if (ok) {
        await saveSession(context, "post-checkpoint");
        saved = true;
      } else {
        throw new Error("Timeout esperando feed tras checkpoint");
      }
      return;
    }

    await fillLoginForm(page);
    console.log("⏳ Esperando feed / checkpoint…");
    await sleep(2000);

    const ok = await waitForLoggedIn(page);
    if (!ok) {
      throw new Error(`Timeout: no llegamos al feed. URL final: ${page.url()}`);
    }

    await saveSession(context, "login completo");
    saved = true;
    console.log("\n🎉 Listo. Ahora podés correr Easy Apply:");
    console.log("   npm run easy-apply\n");
  } catch (error) {
    console.error("\n❌ Error durante el login:", error);
    // Si igual llegamos al feed (caso del log: wait falló pero navegó a /feed/)
    if (isFeedUrl(page.url()) && !saved) {
      console.log("⚠️  Había error, pero la URL es feed → guardo sesión igual.");
      try {
        await saveSession(context, "recovery feed tras error");
        saved = true;
        console.log("✅ Sesión recuperada. Podés usar Easy Apply.");
      } catch (saveErr) {
        console.error("   No pude guardar sesión:", saveErr);
      }
    } else {
      await page.screenshot({ path: "./session/login-error.png" }).catch(() => {});
      console.log("\n💡 Screenshot: session\\login-error.png");
      console.log(`   URL: ${page.url()}`);
    }
  } finally {
    await browser.close();
    if (!saved) {
      console.log("\n⚠️  Sesión NO guardada. Reintentá: npm run login");
    }
  }
}

loginLinkedIn();
