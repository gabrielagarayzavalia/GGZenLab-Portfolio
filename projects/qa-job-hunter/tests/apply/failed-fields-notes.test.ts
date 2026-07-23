/**
 * B30 / tracker-sync: Notas deben listar nombres de campos que fallaron.
 *   npm run test:apply-notes
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanFieldLabel,
  formatFailedFieldsNotes,
  formatUnknownNotes,
} from "../../src/apply/unknown-questions.js";

test("formatFailedFieldsNotes lista todos los labels (no solo el primero)", () => {
  const notes = formatFailedFieldsNotes([
    "How many years of experience with SQL?",
    "Are you willing to relocate?",
    "How many years of experience with SQL?", // dup
  ]);
  assert.match(notes, /Campos que fallaron/);
  assert.match(notes, /SQL/);
  assert.match(notes, /relocate/i);
  const bullets = notes.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(bullets.length, 2);
});

test("formatFailedFieldsNotes vacío si no hay labels útiles", () => {
  assert.equal(formatFailedFieldsNotes(["", "  "]), "");
});

test("cleanFieldLabel recorta ruido Select an option", () => {
  const clean = cleanFieldLabel(
    "Years of experience with Python Select an option 1 2 3"
  );
  assert.match(clean, /Python/i);
  assert.doesNotMatch(clean, /Select an option/i);
});

test("formatUnknownNotes incluye labels de preguntas nuevas", () => {
  const notes = formatUnknownNotes(
    [
      { label: "Favorite IDE?", kind: "text", required: true, value: "" },
      { label: "Onsite OK?", kind: "select", required: false, value: "" },
    ],
    []
  );
  assert.match(notes, /Preguntas nuevas/);
  assert.match(notes, /Favorite IDE/);
  assert.match(notes, /Onsite OK/);
  assert.match(notes, /\[req\]/);
});
