# Smoke — Green Path v1

**Objetivo:** Validar en **≤15 min** que el happy path core responde.  
**Prerrequisitos:** `docker compose up -d` · `npm run tracker:seed` · `npm run dashboard` (puerto 3847)  
**Relacionado:** `qa/smoke.md` (smoke por PR) · este archivo = **suite v1 estable**

## Leyenda columna Automatizado

| Valor | Significado |
|-------|-------------|
| **sí** | Cubierto por `npm run test:*` o script QA |
| **parcial** | Unit/API sí; UI o Mongo requiere paso manual |
| **no** | Solo manual (LinkedIn, browser, campaña real) |

---

## API y salud

| ID | Caso | Pasos | Esperado | Automatizado |
|----|------|-------|----------|--------------|
| SMK-V1-01 | Health dashboard | `GET http://localhost:3847/api/health` | `200`, `ok: true`, `features.tracker: true` | **sí** — Postman / `tests/api` pattern |
| SMK-V1-02 | Match-jobs envelope | `GET /api/dashboard/match-jobs` | `200`, `matchedJobs`, `jobs`, `meta.source: "mongo"` | **sí** — `npm run test:api` |
| SMK-V1-03 | Filtro inválido | `GET /api/dashboard/match-jobs?filter=invalid` | `400`, `allowed` incluye `applied` | **sí** — `tests/api/match-jobs.test.ts` |
| SMK-V1-04 | Shim legacy results | `GET /api/results` | `200` + header `Deprecation: true` | **sí** — `tests/api/match-jobs.test.ts` |
| SMK-V1-05 | Jobs list Mongo | `GET /api/jobs?sort=matchPercent&order=desc` | `200`, array `jobs` ordenado | **sí** — `tests/api/jobs.test.ts` |

## Dashboard UI (lista / filtros / detalle)

| ID | Caso | Pasos | Esperado | Automatizado |
|----|------|-------|----------|--------------|
| SMK-V1-06 | Home carga lista | Abrir `http://localhost:3847/` | Tabla/cards con empleos; sin error consola | **parcial** — wiring estático en `m-lite-wiring.test.ts`; UI manual |
| SMK-V1-07 | Filtro aplicados | En dashboard, filtro **Aplicados** | Solo filas con estado aplicado/en enviada | **no** — UI manual |
| SMK-V1-08 | Detalle aviso | Click en fila → panel detalle | Título, empresa, % match, link LinkedIn visibles | **no** — UI manual |
| SMK-V1-09 | m-lite responde | `GET /m-lite` → `200` | Cards cargan desde API (no mock) | **parcial** — HTTP 200 automatizable; contenido manual |

## Writes dashboard → tracker

| ID | Caso | Pasos | Esperado | Automatizado |
|----|------|-------|----------|--------------|
| SMK-V1-10 | Marcar aplicado | POST `/api/dashboard/application-status` con `X-Tracker-User: 1`, body `{ "jobId": "<id>", "status": "applied" }` | `200`, `estado: "Enviada"` | **sí** — `npm run qa:smoke-b38-15-writes` |
| SMK-V1-11 | Reject match | POST `/api/dashboard/reject-match` `{ "jobId": "<id>", "reason": "test" }` | `200`, `matchRejected: true` | **sí** — script smoke B-38-15 |
| SMK-V1-12 | Undo reject | DELETE `/api/dashboard/reject-match/<jobId>` | `200`, `matchRejected: false` | **sí** — script smoke B-38-15 |

## Config preguntas

| ID | Caso | Pasos | Esperado | Automatizado |
|----|------|-------|----------|--------------|
| SMK-V1-13 | Listar preguntas | `GET /api/config/questions` | `200`, array `questions` | **sí** — `tests/config/questions-store.test.ts` |
| SMK-V1-14 | UI config preguntas | Abrir `/config#preguntas` | Lista carga; form alta manual visible | **parcial** — unit store; UI manual |

## Run / Apply dry-run

| ID | Caso | Pasos | Esperado | Automatizado |
|----|------|-------|----------|--------------|
| SMK-V1-15 | Status idle | `GET /api/run/apply/status` | `200`, sin run activo (`idle` o equivalente) | **sí** — `npm run test:run-apply` |
| SMK-V1-16 | Iniciar dry-run | POST `/api/run/apply` `{ "mode": "dry_run", "applyMax": 1 }` | `202`, estado `running` o `queued` | **parcial** — unit runner; E2E manual |
| SMK-V1-17 | Cancel run | POST `/api/run/apply/cancel` tras iniciar | `200`, estado `cancelled` (no `error`) | **sí** — `npm run test:run-apply` |

## Pipeline / campaña (alto nivel)

| ID | Caso | Pasos | Esperado | Automatizado |
|----|------|-------|----------|--------------|
| SMK-V1-18 | Tracker applications API | `GET /api/tracker/applications?sort=matchPercent` | `200`, `{ applications, count }` | **sí** — smoke B-38-13 |
| SMK-V1-19 | Export xlsx | `GET /api/tracker/export/xlsx` | `200`, content-type xlsx | **sí** — `tests/api/tracker-export.test.ts` |
| SMK-V1-20 | Campaign dry-run gate | `npm run qa:dry-run-campaign:pipeline` (sin LinkedIn) | Exit 0 o skip documentado | **parcial** — script gate; no EA real |

---

## Comandos rápidos (smoke automatizado)

```bash
cd projects/qa-job-hunter
docker compose up -d
npm run tracker:seed
npm run dashboard          # terminal aparte
npm run test:api
npm run test:match-jobs
npm run test:run-apply
npm run qa:smoke-b38-13
```

## Conteo

| Métrica | Valor |
|---------|-------|
| Casos totales | 20 |
| Automatizado **sí** | 14 |
| **parcial** | 5 |
| **no** | 1 |
