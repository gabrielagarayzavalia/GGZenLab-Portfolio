# LAB-06 — PowerShell esencial para QA

**Tipo:** remediial / tooling  
**Duración:** ~40–50 min  
**Objetivo:** Moverte en terminal Windows con confianza para labs Docker, Node, Maven y CI — sin confundir cmd, bash y PowerShell.

**Cuándo hacerlo:** antes o en paralelo a LAB-01+ si `Get-ChildItem`, `|`, `$env:` te resultan opacos.

---

## Prerrequisitos

- Windows 10/11
- Terminal: PowerShell (o Windows Terminal con pestaña PowerShell)
- Repo clonado (LAB-00 paso 1 OK)

---

## Paso 1/9 — Dónde estoy

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

## Paso 2/9 — Listar sin ruido

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

## Paso 3/9 — ¿Existe este archivo?

```powershell
Test-Path "projects\qa-job-hunter\package.json"
Test-Path "projects\qa-job-hunter\no-existe.json"
```

**Esperado:** `True` y `False`.

**Utilidad en QA:** verificar fixtures, `output/jobs-result.json`, `.env` antes de correr tests.

**Checkpoint ✋:** ¿ambos resultados correctos?

---

## Paso 4/9 — Pipe `|` (encadenar)

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

## Paso 5/9 — Variables de entorno (sesión)

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

## Paso 6/9 — Ejecutar herramientas del stack QA

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

## Paso 7/9 — Capturar salida y errores

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

## Paso 8/9 — Cheat sheet personal

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
| ¿Quién usa el puerto? | ver Paso 9 |
| Liberar puerto | ver Paso 9 |

**Definition of Done (hasta paso 8):**

- [ ] Pasos 1–7 ejecutados
- [ ] Explicás con tus palabras qué hace `|` y `Select-Object`
- [ ] Cheat sheet guardado

---

## Paso 9/9 — Puertos: encontrar quién escucha y liberarlos

**Cuándo te sirve:** error `EADDRINUSE`, dashboard duplicado, `npm run dashboard` que no arranca, o querés saber si Mongo (`27017`) / Postgres (`5432`) están activos.

**Puertos del portfolio (referencia):**

| Servicio | Puerto |
|----------|--------|
| Job Hunter dashboard | `3847` (default) |
| Mongo (Job Hunter) | `27017` |
| Postgres (sql-lab) | `5432` |
| Node SUT (API testing) | `3000` |

Practicá con **`3847`** (dashboard). Hacé **un sub-paso por vez** como en el chat instructor.

### Paso 9a — ¿Está abierto el puerto?

```powershell
Get-NetTCPConnection -LocalPort 3847 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess
```

**Esperado si hay dashboard:**

- `State: Listen`
- `LocalPort: 3847`
- `OwningProcess: <número>` (= PID)

**Si no devuelve nada:** nadie escucha en 3847 (puerto libre).

**Alternativa clásica (funciona en cmd también):**

```powershell
netstat -ano | findstr ":3847"
```

La última columna de `netstat` es el **PID**.

**Checkpoint ✋ (9a):** ¿hay fila `Listen` / `LISTENING` o está vacío?

---

### Paso 9b — ¿Qué proceso es?

Reemplazá `PID` por el número de `OwningProcess` (paso 9a):

```powershell
Get-Process -Id PID | Select-Object Id, ProcessName, Path
```

**Esperado (dashboard Node):** `ProcessName` suele ser `node`.

Todo en una línea (puerto 3847):

```powershell
$p = (Get-NetTCPConnection -LocalPort 3847 -State Listen).OwningProcess
Get-Process -Id $p | Select-Object Id, ProcessName
```

**Checkpoint ✋ (9b):** ¿qué `ProcessName` te salió?

---

### Paso 9c — Cerrar / liberar el puerto

Elegí **una** estrategia según el caso:

#### 1. Proceso en **esta terminal** (foreground)

`npm run dashboard` corriendo ahí → **`Ctrl+C`** en esa ventana.

#### 2. Proceso Node “colgado” (background u otra ventana)

```powershell
Stop-Process -Id PID -Force
```

O por puerto (PowerShell):

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3847 -State Listen).OwningProcess -Force
```

**Cuidado:** `-Force` mata el proceso sin preguntar. Usá solo el PID que verificaste en 9b.

#### 3. Servicio **Docker** (Mongo, Postgres, SUTs)

No uses `Stop-Process` sobre Docker Desktop. Bajá el compose del proyecto:

```powershell
# Mongo Job Hunter
Set-Location C:\Users\gabri\projects\GGZenLab-Portfolio\projects\qa-job-hunter
docker compose down

# Postgres sql-lab
Set-Location C:\Users\gabri\projects\GGZenLab-Portfolio\projects\sql-lab
docker compose down

# SUTs API (raíz monorepo)
Set-Location C:\Users\gabri\projects\GGZenLab-Portfolio
docker compose down
```

#### 4. **Evitar** el conflicto — otro puerto

```powershell
$env:DASHBOARD_PORT = "43847"
npm run dashboard
```

**Checkpoint ✋ (9c):** volvé a correr 9a — ¿puerto 3847 ya libre?

---

### Cheat sheet — puertos

| Quiero… | Comando |
|---------|---------|
| ¿Quién escucha en 3847? | `Get-NetTCPConnection -LocalPort 3847 -State Listen` |
| PID → nombre | `Get-Process -Id PID` |
| netstat + findstr | `netstat -ano \| findstr ":3847"` |
| Matar por PID | `Stop-Process -Id PID -Force` |
| Matar lo que usa 3847 | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3847 -State Listen).OwningProcess -Force` |
| Bajar Mongo/Postgres | `docker compose down` (en la carpeta del compose) |
| Otro puerto dashboard | `$env:DASHBOARD_PORT = "43847"` |

**Definition of Done (lab completo):**

- [ ] Pasos 1–8 + 9a–9c
- [ ] Encontraste PID de un puerto y lo liberaste (o usaste otro puerto)
- [ ] Sabés cuándo usar `Stop-Process` vs `docker compose down` vs `Ctrl+C`

**Nota:** `Get-NetTCPConnection` requiere PowerShell en Windows; si falla por permisos, usá `netstat -ano`.

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
