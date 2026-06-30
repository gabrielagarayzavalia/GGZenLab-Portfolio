// ============================================================
//  1-login.ts — EJECUTAR SOLO LA PRIMERA VEZ
//  Comando: npx tsx src\1-login.ts
// ============================================================

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { LINKEDIN_CREDENTIALS, SESSION_PATH } from "./config.js";

async function loginLinkedIn() {
  console.log("🔐 Iniciando login en LinkedIn...");

  const sessionDir = path.dirname(SESSION_PATH);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR", // Forzar español para que coincida con tu LinkedIn
  });

  const page = await context.newPage();

  try {
    console.log("📄 Navegando a LinkedIn login...");
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Esperar a que el formulario esté completamente cargado
    await page.waitForTimeout(2000);

    // Imprimir todos los inputs visibles para diagnóstico
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("input")).map((el) => ({
        id: el.id,
        name: el.name,
        type: el.type,
        placeholder: el.placeholder,
        autocomplete: el.autocomplete,
        ariaLabel: el.getAttribute("aria-label"),
      }));
    });
    console.log("🔎 Inputs encontrados en la página:");
    console.log(JSON.stringify(inputs, null, 2));

    // Estrategia: usar el PRIMER input de texto y el PRIMER input de password
    // (funciona sin importar el id o name que LinkedIn le ponga)
    console.log("\n⌨️  Llenando email...");
    const emailInput = page.locator('input[type="text"], input[type="email"]').first();
    await emailInput.waitFor({ state: "visible", timeout: 10000 });
    await emailInput.click();
    await emailInput.fill(LINKEDIN_CREDENTIALS.email);
    await page.waitForTimeout(500);

    console.log("⌨️  Llenando contraseña...");
    const passInput = page.locator('input[type="password"]').first();
    await passInput.waitFor({ state: "visible", timeout: 5000 });
    await passInput.click();
    await passInput.fill(LINKEDIN_CREDENTIALS.password);
    await page.waitForTimeout(500);

    console.log("🖱️  Haciendo clic en Iniciar sesión...");
    // Buscar el botón submit — en español dice "Iniciar sesión"
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    await submitBtn.click();

    console.log("⏳ Esperando respuesta de LinkedIn...");
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    console.log(`   URL actual: ${currentUrl}`);

    // Verificación 2FA o CAPTCHA
    if (
      currentUrl.includes("checkpoint") ||
      currentUrl.includes("challenge") ||
      currentUrl.includes("verification")
    ) {
      console.log("\n⚠️  LinkedIn pide verificación adicional (2FA/CAPTCHA).");
      console.log("👉 Completá la verificación manualmente en el navegador.");
      console.log("⏳ Tenés hasta 90 segundos...\n");
      await page.waitForURL("**/feed/**", { timeout: 90000 });
    }

    // Esperar a llegar al feed
    await page.waitForURL("**/feed/**", { timeout: 20000 });
    console.log("✅ Login exitoso!");

    await context.storageState({ path: SESSION_PATH });
    console.log(`💾 Sesión guardada en: ${SESSION_PATH}`);
    console.log("\n🎉 Listo. Ahora podés correr:");
    console.log("   npx tsx src\\run-all.ts\n");

  } catch (error) {
    console.error("\n❌ Error durante el login:", error);
    await page.screenshot({ path: "./session/login-error.png" }).catch(() => {});
    console.log("\n💡 Screenshot guardado en session\\login-error.png");
  } finally {
    await browser.close();
  }
}

loginLinkedIn();
