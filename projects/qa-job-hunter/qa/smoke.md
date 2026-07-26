# Smoke — qa-job-hunter

Casos rápidos para validar que el dashboard y el tracker responden. No reemplazan regression/E2E.

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
