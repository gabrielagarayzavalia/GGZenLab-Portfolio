# LAB-01 — SQL: SELECT y JOIN (PostgreSQL en Docker)

**Tipo:** QA data / backend  
**Duración:** ~30–45 min  
**Objetivo:** Escribir queries SQL sobre datos de prueba en Postgres containerizado (como piden los avisos: Docker + SQL).

**Infra:** [`projects/sql-lab/`](../../../projects/sql-lab/)

---

## Prerrequisitos

- LAB-00 completado (Docker OK)
- Cliente SQL: terminal `psql`, **DBeaver**, DataGrip o pgAdmin

---

## Paso 1/7 — Levantar Postgres

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio\projects\sql-lab
docker compose up -d
docker compose ps
```

**Esperado:** `qa-sql-lab-postgres` **healthy**, puerto `5432`.

**Conexión:** `postgresql://qa:qa123@localhost:5432/qa_practice`

**Checkpoint ✋:** ¿healthy?

---

## Paso 2/7 — Entrar a psql

```powershell
docker exec -it qa-sql-lab-postgres psql -U qa -d qa_practice
```

Listar tablas:

```sql
\dt
```

**Esperado:** `companies`, `jobs`, `applications`

**Checkpoint ✋:** ¿ves las 3 tablas?

---

## Paso 3/7 — SELECT básico

**Tu turno** — escribí y ejecutá:

```sql
SELECT id, title, match_percent
FROM jobs
WHERE match_percent >= 80
ORDER BY match_percent DESC;
```

**Esperado:** 3 filas (85, 85, 80).

**Checkpoint ✋:** ¿cuántas filas te devolvió?

---

## Paso 4/7 — INNER JOIN (empresa + empleo)

```sql
SELECT j.title, c.name AS company, j.match_percent
FROM jobs j
INNER JOIN companies c ON c.id = j.company_id
WHERE j.modality = 'Remote'
ORDER BY j.match_percent DESC;
```

**Esperado:** empleos remotos con nombre de empresa (no solo `company_id`).

**Pregunta instructor:** ¿por qué usamos `INNER JOIN` y no solo `jobs`?

**Checkpoint ✋:** ¿la query corre sin error?

---

## Paso 5/7 — LEFT JOIN (empleos sin postulación)

Empleos que **no** tienen fila en `applications`:

```sql
SELECT j.id, j.title, a.status
FROM jobs j
LEFT JOIN applications a ON a.job_id = j.id
WHERE a.id IS NULL;
```

**Esperado:** jobs 4 y 5 (sin application).

**Checkpoint ✋:** ¿entendés la diferencia INNER vs LEFT?

---

## Paso 6/7 — Agregación (GROUP BY)

Postulaciones por estado:

```sql
SELECT status, COUNT(*) AS total
FROM applications
GROUP BY status
ORDER BY total DESC;
```

**Esperado:** 3 filas (`applied`, `not_applied`, `not_selected`).

---

## Paso 7/7 — Puente QA (validar datos post-condición)

Simulá un assert de tester después de “marcar como aplicado”:

```sql
-- ¿Existe application para job_id = 2?
SELECT COUNT(*) = 1 AS should_be_one
FROM applications
WHERE job_id = 2 AND status = 'not_applied';
```

**Definition of Done:**

- [ ] Compose healthy
- [ ] SELECT + WHERE + ORDER BY
- [ ] INNER JOIN y LEFT JOIN explicados con tus palabras
- [ ] GROUP BY ejecutado

---

## Mongo vs SQL (repaso)

| Mongo (Job Hunter) | SQL (este lab) |
|--------------------|----------------|
| `db.jobs.find({...})` | `SELECT ... FROM jobs WHERE ...` |
| documentos anidados | tablas + JOIN |
| Compass / mongosh | psql / DBeaver |

---

## Ejercicio opcional

1. `INSERT` una company nueva + un job con match 90.  
2. `UPDATE` el job id=4 a `Remote`.  
3. Verificá con SELECT.

Reset del dataset:

```powershell
docker compose down -v
docker compose up -d
```

---

## Siguiente

→ [LAB-02 CI/CD](./LAB-02-cicd-github-actions-qa.md) · [LAB-03 Mongo](./LAB-03-b06-4-mongo-qa.md)
