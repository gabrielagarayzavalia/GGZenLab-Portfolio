/**
 * Indeed Argentina MVP (#59 / B-31-03).
 * Búsqueda pública vía Playwright (fetch crudo → 403 bot wall).
 * Rate limit suave; no scrape agresivo.
 */

import { chromium, type Browser } from "playwright";
import type {
  JobSourceAdapter,
  JobSourceListing,
  JobSourceSearchQuery,
} from "./types.js";

const DEFAULT_LIMIT = 15;

/** URL de búsqueda Indeed AR (público). */
export function buildIndeedArSearchUrl(keywords: string, start = 0): string {
  const q = encodeURIComponent(keywords.trim() || "QA");
  const startQ = start > 0 ? `&start=${start}` : "";
  return `https://ar.indeed.com/jobs?q=${q}&l=Argentina${startQ}`;
}

/**
 * Extrae tarjetas básicas del HTML de resultados Indeed.
 * Selectores frágiles → si cambia el DOM, el smoke falla y se documenta.
 */
export function parseIndeedSearchHtml(
  html: string,
  opts: { keywords: string; limit: number }
): JobSourceListing[] {
  const out: JobSourceListing[] = [];
  const seen = new Set<string>();

  const jkRe = /data-jk=["']([a-f0-9]+)["']/gi;
  const jks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = jkRe.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      jks.push(m[1]);
    }
    if (jks.length >= opts.limit * 2) break;
  }

  for (const jk of jks.slice(0, opts.limit)) {
    const url = `https://ar.indeed.com/viewjob?jk=${jk}`;
    // Mosaiq / JSON embebido suele traer título cerca del jobkey
    const jsonTitleRe = new RegExp(
      `["'](?:jobkey|jk)["']\\s*:\\s*["']${jk}["'][\\s\\S]{0,400}["'](?:displayTitle|title|jobTitle)["']\\s*:\\s*["']([^"']{3,120})["']`,
      "i"
    );
    const jsonTitleRe2 = new RegExp(
      `["'](?:displayTitle|title|jobTitle)["']\\s*:\\s*["']([^"']{3,120})["'][\\s\\S]{0,400}["'](?:jobkey|jk)["']\\s*:\\s*["']${jk}["']`,
      "i"
    );
    const idx = html.indexOf(jk);
    const around = html.slice(Math.max(0, idx - 500), idx + 900);
    const titleMatch =
      html.match(jsonTitleRe) ||
      html.match(jsonTitleRe2) ||
      around.match(/<(?:h2|a)[^>]*>([^<]{5,120})<\/(?:h2|a)>/i) ||
      around.match(/aria-label=["']([^"']{5,120})["']/i);
    const companyMatch =
      around.match(/data-testid=["']company-name["'][^>]*>([^<]+)</i) ||
      around.match(/["']company["']\s*:\s*["']([^"']{2,80})["']/i) ||
      around.match(/companyName["']?\s*[:=]\s*["']([^"']+)/i);

    const title = (titleMatch?.[1] ?? `Indeed job ${jk}`).replace(/\s+/g, " ").trim();
    const company = (companyMatch?.[1] ?? "Indeed").replace(/\s+/g, " ").trim();

    out.push({
      id: `indeed-${jk}`,
      externalId: jk,
      source: "indeed",
      title,
      company,
      location: "Argentina",
      modality: "",
      datePosted: "",
      url,
      description: "",
      searchTerm: opts.keywords,
    });
  }

  return out;
}

export type IndeedAdapterOptions = {
  /** Headless Playwright (default true). */
  headless?: boolean;
  /** Inyectar browser para tests. */
  browser?: Browser;
};

export class IndeedAdapter implements JobSourceAdapter {
  readonly source = "indeed" as const;

  constructor(private readonly opts: IndeedAdapterOptions = {}) {}

  async search(query: JobSourceSearchQuery): Promise<JobSourceListing[]> {
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), 40);
    const keywords = query.keywords.trim() || "QA Automation";
    const url = buildIndeedArSearchUrl(keywords, 0);

    const owned = !this.opts.browser;
    const browser =
      this.opts.browser ??
      (await chromium.launch({
        headless: this.opts.headless !== false,
        args: ["--disable-blink-features=AutomationControlled"],
      }));

    try {
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "es-AR",
      });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(1500);
      const html = await page.content();
      await page.close();
      const jobs = parseIndeedSearchHtml(html, { keywords, limit });
      if (jobs.length === 0) {
        console.warn(
          "   ⚠ Indeed: 0 jobs parseados (posible captcha/layout). URL:",
          url
        );
      }
      return jobs;
    } finally {
      if (owned) await browser.close().catch(() => {});
    }
  }
}

export const indeedAdapter = new IndeedAdapter();
