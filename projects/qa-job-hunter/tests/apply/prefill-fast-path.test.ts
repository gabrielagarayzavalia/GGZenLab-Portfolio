import assert from "node:assert/strict";
import test from "node:test";
import {
  looksLikeContactPrefillStep,
  shouldSkipHeavyFillForPrefill,
  type CapturedField,
} from "../../src/apply/fill-answers.js";

function field(
  partial: Partial<CapturedField> & Pick<CapturedField, "label" | "value">
): CapturedField {
  return {
    tag: "input",
    required: true,
    optional: false,
    ariaLabel: "",
    placeholder: "",
    errorText: "",
    scenarioKind: "text",
    ...partial,
  };
}

test("looksLikeContactPrefillStep: email/tel/código precargados", () => {
  const fields = [
    field({ label: "Email*", value: "gabrielagarayzavalia@gmail.com" }),
    field({ label: "Código del país*", value: "Argentina (+54)" }),
    field({ label: "Teléfono móvil*", value: "1126563646" }),
  ];
  assert.equal(looksLikeContactPrefillStep(fields), true);
  assert.equal(shouldSkipHeavyFillForPrefill(fields), true);
});

test("looksLikeContactPrefillStep: false si falta teléfono", () => {
  const fields = [
    field({ label: "Email*", value: "a@b.com" }),
    field({ label: "Código del país*", value: "Argentina (+54)" }),
    field({ label: "Teléfono móvil*", value: "" }),
  ];
  assert.equal(looksLikeContactPrefillStep(fields), false);
  assert.equal(shouldSkipHeavyFillForPrefill(fields), false);
});

test("shouldSkipHeavyFillForPrefill: no salta paso CV aunque required llenos", () => {
  const fields = [
    field({
      label: "Select resume CV_Gabriela_Garay_Zavalia_QA_Automation.pdf",
      value: "on",
      required: false,
      optional: true,
      scenarioKind: "radio",
    }),
  ];
  assert.equal(shouldSkipHeavyFillForPrefill(fields), false);
});
