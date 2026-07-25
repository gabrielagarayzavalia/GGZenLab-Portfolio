/**
 * Sincroniza campos bloqueantes capturados (incl. "conocidos" por regex) al banco Config.
 * Política #154: no inventar answer; sí propagar options del wizard.
 */

import type { CapturedField } from "./fill-answers.js";
import { cleanCapturedOptionsForLabel } from "./field-options.js";
import { classifyWidget } from "./unknown-field-strategy.js";
import { cleanFieldLabel, type UnknownQuestionHit } from "./unknown-questions.js";
import {
  upsertUnansweredFromHits,
  type UpsertUnknownMeta,
} from "../config/questions-store.js";

function isEmptyCapturedValue(value: string): boolean {
  const v = (value || "").trim();
  if (!v) return true;
  return /selecciona una opci[oó]n|select an option|choose an option/i.test(v);
}

/** Campos vacíos / placeholder → hits para banco (con options si el inventario las trajo). */
export function hitsFromEmptyCapturedFields(fields: CapturedField[]): UnknownQuestionHit[] {
  const seen = new Set<string>();
  const hits: UnknownQuestionHit[] = [];

  for (const field of fields) {
    if (!isEmptyCapturedValue(field.value || "")) continue;

    const label = cleanFieldLabel(
      (field.label || field.ariaLabel || field.placeholder || "").replace(/\s+/g, " ").trim()
    );
    if (label.length < 3) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const options = field.options?.length
      ? cleanCapturedOptionsForLabel(label, field.options)
      : undefined;
    hits.push({
      label,
      kind: classifyWidget(field),
      required: !!field.required,
      value: (field.value || "").slice(0, 80),
      ...(options?.length ? { options } : {}),
    });
  }

  return hits;
}

export function syncEmptyCapturedFieldsToConfig(
  fields: CapturedField[],
  meta: UpsertUnknownMeta = {}
): void {
  const hits = hitsFromEmptyCapturedFields(fields);
  if (hits.length > 0) upsertUnansweredFromHits(hits, meta);
}
