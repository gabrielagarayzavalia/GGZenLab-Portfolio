# LAB-02 — CI/CD para QA Automation (GitHub Actions)

**Tipo:** pipeline / SDLC  
**Duración:** ~45–60 min (primera pasada)  
**Objetivo:** Entender cómo encaja CI/CD en QA Automation: trigger → build → tests → artefactos → (opcional) Pages.

---

## Qué piden en avisos QA Automation

- Docker en pipeline
- Tests automáticos en PR/push
- Reportes / evidencias
- GitHub Actions (frecuente) · Azure DevOps · Jenkins (segundo plano)

Este lab usa **GitHub Actions** (ya tenés repo `GGZenLab-Portfolio`).

---

## Conceptos (5 min lectura)

```text
git push / pull_request
        ↓
   GitHub Actions (workflow YAML)
        ↓
   job: qa-smoke
     ├─ checkout
     ├─ setup Java / Node
     ├─ docker compose up (SUT)
     ├─ mvn test / npm test
     └─ upload report (artifact)
        ↓
   ✅ green check en PR  |  ❌ bloquea merge
```

**Rol QA:** definir *qué* corre en CI, criterios de fallo, evidencias — no solo “el dev configura”.

---

## Paso 1/6 — Explorar el repo

**Acción:** en el monorepo:

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
Get-ChildItem .github\workflows -ErrorAction SilentlyContinue
```

**Esperado:** puede estar vacío o en progreso — el backlog pide extender pipelines.

Abrí en GitHub: **Actions** tab del repo.

**Checkpoint ✋:** ¿ves la pestaña Actions? ¿hay workflows?

---

## Paso 2/6 — Anatomía de un workflow (lectura)

Ejemplo mínimo para QA API (referencia, no tienes que crearlo solo en este paso):

```yaml
name: QA API Smoke
on:
  push:
    branches: [main]
  pull_request:

jobs:
  rest-assured-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"
      - name: Start SUT
        run: docker compose up -d node-api
      - name: Wait for health
        run: npx wait-on http://localhost:3000/health --timeout 60000
      - name: Run tests
        working-directory: projects/api-testing/tests/rest-assured-java
        run: mvn test -Dsut.baseUrl=http://localhost:3000
```

**Pregunta instructor:** ¿qué pasa si el SUT no levanta antes de `mvn test`?

**Checkpoint ✋:** ¿identificás `on`, `jobs`, `steps`?

---

## Paso 3/6 — Correr tests local = lo que CI debe reproducir

Antes de confiar en CI, reproducí local (Lab guides existente):

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
docker compose up -d
cd projects\api-testing\tests\rest-assured-java
mvn test -Dsut.baseUrl=http://localhost:3000
```

**Esperado:** tests pasan localmente.

**Regla de oro:** *CI no arregla un lab roto localmente.*

**Checkpoint ✋:** ¿pass local?

---

## Paso 4/6 — Simular “pipeline” en tu máquina (Docker + script)

Creá un checklist manual (evidencia de lab):

| Step | Comando | OK |
|------|---------|-----|
| SUT up | `docker compose up -d` | ☐ |
| Health | curl `:3000` | ☐ |
| API tests | `mvn test ...` | ☐ |
| Job Hunter API | `npm run test:api` (dashboard up) | ☐ |

**Checkpoint ✋:** marcaste al menos SUT + un test suite?

---

## Paso 5/6 — GitHub: PR y checks

**Acción (cuando haya workflow en repo):**

1. Crear branch `lab/cicd-practice`
2. Push
3. Abrir PR → ver checks en la UI
4. Revisar logs del job fallido (si falla): expand step, leer stacktrace

**Sin workflow aún:** leé [`docs/guides/index.html`](../index.html) Lab 3 CI/CD y el backlog “CI/CD GitHub Actions”.

**Checkpoint ✋:** ¿sabés dónde ver logs de un job fallido en GitHub?

---

## Paso 6/6 — QA mindset en CI/CD

Respondé por escrito (para tu portfolio / entrevista):

1. ¿Qué tests van en **PR** (smoke) vs **nightly** (regresión)?  
2. ¿Por qué **Docker** en CI?  
3. ¿Qué evidencia guardarías (JUnit XML, screenshots, JMeter JTL)?

**Definition of Done:**

- [ ] Reproduciste tests local con SUT en Docker
- [ ] Explicás trigger + jobs + steps
- [ ] Sabés abrir Actions / logs en GitHub

---

## Docker vs Kubernetes (en CI)

| | Docker / Compose | Kubernetes |
|---|------------------|------------|
| CI típico | ✅ `docker compose up` en runner | Clusters para prod |
| QA local | ✅ | minikube opcional avanzado |

---

## Labs relacionados (después)

- Jenkins en Docker (backlog planned)
- Azure Pipelines (backlog planned)
- [LAB-05 Rest Assured](./LAB-05-rest-assured-api.md) — tests que alimentarán CI

---

## Siguiente

→ [LAB-03 Mongo QA Job Hunter](./LAB-03-b06-4-mongo-qa.md)
