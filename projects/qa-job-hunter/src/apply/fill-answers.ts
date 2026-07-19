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
}

/** Pseudo-respuestas (ampliar a mano hasta B17-2 con apply-answers.json). */
export const PSEUDO_ANSWERS = {
  locationCity: {
    /** Campo Location / City / Comuna */
    fieldMatch: /location|city|ciudad|ubicaci[oó]n|comuna|localidad|where do you live/i,
    /** Si el valor/hint menciona comuna 9 → tipear Liniers */
    hintMatch: /comuna\s*9/i,
    typeText: "Liniers",
    suggestionMatch: /Liniers/i,
  },
} as const;

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

/** Lista campos visibles (prioriza required / con error / vacíos). */
export async function captureRequiredFields(page: Page): Promise<CapturedField[]> {
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

    const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => "");
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
    const required = ariaRequired || htmlRequired || Boolean(errorText) || !value;

    // Solo nos interesan obligatorios, con error, o vacíos relevantes
    if (!ariaRequired && !htmlRequired && !errorText && value) continue;

    out.push({
      label: label || ariaLabel || placeholder || name || id || `(unnamed ${tag})`,
      tag,
      inputType,
      name,
      id,
      required: required || Boolean(errorText),
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
      value: "",
      ariaLabel: "",
      placeholder: "",
      errorText: t,
    });
  }

  return out;
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

/** Location (city): si lee comuna 9 (o es Location), tipear Liniers y elegir sugerencia. */
export async function fillLocationLiniers(page: Page): Promise<boolean> {
  const input = await findLocationInput(page);
  if (!input) return false;

  const label = await fieldLabel(input);
  const val = ((await input.inputValue().catch(() => "")) ?? "").trim();
  const blob = `${label} ${val}`;
  const { fieldMatch, hintMatch, typeText, suggestionMatch } = PSEUDO_ANSWERS.locationCity;

  // Solo actuar si es location/city o ya menciona comuna 9
  if (!fieldMatch.test(blob) && !hintMatch.test(blob)) return false;
  if (suggestionMatch.test(val) && !hintMatch.test(val)) {
    return true; // ya tiene Liniers
  }

  console.log(`   ↳ Location: tipeando "${typeText}" (hint: ${blob.slice(0, 80)})`);
  await input.click({ timeout: 3000 }).catch(() => {});
  await input.fill("");
  await input.pressSequentially(typeText, { delay: 80 });
  await sleep(1200);

  // Sugerencia typeahead LinkedIn
  const suggestion = page
    .locator(
      [
        "[data-test-single-typeahead-entity-form-search-result]",
        ".basic-typeahead__selectable",
        "[role='option']",
        ".search-typeahead-v2__hit",
      ].join(", ")
    )
    .filter({ hasText: suggestionMatch })
    .first();

  if (await suggestion.isVisible({ timeout: 2500 }).catch(() => false)) {
    await suggestion.click({ timeout: 4000 }).catch(async () => {
      await suggestion.click({ force: true, timeout: 4000 });
    });
    await sleep(600);
    console.log(`   ↳ Location: seleccionado "${typeText}"`);
    return true;
  }

  // Fallback: Enter sobre primera opción
  await page.keyboard.press("ArrowDown").catch(() => {});
  await page.keyboard.press("Enter").catch(() => {});
  await sleep(500);
  const after = ((await input.inputValue().catch(() => "")) ?? "").trim();
  return suggestionMatch.test(after) || after.length > 0;
}

/** Aplica pseudo-respuestas conocidas en el paso actual. */
export async function fillPseudoAnswers(page: Page): Promise<number> {
  let filled = 0;
  if (await fillLocationLiniers(page)) filled++;
  await dismissModalOverlays(page);
  return filled;
}

export async function isNextDisabled(page: Page): Promise<boolean> {
  const root = easyApplyModalRoot(page);
  const scope = (await root.isVisible({ timeout: 500 }).catch(() => false)) ? root : page;
  const next = scope
    .locator(
      "button[data-easy-apply-next-button], button[data-live-test-easy-apply-next-button], button[aria-label*='Continue to next step'], button[aria-label*='Continue']"
    )
    .first();
  if (!(await next.isVisible({ timeout: 800 }).catch(() => false))) return false;
  const disabled = (await next.getAttribute("disabled").catch(() => null)) !== null;
  const aria = ((await next.getAttribute("aria-disabled")) ?? "").toLowerCase() === "true";
  return disabled || aria;
}
