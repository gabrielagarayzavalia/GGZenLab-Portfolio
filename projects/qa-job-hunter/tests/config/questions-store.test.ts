/**
 * Banco Config preguntas (#154 / #97).
 *   npx tsx --test tests/config/questions-store.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  listQuestions,
  loadQuestionsConfig,
  patchQuestion,
  upsertUnansweredFromHits,
} from "../../src/config/questions-store.js";
import { evaluateUnknownFields } from "../../src/apply/unknown-field-strategy.js";
import type { CapturedField } from "../../src/apply/fill-answers.js";

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

test("upsert unanswered sin inventar answer + dedupe por label", () => {
  const touched = upsertUnansweredFromHits(
    [
      {
        label: "¿Cuál es tu nivel de Portugués?",
        kind: "select",
        required: true,
        value: "",
      },
    ],
    { jobId: "job-pt", company: "Acme", title: "QA" }
  );
  assert.equal(touched.length, 1);
  assert.equal(touched[0].answer, "");
  assert.equal(touched[0].status, "unanswered");

  const again = upsertUnansweredFromHits(
    [
      {
        label: "¿Cuál es tu nivel de Portugués?",
        kind: "select",
        required: true,
        value: "",
      },
    ],
    { jobId: "job-pt-2" }
  );
  assert.equal(again[0].seenCount >= 2, true);
  const unanswered = listQuestions({ status: "unanswered" }).filter((q) =>
    /Portugu/i.test(q.label)
  );
  assert.ok(unanswered.length >= 1);
});

test("evaluate portugues required → leave_pending + hits para banco", () => {
  const decision = evaluateUnknownFields([
    field({
      label: "¿Cuál es tu nivel de Portugués?",
      required: true,
      value: "Selecciona una opción",
      scenarioKind: "select",
    }),
  ]);
  assert.equal(decision.action, "leave_pending");
  assert.ok(decision.hits.some((h) => /Portugu/i.test(h.label)));
});

test("patch answer marca answered", () => {
  const store = loadQuestionsConfig();
  const q = store.questions.find((x) => /Portugu/i.test(x.label));
  assert.ok(q);
  patchQuestion(q!.id, { answer: "Básico / A2" });
  const updated = loadQuestionsConfig().questions.find((x) => x.id === q!.id);
  assert.equal(updated?.status, "answered");
  assert.equal(updated?.answer, "Básico / A2");
  // restore unanswered for local file cleanliness
  patchQuestion(q!.id, { answer: "", status: "unanswered" });
});
