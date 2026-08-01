# LAB-JH-14 — API dashboard Job Hunter (Postman / Newman)

**Tipo:** API testing · Job Hunter  
**Duración:** ~60 min  
**Estado:** guía preparada · instructor  
**Objetivo:** Automatizar smoke/regression HTTP del dashboard: `match-jobs`, filtros, `meta.assessmentBanner`, writes.

**Repo:** `projects/qa-job-hunter` · Puerto **3847**

---

## Prerrequisitos

- LAB-03 (Mongo) · LAB-02 (CI/CD) recomendado
- `npm run dashboard` + `npm run qa:seed-assessment-estados`

## Outline

1. Importar `qa/v1/postman/job-hunter-smoke-v1.postman_collection.json`
2. Extender requests: `filter=assessment`, `assessment_done`, assert `meta.assessmentPendingCount`
3. Newman local: `npx newman run ... -e qa/v1/postman/job-hunter-local.postman_environment.json`
4. Comparar con `tests/api/match-jobs.test.ts` — cuándo duplicar vs unit
5. (Opcional) job GitHub Actions — ver LAB-JH-17

**Checkpoint ✋:** Newman smoke 100% green contra `release/v2`.

## Relacionado

- `qa/v1/automation-coverage-matrix.md` · LAB-05 Rest Assured (conceptos transferibles)

> **Lab JH-14, paso 1** — modo instructor.
