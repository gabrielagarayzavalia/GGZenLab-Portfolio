# Postman — Job Hunter Dashboard API (v1)

Dos collections separadas para no mezclar smoke y regression.

## Archivos

| Archivo | Uso |
|---------|-----|
| `job-hunter-smoke-v1.postman_collection.json` | **Smoke** — solo `SMK-V1-*` (~14 requests) |
| `job-hunter-regression-v1.postman_collection.json` | **Regression API** — `REG-V1-*` HTTP (~20 requests) |
| `job-hunter-local.postman_environment.json` | Environment local (compartido) |
| `job-hunter-dashboard-v1.postman_collection.json` | **Deprecado** — usar smoke + regression |

## Importar en Postman

1. **Import** → **File**
2. Importar **ambas** collections (smoke + regression)
3. Importar environment: `job-hunter-local.postman_environment.json`
4. Seleccionar environment **Job Hunter — Local**

## Variables

| Variable | Default | Descripción |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:3847` | URL del dashboard |
| `sampleJobId` | _(vacío)_ | Auto-set en SMK-V1-02 o SETUP regression |
| `sampleApplicationId` | _(vacío)_ | Auto-set en SMK-V1-18 |

## Prerrequisitos

```bash
cd projects/qa-job-hunter
docker compose up -d
npm run tracker:seed
npm run dashboard   # terminal aparte
```

## Smoke (`SMK-V1`) — ~15 min

Collection: **Job Hunter — Smoke v1 (SMK-V1)**

Orden sugerido (carpetas en orden):

1. **Health** → SMK-V1-01
2. **Match Jobs** → SMK-V1-02 (copia `sampleJobId` si no auto-set)
3. **Jobs** → SMK-V1-05
4. **Tracker** → SMK-V1-18, SMK-V1-19
5. **Dashboard Writes** → SMK-V1-10, 11, 12
6. **Run Apply** → SMK-V1-15, 16, 17
7. **Config** → SMK-V1-13

Doc: `qa/v1/smoke-green-path-v1.md`

## Regression API (`REG-V1`) — ~20 min

Collection: **Job Hunter — Regression v1 (REG-V1)**

1. **00 Setup** → SETUP match-jobs (setea `sampleJobId`)
2. **Match Jobs — filtros** → REG-V1-04 (todos los `filter=`)
3. **API legacy** → REG-V1-07
4. **Config** → REG-V1-06
5. **Dashboard Writes** → REG-V1-20
6. **Dashboard Writes — variantes** → REG-V1-16…19, 21
7. **Match reject / feedback** → REG-V1-22, 23, 25

Casos **no** en Postman (solo markdown): REG-V1-05 (503 sin Mongo), REG-V1-08–15 UI, REG-V1-24 JSON file, REG-V1-31–48 LinkedIn/campaña.

Doc: `qa/v1/regression-green-path-v1.md`

## Headers (writes)

```
X-Tracker-User: 1
Content-Type: application/json
```

Sin header → `403`.

## Newman (futuro CI)

```bash
npx newman run qa/v1/postman/job-hunter-smoke-v1.postman_collection.json \
  -e qa/v1/postman/job-hunter-local.postman_environment.json

npx newman run qa/v1/postman/job-hunter-regression-v1.postman_collection.json \
  -e qa/v1/postman/job-hunter-local.postman_environment.json
```

## Regenerar collections

Si editás la collection combinada legacy o el script:

```bash
node qa/v1/postman/split-collections.mjs
```

## Mantenimiento

Al agregar endpoint en `src/serve-dashboard.ts`:

1. Agregar request en smoke **o** regression (según `SMK-V1-*` / `REG-V1-*`)
2. Actualizar `smoke-green-path-v1.md` o `regression-green-path-v1.md`
3. Preferir test TS en `tests/api/` para CI
