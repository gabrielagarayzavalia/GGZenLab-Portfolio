import test from "node:test";
import assert from "node:assert/strict";

import {
  hasParsedJdSections,
  isJdSectionHeader,
  parseJdSections,
  requirementsTextForMatch,
} from "../../src/jd/parse-sections.js";
import { FULLSTACK_4439380038_JD } from "./fixtures/fullstack-4439380038.js";

test("parseJdSections — fixture FullStack 4439380038", () => {
  const sections = parseJdSections(FULLSTACK_4439380038_JD);

  assert.ok(hasParsedJdSections(sections));
  assert.match(sections.preamble ?? "", /FullStack Manual QA Engineer/i);
  assert.match(sections.preamble ?? "", /81 people clicked apply/i);

  assert.equal(sections.requirements.length, 6);
  assert.ok(sections.requirements.some((b) => /4\+ years.*Manual QA/i.test(b)));
  assert.ok(sections.requirements.some((b) => /Advanced English/i.test(b)));
  assert.ok(sections.requirements.some((b) => /API testing.*Postman/i.test(b)));
  assert.ok(sections.requirements.some((b) => /\bSQL\b/i.test(b)));

  assert.equal(sections.niceToHave.length, 3);
  assert.ok(sections.niceToHave.some((b) => /Cursor|Claude Code/i.test(b)));

  assert.equal(sections.whatWeOffer.length, 4);
  assert.ok(sections.whatWeOffer.some((b) => /Competitive pay/i.test(b)));
  assert.ok(sections.whatWeOffer.some((b) => /100% remote/i.test(b)));
});

test("requirementsTextForMatch une bullets de requirements", () => {
  const sections = parseJdSections(FULLSTACK_4439380038_JD);
  const joined = requirementsTextForMatch(sections);
  assert.match(joined, /Manual QA/);
  assert.match(joined, /Postman/);
  assert.doesNotMatch(joined, /Competitive pay/);
});

test("parseJdSections — headers en español", () => {
  const text = `Intro empresa

Lo que buscamos
- 3+ años en QA manual
- Inglés avanzado

Deseable
- Playwright

Qué ofrecemos
- Salario competitivo`;

  const sections = parseJdSections(text);
  assert.deepEqual(sections.requirements, ["3+ años en QA manual", "Inglés avanzado"]);
  assert.deepEqual(sections.niceToHave, ["Playwright"]);
  assert.deepEqual(sections.whatWeOffer, ["Salario competitivo"]);
});

test("parseJdSections — variantes de headers EN", () => {
  const text = `Requirements:
• Selenium experience

Qualifications
• API testing

Must have
• SQL knowledge

Preferred
• Jira

Benefits
• Health insurance`;

  const sections = parseJdSections(text);
  assert.ok(sections.requirements.includes("Selenium experience"));
  assert.ok(sections.requirements.includes("API testing"));
  assert.ok(sections.requirements.includes("SQL knowledge"));
  assert.deepEqual(sections.niceToHave, ["Jira"]);
  assert.deepEqual(sections.whatWeOffer, ["Health insurance"]);
});

test("parseJdSections — sin headers devuelve preamble y arrays vacíos", () => {
  const text = "Solo un párrafo de descripción sin secciones.";
  const sections = parseJdSections(text);
  assert.equal(sections.requirements.length, 0);
  assert.equal(sections.niceToHave.length, 0);
  assert.equal(sections.whatWeOffer.length, 0);
  assert.equal(sections.preamble, text);
});

test("isJdSectionHeader reconoce headers conocidos", () => {
  assert.equal(isJdSectionHeader("What We're Looking For"), true);
  assert.equal(isJdSectionHeader("Nice to have:"), true);
  assert.equal(isJdSectionHeader("Qué ofrecemos"), true);
  assert.equal(isJdSectionHeader("Random bullet • SQL"), false);
});
