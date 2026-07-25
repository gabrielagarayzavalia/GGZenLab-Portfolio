/**
 * Strategy UI Config Preguntas.
 *   npx tsx --test tests/dashboard/config-answer-strategies.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  actionableOptions,
  resolveAnswerStrategy,
} from "../../dashboard/config-answer-strategies.js";

test("portugués select sin options → dropdown idioma", () => {
  const s = resolveAnswerStrategy({
    label: "¿Cuál es tu nivel de Portugués?",
    kind: "select",
    options: [],
  });
  assert.equal(s.id, "select");
  assert.match(s.hint || "", /idioma/i);
});

test("años experiencia → select con opción - y 0", () => {
  const label = "How many years of work experience do you have with Microsoft Dynamics 365?";
  const s = resolveAnswerStrategy({
    label,
    kind: "text",
    options: [label],
  });
  assert.equal(s.id, "years-select");
  assert.match(s.hint || "", /-/);
});

test("select Yes/No capturado → dropdown", () => {
  const s = resolveAnswerStrategy({
    label: "Hands-on Playwright and Selenium",
    kind: "select",
    options: ["Yes", "No", "Required"],
  });
  assert.equal(s.id, "select");
  assert.equal(s.capturedOptionsHint, "");
});

test("select con opciones reales no Yes/No → dropdown", () => {
  const s = resolveAnswerStrategy({
    label: "Years of SQL",
    kind: "select",
    options: ["1-2", "3-5", "10+"],
  });
  assert.equal(s.id, "select");
});

test("select kind sin options en DOM → texto libre", () => {
  const s = resolveAnswerStrategy({
    label: "Custom dropdown",
    kind: "select",
    options: [],
  });
  assert.equal(s.id, "text");
  assert.match(s.hint, /sin opciones/i);
});

test("text kind → texto libre", () => {
  const s = resolveAnswerStrategy({ label: "LinkedIn URL", kind: "text", options: [] });
  assert.equal(s.id, "text");
});

test("actionableOptions filtra label eco", () => {
  const label = "How many years of work experience do you have with Playwriting?";
  const opts = actionableOptions(label, [label, "Required"]);
  assert.equal(opts.length, 0);
});

test("opciones capturadas → hint debajo, no en el input", () => {
  const s = resolveAnswerStrategy({
    label: "Describe other tools you use",
    kind: "text",
    options: ["Jira", "Confluence", "Describe other tools you use"],
  });
  assert.equal(s.id, "text");
  assert.match(s.capturedOptionsHint || "", /Opciones vistas en apply/i);
  assert.match(s.capturedOptionsHint || "", /Jira/);
});
