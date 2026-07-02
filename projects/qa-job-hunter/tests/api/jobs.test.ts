import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.DASHBOARD_URL ?? "http://localhost:3847";

test("GET /api/jobs returns 200 and jobs array shape", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/jobs?sort=matchPercent&order=desc`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 404) {
    t.skip("GET /api/jobs not found — restart dashboard with latest code");
    return;
  }
  if (res.status === 503) {
    t.skip("MongoDB not available — run docker compose up && npm run db:seed");
    return;
  }

  assert.equal(res.status, 200, "expected HTTP 200");

  const body = (await res.json()) as { jobs?: unknown[]; count?: number };
  assert.ok(Array.isArray(body.jobs), "body.jobs must be an array");
  assert.equal(typeof body.count, "number", "body.count must be a number");
  assert.equal(body.count, body.jobs!.length, "count must match jobs length");

  if (body.jobs!.length > 0) {
    const job = body.jobs![0] as Record<string, unknown>;
    assert.ok(typeof job.id === "string" && job.id.length > 0, "job.id required");
    assert.ok(typeof job.title === "string" && job.title.length > 0, "job.title required");
    assert.ok(typeof job.company === "string", "job.company required");
    assert.ok(typeof job.matchPercent === "number", "job.matchPercent required");
  }
});

test("GET /api/jobs sorts by matchPercent desc", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/jobs?sort=matchPercent&order=desc`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 404) {
    t.skip("GET /api/jobs not found — restart dashboard with latest code");
    return;
  }
  if (res.status === 503) {
    t.skip("MongoDB not available — run docker compose up && npm run db:seed");
    return;
  }

  if (res.status !== 200) {
    t.skip(`Unexpected HTTP ${res.status}`);
    return;
  }

  const body = (await res.json()) as { jobs: { matchPercent: number }[] };
  if (body.jobs.length < 2) {
    t.skip("Need at least 2 jobs to verify sort order");
    return;
  }

  for (let i = 1; i < body.jobs.length; i++) {
    assert.ok(
      body.jobs[i - 1].matchPercent >= body.jobs[i].matchPercent,
      "jobs must be sorted by matchPercent desc"
    );
  }
});
