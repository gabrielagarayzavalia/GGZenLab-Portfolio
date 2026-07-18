// Resuelve la cover letter para un aviso: por jobId, por empresa, o genérica.

import fs from "fs";
import path from "path";
import { COVER_DIR, COVER_BY_JOB_DIR } from "./paths.js";

export function resolveCoverLetter(jobId: string, company?: string): string {
  const byJob = path.join(COVER_BY_JOB_DIR, `${jobId}.txt`);
  if (fs.existsSync(byJob)) {
    return fs.readFileSync(byJob, "utf-8").trim();
  }

  const slug = (company ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug && fs.existsSync(COVER_DIR)) {
    for (const name of fs.readdirSync(COVER_DIR).filter((f) => f.startsWith(slug) && f.endsWith(".txt"))) {
      return fs.readFileSync(path.join(COVER_DIR, name), "utf-8").trim();
    }
  }

  const generic = path.join(COVER_DIR, "generic-qa-automation.txt");
  if (fs.existsSync(generic)) {
    return fs.readFileSync(generic, "utf-8").trim();
  }

  return (
    "Senior QA Analyst with 25+ years in quality assurance, test automation, API testing, and Agile delivery. " +
    "Based in Buenos Aires, available immediately."
  );
}
