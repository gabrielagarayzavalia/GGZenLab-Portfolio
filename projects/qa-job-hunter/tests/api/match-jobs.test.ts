import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.DASHBOARD_URL ?? "http://localhost:3847";

test("GET /api/dashboard/match-jobs returns 200 and envelope shape", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/dashboard/match-jobs`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 404) {
    t.skip("GET /api/dashboard/match-jobs not found — restart dashboard with latest code");
    return;
  }
  if (res.status === 503) {
    t.skip("MongoDB not available — run docker compose up -d && npm run tracker:seed");
    return;
  }

  assert.equal(res.status, 200, "expected HTTP 200");

  const body = (await res.json()) as {
    scrapedAt?: string;
    totalAnalyzed?: number;
    matchedJobs?: unknown[];
    jobs?: unknown[];
    feedback?: { rejectionCount?: number; rejectedJobIds?: unknown[]; rejections?: unknown[] };
    applicationStatus?: { updatedAt?: string; entries?: unknown[] };
    meta?: { source?: string };
  };

  assert.ok(typeof body.scrapedAt === "string");
  assert.ok(typeof body.totalAnalyzed === "number");
  assert.ok(Array.isArray(body.matchedJobs));
  assert.ok(Array.isArray(body.jobs));
  assert.equal(body.matchedJobs!.length, body.jobs!.length);
  assert.ok(body.feedback);
  assert.ok(Array.isArray(body.feedback!.rejections));
  assert.ok(body.applicationStatus);
  assert.ok(Array.isArray(body.applicationStatus!.entries));
  assert.equal(body.meta?.source, "mongo");
});

test("GET /api/dashboard/match-jobs rejects invalid filter", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/dashboard/match-jobs?filter=invalid`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 404) {
    t.skip("GET /api/dashboard/match-jobs not found — restart dashboard with latest code");
    return;
  }

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string; allowed?: string[] };
  assert.match(body.error ?? "", /inválido/i);
  assert.ok(body.allowed?.includes("applied"));
  assert.ok(body.allowed?.includes("closed"));
});

test("GET /api/dashboard/match-jobs accepts closed filter", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/dashboard/match-jobs?filter=closed`, {
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 404) {
    t.skip("GET /api/dashboard/match-jobs not found — restart dashboard with latest code");
    return;
  }
  if (res.status === 503) {
    t.skip("MongoDB not available — run docker compose up -d && npm run tracker:seed");
    return;
  }

  assert.equal(res.status, 200);
  const body = (await res.json()) as { meta?: { filter?: string }; matchedJobs?: { jobClosed?: boolean }[] };
  assert.equal(body.meta?.filter, "closed");
  for (const job of body.matchedJobs ?? []) {
    assert.equal(job.jobClosed, true);
  }
});

test("GET /api/results delegates to match-jobs with Deprecation header", async (t) => {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/results`, { signal: AbortSignal.timeout(15000) });
  } catch {
    t.skip("Dashboard not running at " + BASE);
    return;
  }

  if (res.status === 503) {
    t.skip("MongoDB not available — run docker compose up -d && npm run tracker:seed");
    return;
  }

  assert.equal(res.status, 200, "expected HTTP 200 from match-jobs shim");
  assert.equal(res.headers.get("Deprecation"), "true");
  assert.match(res.headers.get("Link") ?? "", /match-jobs/);

  const body = (await res.json()) as {
    scrapedAt?: string;
    totalAnalyzed?: number;
    matchedJobs?: unknown[];
    jobs?: unknown[];
    feedback?: { rejectionCount?: number; rejectedJobIds?: unknown[]; rejections?: unknown[] };
    applicationStatus?: { updatedAt?: string; entries?: unknown[] };
    meta?: { source?: string };
  };

  assert.ok(typeof body.scrapedAt === "string");
  assert.ok(typeof body.totalAnalyzed === "number");
  assert.ok(Array.isArray(body.matchedJobs));
  assert.ok(Array.isArray(body.jobs));
  assert.equal(body.matchedJobs!.length, body.jobs!.length);
  assert.ok(body.feedback);
  assert.ok(Array.isArray(body.feedback!.rejections));
  assert.ok(body.applicationStatus);
  assert.ok(Array.isArray(body.applicationStatus!.entries));
  assert.equal(body.meta?.source, "mongo");
});
