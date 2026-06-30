// ============================================================
//  run-all.ts — Orquestador principal
//  Comando: npx tsx src\run-all.ts
// ============================================================

import { execSync } from "child_process";
import fs from "fs";
import readline from "readline";
import { SESSION_PATH, OUTPUT_PATH } from "./config.js";
import type { AnalysisResult, JobMatch } from "./types.js";

function run(cmd: string, label: string): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`🔄 ${label}`);
  console.log("─".repeat(60));
  execSync(`npx tsx ${cmd}`, { stdio: "inherit" });
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function printDashboard(): void {
  if (!fs.existsSync(OUTPUT_PATH)) return;
  const result: AnalysisResult = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));

  console.log(`
╔════════════════════════════════════════════════════════════╗
║           🎯  QA JOB HUNTER — RESULTADOS FINALES           ║
╚════════════════════════════════════════════════════════════╝`);
  console.log(`  Fecha    : ${new Date(result.scrapedAt).toLocaleString()}`);
  console.log(`  Total    : ${result.totalFound} empleos analizados`);
  console.log(`  Match 70%+: ${result.matchedJobs.length} empleos`);
  console.log(`  Descartados: ${result.skippedJobs.length}`);

  if (result.matchedJobs.length === 0) {
    console.log("\n  ⚠️  Sin empleos con 70%+ de match.\n");
    return;
  }

  console.log("\n" + "═".repeat(62));
  result.matchedJobs.forEach((job: JobMatch, i: number) => {
    const bar = "█".repeat(Math.round(job.matchPercent / 5));
    console.log(`\n  ${i + 1}. [${job.matchPercent}%] ${bar}`);
    console.log(`     ${job.title} @ ${job.company}`);
    console.log(`     ${job.location} | ${job.modality}`);
    console.log(`     Skills ✓ : ${job.matchedSkills.slice(0, 4).join(", ")}`);
    if (job.gaps.length > 0 && job.gaps[0] !== "Ninguno") {
      console.log(`     Gaps     : ${job.gaps.join(", ")}`);
    }
    console.log(`\n     📝 CV tips:`);
    job.cvSuggestions.forEach((s) => console.log(`        • ${s}`));
    console.log(`\n     💬 ${job.summary}`);
    console.log(`     🔗 ${job.url}`);
    console.log("  " + "─".repeat(58));
  });

  console.log(`\n  📄 CSV: ./output/jobs-result.csv`);
  console.log(`  📦 JSON: ./output/jobs-result.json`);
  console.log(`  🖥️  Dashboard web: npm run dashboard`);

}

async function main(): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║              🧪  QA JOB HUNTER — INICIO                    ║
╚════════════════════════════════════════════════════════════╝`);

  // ── PASO 1: Login si no hay sesión ──────────────────────────
  if (!fs.existsSync(SESSION_PATH)) {
    console.log("⚠️  No hay sesión guardada. Iniciando login...");
    run("src\\1-login.ts", "Login LinkedIn");
  } else {
    console.log("✅ Sesión existente — se omite el login.");
  }

  // ── PASO 2: Scraping ────────────────────────────────────────
  run("src\\2-scrape-jobs.ts", "Scraping de empleos LinkedIn");

  // ── PASO 3: Elegir modo de análisis ─────────────────────────
  console.log(`
${"═".repeat(60)}
  📊 MODO DE ANÁLISIS — Elegí una opción:

  A) Análisis automático con Claude API (nube)
     → Requiere ANTHROPIC_API_KEY en console.anthropic.com

  B) Análisis local con Ollama (recomendado, sin API key)
     → Modelo liviano para 8 GB RAM: qwen2.5:1.5b
     → Requiere Ollama instalado y corriendo

  C) Exportar para analizar en Claude.ai (manual)
     → Genera archivos .txt para pegar en el chat
${"═".repeat(60)}`);

  const opcion = await ask("\n  Tu elección (a/b/c): ");

  if (opcion === "a") {
    process.env.LLM_PROVIDER = "anthropic";
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log("\n⚠️  No se detecta ANTHROPIC_API_KEY.");
      console.log("   Configurala con: $env:ANTHROPIC_API_KEY='sk-ant-...'");
      console.log("   O elegí la opción B para análisis local con Ollama.\n");
    } else {
      run("src\\3-analyze-match.ts", "Análisis con Claude API");
      printDashboard();
    }

  } else if (opcion === "c") {
    run("src\\4-export-for-chat.ts", "Exportando empleos para Claude.ai");
    console.log(`
  ✅ Archivos generados en output\\
  📌 Pasos a seguir:
     1. Abrí claude.ai en tu navegador
     2. Pegá el contenido de cada archivo .txt
     3. Claude te da el análisis de match gratis
     4. Guardá los resultados que te interesan
`);

  } else {
    process.env.LLM_PROVIDER = "ollama";
    run("src\\3-analyze-match.ts", "Análisis local con Ollama");
    printDashboard();
  }
}

main().catch(console.error);

