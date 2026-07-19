// Relleno pseudo-hardcodeado + captura de campos obligatorios (Easy Apply).
// Cuando Next no avanza: dump de required → cerrar sesión para completar respuestas.

import fs from "fs";
import path from "path";
import type { Locator, Page } from "playwright";
import { APPLY_DIR, ensureDirs } from "./paths.js";
import { dismissModalOverlays, easyApplyModalRoot } from "./modal-controls.js";
import { resolveSkillYesNo } from "./my-skills.js";
import {
  detectApplyRoleKind,
  resolveApplicationSummary,
  resolveCoverLetterPdfPath,
  RESUME_FILE_MATCH,
  scoreResumeForRole,
  type ApplyRoleKind,
} from "./canonical-text.js";

export interface CapturedField {
  label: string;
  tag: string;
  inputType: string;
  name: string;
  id: string;
  required: boolean;
  value: string;
  ariaLabel: string;
  placeholder: string;
  errorText: string;
  /** true si no es required (para inventario multi-escenario). */
  optional?: boolean;
  /** radio / checkbox / text / select / combobox / textarea / unknown */
  scenarioKind?: string;
}

/** Pseudo-respuestas (ampliar a mano hasta B17-2 con apply-answers.json). */
export const PSEUDO_ANSWERS = {
  locationCity: {
    /**
     * Solo Location (city) typeahead de LinkedIn — NO "preferred location for work".
     */
    fieldMatch: /location\s*\(city\)|ubicaci[oó]n\s*\(ciudad\)|comuna|localidad|where do you live/i,
    hintMatch: /comuna\s*9/i,
    typeText: "Liniers",
    suggestionMatch: /Liniers/i,
    preferredSuggestion: /Liniers[\s\S]*Comuna\s*9|Comuna\s*9[\s\S]*Liniers/i,
    validValue: /Liniers/i,
    validValueExtra: /Comuna\s*9|,/i,
  },
  country: {
    /** Solo Country del form (Greenhouse). NO "Phone country code". */
    fieldMatch: /^(country|pa[ií]s)\s*\*?$/i,
    selectText: /Argentina/i,
  },
  linkedinProfile: {
    fieldMatch: /linkedin\s*profile|perfil\s*de\s*linkedin|linkedin\s*url/i,
    value: "https://www.linkedin.com/in/gabriela-garayzavalia",
  },
  portfolio: {
    fieldMatch: /portfolio\s*link|portfolio|portafolio|personal\s*website|github\.io/i,
    value: "https://gabrielagarayzavalia.github.io/linkedin-bug-report/",
  },
  /** Remuneración pretendida bruta (mensual). */
  expectedCompensation: {
    fieldMatch:
      /expected\s*(salary|compensation|pay|ctc)|salary\s*expectation|desired\s*salary|compensation\s*expectation|financial expectations|remuneraci[oó]n(\s*pretendida)?|sueldo\s*(pretendido|esperado|bruto)|pretensi[oó]n\s*salarial|salario\s*(bruto|esperado|deseado)|current\s*salary|annual\s*salary|monthly\s*(gross|salary)|gross\s*(salary|pay)/i,
    usdMatch: /\b(usd|u\$s|us\$|d[oó]lar(es)?|dollars?)\b|\$\s*usd/i,
    arsMatch: /\b(ars|peso(s)?(\s*argentinos?)?|\$\s*ar|arg(?:entina)?)\b/i,
    usdValue: "2750",
    arsValue: "3500000",
    /** Sin moneda explícita → ARS (contexto AR). */
    defaultCurrency: "ARS",
  },
  startAvailability: {
    fieldMatch:
      /when can you (start|begin)|available to start|earliest (start|availability)|start date|fecha de (inicio|ingreso)|cu[aá]ndo (pod[eé]s?|puede) (empezar|comenzar|iniciar)|disponib(ilidad|le) para (empezar|comenzar)|notice period/i,
    en: "Immediately",
    es: "Inmediatamente",
  },
  workOrLiveCityFreeText: {
    fieldMatch:
      /where (would you like to work|do you (live|want to work)|are you (based|located))|work location|based in|d[oó]nde (viv|te gustar[ií]a trabajar|prefer[ií]s trabajar)|ciudad (de residencia|donde)|lugar de (trabajo|residencia)/i,
    en: "Buenos Aires city, Argentina",
    es: "Ciudad Autonoma de Buenos Aires, Argentina",
  },
  /** Preferred location / (Country, city) — texto fijo. */
  preferredWorkLocation: {
    fieldMatch:
      /preferred location for work|preferred (work )?location|location for work\s*\(?\s*country|(country\s*,\s*city)|(pa[ií]s\s*,\s*ciudad)/i,
    /** Formato (Country, city). */
    countryCityValue: "Argentina, Ciudad Autónoma de Buenos Aires",
    /** Texto libre ciudad. */
    cityTextValue: "Ciudad Autónoma de Buenos Aires, Argentina",
    value: "Argentina, Ciudad Autónoma de Buenos Aires",
  },
  citySelect: {
    fieldMatch: /^(city|ciudad)\s*\*?$/i,
    /** En LinkedIn dropdown CABA no existe → Liniers, Comuna 9. */
    preferredOption: /Liniers|Comuna\s*9/i,
    optionMatch: /Liniers|Comuna\s*9|Ciudad Aut[oó]noma de Buenos Aires|Autonomous City of Buenos Aires|Buenos Aires/i,
    typeText: "Liniers",
  },
  englishProficiency: {
    fieldMatch:
      /english\s*(level|proficiency|skill)|nivel de ingl[eé]s|proficiency in english|idioma:?\s*ingl[eé]s/i,
    freeText: "Advanced (C1)",
    selectMatch: /advanced|c1|professional|proficient|fluent|b2|upper.?intermediate/i,
    preferredSelect: /advanced|c1|professional/i,
  },
  consentCheckbox: {
    fieldMatch:
      /i consent|consent|select checkbox to proceed|autorizo|acepto (los |las )?(t[eé]rminos|condiciones)|privacy policy|pol[ií]tica de privacidad/i,
  },
  /** Años por skill (SQL/Python/…): sin mapa → pendiente (no enviar). */
  yearsOfExperience: {
    fieldMatch:
      /years?\s+of\s+experience\s+(with|in|using)|a[nñ]os?\s+(de\s+)?experiencia\s+(con|en|usando)|how many years\s+(of\s+)?(experience\s+)?(with|in|using)|cu[aá]ntos a[nñ]os\s+(de\s+)?experiencia\s+(con|en)/i,
  },
  /** Frameworks DQ: No + dejar pendiente. */
  dataQualityFrameworks: {
    fieldMatch: /deequ|great expectations|data quality framework/i,
  },
  howDidYouHear: {
    fieldMatch:
      /where did you (learn|hear) about|how did you (learn|hear|find) (about|out)|c[oó]mo te enteraste|c[oó]mo te enteraste de/i,
    typeText: "LinkedIn",
    suggestionMatch: /LinkedIn/i,
  },
} as const;

const EMPTY_SELECT_RE = /select an option|seleccion(a|á)|choose|elegí|elegir/i;
const PLEASE_SELECT_RE = /please make a selection|hac[eé] una selecci[oó]n|seleccion(a|á) una opci[oó]n/i;

export function isSummaryLabel(blob: string): boolean {
  return /summary|resumen(\s*profesional)?|professional\s*summary|about\s*you|tell\s*us\s*about/i.test(
    blob
  );
}

export function isCoverLetterLabel(blob: string): boolean {
  return /cover\s*letter|carta\s*de\s*presentaci[oó]n|introduction\s*letter|intro\s*letter/i.test(
    blob
  );
}

/** Cover letter / summary: sí se pisan (o upload). Resto: respetar prefill. */
export function isCoverOrSummaryLabel(blob: string): boolean {
  return isSummaryLabel(blob) || isCoverLetterLabel(blob) || /\bmessage\b|\bmensaje\b/i.test(blob);
}

/** ¿Ya hay respuesta usable? (no placeholder de select vacío). */
export function hasPrefillValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (EMPTY_SELECT_RE.test(v)) return false;
  if (v === "0") return false;
  return true;
}

function prefersSpanish(blob: string): boolean {
  return /[áéíóúñ¿¡]|\b(d[oó]nde|cu[aá]ndo|ciudad|disponib|empezar|viv[ií]|gustar[ií]a|pretendid|salario|pa[ií]s)\b/i.test(
    blob
  );
}

export class RequiredFieldsBlockedError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly url: string,
    public readonly fields: CapturedField[],
    public readonly dumpPath: string
  ) {
    super(
      `STOP: Next bloqueado por campos obligatorios (${fields.length}). Dump: ${dumpPath}`
    );
    this.name = "RequiredFieldsBlockedError";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function scopeRoot(page: Page): Locator {
  return page
    .locator(
      ".jobs-easy-apply-modal, [role='dialog'], .jobs-easy-apply-content, div[class*='jobs-easy-apply'], main"
    )
    .first();
}

async function fieldLabel(el: Locator): Promise<string> {
  const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
  if (aria) return aria;
  const id = (await el.getAttribute("id").catch(() => "")) ?? "";
  if (id) {
    const byFor = el.page().locator(`label[for="${id}"]`).first();
    const t = (await byFor.innerText().catch(() => "")).trim();
    if (t) return t.slice(0, 200);
  }
  const near = await el
    .evaluate((node) => {
      const wrap =
        node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
        node.parentElement;
      const label = wrap?.querySelector("label, legend, span[class*='label']");
      return (label?.textContent ?? "").trim().slice(0, 200);
    })
    .catch(() => "");
  if (near) return near;
  return ((await el.getAttribute("placeholder")) ?? "").trim();
}

async function fieldError(el: Locator): Promise<string> {
  return el
    .evaluate((node) => {
      const wrap =
        node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
        node.parentElement;
      const err = wrap?.querySelector(
        "[error], .artdeco-inline-feedback--error, span[class*='error'], div[class*='error']"
      );
      return (err?.textContent ?? "").trim().slice(0, 200);
    })
    .catch(() => "");
}

function scenarioKindFor(tag: string, inputType: string): string {
  if (inputType === "radio") return "radio";
  if (inputType === "checkbox") return "checkbox";
  if (tag === "select" || inputType === "select-one") return "select";
  if (tag === "textarea") return "textarea";
  if (inputType === "tel" || inputType === "email" || inputType === "url" || inputType === "text") {
    return inputType === "text" ? "text" : inputType;
  }
  if (tag === "input" || inputType === "combobox") return "combobox_or_text";
  return "unknown";
}

async function collectVisibleFields(
  page: Page,
  opts: { onlyBlockingCandidates: boolean }
): Promise<CapturedField[]> {
  const root = scopeRoot(page);
  if (!(await root.isVisible({ timeout: 2000 }).catch(() => false))) return [];

  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']), textarea, select, [role='combobox'], [contenteditable='true']"
  );
  const n = await controls.count();
  const out: CapturedField[] = [];

  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;

    const tag = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
    const inputType = ((await el.getAttribute("type")) ?? tag).toLowerCase();
    const name = (await el.getAttribute("name").catch(() => "")) ?? "";
    const id = (await el.getAttribute("id").catch(() => "")) ?? "";
    const ariaRequired = (await el.getAttribute("aria-required").catch(() => "")) === "true";
    const htmlRequired = (await el.getAttribute("required").catch(() => "")) !== null;
    const ariaLabel = ((await el.getAttribute("aria-label")) ?? "").trim();
    const placeholder = ((await el.getAttribute("placeholder")) ?? "").trim();
    const value =
      tag === "select"
        ? ((await el.inputValue().catch(() => "")) ?? "").trim()
        : ((await el.inputValue().catch(() => "")) ?? (await el.innerText().catch(() => ""))).trim();
    const label = await fieldLabel(el);
    const errorText = await fieldError(el);
    const starred = /\*/.test(label) || /\*/.test(ariaLabel);
    const required = ariaRequired || htmlRequired || starred || Boolean(errorText);
    const optional = !required;

    // Modo legacy: solo obligatorios / error / vacíos relevantes
    if (opts.onlyBlockingCandidates) {
      if (!ariaRequired && !htmlRequired && !errorText && !starred && value) continue;
    }

    out.push({
      label: label || ariaLabel || placeholder || name || id || `(unnamed ${tag})`,
      tag,
      inputType,
      name,
      id,
      required: required || Boolean(errorText),
      optional,
      scenarioKind: scenarioKindFor(tag, inputType),
      value,
      ariaLabel,
      placeholder,
      errorText,
    });
  }

  // Errores sueltos del modal
  const errNodes = root.locator(
    ".artdeco-inline-feedback--error, [class*='error'] li, span.artdeco-inline-feedback__message"
  );
  const errCount = await errNodes.count().catch(() => 0);
  for (let i = 0; i < Math.min(errCount, 10); i++) {
    const t = (await errNodes.nth(i).innerText().catch(() => "")).trim();
    if (!t) continue;
    if (out.some((f) => f.errorText.includes(t) || f.label.includes(t))) continue;
    out.push({
      label: `(error) ${t.slice(0, 120)}`,
      tag: "error",
      inputType: "error",
      name: "",
      id: "",
      required: true,
      optional: false,
      scenarioKind: "error",
      value: "",
      ariaLabel: "",
      placeholder: "",
      errorText: t,
    });
  }

  return out;
}

/** Lista campos visibles (prioriza required / con error / vacíos). */
export async function captureRequiredFields(page: Page): Promise<CapturedField[]> {
  return collectVisibleFields(page, { onlyBlockingCandidates: true });
}

/**
 * Inventario completo del paso actual (required + optional) tras scrolldown.
 * Sirve para cubrir escenarios Easy Apply distintos (no siempre mismos campos).
 */
export async function inventoryEasyApplyFields(page: Page): Promise<CapturedField[]> {
  return collectVisibleFields(page, { onlyBlockingCandidates: false });
}

/** Persiste inventario multi-escenario para ampliar PSEUDO_ANSWERS / apply-answers.json. */
export function saveEasyApplyFieldInventory(
  jobId: string,
  url: string,
  step: number,
  fields: CapturedField[]
): string {
  ensureDirs();
  const required = fields.filter((f) => f.required);
  const optional = fields.filter((f) => f.optional);
  const byKind: Record<string, number> = {};
  for (const f of fields) {
    const k = f.scenarioKind ?? "unknown";
    byKind[k] = (byKind[k] ?? 0) + 1;
  }
  const payload = {
    at: new Date().toISOString(),
    jobId,
    url,
    step,
    counts: { total: fields.length, required: required.length, optional: optional.length, byKind },
    fields,
    improvementHint: {
      addKnownAnswersIn: ["src/apply/fill-answers.ts → PSEUDO_ANSWERS", "src/apply/apply-answers.example.json"],
      note:
        "Cada aviso Easy Apply puede traer un subconjunto distinto de campos/preguntas. " +
        "Usá este dump para agregar matchers (label regex → valor) sin asumir un formulario fijo.",
      uncoveredRequired: required
        .filter((f) => !f.value || EMPTY_SELECT_RE.test(f.value))
        .map((f) => ({ label: f.label, kind: f.scenarioKind, errorText: f.errorText })),
    },
  };
  const file = path.join(APPLY_DIR, `field-inventory-${jobId}-step${step}.json`);
  const latest = path.join(APPLY_DIR, "field-inventory-latest.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  fs.writeFileSync(latest, JSON.stringify(payload, null, 2), "utf-8");
  return file;
}

export function logFieldInventory(fields: CapturedField[]): void {
  const req = fields.filter((f) => f.required);
  const opt = fields.filter((f) => f.optional);
  console.log(`   📋 Inventario campos: ${fields.length} (req=${req.length}, opc=${opt.length})`);
  for (const f of fields.slice(0, 12)) {
    const flag = f.required ? "REQ" : "opc";
    console.log(
      `      [${flag}] ${f.label}` +
        (f.value ? ` = ${f.value.slice(0, 40)}` : " (vacío)") +
        ` · ${f.scenarioKind ?? f.tag}`
    );
  }
  if (fields.length > 12) console.log(`      … +${fields.length - 12} más (ver field-inventory-*.json)`);
}

export function saveRequiredFieldsDump(
  jobId: string,
  url: string,
  fields: CapturedField[]
): string {
  ensureDirs();
  const payload = {
    at: new Date().toISOString(),
    jobId,
    url,
    fields,
    note: "Completá PSEUDO_ANSWERS en fill-answers.ts o apply-answers.json y reintentá dry-run.",
  };
  const file = path.join(APPLY_DIR, `required-fields-${jobId}.json`);
  const latest = path.join(APPLY_DIR, "required-fields-latest.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
  fs.writeFileSync(latest, JSON.stringify(payload, null, 2), "utf-8");
  return file;
}

export function logCapturedFields(fields: CapturedField[]): void {
  console.error("\n📋 Campos obligatorios / bloqueantes:");
  if (fields.length === 0) {
    console.error("   (no se detectaron inputs required — revisá screenshot/manual)");
    return;
  }
  for (const f of fields) {
    console.error(
      `   • ${f.label}` +
        (f.errorText ? ` | error: ${f.errorText}` : "") +
        (f.value ? ` | value: ${f.value}` : " | (vacío)") +
        ` | ${f.tag}/${f.inputType}`
    );
  }
}

async function findLocationInput(page: Page): Promise<Locator | null> {
  const root = scopeRoot(page);
  const inputs = root.locator(
    "input:not([type='hidden']):not([type='file']), [role='combobox'] input, [role='combobox']"
  );
  const n = await inputs.count();
  const { fieldMatch, hintMatch } = PSEUDO_ANSWERS.locationCity;

  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    const blob = `${label} ${aria} ${ph} ${val}`;
    // No confundir con "preferred location for work"
    if (PSEUDO_ANSWERS.preferredWorkLocation.fieldMatch.test(blob)) continue;
    if (fieldMatch.test(blob) || hintMatch.test(blob)) return el;
  }
  return null;
}

function locationValueOk(val: string): boolean {
  const { validValue, validValueExtra } = PSEUDO_ANSWERS.locationCity;
  return validValue.test(val) && validValueExtra.test(val);
}

function typeaheadHits(page: Page): Locator {
  return page.locator(
    [
      "[data-test-single-typeahead-entity-form-search-result]",
      ".basic-typeahead__selectable",
      "[role='listbox'] [role='option']",
      "[role='option']",
      ".search-typeahead-v2__hit",
      ".search-typeahead-v2__hit--autocomplete",
    ].join(", ")
  );
}

/** Espera input/control usable (visible + enabled), como base antes de tipar. */
async function waitForControlReady(el: Locator, timeoutMs = 6000): Promise<boolean> {
  try {
    await el.waitFor({ state: "visible", timeout: timeoutMs });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const disabled = await el.isDisabled().catch(() => true);
      if (!disabled) return true;
      await sleep(150);
    }
    return !(await el.isDisabled().catch(() => true));
  } catch {
    return false;
  }
}

/** Espera lista predictiva (typeahead) — mismo patrón que Location. */
async function waitForTypeaheadList(page: Page, timeoutMs = 4500): Promise<boolean> {
  try {
    await typeaheadHits(page).first().waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fill robusto: waitFor ready → click → escribir; si aparece listbox, esperar hits.
 * Reintenta si el valor no queda (campos que fallan por timing).
 */
async function fillInputWithWaits(
  page: Page,
  el: Locator,
  value: string,
  opts: {
    logName: string;
    maxAttempts?: number;
    /** Si true, usa pressSequentially y espera dropdown (aunque no sea Location). */
    expectTypeahead?: boolean;
    valueOk?: (val: string) => boolean;
  }
): Promise<boolean> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const ok =
    opts.valueOk ??
    ((val: string) => {
      const a = val.replace(/[,\s]/g, "");
      const b = value.replace(/[,\s]/g, "");
      return val === value || a === b || val.includes(value);
    });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!(await waitForControlReady(el))) {
        console.log(`   ↳ ${opts.logName}: waitFor visible/enabled falló (intento ${attempt}/${maxAttempts})`);
        await sleep(400);
        continue;
      }

      await el.click({ timeout: 4000, noWaitAfter: true }).catch(() =>
        el.click({ force: true, timeout: 2000, noWaitAfter: true })
      );
      await sleep(200);
      await el.press("Control+a").catch(() => {});
      await el.press("Backspace").catch(() => {});
      await el.fill("").catch(() => {});
      await sleep(150);

      if (opts.expectTypeahead) {
        await el.pressSequentially(value, { delay: 90 });
        const listOk = await waitForTypeaheadList(page, 4500);
        if (!listOk) {
          console.log(
            `   ↳ ${opts.logName}: lista predictiva no apareció (intento ${attempt}/${maxAttempts})`
          );
          await sleep(400);
          continue;
        }
      } else {
        await el.fill(value);
        // Algunos salary/URL abren sugerencias: esperar breve y cerrar sin pisar el valor
        const listOk = await waitForTypeaheadList(page, 1200);
        if (listOk) {
          await page.keyboard.press("Escape").catch(() => {});
          await sleep(200);
        }
      }

      await sleep(350);
      const after = ((await el.inputValue().catch(() => "")) ?? "").trim();
      if (ok(after)) {
        if (attempt > 1) {
          console.log(`   ↳ ${opts.logName}: OK tras reintento ${attempt}`);
        }
        return true;
      }
      console.log(
        `   ↳ ${opts.logName}: valor no quedó ("${after.slice(0, 50)}") — wait + reintento ${attempt}/${maxAttempts}`
      );
      await sleep(500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ↳ ${opts.logName}: error intento ${attempt}: ${msg.slice(0, 100)}`);
      await sleep(400);
    }
  }
  return false;
}

/** Click en el item del dropdown (obligatorio). Prefiere Liniers + Comuna 9. */
async function clickLocationSuggestion(page: Page): Promise<string | null> {
  const { preferredSuggestion, suggestionMatch } = PSEUDO_ANSWERS.locationCity;
  const hits = typeaheadHits(page);

  if (!(await waitForTypeaheadList(page, 4500))) {
    return null;
  }

  const preferred = hits.filter({ hasText: preferredSuggestion }).first();
  const fallback = hits.filter({ hasText: suggestionMatch }).first();

  await preferred.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  const target = (await preferred.isVisible({ timeout: 800 }).catch(() => false))
    ? preferred
    : fallback;

  try {
    await target.waitFor({ state: "visible", timeout: 2500 });
  } catch {
    return null;
  }

  const text = ((await target.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  // El click en el <li>/hit es lo que valida el GEO; tipear solo no alcanza.
  const clicked =
    (await target
      .click({ timeout: 4000, noWaitAfter: true })
      .then(() => true)
      .catch(() => false)) ||
    (await target
      .click({ force: true, timeout: 4000, noWaitAfter: true })
      .then(() => true)
      .catch(() => false));
  if (!clicked) return null;
  await sleep(700);
  return text || "Liniers";
}

/** Mensajes de error reales (NO el asterisco "required" del label genérico). */
const MANDATORY_FIELD_RE =
  /please enter a valid|please enter|is required\.|this field is required|mandatory field|campo obligatorio|enter a valid|please make a selection|hac[eé] una selecci[oó]n/i;

/** ¿Hay error mandatorio real en typeahead Location (vacío / inválido / feedback)? */
export async function hasMandatoryFieldError(page: Page): Promise<boolean> {
  const loc = await findLocationInput(page);
  if (loc) {
    const val = ((await loc.inputValue().catch(() => "")) ?? "").trim();
    const err = await fieldError(loc);
    if (err && MANDATORY_FIELD_RE.test(err)) return true;
    // Location visible pero GEO incompleto → hay que recover
    if (!locationValueOk(val)) {
      const label = await fieldLabel(loc);
      const starred = /\*/.test(label);
      const ariaReq = (await loc.getAttribute("aria-required").catch(() => "")) === "true";
      if (starred || ariaReq || !val) return true;
    }
  }

  const blocking = await hasBlockingEmptyFields(page);
  return blocking.some(
    (f) =>
      Boolean(f.errorText && MANDATORY_FIELD_RE.test(f.errorText)) ||
      ((PSEUDO_ANSWERS.locationCity.fieldMatch.test(f.label) ||
        PSEUDO_ANSWERS.locationCity.hintMatch.test(f.label)) &&
        !locationValueOk(f.value))
  );
}

/**
 * Click en el campo + reescribir hasta que aparezca el dropdown.
 * 3 intentos; si falla → false (caller cierra y prueba otra estrategia).
 */
async function typeaheadWithDropdownRetries(
  page: Page,
  input: Locator,
  typeText: string,
  labelForLog: string,
  valueOk: (val: string) => boolean,
  maxAttempts = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `   ↳ ${labelForLog}: click + tipear "${typeText}" hasta dropdown (intento ${attempt}/${maxAttempts})`
      );
      if (!(await waitForControlReady(input))) {
        console.log(`   ↳ ${labelForLog}: waitFor input no listo — reintento`);
        continue;
      }
      await input.click({ timeout: 4000, noWaitAfter: true }).catch(() =>
        input.click({ force: true, timeout: 2000, noWaitAfter: true })
      );
      await sleep(200);
      // Seleccionar todo y borrar (más fiable que fill("") en typeahead LinkedIn)
      await input.press("Control+a").catch(() => {});
      await input.press("Backspace").catch(() => {});
      await input.fill("").catch(() => {});
      await sleep(250);
      await input.pressSequentially(typeText, { delay: 100 });

      if (!(await waitForTypeaheadList(page, 4500))) {
        console.log(`   ↳ ${labelForLog}: waitFor lista predictiva — no apareció, reintento`);
        await input.click({ force: true, timeout: 2000, noWaitAfter: true }).catch(() => {});
        continue;
      }

      const picked = await clickLocationSuggestion(page);
      if (!picked) {
        await page.keyboard.press("ArrowDown").catch(() => {});
        await sleep(200);
        await page.keyboard.press("Enter").catch(() => {});
        await sleep(700);
      } else {
        console.log(`   ↳ ${labelForLog}: click en "${picked.slice(0, 90)}"`);
      }

      const after = ((await input.inputValue().catch(() => "")) ?? "").trim();
      if (valueOk(after)) {
        console.log(`   ↳ ${labelForLog}: valor OK → ${after.slice(0, 90)}`);
        return true;
      }

      // Error mandatorio tras elegir mal / no elegir
      if (await hasMandatoryFieldError(page)) {
        console.log(
          `   ↳ ${labelForLog}: sigue error mandatorio ("${after.slice(0, 50)}") — reintento`
        );
      } else {
        console.log(
          `   ↳ ${labelForLog}: valor aún inválido ("${after.slice(0, 60)}") — reintento`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ↳ ${labelForLog}: error intento ${attempt}: ${msg.slice(0, 120)}`);
    }
  }
  return false;
}

/** Location (city): tipear Liniers y CLICK en dropdown (Liniers, Comuna 9, …). Hasta 3 intentos. */
export async function fillLocationLiniers(page: Page): Promise<boolean> {
  const input = await findLocationInput(page);
  if (!input) return false;

  const label = await fieldLabel(input);
  const val = ((await input.inputValue().catch(() => "")) ?? "").trim();
  const blob = `${label} ${val}`;
  const { fieldMatch, hintMatch, typeText } = PSEUDO_ANSWERS.locationCity;

  if (!fieldMatch.test(blob) && !hintMatch.test(blob)) return false;

  // Respuesta ya cargada → no pisar (salvo GEO incompleto tipo "Liniers" sin Comuna)
  if (hasPrefillValue(val)) {
    if (locationValueOk(val)) return true;
    // Prefill parcial LinkedIn: intentar completar dropdown; si no, dejar lo que hay
    const completed = await typeaheadWithDropdownRetries(
      page,
      input,
      typeText,
      "Location",
      locationValueOk,
      3
    );
    if (completed) return true;
    console.log(`   ↳ Location: dejo prefill existente ("${val.slice(0, 60)}")`);
    return true;
  }

  const ok = await typeaheadWithDropdownRetries(page, input, typeText, "Location", locationValueOk, 3);
  if (ok) return true;

  // Sin dropdown: texto libre CABA / Buenos Aires city
  const free = prefersSpanish(blob)
    ? PSEUDO_ANSWERS.workOrLiveCityFreeText.es
    : PSEUDO_ANSWERS.workOrLiveCityFreeText.en;
  console.log(`   ↳ Location: sin lista predictiva → texto libre "${free}"`);
  return fillInputWithWaits(page, input, free, {
    logName: "Location (texto libre)",
    maxAttempts: 2,
    expectTypeahead: false,
    valueOk: (v) => hasPrefillValue(v),
  });
}

export type MandatoryRecoverResult = "ok" | "failed_close";

/**
 * Si hay error de campo mandatorio (p.ej. Location sin dropdown):
 * reintenta typeahead 3 veces; si falla, cierra el modal para otra estrategia.
 */
export async function recoverMandatoryTypeaheadOrClose(
  page: Page
): Promise<MandatoryRecoverResult> {
  const needs =
    (await hasMandatoryFieldError(page)) ||
    (await hasBlockingEmptyFields(page)).some((f) =>
      PSEUDO_ANSWERS.locationCity.fieldMatch.test(f.label)
    );
  if (!needs) return "ok";

  console.log("   ⚠ Campo mandatorio / typeahead — recover (máx. 3 intentos)…");
  const ok = await fillLocationLiniers(page);
  // Si Location ya tiene GEO válido o prefill, no cerrar.
  const loc = await findLocationInput(page);
  const locVal = loc ? ((await loc.inputValue().catch(() => "")) ?? "").trim() : "";
  if (ok || locationValueOk(locVal) || hasPrefillValue(locVal)) {
    console.log("   ✓ Recover typeahead OK (Location válido o prefill)");
    return "ok";
  }

  // Tras 3 intentos: cerrar modal y dejar para otra estrategia
  console.log(
    "   ✗ Typeahead mandatorio falló tras 3 intentos — cierro modal (otra estrategia después)"
  );
  const dismiss = page
    .locator(
      "button[aria-label='Dismiss'], button[aria-label='Cerrar'], button[aria-label*='Dismiss'], a[aria-label='Dismiss']"
    )
    .first();
  if (await dismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dismiss.click({ timeout: 4000 }).catch(() =>
      dismiss.click({ force: true, timeout: 4000 })
    );
  } else {
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
    // Save/Discard → Discard para no dejar basura inconsistente
    await handleSaveDiscardModal(page, "dry_run");
  }
  await sleep(600);
  return "failed_close";
}

/** Select Country → Argentina (Greenhouse Additional Questions). */
export async function fillCountrySelect(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, selectText } = PSEUDO_ANSWERS.country;

  // <select> nativo
  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 4000))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    // Evitar "Phone country code"
    if (/phone|tel[eé]fono|c[oó]digo/i.test(label)) continue;
    if (!fieldMatch.test(label) && !/^(country|pa[ií]s)\b/i.test(label)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    // Prefill válido → no pisar
    if (hasPrefillValue(val) && !EMPTY_SELECT_RE.test(val)) {
      console.log(`   ↳ Country: dejo prefill ("${val.slice(0, 40)}")`);
      return true;
    }
    const opt = el.locator("option").filter({ hasText: selectText }).first();
    await opt.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
    if (await opt.count().catch(() => 0)) {
      const v = await opt.getAttribute("value");
      if (v != null) {
        await el.selectOption(v);
        console.log(`   ↳ Country: seleccionado Argentina`);
        await sleep(400);
        return true;
      }
    }
    await el.selectOption({ label: "Argentina" }).catch(async () => {
      // Algunas UIs usan value ISO
      await el.selectOption({ value: "Argentina" }).catch(async () => {
        await el.selectOption({ value: "AR" }).catch(() => {});
      });
    });
    console.log(`   ↳ Country: select Argentina`);
    await sleep(400);
    return true;
  }

  // Dropdown custom (button + listbox)
  const combos = root.getByRole("combobox").or(root.locator("button").filter({ hasText: EMPTY_SELECT_RE }));
  // Prefer label Country*
  const countryLabel = root
    .locator("label")
    .filter({ hasText: /^(Country|Pa[ií]s)\s*\*?$/i })
    .first();
  if (!(await countryLabel.isVisible({ timeout: 600 }).catch(() => false))) {
    void combos;
    return false;
  }
  const countryBtn = countryLabel
    .locator("xpath=ancestor::*[self::div or self::li or self::fieldset][1]")
    .locator("select, button, [role='combobox']")
    .first();
  if (await countryBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    const text = ((await countryBtn.innerText().catch(() => "")) ?? "").trim();
    if (selectText.test(text)) return true;
    await countryBtn.click({ timeout: 3000 }).catch(() => {});
    await sleep(400);
    const opt = page.getByRole("option", { name: selectText }).first();
    if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await opt.click();
      console.log(`   ↳ Country: opción Argentina`);
      await sleep(400);
      return true;
    }
    const byText = page.getByText(/^Argentina$/i).first();
    if (await byText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await byText.click();
      console.log(`   ↳ Country: click Argentina`);
      await sleep(400);
      return true;
    }
  }

  void combos;
  return false;
}

function resolveCompensationValue(blob: string): { value: string; currency: "USD" | "ARS" } {
  const { usdMatch, arsMatch, usdValue, arsValue } = PSEUDO_ANSWERS.expectedCompensation;
  const hasUsd = usdMatch.test(blob);
  const hasArs = arsMatch.test(blob);
  if (hasUsd && !hasArs) return { value: usdValue, currency: "USD" };
  if (hasArs && !hasUsd) return { value: arsValue, currency: "ARS" };
  if (hasUsd && hasArs) {
    // Ambas señales → USD (suelen preguntar en dólares con mención de pesos)
    return { value: usdValue, currency: "USD" };
  }
  // Sin moneda explícita → ARS (contexto AR)
  return { value: arsValue, currency: "ARS" };
}

/** Remuneración pretendida: 2750 USD o 3.500.000 ARS según el campo. */
export async function fillExpectedCompensation(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch } = PSEUDO_ANSWERS.expectedCompensation;
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  let filled = false;

  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const name = ((await el.getAttribute("name")) ?? "").trim();
    const near = await el
      .evaluate((node) => {
        const wrap =
          node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
          node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 300);
      })
      .catch(() => "");
    const blob = `${label} ${aria} ${ph} ${name} ${near}`;
    if (!fieldMatch.test(blob)) continue;

    const { value, currency } = resolveCompensationValue(blob);
    const raw = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(raw)) {
      console.log(`   ↳ Remuneración: dejo prefill ("${raw.slice(0, 40)}")`);
      filled = true;
      continue;
    }

    const ok = await fillInputWithWaits(page, el, value, {
      logName: `Remuneración (${currency})`,
      maxAttempts: 3,
      expectTypeahead: false,
    });
    if (ok) {
      console.log(`   ↳ Remuneración pretendida (${currency}): ${value}`);
      filled = true;
    } else {
      console.log(`   ↳ Remuneración (${currency}): falló tras waits/reintentos`);
    }
  }

  return filled;
}

async function fillTextByFieldMatch(
  page: Page,
  fieldMatch: RegExp,
  value: string,
  logName: string
): Promise<boolean> {
  const root = scopeRoot(page);
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const blob = `${label} ${aria} ${ph}`;
    if (!fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    // Prefill (excepto cover/summary que se pisan en otro path)
    if (hasPrefillValue(current) && !isCoverOrSummaryLabel(blob)) {
      console.log(`   ↳ ${logName}: dejo prefill ("${current.slice(0, 50)}")`);
      return true;
    }
    const ok = await fillInputWithWaits(page, el, value, {
      logName,
      maxAttempts: 3,
      expectTypeahead: false,
      valueOk: (val) => val === value || val.includes(value) || val.includes("gabriela-garayzavalia"),
    });
    if (ok) {
      console.log(`   ↳ ${logName}: ${value}`);
      return true;
    }
    console.log(`   ↳ ${logName}: falló tras waits/reintentos`);
    return false;
  }
  return false;
}

/** Cuándo empezar → Immediately / Inmediatamente (input o select). */
export async function fillStartAvailability(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, en, es } = PSEUDO_ANSWERS.startAvailability;
  const immediateOpt = /immediate|inmediata|asap|available now|0\s*week|sin aviso|right away/i;

  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 2500))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    if (!fieldMatch.test(label) && !/notice period|availability to join/i.test(label)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(val) && immediateOpt.test(val)) {
      console.log(`   ↳ Start/notice: dejo prefill`);
      return true;
    }
    const opt = el.locator("option").filter({ hasText: immediateOpt }).first();
    await opt.waitFor({ state: "attached", timeout: 2000 }).catch(() => {});
    if (await opt.count().catch(() => 0)) {
      const v = await opt.getAttribute("value");
      const lab = ((await opt.innerText().catch(() => "")) ?? "Immediately").trim();
      if (v != null) await el.selectOption(v);
      else await el.selectOption({ label: lab }).catch(() => {});
      console.log(`   ↳ Start/notice select: ${lab.slice(0, 50)}`);
      await sleep(300);
      return true;
    }
  }

  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const blob = `${label} ${aria} ${ph}`;
    if (!fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(current)) {
      console.log(`   ↳ Start availability: dejo prefill ("${current.slice(0, 40)}")`);
      return true;
    }
    const value = prefersSpanish(blob) ? es : en;
    const ok = await fillInputWithWaits(page, el, value, {
      logName: "Start availability",
      maxAttempts: 2,
    });
    if (ok) console.log(`   ↳ Start availability: ${value}`);
    return ok;
  }
  return false;
}

/** Dónde vivís / trabajar — texto libre sin dropdown (solo si vacío). */
export async function fillWorkOrLiveCityFreeText(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, en, es } = PSEUDO_ANSWERS.workOrLiveCityFreeText;
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const blob = `${label} ${aria} ${ph}`;
    if (!fieldMatch.test(blob)) continue;
    // No pisar el Location (city) typeahead de LinkedIn (va por fillLocationLiniers)
    if (PSEUDO_ANSWERS.locationCity.fieldMatch.test(blob) && /location\s*\(city\)/i.test(blob)) {
      continue;
    }
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(current)) {
      console.log(`   ↳ Work/live city: dejo prefill ("${current.slice(0, 50)}")`);
      return true;
    }
    const value = prefersSpanish(blob) ? es : en;
    const ok = await fillInputWithWaits(page, el, value, {
      logName: "Work/live city",
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (ok) console.log(`   ↳ Work/live city: ${value}`);
    return ok;
  }
  return false;
}

/**
 * City <select> / combobox: CABA suele no existir en LinkedIn → Liniers, Comuna 9.
 * Texto libre City → Ciudad Autónoma de Buenos Aires, Argentina.
 */
export async function fillCitySelect(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, optionMatch, preferredOption, typeText } = PSEUDO_ANSWERS.citySelect;

  // <select>
  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 3000))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    if (!fieldMatch.test(label)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(val) && /Liniers|Comuna\s*9|Buenos Aires|Aut[oó]noma/i.test(val)) {
      console.log(`   ↳ City select: dejo prefill ("${val.slice(0, 50)}")`);
      return true;
    }
    const preferred = el.locator("option").filter({ hasText: preferredOption }).first();
    const fallback = el.locator("option").filter({ hasText: optionMatch }).first();
    await preferred.waitFor({ state: "attached", timeout: 2000 }).catch(() => {});
    const opt = (await preferred.count().catch(() => 0)) ? preferred : fallback;
    if (!(await opt.count().catch(() => 0))) continue;
    const v = await opt.getAttribute("value");
    const lab = ((await opt.innerText().catch(() => "")) ?? "Liniers, Comuna 9").trim();
    if (v != null) await el.selectOption(v);
    else await el.selectOption({ label: lab }).catch(() => {});
    console.log(`   ↳ City select: ${lab.slice(0, 60)}`);
    await sleep(300);
    return true;
  }

  // Combobox / typeahead City (sin CABA en lista → Liniers)
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio'])"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const blob = `${label} ${aria}`;
    if (!fieldMatch.test(label) && !/^(city|ciudad)\b/i.test(blob)) continue;
    if (PSEUDO_ANSWERS.locationCity.fieldMatch.test(blob)) continue;
    if (PSEUDO_ANSWERS.preferredWorkLocation.fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(current) && /Liniers|Buenos Aires|Aut[oó]noma/i.test(current)) {
      return true;
    }
    const role = ((await el.getAttribute("role")) ?? "").toLowerCase();
    const list = ((await el.getAttribute("aria-autocomplete")) ?? "").toLowerCase();
    const isTypeahead = role === "combobox" || list === "list" || list === "both";
    if (isTypeahead) {
      const ok = await typeaheadWithDropdownRetries(
        page,
        el,
        typeText,
        "City",
        (v) => /Liniers/i.test(v),
        3
      );
      if (ok) {
        console.log("   ↳ City (dropdown): Liniers, Comuna 9");
        return true;
      }
    }
    // Texto libre
    const free = PSEUDO_ANSWERS.preferredWorkLocation.cityTextValue;
    const ok = await fillInputWithWaits(page, el, free, {
      logName: "City (texto)",
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (ok) console.log(`   ↳ City texto: ${free}`);
    return ok;
  }
  return false;
}

/** Preferred location / (Country, city) → Argentina, Ciudad Autónoma de Buenos Aires. */
export async function fillPreferredWorkLocation(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, value, countryCityValue } = PSEUDO_ANSWERS.preferredWorkLocation;
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const blob = `${label} ${aria} ${ph}`;
    if (!fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (
      hasPrefillValue(current) &&
      /Argentina/i.test(current) &&
      /Buenos Aires|Autonomous|Aut[oó]noma/i.test(current)
    ) {
      console.log(`   ↳ Preferred location: dejo prefill`);
      return true;
    }
    const target =
      /\(?\s*country\s*,\s*city|pa[ií]s\s*,\s*ciudad/i.test(blob) ? countryCityValue : value;
    const ok = await fillInputWithWaits(page, el, target, {
      logName: "Preferred location",
      maxAttempts: 2,
      expectTypeahead: false,
      valueOk: (v) => /Argentina/i.test(v) && /Buenos Aires|Autonomous|Aut[oó]noma/i.test(v),
    });
    if (await waitForTypeaheadList(page, 2000)) {
      const hit = typeaheadHits(page)
        .filter({ hasText: /Argentina|Buenos Aires|Autonomous|Aut[oó]noma/i })
        .first();
      if (await hit.isVisible({ timeout: 1500 }).catch(() => false)) {
        await hit.click({ force: true, timeout: 3000, noWaitAfter: true }).catch(() => {});
      }
    }
    if (ok) console.log(`   ↳ Preferred location: ${target}`);
    return ok;
  }
  return false;
}

/** Where did you learn about… → LinkedIn (select o typeahead). */
export async function fillHowDidYouHear(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, typeText, suggestionMatch } = PSEUDO_ANSWERS.howDidYouHear;

  // <select>
  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 2500))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    if (!fieldMatch.test(label)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(val) && /linkedin/i.test(val)) {
      console.log(`   ↳ How did you hear: dejo prefill LinkedIn`);
      return true;
    }
    const opt = el.locator("option").filter({ hasText: suggestionMatch }).first();
    await opt.waitFor({ state: "attached", timeout: 2500 }).catch(() => {});
    if (await opt.count().catch(() => 0)) {
      const v = await opt.getAttribute("value");
      const lab = ((await opt.innerText().catch(() => "")) ?? "LinkedIn").trim();
      if (v != null) await el.selectOption(v);
      else await el.selectOption({ label: lab }).catch(() => {});
      console.log("   ↳ How did you hear: LinkedIn (select)");
      await sleep(300);
      return true;
    }
  }

  // Input + typeahead
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio'])"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const blob = `${label} ${aria}`;
    if (!fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(current) && /linkedin/i.test(current)) return true;

    await waitForControlReady(el);
    await el.click({ timeout: 3000, noWaitAfter: true }).catch(() => {});
    await el.fill("");
    await el.pressSequentially(typeText, { delay: 80 });
    if (await waitForTypeaheadList(page, 4000)) {
      const hit = typeaheadHits(page).filter({ hasText: suggestionMatch }).first();
      await hit.waitFor({ state: "visible", timeout: 2500 }).catch(() => {});
      if (await hit.isVisible({ timeout: 800 }).catch(() => false)) {
        await hit.click({ force: true, timeout: 3000, noWaitAfter: true }).catch(() => {});
        console.log("   ↳ How did you hear: LinkedIn (dropdown click)");
        await sleep(400);
        return true;
      }
    }
    // Fallback: opción visible en listbox / texto
    const byText = page.getByText(/^LinkedIn$/i).first();
    if (await byText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await byText.click({ force: true }).catch(() => {});
      console.log("   ↳ How did you hear: LinkedIn (click texto)");
      return true;
    }
    console.log("   ↳ How did you hear: tipeé LinkedIn (sin hit de dropdown)");
    return true;
  }
  return false;
}

const COVER_AS_RESUME_RE = /intro-GGZ|intro\s*letter|cover\s*letter|introduction\s*letter/i;
/** Link LinkedIn EN/ES: "Show 3 more resumes" / "Mostrar N currículums más". */
const SHOW_MORE_RESUMES_RE =
  /show\s+\d+\s+more\s+resumes?|mostrar\s+\d+\s+(curr[ií]culums?|cvs?|resumes?)\s+m[aá]s|ver\s+\d+\s+m[aá]s/i;

async function selectedResumeLabel(root: Locator): Promise<string> {
  return root
    .locator("input[type='radio']:checked")
    .evaluateAll((nodes) =>
      nodes
        .map((n) => {
          const id = n.getAttribute("id");
          const aria = n.getAttribute("aria-label") ?? "";
          const lab = id
            ? document.querySelector(`label[for="${id}"]`)?.textContent
            : null;
          const wrap =
            n.closest(
              "label, [class*='document'], [class*='resume'], [class*='JobsDocument'], li, div"
            )?.textContent ?? "";
          return `${aria} ${(lab ?? "").trim()} ${wrap}`.replace(/\s+/g, " ").trim();
        })
        .filter(Boolean)
        .join(" | ")
    )
    .catch(() => "");
}

async function clickShowMoreResumes(root: Locator): Promise<boolean> {
  const showMore = root
    .locator("button, a, span[role='button'], div[role='button']")
    .filter({ hasText: SHOW_MORE_RESUMES_RE })
    .first();
  let target = showMore;
  if (!(await target.isVisible({ timeout: 1200 }).catch(() => false))) {
    target = root.getByText(SHOW_MORE_RESUMES_RE).first();
    if (!(await target.isVisible({ timeout: 800 }).catch(() => false))) return false;
  }
  const text = ((await target.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  console.log(`   ↳ Resume: click "${text}" para desplegar CVs`);
  await target.click({ timeout: 4000, noWaitAfter: true }).catch(() =>
    target.click({ force: true, timeout: 3000 })
  );
  await sleep(1000);
  return true;
}

/** Texto asociado a un radio (card LinkedIn / label). */
async function radioCardText(radio: Locator): Promise<string> {
  const aria = ((await radio.getAttribute("aria-label")) ?? "").trim();
  const near = await radio
    .evaluate((n) => {
      const wrap = n.closest(
        "label, [class*='document'], [class*='resume'], [class*='JobsDocument'], li, fieldset, div"
      );
      return (wrap?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    })
    .catch(() => "");
  return `${aria} ${near}`.replace(/\s+/g, " ").trim();
}

/** Elige el radio con mejor score para el rol (nunca cover/intro-GGZ). */
async function clickBestResumeRadio(
  root: Locator,
  kind: ApplyRoleKind
): Promise<boolean> {
  const radios = root.locator("input[type='radio']");
  const rn = await radios.count().catch(() => 0);
  let bestIdx = -1;
  let bestScore = 0;
  let bestBlob = "";

  for (let i = 0; i < rn; i++) {
    const radio = radios.nth(i);
    if (!(await radio.isVisible().catch(() => false))) continue;
    const blob = await radioCardText(radio);
    if (!/\.pdf/i.test(blob) && !/resume|curr[ií]culum|cv\b/i.test(blob)) continue;
    if (COVER_AS_RESUME_RE.test(blob)) continue;
    const score = scoreResumeForRole(blob, kind);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestBlob = blob;
    }
  }

  if (bestIdx < 0 || bestScore < 30) return false;

  const radio = radios.nth(bestIdx);
  await radio.scrollIntoViewIfNeeded().catch(() => {});
  await radio.check({ force: true }).catch(async () => {
    await radio.click({ force: true, timeout: 4000 });
  });
  console.log(
    `   ↳ Resume: mejor match ${kind} (score=${bestScore}) → ${bestBlob.slice(0, 90)}`
  );
  await sleep(500);
  return true;
}

async function clickResumeRadioMatching(
  root: Locator,
  wantRe: RegExp,
  kind: ApplyRoleKind
): Promise<boolean> {
  // Preferir scoring (mejor concordancia entre varios CVs)
  if (await clickBestResumeRadio(root, kind)) return true;

  const nameHit = root.getByText(wantRe).first();
  if (await nameHit.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = ((await nameHit.innerText().catch(() => "")) ?? "").trim();
    if (!COVER_AS_RESUME_RE.test(text) && scoreResumeForRole(text, kind) >= 30) {
      await nameHit.click({ force: true, timeout: 4000 }).catch(() => {});
      const parentRadio = nameHit
        .locator("xpath=ancestor::*[.//input[@type='radio']][1]//input[@type='radio']")
        .first();
      if (await parentRadio.count().catch(() => 0)) {
        await parentRadio.check({ force: true }).catch(() =>
          parentRadio.click({ force: true })
        );
      }
      console.log(`   ↳ Resume: click texto ${kind} → ${text.slice(0, 80)}`);
      await sleep(500);
      return true;
    }
  }

  return false;
}

/**
 * Selecciona CV Analyst vs Automation.
 * NUNCA dejar intro-GGZ / cover como resume.
 */
export async function selectResumeForRole(
  page: Page,
  jobTitle = "",
  company = ""
): Promise<boolean> {
  const kind = detectApplyRoleKind(jobTitle, company);
  const wantRe = kind === "automation" ? RESUME_FILE_MATCH.automation : RESUME_FILE_MATCH.analyst;
  const root = scopeRoot(page);

  const pdfVisible = await root
    .getByText(/\.pdf/i)
    .first()
    .isVisible({ timeout: 800 })
    .catch(() => false);
  const showLinkVisible = await root
    .getByText(SHOW_MORE_RESUMES_RE)
    .first()
    .isVisible({ timeout: 800 })
    .catch(() => false);
  const curriculumStep = await root
    .getByText(/curr[ií]culum|resume|be sure to include an updated resume/i)
    .first()
    .isVisible({ timeout: 600 })
    .catch(() => false);
  if (!pdfVisible && !showLinkVisible && !curriculumStep) return false;

  const selectedBlob = await selectedResumeLabel(root);
  const coverSelected = COVER_AS_RESUME_RE.test(selectedBlob);
  const alreadyOk =
    scoreResumeForRole(selectedBlob, kind) >= 70 && !coverSelected;

  if (alreadyOk) {
    console.log(`   ↳ Resume: ya seleccionado OK (${kind}) — no es cover letter`);
    return true;
  }

  if (coverSelected || /intro-GGZ/i.test(selectedBlob)) {
    console.log(
      `   ↳ Resume: ⚠ default es cover letter ("${selectedBlob.slice(0, 60)}") — cambiar a ${kind}`
    );
  } else if (selectedBlob) {
    console.log(
      `   ↳ Resume: default no matchea ${kind} ("${selectedBlob.slice(0, 50)}") — buscar CV`
    );
  }

  const resumeOk = async () => {
    const after = await selectedResumeLabel(root);
    return (
      scoreResumeForRole(after, kind) >= 70 && !COVER_AS_RESUME_RE.test(after)
    );
  };

  /** ¿Hay un CV del rol visible en la lista default (sin Show more)? */
  const roleCvVisibleInDefault = async (): Promise<boolean> => {
    const radios = root.locator("input[type='radio']");
    const rn = await radios.count().catch(() => 0);
    for (let i = 0; i < rn; i++) {
      const radio = radios.nth(i);
      if (!(await radio.isVisible().catch(() => false))) continue;
      const blob = await radioCardText(radio);
      if (COVER_AS_RESUME_RE.test(blob)) continue;
      if (scoreResumeForRole(blob, kind) >= 70) return true;
    }
    return false;
  };

  const visible = await roleCvVisibleInDefault();
  if (!visible) {
    console.log(
      `   ↳ Resume: CV ${kind} no visible en default → Show more + mejor match`
    );
    await clickShowMoreResumes(root);
  } else {
    console.log(`   ↳ Resume: CV ${kind} visible → seleccionar mejor match`);
  }

  if (await clickResumeRadioMatching(root, wantRe, kind)) {
    if (await resumeOk()) return true;
  }
  // Reintentar expandir (lista larga / Analyst oculto)
  await clickShowMoreResumes(root);
  if (await clickResumeRadioMatching(root, wantRe, kind)) {
    if (await resumeOk()) return true;
  }
  await clickShowMoreResumes(root);
  if (await clickResumeRadioMatching(root, wantRe, kind)) {
    if (await resumeOk()) return true;
  }

  if (COVER_AS_RESUME_RE.test(await selectedResumeLabel(root))) {
    console.log("   ↳ Resume: ✗ sigue seleccionado intro-GGZ / cover — no avanzar");
    return false;
  }

  console.log(`   ↳ Resume: no encontré CV ${kind} tras "Show N more resumes"`);
  return false;
}

/**
 * Preguntas Sí/No de skills: si está en MY_SKILLS → Yes/Sí; si no → No.
 * Respeta prefill si ya hay radio seleccionado.
 */
export async function answerSkillYesNoQuestions(page: Page): Promise<number> {
  const root = scopeRoot(page);
  if (!(await root.isVisible({ timeout: 1000 }).catch(() => false))) return 0;

  let answered = 0;
  const blocks = root.locator(
    "fieldset, .fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], li.jobs-easy-apply-form-section__grouping"
  );
  const n = await blocks.count().catch(() => 0);

  for (let i = 0; i < Math.min(n, 40); i++) {
    const block = blocks.nth(i);
    if (!(await block.isVisible().catch(() => false))) continue;
    const blob = ((await block.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (blob.length < 6 || blob.length > 400) continue;

    const resolved = resolveSkillYesNo(blob);
    if (!resolved) continue;

    const wantYes = resolved.answerYes;
    const yesRe = /^(Yes|Sí|Si)$/i;
    const noRe = /^(No)$/i;

    // ¿Ya hay selección?
    const checked = block.locator("input[type='radio']:checked, input[type='checkbox']:checked");
    if ((await checked.count().catch(() => 0)) > 0) {
      console.log(`   ↳ Skill ${resolved.skill}: dejo prefill`);
      continue;
    }

    const radios = block.locator("input[type='radio'], input[type='checkbox']");
    const rc = await radios.count().catch(() => 0);
    let clicked = false;

    for (let r = 0; r < rc; r++) {
      const radio = radios.nth(r);
      const id = (await radio.getAttribute("id").catch(() => "")) ?? "";
      const val = ((await radio.getAttribute("value")) ?? "").trim();
      let lab = "";
      if (id) {
        lab = ((await block.locator(`label[for="${id}"]`).first().innerText().catch(() => "")) ?? "").trim();
      }
      if (!lab) {
        lab = ((await radio.evaluate((node) => {
          const wrap = node.closest("label") ?? node.parentElement;
          return (wrap?.textContent ?? "").trim();
        }).catch(() => "")) ?? "").trim();
      }
      const token = `${val} ${lab}`.trim();
      const isYes = yesRe.test(val) || yesRe.test(lab) || /^yes|sí|si$/i.test(token);
      const isNo = noRe.test(val) || noRe.test(lab) || /^no$/i.test(token);
      if (wantYes && isYes) {
        await radio.check({ force: true }).catch(async () => {
          await radio.click({ force: true, timeout: 2000 });
        });
        clicked = true;
        break;
      }
      if (!wantYes && isNo) {
        await radio.check({ force: true }).catch(async () => {
          await radio.click({ force: true, timeout: 2000 });
        });
        clicked = true;
        break;
      }
    }

    // Fallback: botones / labels clickables Yes|No
    if (!clicked) {
      const target = block
        .getByRole("radio", { name: wantYes ? yesRe : noRe })
        .or(block.getByText(wantYes ? yesRe : noRe))
        .first();
      if (await target.isVisible({ timeout: 600 }).catch(() => false)) {
        await target.click({ force: true, timeout: 2000 }).catch(() => {});
        clicked = true;
      }
    }

    // Select Yes/No
    if (!clicked) {
      const sel = block.locator("select").first();
      if (await sel.isVisible({ timeout: 400 }).catch(() => false)) {
        const cur = ((await sel.inputValue().catch(() => "")) ?? "").trim();
        if (hasPrefillValue(cur)) {
          console.log(`   ↳ Skill ${resolved.skill}: dejo prefill select`);
          continue;
        }
        const opt = sel
          .locator("option")
          .filter({ hasText: wantYes ? yesRe : noRe })
          .first();
        if (await opt.count().catch(() => 0)) {
          const v = await opt.getAttribute("value");
          if (v != null) await sel.selectOption(v);
          else {
            const lab = ((await opt.innerText().catch(() => "")) ?? (wantYes ? "Yes" : "No")).trim();
            await sel.selectOption({ label: lab }).catch(() => {});
          }
          clicked = true;
        }
      }
    }

    if (clicked) {
      console.log(
        `   ↳ Skill "${resolved.skill}": ${wantYes ? "Yes/Sí" : "No"} (lista MY_SKILLS)`
      );
      answered++;
      await sleep(200);
    }
  }

  return answered;
}

/**
 * Sube intro-GGZ.pdf solo si el input es claramente cover letter.
 * NUNCA usar el file input de resume (eso deja intro-GGZ seleccionado como CV).
 */
export async function uploadCoverLetterPdf(page: Page): Promise<boolean> {
  const pdf = resolveCoverLetterPdfPath();
  if (!fs.existsSync(pdf)) {
    console.log(`   ↳ Cover letter PDF no encontrado: ${pdf}`);
    return false;
  }

  const root = scopeRoot(page);

  // Si hay radios de resume en el paso, no hacer fallback "único file"
  const hasResumeRadios = await root
    .locator("input[type='radio'][aria-label*='resume' i], label")
    .filter({ hasText: /select resume|\.pdf/i })
    .first()
    .isVisible({ timeout: 600 })
    .catch(() => false);

  const fileInputs = root.locator("input[type='file']");
  const n = await fileInputs.count().catch(() => 0);

  for (let i = 0; i < n; i++) {
    const input = fileInputs.nth(i);
    const near = await input
      .evaluate((node) => {
        const wrap =
          node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div, label") ??
          node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 280);
      })
      .catch(() => "");
    const name = ((await input.getAttribute("name")) ?? "").trim();
    const aria = ((await input.getAttribute("aria-label")) ?? "").trim();
    const blob = `${near} ${name} ${aria}`;

    // Solo cover letter explícito — nunca resume/CV
    if (/resume|cv\b|curriculum|upload\s*resume/i.test(blob) && !isCoverLetterLabel(blob)) {
      continue;
    }
    if (!isCoverLetterLabel(blob)) continue;

    try {
      await input.setInputFiles(pdf);
      console.log(`   ↳ Cover letter upload: ${pdf}`);
      await sleep(500);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ↳ Cover letter upload falló: ${msg.slice(0, 100)}`);
    }
  }

  if (hasResumeRadios) {
    // No subir intro-GGZ al input genérico del paso de CVs
    return false;
  }

  return false;
}

/**
 * Summary: borrar default y pegar texto Analyst vs Automation según título del aviso.
 * jobTitle opcional (si no, usa Analyst).
 */
export async function fillApplicationSummary(
  page: Page,
  jobTitle = "",
  company = ""
): Promise<boolean> {
  const text = resolveApplicationSummary(jobTitle, company);
  const root = scopeRoot(page);
  const areas = root.locator("textarea");
  const n = await areas.count();
  let filled = false;

  for (let i = 0; i < n; i++) {
    const area = areas.nth(i);
    if (!(await area.isVisible().catch(() => false))) continue;
    const aria = ((await area.getAttribute("aria-label")) ?? "").trim();
    const near = await area
      .evaluate((node) => {
        const wrap =
          node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
          node.parentElement;
        const lab = wrap?.querySelector("label, legend, span[class*='label']");
        return (lab?.textContent ?? "").trim();
      })
      .catch(() => "");
    const blob = `${aria} ${near}`;
    if (!isSummaryLabel(blob) && !/\bmessage\b|\bmensaje\b/i.test(blob)) continue;
    // No tratar cover letter textarea como summary
    if (isCoverLetterLabel(blob) && !isSummaryLabel(blob)) continue;

    await waitForControlReady(area);
    await area.click({ timeout: 3000 }).catch(() => {});
    await area.fill("");
    await area.fill(text);
    console.log(
      `   ↳ Summary (${jobTitle ? "según puesto" : "analyst default"}): ${text.slice(0, 60)}…`
    );
    filled = true;
    await sleep(300);
  }
  return filled;
}

/** English proficiency: texto → Advanced (C1); dropdown → closest match. Prefill se respeta. */
export async function fillEnglishProficiency(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, freeText, selectMatch, preferredSelect } = PSEUDO_ANSWERS.englishProficiency;

  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 2500))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    if (!fieldMatch.test(label)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(val) && selectMatch.test(val)) {
      console.log(`   ↳ English: dejo prefill ("${val.slice(0, 40)}")`);
      return true;
    }
    const preferred = el.locator("option").filter({ hasText: preferredSelect }).first();
    const fallback = el.locator("option").filter({ hasText: selectMatch }).first();
    await preferred.waitFor({ state: "attached", timeout: 2000 }).catch(() => {});
    const opt = (await preferred.count().catch(() => 0)) ? preferred : fallback;
    if (!(await opt.count().catch(() => 0))) continue;
    const v = await opt.getAttribute("value");
    const lab = ((await opt.innerText().catch(() => "")) ?? freeText).trim();
    if (v != null) await el.selectOption(v);
    else await el.selectOption({ label: lab }).catch(() => {});
    console.log(`   ↳ English select: ${lab.slice(0, 50)}`);
    await sleep(300);
    return true;
  }

  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const blob = `${label} ${aria}`;
    if (!fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(current)) {
      console.log(`   ↳ English: dejo prefill ("${current.slice(0, 40)}")`);
      return true;
    }
    const ok = await fillInputWithWaits(page, el, freeText, {
      logName: "English proficiency",
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (ok) console.log(`   ↳ English: ${freeText}`);
    return ok;
  }
  return false;
}

/**
 * Consent checkbox: click para marcar.
 * true = marcado OK; false = no había / no quedó marcado (caller → pendiente).
 */
export async function fillConsentCheckbox(page: Page): Promise<"ok" | "missing" | "failed"> {
  const root = scopeRoot(page);
  const { fieldMatch } = PSEUDO_ANSWERS.consentCheckbox;
  const blocks = root.locator(
    "fieldset, .fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], label, li"
  );
  const n = await blocks.count().catch(() => 0);
  let saw = false;

  for (let i = 0; i < Math.min(n, 50); i++) {
    const block = blocks.nth(i);
    if (!(await block.isVisible().catch(() => false))) continue;
    const blob = ((await block.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (!fieldMatch.test(blob)) continue;
    // No tocar Follow company / top choice
    if (/follow (the )?company|top choice|seguir (a la )?empresa/i.test(blob)) continue;
    saw = true;
    const box = block.locator("input[type='checkbox']").first();
    if (!(await box.count().catch(() => 0))) continue;
    const checked = await box.isChecked().catch(() => false);
    if (checked) {
      console.log("   ↳ Consent: ya marcado");
      return "ok";
    }
    await box.check({ force: true }).catch(async () => {
      await box.click({ force: true, timeout: 2500 });
    });
    await sleep(300);
    const ok = await box.isChecked().catch(() => false);
    console.log(ok ? "   ↳ Consent: marcado" : "   ↳ Consent: click no dejó marcado");
    return ok ? "ok" : "failed";
  }
  return saw ? "failed" : "missing";
}

export type SkipPendingReason = {
  reason: string;
  /** Texto para Notas Excel (assessment en mayúsculas para bold). */
  notes: string;
};

/** Detecta condiciones que dejan la postulación pendiente y pasan al siguiente. */
export async function detectSkipPending(page: Page): Promise<SkipPendingReason | null> {
  const root = scopeRoot(page);
  if (!(await root.isVisible({ timeout: 800 }).catch(() => false))) return null;

  const blocks = root.locator(
    "fieldset, .fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], li.jobs-easy-apply-form-section__grouping"
  );
  const n = await blocks.count().catch(() => 0);

  for (let i = 0; i < Math.min(n, 40); i++) {
    const block = blocks.nth(i);
    if (!(await block.isVisible().catch(() => false))) continue;
    const blob = ((await block.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (blob.length < 8) continue;

    if (PSEUDO_ANSWERS.yearsOfExperience.fieldMatch.test(blob)) {
      // Dejar cantidad default; no enviamos
      return {
        reason: "Pregunta years of experience (sin mapa de años) — pendiente",
        notes:
          "Pendiente: years of experience (SQL/Python/…) — dejar default; definir mapa de años",
      };
    }

    if (PSEUDO_ANSWERS.dataQualityFrameworks.fieldMatch.test(blob)) {
      // Intentar No
      const noRadio = block.getByRole("radio", { name: /^No$/i }).or(block.getByText(/^No$/i)).first();
      if (await noRadio.isVisible({ timeout: 600 }).catch(() => false)) {
        await noRadio.click({ force: true }).catch(() => {});
      }
      return {
        reason: "Data quality frameworks (Deequ/GE) — No; pendiente manual",
        notes:
          "Pendiente: Experience with Deequ / Great Expectations / data quality frameworks → No (confirmar envío manual)",
      };
    }
  }
  return null;
}

export type PseudoFillResult = {
  filled: number;
  skipPending?: SkipPendingReason;
  consentFailed?: boolean;
};

/** Aplica pseudo-respuestas conocidas en el paso actual. */
export async function fillPseudoAnswers(
  page: Page,
  ctx?: { jobTitle?: string; company?: string }
): Promise<PseudoFillResult> {
  const jobTitle = ctx?.jobTitle ?? "";
  const company = ctx?.company ?? "";
  let filled = 0;

  const skipEarly = await detectSkipPending(page);
  if (skipEarly) return { filled: 0, skipPending: skipEarly };

  // CV primero (nunca dejar intro-GGZ / cover como resume)
  if (await selectResumeForRole(page, jobTitle, company)) filled++;
  if (await fillLocationLiniers(page)) filled++;
  if (await fillCountrySelect(page)) filled++;
  if (await fillCitySelect(page)) filled++;
  if (await fillPreferredWorkLocation(page)) filled++;
  if (await fillWorkOrLiveCityFreeText(page)) filled++;
  if (await fillHowDidYouHear(page)) filled++;
  if (await fillStartAvailability(page)) filled++;
  if (await fillEnglishProficiency(page)) filled++;
  filled += await answerSkillYesNoQuestions(page);

  const consent = await fillConsentCheckbox(page);
  if (consent === "ok") filled++;
  if (consent === "failed") {
    return {
      filled,
      consentFailed: true,
      skipPending: {
        reason: "Consent checkbox no quedó marcado — pendiente",
        notes: "Pendiente: I consent / checkbox to proceed — no se marcó solo; revisar manual",
      },
    };
  }

  // Cover letter solo en input de cover (no el de resume)
  if (await uploadCoverLetterPdf(page)) filled++;
  // Re-chequear CV por si un upload contaminó la lista
  if (await selectResumeForRole(page, jobTitle, company)) filled++;
  if (await fillApplicationSummary(page, jobTitle, company)) filled++;
  if (
    await fillTextByFieldMatch(
      page,
      PSEUDO_ANSWERS.linkedinProfile.fieldMatch,
      PSEUDO_ANSWERS.linkedinProfile.value,
      "LinkedIn Profile"
    )
  ) {
    filled++;
  }
  if (
    await fillTextByFieldMatch(
      page,
      PSEUDO_ANSWERS.portfolio.fieldMatch,
      PSEUDO_ANSWERS.portfolio.value,
      "Portfolio"
    )
  ) {
    filled++;
  }
  if (await fillExpectedCompensation(page)) filled++;

  const skipLate = await detectSkipPending(page);
  await dismissModalOverlays(page);
  if (skipLate) return { filled, skipPending: skipLate };
  return { filled };
}

/**
 * ¿Hay campos bloqueantes vacíos? (required / error / "Select an option" en Country*).
 * Si hay → NO clickear Next/Review (evita modal Save or Discard).
 */
export async function hasBlockingEmptyFields(page: Page): Promise<CapturedField[]> {
  const root = scopeRoot(page);
  if (!(await root.isVisible({ timeout: 1500 }).catch(() => false))) return [];

  // Error global "Please make a selection"
  const pageErrors = root.getByText(PLEASE_SELECT_RE);
  const hasPlease = await pageErrors.first().isVisible({ timeout: 400 }).catch(() => false);

  const all = await captureRequiredFields(page);
  const blocking = all.filter((f) => {
    const label = f.label.replace(/\s+/g, " ");
    const starred = /\*/.test(label);
    const emptySelect =
      !f.value || EMPTY_SELECT_RE.test(f.value) || f.value === "0";
    const isCountry =
      PSEUDO_ANSWERS.country.fieldMatch.test(label) ||
      (/^(country|pa[ií]s)\b/i.test(label) && !/phone|tel/i.test(label));
    if (f.errorText || PLEASE_SELECT_RE.test(f.errorText)) return true;
    if ((f.required || starred || isCountry) && emptySelect) return true;
    if (hasPlease && isCountry && emptySelect) return true;
    // Vacío con aria/html required
    if ((f.required || starred) && !f.value.trim()) return true;
    return false;
  });

  // Dedup por label
  const seen = new Set<string>();
  return blocking.filter((f) => {
    const k = f.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type ApplyRunMode = "dry_run" | "productive";
export type SaveDiscardResult = "absent" | "discarded" | "saved";

function saveDiscardDialog(page: Page): Locator {
  return page.getByRole("dialog").filter({
    hasText: /save this application|save or discard|guardar|descartar|unsaved|sin guardar/i,
  });
}

export async function isSaveDiscardVisible(page: Page): Promise<boolean> {
  if (await saveDiscardDialog(page).first().isVisible({ timeout: 600 }).catch(() => false)) {
    return true;
  }
  const discard = page.getByRole("button", { name: /Discard|Descartar/i }).first();
  const save = page.getByRole("button", { name: /^Save$|Save for later|Guardar/i }).first();
  return (
    (await discard.isVisible({ timeout: 300 }).catch(() => false)) &&
    (await save.isVisible({ timeout: 300 }).catch(() => false))
  );
}

/**
 * Modal "Save this application?":
 * - dry_run → Discard (cerrar sin guardar ni enviar)
 * - productive → Save (borrador) y el caller sigue a Submit/Done
 */
export async function handleSaveDiscardModal(
  page: Page,
  mode: ApplyRunMode
): Promise<SaveDiscardResult> {
  if (!(await isSaveDiscardVisible(page))) return "absent";

  const dialog = saveDiscardDialog(page).first();
  const scope = (await dialog.isVisible({ timeout: 400 }).catch(() => false)) ? dialog : page;

  if (mode === "dry_run") {
    const discard = scope.getByRole("button", { name: /Discard|Descartar/i }).first();
    await discard.click({ timeout: 4000 }).catch(async () => {
      await page.getByRole("button", { name: /Discard|Descartar/i }).first().click({ force: true });
    });
    console.log("   ↳ [dry-run] Save/Discard → Discard (salir sin guardar ni enviar)");
    await sleep(600);
    return "discarded";
  }

  const save = scope.getByRole("button", { name: /^Save$|Save for later|Guardar/i }).first();
  await save.click({ timeout: 4000 }).catch(async () => {
    await page.getByRole("button", { name: /^Save$/i }).first().click({ force: true });
  });
  console.log("   ↳ [productivo] Save/Discard → Save (seguir hacia Submit)");
  await sleep(1000);
  return "saved";
}

/** @deprecated prefer handleSaveDiscardModal — mantiene Discard por compat. */
export async function dismissSaveOrDiscard(page: Page): Promise<boolean> {
  const r = await handleSaveDiscardModal(page, "dry_run");
  return r !== "absent";
}

export async function isNextDisabled(page: Page): Promise<boolean> {
  const root = easyApplyModalRoot(page);
  const scope = (await root.isVisible({ timeout: 500 }).catch(() => false)) ? root : page;
  const next = scope
    .locator(
      "button[data-easy-apply-next-button], button[data-live-test-easy-apply-next-button], button[aria-label*='Continue to next step'], button[aria-label*='Continue'], button[aria-label*='Review']"
    )
    .first();
  if (!(await next.isVisible({ timeout: 800 }).catch(() => false))) return false;
  const disabled = (await next.getAttribute("disabled").catch(() => null)) !== null;
  const aria = ((await next.getAttribute("aria-disabled")) ?? "").toLowerCase() === "true";
  return disabled || aria;
}
