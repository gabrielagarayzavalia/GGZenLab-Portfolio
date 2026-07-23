/**
 * EA-SPIKE-04 / #156 — Strategy pattern para campos Easy Apply desconocidos.
 * Política de producto: #154. Nunca inventar respuestas.
 *
 * Ref: https://refactoring.guru/es/design-patterns/strategy
 */

import type { CapturedField } from "./fill-answers.js";
import {
  cleanFieldLabel,
  formatFailedFieldsNotes,
  isKnownFieldLabel,
} from "./unknown-questions.js";

const EMPTY_PLACEHOLDER_RE =
  /^(select|seleccion|choose|eleg[ií]|pick\b)/i;

/** Acciones que el runner puede tomar tras evaluar estrategias. */
export type UnknownFieldAction =
  | "continue"
  | "notes_only"
  | "leave_pending"
  | "defer"
  | "retry_typeahead";

export type UnknownFieldHandleResult = {
  action: UnknownFieldAction;
  /** Texto corto para Notas (sin inventar valores). */
  note?: string;
  fieldLabel: string;
  strategyId: string;
};

export type UnknownFieldStrategyContext = {
  /** Campo sin valor usable (vacío / placeholder Select). */
  empty: boolean;
};

/** Interfaz común Strategy (#156). */
export interface UnknownFieldStrategy {
  readonly id: string;
  handle(field: CapturedField, ctx: UnknownFieldStrategyContext): UnknownFieldHandleResult;
}

export type WidgetKind = "select" | "text" | "radio" | "checkbox" | "typeahead" | "other";

const FOLLOW_TOP_CHOICE_RE = /follow (the )?company|seguir (a la )?empresa|top choice|mark .+ top choice/i;

export function classifyWidget(field: CapturedField): WidgetKind {
  const label = `${field.label || ""} ${field.ariaLabel || ""}`.trim();
  const kind = (field.scenarioKind || field.tag || field.inputType || "").toLowerCase();

  if (kind === "checkbox" || FOLLOW_TOP_CHOICE_RE.test(label)) return "checkbox";
  if (
    kind === "combobox_or_text" ||
    kind === "combobox" ||
    /typeahead|combobox/i.test(kind) ||
    /location\s*\(city\)|ubicaci[oó]n\s*\(ciudad\)/i.test(label)
  ) {
    return "typeahead";
  }
  if (kind === "select" || kind === "select-one" || kind === "listbox") return "select";
  if (kind === "radio") return "radio";
  if (
    kind === "text" ||
    kind === "textarea" ||
    kind === "tel" ||
    kind === "email" ||
    kind === "url" ||
    kind === "number" ||
    field.tag === "textarea" ||
    field.inputType === "text"
  ) {
    return "text";
  }
  return "other";
}

function fieldDisplayLabel(field: CapturedField): string {
  return (
    cleanFieldLabel(field.label || field.ariaLabel || field.placeholder || "") ||
    "(campo sin label)"
  );
}

function isEmptyField(field: CapturedField): boolean {
  const v = (field.value || "").trim();
  if (!v) return true;
  if (EMPTY_PLACEHOLDER_RE.test(v)) return true;
  if (/selecciona una opci[oó]n|select an option|choose an option/i.test(v)) return true;
  return false;
}

/** Required desconocido → pendiente + Notas. */
export const requiredUnknownStrategy: UnknownFieldStrategy = {
  id: "required_unknown",
  handle(field, ctx) {
    const fieldLabel = fieldDisplayLabel(field);
    const kind = classifyWidget(field);
    if (!ctx.empty) {
      return { action: "notes_only", fieldLabel, strategyId: this.id, note: `- ${fieldLabel} [${kind}]` };
    }
    return {
      action: "leave_pending",
      fieldLabel,
      strategyId: this.id,
      note: `- ${fieldLabel} [${kind}/req]`,
    };
  },
};

/** Optional desconocido → solo Notas, seguir. */
export const optionalUnknownStrategy: UnknownFieldStrategy = {
  id: "optional_unknown",
  handle(field, _ctx) {
    const fieldLabel = fieldDisplayLabel(field);
    const kind = classifyWidget(field);
    return {
      action: "notes_only",
      fieldLabel,
      strategyId: this.id,
      note: `- ${fieldLabel} [${kind}/opc]`,
    };
  },
};

/** Checkbox Follow / top choice → no tocar (#142 / EA-SPIKE-01/02). */
export const checkboxDeferStrategy: UnknownFieldStrategy = {
  id: "checkbox_defer",
  handle(field) {
    return {
      action: "defer",
      fieldLabel: fieldDisplayLabel(field),
      strategyId: this.id,
    };
  },
};

/** Typeahead → reintentos en runner; si ya está vacío/req, señal de retry. */
export const typeaheadRetryStrategy: UnknownFieldStrategy = {
  id: "typeahead_retry",
  handle(field, ctx) {
    const fieldLabel = fieldDisplayLabel(field);
    if (field.required && ctx.empty) {
      return {
        action: "retry_typeahead",
        fieldLabel,
        strategyId: this.id,
        note: `- ${fieldLabel} [typeahead/req]`,
      };
    }
    return { action: "continue", fieldLabel, strategyId: this.id };
  },
};

/**
 * Resuelve estrategia por widget + required (#154 / #156).
 * El contexto del runner usa esto en lugar de if/else por tipo.
 */
export function resolveUnknownFieldStrategy(field: CapturedField): UnknownFieldStrategy {
  const widget = classifyWidget(field);
  if (widget === "checkbox") return checkboxDeferStrategy;
  if (widget === "typeahead") return typeaheadRetryStrategy;
  if (field.required) return requiredUnknownStrategy;
  return optionalUnknownStrategy;
}

/** Contexto Strategy: delega en la estrategia activa; permite setStrategy. */
export class UnknownFieldContext {
  private strategy: UnknownFieldStrategy;

  constructor(strategy: UnknownFieldStrategy = optionalUnknownStrategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy: UnknownFieldStrategy): void {
    this.strategy = strategy;
  }

  getStrategy(): UnknownFieldStrategy {
    return this.strategy;
  }

  /** Equivalente a Navigator.routeStrategy.buildRoute — acá handle(field). */
  handle(field: CapturedField, ctx?: Partial<UnknownFieldStrategyContext>): UnknownFieldHandleResult {
    const empty = ctx?.empty ?? isEmptyField(field);
    return this.strategy.handle(field, { empty });
  }

  /** Resolve + handle en un paso. */
  resolveAndHandle(field: CapturedField): UnknownFieldHandleResult {
    this.setStrategy(resolveUnknownFieldStrategy(field));
    return this.handle(field);
  }
}

export type UnknownFieldsDecision = {
  action: "continue" | "leave_pending";
  /** Labels que disparan pendiente (required unknown vacíos). */
  pendingLabels: string[];
  /** Notas agregadas (optional + pending). */
  notes: string;
  /** Resultados crudos (tests / debug). */
  results: UnknownFieldHandleResult[];
  /** Hay typeahead req vacío → runner puede intentar recover. */
  typeaheadRetry: boolean;
};

/**
 * Evalúa inventario del paso con Strategy (#156).
 * - Required desconocido vacío → leave_pending (no quemar 8 pasos).
 * - Optional desconocido → notes_only.
 * - Checkbox Follow/top choice → defer.
 * - Typeahead req vacío → retry_typeahead (no corta aún).
 */
export function evaluateUnknownFields(fields: CapturedField[]): UnknownFieldsDecision {
  const ctx = new UnknownFieldContext();
  const results: UnknownFieldHandleResult[] = [];
  const pendingLabels: string[] = [];
  const noteLines: string[] = [];
  let typeaheadRetry = false;

  for (const field of fields) {
    const label = fieldDisplayLabel(field);
    if (!label || label === "(campo sin label)") continue;
    if (isKnownFieldLabel(label)) continue;
    // Ya respondido con valor usable → no aplicar leave_pending
    const empty = isEmptyField(field);
    if (!empty && !field.required) {
      // optional con valor: igual registrar como pregunta vista
      const r = optionalUnknownStrategy.handle(field, { empty: false });
      results.push(r);
      if (r.note) noteLines.push(r.note);
      continue;
    }
    if (!empty && field.required) {
      // required ya lleno (aunque desconocido) → solo nota, no cortar
      const r = requiredUnknownStrategy.handle(field, { empty: false });
      results.push(r);
      if (r.note) noteLines.push(r.note);
      continue;
    }

    const result = ctx.resolveAndHandle(field);
    results.push(result);

    if (result.action === "defer" || result.action === "continue") continue;
    if (result.action === "retry_typeahead") {
      typeaheadRetry = true;
      if (result.note) noteLines.push(result.note);
      continue;
    }
    if (result.action === "leave_pending") {
      pendingLabels.push(result.fieldLabel);
      if (result.note) noteLines.push(result.note);
      continue;
    }
    if (result.action === "notes_only" && result.note) {
      noteLines.push(result.note);
    }
  }

  const uniquePending = [...new Set(pendingLabels)];
  const header =
    uniquePending.length > 0
      ? "Campos que fallaron / faltaron completar:"
      : "Preguntas nuevas (definir respuesta):";
  const notesBody =
    uniquePending.length > 0
      ? formatFailedFieldsNotes(uniquePending, header)
      : noteLines.length > 0
        ? [header, ...noteLines].join("\n")
        : "";

  return {
    action: uniquePending.length > 0 ? "leave_pending" : "continue",
    pendingLabels: uniquePending,
    notes: notesBody.slice(0, 1800),
    results,
    typeaheadRetry,
  };
}
