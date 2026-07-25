import fs from "fs";
import path from "path";
import { resolveAppliedListRoot } from "../src/campaign/applied-list.js";

export interface AppliedListJob {
  jobId: string;
  company: string;
  title: string;
  url: string;
  gmailId?: string;
  sourceFile?: string;
}

export function resolveAppliedListDataDir(root?: string): string {
  const appliedRoot = root ?? resolveAppliedListRoot();
  return path.join(appliedRoot, "data");
}

/** jobIds y URLs normalizadas ya presentes en applied-list. */
export function loadAppliedListKnownJobIds(root?: string): Set<string> {
  const dataDir = resolveAppliedListDataDir(root);
  const known = new Set<string>();

  for (const file of ["jobs.json", "jobs_draft.json", "applications.json"]) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) continue;
    const rows = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Array<{
      jobId?: string;
      url?: string;
    }>;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row.jobId) known.add(String(row.jobId));
      if (row.url) known.add(row.url.replace(/\?.*$/, "").replace(/\/$/, ""));
    }
  }

  return known;
}

export function mergeJobsIntoAppliedList(
  jobs: AppliedListJob[],
  root?: string
): { added: number; total: number; jobsPath: string } {
  const dataDir = resolveAppliedListDataDir(root);
  fs.mkdirSync(dataDir, { recursive: true });

  const jobsPath = path.join(dataDir, "jobs.json");
  const draftPath = path.join(dataDir, "jobs_draft.json");
  const existing: AppliedListJob[] = fs.existsSync(jobsPath)
    ? JSON.parse(fs.readFileSync(jobsPath, "utf-8"))
    : [];

  const byId = new Map(existing.map((job) => [job.jobId, job]));
  let added = 0;
  for (const job of jobs) {
    if (byId.has(job.jobId)) continue;
    byId.set(job.jobId, {
      ...job,
      sourceFile: job.sourceFile ?? "notifications-discovery",
    });
    added++;
  }

  const merged = [...byId.values()];
  const payload = JSON.stringify(merged, null, 2);
  fs.writeFileSync(jobsPath, payload, "utf-8");
  fs.writeFileSync(draftPath, payload, "utf-8");

  return { added, total: merged.length, jobsPath };
}
