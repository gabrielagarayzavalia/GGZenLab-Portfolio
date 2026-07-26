# Spike: Pipeline Gmail + match con IA local (Ollama) / LLM

**Estado:** abierto (spike)  
**Origen:** exploratory testing dashboard #313 — match por reglas, muchos 100%, gaps/CV vacíos  
**Relacionado:** [#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297) dual-write · `llm-client.ts` · `3-analyze-match.ts` · applied-list `match-jobs.ts`

---

## 1. Problema

Hoy hay **dos motores de match** sin unificar:

| Camino | Cuándo | Motor | IA |
|--------|--------|-------|-----|
| **Campaña Gmail** (canónico) | `npm run campaign` → applied-list `run-pipeline` | `match-jobs.ts` — regex / cobertura skills | **No** |
| **Hunter scrape+analyze** (opt-in) | `2-scrape-jobs` → `3-analyze-match` | `llm-client.ts` — Ollama / Claude / regex | **Sí** |

La usuaria configuró **Ollama** para análisis CV↔JD local (`LLM_PROVIDER=ollama`, `qwen2.5:1.5b`). Eso **no participa** en el pipeline Gmail que alimenta Excel, Mongo y dashboard.

**Síntomas en dashboard (post #313):**
- Summaries tipo *"Encaje sólido (100%) — CV automation"* (reglas, no LLM).
- Muchos **100%** (54/149 en corrida reciente) — redondeo `covered/total`, no “falso” pero **poco granular**.
- `gaps` / `cvSuggestions` vacíos cuando el perfil cubre todos los requisitos regex.
- `applications.analysis` con skills a veces `null` si el sync no copió arrays (fix parcial en `feature/e2e-dashboard-pipeline`).

---

## 2. Objetivo

Unificar **calidad de análisis** del camino Gmail con la **intención original** (IA local opcional), sin romper campaña offline ni costo cero por defecto.

**Éxito del spike:**
- Decisión de arquitectura (dónde corre el LLM, fallback, flags).
- Estimación de latencia/costo (Ollama ~200ms/job vs batch nocturno).
- POC mínimo: N jobs del pipeline con Ollama → `matched.json` + `analysis` en Mongo con skills/gaps/summary ricos.
- Criterios para reemplazar o complementar regex.

---

## 3. Estado actual (código)

### Hunter — listo para LLM

| Pieza | Path |
|-------|------|
| Cliente | `src/llm-client.ts` — `ollama` \| `anthropic` \| default ollama si no hay API key |
| Analyze | `src/3-analyze-match.ts` — `buildMatchPrompt` + `parseMatchResponse` |
| Regex fallback | `src/regex-matcher.ts` — misma familia que applied-list |
| Env | `LLM_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL` |

### Applied-list — solo reglas

| Pieza | Path |
|-------|------|
| Match campaña | `scripts/match-jobs.ts` — `analyzeJob()`, `fitModifier`, caps dominio |
| Sin `llm-client` | No importa Ollama |

### Persistencia dashboard (B-38-13)

- `applications.analysis` — `AnalysisSnapshot` (description, skills, gaps, cvSuggestions, summary).
- Dual-write pipeline (`pipelineMatchToApplicationInput`) — **debe** recibir salida LLM si migramos.

---

## 4. Opciones de diseño

### A — LLM en applied-list (recomendación preliminar)

Tras scrape, en `match-jobs.ts` o módulo hermano:

```
scrape → matchJobs()
         ├─ LLM_PROVIDER=regex → analyzeJob() actual (default campaña)
         └─ LLM_PROVIDER=ollama|anthropic → analyzeJobLlm(scraped, profile)
```

- Reutilizar prompt/parser de hunter (`match-utils.ts`) vía paquete compartido o copia mínima.
- `matched.json` y Excel sin cambio de forma (`MatchResult` ya tiene skills/gaps/cvSuggestions).

**Pros:** un solo pipeline Gmail; dashboard recibe analysis rico vía dual-write existente.  
**Contras:** latencia campaña; Ollama debe estar up; duplicar/extraer `llm-client` a applied-list o monorepo shared.

### B — Post-proceso en hunter post-pipeline

`run-pipeline` termina → hunter `enrich-matches-llm.ts` lee `matched.json` + `_all.json` → reescribe analysis → `tracker:sync-pipeline`.

**Pros:** no tocar applied-list repo gitignored.  
**Contras:** dos pasos; riesgo de desync Excel vs Mongo si solo se actualiza Mongo.

### C — Híbrido regex + LLM solo borderline

Regex primero; Ollama solo si `65 ≤ match < 85` o flags `industry_review`.

**Pros:** costo/latencia acotados.  
**Contras:** dos scores que explicar en UI.

### D — Mantener regex; mejorar granularidad sin LLM

Afinar `fitModifier`, más requisitos, techo 95%, decimales — **no resuelve** summary/JD semántico.

---

## 5. Preguntas spike (checklist)

- [ ] ¿Default campaña sigue `regex` y Ollama opt-in (`LLM_PROVIDER=ollama`) o al revés?
- [ ] ¿Dónde vive `llm-client` compartido? (hunter export / `packages/llm` / duplicate thin)
- [ ] ¿Batch async? (campaña regex rápida → job nocturno `analyze:pipeline` con Ollama)
- [ ] ¿Modelo default? (`qwen2.5:1.5b` vs `llama3.2:3b` — calidad vs RAM)
- [ ] ¿Feedback rejections en prompt LLM? (hunter ya lo hace en `3-analyze-match`)
- [ ] ¿Umbral 65 pipeline vs 70 dashboard sin cambios?
- [ ] ¿E2E gate con `LLM_PROVIDER=regex` siempre + smoke Ollama manual?

---

## 6. POC sugerido (spike cerrado)

1. Branch `spike/pipeline-ollama-match`.
2. Flag `LLM_PROVIDER=ollama` en applied-list match step (5–10 jobs sample).
3. Comparar lado a lado: regex vs Ollama — `matchPercent`, skills, gaps, summary, tiempo.
4. Dual-write → `curl /api/dashboard/match-jobs` — detalle con skills/gaps visibles.
5. Documentar veredicto: **GO A / GO C / stay regex**.

---

## 7. Fuera de alcance

- Re-análisis masivo de históricos Excel.
- Reemplazar Claude API en hunter scrape path.
- CV/cover letter generator (B-15).

---

## 8. Referencias

- `docs/campaign-flow.md` — tabla “Ollama vs rules”
- `docs/spike-dashboard-analysis-persistence.md` — sync analysis → Mongo
- `README.md` — setup Ollama

**Issue:** [#329 — US-JH-B38-18](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/329)
