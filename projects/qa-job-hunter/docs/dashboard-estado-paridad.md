# Dashboard — paridad estado detalle ↔ filtros lista ↔ tracker

Epic [#365](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/365) · Issue [#373](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/373)

## Layout (#415)

Tres columnas en desktop: **sidebar filtros (izq)** · **detalle (centro)** · **lista empleos (der)**.

- Sidebar (`data-testid="dash-sidebar-filters"`): checkboxes de filtro lista (incl. Duplicado). Solo afectan visibilidad en la lista; no escriben al tracker.
- Detalle: checkboxes **Postulación** guardan estado (`application-writes`). Hint `dash-detail-write-hint` aclara la distinción.
- Lista: título, orden, dropdowns empresa/puesto (#402/#425 counts).

En mobile (`max-width: 900px`) la sidebar de filtros va arriba en fila envolvente; lista y detalle conservan el stack previo.

## Tabla canónica

| Filtro lista (checkbox) | Detalle (checkbox postulación) | Tracker `estado` / fuente |
|-------------------------|--------------------------------|---------------------------|
| Sin clasificar | — (ninguno marcado) | `Pendiente` / null |
| Aplicados | Aplicado | `Enviada`, `A-realizado`, `Borrador abierto` |
| No aplicados | No aplicado | `Stand-by` |
| No seleccionada/o | No seleccionada/o | `Cerrado` (marcado por la usuaria) |
| Assessment pendiente | Assessment pendiente (checkbox solo con señal Gmail) | tracker `A-pendiente` |
| A-realizado | Assessment realizado (checkbox solo en `A-pendiente`) | tracker `A-realizado` |
| Match incorrecto | disclosure «¿Match incorrecto?» | `matchRejected` (no es checkbox de postulación) |
| Cerrado | badge **Cerrado** (solo lectura) | `jobClosed` / `acceptingApplications: false` en LinkedIn |

### Dos significados de «Cerrado» en el producto

- **Cerrado (LinkedIn)** — filtro lista «Cerrado», badge en lista/detalle: el aviso ya no acepta postulaciones; **no llegaste a aplicar**. Checkboxes de postulación deshabilitados.
- **No seleccionada/o** — checkbox en detalle: vos marcaste que no te seleccionaron; en tracker escribe `estado: Cerrado`. Es **después** del proceso de postulación.

En UI el badge corto es **Cerrado** (LinkedIn). En tracker Excel/Mongo, `estado: Cerrado` solo lo setea «No seleccionada/o» desde el dashboard.

## Implementación en código

| Capa | Archivo | Funciones clave |
|------|---------|-----------------|
| Lectura / filtros server | `src/dashboard/match-jobs.ts` | `deriveApplicationStatus`, `matchesDashboardFilter`, `isLinkedInJobClosed` |
| Señal Gmail assessment | `src/tracker/gmail-assessment-label.ts` | `hasGmailAssessmentPendingSignal`, `gmailAssessmentPendingProximoPaso`, `gmailAssessmentDoneProximoPaso` |
| Writes tracker | `src/dashboard/application-writes.ts` | `patchForApplicationStatus`, `patchForRejectMatch` ([#348](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/348)) |
| UI dashboard | `dashboard/app.js` | `saveApplicationStatus`, `enableFilterForApplicationStatus`, `enableFilterForRejected` |

## Writes desde el dashboard ([#348](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/348))

| Acción en detalle | PATCH tracker |
|-------------------|---------------|
| Aplicado | `estado: Enviada` + `fechaAplicacion` |
| No aplicado | `estado: Stand-by` + nota |
| No seleccionada/o | `estado: Cerrado` + próximo paso |
| Assessment pendiente | `estado: A-pendiente` + `proximoPaso: Gmail Empleo/Entrevistas-Assessments/Pendientes` + nota |
| Assessment realizado | `estado: A-realizado` + `proximoPaso: Gmail Empleo/Entrevistas-Assessments/Realizados` + nota |
| Desmarcar checkbox postulación | `estado: Pendiente` (o `Enviada` si desmarcás assessment con fecha de aplicación) |
| Match incorrecto | `matchRejected: true`, `estado: Stand-by` |
| Deshacer reject | `matchRejected: false`, `estado: Pendiente` |

Política Excel: el agente/automatización **nunca** escribe `Descartado`. Ver reglas de `Empleos_Tracker.xlsx`.

## Sync filtros lista tras escribir en detalle (#373)

Al guardar un estado en detalle, `app.js` activa el filtro de lista correspondiente para que el empleo siga visible:

- Marcar **Aplicado** con solo «Sin clasificar» activo → activa «Aplicados» y desactiva el modo exclusivo «Sin clasificar».
- Marcar **No aplicado** / **No seleccionada/o** → misma lógica para su bucket.
- Marcar **Assessment pendiente** → activa filtro lista «Assessment pendiente» (`?filter=assessment`).
- Marcar **Assessment realizado** → activa filtro lista «A-realizado» (`?filter=assessment_done`).
- Desmarcar assessment con fecha de aplicación → activa «Aplicados»; sin fecha → «Sin clasificar».
- Desmarcar (volver a pendiente) → activa «Sin clasificar»; si solo había un bucket de postulación o «Match incorrecto» exclusivo, lo apaga.
- **Match incorrecto** → activa filtro «Match incorrecto» (disclosure, no checkbox de postulación).

## Estados tracker completos en lista (#410)

### Badge `estado` + checkboxes #373

Conviven en lista y detalle:

- **Badge tracker** (`estado-tracker`): texto canónico del Excel (`Enviada`, `A-pendiente`, `Borrador abierto`, etc.) con color aproximado PO.
- **Checkboxes detalle** (#373 + #420 + #424): buckets Aplicado / No aplicado / No seleccionada/o / Assessment pendiente / Assessment realizado — mutuamente excluyentes entre sí (salvo assessment realizado sin desmarcar).
- **Badges checkbox lista** (`badge-applied`, etc.): opcionales; siguen visibles junto al badge tracker.

### Paleta CSS (aproximación PO)

| Estado | Clase | Estilo |
|--------|-------|--------|
| Pendiente | `estado-tracker--pendiente` | neutro |
| Stand-by | `estado-tracker--standby` | azul claro |
| Enviada | `estado-tracker--enviada` | verde |
| Borrador abierto | `estado-tracker--borrador` | ámbar |
| A-pendiente | `estado-tracker--a-pendiente` | naranja claro |
| A-realizado | `estado-tracker--a-realizado` | violeta claro |
| Cerrado (tracker) | `estado-tracker--cerrado` | gris + tachado |
| Duplicado | `estado-tracker--duplicado` | azul grisáceo |
| Descartado | oculto (sin filtro) | — |

### Distinción Cerrado LinkedIn vs tracker

- `badge-closed` (rojo): `jobClosed` LinkedIn — no llegaste a aplicar.
- `estado-tracker--cerrado` (gris tachado): `estado: Cerrado` tracker — «No seleccionada/o».

### Filtro Duplicado (opt-in)

- Oculto por defecto en compositor (`isVisibleMatchApplication`).
- Checkbox lista «Duplicado» + `?filter=duplicated` en API.
- `Descartado` sigue oculto sin filtro.

### A-pendiente (#420)

**Filtro lista vs escritura detalle (desacoplados):**

- **Filtro lista** «Assessment pendiente» (`?filter=assessment`): incluye **todas** las filas con tracker `estado: A-pendiente`, con o sin señal Gmail en `proximoPaso`/`notas`. `matchesDashboardFilter` usa `deriveApplicationStatus` → `assessment_pending`.
- **Checkbox detalle** «Assessment pendiente»: **solo visible** si hay señal Gmail (`proximoPaso` / `notas` con label `Entrevistas-Assessments/Pendientes`). Sin señal → no se renderiza (legacy manual con «Completar assessment» sigue mostrando badge tracker).
- **PATCH** marcar assessment: sigue requiriendo señal Gmail + haber aplicado (`Enviada`, `Borrador abierto`, etc.) — ver `application-writes.ts`.
- Desmarcar assessment: vuelve a `Enviada` si hay `fechaAplicacion`, si no `Pendiente`.
- **Sin clasificar** ya no incluye `A-pendiente`.
- `JobMatch.assessmentGmailPending` expone la señal Gmail al cliente (UI detalle; no condiciona el filtro lista).

### A-realizado (#424)

**Filtro lista vs escritura detalle (desacoplados, como Duplicado):**

- **Filtro lista** «A-realizado» (`?filter=assessment_done`): filas con tracker `estado: A-realizado` (usa estado directo, no `deriveApplicationStatus`).
- **Checkbox detalle** «Assessment realizado»: visible solo si `estado === A-pendiente`.
- **PATCH** marcar assessment realizado: solo desde `A-pendiente` → `A-realizado` + `proximoPaso` Gmail Realizados + nota.
- **No downgrade**: no se puede volver a `A-pendiente` ni desmarcar desde `A-realizado` en UI (`application-writes.ts`).
- Tras marcar: badge `A-realizado`; **no** aparece en filtro «Assessment pendiente» (`assessment`).
- `deriveApplicationStatus` sigue mapeando `A-realizado` → `applied` para bucket Aplicados; el filtro dedicado usa estado directo.

### Meta lista

- Bajo empresa: badge `estado` + línea `canal` (reemplaza modality · datePosted).

### API `JobMatch`

- Campos `estado`, `canal` y `assessmentGmailPending` propagados en `applicationToJobMatch` (subsume parte de #330).

## Tests

- `tests/tracker/gmail-assessment-label.test.ts` — detección señal Gmail
- `tests/dashboard/match-jobs.test.ts` — matriz `deriveApplicationStatus` ↔ `matchesDashboardFilter`
- `tests/dashboard/application-writes.test.ts` — patches de escritura al tracker
