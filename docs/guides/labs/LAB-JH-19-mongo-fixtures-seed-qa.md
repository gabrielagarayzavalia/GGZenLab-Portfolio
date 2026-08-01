# LAB-JH-19 — Mongo fixtures y seed para QA

**Tipo:** test data · Job Hunter  
**Duración:** ~50 min  
**Estado:** guía preparada · instructor  
**Objetivo:** Dominar seeds/fixtures Mongo para dashboard: assessment, filtros, export xlsx, sin tocar Gmail/LinkedIn real.

---

## Prerrequisitos

- LAB-03 · Compass o `mongosh`
- Scripts existentes: `qa:seed-assessment-estados`, `tracker:seed`

## Outline

1. Mapa colecciones: `applications`, `jobs`, `analysis_runs`
2. Correr `npm run qa:seed-assessment-estados` — verificar en Compass
3. Crear fixture mínimo propio (1 `A-pendiente` + 1 `Duplicado`) en script local `scripts/qa/my-fixture.ts`
4. Reset seguro: backup `backups/` antes de `--fresh`
5. Documentar “dataset QA estándar” para smoke manual (5 filas)

**Checkpoint ✋:** dashboard muestra tus fixtures tras seed sin campaña real.

> **Lab JH-19, paso 1** — modo instructor.
