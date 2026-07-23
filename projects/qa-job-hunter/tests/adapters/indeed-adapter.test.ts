import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIndeedArSearchUrl,
  parseIndeedSearchHtml,
} from "../../src/adapters/indeed-adapter.js";

test("buildIndeedArSearchUrl AR", () => {
  const u = buildIndeedArSearchUrl("QA Analyst", 10);
  assert.match(u, /ar\.indeed\.com/);
  assert.match(u, /start=10/);
});

test("parseIndeedSearchHtml extrae jk + source", () => {
  const html = `<div data-jk="deadbeef0123"><h2>SDET</h2></div>`;
  const jobs = parseIndeedSearchHtml(html, { keywords: "SDET", limit: 3 });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, "indeed");
  assert.equal(jobs[0].externalId, "deadbeef0123");
  assert.equal(jobs[0].id, "indeed-deadbeef0123");
});
