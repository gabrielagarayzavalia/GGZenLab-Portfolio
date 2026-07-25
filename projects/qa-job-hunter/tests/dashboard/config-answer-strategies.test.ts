/**
 * Strategy UI Config Preguntas.
 *   npx tsx --test tests/dashboard/config-answer-strategies.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveAnswerStrategy } from "../../dashboard/config-answer-strategies.js";

test("portugués select sin options → dropdown idioma", () => {
  const s = resolveAnswerStrategy({
    label: "¿Cuál es tu nivel de Portugués?",
    kind: "select",
    options: [],
  });
  assert.equal(s.id, "select");
  assert.match(s.hint || "", /idioma/i);
});

test("select con una opción capturada → dropdown", () => {
  const s = resolveAnswerStrategy({
    label: "D365 experience",
    kind: "select",
    options: ["No experience"],
  });
  assert.equal(s.id, "select");
  assert.match(s.hint, /Capturadas en apply/i);
});

test("select con varias opciones capturadas → dropdown", () => {
  const s = resolveAnswerStrategy({
    label: "Years of SQL",
    kind: "select",
    options: ["1-2", "3-5", "10+"],
  });
  assert.equal(s.id, "select");
  assert.match(s.hint, /Capturadas en apply/i);
});

test("select kind sin options en DOM → texto libre", () => {
  const s = resolveAnswerStrategy({
    label: "Custom dropdown",
    kind: "select",
    options: [],
  });
  assert.equal(s.id, "text");
  assert.match(s.hint, /sin opciones en DOM/i);
});

test("text kind → texto libre", () => {
  const s = resolveAnswerStrategy({ label: "LinkedIn URL", kind: "text", options: [] });
  assert.equal(s.id, "text");
});

test("yes/no options → select", () => {
  const s = resolveAnswerStrategy({
    label: "Do you know Python?",
    kind: "select",
    options: ["Yes", "No"],
  });
  assert.equal(s.id, "select");
});
