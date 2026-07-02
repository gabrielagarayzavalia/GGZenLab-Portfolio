# LAB-00 — Setup del entorno GGZenLab

**Tipo:** remediial / onboarding  
**Duración:** ~15–20 min  
**Objetivo:** Verificar que podés trabajar en el monorepo real, con Docker operativo, sin confusión de paths.

---

## Prerrequisitos

- Git instalado
- Node.js 18+
- Docker Desktop instalado (no hace falta MongoDB Community Server ni PostgreSQL nativos)

---

## Paso 1/6 — Confirmar repo real

**Acción:** en PowerShell:

```powershell
Test-Path "C:\Users\gabri\projects\GGZenLab-Portfolio\projects\qa-job-hunter\package.json"
```

**Esperado:** `True`

Si da `False`, cloná o abrí la carpeta correcta:

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
git status
```

**Checkpoint ✋:** ¿`True` y estás en branch `main` (u otra feature branch)?

---

## Paso 2/6 — Cursor / workspace

**Acción:** en Cursor → **File → Open Folder** →  
`C:\Users\gabri\projects\GGZenLab-Portfolio` (raíz del monorepo, no solo un subfolder suelto).

**Por qué:** el agente y las rutas de `docker compose`, `docs/` y `projects/` asumen la raíz.

Si tu sesión muestra `QA-portfolio\...`, está bien **si** el código vive en `GGZenLab-Portfolio` — usá siempre el path real para comandos.

**Checkpoint ✋:** ¿abrís terminal en el monorepo y ves `projects\qa-job-hunter`?

---

## Paso 3/6 — Docker Desktop encendido

**Acción:**

```powershell
docker info
```

**Esperado:** versión del Client (sin error de `dockerDesktopLinuxEngine`).

Si falla: abrí **Docker Desktop**, esperá ícono verde, reintentá.

**Checkpoint ✋:** ¿`docker info` responde sin error?

---

## Paso 4/6 — Smoke test Mongo (Job Hunter)

**Acción:**

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio\projects\qa-job-hunter
docker compose up -d
docker compose ps
```

**Esperado:** servicio `mongo`, estado **healthy**, puerto `27017`.

**Checkpoint ✋:** ¿healthy?

---

## Paso 5/6 — Smoke test SUTs API (opcional pero recomendado)

**Acción:** desde la raíz del monorepo:

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
docker compose up -d
curl http://localhost:3000/health
```

**Esperado:** respuesta OK del Node API (o revisá Swagger en `:3000/api-docs`).

**Checkpoint ✋:** ¿algún SUT responde?

---

## Paso 6/6 — Mapa mental de paths

Anotá (o screenshot):

| Qué | Dónde |
|-----|--------|
| Monorepo | `GGZenLab-Portfolio/` |
| Job Hunter | `projects/qa-job-hunter/` |
| Labs instructor | `docs/guides/labs/` |
| SQL lab | `projects/sql-lab/` |
| Mongo compose | `projects/qa-job-hunter/docker-compose.yml` |
| SUTs compose | raíz `docker-compose.yml` |

**Definition of Done:** Pasos 1, 3 y 4 OK. Anotaste el path real.

---

## Ejercicio opcional

```powershell
docker exec qa-job-hunter-mongo mongosh qa_job_hunter --quiet --eval "db.getCollectionNames()"
```

**Esperado:** `['analysis_runs','jobs','skipped_jobs']` (si ya corriste `npm run db:seed`).

---

## Siguiente lab

→ [LAB-01 SQL](./LAB-01-sql-select-join.md) o [LAB-03 Mongo QA](./LAB-03-b06-4-mongo-qa.md)
