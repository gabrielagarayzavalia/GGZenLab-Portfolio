/**
 * Captura de opciones de campos EA para banco Config (#97 / #154).
 * Sin abrir el wizard a mano: lee <select>, radios del bloque y texto visible.
 */

import type { Locator, Page } from "playwright";

export const EMPTY_OPTION_RE =
  /^(select an option|seleccion(a|á)|choose|eleg[ií]|pick\b|selecciona una opci)/i;
const NOISE_OPTION_RE = /^(required|yes no)$/i;

function normalizeOptionKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Filtra eco del label y ruido LinkedIn antes de guardar en Config. */
export function cleanCapturedOptionsForLabel(label: string, raw: string[]): string[] {
  const l = normalizeOptionKey(label);
  return cleanCapturedOptions(raw).filter((o) => {
    const n = normalizeOptionKey(o);
    if (NOISE_OPTION_RE.test(n)) return false;
    if (l && n === l) return false;
    if (l && n.length > 80) return false;
    if (l && l.includes(n) && n.length >= Math.min(24, l.length * 0.55)) return false;
    if (l && n.includes(l) && l.length >= Math.min(24, n.length * 0.55)) return false;
    return true;
  });
}

export function cleanCapturedOptions(raw: string[]): string[] {
  return [...new Set(raw.map((o) => o.replace(/\s+/g, " ").trim()).filter(Boolean))]
    .filter((o) => o.length >= 1 && o.length <= 120 && !EMPTY_OPTION_RE.test(o))
    .slice(0, 40);
}

/**
 * LinkedIn a veces concatena label + "Select an option" + opciones en el mismo texto.
 */
export function extractOptionsFromLabelBlob(blob: string): string[] {
  const raw = (blob || "").trim();
  if (!raw) return [];

  const out: string[] = [];

  for (const line of raw.split(/\n+/)) {
    const ln = line.replace(/^[\s•\-*]+/, "").trim();
    if (ln.length >= 2 && ln.length <= 80 && !EMPTY_OPTION_RE.test(ln)) out.push(ln);
  }

  const t = raw.replace(/\s+/g, " ").trim();
  const afterPlaceholder = t.split(
    /\b(?:Select an option|Choose an option|Seleccionar|Seleccione una opci[oó]n)\b/i
  );
  if (afterPlaceholder.length > 1) {
    const tail = afterPlaceholder.slice(1).join(" ").trim();
    if (tail) {
      // "Professional Native or bilingual" → split antes de mayúsculas mid-phrase es frágil;
      // primero por separadores comunes de UI.
      const chunks = tail.split(/\s{2,}|\s*\|\s*|\s*·\s*|\s*\/\s*/);
      for (const c of chunks) {
        const piece = c.trim();
        if (piece.length >= 2) out.push(piece);
      }
      if (out.length === 0 && tail.length <= 80) out.push(tail);
    }
  }

  return cleanCapturedOptions(out);
}

function formBlock(el: Locator): Locator {
  return el.locator(
    "xpath=ancestor::*[contains(@class,'form-element') or contains(@class,'form-section') or self::fieldset or self::li][1]"
  );
}

async function readSelectOptions(select: Locator): Promise<string[]> {
  const opts: string[] = [];
  const oc = await select.locator("option").count().catch(() => 0);
  for (let o = 0; o < oc; o++) {
    const text = ((await select.locator("option").nth(o).innerText().catch(() => "")) ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) opts.push(text);
  }
  return opts;
}

async function readRadioOptions(block: Locator): Promise<string[]> {
  const opts: string[] = [];
  const radios = block.locator("input[type='radio']");
  const rc = await radios.count().catch(() => 0);
  for (let r = 0; r < rc; r++) {
    const radio = radios.nth(r);
    const aria = ((await radio.getAttribute("aria-label")) ?? "").trim();
    if (aria && !EMPTY_OPTION_RE.test(aria)) {
      opts.push(aria);
      continue;
    }
    const id = (await radio.getAttribute("id").catch(() => "")) ?? "";
    let lab = "";
    if (id) {
      lab = ((await block.locator(`label[for="${id}"]`).first().innerText().catch(() => "")) ?? "")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!lab) {
      lab = ((await radio
        .evaluate((node) => {
          const wrap = node.closest("label") ?? node.parentElement;
          return (wrap?.textContent ?? "").trim();
        })
        .catch(() => "")) ?? "")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (lab && lab.length <= 80) opts.push(lab);
  }
  return opts;
}

/** Opciones visibles en listbox del mismo bloque (si el dropdown ya está abierto). */
async function readOpenListboxOptions(block: Locator): Promise<string[]> {
  const opts: string[] = [];
  const options = block.locator("[role='listbox'] [role='option'], [role='option']");
  const n = await options.count().catch(() => 0);
  for (let i = 0; i < Math.min(n, 40); i++) {
    const text = ((await options.nth(i).innerText().catch(() => "")) ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && !EMPTY_OPTION_RE.test(text)) opts.push(text);
  }
  return opts;
}

/**
 * Captura opciones sin interacción pesada (no abre combobox salvo lectura pasiva).
 */
export async function captureFieldOptions(
  _page: Page,
  el: Locator,
  tag: string,
  inputType: string,
  label: string
): Promise<string[]> {
  const merged: string[] = [];
  merged.push(...extractOptionsFromLabelBlob(label));

  if (tag === "select") {
    merged.push(...(await readSelectOptions(el)));
  }

  const block = formBlock(el);
  if ((await block.count().catch(() => 0)) > 0) {
    const wrapText = ((await block.first().innerText().catch(() => "")) ?? "").slice(0, 2000);
    merged.push(...extractOptionsFromLabelBlob(wrapText));

    const selects = block.locator("select");
    const sc = await selects.count().catch(() => 0);
    for (let s = 0; s < sc; s++) {
      merged.push(...(await readSelectOptions(selects.nth(s))));
    }

    merged.push(...(await readRadioOptions(block.first())));
    merged.push(...(await readOpenListboxOptions(block.first())));
  }

  if (inputType === "radio") {
    const fieldset = el.locator("xpath=ancestor::fieldset[1]");
    if ((await fieldset.count().catch(() => 0)) > 0) {
      merged.push(...(await readRadioOptions(fieldset.first())));
    }
  }

  return cleanCapturedOptions(merged);
}
