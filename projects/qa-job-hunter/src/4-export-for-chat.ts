// ============================================================
//  4-export-for-chat.ts — Exporta empleos para análisis manual
//  Úsalo cuando no tenés créditos en la API de Anthropic.
//  Genera un archivo de texto listo para pegar en Claude.ai
//  Comando: npx tsx src\4-export-for-chat.ts
// ============================================================

import fs from "fs";
import path from "path";
import { OUTPUT_PATH } from "./config.js";
import type { JobListing } from "./types.js";

const CHUNK_SIZE = 5; // Empleos por archivo (para no superar el límite del chat)

function exportForChat(): void {
  const rawPath = OUTPUT_PATH.replace(".json", "-raw.json");

  if (!fs.existsSync(rawPath)) {
    console.error("❌ No hay empleos scrapeados todavía.");
    console.log("   Ejecutá primero: npx tsx src\\2-scrape-jobs.ts\n");
    process.exit(1);
  }

  const jobs: JobListing[] = JSON.parse(fs.readFileSync(rawPath, "utf-8"));
  console.log(`\n📋 ${jobs.length} empleos encontrados. Generando archivos para chat...\n`);

  // Crear carpeta output si no existe
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Dividir en chunks para no superar el límite del chat
  const chunks: JobListing[][] = [];
  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    chunks.push(jobs.slice(i, i + CHUNK_SIZE));
  }

  // Generar un archivo .txt por chunk
  chunks.forEach((chunk, idx) => {
    const chunkNum = idx + 1;
    const total = chunks.length;
    const filePath = `./output/para-chat-parte${chunkNum}-de${total}.txt`;

    const lines: string[] = [];

    lines.push(`══════════════════════════════════════════════════`);
    lines.push(`  ANÁLISIS DE EMPLEOS QA — Parte ${chunkNum} de ${total}`);
    lines.push(`  (Empleos ${idx * CHUNK_SIZE + 1} al ${Math.min((idx + 1) * CHUNK_SIZE, jobs.length)} de ${jobs.length})`);
    lines.push(`══════════════════════════════════════════════════`);
    lines.push(``);
    lines.push(`Por favor analizá cada empleo contra mi perfil y decime:`);
    lines.push(`1. % de match con mi perfil`);
    lines.push(`2. Skills que ya tengo y coinciden`);
    lines.push(`3. Gaps (si hay)`);
    lines.push(`4. 2-3 frases para personalizar mi CV para ese puesto`);
    lines.push(`5. Si recomendás postularme (sí/no y por qué)`);
    lines.push(``);
    lines.push(`Solo mostrame los que tienen 70% o más de match.`);
    lines.push(`══════════════════════════════════════════════════`);
    lines.push(``);

    chunk.forEach((job, i) => {
      const num = idx * CHUNK_SIZE + i + 1;
      lines.push(`─────────────────────────────────────────────────`);
      lines.push(`EMPLEO #${num}`);
      lines.push(`─────────────────────────────────────────────────`);
      lines.push(`Título    : ${job.title}`);
      lines.push(`Empresa   : ${job.company}`);
      lines.push(`Ubicación : ${job.location}`);
      lines.push(`Modalidad : ${job.modality}`);
      lines.push(`Publicado : ${job.datePosted}`);
      lines.push(`URL       : ${job.url}`);
      lines.push(``);
      lines.push(`DESCRIPCIÓN:`);
      // Limitar descripción a 1500 chars para no saturar el chat
      const desc = job.description.slice(0, 1500);
      lines.push(desc + (job.description.length > 1500 ? "..." : ""));
      lines.push(``);
    });

    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    console.log(`   ✓ Parte ${chunkNum}/${total} → ${filePath} (${chunk.length} empleos)`);
  });

  // También generar un resumen rápido en consola
  console.log(`\n${"═".repeat(52)}`);
  console.log(`  RESUMEN DE EMPLEOS SCRAPEADOS`);
  console.log(`${"═".repeat(52)}`);
  jobs.forEach((j, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${j.title}`);
    console.log(`      ${j.company} | ${j.modality}`);
  });

  console.log(`\n✅ Listo! Se generaron ${chunks.length} archivo(s) en la carpeta output\\`);
  console.log(`\n📌 INSTRUCCIONES:`);
  console.log(`   1. Abrí Claude.ai en el navegador (claude.ai)`);
  console.log(`   2. Pegá el contenido de cada archivo en el chat`);
  console.log(`   3. Claude analizará el match y te dará recomendaciones`);
  console.log(`   4. Guardá las respuestas para armar tu lista final\n`);
}

exportForChat();
