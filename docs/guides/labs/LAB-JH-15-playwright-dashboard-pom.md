# LAB-JH-15 — UI dashboard Playwright + POM (TypeScript)

**Tipo:** UI E2E · Job Hunter  
**Duración:** ~90 min  
**Estado:** guía preparada · instructor  
**Objetivo:** Primera suite E2E del dashboard: sidebar filtros, counts `(N)`, banner assessment, detalle writes.

**Basado en:** LAB-04 · `data-testid` en `dashboard/index.html`

---

## Prerrequisitos

- LAB-04 outline · LAB-JH-14 (API estable)
- `npx playwright install` en carpeta de tests que definamos (`tests/e2e/` o `tests/playwright/`)

## Outline

1. `playwright.config.ts` — baseURL `http://localhost:3847`
2. Page Object `DashboardPage` — sidebar, lista, detalle, banner
3. Test smoke: cargar home, assert `dash-sidebar-filters` visible
4. Test filtro: activar Assessment pendiente → lista coherente con count
5. Test banner #421: seed assessment → warn + CTA «Ver pendientes»
6. Headed debug vs CI headless

**Checkpoint ✋:** 3 tests green local sin flakiness en 2 corridas seguidas.

## Fuera de scope v1

- LinkedIn Easy Apply UI
- `/tracker` AG Grid completo

> **Lab JH-15, paso 1** — modo instructor.
