/**
 * Discover Indeed AR → output/jobs-indeed-raw.json (B-31 / #194).
 *
 *   npm run discover:indeed
 *   INDEED_KEYWORDS="QA Automation" INDEED_LIMIT=10 npm run discover:indeed
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { indeedAdapter } from "../src/adapters/indeed-adapter.js";
import { isSourceEnabled } from "../src/config/sources-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "output");
const OUT_FILE = path.join(OUT_DIR, "jobs-indeed-raw.json");

async function main() {
  const force = (process.env.FORCE_SOURCE ?? "").trim() === "1";
  if (!force && !isSourceEnabled("indeed")) {
    console.error(
      "Indeed está desactivado en Config (Fuentes). Activá el toggle o usá FORCE_SOURCE=1."
    );
    process.exit(2);
  }
  const keywords = (process.env.INDEED_KEYWORDS ?? "QA Automation").trim();
  const limit = Number(process.env.INDEED_LIMIT ?? "15");
  console.log(`Indeed AR discover: q="${keywords}" limit=${limit}`);
  const jobs = await indeedAdapter.search({ keywords, region: "AR", limit });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    scrapedAt: new Date().toISOString(),
    source: "indeed",
    region: "AR",
    keywords,
    totalFound: jobs.length,
    jobs,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`✓ ${jobs.length} avisos → ${OUT_FILE}`);
  for (const j of jobs.slice(0, 5)) {
    console.log(`  · [${j.externalId}] ${j.title} @ ${j.company}`);
  }
  if (jobs.length > 5) console.log(`  … +${jobs.length - 5} más`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
