# QA Job Hunter — Product Owner Backlog

Product: **QA Job Hunter** · Track: **Product Owner (AI Code Assisted)**  
Repo: [`projects/qa-job-hunter/`](.) · Site: [`/product-owner/job-hunter.html`](../../docs/product-owner/job-hunter.html)  
GitHub Issues seed: [`SEED_ISSUES_JOB_HUNTER.md`](../agile/github-projects/SEED_ISSUES_JOB_HUNTER.md)  
**Refined backlog:** [`BACKLOG-REFINED.md`](BACKLOG-REFINED.md) · **Sprint 1:** [`SPRINT-1-PLAN.md`](SPRINT-1-PLAN.md) · GitHub **#35–#67** (superseded #14–#15, #25–#29, #33–#34)

## Published (Done)

| ID | Feature | Deliverables |
|----|---------|--------------|
| P-JH-01 | LinkedIn scrape + session | Playwright login, `2-scrape-jobs.ts`, session persist |
| P-JH-02 | Match analysis | Ollama + Claude via `llm-client.ts`, `3-analyze-match.ts` |
| P-JH-03 | Dashboard web | Split UI, sort by match %, `npm run dashboard` |
| P-JH-04 | Match feedback | Reject incorrect match → `match-feedback.json` → prompt learning |

## Spikes / features Easy Apply (ops)

| ID | Priority | Scope |
|----|----------|--------|
| **EA-SPIKE-01** | Low | *Mark job as a top choice* — hoy no se toca (opcional LinkedIn). Spike: ¿auto-marcar siempre / nunca / por empresa? |
| **EA-SPIKE-02** | Low | *Follow company* — hoy no se toca. Spike: política (seguir siempre / nunca / lista blanca). → [#142](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/142) |
| **EA-SPIKE-03** | Medium | Mapa de **años de experiencia por skill** (SQL, Python, …). **Hecho en código** (`skills-years.ts`); ampliar skills nuevas cuando fallen. |
| **EA-SPIKE-04** | High | **Estrategia campos desconocidos** (Strategy pattern). Política [#154](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/154); tech debt [#156](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/156). Código: `src/apply/unknown-field-strategy.ts`. |

### EA-SPIKE-04 — detalle (política confirmada 2026-07-24 / #154)

| Tipo | Required desconocido | Optional desconocido |
|------|----------------------|----------------------|
| select / listbox | pendiente + Notas + banco → cerrar → siguiente | Notas + banco, seguir |
| text / numeric | idem | idem |
| radio Sí/No | idem (salvo `MY_SKILLS` / reglas) | idem |
| checkbox (Follow, top choice) | no tocar hasta EA-SPIKE-01/02 | no tocar |
| typeahead | reintentos; si falla → pendiente | — |

- **Prod:** no inventar; no postular si falta respuesta required → `pendiente` (revisar y reintentar; no Stand-by por default).
- **Dry-run:** banco + pendiente + continuar; informe final unanswered en chat/consola.
- **Siempre** alta en banco Config sin respuesta (`config-questions.json`) + Notas Excel.
- Código: `unknown-field-strategy.ts`, `questions-store.ts`, runners `easy-apply` / `easy-apply-dry-run`.

## Backlog — execution order

| Order | ID | Priority | Scope |
|-------|-----|----------|--------|
| 2 | **B-06** | High | MongoDB local + persistence + lab QA database |
| 3 | **B-13** | **High — priority** | Multi-source jobs (GetOnBoard, Indeed, …) |
| 4 | B-07 | High | Scheduled agent 3×/day → Mongo (multi-source) |
| 5 | B-08 | Medium | Application tracking + pipeline dates + dashboard UI |
| 5b | B-14 | Medium–High | Web site: home + `/run` + `/dashboard` subpages |
| 5c | **B-17** | Medium | Página de estadísticas de búsqueda laboral |
| 6 | B-15 | Medium | CV upload + tailored CV/cover letter (Ollama / Claude / share) |
| 7 | B-09 | Medium | Generic multi-vertical app (profiles beyond QA) |
| 8 | B-10 | Medium | Monetization research |
| 9 | B-12 | Medium | Multi-user + OAuth (LinkedIn, Google, Facebook) |
| 10 | B-16 | Medium | Cloud deploy (Atlas, hosted app, LLM cloud, cron agent) |
| 11 | B-11 | Low | Tokenized / Web3 PoC (exploratory) |

> **Product decision:** B-13 runs right after MongoDB (B-06). B-07 (agent) runs after B-13 so the scheduler scrapes all enabled sources.

## Backlog detail

### B-06 — MongoDB persistence

- Docker `mongo:7` in compose; collections `analysis_runs`, `jobs`, `skipped_jobs`
- Pipeline persists after analyze; dashboard `GET /api/jobs` from Mongo
- Lab QA: Gherkin, API tests, integration tests, docs subpage

### B-13 — Multi-source jobs (priority)

- `JobSourceAdapter` interface; refactor LinkedIn → adapter
- MVP: GetOnBoard + Indeed AR; `source` badge in dashboard
- B-13a research: ToS per site, rate limits, APIs vs scrape

### B-07 — Scheduled agent

- `scheduled-run.ts`; 3×/day (configurable); dedup new jobs → Mongo
- Windows Task Scheduler + optional `node-cron` for dev
- Depends: B-06 + B-13b/c

### B-08 — Application tracking

- `applicationStatus`, `timeline`, multiple technical interviews
- Dashboard PATCH `/api/jobs/:id`; filters by status
- Estados MVP en dashboard: Aplicado, No aplicado, No seleccionada/o

### B-17 — Página de estadísticas

- Ruta `/stats` (o subpágina del dashboard) con métricas agregadas de la búsqueda
- **Mercado:** evolución de ofertas scrapeadas por fuente/período (¿disminuyen los puestos QA?)
- **Pipeline personal:** CVs enviados, respuestas recibidas, entrevistas realizadas, no seleccionada/o, búsqueda cerrada por puesto
- Gráficos simples (línea/barra) + totales; datos desde Mongo + `application-status.json` / timeline B-08
- Depende de B-06 (persistencia) y B-08 (estados enriquecidos); MVP puede usar JSON local

### B-14 — Web site structure

- `/` home, `/run` manual pipeline, `/dashboard` results, `/cv` stub
- POST `/api/run/*`; shared nav

### B-15 — CV & cover letter

- Upload CV; generate with Ollama / Claude API / claude.ai share mode
- Link to “Mark as applied” (B-08)

### B-09 — Generic profiles

- `search_profiles` in Mongo; configurable terms + profile text per vertical

### B-10 — Monetization research

- Doc: freemium, SaaS, ToS risks, competition — go/no-go only

### B-12 — Multi-user OAuth

- App auth (Google, LinkedIn, Facebook); N LinkedIn accounts per user

### B-16 — Cloud deployment

- Atlas, Railway/Render, LLM cloud, cron agent, secrets

### B-11 — Web3 PoC (exploratory)

- Solidity registry + Rust indexer; testnet only

## GitHub Projects

1. Create issues from [`SEED_ISSUES_JOB_HUNTER.md`](../agile/github-projects/SEED_ISSUES_JOB_HUNTER.md)
2. Labels: `track:po`, `mini-project:job-hunter`, `backlog:B-06`, …
3. Add to project **GGZenLab Portfolio** — group by Epic **EPIC-JH** or filter `track:po`
4. Epics stay in **Iteration: Backlog**; sprint items = stories + PO tasks only

## Issue templates

| Template | Use for |
|----------|---------|
| Epic (Product Owner) | EPIC-JH |
| User Story (Product Owner) | B-06 … B-17, P-JH done stories |
| PO Task | Sub-tasks per story |
