import test from "node:test";
import assert from "node:assert/strict";
import type { JobListing } from "../src/types.js";
<<<<<<< HEAD
import { analyzeJobRegex, cleanDescription } from "../src/regex-matcher.js";
import { FULLSTACK_4439380038_JD } from "./jd/fixtures/fullstack-4439380038.ts";
=======
import { analyzeJobRegex } from "../src/regex-matcher.js";
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a

const FOTON_DESCRIPTION = `
About the job

Foton. is hiring freelancers in LATAM and the US for an occasional gig testing streaming apps.

We need App Testers for manual testing of mobile and Smart TV applications on Whale OS, Zeasn, and Saphi platforms.

Requirements:
- English proficiency required
- Remote work
- Access to a Smart TV with Whale OS, Zeasn or Saphi installed
- Active Liberty Costa Rica subscription for testing geo-restricted content
- Previous QA or UX experience is a plus

Employment type: Contract · Entry level · Freelancers. Esporádic assignments (~1 hour video testing per session).
`.trim();

function fotonJob(): JobListing {
  return {
    id: "4443572921",
    title: "App Tester and Quality Control",
    company: "Foton.",
    location: "Costa Rica",
    modality: "Remote",
    datePosted: "4d",
    url: "https://www.linkedin.com/jobs/view/4443572921/",
    description: FOTON_DESCRIPTION,
    searchTerm: "qa",
  };
}

function goodAutomationJob(): JobListing {
  return {
    id: "9999999999",
    title: "Senior QA Automation Engineer",
    company: "TechCo",
    location: "Remote",
    modality: "Remote",
    datePosted: "1d",
    url: "https://www.linkedin.com/jobs/view/9999999999/",
    description: `
About the job

Remote Senior QA Automation Engineer. Required: Playwright, Selenium, API testing, CI/CD, agile.
5+ years automation experience. English fluent.
    `.trim(),
    searchTerm: "qa automation",
  };
}

test("Foton fixture baja de 100% y expone gaps de hardware/geo", () => {
  const result = analyzeJobRegex(fotonJob());

  assert.ok(result.matchPercent < 50, `esperado <50%, obtuvo ${result.matchPercent}%`);
  assert.ok(result.gaps.length > 0, "gaps no deberían estar vacíos");

  const gapText = result.gaps.join(" ").toLowerCase();
  const summaryText = result.summary.toLowerCase();
  const signals = ["hardware", "regional", "freelance", "entry", "gig", "junior"];
  const mentioned = signals.filter((s) => gapText.includes(s) || summaryText.includes(s));
  assert.ok(mentioned.length >= 2, `esperado >=2 señales en gaps/summary, obtuvo: ${mentioned.join(", ")}`);
});

test("job automation remote de control no se degrada fuerte", () => {
  const result = analyzeJobRegex(goodAutomationJob());

  assert.ok(result.matchPercent >= 65, `esperado >=65%, obtuvo ${result.matchPercent}%`);
  assert.ok(result.matchedSkills.some((s) => /automation|playwright|selenium/i.test(s)));
});

test("aviso con reqs extra no alcanza 100% y lista gaps legibles", () => {
  const job: JobListing = {
    id: "8888888888",
    title: "QA Engineer",
    company: "StartupX",
    location: "Remote",
    modality: "Remote",
    datePosted: "1d",
    url: "https://www.linkedin.com/jobs/view/8888888888/",
    description: `
About the job

Requirements:
- Playwright and Selenium automation required
- AWS cloud infrastructure experience mandatory
- Kubernetes and Docker expertise required
- ISTQB certification preferred
    `.trim(),
    searchTerm: "qa",
  };

  const result = analyzeJobRegex(job);

  assert.ok(result.matchPercent < 100, `esperado <100%, obtuvo ${result.matchPercent}%`);
  assert.ok(result.gaps.length > 0, "gaps no deberían estar vacíos");
  const gapText = result.gaps.join(" ").toLowerCase();
  assert.ok(
    gapText.includes("aws") || gapText.includes("kubernetes") || gapText.includes("docker") || gapText.includes("istqb"),
    `gaps deberían mencionar reqs faltantes, obtuvo: ${result.gaps.join("; ")}`
  );
});

test("100% solo cuando no quedan gaps de requisitos", () => {
  const result = analyzeJobRegex(goodAutomationJob());
  if (result.gaps.length > 0) {
    assert.ok(result.matchPercent < 100, "con gaps no debería ser 100%");
  }
});
<<<<<<< HEAD

test("cleanDescription — strips LinkedIn chrome from FullStack fixture (#369)", () => {
  const cleaned = cleanDescription(FULLSTACK_4439380038_JD);

  assert.doesNotMatch(cleaned, /people clicked apply/i);
  assert.doesNotMatch(cleaned, /\d+\s+days?\s+ago/i);
  assert.doesNotMatch(cleaned, /At FullStack we connect/i);
  assert.match(cleaned, /Manual QA/i);
  assert.match(cleaned, /Postman/i);
});
=======
>>>>>>> 485a67351a1c543d74c58d9ab3095bdfaa209e4a
