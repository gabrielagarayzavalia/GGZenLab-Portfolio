# Fix B-38-20 (#335) — Match alto sin matchedSkills en dashboard

## Root cause

1. **`analysisSnapshotFromPipelineMatch`** no creaba snapshot si faltaban skills **y** description en scrape → `matchPercent` en Mongo sin `analysis.matchedSkills`.
2. **`planScrapeMetadataOnlyUpdate`** (filas con estado protegido: Enviada, A-pendiente, etc.) solo mergeaba `jobClosed` en `analysis`, **no** `matchedSkills`/`gaps` del pipeline.
3. **`applicationToJobMatch`** devolvía `matchedSkills: []` cuando `analysis.matchedSkills` venía vacío aunque el % fuera alto.

## Fix

| Capa | Cambio |
|------|--------|
| `pipeline-match.ts` | Snapshot si hay skills, gaps, summary o description; `matchedSkillsForSnapshot` fallback |
| `automation-merge.ts` | `mergePipelineAnalysisSnapshot` en updates protegidos |
| `match-jobs.ts` | `resolveMatchedSkillsForDisplay` en detalle API |

## No incluido (#329)

Mejora del motor regex/LLM en applied-list — este fix es sync + display.

## Verificación

```bash
cd projects/qa-job-hunter
npm run test:tracker
npm run test:match-jobs
```

Tras `tracker:sync-pipeline`, filas Enviada deben recibir `analysis.matchedSkills` del `matched.json`.
