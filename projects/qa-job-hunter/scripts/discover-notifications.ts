// Spike B-37 — discovery vía LinkedIn Notifications (no productivo).
// PoC: filtrar job alerts en /notifications → View jobs → scrape → back.

import { chromium, type BrowserContext, type Page } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveSessionPath } from "../src/apply/paths.js";
import {
  collectDomInventoryInBrowser,
  extractNotificationItemsInBrowser,
  readJobDetailMetaInBrowser,
  scrollNotificationsFeedInBrowser,
} from "./notifications-browser.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOTIFICATIONS_URL = "https://www.linkedin.com/notifications/";
const SPIKE_OUTPUT_DIR = path.join(ROOT, "output", "spike-notifications");
const JOBS_PATH = path.join(SPIKE_OUTPUT_DIR, "jobs-found.json");
const FIXTURES_PATH = path.join(ROOT, "docs", "fixtures", "notifications-capture-2026-07-24.json");

interface JobEntry {
  jobId: string;
  title: string;
  company: string;
  url: string;
}

function ensureDirs(): void {
  fs.mkdirSync(SPIKE_OUTPUT_DIR, { recursive: true });
}

const DEFAULT_LOOKBACK_HOURS = 24;
const MAX_LOOKBACK_HOURS = 336; // 14 días

/** Ítems de job alert según captura usuaria 2026-07-24 (#248). */
export const JOB_ALERT_INCLUDE = [
  /new opportunities/i,
  /other recommendations for you/i,
] as const;

/** Ruido social / no-job en el feed. */
export const JOB_ALERT_EXCLUDE = [
  /#hiring\b/i,
  /\bconoc[eé]s a alguien\b/i,
  /\bknow someone\b/i,
  /\bliked your\b/i,
  /\bcommented on\b/i,
  /\breacted to\b/i,
  /\bstarted following\b/i,
  /\bconnection request\b/i,
  /\bsolicitud de conexi[oó]n\b/i,
  /\bacept[oó] tu invitaci[oó]n\b/i,
  /\baccepted your invitation\b/i,
] as const;

const QA_ROLE =
  /\bqa\b|quality assurance|aseguramiento de calidad|\bsdet\b|test automation|automation (test|qa|engineer)|software test|(qa|quality)[\s-]*(analyst|engineer|lead|manager|specialist|tester|automation)|quality analyst|tester de software|analista (de )?qa|lider (de )?qa|líder (de )?qa/i;

const SOFTWARE_CUE =
  /\bqa\b|quality assurance|aseguramiento de calidad|\bsdet\b|software|sistemas|tecnolog|automation|selenium|playwright|cypress|appium|\bapi\b|web|mobile|devops|agile|scrum|it\b|developer|testing|test engineer|software test/i;

const HARD_REJECT =
  /contabilidad|accounting|sales assistant|video editor|headhunting|electrical|ejecutiv[oa] comercial|people analytics|data architect|full-?stack developer|farmacity|calidad (de )?alimentos|food safety|manufacturing|pharma(?!.*software)|copy of\b/i;

export interface NotificationItem {
  index: number;
  text: string;
  timestampText: string;
  ageHours: number | null;
  href: string | null;
  hasViewJobs: boolean;
  matchedInclude: string | null;
  excluded: boolean;
  withinLookback: boolean;
}

export interface SpikeRunReport {
  ranAt: string;
  lookbackHours: number;
  dryRun: boolean;
  maxItems: number;
  domInventory: Record<string, unknown>;
  notificationsScanned: number;
  relevantInWindow: number;
  processed: number;
  jobsFound: JobEntry[];
  errors: string[];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitize(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function parseArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function clampLookbackHours(raw: string | undefined): number {
  const n = Number(raw ?? process.env.NOTIFICATIONS_LOOKBACK_HOURS ?? DEFAULT_LOOKBACK_HOURS);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LOOKBACK_HOURS;
  return Math.min(Math.floor(n), MAX_LOOKBACK_HOURS);
}

export function matchesJobAlert(text: string): { ok: boolean; pattern: string | null; excluded: boolean } {
  const normalized = sanitize(text);
  if (!normalized) return { ok: false, pattern: null, excluded: false };
  if (JOB_ALERT_EXCLUDE.some((re) => re.test(normalized))) {
    return { ok: false, pattern: null, excluded: true };
  }
  for (const re of JOB_ALERT_INCLUDE) {
    if (re.test(normalized)) return { ok: true, pattern: re.source, excluded: false };
  }
  return { ok: false, pattern: null, excluded: false };
}

/** Convierte timestamps relativos EN/ES a horas aproximadas. */
export function parseRelativeAgeHours(text: string): number | null {
  const t = sanitize(text).toLowerCase();
  if (!t) return null;
  if (/just now|ahora|ahora mismo|moments? ago|hace un momento/.test(t)) return 0;

  const patterns: Array<{ re: RegExp; unitHours: number }> = [
    { re: /(\d+)\s*(s|sec|secs|second|seconds|seg|segs|segundo|segundos)\b/, unitHours: 1 / 3600 },
    { re: /(\d+)\s*(m|min|mins|minute|minutes|minuto|minutos)\b/, unitHours: 1 / 60 },
    { re: /(\d+)\s*(h|hr|hrs|hour|hours|hora|horas)\b/, unitHours: 1 },
    { re: /(\d+)\s*(d|day|days|d[ií]a|d[ií]as)\b/, unitHours: 24 },
    { re: /(\d+)\s*(w|wk|wks|week|weeks|sem|semana|semanas)\b/, unitHours: 24 * 7 },
    { re: /(\d+)\s*(mo|mos|month|months|mes|meses)\b/, unitHours: 24 * 30 },
    { re: /(\d+)\s*(y|yr|yrs|year|years|a[nñ]o|a[nñ]os)\b/, unitHours: 24 * 365 },
    { re: /hace\s+(\d+)\s*h/, unitHours: 1 },
    { re: /hace\s+(\d+)\s*d/, unitHours: 24 },
    { re: /hace\s+(\d+)\s*sem/, unitHours: 24 * 7 },
  ];

  for (const { re, unitHours } of patterns) {
    const m = t.match(re);
    if (m) return Number(m[1]) * unitHours;
  }
  return null;
}

function isRelevantTitle(title: string): boolean {
  if (HARD_REJECT.test(title)) return false;
  const hitsRole = QA_ROLE.test(title);
  if (!hitsRole) return false;
  return SOFTWARE_CUE.test(title);
}

async function readDetailMeta(page: Page): Promise<{ title: string; company: string }> {
  const raw = await page.evaluate(readJobDetailMetaInBrowser);
  return { title: sanitize(raw.title), company: sanitize(raw.company) };
}

async function collectDomInventory(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(collectDomInventoryInBrowser);
}

async function scrollNotificationsFeed(page: Page, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(scrollNotificationsFeedInBrowser);
    await sleep(900 + i * 120);
  }
}

async function extractNotificationItems(page: Page): Promise<NotificationItem[]> {
  const raw = await page.evaluate(extractNotificationItemsInBrowser);

  return raw.map((item) => {
    const match = matchesJobAlert(item.text);
    const ageHours = parseRelativeAgeHours(item.timestampText);
    return {
      ...item,
      ageHours,
      matchedInclude: match.ok ? match.pattern : null,
      excluded: match.excluded,
      withinLookback: true,
    };
  });
}

async function openNotificationItem(page: Page, item: NotificationItem): Promise<boolean> {
  const row = page.locator(".nt-card").nth(item.index);
  const viewJobs = row
    .locator("button, a")
    .filter({ hasText: /view jobs|ver empleos|ver trabajos|see jobs/i })
    .first();

  if ((await viewJobs.count()) > 0) {
    await viewJobs.click({ timeout: 8000 });
    await sleep(1800);
    return true;
  }

  const link = row.locator("a[href]").first();
  if ((await link.count()) > 0) {
    await link.click({ timeout: 8000 });
    await sleep(1800);
    return true;
  }

  await row.click({ timeout: 8000 }).catch(() => undefined);
  await sleep(1800);
  return true;
}

async function scrapeJobsFromDestination(page: Page, seen: Set<string>): Promise<JobEntry[]> {
  const found: JobEntry[] = [];
  const url = page.url();

  if (url.includes("/login") || url.includes("/authwall")) {
    throw new Error("Sesión LinkedIn expirada o authwall.");
  }

  // Lista de recomendaciones / job alert landing.
  if (/\/jobs\//.test(url) && !/\/jobs\/view\//.test(url)) {
    for (let s = 0; s < 3; s++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(800);
    }

    let cards = page.locator("[data-occludable-job-id]");
    let count = await cards.count();
    if (count === 0) {
      cards = page.locator(".jobs-search__results-list > li, .scaffold-layout__list-container li");
      count = await cards.count();
    }
    const limit = Math.min(count, 12);
    for (let i = 0; i < limit; i++) {
      const card = cards.nth(i);
      const jobIdAttr = (await card.getAttribute("data-occludable-job-id").catch(() => null))?.trim();
      let jobId = jobIdAttr || "";
      try {
        await card.click({ timeout: 5000 });
        await sleep(1400);
      } catch {
        continue;
      }
      if (!jobId) {
        const href = page.url();
        jobId =
          href.match(/currentJobId=(\d+)/)?.[1] ||
          href.match(/\/jobs\/view\/(\d+)/)?.[1] ||
          "";
      }
      if (!jobId || seen.has(jobId)) continue;
      const { title, company } = await readDetailMeta(page);
      if (!title || !isRelevantTitle(title)) continue;
      seen.add(jobId);
      found.push({
        jobId,
        title,
        company: company || "Desconocida",
        url: `https://www.linkedin.com/jobs/view/${jobId}`,
      });
    }
    return found;
  }

  // Detalle único.
  const jobId =
    url.match(/currentJobId=(\d+)/)?.[1] ||
    url.match(/\/jobs\/view\/(\d+)/)?.[1] ||
    "";
  if (jobId && !seen.has(jobId)) {
    const { title, company } = await readDetailMeta(page);
    if (title && isRelevantTitle(title)) {
      seen.add(jobId);
      found.push({
        jobId,
        title,
        company: company || "Desconocida",
        url: `https://www.linkedin.com/jobs/view/${jobId}`,
      });
    }
  }
  return found;
}

export async function runNotificationsSpike(options: {
  lookbackHours: number;
  maxItems: number;
  dryRun: boolean;
  merge: boolean;
  headless: boolean;
}): Promise<SpikeRunReport> {
  ensureDirs();
  fs.mkdirSync(SPIKE_OUTPUT_DIR, { recursive: true });

  const sessionPath = resolveSessionPath();
  const existing: JobEntry[] = fs.existsSync(JOBS_PATH)
    ? JSON.parse(fs.readFileSync(JOBS_PATH, "utf-8"))
    : [];
  const byId = new Map(existing.map((j) => [j.jobId, j]));
  const seen = new Set<string>(existing.map((j) => j.jobId));

  const report: SpikeRunReport = {
    ranAt: new Date().toISOString(),
    lookbackHours: options.lookbackHours,
    dryRun: options.dryRun,
    maxItems: options.maxItems,
    domInventory: {},
    notificationsScanned: 0,
    relevantInWindow: 0,
    processed: 0,
    jobsFound: [],
    errors: [],
  };

  const browser = await chromium.launch({ headless: options.headless, slowMo: 35 });
  const context: BrowserContext = await browser.newContext({
    storageState: sessionPath,
    viewport: { width: 1280, height: 900 },
    locale: "es-AR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  try {
    console.log(`\n🔔 Notifications spike — lookback ${options.lookbackHours}h | max ${options.maxItems} ítems`);
    console.log(`🔐 Sesión: ${sessionPath}`);

    await page.goto(NOTIFICATIONS_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);

    if (page.url().includes("/login") || page.url().includes("/authwall")) {
      throw new Error("Sesión LinkedIn expirada — renovar session/linkedin-session.json");
    }

    report.domInventory = await collectDomInventory(page);
    await scrollNotificationsFeed(page);

    const items = await extractNotificationItems(page);
    report.notificationsScanned = items.length;

    const relevant = items.filter(
      (it) =>
        it.matchedInclude &&
        !it.excluded &&
        (it.ageHours === null || it.ageHours <= options.lookbackHours)
    );
    report.relevantInWindow = relevant.length;

    console.log(`📋 Notificaciones en DOM: ${items.length}`);
    console.log(`🎯 Relevantes (filtro + ventana): ${relevant.length}`);

    for (const item of relevant.slice(0, options.maxItems)) {
      console.log(`\n→ [${item.index}] ${item.timestampText || "?"} | ${item.text.slice(0, 100)}…`);
      try {
        await page.goto(NOTIFICATIONS_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(1200);
        await scrollNotificationsFeed(page, 2);
        await openNotificationItem(page, item);
        await sleep(1200);

        const jobs = await scrapeJobsFromDestination(page, seen);
        report.jobsFound.push(...jobs);
        report.processed++;
        console.log(`   ✓ Jobs scrapeados: ${jobs.length} | destino: ${page.url().slice(0, 90)}`);

        await page.goto(NOTIFICATIONS_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(1000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        report.errors.push(`item ${item.index}: ${msg}`);
        console.log(`   ⚠️  ${msg}`);
        await page.goto(NOTIFICATIONS_URL, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => undefined);
        await sleep(1000);
      }
    }

    const screenshotPath = path.join(SPIKE_OUTPUT_DIR, `notifications-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

    const reportPath = path.join(SPIKE_OUTPUT_DIR, "last-run.json");
    fs.writeFileSync(reportPath, JSON.stringify({ ...report, screenshotPath }, null, 2), "utf-8");
    console.log(`\n📝 Reporte spike: ${reportPath}`);

    if (!options.dryRun && options.merge) {
      let added = 0;
      for (const job of report.jobsFound) {
        if (byId.has(job.jobId)) continue;
        byId.set(job.jobId, job);
        added++;
      }
      fs.writeFileSync(JOBS_PATH, JSON.stringify([...byId.values()], null, 2), "utf-8");
      console.log(`💾 Merge jobs-found.json: +${added} (total ${byId.size})`);
    } else {
      console.log("🧪 Dry-run: no se escribió output/spike-notifications/jobs-found.json (usá --merge).");
    }
  } finally {
    await browser.close();
  }

  return report;
}

async function main() {
  const lookbackHours = clampLookbackHours(parseArg("--lookback-hours"));
  const maxItems = Number(parseArg("--max-items") ?? "3");
  const dryRun = !hasFlag("--merge");
  const headless = !hasFlag("--headed");

  if (hasFlag("--test-fixtures")) {
    const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf-8")) as {
      samples: Array<{ kind: string; text: string }>;
    };
    console.log("🧪 Fixture filter self-test:");
    for (const { kind, text } of fixtures.samples) {
      const m = matchesJobAlert(text);
      const expectInclude = kind === "include";
      const ok = expectInclude ? m.ok : !m.ok;
      console.log(`  ${ok ? "✓" : "✗"} [${kind}] ${text.slice(0, 90)}`);
    }
    return;
  }

  const report = await runNotificationsSpike({
    lookbackHours,
    maxItems: Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 3,
    dryRun,
    merge: hasFlag("--merge"),
    headless,
  });

  console.log(`\n📊 Resumen: ${report.processed} ítems procesados, ${report.jobsFound.length} jobs, ${report.errors.length} errores`);
  if (report.jobsFound.length) {
    for (const j of report.jobsFound) console.log(`   • ${j.company} — ${j.title} (${j.jobId})`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
