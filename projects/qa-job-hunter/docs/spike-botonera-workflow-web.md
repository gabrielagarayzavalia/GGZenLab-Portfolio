# Spike: Botonera web — workflow completo (B-40-0)

**Story:** [#318 US-JH-B40-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/318)  
**Estado:** abierto (spike)  
**Epic:** [#125 EPIC-JH-UI](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/125)

## Problema

La botonera web (`/run`) implementa solo el **spike mínimo** Easy Apply ([#125](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/125), `docs/botonera-spike.md`). La usuaria necesita el **workflow completo** de campaña, similar a la botonera desktop + `npm run campaign`, terminando en dashboard/tracker para postulación **manual** (externo, EA fallido, pendientes).

## Gap hoy (borrador pre-spike)

| Capa | Hoy | Falta |
|------|-----|-------|
| Web `/run` | Solo `POST /api/run/apply` | fetch, pipeline, revisión, reconcile |
| Desktop `botonera.ps1` | Fetch, pipeline, reconcile, Excel (applied-list) | EA (hunter), un solo flujo |
| CLI `npm run campaign` | Workflow completo hunter | UI web, pausa revisión sin TTY |

## Workflow canónico objetivo

```text
fetch Gmail → [notifications] → pipeline → REVISIÓN (/tracker o /)
  → [opcional] Easy Apply (dry/prod)
  → reconcile
  → dashboard / con pendientes manuales
```

## Outcome UX esperado

- Un botón principal dispara el proceso (u wizard corto).
- Easy Apply queda como paso/modo, no única acción.
- Usuario final en `/` o `/tracker` para: Canal Externo, EA fallido, Config pendiente.

## Tasks spike

| Task | Issue |
|------|-------|
| Inventario | [#319](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/319) |
| Diseño UX | [#320](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/320) |
| API campaign-runner | [#321](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/321) |
| Reporte + breakdown | [#322](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/322) |

## Relacionados

- [#301 B-38-9](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/301) — revisión en `/tracker` vs Excel
- [#18 B-14](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/18) — web site / run pages
- `docs/campaign-flow.md` — orquestador canónico

## Go/no-go (pendiente)

- [ ] Diseño UX aprobado
- [ ] Contrato API campaign-runner
- [ ] Stories B-40-1+ creadas
