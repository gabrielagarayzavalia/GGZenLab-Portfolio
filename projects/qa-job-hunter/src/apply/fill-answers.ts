// Relleno pseudo-hardcodeado + captura de campos obligatorios (Easy Apply).
// Cuando Next no avanza: dump de required → cerrar sesión para completar respuestas.

import fs from "fs";
import path from "path";
import type { Locator, Page } from "playwright";
import { APPLY_DIR, ensureDirs } from "./paths.js";
import { dismissModalOverlays, easyApplyModalRoot } from "./modal-controls.js";

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
    /** Campo Location / City / Comuna (typeahead) */
    fieldMatch: /location\s*\(city\)|location|city|ciudad|ubicaci[oó]n|comuna|localidad|where do you live/i,
    /** Si el valor/hint menciona comuna 9 → tipear Liniers */
    hintMatch: /comuna\s*9/i,
    typeText: "Liniers",
    /** Click obligatorio en el item del dropdown (no basta tipear). */
    suggestionMatch: /Liniers/i,
    /** Preferir la fila completa: Liniers, Comuna 9, … */
    preferredSuggestion: /Liniers[\s\S]*Comuna\s*9|Comuna\s*9[\s\S]*Liniers/i,
    /** Valor válido tras el click (GEO completo). */
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
      /expected\s*(salary|compensation|pay|ctc)|salary\s*expectation|desired\s*salary|compensation\s*expectation|remuneraci[oó]n(\s*pretendida)?|sueldo\s*(pretendido|esperado|bruto)|pretensi[oó]n\s*salarial|salario\s*(bruto|esperado|deseado)|current\s*salary|annual\s*salary|monthly\s*salary|gross\s*(salary|pay)/i,
    usdMatch: /\b(usd|u\$s|us\$|d[oó]lar(es)?|dollars?)\b|\$\s*usd/i,
    arsMatch: /\b(ars|peso(s)?(\s*argentinos?)?|\$\s*ar|arg(?:entina)?)\b/i,
    usdValue: "2750",
    arsValue: "3500000",
    /** Sin moneda explícita → ARS (contexto AR). */
    defaultCurrency: "ARS",
  },
} as const;

const EMPTY_SELECT_RE = /select an option|seleccion(a|á)|choose|elegí|elegir/i;
const PLEASE_SELECT_RE = /please make a selection|hac[eé] una selecci[oó]n|seleccion(a|á) una opci[oó]n/i;

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

/** Click en el item del dropdown (obligatorio). Prefiere Liniers + Comuna 9. */
async function clickLocationSuggestion(page: Page): Promise<string | null> {
  const { preferredSuggestion, suggestionMatch } = PSEUDO_ANSWERS.locationCity;
  const hits = typeaheadHits(page);

  await hits
    .first()
    .waitFor({ state: "visible", timeout: 4000 })
    .catch(() => {});

  const preferred = hits.filter({ hasText: preferredSuggestion }).first();
  const fallback = hits.filter({ hasText: suggestionMatch }).first();
  const target = (await preferred.isVisible({ timeout: 1500 }).catch(() => false))
    ? preferred
    : fallback;

  if (!(await target.isVisible({ timeout: 2000 }).catch(() => false))) {
    return null;
  }

  const text = ((await target.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  // El click en el <li>/hit es lo que valida el GEO; tipear solo no alcanza.
  const clicked =
    (await target.click({ timeout: 4000 }).then(() => true).catch(() => false)) ||
    (await target.click({ force: true, timeout: 4000 }).then(() => true).catch(() => false));
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
      await input.scrollIntoViewIfNeeded().catch(() => {});
      await input.click({ timeout: 4000 });
      await sleep(200);
      // Seleccionar todo y borrar (más fiable que fill("") en typeahead LinkedIn)
      await input.press("Control+a").catch(() => {});
      await input.press("Backspace").catch(() => {});
      await input.fill("").catch(() => {});
      await sleep(250);
      await input.pressSequentially(typeText, { delay: 100 });
      await sleep(1600);

      const dropdownVisible = await typeaheadHits(page)
        .first()
        .isVisible({ timeout: 3500 })
        .catch(() => false);

      if (!dropdownVisible) {
        console.log(`   ↳ ${labelForLog}: dropdown no apareció — reintento`);
        // Forzar foco de nuevo
        await input.click({ force: true, timeout: 2000 }).catch(() => {});
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

  // Solo OK si ya quedó el GEO completo (Liniers + Comuna 9 o con coma)
  if (locationValueOk(val)) {
    return true;
  }

  return typeaheadWithDropdownRetries(page, input, typeText, "Location", locationValueOk, 3);
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
  // Si Location ya tiene GEO válido, no cerrar por ruido de otros labels ("required" en UI).
  const loc = await findLocationInput(page);
  const locVal = loc ? ((await loc.inputValue().catch(() => "")) ?? "").trim() : "";
  if (ok || locationValueOk(locVal)) {
    console.log("   ✓ Recover typeahead OK (Location válido)");
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
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = (await fieldLabel(el)).replace(/\s+/g, " ").trim();
    // Evitar "Phone country code"
    if (/phone|tel[eé]fono|c[oó]digo/i.test(label)) continue;
    if (!fieldMatch.test(label) && !/^(country|pa[ií]s)\b/i.test(label)) continue;
    const val = ((await el.inputValue().catch(() => "")) ?? "").trim();
    if (val && !EMPTY_SELECT_RE.test(val) && selectText.test(val)) return true;
    const opt = el.locator("option").filter({ hasText: selectText }).first();
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
    const current = ((await el.inputValue().catch(() => "")) ?? "").trim().replace(/[,\s.]/g, "");
    const normalizedTarget = value.replace(/[,\s.]/g, "");
    if (current === normalizedTarget || current === value) {
      filled = true;
      continue;
    }

    await el.click({ timeout: 2000 }).catch(() => {});
    await el.fill("");
    await el.fill(value);
    console.log(`   ↳ Remuneración pretendida (${currency}): ${value}`);
    await sleep(300);
    filled = true;
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
    if (current === value || current.includes("gabriela-garayzavalia")) {
      return true;
    }
    await el.fill(value);
    console.log(`   ↳ ${logName}: ${value}`);
    await sleep(300);
    return true;
  }
  return false;
}

/** Aplica pseudo-respuestas conocidas en el paso actual. */
export async function fillPseudoAnswers(page: Page): Promise<number> {
  let filled = 0;
  if (await fillLocationLiniers(page)) filled++;
  if (await fillCountrySelect(page)) filled++;
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
  await dismissModalOverlays(page);
  return filled;
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
