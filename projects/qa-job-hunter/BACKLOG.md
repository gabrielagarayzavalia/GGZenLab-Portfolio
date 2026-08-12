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
- **Consumo:** preguntas **answered** en Config → `fill-config-bank.ts` en cada paso EA (select/text/radio).
- Código: `unknown-field-strategy.ts`, `questions-store.ts`, `fill-config-bank.ts`, runners `easy-apply` / `easy-apply-dry-run`.

## Tracker web-first (B-38) — Sprint 2 · High

**Story spike:** [#264 US-JH-B38-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/264) · Epic [#125 EPIC-JH-UI](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/125)  
**Roadmap:** [`docs/tracker-web-first-roadmap.md`](docs/tracker-web-first-roadmap.md) · Spike técnico: [`docs/spike-tracker-web.md`](docs/spike-tracker-web.md)  
**Línea:** `release/v2` · Rama spike: `spike/b38-tracker-web`

| Fase | ID | GitHub | Notas |
|------|-----|--------|-------|
| Spike | B-38-0 | [#264](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/264) + tasks #265–#273 (cerrados) | GO · spike cerrado |
| MVP desktop | B-38-1 | [#294](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/294) | PR [#293](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/293) |
| Mobile lite | B-38-2 | [#295](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/295) | tasks [#302](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/302)–[#304](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/304) |
| Excel legacy (flag) | B-38-3 | [#296](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/296) | oculto default; `OPEN_DESKTOP_EXCEL=1` |
| Dual-write pipeline | B-38-5 | [#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297) | post #294 |
| Dual-write EA | B-38-6 | [#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298) | reemplazar sync.py |
| Import/export xlsx | B-38-7 | [#299](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/299) | server-side |
| Deprecar legacy | B-38-8 | [#300](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/300) | `/api/results` |
| Botonera /tracker | B-38-9 | [#301](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/301) | vs Excel mid-campaña |
| Spike dashboard ↔ tracker | B-38-11 | [#305](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/305) | cerrado GO · PR [#310](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/310) |
| API match-jobs dashboard | B-38-12 | [#311](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/311) | post #297, #312 |
| Schema analysis + matchRejected | B-38-13 | [#312](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/312) | — |
| Wire dashboard lista | B-38-14 | [#313](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/313) | post #311 |
| Writes dashboard → tracker | B-38-15 | [#314](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/314) | post #312 |
| Sync match-feedback | B-38-16 | [#315](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/315) | post #314 |
| Shim /api/results | B-38-17 | [#316](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/316) | post #313 · parte #300 |

## Dashboard recovery (B-38) — Sprint 3 · Epic [#365](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/365)

### Done reciente — assessment filters/counts (2026-08-01)

| ID | GitHub | Notas |
|----|--------|-------|
| B-38-29 | [#420](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/420) | Checkbox + filtro A-pendiente |
| B-38-32 | [#424](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/424) | Checkbox + filtro A-realizado · PR [#427](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/427) |
| B-38-33 | [#425](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/425) | Contadores filtros · PR [#428](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/428) |
| — | PR [#426](https://github.2com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/426) | Filtro A-pendiente por `estado` (desacople Gmail) |

### Planned / spike (puede esperar)

| ID | GitHub | Priority | Notas |
|----|--------|----------|-------|
| B-38-34 | [#429](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/429) | Medium | SPIKE Gmail Realizados → A-realizado; ~15 mails vs count 0 dashboard |
## Botonera web workflow (B-40)

| Fase | Backlog ID | Issue | Notas |
|------|------------|-------|-------|
| Spike workflow completo | B-40-0 | [#318](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/318) | no solo EA · tasks #319–#322 |

**Visión:** API/DB web canónica; Excel solo import/export transición; un store (no `/api/results` paralelo). B-06 Mongo → colección `applications`. **No cerrar** [#52](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/52) jobs UI hasta post-spike.

**Orden:** B-38 spike **antes** de implementar B-08 / B-14 como listas o stores aparte — tracking y home futura viven en el tracker web.

---

## Backlog — execution order

| Order | ID | Priority | Scope |
|-------|-----|----------|--------|
| 1 | **B-38-0** | **High (sprint-2)** | Spike tracker web-first → ver sección arriba |
| 2 | **B-06** | High | MongoDB local + persistence (**reorientar** a `applications` post B-38) |
| 3 | **B-13** | **High — priority** | Multi-source jobs (GetOnBoard, Indeed, …) |
| 4 | B-07 | High | Scheduled agent 3×/day → Mongo (multi-source) |
| 5 | B-08 | Medium | Application tracking — **columnas tracker web**, no store aparte (post B-38 spike) |
| 5b | B-14 | Medium–High | Web site — **home futura puede ser `/tracker`** (post B-38 spike) |
| 5c | **B-17** | Medium | Página de estadísticas de búsqueda laboral |
| 6 | B-15 | Medium | CV upload + tailored CV/cover letter (Ollama / Claude / share) |
| 7 | B-09 | Medium | Generic multi-vertical app (profiles beyond QA) |
| 8 | B-10 | Medium | Monetization research |
| 9 | B-12 | Medium | Multi-user + OAuth (LinkedIn, Google, Facebook) |
| 10 | B-16 | Medium | Cloud deploy (Atlas, Railway/Render, LLM cloud, cron agent) |
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

Spike = doc only (`docs/spike-monetization-research.md`). Entregable: **go/no-go** con 2 opciones priorizadas.

#### Opción A — Freemium (tracker gratis, automatización paga) · **recomendada**

- **Free:** dashboard + tracker web (1 fuente, sin Easy Apply, límite de filas/historial).
- **Pro (~USD 12–19/mes o early-bird anual):** campañas automáticas, multi-fuente (B-13), CV/cover IA (B-15), agente programado (B-07).
- **Demo (backlog / wireframe):** guion + animación en [`docs/demo-guion-animacion.md`](docs/demo-guion-animacion.md); video 60–90 s como hero del landing y CTA “probá gratis”.
- **Métricas de validación:** % signup → activación tracker; % free → trial Pro; churn 30 días.
- **Dependencias técnicas:** B-16 (cloud), B-12 (multi-user/OAuth) antes de cobrar en producción.

#### Opción B — Build in public + lead magnet · **recomendada en paralelo con A**

- **Contenido 2–3×/semana:** métricas reales de búsqueda (ofertas scrapeadas, respuestas, entrevistas) — sin prometer resultados.
- **Canales:** LinkedIn (carrusel + screenshot), X (hilos técnicos), Shorts/Reels (screen recording del dashboard).
- **Lead magnet:** lista de espera Pro + acceso anticipado a demo; early bird cuando salga cloud.
- **Formatos reutilizables:** antes/después del tracker, “1 día en mi pipeline QA”, build log del producto.
- **KPI:** seguidores → clicks demo → emails lista de espera → conversión a Pro post-launch.

#### Research obligatorio (go/no-go)

- **ToS / legal:** LinkedIn automation, scraping multi-fuente (B-13a), responsabilidad del usuario vs SaaS.
- **Competencia:** Teal, Huntr, Simplify, Jobscan — diferencial QA + pipeline end-to-end (scrape → apply → tracker).
- **Alternativas descartadas o fase 2:** kit digital (USD 15–29), licencias bootcamp, done-with-you consultoría.
- **Riesgos:** ban de cuenta LinkedIn, soporte multi-user, expectativa de “te consigo trabajo”.
- **Decisión:** documento con recomendación A+B, pricing tentativo, y fecha mínima de cobro (post B-16).

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
