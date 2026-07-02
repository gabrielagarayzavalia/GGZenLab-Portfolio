# LAB-06 — PowerShell esencial para QA

**Tipo:** remediial / tooling  
**Duración:** ~30–40 min  
**Objetivo:** Moverte en terminal Windows con confianza para labs Docker, Node, Maven y CI — sin confundir cmd, bash y PowerShell.

**Cuándo hacerlo:** antes o en paralelo a LAB-01+ si `Get-ChildItem`, `|`, `$env:` te resultan opacos.

---

## Prerrequisitos

- Windows 10/11
- Terminal: PowerShell (o Windows Terminal con pestaña PowerShell)
- Repo clonado (LAB-00 paso 1 OK)

---

## Paso 1/8 — Dónde estoy

```powershell
Get-Location
# alias corto (misma sesión):
pwd
```

**Esperado:** path bajo `GGZenLab-Portfolio`.

Ir al monorepo:

```powershell
Set-Location C:\Users\gabri\projects\GGZenLab-Portfolio
# alias: cd
```

**Checkpoint ✋:** ¿`Get-Location` muestra la raíz del monorepo?

---

## Paso 2/8 — Listar sin ruido

Listar subproyectos:

```powershell
Get-ChildItem projects
# alias: dir, ls (en PS 7+ ls es alias de Get-ChildItem)
```

Solo nombres:

```powershell
Get-ChildItem projects | Select-Object Name
```

Primeras 5 entradas:

```powershell
Get-ChildItem projects | Select-Object Name -First 5
```

**Utilidad:** `Select-Object` **filtra columnas o filas** — salida legible para checkpoints de lab.

**Checkpoint ✋:** ¿ves `qa-job-hunter` y `sql-lab`?

---

## Paso 3/8 — ¿Existe este archivo?

```powershell
Test-Path "projects\qa-job-hunter\package.json"
Test-Path "projects\qa-job-hunter\no-existe.json"
```

**Esperado:** `True` y `False`.

**Utilidad en QA:** verificar fixtures, `output/jobs-result.json`, `.env` antes de correr tests.

**Checkpoint ✋:** ¿ambos resultados correctos?

---

## Paso 4/8 — Pipe `|` (encadenar)

El pipe pasa la **salida** de un comando al **siguiente**:

```powershell
Get-ChildItem projects\qa-job-hunter\src -File | Select-Object Name
```

Contar archivos `.ts` en `src`:

```powershell
(Get-ChildItem projects\qa-job-hunter\src -Filter *.ts).Count
```

**Nota:** `( ... ).Count` ejecuta el comando y toma la propiedad `Count` del array resultante.

**Checkpoint ✋:** ¿cuántos `.ts` hay en `src`?

---

## Paso 5/8 — Variables de entorno (sesión)

```powershell
$env:DASHBOARD_PORT = "3847"
$env:DASHBOARD_PORT
```

Para Mongo (Job Hunter):

```powershell
$env:MONGODB_URI = "mongodb://localhost:27017/qa_job_hunter"
```

**Importante:** valen **solo en esta ventana** de PowerShell. Cerrar terminal = se pierden (salvo que las definas en el sistema).

**Checkpoint ✋:** ¿`$env:DASHBOARD_PORT` devuelve `3847`?

---

## Paso 6/8 — Ejecutar herramientas del stack QA

Desde la raíz del monorepo:

```powershell
cd projects\qa-job-hunter
node --version
npm --version
cd ..\..
docker --version
docker compose version
```

**Esperado:** versiones sin “command not found”.

**Patrón lab:**

```powershell
cd <proyecto>
<comando>
cd ..\..   # volver a raíz si hace falta
```

**Checkpoint ✋:** ¿`node` y `docker` responden?

---

## Paso 7/8 — Capturar salida y errores

Primeras líneas de `docker info`:

```powershell
docker info 2>&1 | Select-Object -First 8
```

- **`2>&1`** — mezcla errores con salida normal (útil si Docker está apagado y querés ver el mensaje)
- **`| Select-Object -First 8`** — recorta (como `head`)

Probar API local (con dashboard arriba):

```powershell
Invoke-RestMethod -Uri "http://localhost:3847/api/jobs" -ErrorAction SilentlyContinue
```

Alias habitual: `curl` en PS 7+ apunta a `Invoke-WebRequest` (distinto a curl de Linux).

**Checkpoint ✋:** ¿entendés para qué sirve `2>&1 | Select-Object -First N`?

---

## Paso 8/8 — Cheat sheet personal

Copiá en tus notas:

| Quiero… | Comando |
|---------|---------|
| Carpeta actual | `Get-Location` |
| Ir a carpeta | `Set-Location path` o `cd path` |
| Listar | `Get-ChildItem` |
| Solo nombres | `...\| Select-Object Name` |
| ¿Existe? | `Test-Path path` |
| Env var | `$env:NOMBRE = "valor"` |
| Contar archivos | `(Get-ChildItem ...).Count` |
| Docker up | `docker compose up -d` |
| Docker estado | `docker compose ps` |

**Definition of Done:**

- [ ] Pasos 1–6 ejecutados
- [ ] Explicás con tus palabras qué hace `|` y `Select-Object`
- [ ] Cheat sheet guardado

---

## PowerShell vs cmd vs bash

| | PowerShell | cmd | bash (Git Bash) |
|---|------------|-----|-----------------|
| Listar | `Get-ChildItem` | `dir` | `ls` |
| Pipe | objetos | texto | texto |
| En labs GGZenLab | **recomendado** | evitar | ok, pero paths distintos |

Usá **un solo tipo** de shell por sesión de lab para no mezclar `$env:FOO` con `export FOO=`.

---

## Ejercicio opcional

Desde `projects\sql-lab`:

```powershell
docker compose up -d
docker compose ps
docker exec qa-sql-lab-postgres psql -U qa -d qa_practice -c "SELECT COUNT(*) FROM jobs;"
```

Une **PowerShell + Docker + SQL** en un solo flujo.

---

## Siguiente

→ Retomar [LAB-00 paso 3](./LAB-00-setup-ggzenlab.md) (`docker info`)  
→ [LAB-01 SQL](./LAB-01-sql-select-join.md)

**En chat:** *“Lab PowerShell, paso N”* — modo instructor.
