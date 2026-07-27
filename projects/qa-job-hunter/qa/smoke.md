# Smoke — qa-job-hunter

Casos rápidos para validar que el dashboard y el tracker responden. No reemplazan regression/E2E.

## PR #316 — B-38-17 shim `/api/results` → match-jobs

| ID | Caso | Comando / acción | Esperado |
|----|------|------------------|----------|
| SMK-316-01 | Shim deprecación `/api/results` | `curl -s -D - -o NUL http://localhost:3847/api/results` y `curl -s -D - -o NUL http://localhost:3847/api/dashboard/match-jobs` | Ambos `200`; `/api/results` incluye `Deprecation: true` y `Link: </api/dashboard/match-jobs>; rel="successor-version"`; body envelope mongo (mismo shape que match-jobs). **Skip/documentar** si dashboard corre código viejo (404 en match-jobs o sin headers Deprecation). Cubierto también en `npm run test:api` test «delegates to match-jobs». |

### Notas B-38-17

- Parte de deprecación legacy `/api/results` (#300).
- `console.warn` en servidor al invocar el shim.

## PR #315 — B-38-16 sync match-feedback ↔ matchRejected

| ID | Caso | Comando / acción | Esperado |
|----|------|------------------|----------|
| SMK-315-01 | Unit feedback sync (dual-write + merge + analyze block) | `npm run test:tracker` | 48/48 pass (incl. `tests/feedback/match-feedback-sync.test.ts` ×6) |
| SMK-315-02 | Unit match-jobs sin regresión | `npm run test:match-jobs` | 11/11 pass |
| SMK-315-03 | HTTP reject-match Mongo (reject + undo) | `npx tsx scripts/qa/smoke-b38-15-writes.ts` | POST/DELETE 200, `matchRejected` true → false |
| SMK-315-04 | HTTP dual-write JSON | Tras reject: entrada en `output/match-feedback.json`; tras undo: eliminada | **requiere dashboard reiniciado con rama `feature/b38-16-match-feedback-sync`** — si corre código viejo, Mongo OK pero JSON no se actualiza |

### Notas B-38-16

- Migración JSON → Mongo planificada en `docs/match-feedback-migration.md` (#300).
- Verificación manual completa: pasos 1–6 en ese doc.

## PR #353 — fix cancel /run race

| ID | Caso | Comando / acción | Esperado |
|----|------|------------------|----------|
| SMK-353-01 | Cancel + close race (estado `cancelled` persiste) | `npm run test:run-apply` | 5/5 pass (serial: comparten `output/run/apply-run.json`) |

## PR #352 — rescue bf8ad01 (#295 #296 #299)

| ID | Caso | Comando / acción | Esperado |
|----|------|------------------|----------|
| SMK-352-01 | Unit tracker (incl. excel-legacy + export-xlsx) | `npm run test:tracker` | 42/42 pass |
| SMK-352-02 | Unit API jobs + match-jobs | `npm run test:api` | pass (incl. tracker-export si dashboard actualizado) |
| SMK-352-03 | Unit match-jobs compose | `npm run test:match-jobs` | 11/11 pass |
| SMK-352-04 | Static wiring m-lite + export UI | `npx tsx --test tests/dashboard/m-lite-wiring.test.ts` | 3/3 pass |
| SMK-352-05 | Ruta `/m-lite` sirve HTML | `curl -s -o NUL -w "%{http_code}" http://localhost:3847/m-lite` | `200` |
| SMK-352-06 | API applications (m-lite data source) | `GET /api/tracker/applications?sort=matchPercent&order=desc` | `200`, body `{ applications: [...] }` |
| SMK-352-07 | Export xlsx HTTP | `GET /api/tracker/export/xlsx` | `200`, content-type xlsx, hoja `Empleos` — **requiere dashboard reiniciado con rama actual** |
| SMK-352-08 | Excel legacy flags (unit) | cubierto en `tests/tracker/excel-legacy.test.ts` | default off; `OPEN_DESKTOP_EXCEL=1` / `OPEN_EXCEL=true` on |

### Scripts reutilizables

- `npm run qa:smoke-b38-13` — schema tracker + seed + shape API (base B-38-13)
- `npm run qa:smoke-b38-15-writes` — writes dashboard → Mongo (no cubre export)

### Manual (a revisar sin browser automation)

- Abrir `http://localhost:3847/m-lite` → cards cargan desde API (no datos mock)
- En `/tracker` → botón **Exportar .xlsx** descarga archivo válido
