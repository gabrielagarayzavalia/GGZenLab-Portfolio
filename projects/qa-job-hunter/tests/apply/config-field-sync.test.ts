/**
 *   npm run test:config-field-sync
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CapturedField } from "../../src/apply/fill-answers.js";
import { hitsFromEmptyCapturedFields } from "../../src/apply/config-field-sync.js";
import {
  loadQuestionsConfig,
  upsertUnansweredFromHits,
} from "../../src/config/questions-store.js";

function field(partial: Partial<CapturedField> & { label: string }): CapturedField {
  return {
    tag: "select",
    inputType: "select",
    name: "",
    id: "",
    required: true,
    value: "",
    ariaLabel: "",
    placeholder: "",
    errorText: "",
    scenarioKind: "select",
    ...partial,
  };
}

test("hitsFromEmptyCapturedFields: solo vacíos, con options", () => {
  const hits = hitsFromEmptyCapturedFields([
    field({
      label: "How many years of work experience do you have with Microsoft Dynamics 365?",
      value: "",
      scenarioKind: "text",
      tag: "input",
      inputType: "text",
      options: ["How many years of work experience do you have with Microsoft Dynamics 365?"],
    }),
    field({
      label: "How many years of work experience do you have with Selenium?",
      value: "10",
      scenarioKind: "text",
      tag: "input",
      inputType: "text",
    }),
    field({
      label: "Hands-on experience with automated testing tools such as Playwright and Selenium",
      value: "Select an option",
      options: ["Yes", "No", "Required"],
    }),
  ]);

  assert.equal(hits.length, 2);
  assert.ok(hits.some((h) => /Dynamics 365/.test(h.label) && !/D365 applications/.test(h.label)));
  assert.ok(hits.some((h) => /Playwright and Selenium/.test(h.label) && h.options?.includes("Yes")));
  assert.ok(!hits.some((h) => /^How many years of work experience do you have with Selenium/.test(h.label)));
});

test("sync vía upsert: merge options en pregunta conocida vacía", () => {
  upsertUnansweredFromHits(
    [
      {
        label: "Experience working with Microsoft Dynamics 365 (D365) applications and understanding of its customization and workflows.",
        kind: "select",
        required: true,
        value: "",
        options: [],
      },
    ],
    { jobId: "sync-test" }
  );

  const hits = hitsFromEmptyCapturedFields([
    field({
      label:
        "Experience working with Microsoft Dynamics 365 (D365) applications and understanding of its customization and workflows.",
      value: "Select an option",
      options: ["Yes", "No", "Required", "Yes No"],
    }),
  ]);

  upsertUnansweredFromHits(hits, { jobId: "sync-test" });
  const store = loadQuestionsConfig();
  const q = store.questions.find((x) => /Dynamics 365 \(D365\)/.test(x.label));
  assert.ok(q);
  assert.ok(q!.options.includes("Yes"));
  assert.ok(q!.options.includes("No"));
});
