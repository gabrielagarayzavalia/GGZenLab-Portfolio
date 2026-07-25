import type { Browser } from "playwright";

/** Cierra Chromium al cancelar desde dashboard o Ctrl+C (#324). */
export function registerPlaywrightShutdown(browser: Browser): void {
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.error(`\n⚠️  Señal ${signal} — cerrando Chromium…`);
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}
