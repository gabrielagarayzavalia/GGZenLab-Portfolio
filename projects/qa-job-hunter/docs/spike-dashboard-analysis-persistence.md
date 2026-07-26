# Spike — persistencia analysis pipeline → dashboard

**Fecha:** 2026-07-26 · **Contexto:** E2E dashboard (#313 follow-up)

## Hallazgo

El dual-write `matched.json` → Mongo **no guardaba** `applications.analysis` ni `inLatestAnalysis`. El dashboard mostraba stubs aunque applied-list tuviera skills/JD en scrape.

| Capa | Tenía datos | Dashboard veía |
|------|-------------|------------------|
| `data/scraped/_all.json` | JD, location, modality | ❌ no llegaba |
| `data/matched.json` | skills, gaps, summary | ❌ solo notas |
| Mongo `jobs` (db:seed) | JobMatch completo | ⚠️ join parcial (fix LinkedIn id) |
| Mongo `applications.analysis` | — | ❌ vacío |

**No faltan columnas Mongo** — schema B-38-13 (#312) ya tiene `analysis`, `inLatestAnalysis`. Faltaba **escribir** en pipeline sync.

## Fix implementado

1. `pipelineMatchToApplicationInput` → `analysis` snapshot + `inLatestAnalysis` (≥70%).
2. `loadPipelineScrapedJobs` une JD desde `scraped/_all.json`.
3. `exportJobsResultFromPipeline` → `output/jobs-result.json` post-pipeline.
4. `npm run e2e:dashboard-full` — campaña 24h + verify API.

## Fuera de alcance (spike futuro)

- Históricos Excel → «No seleccionada/o» + Cerrado masivo (checkboxes UX).
- Re-análisis de filas viejas sin scrape.

## Verificación

```bash
npm run e2e:dashboard-full
# o pipeline manual:
npm run campaign -- --yes --dry-run
npm run db:seed
```

Informe: `local/reports/e2e-dashboard-full.md`
