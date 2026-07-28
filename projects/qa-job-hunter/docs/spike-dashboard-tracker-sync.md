# Spike: Dashboard Empleos con match ↔ Tracker (B-38-11)

**Story:** [#305 US-JH-B38-11-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/305)  
**Estado:** abierto (spike)  
**Relacionado:** [#300 B-38-8](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/300) deprecar `/api/results`

---

## 1. Inventario gaps (borrador pre-spike)

### Solo en dashboard (`JobMatch` / `jobs-result.json`)

| Campo / feature | Notas |
|-----------------|-------|
| `description` (JD completo) | Panel detalle izquierdo |
| `location`, `modality`, `datePosted` | Metadata scrape |
| `matchedSkills`, `gaps`, `cvSuggestions`, `summary` | Análisis LLM |
| `searchTerm`, `source`, `externalId` | Multi-source B-13 |
| Filtro **Match incorrecto** | `match-feedback.json` (reject) |
| Filtros **Aplicados / No aplicados / No seleccionada/o** | `application-status.json` (`applied` / `not_applied` / `not_selected`) |
| Filtro **Sin clasificar** | Sin entrada en application-status |

### Solo en tracker (`TrackerApplication`)

| Campo / feature | Notas |
|-----------------|-------|
| `estado` (`TrackerEstado`) | 9 estados Excel-like |
| `canal`, `fechaAplicacion`, `portalExterno`, `proximoPaso` | Flujo apply |
| `notas` (bot) vs `misComentarios` (usuaria) | Política #168 |
| `cvType`, `applyType` | EA / pipeline |
| `gmailId` | Reconcile email |
| `updatedBy` | Auditoría write |

### Overlap parcial

| Dashboard | Tracker | Gap |
|-----------|---------|-----|
| `title` | `puesto` | Nombre distinto, mismo dato |
| `company` | `empresa` | Idem |
| `url` | `linkedinUrl` | Idem |
| `matchPercent` | `matchPercent` | OK |
| `id` | `id` / `jobId` | Tracker usa jobId LinkedIn cuando existe |

---

## 2. Mapeo filtros dashboard → tracker (hipótesis)

| Filtro dashboard | Hipótesis tracker | Pendiente spike |
|------------------|-------------------|-----------------|
| Sin clasificar | `Pendiente` o sin fila en applications | ¿Umbral match 70%+ crea fila automática? |
| Aplicados | `Enviada`, `A-realizado` | ¿Incluir `Borrador abierto`? |
| No aplicados | `Pendiente`, `Stand-by` | Sin estado “no aplicado” explícito |
| No seleccionada/o | `Cerrado` + nota? | No hay estado 1:1 |
| Match incorrecto | ¿`Stand-by` + nota? / campo `rejectedMatch` | Feedback hoy no toca tracker |

**Política:** bot nunca `Descartado`; usuaria sí en tracker.

---

## 3. Diseño retroalimentación (opciones)

### Opción A — Híbrido (recomendación preliminar)

- **Lista** dashboard: `GET /api/tracker/applications` filtrado por `matchPercent >= 70` (o flag `inMatchList`).
- **Detalle** análisis: join con colección `jobs` Mongo o snapshot en tracker (`analysisSnapshot`).
- **Acciones:** PATCH tracker (`estado`, `notas`) en lugar de `application-status.json`.

### Opción B — Tracker todo-en-uno

- Extender `TrackerApplication` con campos análisis (skills, gaps, summary, description).
- Pros: un store; Cons: documentos grandes, duplicación con `jobs`.

### Opción C — Mantener jobs-result para detalle

- Lista desde tracker; detalle sigue en `/api/results` por jobId.
- Cons: no cumple objetivo un store (#300).

---

## 4. Cómo el dashboard modifica el tracker

| Acción UI hoy | Write hoy | Write propuesto |
|---------------|-----------|-----------------|
| Marcar aplicado | PATCH application-status | PATCH tracker `estado=Enviada`, `fechaAplicacion` |
| No aplicado | application-status | `Pendiente` o `Stand-by` + nota |
| No seleccionada/o | application-status | `Cerrado` + `proximoPaso`/`notas` |
| Reject match | match-feedback.json | `Stand-by` + nota **o** `rejectedMatch: true` (nuevo campo) |

Dual-write ([#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297), [#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298)) debe alimentar tracker antes de que dashboard lea solo tracker.

## B38-11-04 (#309) — Go/no-go + breakdown implementación

### Go / No-go

| Pregunta | Respuesta |
|----------|-----------|
| ¿Lista dashboard puede leer solo tracker? | **Sí**, con filtro match≥70 + campos derivados |
| ¿Detalle JD/análisis sin jobs-result? | **Sí**, vía `analysis` snapshot en application (opción A) |
| ¿Filtros actuales mapeables a TrackerEstado? | **Sí**, con flag `matchRejected` aparte |
| ¿Política Descartado respetada? | **Sí** — reject → Stand-by + flag, nunca Descartado por bot |
| ¿Bloqueadores? | Dual-write #297 debe existir antes de cutover; sin eso dashboard quedaría vacío post-analyze |

**Veredicto: GO** para opción A. **#300 puede arrancar después de B-38-12 + B-38-14** (con shim temporal opcional).

### Stories implementación (B-38-12+)

| ID | Título | Prioridad | Depende de | Issue |
|----|--------|-----------|------------|-------|
| **B-38-12** | API `GET /api/dashboard/match-jobs` (join tracker + analysis) | High | #297 (datos) | [#311](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/311) |
| **B-38-13** | Extender schema `applications`: `analysis`, `matchRejected`, flags | High | — | [#312](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/312) **implementado** — tipos + Mongo + índices |
| **B-38-14** | Wire `dashboard/app.js` → nueva API (lista + detalle) | High | #311 | [#313](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/313) |
| **B-38-15** | Writes dashboard → tracker (reemplazar application-status) | High | #312 | [#314](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/314) — en rama `feature/b38-15-dashboard-writes` |
| **B-38-16** | Sync `match-feedback` ↔ `matchRejected` + analyze lee Mongo | Medium | #314 | [#315](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/315) |
| **B-38-17** | Shim deprecación `/api/results` → match-jobs | Low | #313 | [#316](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/316) |

**Ya en backlog (orden relativo):**

| Issue | Rol |
|-------|-----|
| [#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297) | Dual-write pipeline — **prerrequisito datos** |
| [#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298) | Dual-write EA — alinea `Enviada` |
| [#300](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/300) | Deprecar legacy — **después** B-38-12…15 |
| [#295](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/295) | Mobile lite — misma API match-jobs post B-38-12 |

### Orden sugerido actualizado

```
#297 dual-write pipeline
    ↓
#298 dual-write EA
    ↓
#312 schema → #311 API match-jobs → #313 wire dashboard → #314 writes
    ↓
#315 feedback sync (puede solapar con #314)
    ↓
#300 deprecar /api/results (+ #316 shim)
    ↓
#295 mobile lite (misma API)
```

### Criterios de aceptación #305 — checklist

- [x] Inventario campo a campo completo (#306)
- [x] Tabla mapeo filtros ↔ TrackerEstado + edge cases (#307)
- [x] Diseño read/write + diagramas + contrato API (#308)
- [x] Go/no-go + breakdown B-38-12…17 (#309)
- [x] Spike only — sin cambios productivos en `app.js`

### Schema B-38-13 (#312) — listo para #311

Campos opcionales en `applications` (docs legacy sin ellos → API devuelve `matchRejected: false`, `inLatestAnalysis: false`):

- `analysis?: AnalysisSnapshot` — detalle JD/análisis embebido (opción A híbrida)
- `matchRejected`, `matchRejectedReason`, `matchRejectedAt`, `inLatestAnalysis`

Tipos: `src/types/dashboard-match.ts`, `src/types/tracker-application.ts`.  
Índices: `matchRejected+estado+matchPercent`, `inLatestAnalysis+matchPercent`.  
Filtros API: `GET /api/tracker/applications?matchRejected=&inLatestAnalysis=&minMatchPercent=`.

Verificación: `npm run qa:smoke-b38-13` · `npm run test:tracker`.

### API B-38-12 (#311) — `GET /api/dashboard/match-jobs`

Implementado en `src/dashboard/match-jobs.ts` + route en `serve-dashboard.ts`.

| Query | Criterio |
|-------|----------|
| *(sin filter)* | Todos los visibles (match≥70 base + históricos) |
| `filter=rejected` | `matchRejected === true` |
| `filter=applied` | `Enviada`, `A-realizado`, `Borrador abierto` |
| `filter=not_applied` | `Stand-by` sin reject |
| `filter=not_selected` | `Cerrado` |
| `filter=unmarked` | Sin reject + sin clasificación aplicación |

**Umbral lista dashboard:** `70` (`DASHBOARD_MIN_MATCH`). Sync pipeline #297 sigue en **65** — no mezclar.

**Envelope** (compatible `dashboard/app.js` ~L567): `scrapedAt`, `totalAnalyzed`, `matchedJobs`/`jobs`, `feedback`, `applicationStatus`.

**Fallback:** sin `analysis` en application → join colección `jobs` por `url`/`jobId`.

Verificación: `npm run test:match-jobs` · `curl http://localhost:3847/api/dashboard/match-jobs`

**Siguiente:** [#314](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/314) writes dashboard → tracker · **NO** deprecar `/api/results` aún (#316/#300).

**#313 wired:** `dashboard/app.js` consume `GET /api/dashboard/match-jobs` (sin `mergeJobsWithStoredState` en cliente).

---

## 5. Tasks spike

| Task | Issue |
|------|-------|
| Inventario gaps | [#306](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/306) |
| Mapeo estados + feedback | [#307](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/307) |
| Diseño read/write | [#308](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/308) |
| Reporte + breakdown | [#309](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/309) |

---

## 6. Go/no-go (pendiente)

- [ ] Opción A/B/C elegida
- [ ] Stories implementación (ej. B-38-12 wire dashboard, B-38-13 schema)
- [ ] #300 puede proceder
