// ============================================================
//  3-analyze-match.ts — Análisis de match con Claude API u Ollama local
//  Comando: npx tsx src/3-analyze-match.ts
//  Local:   $env:LLM_PROVIDER='ollama' ; npx tsx src/3-analyze-match.ts
// ============================================================

import fs from "fs";
import { OUTPUT_PATH } from "./config.js";
import { chat, getLLMProvider, getProviderLabel, isOllamaAvailable } from "./llm-client.js";
import { buildMatchPrompt, exportCSV, MIN_MATCH, parseMatchResponse } from "./match-utils.js";
import type { JobListing, JobMatch, AnalysisResult } from "./types.js";

async function analyzeJobs(): Promise<void> {
  const provider = getLLMProvider();

  if (provider === "ollama") {
    const available = await isOllamaAvailable();
    if (!available) {
      console.error("\n❌ Ollama no está corriendo en localhost:11434");
      console.log("   1. Instalá Ollama: https://ollama.com");
      console.log("   2. Descargá el modelo: ollama pull qwen2.5:1.5b");
      console.log("   3. Verificá: ollama list\n");
      process.exit(1);
    }
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\n❌ Falta ANTHROPIC_API_KEY para el modo Claude API.");
    console.log("   Usá análisis local: $env:LLM_PROVIDER='ollama' ; npx tsx src\\3-analyze-match.ts\n");
    process.exit(1);
  }

  const rawPath = OUTPUT_PATH.replace(".json", "-raw.json");

  if (!fs.existsSync(rawPath)) {
    console.error("❌ No se encontraron empleos scrapeados.");
    console.log("   Ejecuta primero: npx tsx src/2-scrape-jobs.ts\n");
    process.exit(1);
  }

  const jobs: JobListing[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
  console.log(`\n🧠 Analizando ${jobs.length} empleos con ${getProviderLabel()}...\n`);

  const matchedJobs: JobMatch[] = [];
  const skippedJobs: AnalysisResult["skippedJobs"] = [];
  const delayMs = provider === "ollama" ? 200 : 500;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    process.stdout.write(`   [${i + 1}/${jobs.length}] ${job.title} @ ${job.company} → `);

    try {
      const text = await chat(buildMatchPrompt(job));
      const analysis = parseMatchResponse(text);

      if (analysis.matchPercent >= MIN_MATCH) {
        matchedJobs.push({ ...job, ...analysis });
        console.log(`✅ ${analysis.matchPercent}% MATCH`);
      } else {
        skippedJobs.push({
          title: job.title,
          company: job.company,
          matchPercent: analysis.matchPercent,
        });
        console.log(`⏭️  ${analysis.matchPercent}% (bajo umbral)`);
      }

      await new Promise((r) => setTimeout(r, delayMs));
    } catch (err) {
      console.log(`❌ Error`);
      console.error(err);
    }
  }

  matchedJobs.sort((a, b) => b.matchPercent - a.matchPercent);

  const result: AnalysisResult = {
    scrapedAt: new Date().toISOString(),
    totalFound: jobs.length,
    totalAnalyzed: jobs.length,
    matchedJobs,
    skippedJobs,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");
  exportCSV(matchedJobs);

  console.log("\n" + "═".repeat(60));
  console.log(`🎯 ANÁLISIS COMPLETADO (${getProviderLabel()})`);
  console.log(`   Total analizados : ${jobs.length}`);
  console.log(`   Con 70%+ de match: ${matchedJobs.length}`);
  console.log(`   Descartados      : ${skippedJobs.length}`);
  console.log("═".repeat(60));

  if (matchedJobs.length > 0) {
    console.log("\n📋 TOP EMPLEOS POR MATCH:\n");
    matchedJobs.slice(0, 5).forEach((j, idx) => {
      console.log(`   ${idx + 1}. [${j.matchPercent}%] ${j.title} @ ${j.company}`);
      console.log(`      ${j.url}`);
      console.log(`      Skills: ${j.matchedSkills.slice(0, 4).join(", ")}`);
      if (j.gaps.length > 0 && j.gaps[0] !== "Ninguno") {
        console.log(`      Gaps  : ${j.gaps.slice(0, 2).join(", ")}`);
      }
      console.log();
    });
  }

  console.log(`\n💾 Archivos guardados:`);
  console.log(`   JSON: ${OUTPUT_PATH}`);
  console.log(`   CSV : ${OUTPUT_PATH.replace(".json", ".csv")}`);
  console.log(`\n🖥️  Ver dashboard: npm run dashboard\n`);
}

analyzeJobs();

