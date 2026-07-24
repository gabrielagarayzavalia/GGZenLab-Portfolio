/**
 * Banco Config → fill Easy Apply (#154 / #97).
 *   npx tsx --test tests/apply/fill-config-bank.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedField } from "../../src/apply/fill-answers.js";
import { evaluateUnknownFields } from "../../src/apply/unknown-field-strategy.js";
import { isKnownFieldLabel } from "../../src/apply/unknown-questions.js";
import {
  loadQuestionsConfig,
  matchConfigAnswer,
  patchQuestion,
  upsertUnansweredFromHits,
} from "../../src/config/questions-store.js";

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

test("matchConfigAnswer encuentra portugués answered", () => {
  upsertUnansweredFromHits(
    [
      {
        label: "¿Cuál es tu nivel de Portugués?",
        kind: "select",
        required: true,
        value: "",
      },
    ],
    { jobId: "job-pt" }
  );
  const store = loadQuestionsConfig();
  const q = store.questions.find((x) => /Portugu/i.test(x.label));
  assert.ok(q);
  patchQuestion(q!.id, { answer: "Básico / A2" });

  const hit = matchConfigAnswer("¿Cuál es tu nivel de Portugués? *");
  assert.ok(hit);
  assert.equal(hit!.answer, "Básico / A2");
  assert.equal(isKnownFieldLabel("¿Cuál es tu nivel de Portugués?"), true);

  const decision = evaluateUnknownFields([
    field({
      label: "¿Cuál es tu nivel de Portugués?",
      required: true,
      value: "Selecciona una opción",
    }),
  ]);
  assert.equal(decision.action, "continue");
  assert.equal(decision.pendingLabels.length, 0);

  patchQuestion(q!.id, { answer: "", status: "unanswered" });
});
