/**
 * Diagnóstico: spinner post-upload de CV en Easy Apply.
 * CDP Network + muestreo DOM cada 500ms.
 *
 *   npx tsx scripts/cv-upload-spinner-probe.ts
 *
 * Env:
 *   PROBE_JOB_ID=4444386400
 *   PROBE_CV_NAME=GGZlinkedin-CV-test.pdf
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type CDPSession, type Page } from "playwright";
import { clickEasyApply } from "../src/apply/detect-apply.js";
import {
  clickSafeInEasyApply,
  findWizardStepAdvanceButton,
  resolveApplyScope,
} from "../src/apply/modal-controls.js";
import {
  MAXIMIZED_LAUNCH_ARGS,
  maximizeWindow,
  maximizedContextOptions,
  prepareApplyBrowserPage,
  waitForEasyApplyModalReady,
  waitForJobPageReady,
} from "../src/apply/page-ready.js";
import { getCvFilePath, listCvs } from "../src/config/cvs-store.js";
import { resolveSessionPath } from "../src/apply/paths.js";
import { resolvePlaywrightHeadless } from "../src/run/playwright-headless.js";
import { sleep } from "../src/apply/timing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "output", "apply", "cv-upload-probe.json");

const JOB_ID = (process.env.PROBE_JOB_ID ?? "4444386400").trim();
const CV_NAME = (process.env.PROBE_CV_NAME ?? "GGZlinkedin-CV-test.pdf").trim();
const UPLOAD_RESUME_BTN_RE = /upload\s+resume|subir\s+curr[ií]culum/i;

type NetEvent = {
  id: string;
  url: string;
  method: string;
  startMs: number;
  endMs?: number;
  status?: number;
  mimeType?: string;
  size?: number;
};

type DomSample = {
  tMs: number;
  ourBusyHeuristic: boolean;
  filenameVisible: boolean;
  deselectAria: string[];
  selectAria: string[];
  spinners: { tag: string; className: string; aria: string; nearPdf: string }[];
  rows: { text: string; hasLoader: boolean; loaderClass: string }[];
};

function pickCvPath(): string {
  const cv = listCvs().find((c) => c.originalName === CV_NAME);
  if (!cv) throw new Error(`CV no en config: ${CV_NAME}`);
  const p = getCvFilePath(cv);
  if (!fs.existsSync(p)) throw new Error(`PDF no en disco: ${p}`);
  return p;
}

async function wireNetwork(cdp: CDPSession, events: NetEvent[]): Promise<void> {
  const byId = new Map<string, NetEvent>();
  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", (msg) => {
    const m = msg as {
      requestId: string;
      request: { url: string; method: string };
      timestamp: number;
    };
    const ev: NetEvent = {
      id: m.requestId,
      url: m.request.url,
      method: m.request.method,
      startMs: Math.round(m.timestamp * 1000),
    };
    byId.set(m.requestId, ev);
    events.push(ev);
  });
  cdp.on("Network.responseReceived", (msg) => {
    const m = msg as {
      requestId: string;
      response: { status: number; mimeType?: string };
    };
    const ev = byId.get(m.requestId);
    if (!ev) return;
    ev.status = m.response.status;
    ev.mimeType = m.response.mimeType;
  });
  cdp.on("Network.loadingFinished", (msg) => {
    const m = msg as { requestId: string; encodedDataLength: number; timestamp: number };
    const ev = byId.get(m.requestId);
    if (!ev) return;
    ev.endMs = Math.round(m.timestamp * 1000);
    ev.size = m.encodedDataLength;
  });
}

async function sampleDom(page: Page, filename: string, t0: number): Promise<DomSample> {
  return page.evaluate(
    `((fname, t0) => {
      const modal = document.querySelector(".jobs-easy-apply-modal");
      const token = fname.replace(/\\.pdf$/i, "").slice(0, 28).toLowerCase();
      const out = {
        tMs: Date.now() - t0,
        ourBusyHeuristic: false,
        filenameVisible: false,
        deselectAria: [],
        selectAria: [],
        spinners: [],
        rows: [],
      };
      if (!modal) return out;

      function norm(s) {
        return (s || "").toLowerCase();
      }
      out.filenameVisible = !!modal.innerText.toLowerCase().includes(token);

      for (const el of Array.from(modal.querySelectorAll('[aria-label^="Deselect resume" i]'))) {
        out.deselectAria.push((el.getAttribute("aria-label") || "").trim());
      }
      for (const el of Array.from(modal.querySelectorAll('[aria-label^="Select resume" i]'))) {
        out.selectAria.push((el.getAttribute("aria-label") || "").trim());
      }

      function rowBusy(root) {
        for (const el of Array.from(root.querySelectorAll("*"))) {
          const t = norm(el.textContent);
          if (!t.includes(token) || !t.includes(".pdf")) continue;
          const row =
            el.closest("li, label, [class*='document'], [class*='resume'], [class*='JobsDocument']") ||
            el.parentElement;
          if (
            row &&
            row.querySelector(
              "[class*='loading'], [class*='spinner'], [aria-busy='true'], .artdeco-loader, progress"
            )
          ) {
            return true;
          }
        }
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot && rowBusy(el.shadowRoot)) return true;
        }
        return false;
      }
      const outlet = modal.querySelector("#interop-outlet");
      out.ourBusyHeuristic =
        (outlet && outlet.shadowRoot && rowBusy(outlet.shadowRoot)) || rowBusy(modal);

      function walk(root) {
        for (const el of Array.from(
          root.querySelectorAll(
            ".artdeco-loader, [class*='spinner'], [class*='loading'], [aria-busy='true'], progress"
          )
        )) {
          const near =
            (el.closest("li, label, [class*='document'], [class*='resume']") || el.parentElement)
              ?.textContent || "";
          out.spinners.push({
            tag: el.tagName,
            className: (el.className || "").toString().slice(0, 120),
            aria: (el.getAttribute("aria-busy") || el.getAttribute("aria-label") || "").slice(0, 80),
            nearPdf: near.replace(/\\s+/g, " ").trim().slice(0, 100),
          });
        }
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      }
      if (outlet && outlet.shadowRoot) walk(outlet.shadowRoot);
      walk(modal);

      function collectRows(root) {
        for (const row of Array.from(
          root.querySelectorAll("li, [class*='JobsDocument'], [class*='document-card']")
        )) {
          const text = (row.textContent || "").replace(/\\s+/g, " ").trim();
          if (!/\\.pdf/i.test(text)) continue;
          const loader = row.querySelector(
            ".artdeco-loader, [class*='spinner'], [class*='loading'], [aria-busy='true'], progress"
          );
          out.rows.push({
            text: text.slice(0, 120),
            hasLoader: !!loader,
            loaderClass: loader ? (loader.className || "").toString().slice(0, 100) : "",
          });
        }
        for (const el of Array.from(root.querySelectorAll("*"))) {
          if (el.shadowRoot) collectRows(el.shadowRoot);
        }
      }
      if (outlet && outlet.shadowRoot) collectRows(outlet.shadowRoot);
      collectRows(modal);

      return out;
    })(${JSON.stringify(filename)}, ${t0})`
  ) as Promise<DomSample>;
}

async function gotoResumeStep(page: Page): Promise<void> {
  const url = `https://www.linkedin.com/jobs/view/${JOB_ID}/`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForJobPageReady(page);
  if (!(await clickEasyApply(page))) {
    throw new Error("No pude abrir Easy Apply");
  }
  await waitForEasyApplyModalReady(page);
  const scope = await resolveApplyScope(page);
  if (!scope) throw new Error("Modal Easy Apply no visible");
  const advance = await findWizardStepAdvanceButton(scope, page);
  if (advance && (await advance.locator.isVisible({ timeout: 2000 }).catch(() => false))) {
    await clickSafeInEasyApply(advance.locator, { timeoutMs: 5000 });
    await sleep(1500);
  }
}

async function uploadResume(page: Page, pdfPath: string): Promise<void> {
  const scope = await resolveApplyScope(page);
  if (!scope) throw new Error("Modal no visible para upload");
  const uploadBtn = scope
    .getByRole("button", { name: UPLOAD_RESUME_BTN_RE })
    .or(scope.locator("button, a, span[role='button']").filter({ hasText: UPLOAD_RESUME_BTN_RE }))
    .first();
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15_000 }),
    clickSafeInEasyApply(uploadBtn, { timeoutMs: 5000 }),
  ]);
  await fileChooser.setFiles(pdfPath);
}

async function main(): Promise<void> {
  const pdfPath = pickCvPath();
  const stat = fs.statSync(pdfPath);
  const sessionPath = resolveSessionPath();
  const browser = await chromium.launch({
    headless: resolvePlaywrightHeadless(),
    slowMo: 0,
    args: [...MAXIMIZED_LAUNCH_ARGS],
  });
  const context = await browser.newContext(maximizedContextOptions(sessionPath));
  const page = await prepareApplyBrowserPage(context);
  await maximizeWindow(page);
  const cdp = await context.newCDPSession(page);
  const net: NetEvent[] = [];
  await wireNetwork(cdp, net);

  const samples: DomSample[] = [];
  const t0 = Date.now();
  let poll = true;
  const pollTimer = setInterval(async () => {
    if (!poll) return;
    try {
      samples.push(await sampleDom(page, CV_NAME, t0));
    } catch {
      /* page navigating */
    }
  }, 500);

  try {
    console.log(`🔬 Probe job=${JOB_ID} cv=${CV_NAME} (${stat.size} bytes)`);
    await gotoResumeStep(page);
    console.log("   → Resume step listo, subiendo PDF…");
    const uploadAt = Date.now() - t0;
    await uploadResume(page, pdfPath);
    console.log(`   → Upload disparado @ ${uploadAt}ms, muestreando 45s…`);
    await sleep(45_000);
  } finally {
    poll = false;
    clearInterval(pollTimer);
    await browser.close().catch(() => {});
  }

  const docNet = net.filter(
    (e) =>
      /resume|document|upload|media|voyager|dash|file/i.test(e.url) &&
      !/analytics|tracking|sensor|ads/i.test(e.url)
  );

  const firstVisible = samples.find((s) => s.filenameVisible);
  const firstDeselect = samples.find((s) => s.deselectAria.some((a) => a.toLowerCase().includes("ggzlinkedin")));
  const firstNotBusy = samples.find((s) => s.filenameVisible && !s.ourBusyHeuristic);
  const lastBusy = [...samples].reverse().find((s) => s.ourBusyHeuristic);

  const report = {
    jobId: JOB_ID,
    cvName: CV_NAME,
    pdfBytes: stat.size,
    pdfPath,
    summary: {
      uploadAtMs: samples.find((s) => s.tMs > 0)?.tMs,
      filenameVisibleAtMs: firstVisible?.tMs ?? null,
      deselectAtMs: firstDeselect?.tMs ?? null,
      ourHeuristicClearAtMs: firstNotBusy?.tMs ?? null,
      ourHeuristicBusyUntilMs: lastBusy?.tMs ?? null,
      sampleCount: samples.length,
    },
    samples: samples.filter((_, i) => i % 4 === 0),
    network: docNet.slice(-80),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`\n📄 Reporte → ${OUT_PATH}`);
  console.log("Resumen:");
  console.log(JSON.stringify(report.summary, null, 2));
  if (firstNotBusy && firstDeselect && firstNotBusy.tMs > (firstDeselect.tMs ?? 0) + 5000) {
    console.log(
      "\n⚠ Heurística 'busy' sigue true después de Deselect resume — posible falso positivo."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
