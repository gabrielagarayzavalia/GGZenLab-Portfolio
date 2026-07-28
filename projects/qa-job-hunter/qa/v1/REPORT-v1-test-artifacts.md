# Reporte ejecutivo — Artefactos QA v1

**Fecha:** 2026-07-28  
**Rama:** `docs/qa-v1-test-plan`  
**Proyecto:** `projects/qa-job-hunter`  
**Ticket:** QA estrategia v1 green path (documentación)

---

## TL;DR

Se creó la suite documental v1 en `qa/v1/` con **68 casos** (20 smoke + 48 regression), **~70% automatizable** vía tests TS existentes + Postman, y recomendación de **Markdown+Gherkin en repo** como test case manager principal.

---

## Archivos creados

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | [`test-case-manager-recommendation.md`](./test-case-manager-recommendation.md) | Comparativa 4 opciones + recomendación híbrida |
| 2 | [`smoke-green-path-v1.md`](./smoke-green-path-v1.md) | 20 casos smoke `SMK-V1-NN` |
| 3 | [`regression-green-path-v1.md`](./regression-green-path-v1.md) | 48 casos regression `REG-V1-NN` |
| 4 | [`automation-coverage-matrix.md`](./automation-coverage-matrix.md) | Matriz manual / Playwright / Postman / API TS |
| 5 | [`performance-test-plan-v1.md`](./performance-test-plan-v1.md) | k6 + Lighthouse; thresholds; qué NO hacer |
| 6 | [`postman/README.md`](./postman/README.md) | Guía import Postman |
| 7 | [`postman/job-hunter-dashboard-v1.postman_collection.json`](./postman/job-hunter-dashboard-v1.postman_collection.json) | 16 requests con tests |
| 8 | [`postman/job-hunter-local.postman_environment.json`](./postman/job-hunter-local.postman_environment.json) | Environment local |
| 9 | Este reporte | Resumen ejecutivo |

**No se modificó:** `qa/smoke.md`, `qa/integration.md` (smoke por PR existente).

**No se incluyó:** testids dashboard (fase 6 aparte, rama `feature/dashboard-testids`).

---

## Conteos de casos

| Suite | Total | Auto **sí** | **parcial** | **no** |
|-------|------:|------------:|------------:|-------:|
| Smoke `SMK-V1-*` | 20 | 14 (70%) | 5 (25%) | 1 (5%) |
| Regression `REG-V1-*` | 48 | 28 (58%) | 14 (29%) | 6 (13%) |
| **Total** | **68** | **42 (62%)** | **19 (28%)** | **7 (10%)** |

### % automatizable (definición amplia)

Incluye **sí** + **parcial** con test TS o Postman: **61/68 = ~90%** con cobertura técnica; **ejecución CI sin manual: ~62%**.

---

## Cobertura green path (criterios pedidos)

| Área | Casos | IDs ejemplo |
|------|-------|-------------|
| Dashboard lista/filtros/detalle | 12 | SMK-V1-06–09, REG-V1-08–14 |
| Writes application-status | 7 | SMK-V1-10, REG-V1-16–21 |
| Match reject | 5 | SMK-V1-11–12, REG-V1-22–25 |
| Config preguntas | 6 | SMK-V1-13–14, REG-V1-26–30 |
| Run dry-run | 7 | SMK-V1-15–17, REG-V1-31–35 |
| Pipeline/campaña alto nivel | 8 | SMK-V1-18–20, REG-V1-36–41 |
| API health/match-jobs | 8 | SMK-V1-01–05, REG-V1-01–07 |

---

## Postman collection

- **16 requests** en 7 carpetas
- Tests inline alineados a IDs `SMK-V1-*` / `REG-V1-*`
- Variables: `baseUrl`, `sampleJobId`, `sampleApplicationId`
- **No había** collection previa en `qa-job-hunter` — creada desde cero (patrón `api-testing/postman/` del monorepo)

---

## Recomendación test manager (1 párrafo)

Usar **Markdown + Gherkin en el repo** (`qa/v1/`, `gherkin/`) como fuente de verdad de casos con IDs estables (`SMK-V1-NN`, `REG-V1-NN`), **GitHub Issues** solo para checklists de ejecución por sprint, y **Postman** para API manual — evitar TestRail/Qase en v1 por fricción TDAH y duplicación; la automatización real vive en `tests/` + `npm run test:*` que ya cubre ~62% del smoke sin browser.

---

## Próximos pasos sugeridos

| Prioridad | Acción | Esfuerzo |
|-----------|--------|----------|
| 1 | Correr smoke automatizado: `npm run test:api && npm run test:tracker` | 5 min |
| 2 | Importar Postman collection; 1 corrida manual | 10 min |
| 3 | Issue template ejecución smoke (ver `test-case-manager-recommendation.md`) | 15 min |
| 4 | Newman en CI (opcional, label `qa`) | 1–2 h |
| 5 | Baseline perf (`performance-test-plan-v1.md`) | 30 min |
| 6 | **Post fase 6 testids:** Playwright dashboard E2E | 8–16 h |

---

## Comandos verificación rápida

```bash
cd projects/qa-job-hunter
docker compose up -d
npm run tracker:seed
npm run test:api
npm run test:match-jobs
npm run test:run-apply
```

---

## Relación con artefactos existentes

| Existente | Relación |
|-----------|----------|
| `qa/smoke.md` | Smoke **por PR** (B-38-17, etc.) — complementario |
| `qa/integration.md` | Integration con dashboard+Mongo — subset en REG-V1 |
| `gherkin/mongo-persistence.feature` | Referenciado en REG-V1-01–03 |
| `tests/api/*.test.ts` | Backend automatizado smoke/regression |
| `docs/fixes-v1-v2-matrix.md` | Scope v1 vs v2 para priorización |

---

**Autor:** agente qa-automation · **Estado:** listo para review y PR a `release/v2`
