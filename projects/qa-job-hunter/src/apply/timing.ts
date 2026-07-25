/**
 * Waits calibrados Easy Apply / pipeline (#143 B24).
 * Preferir wait a selector/loader; sleeps fijos solo como settle corto.
 *
 * Criterios:
 * - Acortar: networkidle largo, sleeps 1.5–2.5s post-Next/Submit.
 * - Holgado: delays tipado humano, jitter entre avisos (anti-ban), timeouts de click.
 * - Perf test: budget 25s / fail 45s por página de modal (`PERF_TEST=1`).
 */

import type { Page } from "playwright";

export const TIMING = {
  /** Post-Next/Review/Continue — antes 1500–2000ms */
  modalStepMs: 550,
  /** Tras click Submit antes de buscar Done — antes 2500ms */
  afterSubmitMs: 900,
  /** Tras Done / banner — antes 1500ms */
  afterDoneMs: 700,
  /** Entre avisos (mín + jitter) — antes 2000 + 0–1500 */
  betweenJobsMinMs: 700,
  betweenJobsJitterMs: 800,
  /** Settle job page tras selectores — antes 600ms */
  jobPageSettleMs: 200,
  /** Settle modal tras loader — antes 400ms */
  modalReadySettleMs: 150,
  /** Tras scroll form — antes 350ms */
  scrollSettleMs: 150,
  /** Soft networkidle (LinkedIn casi nunca “idle”) — antes 15s/8s */
  networkIdleSoftMs: 2500,
  /** Save → reintentar Submit — antes 1000ms */
  afterSaveMs: 450,
  /** Textarea fill → Next — antes 800ms */
  afterTextareaFillMs: 350,
} as const;

/** Waits scrape/discover (B24-02) — LinkedIn search opt-in. */
export const SCRAPE = {
  /** Tras goto search/collection — antes 3000ms */
  afterGotoMs: 1200,
  /** Entre scrolls de lista — antes 1500ms */
  scrollSettleMs: 600,
  /** Tras click card → panel detalle — antes 2000ms */
  afterCardClickMs: 800,
  /** Tras "see more" descripción — antes 500ms */
  afterSeeMoreMs: 300,
  /** Timeout wait cards visibles */
  resultsVisibleMs: 8000,
} as const;

/** Umbrales de performance testing (página de modal Easy Apply). */
export const PERF = {
  /** Meta: máximo aceptable por página de modal */
  modalPageBudgetMs: 25_000,
  /** > esto = FAIL en perf test */
  modalPageFailMs: 45_000,
} as const;

export type ModalPagePerfVerdict = "pass" | "over_budget" | "fail";

export type ModalPagePerfSample = {
  label: string;
  ms: number;
  verdict: ModalPagePerfVerdict;
};

export function verdictForModalPageMs(ms: number): ModalPagePerfVerdict {
  if (ms > PERF.modalPageFailMs) return "fail";
  if (ms > PERF.modalPageBudgetMs) return "over_budget";
  return "pass";
}

export function isPerfTestEnabled(): boolean {
  const v = (process.env.PERF_TEST ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isPerfFailHardEnabled(): boolean {
  if ((process.env.PERF_FAIL_HARD ?? "").trim() === "0") return false;
  if ((process.env.PERF_FAIL_HARD ?? "").trim() === "1") return true;
  return isPerfTestEnabled();
}

export class ModalPagePerfError extends Error {
  constructor(public readonly sample: ModalPagePerfSample) {
    super(
      `PERF FAIL: página modal "${sample.label}" ${(sample.ms / 1000).toFixed(1)}s > ${
        PERF.modalPageFailMs / 1000
      }s`
    );
    this.name = "ModalPagePerfError";
  }
}

/** Cronometra cada página del modal; con PERF_TEST falla si alguna >45s. */
export class ModalPageTimer {
  private startedAt = 0;
  private label = "";
  readonly samples: ModalPagePerfSample[] = [];
  private readonly failHard: boolean;

  constructor(opts?: { failHard?: boolean }) {
    this.failHard = opts?.failHard ?? isPerfFailHardEnabled();
  }

  start(label: string): void {
    if (this.startedAt) this.end();
    this.label = label;
    this.startedAt = Date.now();
  }

  end(): ModalPagePerfSample | null {
    if (!this.startedAt) return null;
    const ms = Date.now() - this.startedAt;
    const verdict = verdictForModalPageMs(ms);
    const sample: ModalPagePerfSample = { label: this.label || "paso", ms, verdict };
    this.samples.push(sample);
    this.startedAt = 0;
    const icon = verdict === "pass" ? "✓" : verdict === "over_budget" ? "⚠" : "✗";
    console.log(
      `   ${icon} perf página "${sample.label}": ${(ms / 1000).toFixed(1)}s` +
        ` (budget ${PERF.modalPageBudgetMs / 1000}s / fail ${PERF.modalPageFailMs / 1000}s)`
    );
    if (verdict === "fail" && this.failHard) {
      throw new ModalPagePerfError(sample);
    }
    return sample;
  }

  hasFails(): boolean {
    return this.samples.some((s) => s.verdict === "fail");
  }

  logSummary(): void {
    if (this.samples.length === 0) return;
    console.log("\n⏱ Perf páginas modal:");
    for (const s of this.samples) {
      const tag =
        s.verdict === "pass" ? "PASS" : s.verdict === "over_budget" ? "OVER" : "FAIL";
      console.log(`   [${tag}] ${s.label}: ${(s.ms / 1000).toFixed(1)}s`);
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function betweenJobsDelayMs(): number {
  return TIMING.betweenJobsMinMs + Math.random() * TIMING.betweenJobsJitterMs;
}

/** Tras avanzar un paso del modal: loader oculto + settle corto. */
export async function waitForEasyApplyStepSettle(page: Page): Promise<void> {
  await page
    .locator(".jobs-easy-apply-modal .artdeco-loader, [role='dialog'] .artdeco-loader")
    .first()
    .waitFor({ state: "hidden", timeout: 8000 })
    .catch(() => {});
  // Contenido del form vuelve a ser interactivo
  await page
    .locator(
      ".jobs-easy-apply-modal input, .jobs-easy-apply-modal button, [role='dialog'] input, [role='dialog'] button"
    )
    .first()
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => {});
  await sleep(TIMING.modalStepMs);
}
