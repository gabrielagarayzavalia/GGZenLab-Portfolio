# LAB-JH-18 — Contract-first OpenAPI dashboard

**Tipo:** API contract · Job Hunter  
**Duración:** ~75 min  
**Estado:** guía preparada · instructor  
**Objetivo:** Documentar y validar contrato de endpoints dashboard (`match-jobs`, writes, assessment meta) con OpenAPI + tests de schema.

---

## Prerrequisitos

- LAB-05 o LAB-JH-14 · lectura de `src/serve-dashboard.ts`

## Outline

1. Inventariar rutas dashboard en `serve-dashboard.ts`
2. Esqueleto OpenAPI 3 en `projects/qa-job-hunter/docs/openapi-dashboard.yaml`
3. Schemas: `JobMatch`, `MatchJobsResponse.meta`, filtros `DashboardMatchFilter`
4. Test: response real vs schema (ajv o script TS)
5. Enlazar AC IDs en nombres de test (`@AC-421-banner-meta`)

**Checkpoint ✋:** OpenAPI cubre al menos 3 endpoints críticos; 1 test schema green.

> **Lab JH-18, paso 1** — modo instructor.
