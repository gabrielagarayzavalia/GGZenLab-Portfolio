/**
 * Exporta output/jobs-result.json desde applied-list (matched + scraped).
 * Puente para db:seed, Easy Apply legacy y fallback match-jobs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { OUTPUT_PATH } from "../apply/paths.js";
import { DASHBOARD_MIN_MATCH } from "./pipeline-match.js";
import { loadPipelineMatches, loadPipelineScrapedJobs } from "./pipeline-sync.js";
import { resolveAppliedListRoot } from "../campaign/applied-list.js";
import type { AnalysisResult, JobMatch } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildJobsResultFromPipeline(
  appliedListRoot = resolveAppliedListRoot()
): AnalysisResult {
  const matches = loadPipelineMatches(appliedListRoot);
  const scrapedByJobId = loadPipelineScrapedJobs(appliedListRoot);
  const scrapedAt =
    [...scrapedByJobId.values()]
      .map((s) => s.scrapedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString();

  const matchedJobs: JobMatch[] = [];
  const skippedJobs: AnalysisResult["skippedJobs"] = [];

  for (const match of matches) {
    const scraped = scrapedByJobId.get(match.jobId);
    const job: JobMatch = {
      id: match.jobId,
      title: match.title,
      company: match.company,
      location: scraped?.location ?? "—",
      modality: scraped?.modality ?? "—",
      datePosted: scraped?.datePosted ?? "—",
      url: match.url,
      description: scraped?.description ?? "",
      searchTerm: scraped?.scrapedTitle ?? match.title,
      source: "pipeline",
      matchPercent: match.matchPercent,
      matchedSkills: match.matchedSkills ?? [],
      gaps: match.gaps ?? [],
      cvSuggestions: match.cvSuggestions ?? [],
      summary: match.summary ?? "",
    };

    if (match.matchPercent >= DASHBOARD_MIN_MATCH) {
      matchedJobs.push(job);
    } else {
      skippedJobs.push({
        title: match.title,
        company: match.company,
        matchPercent: match.matchPercent,
      });
    }
  }

  matchedJobs.sort((a, b) => b.matchPercent - a.matchPercent);

  return {
    scrapedAt,
    totalFound: scrapedByJobId.size || matches.length,
    totalAnalyzed: matches.length,
    matchedJobs,
    skippedJobs,
  };
}

export function exportJobsResultFromPipeline(appliedListRoot = resolveAppliedListRoot()): string {
  const result = buildJobsResultFromPipeline(appliedListRoot);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");
  console.log(
    `📦 jobs-result.json: ${result.matchedJobs.length} match≥${DASHBOARD_MIN_MATCH}% → ${OUTPUT_PATH}`
  );
  return OUTPUT_PATH;
}

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  exportJobsResultFromPipeline();
}
