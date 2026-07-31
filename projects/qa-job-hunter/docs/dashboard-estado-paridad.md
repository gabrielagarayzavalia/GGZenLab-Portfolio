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

## Tests

- `tests/dashboard/match-jobs.test.ts` — matriz `deriveApplicationStatus` ↔ `matchesDashboardFilter`
- `tests/dashboard/application-writes.test.ts` — patches de escritura al tracker
