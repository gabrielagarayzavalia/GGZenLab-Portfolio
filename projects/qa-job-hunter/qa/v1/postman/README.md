# Postman — Job Hunter Dashboard API (v1)

Colección para **smoke manual** y exploración de APIs del dashboard (`npm run dashboard`, puerto **3847**).

## Importar en Postman

1. Abrir Postman → **Import** → **File**
2. Seleccionar: `qa/v1/postman/job-hunter-dashboard-v1.postman_collection.json`
3. Importar environment (opcional): `qa/v1/postman/job-hunter-local.postman_environment.json`

## Variables

| Variable | Default | Descripción |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:3847` | URL del dashboard |
| `trackerUserHeader` | `1` | Valor para `X-Tracker-User` en writes |
| `sampleJobId` | _(vacío)_ | Setear tras listar match-jobs |
| `sampleApplicationId` | _(vacío)_ | Setear tras GET applications |

## Prerrequisitos

```bash
cd projects/qa-job-hunter
docker compose up -d
npm run tracker:seed    # o db:seed + tracker:seed
npm run dashboard       # terminal aparte
```

## Carpetas de la collection

| Carpeta | Endpoints | Casos SMK/REG |
|---------|-----------|---------------|
| **Health** | `GET /api/health` | SMK-V1-01 |
| **Match Jobs** | match-jobs, results shim, filtros | SMK-V1-02–04 |
| **Jobs** | `GET /api/jobs` | SMK-V1-05 |
| **Tracker** | applications, export xlsx | SMK-V1-18–19 |
| **Dashboard Writes** | application-status, reject-match | SMK-V1-10–12 |
| **Run Apply** | status, start dry-run, cancel | SMK-V1-15–17 |
| **Config** | questions GET/POST | SMK-V1-13 |

## Headers importantes

Writes a Mongo (`/api/dashboard/*`) **requieren**:

```
X-Tracker-User: 1
Content-Type: application/json
```

Sin ese header → `403 Requiere header X-Tracker-User: 1`.

## Orden sugerido (smoke manual ~5 min)

1. Health
2. Match-jobs (copiar un `jobId` a variable `sampleJobId`)
3. Tracker applications
4. _(opcional)_ POST application-status `applied` → verificar GET applications
5. _(opcional)_ POST reject-match → DELETE undo
6. Run apply status

## Newman (futuro CI)

```bash
npx newman run qa/v1/postman/job-hunter-dashboard-v1.postman_collection.json \
  -e qa/v1/postman/job-hunter-local.postman_environment.json
```

## Relación con tests TS

Los tests en `tests/api/` cubren los mismos contratos. Postman es para:

- Exploración manual durante desarrollo
- Demos / labs QA
- Smoke cuando no querés correr todo `npm run test:api`

**Fuente de verdad automatizada:** `tests/api/*.test.ts`

## Mantenimiento

Al agregar endpoint en `src/serve-dashboard.ts`:

1. Actualizar collection JSON
2. Actualizar `smoke-green-path-v1.md` si es green path
3. Preferir test TS en `tests/api/` para CI
