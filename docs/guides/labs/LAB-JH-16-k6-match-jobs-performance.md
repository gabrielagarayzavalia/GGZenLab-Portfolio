# LAB-JH-16 — Performance API dashboard (k6)

**Tipo:** performance · Job Hunter  
**Duración:** ~45 min  
**Estado:** guía preparada · instructor  
**Objetivo:** Línea base `GET /api/dashboard/match-jobs` según `qa/v1/performance-test-plan-v1.md` (p95 &lt; 2s).

---

## Prerrequisitos

- LAB-09 (conceptos latency) · Mongo + seed (~200–500 applications)
- [k6 instalado](https://grafana.com/docs/k6/latest/set-up/install-k6/)

## Outline

1. Leer thresholds PERF-V1-01 / PERF-V1-A en `performance-test-plan-v1.md`
2. Script `scripts/perf/k6-match-jobs.js` (esqueleto en el plan)
3. Correr VUs=1, 30s — health + match-jobs
4. Anotar p95 en `local/reports/perf-baseline-YYYY-MM-DD.md`
5. (Opcional) export xlsx timing PERF-V1-04

**Checkpoint ✋:** p95 match-jobs &lt; 2000ms con tu dataset actual.

> **Lab JH-16, paso 1** — modo instructor.
