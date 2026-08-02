# LAB-12 — Scrum, Kanban y planning (QA en el SDLC)

**Tipo:** proceso / Agile · SDLC  
**Duración:** ~60–90 min (primera pasada)  
**Estado:** guía preparada · practicar en chat con instructor  
**Objetivo:** Usar Scrum/Kanban de forma práctica en un proyecto real (GGZenLab / Job Hunter): backlog, sprint, ceremonias ligeras y trazabilidad AC → tests.

---

## Qué piden en avisos QA / SDET

- Experiencia en metodologías ágiles (Scrum, Kanban)
- Participación en planning, refinamiento, retrospectivas
- Trazabilidad requisitos → casos de prueba → evidencia
- Gestión de defectos y priorización con PO/Dev

Este lab usa **tu repo real** (`GGZenLab-Portfolio`) y GitHub Issues — no un tablero de juguete.

---

## Conceptos (10 min)

| Marco | Cuándo usarlo | En GGZenLab |
|-------|----------------|-------------|
| **Scrum** | Iteraciones fijas (sprint), compromiso por tanda | Sprint-2 / Sprint-3 Job Hunter, label `sprint-3` |
| **Kanban** | Flujo continuo, WIP limits, “pull” | Columnas GitHub Project: Backlog → In progress → Done |
| **Planning** | Qué entra al sprint y por qué | `BACKLOG.md` + issues `#NN` + prioridad `priority:high` |

```text
Épica (#365)
  └── Story (#421 banner)
        └── Tasks / AC
              └── Tests (SMK-V1-* / unit TS)
                    └── Evidencia (PR, screenshot, report)
```

**Rol QA en planning:** preguntar AC testables, riesgos, datos de prueba, “definition of done” con automatización.

---

## Prerrequisitos

- LAB-00 (workspace y paths)
- Acceso al repo `gabrielagarayzavalia/GGZenLab-Portfolio`
- Leer una vez: `projects/qa-job-hunter/BACKLOG.md` y `docs/versionado-ramas.md`

---

## Paso 1/7 — Mapear el tablero actual

**Acción:**

1. Abrí GitHub → **Issues** → filtro `label:sprint-3` + `label:priority:high`
2. Abrí **Projects** (épica #365 si está linkeada)
3. En local: `projects/qa-job-hunter/BACKLOG.md` sección Sprint 3

**Esperado:** lista de stories abiertas/cerradas recientes (#420–#425, #421, #415…).

**Checkpoint ✋:** ¿Cuántas columnas ves en el Project? ¿Coinciden con “high” del backlog local?

---

## Paso 2/7 — Scrum: definir un sprint “de mentira” (15 min)

**Ejercicio:** armá un sprint de **3 stories** solo en papel/chat (no mover issues aún):

| Campo | Tu respuesta |
|-------|----------------|
| **Sprint goal** | Una frase (ej. “Dashboard assessment usable end-to-end”) |
| **Capacity** | Horas o “días efectivos” realistas (TDAH-friendly: pocos ítems) |
| **Stories IN** | 3 issues con # y título |
| **Stories OUT** | Al menos 2 que dejás fuera y **por qué** |
| **DoD** | Qué debe pasar para cerrar (PR mergeado, smoke, doc) |

**Regla PO del monorepo:** primero `priority:high` del sprint; fixes medium después (#211, etc.).

**Checkpoint ✋:** pegá tu tabla sprint goal + 3 stories IN.

---

## Paso 3/7 — Kanban: WIP y flujo

**Acción:** dibujá (o describí) un tablero Kanban mínimo:

```text
| Backlog | Ready | In progress | Review | Done |
```

Para **cada** story IN del paso 2:

- ¿En qué columna está hoy?
- **WIP limit sugerido:** máx. 2 en “In progress” (1 feature + 1 spike/fix)

**Anti-patrón a detectar:** 5 branches abiertas, 3 PRs medio hechos, ningún merge → WIP alto.

**Checkpoint ✋:** ¿Cuál story moverías primero a Done y qué bloquea las otras?

---

## Paso 4/7 — Planning poker ligero (priorización)

**Sin números Fibonacci formales** — usá escala **S / M / L**:

| Issue | Tamaño | Riesgo QA | Dependencias |
|-------|--------|-----------|--------------|
| ej. #421 | M | Bajo (unit tests) | Post #420 |
| ej. #415 | L | Medio (layout UI) | #425 counts |
| ej. #408 | M | Alto (pipeline) | scrape policy |

**Orden final:** dependencias primero, luego valor PO, luego riesgo.

**Checkpoint ✋:** ordená 5 issues high abiertos de mayor a menor prioridad real.

---

## Paso 5/7 — Trazabilidad AC → pruebas

**Acción:** elegí **una** story cerrada (ej. #421) y completá:

| AC del issue | Caso manual | Automatizado hoy | Gap |
|--------------|-------------|------------------|-----|
| Banner con N pendientes | … | `assessment-banner.test.ts` | Postman smoke |
| CTA filtrar | … | — | Playwright futuro |

Fuente AC: body del issue en GitHub.  
Fuentes tests: `projects/qa-job-hunter/tests/`, `qa/v1/smoke-green-path-v1.md`.

**Checkpoint ✋:** ¿Qué AC de esa story **no** tiene test automatizado aún?

---

## Paso 6/7 — Ceremonia express (15 min role-play)

Simulá en chat:

1. **Daily (2 min):** qué hice / qué hago / bloqueo
2. **Refinement (5 min):** tomá issue #391 y agregá 2 AC testables que falten
3. **Retro (3 min):** una cosa que funcionó + una a mejorar (ej. “tests plan no se actualizan solos”)

**Checkpoint ✋:** escribí tu retro en una frase.

---

## Paso 7/7 — Definition of Done (DoD) del portfolio

Propuesta para acordar con PO (podés editarla):

- [ ] Issue con AC claros y label `priority:*`
- [ ] Rama `feature/*` o `fix/*` desde `release/v2`
- [ ] PR pequeño, 1 tema
- [ ] Tests unit/API relevantes en verde
- [ ] Smoke manual o doc en `qa/smoke.md` si aplica
- [ ] `BACKLOG.md` actualizado si cambia estado global
- [ ] No merge directo a `main`

**Evidencia de lab completado:** screenshot o lista del Project + tabla AC→tests del paso 5.

---

## Ejercicio opcional

- Crear **milestone** “Sprint-3-dashboard” en GitHub y asignar 3 issues
- Escribir **3 preguntas de refinement** para #408 (avisos cerrados)

---

## Relacionado

- [LAB-02 CI/CD](./LAB-02-cicd-github-actions-qa.md) — gates en el flujo
- `projects/qa-job-hunter/BACKLOG.md` · `BACKLOG-REFINED.md`
- Reglas repo: `docs/versionado-ramas.md`, `.cursor/rules/git-workflow-main-protegido.mdc`

---

## Para arrancar en chat

> **Lab 12 Scrum/Kanban, paso 1** — modo instructor.
