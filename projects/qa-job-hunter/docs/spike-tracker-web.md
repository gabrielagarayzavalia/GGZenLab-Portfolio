# Spike B38 — Tracker web-first (desktop grid + mobile lite)

**Epic:** [US-JH-B38-0 #264](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/264)  
**Roadmap producto:** [`tracker-web-first-roadmap.md`](./tracker-web-first-roadmap.md)  
**Rama:** `spike/b38-tracker-web`  
**Fecha:** 2026-07-25  
**Repo:** `GGZenLab-Portfolio/projects/qa-job-hunter`

## TL;DR

| | |
|---|---|
| **Veredicto** | **GO** — viable reemplazar Excel como store canónico con app web-first |
| **1ª grilla** | **AG Grid Community** (MIT) — virtualización, filtros, dropdown Estado nativo |
| **2ª grilla** | **Tabulator** (MIT) — API más simple, menor curva, menos features enterprise |
| **Store** | Mongo colección `applications` (nuevo) — converge dashboard + campaña |
| **PoC** | `npm run dashboard` → `/poc/`, `/poc/ag-grid.html`, `/poc/tabulator.html`, `/m-lite.html` |
| **Schema TS** | `src/types/tracker-application.ts` |

---

## B38-0-01 — Inventario columnas Empleos_Tracker + schema Application

### Columnas hoja `Empleos` (fuente: `qa-job-applied-list/scripts/excel/internal.ts`)

| Col | Letra | Header Excel | Campo `TrackerApplication` | Tipo | Quién escribe |
|-----|-------|--------------|---------------------------|------|---------------|
| 1 | A | Match | `matchPercent` | number (0–100) | Pipeline / usuaria |
| 2 | B | Puesto | `puesto` | string | Pipeline / usuaria |
| 3 | C | Empresa | `empresa` | string | Pipeline / usuaria |
| 4 | D | LinkedIn | `linkedinUrl` | string (URL) | Pipeline |
| 5 | E | Canal | `canal` | enum-ish | Pipeline (`Easy Apply` / `Externo` / `—`) |
| 6 | F | Estado | `estado` | `TrackerEstado` | Bot + usuaria; **Descartado solo usuaria** |
| 7 | G | Fecha aplicación | `fechaAplicacion` | string (ISO/date) | Apply / reconcile / usuaria |
| 8 | H | Portal externo | `portalExterno` | string (URL) | Pipeline / usuaria |
| 9 | I | Próximo paso | `proximoPaso` | string | Bot + usuaria |
| 10 | J | Notas | `notas` | string | **Automatización** (fallos EA, stand-by, hints) |
| 11 | K | Mis comentarios | `misComentarios` | string | **Solo usuaria** (#168 B26) |

### Hoja `meta` (no visible en grilla, embebida en doc)

| Campo meta | Campo Application | Uso |
|------------|-------------------|-----|
| jobId | `jobId` | Dedupe, sync cola Easy Apply |
| gmailId | `gmailId` | Reconcile labels Gmail |
| cvType | `cvType` | Selección CV en apply |
| applyType | `applyType` | easy_apply / external |
| linkedin (key) | índice por URL normalizada | Upsert |

### Estados válidos (`TrackerEstado`)

`Pendiente`, `Stand-by`, `Enviada`, `Borrador abierto`, `A-pendiente`, `A-realizado`, `Cerrado`, `Duplicado`, `Descartado`

Política automatización (existente): `coerceAutomationEstado` nunca escribe `Descartado`; desconocido → `Stand-by` con nota.

### Stores actuales (fragmentados — a unificar)

| Store | Path / colección | Rol hoy | Destino B38 |
|-------|------------------|---------|-------------|
| Excel Desktop | `Empleos_Tracker.xlsx` | **Canónico** | Import/export transición |
| `application-status.json` | `output/application-status.json` | applied / not_applied / not_selected | **Deprecar** → `estado` en Application |
| `jobs-result.json` | `output/jobs-result.json` | Dashboard match view | **Deprecar** → query `applications` + match metadata |
| Mongo `jobs` | colección `jobs` | Scrape/analysis legacy | Mantener para discovery; link por `jobId`/`url` |
| `applications.json` | `output/apply/applications.json` | Log corrida Easy Apply | **Merge** en `applications` Mongo |
| `apply-queue.csv` | `output/apply/apply-queue.csv` | Cola sync Excel | **Reemplazar** por query `estado=Pendiente` |

### Checklist B38-0-01

- [x] Inventario 11 columnas Empleos + hoja meta
- [x] Tipo `TrackerApplication` en `src/types/tracker-application.ts`
- [x] Mapeo política estados (Descartado / Stand-by / Duplicado)
- [x] Identificación stores fragmentados actuales

---

## B38-0-02 — Persistencia canónica + diseño API tracker

### Colección Mongo: `applications`

```typescript
// Índices propuestos (src/db/applications.ts — MVP)
{ jobId: 1 }           // unique sparse
{ linkedinUrl: 1 }     // unique
{ estado: 1, updatedAt: -1 }
{ empresa: 1, puesto: 1 }  // dedupe
{ gmailId: 1 }         // sparse — reconcile
```

Documento: ver `TrackerApplication` en `src/types/tracker-application.ts`.

### API REST (dashboard `serve-dashboard.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/tracker/applications` | Lista con filtros: `?estado=`, `?q=`, `?sort=`, `?page=` |
| `GET` | `/api/tracker/applications/:id` | Una fila |
| `PATCH` | `/api/tracker/applications/:id` | Celda/campo editado (optimistic) |
| `POST` | `/api/tracker/applications` | Alta manual |
| `POST` | `/api/tracker/import/xlsx` | Import one-shot desde .xlsx (transición) |
| `GET` | `/api/tracker/export/xlsx` | Export Excel-compatible (backup) |
| `POST` | `/api/tracker/dedupe` | Dedupe puesto+empresa → Duplicado (opt-in, como `EXCEL_DEDUPE`) |

### Reglas de escritura (server-side)

1. Campo `misComentarios`: solo si `updatedBy=user` o header `X-Tracker-User: 1`.
2. Campo `notas`: automation puede append/overwrite según contexto (misma lógica que Excel writers).
3. `estado=Descartado`: rechazar si `updatedBy≠user`.
4. Filas con `estado` protegido (Enviada, Cerrado, Descartado, Duplicado, Stand-by): automation no pisa salvo reglas explícitas de reconcile.

### Convergencia dashboard + campaña

```text
                    ┌─────────────────────┐
  gmail:fetch ─────►│  run-pipeline       │──► upsert applications
  discover:notif ──►│  (applied-list)     │
                    └──────────┬──────────┘
                               │
  campaign ────────────────────┼──► easy-apply ──► PATCH applications (estado, notas)
                               │
                    ┌──────────▼──────────┐
                    │  Mongo applications  │◄─── PATCH usuaria (grilla / cards)
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        /tracker (desktop)  /m-lite         export .xlsx (backup)
        AG Grid             cards
```

- **Eliminar** dependencia de `/api/results` para tracker (mantener temporalmente para vista match legacy).
- Campaña: reemplazar `sync-empleos-tracker.py import/export` por lectura/escritura directa Mongo (fase 2 MVP).

### Checklist B38-0-02

- [x] Schema `TrackerApplication` + índices propuestos
- [x] Diseño API CRUD + import/export
- [x] Reglas misComentarios / Descartado / automation
- [x] Diagrama convergencia store único

---

## B38-0-03 — PoC desktop AG Grid vs Tabulator + import .xlsx

### Ubicación

`dashboard/poc/` — servido por `npm run dashboard`:

| URL | Archivo |
|-----|---------|
| `/poc/` | `poc/index.html` — hub comparación |
| `/poc/ag-grid.html` | PoC AG Grid Community 33 |
| `/poc/tabulator.html` | PoC Tabulator 6.3 |
| `/m-lite.html` | Vista cards mobile |

### Funcionalidad PoC

- [x] 11 columnas alineadas a Excel
- [x] Dropdown `Estado` (9 valores)
- [x] Edición inline (texto, número match %)
- [x] Link clickeable LinkedIn
- [x] Import `.xlsx` hoja `Empleos` vía SheetJS (mapeo headers case-insensitive)
- [x] Datos demo (`poc/sample-data.js`)

### Comparativa grillas

| Criterio | AG Grid Community | Tabulator |
|----------|-------------------|-----------|
| Licencia | MIT | MIT |
| Bundle (CDN) | ~300 KB | ~150 KB |
| Virtualización filas | Excelente (default) | Buena |
| Dropdown Estado | `agSelectCellEditor` nativo | `editor: "list"` |
| Filtros columna | Built-in potentes | `headerFilter` simple |
| Edición textarea (Notas) | Una línea (MVP ok) | `editor: "textarea"` |
| Curva aprendizaje | Media-alta | Baja |
| Theming dark | `ag-theme-alpine-dark` | `tabulator_midnight` |
| Selección / clipboard | Community limitado | Incluido básico |
| Ecosistema React/Vue | Oficial | Adaptadores community |

### Recomendación

1. **AG Grid Community** — grilla principal desktop: mejor UX tipo Excel a escala (100+ filas), filtros, resize, sort multi-columna sin código extra.
2. **Tabulator** — fallback si el bundle de AG Grid pesa o si preferimos API declarativa más rápida de iterar; suficiente para MVP &lt;200 filas.

### Checklist B38-0-03

- [x] PoC AG Grid con dropdown Estado + import xlsx
- [x] PoC Tabulator equivalente
- [x] Comparativa documentada
- [x] Recomendación 1ª / 2ª librería

---

## B38-0-04 — Wireframe mobile lite (vista cards)

### Diseño (`dashboard/m-lite.html`)

- Header sticky: título + contador
- Chips horizontales: filtro por `Estado` (scroll)
- Cards: puesto, empresa, canal, match %, estado (badge), próximo paso/notas
- Acciones: abrir LinkedIn, ciclar estado (demo)
- **Sin grilla** — misma API futura (`GET /api/tracker/applications?estado=`)

### Responsive

- Mobile-first (`viewport-fit=cover`, safe-area)
- Desktop: cards en columna única max ~480px centrada (aceptable para revisión rápida)

### Checklist B38-0-04

- [x] Wireframe HTML funcional con datos demo
- [x] Filtros por estado
- [x] Card layout con acciones mínimas

---

## B38-0-05 — Plan migración Excel → web + impacto B-23 (#131)

### Fases

| Fase | Alcance | Excel |
|------|---------|-------|
| **0 — Spike** | PoC + diseño (este doc) | Sigue canónico |
| **1 — Dual-write** | Pipeline + easy-apply escriben Mongo **y** Excel | Canónico paralelo |
| **2 — Web primary** | Grilla `/tracker` editable; botonera abre web | Export manual / backup diario |
| **3 — Excel read-only** | Solo import inicial + export on-demand | Deja de ser canónico |
| **4 — Retiro** | Eliminar writers ExcelJS in-place en applied-list | Solo export |

### Script migración inicial (MVP)

```bash
# Propuesto: npm run tracker:import-xlsx
# Lee Desktop canónico → bulk upsert applications (preserva misComentarios)
```

- Dedupe por `normalizeUrl(linkedin)` + fallback `puesto+empresa`
- Hoja `meta` → campos embebidos en documento
- Backup previo: export .xlsx automático a `empleos/backups/`

### Impacto US-JH-B23 (#131 — Excel Desktop canónico)

| Componente B23 | Impacto B38 |
|----------------|-------------|
| `excel-writers.md` / paths Desktop | **Evoluciona** a “export path”; doc deprecación gradual |
| `backupCanonicalExcel` | Reutilizar para export web → Desktop durante dual-write |
| `coerceAutomationEstado` | **Portar** a `src/tracker/estado-policy.ts` (server) |
| `ensureEmpleosSchemaColumns` | Solo export/import; no runtime web |
| Botonera desktop `excel:refresh` | Redirigir a dashboard `/tracker` o `tracker:sync` Mongo |
| `sync-empleos-tracker.py` | **Reemplazar** por API Mongo en fase 2 |
| Política Descartado / Mis comentarios | **Sin cambio** — misma regla en API |

### Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Pérdida datos en migración | Dual-write + backup last.xlsx + export on-demand |
| Excel abierto bloquea sync | Desaparece como problema al retirar in-place write |
| Usuaria acostumbrada a Excel | Export .xlsx idéntico durante fases 2–3 |
| Filtros / CF Excel | Replicar badges color por estado en CSS grilla |

### Checklist B38-0-05

- [x] Fases 0–4 definidas
- [x] Impacto #131 documentado
- [x] Riesgos + mitigaciones

---

## B38-0-06 — Reporte go/no-go + breakdown stories MVP

### Go / No-go

| Pregunta | Respuesta |
|----------|-----------|
| ¿Reemplazar Excel como canónico es viable? | **Sí (GO)** |
| ¿AG Grid/Tabulator cubren UX desktop? | **Sí** — AG Grid 1ª, Tabulator 2ª |
| ¿Mobile usable sin grilla? | **Sí** — cards con misma API |
| ¿Mongo existente sirve? | **Sí** — nueva colección `applications`; `jobs` queda para discovery |
| ¿Bloqueadores? | Ninguno técnico crítico; esfuerzo MVP ~2–3 sprints |

### Stories MVP propuestas (post-spike)

| ID propuesto | Título | Prioridad | Depende |
|--------------|--------|-----------|---------|
| B38-1 | `applications` Mongo + índices + seed desde xlsx | High | Spike |
| B38-2 | API `/api/tracker/*` CRUD + política estados | High | B38-1 |
| B38-3 | Vista `/tracker` desktop (AG Grid) wired a API | High | B38-2 |
| B38-4 | Vista `/m-lite` cards wired a API | Medium | B38-2 |
| B38-5 | Dual-write pipeline applied-list → Mongo | High | B38-2 |
| B38-6 | Dual-write easy-apply → Mongo (reemplazar sync.py) | High | B38-5 |
| B38-7 | Import/export .xlsx (transición) | Medium | B38-2 |
| B38-8 | Deprecar `/api/results` + `application-status.json` | Low | B38-3 |
| B38-9 | Botonera: abrir `/tracker` en lugar de Excel | Low | B38-3 |
| B38-10 | Retiro writers Excel canónico (fase 4) | Low | B38-6, #131 |

### Criterios de éxito MVP

1. Campaña diaria completa sin abrir Excel.
2. Editar Estado / Mis comentarios / Próximo paso desde web (desktop + mobile).
3. Easy Apply actualiza `estado` + `notas` en Mongo.
4. Export .xlsx equivalente al actual para backup.

### Checklist B38-0-06

- [x] Veredicto GO documentado
- [x] 10 stories MVP propuestas
- [x] Criterios de éxito definidos

---

## Cómo probar el spike

```bash
cd projects/qa-job-hunter
npm run dashboard
# Abrir http://localhost:3847/poc/
# Probar import con Empleos_Tracker.xlsx (Desktop)
# Mobile: http://localhost:3847/m-lite.html
```

---

## Referencias

- Excel/schema: `qa-job-applied-list/docs/excel-writers.md`, `scripts/excel/internal.ts`
- Dashboard: `projects/qa-job-hunter/dashboard/`
- Mongo: `projects/qa-job-hunter/src/db/`
- B23: [#131](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/131)
