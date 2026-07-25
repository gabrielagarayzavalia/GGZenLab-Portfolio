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

Dual-write (#297, #298) debe alimentar tracker antes de que dashboard lea solo tracker.

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
