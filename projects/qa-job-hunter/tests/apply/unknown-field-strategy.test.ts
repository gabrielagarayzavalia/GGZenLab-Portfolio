/**
 * #156 / EA-SPIKE-04 — selección de Strategy por widget + required.
 *   npm run test:unknown-strategy
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedField } from "../../src/apply/fill-answers.js";
import {
  UnknownFieldContext,
  classifyWidget,
  evaluateUnknownFields,
  resolveUnknownFieldStrategy,
} from "../../src/apply/unknown-field-strategy.js";

function field(partial: Partial<CapturedField> & { label: string }): CapturedField {
  return {
    tag: "select",
    inputType: "select",
    name: "",
    id: "",
    required: false,
    value: "",
    ariaLabel: "",
    placeholder: "",
    errorText: "",
    scenarioKind: "select",
    ...partial,
  };
}

test("resolve: select required vacío → required_unknown", () => {
  const f = field({
    label: "¿Cuál es tu nivel de Portugués?",
    required: true,
    value: "Selecciona una opción",
    scenarioKind: "select",
  });
  assert.equal(resolveUnknownFieldStrategy(f).id, "required_unknown");
  assert.equal(classifyWidget(f), "select");
});

test("resolve: text optional → optional_unknown", () => {
  const f = field({
    label: "Anything else we should know?",
    required: false,
    optional: true,
    tag: "textarea",
    scenarioKind: "textarea",
    value: "",
  });
  assert.equal(resolveUnknownFieldStrategy(f).id, "optional_unknown");
});

test("resolve: Follow / top choice → checkbox_defer", () => {
  const f = field({
    label: "Mark job as a top choice",
    required: false,
    scenarioKind: "checkbox",
    tag: "input",
    inputType: "checkbox",
    value: "on",
  });
  assert.equal(resolveUnknownFieldStrategy(f).id, "checkbox_defer");
});

test("resolve: Location (city) typeahead req → typeahead_retry", () => {
  const f = field({
    label: "Location (city)",
    required: true,
    scenarioKind: "combobox_or_text",
    tag: "input",
    inputType: "text",
    value: "",
  });
  assert.equal(resolveUnknownFieldStrategy(f).id, "typeahead_retry");
});

test("evaluate: required desconocido vacío → leave_pending + Notas con label", () => {
  const decision = evaluateUnknownFields([
    field({
      label: "¿Cuál es tu nivel de Portugués?",
      required: true,
      value: "Selecciona una opción",
      scenarioKind: "select",
    }),
    field({
      label: "Email",
      required: true,
      value: "a@b.com",
      scenarioKind: "select",
    }),
  ]);
  assert.equal(decision.action, "leave_pending");
  assert.ok(decision.pendingLabels.some((l) => /Portugu/i.test(l)));
  assert.match(decision.notes, /Portugu/i);
  assert.doesNotMatch(decision.notes, /Email/);
});

test("evaluate: optional desconocido → continue + notes_only", () => {
  const decision = evaluateUnknownFields([
    field({
      label: "Favorite IDE?",
      required: false,
      optional: true,
      value: "",
      scenarioKind: "text",
      tag: "input",
      inputType: "text",
    }),
  ]);
  assert.equal(decision.action, "continue");
  assert.match(decision.notes, /Favorite IDE/i);
});

test("evaluate: checkbox defer no deja pendiente", () => {
  const decision = evaluateUnknownFields([
    field({
      label: "Follow company",
      required: false,
      scenarioKind: "checkbox",
      value: "",
    }),
  ]);
  assert.equal(decision.action, "continue");
  assert.equal(decision.pendingLabels.length, 0);
});

test("UnknownFieldContext setStrategy / resolveAndHandle", () => {
  const ctx = new UnknownFieldContext();
  const f = field({
    label: "Custom question required",
    required: true,
    value: "",
    scenarioKind: "text",
    tag: "input",
    inputType: "text",
  });
  const r = ctx.resolveAndHandle(f);
  assert.equal(r.strategyId, "required_unknown");
  assert.equal(r.action, "leave_pending");
  assert.equal(ctx.getStrategy().id, "required_unknown");
});
