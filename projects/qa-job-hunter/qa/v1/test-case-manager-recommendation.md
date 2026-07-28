# Recomendación — Test Case Manager (Job Hunter v1)

**Fecha:** 2026-07-28 · **Scope:** green path v1 · **Sin testids** (fase 6 aparte)

## TL;DR

**Recomendación:** **Markdown + Gherkin en el repo** como fuente de verdad, **GitHub Issues/Projects** para seguimiento de ejecución, y **Postman** solo para APIs exploratorias. Evitar TestRail/Qase en v1.

---

## Opciones comparadas

| Criterio | GitHub Issues/Projects | Postman (Collections) | TestRail-like free (Qase, TestLink) | Markdown + Gherkin en repo |
|----------|------------------------|----------------------|-------------------------------------|----------------------------|
| **Costo** | Gratis (repo existente) | Gratis (límite requests/runner) | Free tier limitado / self-host pesado | Gratis |
| **Vive en el monorepo** | Parcial (issues en GH) | No (app externa) | No | **Sí** |
| **TDAH-friendly** | Medio — muchos clicks, labels | Medio — otra app | Bajo — curva + otro login | **Alto** — un lugar, IDs fijos, diff en PR |
| **Trazabilidad AC → test** | Manual (links en body) | Tests en collection | Campos custom | **Gherkin tags + IDs SMK/REG** |
| **Automatización** | No ejecuta tests | Newman CLI | Integraciones pagas | **npm scripts + tests/** |
| **Colaboración agente** | Buena vía `gh` | JSON importable | API limitada | **Excelente** — agentes leen/escriben md |
| **Curva de setup** | Baja | Baja | Media-alta | **Muy baja** (ya existe `qa/`, `gherkin/`) |
| **Historial de ejecución** | Comments/checklists | Run history | Built-in | Manual en reportes / CI logs |
| **API manual** | No | **Excelente** | No | Postman complementa |

---

## Detalle por opción

### 1. GitHub Issues/Projects

**Pros:** Ya usás el backlog (`#311`, B-38, sprint-2). Labels `qa`, `smoke`, `regression`. Checklists en el issue del PR.

**Contras:** No es un TCM real — los pasos se duplican o quedan en links rotos. Difícil ver matriz manual vs automatizado.

**Uso recomendado:** **Tracking de ejecución** (quién corrió smoke hoy, bloqueadores), no almacén de casos.

### 2. Postman

**Pros:** Ideal para `GET /api/health`, `match-jobs`, writes con headers. Collection versionada en `qa/v1/postman/`. Newman en CI futuro.

**Contras:** UI tests y campaña LinkedIn no van acá. Otro contexto mental.

**Uso recomendado:** **Capa API manual + smoke HTTP** complementaria.

### 3. TestRail-like free (Qase.io, TestLink, Kiwi TCMS)

**Pros:** Campos formales, reportes bonitos.

**Contras:** Otro login, sync con repo manual, free tier limitado, **fricción TDAH** (¿dónde está el caso verdadero?). Overkill para solopreneur + agentes.

**Uso recomendado:** **No en v1.** Reevaluar si el equipo crece o hay auditoría externa.

### 4. Markdown + Gherkin en repo ✅

**Pros:**
- Patrón ya iniciado: `qa/smoke.md`, `qa/integration.md`, `gherkin/mongo-persistence.feature`
- IDs estables (`SMK-V1-NN`, `REG-V1-NN`) — fácil de citar en chat
- PRs revisan casos junto al código
- Agentes (`qa-automation`, `implementador`) leen el mismo archivo

**Contras:** Sin dashboard de ejecución nativo (mitigar con Issues + `REPORT-*.md`).

**Uso recomendado:** **Fuente de verdad canónica.**

---

## Modelo híbrido propuesto (TDAH-friendly)

```
qa/v1/
├── smoke-green-path-v1.md      ← casos + columna automatizado
├── regression-green-path-v1.md
├── automation-coverage-matrix.md
└── postman/                    ← API manual

gherkin/                        ← escenarios BDD legibles (Mongo, pipeline)

GitHub Issue (template)           ← "Ejecución smoke YYYY-MM-DD" con checklist SMK-V1-*
tests/ + npm run test:*           ← automatización real
```

### Ritual mínimo (≤10 min)

1. Antes de merge: correr `npm run test:api` + `npm run test:match-jobs` (smoke automatizado).
2. Post-merge release: checklist manual `SMK-V1-*` en issue o `local/reports/`.
3. API exploratoria: importar Postman collection una vez; no re-importar salvo cambio de endpoints.

### Template issue de ejecución (copiar en GH)

```markdown
## Smoke v1 — {{fecha}}
- [ ] SMK-V1-01 Health
- [ ] SMK-V1-02 Match-jobs
- [ ] …
**Resultado:** pass / fail · **Notas:**
```

---

## Decisión final

| Rol | Herramienta |
|-----|-------------|
| **Definición de casos** | `qa/v1/*.md` + `gherkin/*.feature` |
| **API manual** | Postman (`qa/v1/postman/`) |
| **Ejecución automatizada** | `tests/` + `npm run test:*` |
| **Seguimiento sprint** | GitHub Issues/Projects (checklists) |
| **NO usar en v1** | TestRail, Qase, spreadsheets paralelos |

**Por qué:** Un solo lugar en el repo reduce context switching; los agentes y PRs comparten el mismo artefacto; Postman e Issues cubren los gaps sin otra suscripción.
