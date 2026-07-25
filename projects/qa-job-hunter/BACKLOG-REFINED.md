# QA Job Hunter — Backlog refinado (PO track)

Fuente de verdad post-refinement. Reemplaza la granularidad de issues #14–#34 (superseded).

**Epic:** EPIC-JH (#9) · **Seed GitHub:** [`SEED_ISSUES_JOB_HUNTER.md`](../agile/github-projects/SEED_ISSUES_JOB_HUNTER.md)  
**Script migración:** [`scripts/refine-job-hunter-issues.ps1`](../../scripts/refine-job-hunter-issues.ps1) · **Sprint 1:** [`SPRINT-1-PLAN.md`](SPRINT-1-PLAN.md)

**GitHub issues (migrados):** stories **#35–#42**, tasks **#43–#67** · superseded **#14, #15, #25–#29, #33, #34**

---

## Jerarquía

```
Epic (EPIC-JH)
  └── Story (1 outcome observable)
        └── Task (1 PR o 1 doc, 1 layer)
              └── Sub-task (opcional, issue hijo con label subtask)
```

| Nivel | Regla | Tamaño |
|-------|-------|--------|
| Story | INVEST; AC = 3–5 bullets que referencian Task IDs | ≤ 1 sprint |
| Task | Una capa: infra, db, api, pipeline, adapter, ui, docs, qa | 0.5–2 días |
| Sub-task | Solo si depende de otra task y no conviene mergear | horas |

**Labels:** `track:po`, `mini-project:job-hunter`, `backlog:B-06`, `layer:*`, `subtask`, `superseded`

---

## Plantilla Task / Sub-task

```markdown
## Meta
| Campo | Valor |
|-------|--------|
| ID | JH-T-B06-2-03 |
| Story | US-JH-B06-2 |
| Layer | db |
| Depends on | JH-T-B06-2-01 |

## Outcome (1 frase)
…

## Scope
- …

## Out of scope
- …

## Definition of Done
- [ ] …

## Verify
comando o paso manual

## Files
- projects/qa-job-hunter/src/…
```

---

## Mapa OLD → NEW (superseded)

### Stories

| Superseded | Nuevo |
|------------|-------|
| #14 US-JH-B06 | US-JH-B06-1, US-JH-B06-2, US-JH-B06-3, US-JH-B06-4 |
| #15 US-JH-B13 | US-JH-B13-0, US-JH-B13-1, US-JH-B13-2, US-JH-B13-3 |

### Tasks

| Superseded | Nuevo |
|------------|-------|
| #25 JH-T-B06-01 | JH-T-B06-1-01 |
| #26 JH-T-B06-02 | JH-T-B06-1-02, JH-T-B06-2-01, JH-T-B06-2-02, JH-T-B06-2-03 |
| (implícito #14) | JH-T-B06-1-03, JH-T-B06-2-04, JH-T-B06-3-01, JH-T-B06-3-02, JH-T-B06-3-03 |
| — | JH-T-B06-1-04 |
| #27 JH-T-B13-01 | JH-T-B13-0-01 |
| #28 JH-T-B13-02 | JH-T-B13-1-01, JH-T-B13-1-02, JH-T-B13-1-03 |
| #29 JH-T-B13-03 | JH-T-B13-2-01 |
| #33 JH-T-B13-04 | JH-T-B13-2-02, JH-T-B13-3-01, JH-T-B13-3-02 |
| #34 JH-T-B13-05 | JH-T-B13-3-03, JH-T-B13-3-04 |
| — | JH-T-B13-2-03 |
| — | JH-T-B06-4-01, JH-T-B06-4-02, JH-T-B06-4-03 |

Tasks #30–#32 (B-07, B-08, B-14) permanecen válidas fuera de Sprint 1; no superseded en este refinement.

### GitHub issue numbers (NEW)

| ID | GitHub |
|----|--------|
| US-JH-B06-1 | #35 |
| US-JH-B06-2 | #36 |
| US-JH-B06-3 | #37 |
| US-JH-B06-4 | #38 |
| US-JH-B13-0 | #39 |
| US-JH-B13-1 | #40 |
| US-JH-B13-2 | #41 |
| US-JH-B13-3 | #42 |
| JH-T-B06-1-01 … 1-04 | #43–#46 |
| JH-T-B06-2-01 … 2-04 | #47–#50 |
| JH-T-B06-3-01 … 3-03 | #51–#53 |
| JH-T-B13-0-01 | #54 |
| JH-T-B13-1-01 … 1-03 | #55–#57 |
| JH-T-B13-2-01 … 2-03 | #58–#60 |
| JH-T-B13-3-01 … 3-04 | #61–#64 |
| JH-T-B06-4-01 … 4-03 | #65–#67 |

---

## Sprint 1 — Orden WIP

```
Paralelo semana 1:
  B06-1-* (infra → client → seed → readme)
  B13-0-01 (spike ToS)

Secuencial:
  B06-2-* → B06-3-*
  B13-1-* → B13-2-* → B13-3-*

Opcional fin sprint / Sprint 2:
  B06-4-* (lab QA)
```

**Dependencias críticas:** B13-1-* requiere B06-2-01 · B13-3-* requiere B06-3-02

---

## Stories refinadas — Sprint 1

### US-JH-B06-1 — Persistencia local Mongo

**Outcome:** Levanto Mongo local, la app conecta y puedo seedear desde JSON existente.

**AC:**
- [ ] JH-T-B06-1-01 — compose mongo:7 + healthcheck
- [ ] JH-T-B06-1-02 — db client + MONGODB_URI
- [ ] JH-T-B06-1-03 — npm run db:seed
- [ ] JH-T-B06-1-04 — README setup Mongo

### US-JH-B06-2 — Write path post-análisis

**Outcome:** Cada analyze persiste run y jobs en Mongo con dedup.

**AC:**
- [ ] JH-T-B06-2-01 — colecciones + índices
- [ ] JH-T-B06-2-02 — saveRun()
- [ ] JH-T-B06-2-03 — upsertJobs() dedup
- [ ] JH-T-B06-2-04 — hook 3-analyze-match.ts

### US-JH-B06-3 — Read path dashboard

**Outcome:** Dashboard lista y ordena empleos desde Mongo vía API.

**AC:**
- [ ] JH-T-B06-3-01 — GET /api/jobs
- [ ] JH-T-B06-3-02 — dashboard app.js → /api/jobs
- [ ] JH-T-B06-3-03 — feedback API compatible Mongo

### US-JH-B06-4 — Lab QA Mongo (opcional Sprint 1 / Sprint 2)

**Outcome:** Lab publicable en portfolio (Gherkin, tests API, docs).

**AC:**
- [ ] JH-T-B06-4-01 — Gherkin feature
- [ ] JH-T-B06-4-02 — tests API GET /api/jobs
- [ ] JH-T-B06-4-03 — subpágina docs EN/ES

### US-JH-B13-0 — Spike ToS multi-fuente

**Outcome:** Doc de riesgo técnico/legal por fuente.

**AC:**
- [ ] JH-T-B13-0-01 — sources-research.md

### US-JH-B13-1 — Contrato adapters + LinkedIn

**Outcome:** LinkedIn scrape usa JobSourceAdapter sin cambiar output.

**AC:**
- [ ] JH-T-B13-1-01 — interface + JobListing.source/externalId
- [ ] JH-T-B13-1-02 — LinkedInAdapter
- [ ] JH-T-B13-1-03 — tests fixture LinkedIn

### US-JH-B13-2 — Fuentes LATAM MVP

**Outcome:** GetOnBoard e Indeed AR devuelven JobListing válido.

**AC:**
- [ ] JH-T-B13-2-01 — GetOnBoardAdapter
- [ ] JH-T-B13-2-02 — IndeedAdapter AR
- [ ] JH-T-B13-2-03 — contract test adapters

### US-JH-B13-3 — Orquestación + UX fuente

**Outcome:** Un run scrapea N fuentes; dashboard muestra y filtra source.

**AC:**
- [ ] JH-T-B13-3-01 — scrape-orchestrator.ts
- [ ] JH-T-B13-3-02 — run-all integración
- [ ] JH-T-B13-3-03 — badge source UI
- [ ] JH-T-B13-3-04 — filtro + ?source= API

---

## Backlog futuro (B-07…B-16) — stories sugeridas

| ID | Stories refinadas | Regla tasks |
|----|-------------------|-------------|
| B-07 | B07-1 headless scheduler · B07-2 Task Scheduler doc · B07-3 badge Nuevos | 1 mecanismo o 1 UI por task |
| B-08 | B08-1 schema+PATCH · B08-2 timeline UI · B08-3 filtros estado | API antes que UI |
| B-14 | B14-1 rutas · B14-2 POST /api/run · B14-3 /run UX | no mezclar spawn + HTML |
| B-15 | B15-1 upload · B15-2 generate API · B15-3 /cv UI | 1 modo LLM por sub-task |
| B-09 | B09-1 profiles schema · B09-2 selector UI · B09-3 prompt param | |
| B-10 | B10-1 monetization-research.md | spike = doc only |
| B-12 | B12-0 research · B12-1 OAuth · B12-2 multi LinkedIn | |
| B-16 | B16-0 research · B16-1 Atlas · B16-2 deploy · B16-3 cron cloud | |
| B-17 | B17-1 métricas mercado · B17-2 pipeline personal · B17-3 UI /stats | API agregados antes que gráficos |
| B-11 | B11-0 research · B11-1 contracts · B11-2 indexer | exploratorio |

Detalle de tasks futuras: ampliar en próximo refinement cuando entren a sprint.

---

## B-38 — Tracker web-first (Sprint 2 · High)

**Story spike:** [#264 US-JH-B38-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/264)  
**Epic:** [#125 EPIC-JH-UI](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/125) · `backlog:B-38`, `layer:ui`, `epic:botonera`, `sprint-2`  
**Docs:** [`docs/tracker-web-first-roadmap.md`](docs/tracker-web-first-roadmap.md) · [`docs/spike-tracker-web.md`](docs/spike-tracker-web.md)

### Visión (registrar en backlog)

1. Fuente canónica futura: API/DB web — no `Empleos_Tracker.xlsx` diario.
2. Desktop: grilla completa (AG Grid CE 1ª; Tabulator 2ª).
3. Mobile: cards lite — misma API.
4. Excel: import inicial, export backup, transición.
5. Unificar dashboard + campaña en un store (no `/api/results` ni lista paralela).
6. A largo plazo supersede [#131 B-23](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/131).
7. B-06: reorientar Mongo a `applications`; no cerrar [#52](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/52) hasta post-spike.

**No mezclar:** [#213 B33-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/213) Grafana.

### Fases

| Fase | Backlog ID | Issue | Prioridad |
|------|------------|-------|-----------|
| Spike | B-38-0 | [#264](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/264) | High (cerrado) |
| MVP desktop | B-38-1 | [#294](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/294) | High — PR [#293](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/293) |
| Mobile lite | B-38-2 | [#295](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/295) | Medium |
| Retiro Excel writers | B-38-3 | [#296](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/296) | High — **Excel legacy oculto (flag), no retirar código** |
| Dual-write pipeline | B-38-5 | [#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297) | High |
| Dual-write EA | B-38-6 | [#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298) | High |
| Import/export xlsx | B-38-7 | [#299](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/299) | Medium |
| Deprecar legacy | B-38-8 | [#300](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/300) | Low |
| Botonera /tracker | B-38-9 | [#301](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/301) | Low |
| Spike dashboard ↔ tracker | B-38-11 | [#305](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/305) | High — cerrado GO · PR [#310](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/310) |
| API match-jobs dashboard | B-38-12 | [#311](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/311) | High — post #297, #312 |
| Schema analysis + matchRejected | B-38-13 | [#312](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/312) | High |
| Wire dashboard lista | B-38-14 | [#313](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/313) | High — post #311 |
| Writes dashboard → tracker | B-38-15 | [#314](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/314) | High — post #312 |
| Sync match-feedback | B-38-16 | [#315](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/315) | Medium — post #314 |
| Shim /api/results | B-38-17 | [#316](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/316) | Low — post #313, parte #300 |

### Spike tasks (canónicos)

| Task | Issue |
|------|-------|
| B38-0-01 Inventario + schema | [#265](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/265) |
| B38-0-02 Persistencia + API | [#281](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/281) |
| B38-0-03 PoC AG Grid vs Tabulator | [#267](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/267) |
| B38-0-04 Wireframe mobile lite | [#269](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/269) |
| B38-0-05 Plan migración + B-23 | [#271](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/271) |
| B38-0-06 Reporte go/no-go | [#273](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/273) |

### Relación backlog existente

| Item | Issue | Regla B-38 |
|------|-------|------------|
| B-08 tracking | #17 | Columnas del tracker web, no store aparte |
| B-14 home | #18 | Home futura = grilla tracker |
| B-06 Mongo | #35–#53 | `applications`; #52 abierto hasta post-spike |
| B-23 Excel canónico | #131 | Dual-write transición → Excel **oculto por flag** (no delete writers) |

### Orden de ejecución

`#264` spike → `#294` MVP → `#305` spike dashboard (GO, PR #310) → `#297` dual-write pipeline → `#298` dual-write EA → `#312` schema → `#311` API match-jobs → `#313` wire dashboard → `#314` writes → `#315` feedback sync → `#316` shim → `#300` deprecar legacy → `#295` mobile (misma API) → `#296` Excel flag.

### Stories post-spike (issues formales)

| ID | Issue | Tasks |
|----|-------|-------|
| B-38-1 | [#294](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/294) | — (MVP en PR #293) |
| B-38-2 | [#295](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/295) | [#302](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/302)–[#304](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/304) |
| B-38-3 Excel legacy (flag) | [#296](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/296) | fase 4 / flag, no delete |
| B-38-5 | [#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297) | — |
| B-38-6 | [#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298) | — |
| B-38-7 | [#299](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/299) | — |
| B-38-8 | [#300](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/300) | — |
| B-38-9 | [#301](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/301) | — |
| B-38-11 Spike dashboard ↔ tracker | [#305](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/305) | [#306](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/306)–[#309](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/309) — cerrado |
| B-38-12 API match-jobs | [#311](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/311) | post #297, #312 |
| B-38-13 Schema analysis | [#312](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/312) | — |
| B-38-14 Wire dashboard | [#313](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/313) | post #311 |
| B-38-15 Writes UI → tracker | [#314](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/314) | post #312 |
| B-38-16 Feedback sync | [#315](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/315) | post #314 |
| B-38-17 Shim /api/results | [#316](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/316) | post #313 · parte #300 |

### B-39 — Feature config centralizado (pre-freemium)

**Story:** [#289 US-JH-B39](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/289) · `priority:medium` · `layer:pipeline`  
**Docs:** [`docs/feature-config-strategy.md`](docs/feature-config-strategy.md) · toggles actuales [`docs/campaign-flow.md`](docs/campaign-flow.md)

**Estado:** **pospuesto** — no implementar hasta cerrar highs sprint-2. [#150 B-25](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/150) cerrada; gate actual = tanda high sprint-2.

**Nivel 3 (freemium gating):** pendiente go/no-go [#225 B-36](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/225) → decidir `planLimits` local vs servicio externo (ver strategy doc).

### B-17 — Página de estadísticas (borrador)

**Outcome:** Veo en una sola pantalla cómo evoluciona el mercado y mi pipeline de postulaciones.

**Métricas mercado:**
- Ofertas nuevas vs. históricas por scrape run (tendencia: ¿bajan los puestos QA?)
- Desglose por fuente (LinkedIn, GetOnBoard, …) cuando B-13 esté activo

**Métricas pipeline:**
- CVs enviados (Aplicado)
- Respuestas recibidas
- Entrevistas realizadas
- No seleccionada/o
- Búsqueda cerrada / puesto ya no disponible

**Stories sugeridas:**
- B17-1 — `GET /api/stats/market` agregados por run/fecha
- B17-2 — `GET /api/stats/pipeline` desde application status + timeline B-08
- B17-3 — UI `/stats` con totales y gráficos (Chart.js o similar)

**Depends on:** B-06 (ideal), B-08 (timeline completo); MVP parcial con JSON local + estados actuales del dashboard.
