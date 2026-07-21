// Relleno pseudo-hardcodeado + captura de campos obligatorios (Easy Apply).
// Cuando Next no avanza: dump de required → cerrar sesión para completar respuestas.

import fs from "fs";
import path from "path";
import type { Locator, Page } from "playwright";
import { APPLY_DIR, ensureDirs } from "./paths.js";
import {
  clickSafeInEasyApply,
  dismissModalOverlays,
  easyApplyModalRoot,
} from "./modal-controls.js";
import { resolveSkillYesNo } from "./my-skills.js";
import { resolveSkillYears } from "./skills-years.js";
import {
  optionsLookNumeric,
  parseYearsOptionLabel,
  pickBestYearsOption,
} from "./years-option.js";
import {
  detectApplyRoleKind,
  resolveApplicationSummary,
  resolveCoverLetterPdfPath,
  RESUME_FALLBACK_FILENAME,
  RESUME_FALLBACK_MATCH,
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
  phoneCountryCode: {
    fieldMatch:
      /c[oó]digo del pa[ií]s|phone country code|country calling code|c[oó]digo\s*(de\s*)?pa[ií]s(\s*del\s*tel[eé]fono)?/i,
    selectText: /Argentina\s*\(\+54\)|\+54|Argentina/i,
  },
  hybridWorkOk: {
    fieldMatch:
      /modalidad h[ií]brid|hybrid.*(office|presencial|caba)|1\s*d[ií]a presencial|2 o 1 d[ií]a|acuerdo.*(h[ií]brid|presencial|asistir)|trabajo h[ií]brid|disponib.*h[ií]brid|h[ií]brida|asistir\s+\d|presencial\s+a\s+las\s+oficinas|d[ií]a\s*presencial.*caba|oficinas?\?\s*caba/i,
  },
  programmingScripting: {
    fieldMatch:
      /programaci[oó]n y scripting|programming and scripting|experiencia en programaci[oó]n|conocimientos?\s+(de\s+)?(programaci[oó]n|scripting)|programming\s*\/\s*scripting/i,
  },
  linkedinProfile: {
    fieldMatch:
      /linkedin\s*profile|perfil\s*de\s*linkedin|linkedin\s*url|link\s+to\s+your\s+linkedin|share\s+the\s+link\s+to\s+your\s+linkedin|enlace\s+(a|de)\s+(tu\s+)?linkedin/i,
    value: "https://www.linkedin.com/in/gabriela-garayzavalia",
  },
  portfolio: {
    fieldMatch: /portfolio\s*link|portfolio|portafolio|personal\s*website|github\.io/i,
    value: "https://gabrielagarayzavalia.github.io/linkedin-bug-report/",
  },
  /** Remuneración pretendida bruta (mensual). */
  expectedCompensation: {
    fieldMatch:
      /expected\s*(salary|compensation|pay|ctc)|salary\s*expectation|desired\s*salary|compensation\s*expectation|financial expectations|remuneraci[oó]n(\s+\w+){0,3}\s*pretendida|remuneraci[oó]n\s*bruta|remuneraci[oó]n(\s*pretendida)?|sueldo\s*(pretendido|esperado|bruto)|pretensi[oó]n\s*salarial|pretension\s*salarial|salario\s*(bruto|esperado|deseado)|current\s*salary|annual\s*salary|monthly\s*(gross|salary)|gross\s*(salary|pay)|pretensi[oó]n.*brutos?|brutos?\s*\?/i,
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
      /where (would you like to work|do you (live|want to work)|are you (based|located))|what is your current location|current location|work location|based in|d[oó]nde (viv|te gustar[ií]a trabajar|prefer[ií]s trabajar)|ciudad (de residencia|donde)|lugar de (trabajo|residencia)|ubicaci[oó]n\s*actual/i,
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
      /english\s*(level|proficiency|skill|years)|nivel\s*(de\s*)?ingl[eé]s|proficiency in english|idioma:?\s*ingl[eé]s|ingl[eé]s\s*(nivel|level|scale|escala)?|years?\s+(of\s+)?english|a[nñ]os?\s+(de\s+)?ingl[eé]s/i,
    freeText: "Advanced (C1)",
    selectMatch: /advanced|c1|professional|proficient|fluent|b2|upper.?intermediate/i,
    preferredSelect: /advanced|c1|professional/i,
    /** Años reales de uso → en escala UI elegimos el máximo (suele ser 10+). */
    numericYears: 50,
  },
  consentCheckbox: {
    fieldMatch:
      /i consent|consent|select checkbox to proceed|autorizo|acepto (los |las )?(t[eé]rminos|condiciones)|privacy policy|pol[ií]tica de privacidad/i,
  },
  /** Años por skill (SQL/Python/…): sin mapa → pendiente (no enviar). Requiere años/years (no Sí/No de skills). */
  yearsOfExperience: {
    fieldMatch:
      /(?:years?\s+of\s+(work\s+)?experience|how many years\s+(of\s+)?(?:experience|work)|cu[aá]ntos?\s+a[nñ]os?\s+(de\s+)?experiencia|a[nñ]os?\s+(de\s+)?experiencia)/i,
  },
  /**
   * Años generales / dominio (ej. Administrative): 0–99.
   * No confundir con remuneración (también usa inputs *-numeric).
   */
  yearsNumericGeneral: {
    fieldMatch:
      /how many years of .+ experience|years of .+ experience do you|years?\s+of\s+administrative|a[nñ]os?\s+(de\s+)?experiencia\s+administrat|administrative experience/i,
    value: "25",
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

const EMPTY_SELECT_RE =
  /select an option|seleccion(a|á)|selecciona una opci|choose|eleg[ií]|elegir/i;
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

/**
 * Contenedor del form Easy Apply.
 * NUNCA comma+.first() con `[role=dialog]`/`main`: el chrome de LinkedIn
 * (Select language) gana y el inventario/fill no ve remuneración ni Submit.
 */
function scopeRoot(page: Page): Locator {
  return page
    .locator(".jobs-easy-apply-modal")
    .or(page.locator(".jobs-easy-apply-content"))
    .or(page.locator("div[class*='jobs-easy-apply']"))
    .or(
      page.locator("[role='dialog']").filter({
        hasText:
          /Apply to|Postular|Contact info|Resume|Curr[ií]culum|Additional Questions|Preguntas|Review/i,
      })
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

/** Espera input/control usable (attached + enabled). Scroll para revelar off-viewport. */
async function waitForControlReady(el: Locator, timeoutMs = 6000): Promise<boolean> {
  try {
    await el.waitFor({ state: "attached", timeout: timeoutMs });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    // Visible ayuda pero LinkedIn a veces reporta false fuera del fold del modal
    await el.waitFor({ state: "visible", timeout: Math.min(1500, timeoutMs) }).catch(() => {});
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
  // El click en el <li>/hit es lo que valida el GEO; tipear solo no alcanza.
  if (!(await clickSafeInEasyApply(target, { timeoutMs: 4000 }))) return null;
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
    await clickSafeInEasyApply(countryBtn, { timeoutMs: 3000 });
    await sleep(400);
    const opt = page.getByRole("listbox").getByRole("option", { name: selectText }).first();
    if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await clickSafeInEasyApply(opt)) {
        console.log(`   ↳ Country: opción Argentina`);
        await sleep(400);
        return true;
      }
    }
    const byText = root.getByRole("option", { name: selectText }).first();
    if (await byText.isVisible({ timeout: 1000 }).catch(() => false)) {
      if (await clickSafeInEasyApply(byText)) {
        console.log(`   ↳ Country: click Argentina (modal)`);
        await sleep(400);
        return true;
      }
    }
  }

  void combos;
  return false;
}

/** Código del país / Phone country code → Argentina (+54). Issue #148. */
export async function fillPhoneCountryCode(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, selectText } = PSEUDO_ANSWERS.phoneCountryCode;

  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 3000))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const blob = `${label} ${aria}`;
    if (!fieldMatch.test(blob)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(val) && /\+54|Argentina/i.test(val) && !EMPTY_SELECT_RE.test(val)) {
      console.log(`   ↳ Phone country: dejo prefill ("${val.slice(0, 40)}")`);
      return true;
    }
    const opt = el.locator("option").filter({ hasText: selectText }).first();
    await opt.waitFor({ state: "attached", timeout: 2500 }).catch(() => {});
    if (await opt.count().catch(() => 0)) {
      const v = await opt.getAttribute("value");
      const lab = ((await opt.innerText().catch(() => "")) ?? "").trim();
      if (v != null) await el.selectOption(v);
      else await el.selectOption({ label: lab }).catch(() => {});
      console.log(`   ↳ Phone country: ${lab.slice(0, 40) || "Argentina (+54)"}`);
      await sleep(300);
      return true;
    }
  }

  const combos = root.locator("[role='combobox'], [aria-haspopup='listbox']");
  const cn = await combos.count();
  for (let i = 0; i < cn; i++) {
    const el = combos.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const blob = `${label} ${aria}`;
    if (!fieldMatch.test(blob)) continue;
    const current = (
      ((await el.inputValue().catch(() => "")) || (await el.innerText().catch(() => "")) || "")
    ).trim();
    if (/\+54|Argentina/i.test(current) && !EMPTY_SELECT_RE.test(current)) {
      console.log(`   ↳ Phone country: dejo prefill ("${current.slice(0, 40)}")`);
      return true;
    }
    await el.click({ force: true }).catch(() => {});
    await sleep(400);
    const opt = page.getByRole("option", { name: selectText }).first();
    if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await opt.click({ force: true }).catch(() => {});
      console.log("   ↳ Phone country: Argentina (+54) (option)");
      await sleep(300);
      return true;
    }
  }
  return false;
}

async function clickYesNoInBlock(
  block: Locator,
  wantYes: boolean,
  logLabel: string
): Promise<boolean> {
  const yesRe = /^(Yes|Sí|Si)$/i;
  const noRe = /^(No)$/i;
  const checked = block.locator("input[type='radio']:checked, input[type='checkbox']:checked");
  if ((await checked.count().catch(() => 0)) > 0) {
    console.log(`   ↳ ${logLabel}: dejo prefill`);
    return true;
  }
  const radios = block.locator("input[type='radio'], input[type='checkbox']");
  const rc = await radios.count().catch(() => 0);
  for (let r = 0; r < rc; r++) {
    const radio = radios.nth(r);
    const lab =
      ((await radio.getAttribute("aria-label")) ?? "").trim() ||
      ((await radio
        .evaluate((n) => (n as HTMLInputElement).labels?.[0]?.textContent ?? "")
        .catch(() => "")) ||
        "");
    const match = wantYes ? yesRe.test(lab) : noRe.test(lab);
    if (!match) continue;
    await radio.check({ force: true }).catch(async () => {
      await radio.click({ force: true, timeout: 2000 });
    });
    console.log(`   ↳ ${logLabel}: ${wantYes ? "Yes/Sí" : "No"}`);
    await sleep(250);
    return true;
  }
  const btn = block.getByRole("radio", { name: wantYes ? yesRe : noRe }).first();
  if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
    await btn.click({ force: true }).catch(() => {});
    console.log(`   ↳ ${logLabel}: ${wantYes ? "Yes/Sí" : "No"} (role)`);
    return true;
  }

  // Dropdown Sí/No (Capgemini/Macro y similares)
  const sel = block.locator("select").first();
  if (await sel.isVisible({ timeout: 400 }).catch(() => false)) {
    const cur = ((await sel.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(cur) && !EMPTY_SELECT_RE.test(cur)) {
      console.log(`   ↳ ${logLabel}: dejo prefill select`);
      return true;
    }
    const opt = sel
      .locator("option")
      .filter({ hasText: wantYes ? yesRe : noRe })
      .first();
    if (await opt.count().catch(() => 0)) {
      const v = await opt.getAttribute("value");
      const lab = ((await opt.innerText().catch(() => "")) ?? (wantYes ? "Yes" : "No")).trim();
      if (v != null) await sel.selectOption(v);
      else await sel.selectOption({ label: lab }).catch(() => {});
      console.log(`   ↳ ${logLabel}: ${wantYes ? "Yes/Sí" : "No"} (select)`);
      await sleep(250);
      return true;
    }
  }
  return false;
}

/** Híbrida CABA → Sí; Programación y scripting → Sí. Issue #149. */
export async function answerHybridAndProgramming(page: Page): Promise<number> {
  const root = scopeRoot(page);
  if (!(await root.isVisible({ timeout: 800 }).catch(() => false))) return 0;
  const blocks = root.locator(
    "fieldset, .fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], li.jobs-easy-apply-form-section__grouping"
  );
  const n = await blocks.count().catch(() => 0);
  let answered = 0;
  for (let i = 0; i < Math.min(n, 40); i++) {
    const block = blocks.nth(i);
    if (!(await block.isVisible().catch(() => false))) continue;
    const blob = ((await block.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    if (PSEUDO_ANSWERS.hybridWorkOk.fieldMatch.test(blob)) {
      if (await clickYesNoInBlock(block, true, "Hybrid work")) answered++;
      continue;
    }
    if (PSEUDO_ANSWERS.programmingScripting.fieldMatch.test(blob)) {
      if (await clickYesNoInBlock(block, true, "Programming/scripting")) answered++;
    }
  }
  return answered;
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

/** Evita tratar años de experiencia (inputs *-numeric) como remuneración. */
function looksLikeYearsExperienceField(blob: string): boolean {
  return (
    PSEUDO_ANSWERS.yearsOfExperience.fieldMatch.test(blob) ||
    PSEUDO_ANSWERS.yearsNumericGeneral.fieldMatch.test(blob) ||
    /years?\s+of\s+.+experience|how many years|a[nñ]os?\s+(de\s+)?experiencia|between 0 and 99/i.test(
      blob
    )
  );
}

/** Rellena remuneración usando ids/labels ya capturados (blocking dump). */
async function fillCompensationFromCaptured(
  page: Page,
  fields: CapturedField[]
): Promise<boolean> {
  const { fieldMatch } = PSEUDO_ANSWERS.expectedCompensation;
  let any = false;
  for (const f of fields) {
    const blob = `${f.label} ${f.ariaLabel} ${f.id}`;
    if (looksLikeYearsExperienceField(blob)) continue;
    if (!fieldMatch.test(blob) && !/remuneraci|salary|compensation|sueldo|pretendid/i.test(blob)) {
      continue;
    }
    if (!f.id && !f.label) continue;
    const modal = page.locator(".jobs-easy-apply-modal").first();
    const el = f.id
      ? modal.locator(`[id="${f.id}"]`).first()
      : modal.getByLabel(f.label.replace(/\s*\*\s*$/, "").trim()).first();
    if (!(await el.count().catch(() => 0))) continue;
    const { value, currency } = resolveCompensationValue(blob);
    const raw = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(raw)) {
      console.log(`   ↳ Remuneración: dejo prefill ("${raw.slice(0, 40)}")`);
      any = true;
      continue;
    }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    let ok = await fillInputWithWaits(page, el, value, {
      logName: `Remuneración (${currency})`,
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (!ok) {
      ok = await fillCompensationViaDom(page, value, f.id);
    }
    if (ok) {
      console.log(`   ↳ Remuneración pretendida (${currency}, captured-id): ${value}`);
      any = true;
    }
  }
  return any;
}

/**
 * Set value en input (light + open shadow), para numeric LinkedIn.
 * evaluate como STRING: tsx inyecta __name en funciones y rompe page.evaluate.
 */
async function fillCompensationViaDom(
  page: Page,
  value: string,
  preferId?: string
): Promise<boolean> {
  const payload = JSON.stringify({ value, preferId: preferId ?? "" });
  const filledId = (await page
    .evaluate(
      `((args) => {
        const v = args.value;
        const pid = args.preferId;
        const setVal = (input) => {
          const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
          if (proto && proto.set) proto.set.call(input, v);
          else input.value = v;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        };
        const matchBlob = (input) => {
          const wrap =
            input.closest(
              ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
            ) || input.parentElement;
          const blob = ((wrap && wrap.textContent) || "") + " " + input.id + " " + (input.getAttribute("aria-label") || "");
          const yearsLike = /years?\s+of|how many years|a[nñ]os?\s+(de\s+)?experiencia|administrative experience|between 0 and 99/i;
          return (
            /remuneraci|salary|compensation|sueldo|pretendid/i.test(blob) && !yearsLike.test(blob)
          );
        };
        const walk = (root) => {
          if (pid) {
            const byId =
              (root.getElementById && root.getElementById(pid)) ||
              (root.querySelector && root.querySelector('[id="' + pid + '"]'));
            if (byId && byId.tagName === "INPUT") {
              const wrap =
                byId.closest(
                  ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
                ) || byId.parentElement;
              const blob =
                ((wrap && wrap.textContent) || "") +
                " " +
                byId.id +
                " " +
                (byId.getAttribute("aria-label") || "");
              if (/years?\s+of|how many years|a[nñ]os?\s+(de\s+)?experiencia|administrative/i.test(blob)) {
                return "";
              }
              if (!/remuneraci|salary|compensation|sueldo|pretendid/i.test(blob)) {
                return "";
              }
              setVal(byId);
              return byId.id || pid;
            }
          }
          const inputs = Array.from((root.querySelectorAll && root.querySelectorAll("input")) || []);
          for (const input of inputs) {
            if (input.type === "hidden" || input.type === "checkbox" || input.type === "radio") continue;
            const id = input.id || "";
            if (!matchBlob(input)) continue;
            const near = ((input.closest("div, fieldset, li") && input.closest("div, fieldset, li").textContent) || "").slice(0, 200);
            if (!/remuneraci|salary|compensation|pretendid/i.test(id + " " + (input.getAttribute("aria-label") || "") + " " + near)) {
              continue;
            }
            setVal(input);
            return id || "anon";
          }
          const all = Array.from((root.querySelectorAll && root.querySelectorAll("*")) || []);
          for (const el of all) {
            if (el.shadowRoot) {
              const hit = walk(el.shadowRoot);
              if (hit) return hit;
            }
          }
          return null;
        };
        const modal =
          document.querySelector(".jobs-easy-apply-modal") ||
          document.querySelector("[role='dialog']");
        return (modal ? walk(modal) : null) || walk(document);
      })(${payload})`
    )
    .catch(() => null)) as string | null;

  if (filledId) {
    await sleep(300);
    return true;
  }
  return false;
}

/** Remuneración pretendida: 2750 USD o 3.500.000 ARS según el campo. */
export async function fillExpectedCompensation(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch } = PSEUDO_ANSWERS.expectedCompensation;

  // Si el inventario/blocking ya vio el campo, rellenar por id (más fiable).
  const already = await captureRequiredFields(page);
  if (await fillCompensationFromCaptured(page, already)) return true;

  // Campo a menudo bajo el fold (ej. tras "top choice") — scrollear todos los scrollables del modal
  await root
    .evaluate((node) => {
      const isScrollable = (el: Element) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        return (
          (oy === "auto" || oy === "scroll" || oy === "overlay") &&
          el.scrollHeight > el.clientHeight + 8
        );
      };
      const stack: HTMLElement[] = [];
      const walk = (el: Element) => {
        if (isScrollable(el)) stack.push(el as HTMLElement);
        for (const child of Array.from(el.children)) walk(child);
      };
      walk(node);
      for (const s of stack) s.scrollTop = s.scrollHeight;
    })
    .catch(() => {});
  await sleep(400);

  // Reintento post-scroll (LinkedIn virtualiza preguntas adicionales)
  const afterScroll = await captureRequiredFields(page);
  if (await fillCompensationFromCaptured(page, afterScroll)) return true;

  const tryFillEl = async (el: Locator, blob: string, via: string): Promise<boolean> => {
    const { value, currency } = resolveCompensationValue(blob);
    const raw = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(raw)) {
      console.log(`   ↳ Remuneración: dejo prefill ("${raw.slice(0, 40)}")`);
      return true;
    }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    let ok = await fillInputWithWaits(page, el, value, {
      logName: `Remuneración (${currency})`,
      maxAttempts: 3,
      expectTypeahead: false,
    });
    // LinkedIn numeric a veces no acepta .fill — tipiar
    if (!ok) {
      try {
        await el.click({ force: true, timeout: 2000 });
        await el.press("Control+a").catch(() => {});
        await el.pressSequentially(value, { delay: 40 });
        await sleep(300);
        const after = ((await el.inputValue().catch(() => "")) ?? "").trim();
        ok = after.replace(/[.,\s]/g, "").includes(value.replace(/[.,\s]/g, ""));
      } catch {
        ok = false;
      }
    }
    if (ok) {
      console.log(`   ↳ Remuneración pretendida (${currency}, ${via}): ${value}`);
      return true;
    }
    console.log(`   ↳ Remuneración (${currency}, ${via}): falló tras waits/reintentos`);
    return false;
  };

  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();

  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    await el.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await el.count().catch(() => 0))) continue;
    const id = ((await el.getAttribute("id")) ?? "").trim();
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const ph = ((await el.getAttribute("placeholder")) ?? "").trim();
    const name = ((await el.getAttribute("name")) ?? "").trim();
    const near = await el
      .evaluate((node) => {
        const wrap =
          node.closest(
            ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
          ) ?? node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 300);
      })
      .catch(() => "");
    const blob = `${label} ${aria} ${ph} ${name} ${id} ${near}`;
    if (looksLikeYearsExperienceField(blob)) continue;
    const looksNumeric = /numeric/i.test(id);
    const isComp =
      fieldMatch.test(blob) ||
      (looksNumeric && /remuneraci|salary|compensation|sueldo|pretendid/i.test(blob));
    if (!isComp) continue;

    if (await tryFillEl(el, blob || "remuneración pretendida", "control")) return true;
  }

  // Fallbacks: solo por texto/label de remuneración (NUNCA primer *-numeric del modal)
  const question = root
    .getByText(/remuneraci[oó]n\s+bruta\s+pretendida|expected\s*(salary|compensation)|desired\s*salary/i)
    .first();
  if (await question.count().catch(() => 0)) {
    await question.scrollIntoViewIfNeeded().catch(() => {});
    const nearInput = question
      .locator(
        "xpath=ancestor::*[contains(@class,'form') or contains(@class,'fb-') or self::fieldset or self::li][1]//input[not(@type='hidden') and not(@type='checkbox') and not(@type='radio')]"
      )
      .first();
    if (await nearInput.count().catch(() => 0)) {
      if (await tryFillEl(nearInput, "remuneración bruta pretendida", "question→input")) return true;
    }
  }

  const labelLoc = root.getByLabel(/remuneraci[oó]n|sueldo|salary|compensation|pretendid/i).first();
  if (await labelLoc.count().catch(() => 0)) {
    const id = ((await labelLoc.getAttribute("id")) ?? "").trim();
    const near = await labelLoc
      .evaluate((node) => {
        const wrap =
          node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
          node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 300);
      })
      .catch(() => "");
    const blob = `${near} ${id}`;
    if (!looksLikeYearsExperienceField(blob)) {
      if (await tryFillEl(labelLoc, blob || "remuneración", "getByLabel")) return true;
    }
  }

  // Revelar pregunta bajo el fold (PageDown) y set via DOM
  const revealed = await revealCompensationQuestion(page);
  if (revealed) {
    const { arsValue } = PSEUDO_ANSWERS.expectedCompensation;
    const blob = "remuneración bruta pretendida";
    const { value, currency } = resolveCompensationValue(blob);
    if (await fillCompensationViaDom(page, value)) {
      console.log(`   ↳ Remuneración pretendida (${currency}, dom): ${value}`);
      return true;
    }
    const again = await captureRequiredFields(page);
    if (await fillCompensationFromCaptured(page, again)) return true;
    void arsValue;
  }

  const hasQuestion = await page
    .locator(".jobs-easy-apply-modal")
    .getByText(/remuneraci[oó]n\s+bruta\s+pretendida|expected\s*(salary|compensation)/i)
    .first()
    .isVisible({ timeout: 300 })
    .catch(() => false);
  if (hasQuestion) {
    console.log("   ↳ Remuneración: pregunta visible pero no se pudo rellenar el input");
  }
  return false;
}

/** PageDown en el modal hasta ver la pregunta de remuneración (o agotar intentos). */
async function revealCompensationQuestion(page: Page): Promise<boolean> {
  const modal = page.locator(".jobs-easy-apply-modal").first();
  if (!(await modal.isVisible({ timeout: 500 }).catch(() => false))) return false;

  const q = modal
    .getByText(
      /remuneraci[oó]n\s+bruta\s+pretendida|expected\s*(salary|compensation)|desired\s*salary/i
    )
    .first();
  if (await q.isVisible({ timeout: 400 }).catch(() => false)) {
    await q.scrollIntoViewIfNeeded().catch(() => {});
    return true;
  }

  for (let i = 0; i < 8; i++) {
    await modal
      .evaluate((node) => {
        const isScrollable = (el: Element) => {
          if (!(el instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(el);
          const oy = style.overflowY;
          return (
            (oy === "auto" || oy === "scroll" || oy === "overlay") &&
            el.scrollHeight > el.clientHeight + 8
          );
        };
        const walk = (el: Element) => {
          if (isScrollable(el)) {
            (el as HTMLElement).scrollTop = Math.min(
              (el as HTMLElement).scrollTop + 420,
              (el as HTMLElement).scrollHeight
            );
          }
          for (const child of Array.from(el.children)) walk(child);
        };
        walk(node);
      })
      .catch(() => {});
    await modal.click({ position: { x: 24, y: 24 }, timeout: 500 }).catch(() => {});
    await page.keyboard.press("PageDown").catch(() => {});
    await sleep(280);
    if (await q.isVisible({ timeout: 350 }).catch(() => false)) {
      await q.scrollIntoViewIfNeeded().catch(() => {});
      return true;
    }
  }
  return false;
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

/**
 * Años por skill (SQL/Python/Playwright/…): inputs + dropdowns numéricos.
 * Si no hay mapa → pendiente (no enviar).
 */
export async function fillSkillYearsOfExperience(page: Page): Promise<number> {
  const root = scopeRoot(page);
  const skillYearsRe = PSEUDO_ANSWERS.yearsOfExperience.fieldMatch;
  let filled = 0;

  async function blobFor(el: Locator): Promise<string> {
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const id = ((await el.getAttribute("id")) ?? "").trim();
    const near = await el
      .evaluate((node) => {
        const wrap =
          node.closest(
            ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
          ) ?? node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 320);
      })
      .catch(() => "");
    return `${label} ${aria} ${id} ${near}`;
  }

  function matchesYearsQuestion(blob: string): boolean {
    if (PSEUDO_ANSWERS.yearsNumericGeneral.fieldMatch.test(blob)) return false;
    if (PSEUDO_ANSWERS.englishProficiency.fieldMatch.test(blob)) return false;
    return (
      skillYearsRe.test(blob) ||
      /cu[aá]ntos?\s+a[nñ]os?\s+(de\s+)?experiencia|a[nñ]os?\s+(de\s+)?experiencia|years?\s+of\s+(work\s+)?experience|experiencia\s+(ten[eé]s|tienes).{0,40}(como|con|en)|experiencia\s+(en|con)\s+(qa|automat|javascript|js|cypress|playwright|selenium|postman|jmeter)/i.test(
        blob
      )
    );
  }

  // 1) Inputs numéricos
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio'])"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const blob = await blobFor(el);
    if (!matchesYearsQuestion(blob)) continue;

    const hit = resolveSkillYears(blob);
    if (!hit) continue;

    const value = String(hit.years);
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    const nVal = Number(current.replace(/[^\d]/g, ""));
    const alreadyOk = current !== "" && Number.isFinite(nVal) && nVal >= 0 && nVal <= 99;
    if (alreadyOk) {
      console.log(`   ↳ Years (${hit.label}): dejo prefill ("${current}")`);
      filled++;
      continue;
    }
    const ok = await fillInputWithWaits(page, el, value, {
      logName: `Years (${hit.label})`,
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (ok) {
      console.log(`   ↳ Years (${hit.label}): ${value}`);
      filled++;
    }
  }

  // 2) <select> con opciones 0–10 / 10+ / rangos
  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 2000))) continue;
    const blob = await blobFor(el);
    if (!matchesYearsQuestion(blob)) continue;

    const hit = resolveSkillYears(blob);
    if (!hit) continue;

    const optionEls = el.locator("option");
    const oc = await optionEls.count().catch(() => 0);
    const opts: { text: string; value: string | null }[] = [];
    for (let o = 0; o < oc; o++) {
      const opt = optionEls.nth(o);
      const text = ((await opt.innerText().catch(() => "")) ?? "").trim();
      const value = await opt.getAttribute("value");
      opts.push({ text, value });
    }
    if (!optionsLookNumeric(opts.map((x) => x.text))) continue;

    const cur = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(cur) && !EMPTY_SELECT_RE.test(cur) && parseYearsOptionLabel(cur)) {
      console.log(`   ↳ Years select (${hit.label}): dejo prefill ("${cur}")`);
      filled++;
      continue;
    }

    const best = pickBestYearsOption(opts, hit.years);
    if (!best) continue;
    if (best.value != null && best.value !== "") await el.selectOption(best.value);
    else await el.selectOption({ label: best.text }).catch(() => {});
    console.log(`   ↳ Years select (${hit.label}): ${best.text} (target ${hit.years})`);
    filled++;
    await sleep(250);
  }

  return filled;
}

/**
 * Años generales / Administrative (0–99). No skill-tools (esos → skills-years).
 * Corrige si quedó basura de remuneración (ej. 3500000).
 */
export async function fillYearsNumericGeneral(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, value } = PSEUDO_ANSWERS.yearsNumericGeneral;
  const skillYears = PSEUDO_ANSWERS.yearsOfExperience.fieldMatch;
  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio'])"
  );
  const n = await controls.count();
  let any = false;

  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = await fieldLabel(el);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const id = ((await el.getAttribute("id")) ?? "").trim();
    const near = await el
      .evaluate((node) => {
        const wrap =
          node.closest(
            ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
          ) ?? node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 280);
      })
      .catch(() => "");
    const blob = `${label} ${aria} ${id} ${near}`;
    if (skillYears.test(blob)) continue;
    if (!fieldMatch.test(blob) && !(/years/i.test(blob) && /administrative/i.test(blob))) {
      continue;
    }
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    const nVal = Number(current.replace(/[^\d]/g, ""));
    const alreadyOk = current !== "" && Number.isFinite(nVal) && nVal >= 0 && nVal <= 99;
    if (alreadyOk) {
      console.log(`   ↳ Years (general): dejo prefill ("${current}")`);
      any = true;
      continue;
    }
    const ok = await fillInputWithWaits(page, el, value, {
      logName: "Years (general/admin)",
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (ok) {
      console.log(`   ↳ Years (general/admin): ${value}`);
      any = true;
    }
  }
  return any;
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
        await clickSafeInEasyApply(hit, { timeoutMs: 3000 });
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
        if (await clickSafeInEasyApply(hit, { timeoutMs: 3000 })) {
          console.log("   ↳ How did you hear: LinkedIn (dropdown click)");
          await sleep(400);
          return true;
        }
      }
    }
    // Fallback: solo option/listbox (nunca getByText en el feed)
    const byOpt = page
      .getByRole("listbox")
      .getByRole("option", { name: /^LinkedIn$/i })
      .first();
    if (await byOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
      if (await clickSafeInEasyApply(byOpt)) {
        console.log("   ↳ How did you hear: LinkedIn (option)");
        return true;
      }
    }
    console.log("   ↳ How did you hear: tipeé LinkedIn (sin hit de dropdown)");
    return true;
  }
  return false;
}

const COVER_AS_RESUME_RE = /intro-GGZ|intro\s*letter|cover\s*letter|introduction\s*letter/i;
const DOWNLOAD_RESUME_RE = /download\s+resume/i;
/** Link LinkedIn EN/ES: "Show 3 more resumes" / "Mostrar N currículums más". */
const SHOW_MORE_RESUMES_RE =
  /show\s+\d+\s+more\s+resumes?|mostrar\s+\d+\s+(curr[ií]culums?|cvs?|resumes?)\s+m[aá]s|ver\s+\d+\s+m[aá]s/i;

type DocumentCardToggle = {
  id: string;
  title: string;
  selected: boolean;
  aria: string;
};

/**
 * Recorre #interop-outlet.shadowRoot (+ nested) buscando jobsDocumentCardToggleLabel-*.
 * evaluate como string: evita __name de tsx/esbuild en el browser.
 */
async function listDocumentCardToggles(page: Page): Promise<DocumentCardToggle[]> {
  // Solo dentro del modal Easy Apply — #interop-outlet del feed queda DETRÁS y
  // un click force ahí navega/abre links del aviso, no el CV del modal.
  return page.evaluate(`(() => {
    const out = [];
    const seen = new Set();
    function walk(root) {
      const toggles = root.querySelectorAll('[id^="jobsDocumentCardToggleLabel-"]');
      for (const el of Array.from(toggles)) {
        const id = el.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const aria = (el.getAttribute("aria-label") || "").trim();
        if (/download\\s+resume/i.test(aria)) continue;
        const card =
          el.closest(
            "[class*='document'], [class*='JobsDocument'], [class*='resume'], li, label"
          ) || el.parentElement;
        const raw = (aria + " " + (card && card.textContent ? card.textContent : ""))
          .replace(/\\s+/g, " ")
          .trim();
        if (/download\\s+resume/i.test(raw) && !/(select|deselect)\\s+resume/i.test(aria)) {
          continue;
        }
        const ariaMatch = aria.match(/(?:select|deselect)\\s+resume\\s+(.+\\.pdf)/i);
        const fromAria = ariaMatch && ariaMatch[1] ? ariaMatch[1].trim() : "";
        const pdfMatch = raw.match(/[\\w.\\-]+\\.pdf/i);
        const pdf = pdfMatch ? pdfMatch[0] : "";
        const title = fromAria || pdf || aria;
        if (!title) continue;
        // "Deselect resume X" = ya seleccionado; "Select resume X" = no
        var selected = /deselect\\s+resume/i.test(aria);
        var forId = el.getAttribute("for");
        if (forId) {
          var input = null;
          try {
            input = root.querySelector("#" + CSS.escape(forId));
          } catch (e1) {
            input = root.querySelector('[id="' + forId + '"]');
          }
          if (input && (input.checked === true || input.getAttribute("aria-checked") === "true")) {
            selected = true;
          }
        }
        if (el.getAttribute("aria-checked") === "true" || el.checked === true) selected = true;
        out.push({ id: id, title: title, selected: selected, aria: aria });
      }
      for (const node of Array.from(root.querySelectorAll("*"))) {
        if (node.shadowRoot) walk(node.shadowRoot);
      }
    }
    const modal = document.querySelector(".jobs-easy-apply-modal");
    if (!modal) return out;
    walk(modal);
    const outlet = modal.querySelector("#interop-outlet");
    if (outlet && outlet.shadowRoot) walk(outlet.shadowRoot);
    return out;
  })()`) as Promise<DocumentCardToggle[]>;
}

async function clickDocumentCardToggle(page: Page, toggleId: string): Promise<boolean> {
  const modal = page.locator(".jobs-easy-apply-modal").first();
  if (!(await modal.isVisible({ timeout: 800 }).catch(() => false))) return false;

  // 1) Solo dentro del modal (nunca #interop-outlet del feed detrás)
  const pierced = modal.locator("#interop-outlet").locator(`[id="${toggleId}"]`);
  if ((await pierced.count().catch(() => 0)) > 0) {
    if (await clickSafeInEasyApply(pierced, { timeoutMs: 4000 })) {
      await sleep(400);
      return true;
    }
  }
  const inModal = modal.locator(`[id="${toggleId}"]`);
  if ((await inModal.count().catch(() => 0)) > 0) {
    if (await clickSafeInEasyApply(inModal.first(), { timeoutMs: 4000 })) {
      await sleep(400);
      return true;
    }
  }

  // 2) Fallback evaluate + pointer events — scoped al modal
  return page.evaluate(
    `(() => {
      const id = ${JSON.stringify(toggleId)};
      const modal = document.querySelector(".jobs-easy-apply-modal");
      if (!modal) return false;
      function findIn(root) {
        var el = null;
        try { el = root.querySelector("#" + CSS.escape(id)); }
        catch (e) { el = root.querySelector('[id="' + id + '"]'); }
        if (el) return el;
        for (const node of Array.from(root.querySelectorAll("*"))) {
          if (node.shadowRoot) {
            const found = findIn(node.shadowRoot);
            if (found) return found;
          }
        }
        return null;
      }
      const outlet = modal.querySelector("#interop-outlet");
      let el = outlet && outlet.shadowRoot ? findIn(outlet.shadowRoot) : null;
      if (!el) el = findIn(modal);
      if (!el) return false;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      var forId = el.getAttribute("for");
      var input = null;
      if (forId) {
        try {
          input = (outlet && outlet.shadowRoot
            ? outlet.shadowRoot.querySelector("#" + CSS.escape(forId))
            : null) || modal.querySelector("#" + CSS.escape(forId));
        } catch (e2) {
          input = modal.querySelector('[id="' + forId + '"]');
        }
      }
      var target = input || el;
      if (input && (input.checked === true || input.getAttribute("aria-checked") === "true")) {
        return true;
      }
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (type) {
        target.dispatchEvent(
          new MouseEvent(type, { bubbles: true, cancelable: true, view: window })
        );
      });
      if (input) {
        input.checked = true;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return true;
    })()`
  ) as Promise<boolean>;
}

async function selectedResumeLabel(page: Page, root: Locator): Promise<string> {
  const toggles = await listDocumentCardToggles(page);
  const fromToggle = toggles
    .filter((t) => t.selected)
    .map((t) => t.title)
    .join(" | ");
  if (fromToggle) return fromToggle;

  // Fallback light DOM: Deselect/Select resume (nunca Download)
  return root
    .locator(
      "[aria-label*='Deselect resume' i], [aria-label*='Select resume' i], input[type='radio']:checked"
    )
    .evaluateAll((nodes) =>
      nodes
        .map((n) => {
          const aria = n.getAttribute("aria-label") ?? "";
          if (/download\s+resume/i.test(aria)) return "";
          return aria.trim();
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
  if (!(await clickSafeInEasyApply(target, { timeoutMs: 4000 }))) return false;
  await sleep(1000);
  return true;
}

async function isRoleResumeSelected(page: Page, kind: ApplyRoleKind): Promise<boolean> {
  const toggles = await listDocumentCardToggles(page);
  return toggles.some(
    (t) =>
      t.selected &&
      scoreResumeForRole(t.title, kind) >= 70 &&
      !COVER_AS_RESUME_RE.test(t.title) &&
      !DOWNLOAD_RESUME_RE.test(t.aria)
  );
}

/**
 * Click UNA vez en jobsDocumentCardToggleLabel-* del mejor score.
 * Si ya está seleccionado (Deselect resume), no re-clickear (evita deseleccionar).
 */
async function clickBestResumeToggle(page: Page, kind: ApplyRoleKind): Promise<boolean> {
  if (await isRoleResumeSelected(page, kind)) {
    console.log(`   ↳ Resume: ya seleccionado OK (${kind}) — no re-click`);
    return true;
  }

  const toggles = await listDocumentCardToggles(page);
  let best: DocumentCardToggle | null = null;
  let bestScore = 0;

  for (const t of toggles) {
    if (DOWNLOAD_RESUME_RE.test(t.aria) || DOWNLOAD_RESUME_RE.test(t.title)) continue;
    if (COVER_AS_RESUME_RE.test(t.title) || COVER_AS_RESUME_RE.test(t.aria)) continue;
    const score = scoreResumeForRole(t.title, kind);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  const modal = page.locator(".jobs-easy-apply-modal").first();

  if (!best || bestScore < 70) {
    // Fallback light DOM: solo "Select resume" (no Download, no Deselect) — dentro del modal
    const selectLabels = modal.locator('[aria-label^="Select resume" i]');
    const n = await selectLabels.count().catch(() => 0);
    let fbBest = -1;
    let fbScore = 0;
    let fbTitle = "";
    for (let i = 0; i < n; i++) {
      const el = selectLabels.nth(i);
      const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
      if (DOWNLOAD_RESUME_RE.test(aria) || COVER_AS_RESUME_RE.test(aria)) continue;
      if (/^deselect\s+resume/i.test(aria)) continue;
      const title = aria.replace(/^select\s+resume\s+/i, "").trim();
      const score = scoreResumeForRole(title || aria, kind);
      if (score > fbScore) {
        fbScore = score;
        fbBest = i;
        fbTitle = title || aria;
      }
    }
    if (fbBest >= 0 && fbScore >= 70) {
      const el = selectLabels.nth(fbBest);
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click({ timeout: 4000, noWaitAfter: true }).catch(() =>
        el.click({ force: true, timeout: 4000, noWaitAfter: true })
      );
      console.log(
        `   ↳ Resume: click TOGGLE (aria) ${kind} (score=${fbScore}) → ${fbTitle.slice(0, 90)}`
      );
      await sleep(600);
      return isRoleResumeSelected(page, kind);
    }
    return false;
  }

  if (best.selected) {
    console.log(
      `   ↳ Resume: toggle ya seleccionado ${kind} → ${best.title.slice(0, 90)}`
    );
    return true;
  }

  const ok = await clickDocumentCardToggle(page, best.id);
  if (!ok) {
    console.log(`   ↳ Resume: no pude clickear toggle id=${best.id}`);
    return false;
  }
  console.log(
    `   ↳ Resume: click TOGGLE ${kind} (score=${bestScore}) id=${best.id} → ${best.title.slice(0, 90)}`
  );
  await sleep(700);

  // Refuerzo: aria Select/Deselect resume <filename> (sin Download) — solo modal
  const fileKey = best.title.replace(/\.pdf$/i, "").slice(0, 48);
  const deselectAria = modal.locator(
    `[aria-label^="Deselect resume"][aria-label*="${fileKey}" i]`
  );
  const selectAria = modal.locator(
    `[aria-label^="Select resume"][aria-label*="${fileKey}" i]`
  );
  if (await selectAria.first().isVisible({ timeout: 800 }).catch(() => false)) {
    await selectAria
      .first()
      .click({ timeout: 4000, noWaitAfter: true })
      .catch(() => selectAria.first().click({ force: true, timeout: 4000, noWaitAfter: true }));
    await sleep(500);
  } else if (await deselectAria.first().isVisible({ timeout: 500 }).catch(() => false)) {
    console.log("   ↳ Resume: form ya en Deselect (seleccionado)");
  }

  const pdfToken = best.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80);
  const formRadio = modal.getByRole("radio", { name: new RegExp(pdfToken, "i") }).first();
  if (await formRadio.count().catch(() => 0)) {
    const checked = await formRadio.isChecked().catch(() => false);
    if (!checked) {
      await formRadio.check({ force: true }).catch(async () => {
        await formRadio.click({ timeout: 3000, noWaitAfter: true });
      });
      await sleep(400);
    }
  }

  const needResume = modal.getByText(
    /se necesita un curr[ií]culum|resume is required|please select a resume/i
  );
  for (let w = 0; w < 8; w++) {
    if (!(await needResume.isVisible({ timeout: 400 }).catch(() => false))) {
      console.log("   ↳ Resume: error currículum ausente — form OK");
      break;
    }
    console.log("   ↳ Resume: error 'Se necesita un currículum' — re-bind…");
    await clickDocumentCardToggle(page, best.id);
    if (await selectAria.first().isVisible({ timeout: 400 }).catch(() => false)) {
      await selectAria.first().click({ timeout: 3000, noWaitAfter: true }).catch(() => {});
    }
    // NUNCA page.getByText(pdf): el título puede existir en el feed detrás del modal
    const name = modal.getByText(best.title, { exact: true }).first();
    if (await name.isVisible({ timeout: 400 }).catch(() => false)) {
      await name.click({ timeout: 3000, noWaitAfter: true }).catch(() => {});
    }
    await sleep(800);
  }

  const uiOk = await isRoleResumeSelected(page, kind);
  const errGone = !(await needResume.isVisible({ timeout: 500 }).catch(() => false));
  if (uiOk && errGone) return true;
  if (uiOk && !errGone) {
    console.log(
      "   ↳ Resume: ⚠ toggle UI OK pero form sigue con 'Se necesita un currículum'"
    );
    return false;
  }
  console.log("   ↳ Resume: no quedó seleccionado tras re-bind");
  return false;
}

/**
 * Último recurso: CV Eng01-2026 cuando no hay match Analyst/Automation.
 * NUNCA cover letter / intro-GGZ.
 */
async function clickResumeFallbackDefault(page: Page): Promise<boolean> {
  const modal = page.locator(".jobs-easy-apply-modal").first();
  if (!(await modal.isVisible({ timeout: 500 }).catch(() => false))) return false;

  const toggles = await listDocumentCardToggles(page);
  for (const t of toggles) {
    if (DOWNLOAD_RESUME_RE.test(t.aria) || COVER_AS_RESUME_RE.test(t.title)) continue;
    if (!RESUME_FALLBACK_MATCH.test(t.title) && !RESUME_FALLBACK_MATCH.test(t.aria)) continue;
    if (t.selected) {
      console.log(`   ↳ Resume: fallback ya seleccionado → ${RESUME_FALLBACK_FILENAME}`);
      return true;
    }
    const ok = await clickDocumentCardToggle(page, t.id);
    if (ok) {
      console.log(`   ↳ Resume: fallback (sin match rol) → ${t.title.slice(0, 90)}`);
      await sleep(600);
      return true;
    }
  }

  const selectLabels = modal.locator('[aria-label^="Select resume" i]');
  const n = await selectLabels.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const el = selectLabels.nth(i);
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    if (DOWNLOAD_RESUME_RE.test(aria) || COVER_AS_RESUME_RE.test(aria)) continue;
    if (!RESUME_FALLBACK_MATCH.test(aria)) continue;
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el
      .click({ timeout: 4000, noWaitAfter: true })
      .catch(() => el.click({ force: true, timeout: 4000, noWaitAfter: true }));
    console.log(`   ↳ Resume: fallback (aria) → ${RESUME_FALLBACK_FILENAME}`);
    await sleep(600);
    return true;
  }

  const deselect = modal.locator(
    `[aria-label^="Deselect resume" i][aria-label*="Eng01-2026" i]`
  );
  if (await deselect.first().isVisible({ timeout: 400 }).catch(() => false)) {
    console.log(`   ↳ Resume: fallback ya en Deselect → ${RESUME_FALLBACK_FILENAME}`);
    return true;
  }

  return false;
}

/**
 * Selecciona CV Analyst vs Automation vía toggle Ember (shadow DOM).
 * NUNCA dejar intro-GGZ / cover; NUNCA clickear Download.
 * Si no hay match de rol → fallback Eng01-2026.
 */
export async function selectResumeForRole(
  page: Page,
  jobTitle = "",
  company = ""
): Promise<boolean> {
  const kind = detectApplyRoleKind(jobTitle, company);
  // Solo modal Easy Apply (nunca <main>: evita falsos .pdf del JD)
  const root = page.locator(".jobs-easy-apply-modal").first();
  if (!(await root.isVisible({ timeout: 800 }).catch(() => false))) return false;

  // Review/Submit: no hay paso CV — no buscar toggles ni clickear detrás del modal
  const submitVisible = await root
    .locator(
      "button[data-live-test-easy-apply-submit-button], button[data-easy-apply-submit-button]"
    )
    .or(root.getByRole("button", { name: /Submit application|^Submit$|Enviar solicitud|^Enviar$/i }))
    .first()
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (submitVisible) return false;

  const toggles0 = await listDocumentCardToggles(page);
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
    .getByText(/curr[ií]culum|be sure to include an updated resume/i)
    .first()
    .isVisible({ timeout: 600 })
    .catch(() => false);
  if (toggles0.length === 0 && !pdfVisible && !showLinkVisible && !curriculumStep) {
    return false;
  }

  if (await isRoleResumeSelected(page, kind)) {
    console.log(`   ↳ Resume: ya seleccionado OK (${kind}) — no es cover letter`);
    return true;
  }

  const selectedBlob = await selectedResumeLabel(page, root);
  if (COVER_AS_RESUME_RE.test(selectedBlob) || /intro-GGZ/i.test(selectedBlob)) {
    console.log(
      `   ↳ Resume: ⚠ default es cover letter ("${selectedBlob.slice(0, 60)}") — cambiar a ${kind}`
    );
  } else if (selectedBlob) {
    console.log(
      `   ↳ Resume: default no matchea ${kind} ("${selectedBlob.slice(0, 50)}") — buscar CV`
    );
  }

  const roleCvVisibleInDefault = async (): Promise<boolean> => {
    const toggles = await listDocumentCardToggles(page);
    for (const t of toggles) {
      if (COVER_AS_RESUME_RE.test(t.title)) continue;
      if (scoreResumeForRole(t.title, kind) >= 70) return true;
    }
    const pdfHits = root.getByText(/\.pdf/i);
    const pn = await pdfHits.count().catch(() => 0);
    for (let i = 0; i < pn; i++) {
      const t = ((await pdfHits.nth(i).innerText().catch(() => "")) ?? "").trim();
      if (COVER_AS_RESUME_RE.test(t)) continue;
      if (scoreResumeForRole(t, kind) >= 70) return true;
    }
    return false;
  };

  if (!(await roleCvVisibleInDefault())) {
    console.log(`   ↳ Resume: CV ${kind} no visible en default → Show more + toggle`);
    await clickShowMoreResumes(root);
  } else {
    console.log(`   ↳ Resume: CV ${kind} visible → click TOGGLE (no Download)`);
  }

  // Un intento (+ Show more si falla). clickBestResumeToggle ya evita re-click si OK.
  if (await clickBestResumeToggle(page, kind)) return true;
  await clickShowMoreResumes(root);
  if (await clickBestResumeToggle(page, kind)) return true;

  // Sin match Analyst/Automation → CV canónico Eng01-2026
  console.log(
    `   ↳ Resume: sin match ${kind} → fallback ${RESUME_FALLBACK_FILENAME}`
  );
  await clickShowMoreResumes(root);
  if (await clickResumeFallbackDefault(page)) return true;

  if (COVER_AS_RESUME_RE.test(await selectedResumeLabel(page, root))) {
    console.log("   ↳ Resume: ✗ sigue seleccionado intro-GGZ / cover — no avanzar");
    return false;
  }

  console.log(`   ↳ Resume: no encontré / no quedó seleccionado CV ${kind} ni fallback`);
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
    // Capgemini/Macro meten varias preguntas en un mismo bloque (>400 chars)
    if (blob.length < 6 || blob.length > 1200) continue;

    const resolved = resolveSkillYesNo(blob);
    if (!resolved) continue;

    const wantYes = resolved.answerYes;
    const yesRe = /^(Yes|Sí|Si)$/i;
    const noRe = /^(No)$/i;
    const yesLoose = /yes|s[ií]/i;
    const noLoose = /^no$/i;

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

    // Select Yes/No (Capgemini: "Selecciona una opción" + Sí/No)
    if (!clicked) {
      const sel = block.locator("select").first();
      if (await sel.isVisible({ timeout: 400 }).catch(() => false)) {
        const cur = ((await sel.inputValue().catch(() => "")) ?? "").trim();
        if (hasPrefillValue(cur) && !EMPTY_SELECT_RE.test(cur)) {
          console.log(`   ↳ Skill ${resolved.skill}: dejo prefill select`);
          continue;
        }
        const opts = sel.locator("option");
        const oc = await opts.count().catch(() => 0);
        let picked: { v: string | null; lab: string } | null = null;
        for (let o = 0; o < oc; o++) {
          const opt = opts.nth(o);
          const lab = ((await opt.innerText().catch(() => "")) ?? "").trim();
          if (EMPTY_SELECT_RE.test(lab) || !lab) continue;
          const match = wantYes ? yesRe.test(lab) || yesLoose.test(lab) : noRe.test(lab) || noLoose.test(lab);
          if (!match) continue;
          // Prefer exact Yes/Sí over longer labels
          const exact = wantYes ? yesRe.test(lab) : noRe.test(lab);
          const v = await opt.getAttribute("value");
          if (exact || !picked) picked = { v, lab };
          if (exact) break;
        }
        if (picked) {
          if (picked.v != null && picked.v !== "") await sel.selectOption(picked.v);
          else await sel.selectOption({ label: picked.lab }).catch(() => {});
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

/** English proficiency: escala numérica → máximo (50 años); CEFR → Advanced (C1). */
export async function fillEnglishProficiency(page: Page): Promise<boolean> {
  const root = scopeRoot(page);
  const { fieldMatch, freeText, selectMatch, preferredSelect, numericYears } =
    PSEUDO_ANSWERS.englishProficiency;

  const selects = root.locator("select");
  const sn = await selects.count();
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await waitForControlReady(el, 2500))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
    const near = await el
      .evaluate((node) => {
        const wrap =
          node.closest(
            ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
          ) ?? node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 280);
      })
      .catch(() => "");
    const blob = `${label} ${aria} ${near}`;
    if (!fieldMatch.test(blob)) continue;

    const optionEls = el.locator("option");
    const oc = await optionEls.count().catch(() => 0);
    const opts: { text: string; value: string | null }[] = [];
    for (let o = 0; o < oc; o++) {
      const opt = optionEls.nth(o);
      const text = ((await opt.innerText().catch(() => "")) ?? "").trim();
      const value = await opt.getAttribute("value");
      opts.push({ text, value });
    }

    // Escala numérica (1–10 / 10+ / 8-9): NUNCA poner "Advanced (C1)"
    if (optionsLookNumeric(opts.map((x) => x.text))) {
      const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
      if (hasPrefillValue(val) && !EMPTY_SELECT_RE.test(val) && parseYearsOptionLabel(val)) {
        console.log(`   ↳ English numeric: dejo prefill ("${val.slice(0, 40)}")`);
        return true;
      }
      const best = pickBestYearsOption(opts, numericYears);
      if (!best) continue;
      if (best.value != null && best.value !== "") await el.selectOption(best.value);
      else await el.selectOption({ label: best.text }).catch(() => {});
      console.log(`   ↳ English numeric: ${best.text} (target ${numericYears})`);
      await sleep(300);
      return true;
    }

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
    const id = ((await el.getAttribute("id")) ?? "").trim();
    const near = await el
      .evaluate((node) => {
        const wrap =
          node.closest(
            ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
          ) ?? node.parentElement;
        return (wrap?.textContent ?? "").trim().slice(0, 320);
      })
      .catch(() => "");
    const blob = `${label} ${aria} ${id} ${near}`;
    if (!fieldMatch.test(blob)) continue;
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (hasPrefillValue(current)) {
      console.log(`   ↳ English: dejo prefill ("${current.slice(0, 40)}")`);
      return true;
    }
    // Input numérico / escala 1–10 → tope, no texto CEFR
    const isNumericInput =
      /numeric|number|spinner/i.test(id) ||
      ((await el.getAttribute("type")) ?? "").toLowerCase() === "number" ||
      /years|a[nñ]os|escala|scale|1\s*(al|a|[-–])\s*10|del\s*1\s*al\s*10/i.test(blob);
    const fillValue = isNumericInput ? String(Math.min(numericYears, 99)) : freeText;
    const finalValue =
      isNumericInput && /10|1\s*(al|a|[-–])\s*10|del\s*1\s*al\s*10/i.test(blob)
        ? "10"
        : fillValue;
    const ok = await fillInputWithWaits(page, el, finalValue, {
      logName: "English proficiency",
      maxAttempts: 2,
      expectTypeahead: false,
    });
    if (ok) console.log(`   ↳ English: ${finalValue}`);
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
      // Solo bloquear si parece pregunta de AÑOS (no Sí/No "experiencia en X")
      if (!/years?|a[nñ]os?/i.test(blob)) continue;
      const hit = resolveSkillYears(blob);
      if (hit) {
        // Hay mapa → no bloquear; fillSkillYearsOfExperience lo rellena
        continue;
      }
      return {
        reason: "Pregunta years of experience (skill sin mapa) — pendiente",
        notes: `Pendiente: years of experience — skill no mapeada en skills-years.ts ("${blob.slice(0, 120)}")`,
      };
    }

    if (PSEUDO_ANSWERS.dataQualityFrameworks.fieldMatch.test(blob)) {
      // No + continuar (no bloquear envío)
      const noRadio = block.getByRole("radio", { name: /^No$/i }).or(block.getByText(/^No$/i)).first();
      if (await noRadio.isVisible({ timeout: 600 }).catch(() => false)) {
        await noRadio.click({ force: true }).catch(() => {});
        console.log("   ↳ Data quality frameworks: No");
      }
      continue;
    }

    // Dropdown visible sin respuesta definida → Notas (no adivinar)
    const sel = block.locator("select").first();
    if (await sel.isVisible({ timeout: 200 }).catch(() => false)) {
      const cur = ((await sel.inputValue().catch(() => "")) ?? "").trim();
      const empty = !cur || EMPTY_SELECT_RE.test(cur) || cur === "0";
      if (!empty) continue;
      const known =
        PSEUDO_ANSWERS.hybridWorkOk.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.programmingScripting.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.englishProficiency.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.yearsOfExperience.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.country.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.phoneCountryCode.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.startAvailability.fieldMatch.test(blob) ||
        PSEUDO_ANSWERS.howDidYouHear.fieldMatch.test(blob) ||
        resolveSkillYesNo(blob) != null ||
        resolveSkillYears(blob) != null;
      if (known) continue;
      // Sí/No genérico sin skill mapeada
      const optsText = ((await sel.innerText().catch(() => "")) ?? "").slice(0, 200);
      if (/Yes|Sí|Si|\bNo\b/i.test(optsText) && !resolveSkillYesNo(blob)) {
        return {
          reason: "Dropdown Sí/No sin regla definida — pendiente",
          notes: `Pendiente dropdown sin definir: "${blob.slice(0, 100)}"`,
        };
      }
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

  // CV primero (nunca dejar intro-GGZ / cover como resume) — solo si hay paso currículum
  if (await selectResumeForRole(page, jobTitle, company)) filled++;
  if (await fillLocationLiniers(page)) filled++;
  if (await fillCountrySelect(page)) filled++;
  if (await fillPhoneCountryCode(page)) filled++;
  if (await fillCitySelect(page)) filled++;
  if (await fillPreferredWorkLocation(page)) filled++;
  if (await fillWorkOrLiveCityFreeText(page)) filled++;
  if (await fillHowDidYouHear(page)) filled++;
  if (await fillStartAvailability(page)) filled++;
  if (await fillEnglishProficiency(page)) filled++;
  filled += await answerSkillYesNoQuestions(page);
  filled += await answerHybridAndProgramming(page);

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
  // Re-chequear CV solo si el paso de currículum sigue visible (no en Review/Follow)
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
  // Antes de remuneración: años por skill, luego años generales/admin
  filled += await fillSkillYearsOfExperience(page);
  if (await fillYearsNumericGeneral(page)) filled++;
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
    const clicked =
      (await discard
        .click({ timeout: 4000 })
        .then(() => true)
        .catch(() => false)) ||
      (await page
        .getByRole("button", { name: /Discard|Descartar/i })
        .first()
        .click({ force: true, timeout: 4000 })
        .then(() => true)
        .catch(() => false));
    if (clicked) {
      console.log("   ↳ [dry-run] Save/Discard → Discard (salir sin guardar ni enviar)");
      await sleep(600);
      return "discarded";
    }
    await page.keyboard.press("Escape").catch(() => {});
    console.log("   ↳ [dry-run] Save/Discard → Escape (Discard no clickeable)");
    return "absent";
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
