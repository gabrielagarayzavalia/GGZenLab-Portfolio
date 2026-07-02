# LAB-03 — QA Mongo (US-JH-B06-4)

**Story:** US-JH-B06-4 · **Tasks:** JH-T-B06-4-01 … 4-03  
**Duración:** ~40 min  
**Objetivo:** Practicar el lab publicado: seed Mongo, API `GET /api/jobs`, Gherkin, tests automatizados.

**Docs portfolio:** [`docs/projects/qa-job-hunter/`](../../projects/qa-job-hunter/)  
**Gherkin:** [`projects/qa-job-hunter/gherkin/mongo-persistence.feature`](../../../projects/qa-job-hunter/gherkin/mongo-persistence.feature)

---

## Prerrequisitos

- [LAB-00](./LAB-00-setup-ggzenlab.md) OK
- `output/jobs-result.json` existe (corriste analyze al menos una vez)
- Docker Desktop encendido

---

## Paso 1/6 — Mongo healthy

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio\projects\qa-job-hunter
docker compose up -d
docker compose ps
```

**Esperado:** `qa-job-hunter-mongo` → **healthy**

**Checkpoint ✋:** ¿healthy? (respondé antes del paso 2)

---

## Paso 2/6 — Seed

```powershell
npm install
npm run db:seed
```

**Esperado:** mensaje con Run ID y jobs upserted (> 0).

Verificar en Mongo:

```powershell
docker exec qa-job-hunter-mongo mongosh qa_job_hunter --quiet --eval "db.jobs.countDocuments()"
```

**Checkpoint ✋:** ¿count > 0?

---

## Paso 3/6 — Dashboard + API

Terminal 1:

```powershell
npm run dashboard
```

Terminal 2:

```powershell
curl "http://localhost:3847/api/jobs?sort=matchPercent&order=desc"
```

**Esperado:** JSON con `"jobs": [...]` y `"count": N`

**Nota:** el UI del dashboard aún usa `/api/results` (JSON file) — este lab valida **Mongo vía API** (B06-3-01).

**Checkpoint ✋:** ¿HTTP 200 y array jobs?

---

## Paso 4/6 — Tests automatizados

Con dashboard corriendo:

```powershell
npm run test:api
```

**Esperado:** 2 tests **pass** (no skip).

**Checkpoint ✋:** ¿pass 2/2?

---

## Paso 5/6 — Gherkin (manual / traceability)

Abrí `gherkin/mongo-persistence.feature`.

**Tu turno:** para el scenario `@JH-T-B06-3-01`:

1. ¿Qué precondiciones tiene?  
2. ¿Qué AC ID aparece en tags?  
3. Mapeá cada `Given/When/Then` al paso que ya ejecutaste.

**Definition of Done parcial:** podés explicar trazabilidad AC → Gherkin → test API.

**Checkpoint ✋:** ¿leíste el feature y mapeaste un scenario?

---

## Paso 6/6 — Evidencia para portfolio

Capturá (screenshot o notas):

- `docker compose ps` healthy  
- salida de `db:seed`  
- curl `/api/jobs` (fragmento)  
- `npm run test:api` green  

Opcional: MongoDB Compass → DB `qa_job_hunter` → colección `jobs`.

**Definition of Done completo:** pasos 1–4 OK + Gherkin revisado + evidencia guardada.

---

## Ejercicio opcional

Corré seed **dos veces** y verificá que el count de jobs **no duplica** (upsert por `url`):

```powershell
npm run db:seed
docker exec qa-job-hunter-mongo mongosh qa_job_hunter --quiet --eval "db.jobs.countDocuments()"
```

---

## Siguiente

→ [LAB-04 Playwright POM](./LAB-04-playwright-pom-typescript.md)  
→ [LAB-05 Rest Assured](./LAB-05-rest-assured-api.md)

**En el chat:** decí *“Lab B06-4, paso 1”* y el instructor pausa en cada checkpoint.
