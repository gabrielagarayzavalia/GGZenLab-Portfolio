# Dashboard — paridad estado detalle ↔ filtros lista ↔ tracker

Epic [#365](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/365) · Issue [#373](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/373)

## Tabla canónica

| Filtro lista (checkbox) | Detalle (checkbox postulación) | Tracker `estado` / fuente |
|-------------------------|--------------------------------|---------------------------|
| Sin clasificar | — (ninguno marcado) | `Pendiente` / null |
| Aplicados | Aplicado | `Enviada`, `A-realizado`, `Borrador abierto` |
| No aplicados | No aplicado | `Stand-by` |
| No seleccionada/o | No seleccionada/o | `Cerrado` (marcado por la usuaria) |
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
| Writes tracker | `src/dashboard/application-writes.ts` | `patchForApplicationStatus`, `patchForRejectMatch` ([#348](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/348)) |
| UI dashboard | `dashboard/app.js` | `saveApplicationStatus`, `enableFilterForApplicationStatus`, `enableFilterForRejected` |

## Writes desde el dashboard ([#348](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/348))

| Acción en detalle | PATCH tracker |
|-------------------|---------------|
| Aplicado | `estado: Enviada` + `fechaAplicacion` |
| No aplicado | `estado: Stand-by` + nota |
| No seleccionada/o | `estado: Cerrado` + próximo paso |
| Desmarcar checkbox | `estado: Pendiente` (si venía de un estado escrito por dashboard) |
| Match incorrecto | `matchRejected: true`, `estado: Stand-by` |
| Deshacer reject | `matchRejected: false`, `estado: Pendiente` |

Política Excel: el agente/automatización **nunca** escribe `Descartado`. Ver reglas de `Empleos_Tracker.xlsx`.

## Sync filtros lista tras escribir en detalle (#373)

Al guardar un estado en detalle, `app.js` activa el filtro de lista correspondiente para que el empleo siga visible:

- Marcar **Aplicado** con solo «Sin clasificar» activo → activa «Aplicados» y desactiva el modo exclusivo «Sin clasificar».
- Marcar **No aplicado** / **No seleccionada/o** → misma lógica para su bucket.
- Desmarcar (volver a pendiente) → activa «Sin clasificar»; si solo había un bucket de postulación o «Match incorrecto» exclusivo, lo apaga.
- **Match incorrecto** → activa filtro «Match incorrecto» (disclosure, no checkbox de postulación).

## Estados tracker completos en lista (#410)

### Badge `estado` + checkboxes #373

Conviven en lista y detalle:

- **Badge tracker** (`estado-tracker`): texto canónico del Excel (`Enviada`, `A-pendiente`, `Borrador abierto`, etc.) con color aproximado PO.
- **Checkboxes detalle** (#373): buckets Aplicado / No aplicado / No seleccionada/o — sin cambios.
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

### A-pendiente

- `deriveApplicationStatus` → `assessment_pending` (no null, no «Sin clasificar»).
- Visible en lista default con umbral 70%+; badge muestra `A-pendiente`.
- Bucket filtro lista «Sin clasificar» incluye `assessment_pending` para fetch server-side.

### Meta lista

- Bajo empresa: badge `estado` + línea `canal` (reemplaza modality · datePosted).

### API `JobMatch`

- Campos `estado` y `canal` propagados en `applicationToJobMatch` (subsume parte de #330).

## Tests

- `tests/dashboard/match-jobs.test.ts` — matriz `deriveApplicationStatus` ↔ `matchesDashboardFilter`
- `tests/dashboard/application-writes.test.ts` — patches de escritura al tracker
