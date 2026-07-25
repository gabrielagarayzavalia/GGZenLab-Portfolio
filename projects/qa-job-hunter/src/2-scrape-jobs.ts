// ============================================================
//  2-scrape-jobs.ts — Scraping de empleos QA en LinkedIn (SEARCH)
//  OPT-IN / baja calidad: NO es el discovery canónico.
//  Canónico: Gmail API → applied-list run-pipeline → Easy Apply.
//  Ver docs/campaign-flow.md y docs/backlog-linkedin-search-scrape.md
//  Comando: DISCOVERY=linkedin_search npx tsx src\2-scrape-jobs.ts
//           (o npm run scrape a propósito)
// ============================================================

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { SESSION_PATH, SEARCH_TERMS, FILTERS, OUTPUT_PATH, TITLE_KEYWORDS } from "./config.js";
import { listActivePuestoTitles } from "./config/puestos-store.js";
import { listActiveEmpleoProfiles } from "./config/empleo-store.js";
import { SCRAPE, sleep } from "./apply/timing.js";
import type { JobListing } from "./types.js";
import type { Page } from "playwright";

function resolveSearchTerms(): string[] {
  const puestos = listActivePuestoTitles();
  if (puestos.length > 0) return puestos;
  const empleoTitles = listActiveEmpleoProfiles()
    .map((p) => p.title.trim())
    .filter(Boolean);
  if (empleoTitles.length > 0) return empleoTitles;
  return SEARCH_TERMS;
}

function sanitize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function generateId(title: string, company: string): string {
  return Buffer.from(`${title}-${company}`).toString("base64").slice(0, 12);
}

function isRelevantTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return TITLE_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Espera cards de resultados (condicionado) + settle corto. */
async function waitForSearchResults(page: Page): Promise<void> {
  await page
    .locator(
      ".jobs-search__results-list > li, .scaffold-layout__list-container li, [data-occludable-job-id]"
    )
    .first()
    .waitFor({ state: "visible", timeout: SCRAPE.resultsVisibleMs })
    .catch(() => {});
  await sleep(SCRAPE.afterGotoMs);
}

async function waitForJobDetailPanel(page: Page): Promise<void> {
  await page
    .locator(
      ".jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title, h1.t-24, h2.t-24"
    )
    .first()
    .waitFor({ state: "visible", timeout: 6000 })
    .catch(() => {});
  await sleep(SCRAPE.afterCardClickMs);
}


async function scrapeLinkedInJobs(): Promise<void> {
  const discovery = (process.env.DISCOVERY ?? "").trim().toLowerCase();
  if (discovery !== "linkedin_search" && discovery !== "linkedin" && discovery !== "search") {
    console.warn(
      "⚠️  LinkedIn SEARCH scrape no es el discovery diario.\n" +
        "   Para continuar igual: $env:DISCOVERY='linkedin_search'; npm run scrape\n" +
        "   Camino canónico: npm run campaign  (Gmail fetch → pipeline → Excel → Easy Apply)\n" +
        "   Backlog: docs/backlog-linkedin-search-scrape.md\n"
    );
    process.exit(2);
  }

  if (!fs.existsSync(SESSION_PATH)) {
    console.error("❌ No hay sesión guardada.");
    console.log("   Ejecutá primero: npx tsx src\\1-login.ts\n");
    process.exit(1);
  }

  const searchTerms = resolveSearchTerms();

  console.log("🚀 Iniciando scraping de empleos QA en LinkedIn...");
  console.log(`📋 Términos: ${searchTerms.join(", ")}\n`);

  const browser = await chromium.launch({
    headless: false, // Visible para detectar problemas
    slowMo: 300,
    args: [
      "--disable-extensions",
      "--disable-translate",
      "--disable-features=Translate,TranslateUI,TranslateNewUX",
    ],
  });

  const context = await browser.newContext({
    storageState: SESSION_PATH,
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "es-AR",
  });

  const allJobs: JobListing[] = [];
  const seenIds = new Set<string>();

  // ── PASADA EXTRA: LinkedIn "Remote jobs" collection ──────────
  console.log(`\n🌎 Explorando colección "Remote jobs" de LinkedIn...`);
  {
    const page = await context.newPage();
    try {
      const collUrl = `https://www.linkedin.com/jobs/collections/remote/?keywords=QA`;
      await page.goto(collUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForSearchResults(page);

      if (!page.url().includes("/login") && !page.url().includes("/authwall")) {
        await page.screenshot({ path: "./session/search-remote-collection.png" });

        for (let s = 0; s < 4; s++) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(SCRAPE.scrollSettleMs);
        }

        let cards = await page.$$(".jobs-search__results-list > li");
        if (cards.length === 0) cards = await page.$$(".scaffold-layout__list-container li");
        if (cards.length === 0) cards = await page.$$('[data-occludable-job-id]');

        const count = Math.min(cards.length, FILTERS.maxJobsPerSearch);
        console.log(`   📌 Cards encontradas: ${cards.length} (procesando ${count})`);

        for (let i = 0; i < count; i++) {
          try {
            await cards[i].click();
            await waitForJobDetailPanel(page);

            const title = sanitize(await page.evaluate(() => {
              const sels = [".jobs-unified-top-card__job-title", ".job-details-jobs-unified-top-card__job-title", "h1.t-24", "h2.t-24"];
              for (const s of sels) { const el = document.querySelector(s); if (el?.textContent) return el.textContent; }
              return "";
            }));
            const company = sanitize(await page.evaluate(() => {
              const sels = [".jobs-unified-top-card__company-name a", ".job-details-jobs-unified-top-card__company-name", ".topcard__org-name-link"];
              for (const s of sels) { const el = document.querySelector(s); if (el?.textContent) return el.textContent; }
              return "";
            }));

            if (!title || !company || !isRelevantTitle(title)) {
              if (title) console.log(`   ✗ Descartado: ${title}`);
              continue;
            }

            const location = sanitize(await page.evaluate(() => {
              const sels = [".jobs-unified-top-card__bullet", ".job-details-jobs-unified-top-card__primary-description-without-tagline"];
              for (const s of sels) { const el = document.querySelector(s); if (el?.textContent) return el.textContent; }
              return "No especificado";
            }));
            const modality = sanitize(await page.evaluate(() => {
              const sels = [".jobs-unified-top-card__workplace-type", ".job-details-jobs-unified-top-card__workplace-type"];
              for (const s of sels) { const el = document.querySelector(s); if (el?.textContent) return el.textContent; }
              return "No especificado";
            }));
            const datePosted = sanitize(await page.evaluate(() => {
              const sels = [".jobs-unified-top-card__posted-date", "span.tvm__text--positive"];
              for (const s of sels) { const el = document.querySelector(s); if (el?.textContent) return el.textContent; }
              return "Fecha desconocida";
            }));

            const seeMoreBtn = await page.$(".jobs-description__footer-button");
            if (seeMoreBtn) { await seeMoreBtn.click(); await sleep(SCRAPE.afterSeeMoreMs); }

            const description = sanitize(await page.evaluate(() => {
              const sels = [".jobs-description__content", ".jobs-box__html-content", "#job-details", ".jobs-description"];
              for (const s of sels) { const el = document.querySelector(s); if (el?.textContent) return el.textContent; }
              return "Descripción no disponible";
            }));

            const id = generateId(title, company);
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            allJobs.push({
              id, title, company, location, modality, datePosted,
              url: page.url(), description, searchTerm: "Remote Collection",
            });
            console.log(`   ✓ [${i + 1}/${count}] ${title} @ ${company}`);
          } catch {
            console.log(`   ⚠️  Error en card ${i + 1}, continuando...`);
          }
        }
      } else {
        console.log("   ⚠️  No se pudo acceder a la colección Remote (sesión).");
      }
    } catch (err) {
      console.error("   ❌ Error explorando colección Remote:", err);
    } finally {
      await page.close();
    }
  }

  // ── PASADAS POR KEYWORD (búsqueda tradicional) ───────────────
  for (const term of searchTerms) {
    console.log(`\n🔍 Buscando: "${term}"...`);
    const page = await context.newPage();

    try {
      const encodedTerm = encodeURIComponent(term);
      const remoteParam = FILTERS.remote ? "&f_WT=2" : "";
      const dateParam =
        FILTERS.recentDays <= 1 ? "&f_TPR=r86400" :
        FILTERS.recentDays <= 7 ? "&f_TPR=r604800" :
        "&f_TPR=r2592000";

      const url = `https://www.linkedin.com/jobs/search/?keywords=${encodedTerm}${remoteParam}${dateParam}&sortBy=DD`;
      console.log(`   URL: ${url}`);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForSearchResults(page);

      if (page.url().includes("/login") || page.url().includes("/authwall")) {
        console.log("⚠️  Sesión expirada. Ejecutá: npx tsx src\\1-login.ts");
        await browser.close();
        process.exit(1);
      }

      await page.screenshot({ path: `./session/search-${term.replace(/ /g, "_")}.png` });

      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(SCRAPE.scrollSettleMs);
      }

      let jobCards = await page.$$(".jobs-search__results-list > li");
      if (jobCards.length === 0) {
        jobCards = await page.$$(".scaffold-layout__list-container li");
      }
      if (jobCards.length === 0) {
        jobCards = await page.$$('[data-occludable-job-id]');
      }

      const count = Math.min(jobCards.length, FILTERS.maxJobsPerSearch);
      console.log(`   📌 Cards encontradas: ${jobCards.length} (procesando ${count})`);

      if (jobCards.length === 0) {
        console.log(`   ⚠️  Sin resultados. Revisá session\\search-${term.replace(/ /g, "_")}.png`);
        await page.close();
        continue;
      }

      for (let i = 0; i < count; i++) {
        try {
          await jobCards[i].click();
          await waitForJobDetailPanel(page);

          const title = sanitize(await page.evaluate(() => {
            const selectors = [
              ".jobs-unified-top-card__job-title",
              ".job-details-jobs-unified-top-card__job-title",
              "h1.t-24",
              "h2.t-24",
            ];
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el?.textContent) return el.textContent;
            }
            return "";
          }));

          const company = sanitize(await page.evaluate(() => {
            const selectors = [
              ".jobs-unified-top-card__company-name a",
              ".job-details-jobs-unified-top-card__company-name",
              ".jobs-unified-top-card__subtitle-primary-grouping a",
              ".topcard__org-name-link",
            ];
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el?.textContent) return el.textContent;
            }
            return "";
          }));

          const location = sanitize(await page.evaluate(() => {
            const selectors = [
              ".jobs-unified-top-card__bullet",
              ".job-details-jobs-unified-top-card__primary-description-without-tagline",
              ".topcard__flavor--bullet",
            ];
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el?.textContent) return el.textContent;
            }
            return "No especificado";
          }));

          const modality = sanitize(await page.evaluate(() => {
            const selectors = [
              ".jobs-unified-top-card__workplace-type",
              ".job-details-jobs-unified-top-card__workplace-type",
              ".ui-label--accent-3",
            ];
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el?.textContent) return el.textContent;
            }
            return "No especificado";
          }));

          const datePosted = sanitize(await page.evaluate(() => {
            const selectors = [
              ".jobs-unified-top-card__posted-date",
              "span.tvm__text--positive",
              ".job-details-jobs-unified-top-card__primary-description-container time",
            ];
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el?.textContent) return el.textContent;
            }
            return "Fecha desconocida";
          }));

          const seeMoreBtn = await page.$(".jobs-description__footer-button");
          if (seeMoreBtn) {
            await seeMoreBtn.click();
            await sleep(SCRAPE.afterSeeMoreMs);
          }

          const description = sanitize(await page.evaluate(() => {
            const selectors = [
              ".jobs-description__content",
              ".jobs-box__html-content",
              "#job-details",
              ".jobs-description",
            ];
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el?.textContent) return el.textContent;
            }
            return "Descripción no disponible";
          }));

          const jobUrl = page.url();

          if (!title || !company) {
            console.log(`   ⚠️  Card ${i + 1} sin datos, saltando...`);
            continue;
          }

          if (!isRelevantTitle(title)) {
            console.log(`   ✗ Descartado (título no QA): ${title}`);
            continue;
          }

          const id = generateId(title, company);
          if (seenIds.has(id)) {
            console.log(`   ↩️  Duplicado saltado: ${title}`);
            continue;
          }
          seenIds.add(id);

          const job: JobListing = {
            id,
            title,
            company,
            location,
            modality,
            datePosted,
            url: jobUrl,
            description,
            searchTerm: term,
          };

          allJobs.push(job);
          console.log(`   ✓ [${i + 1}/${count}] ${title} @ ${company}`);

        } catch {
          console.log(`   ⚠️  Error en card ${i + 1}, continuando...`);
        }
      }

    } catch (err) {
      console.error(`   ❌ Error en búsqueda "${term}":`, err);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const rawPath = OUTPUT_PATH.replace(".json", "-raw.json");
  fs.writeFileSync(rawPath, JSON.stringify(allJobs, null, 2), "utf-8");

  console.log(`\n✅ Scraping completado!`);
  console.log(`   Total empleos únicos: ${allJobs.length}`);
  console.log(`   Guardado en: ${rawPath}`);
  console.log(`\n▶  Siguiente: npx tsx src\\3-analyze-match.ts\n`);
}

scrapeLinkedInJobs();
