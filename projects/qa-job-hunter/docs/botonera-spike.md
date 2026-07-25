# Spike — Botonera mínima + flag prod/dry-run (#125 / B14)

## Objetivo

Definir el **mínimo** de controles UI para lanzar Easy Apply sin terminal, con **un solo flag** `dry_run` | `productive`.

## Inventario (apply)

| Paso hoy (CLI) | ¿Botón spike? | Notas |
|----------------|---------------|--------|
| `npm run easy-apply:dry-run` | **Sí** | Hasta Submit sin enviar |
| `npm run easy-apply` | **Sí** | Prod: Submit + Excel enviada |
| `npm run campaign` | No (spike) | Orquestador completo → story B14 |
| `npm run apply:sync` | No (spike) | Post-apply manual/CI |
| Pipeline / gmail-fetch | No (spike) | Página `/run` futura |

## Botonera mínima (spike)

1. **Modo** — toggle `Dry-run` / `Productivo` (mutuamente excluyente).
2. **Easy Apply** — un botón; usa el modo seleccionado.
3. **Opciones** (campos, no botones extra):
   - `applyMax` (N jobs; default dry=10, prod=sin límite salvo env)
   - `jobId` (opcional; un solo job)

## API (desacoplada)

- `POST /api/run/apply` — body `{ mode, applyMax?, jobId? }` → spawn en background.
- `POST /api/run/apply/cancel` — tree-kill corrida (#324).
- `GET /api/run/apply/status` — `{ status, logTail, ... }` desde `output/run/apply-run.json`.

Runner: `src/run/apply-runner.ts` (sin UI).

## UI

- Ruta `/run` — `dashboard/run.html` + `run.js`
- Nav compartida: Dashboard | **Ejecutar** | Configuración

## Fuera de spike

- Home `/` con resumen última corrida
- Live log SSE / WebSocket
- Pipeline / campaign desde browser
- Wizard B19

## Definition of Done (spike)

- [ ] `/run` abre desde dashboard local
- [ ] Toggle dry-run/prod + Easy Apply lanza el script correcto
- [ ] Status + tail de log visible tras ejecutar
- [ ] No dos applies simultáneos
