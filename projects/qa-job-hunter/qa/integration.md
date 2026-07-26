# Integration — qa-job-hunter

Pruebas que requieren dashboard (`npm run dashboard`) y Mongo (`docker compose up -d`).

## PR #352 — rescue bf8ad01 (#295 #296 #299)

| ID | Caso | Archivo / comando | Esperado |
|----|------|-------------------|----------|
| INT-352-01 | Export xlsx vía HTTP | `tests/api/tracker-export.test.ts` (incluido en `npm run test:api`) | 200, attachment `Empleos_Tracker_export.xlsx`, hoja `Empleos` con header `Match` |
| INT-352-02 | Applications list para m-lite | `GET /api/tracker/applications` (smoke manual o `tests/api/jobs.test.ts` pattern) | Array `applications` con `id`, `puesto`, `estado` |
| INT-352-03 | Tracker B-38-13 smoke script | `npm run qa:smoke-b38-13` | Informe en `local/reports/b38-13-smoke.md`, checks pass |
| INT-352-04 | Export buffer desde Mongo | `tests/tracker/export-xlsx.test.ts` (unit con sample) | Buffer xlsx parseable; fila datos coherente |

### Notas

- Si `GET /api/tracker/export/xlsx` devuelve **404**, el proceso dashboard corre código viejo → reiniciar con `npm run dashboard` en la rama `feature/b38-rescue-bf8ad01`.
- `OPEN_DESKTOP_EXCEL` / `OPEN_EXCEL`: validados por unit tests; campaña real no se ejecuta en integration estándar.

### a revisar

| ID | Motivo |
|----|--------|
| INT-352-UI | Smoke visual m-lite cards + click export en `/tracker` requiere browser manual o E2E (`e2e:dashboard-full`) |
