import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  loadAppliedListKnownJobIds,
  mergeJobsIntoAppliedList,
} from "../../scripts/notifications-applied-list.ts";

test("mergeJobsIntoAppliedList dedupe por jobId y marca sourceFile", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jh-notif-merge-"));
  const dataDir = path.join(root, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, "jobs.json"),
    JSON.stringify([
      {
        jobId: "111",
        company: "Acme",
        title: "QA Engineer",
        url: "https://www.linkedin.com/jobs/view/111",
      },
    ]),
    "utf-8"
  );

  const known = loadAppliedListKnownJobIds(root);
  assert.equal(known.has("111"), true);

  const result = mergeJobsIntoAppliedList(
    [
      {
        jobId: "111",
        company: "Acme",
        title: "QA Engineer",
        url: "https://www.linkedin.com/jobs/view/111",
      },
      {
        jobId: "222",
        company: "Beta",
        title: "QA Automation",
        url: "https://www.linkedin.com/jobs/view/222",
      },
    ],
    root
  );

  assert.equal(result.added, 1);
  assert.equal(result.total, 2);

  const merged = JSON.parse(fs.readFileSync(result.jobsPath, "utf-8")) as Array<{
    jobId: string;
    sourceFile?: string;
  }>;
  const fresh = merged.find((j) => j.jobId === "222");
  assert.equal(fresh?.sourceFile, "notifications-discovery");
});
