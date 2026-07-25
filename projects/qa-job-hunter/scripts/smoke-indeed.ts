/**
 * Smoke Indeed adapter (#194 / #59).
 *
 *   npm run smoke:indeed
 *   SMOKE_INDEED_LIVE=1 npm run smoke:indeed   # fetch real AR
 */
import assert from "node:assert/strict";
import {
  buildIndeedArSearchUrl,
  parseIndeedSearchHtml,
  IndeedAdapter,
} from "../src/adapters/indeed-adapter.js";

const live = (process.env.SMOKE_INDEED_LIVE ?? "").trim() === "1";

console.log("Smoke Indeed adapter (B-31 / #59)\n");

{
  const url = buildIndeedArSearchUrl("QA Automation", 0);
  assert.match(url, /ar\.indeed\.com\/jobs/);
  assert.match(url, /QA/);
  console.log("  ✓ buildIndeedArSearchUrl");
}

{
  const html = `
    <div data-jk="abc123def456"><h2>QA Automation Engineer</h2>
    <span data-testid="company-name">Acme AR</span></div>
    <div data-jk="fff111aaa222"><a>Manual QA</a></div>
  `;
  const jobs = parseIndeedSearchHtml(html, { keywords: "QA", limit: 5 });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].source, "indeed");
  assert.equal(jobs[0].externalId, "abc123def456");
  assert.match(jobs[0].url, /jk=abc123def456/);
  console.log("  ✓ parseIndeedSearchHtml fixture");
}

if (live) {
  console.log("  … fetch live AR (SMOKE_INDEED_LIVE=1)");
  const adapter = new IndeedAdapter();
  const jobs = await adapter.search({ keywords: "QA", region: "AR", limit: 5 });
  assert.ok(jobs.length >= 1, "esperaba ≥1 resultado live");
  assert.equal(jobs[0].source, "indeed");
  console.log(`  ✓ live search: ${jobs.length} jobs (ej. ${jobs[0].title.slice(0, 40)})`);
} else {
  console.log("  · live skip (set SMOKE_INDEED_LIVE=1 para red)");
}

console.log("\nDoD smoke:indeed PASS");
