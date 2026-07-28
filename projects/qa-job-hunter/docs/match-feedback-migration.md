# Migración match-feedback.json → Mongo (#300)

Contexto: **B-38-16** ([#315](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/315)) introduce dual-write y lectura fusionada. Este doc planifica la eliminación del JSON legacy en **#300**.

## Estado actual (post B-38-16)

| Fuente | Escritura | Lectura analyze |
|--------|-----------|-----------------|
| `output/match-feedback.json` | Dashboard reject/undo (dual-write), legacy `/api/feedback/*` | `loadFeedback()` / fallback |
| `applications.matchRejected*` | Dashboard reject/undo (B-38-15) | `loadMergedFeedback()` vía `listApplications({ matchRejected: true })` |

`loadMergedFeedback()` fusiona ambas fuentes (Mongo gana en conflicto por `jobId`).

## Fases para #300

### Fase 1 — Solo dual-write (hecho en B-38-16)

- Reject/undo dashboard escribe Mongo **y** JSON.
- `3-analyze-match.ts` usa `loadMergedFeedback()`.
- Legacy `/api/feedback/reject` sigue escribiendo solo JSON (sin cambio).

### Fase 2 — Mongo como única fuente de verdad

- Quitar dual-write en `handle-dashboard-writes.ts` (`syncRejectionFromApplication` / `syncUndoRejectionFromJobId`).
- Redirigir o deprecar `/api/feedback/*` en `serve-dashboard.ts` hacia tracker/Mongo.
- `loadMergedFeedback()` → leer solo Mongo; eliminar `mergeFeedbackStores` con JSON.
- Script one-shot: importar entradas huérfanas de `match-feedback.json` a `applications` donde exista `jobId`.

### Fase 3 — Limpieza

- Borrar `output/match-feedback.json` del repo/flujo (mantener en `.gitignore` si aplica).
- Eliminar `addRejection` / `removeRejection` / `saveFeedback` si no quedan callers.
- Actualizar smoke/docs que referencien el archivo.

## Verificación manual (B-38-16)

1. `docker compose up -d` + `npm run tracker:seed`
2. Dashboard: marcar un match como incorrecto (reject-match).
3. Confirmar Mongo: `matchRejected: true` en la application.
4. Confirmar JSON: entrada en `output/match-feedback.json`.
5. `npm run analyze` — consola debe mostrar `Aprendizaje activo: N match(es) incorrecto(s)`.
6. Undo reject — entrada eliminada del JSON y `matchRejected: false` en Mongo.

## Archivos clave

- `src/feedback.ts` — merge + `loadMergedFeedback`
- `src/feedback-sync.ts` — dual-write dashboard
- `src/dashboard/handle-dashboard-writes.ts` — reject/undo
- `src/3-analyze-match.ts` — consume feedback fusionado
