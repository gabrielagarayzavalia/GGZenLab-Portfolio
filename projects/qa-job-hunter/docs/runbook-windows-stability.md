# Runbook — estabilidad Windows (#324)

## Repro confirmado

**Fuente:** botonera web `/run` → `POST /api/run/apply` → `apply-runner` → Playwright Chromium.

## Si mouse/teclado fallan

1. `Ctrl+Alt+Supr` → Administrador de tareas.
2. Matar `chrome.exe`, `node.exe` (varios), `cmd.exe` con npm.
3. Teclado raro: `Alt+Shift`, `Win+Espacio`.
4. Reiniciar PC si el input no vuelve.

## Después del fix (rama `fix/b41-stability-324`)

| Acción | Cómo |
|--------|------|
| Detener corrida | Botón **⏹ Detener corrida** en `/run` |
| API cancel | `POST /api/run/apply/cancel` |
| Auditoría procesos | `npm run qa:process-audit` |
| Ctrl+C en terminal EA | Cierra Chromium (`playwright-shutdown`) |

## Cadena técnica

```text
/run → apply-runner (spawn npm) → easy-apply* → chromium.launch
Cancel → taskkill /T /F en Windows (árbol completo)
```

## Heurística audit

`qa:process-audit` avisa si `chrome.exe` > 8 u `node.exe` > 12 (Windows).

## Pendiente / backlog

- Spike [#324](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/324) inventario spawn campaña
- [#318](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/318) botonera workflow completo — después de estabilidad

## Relacionado

`docs/botonera-spike.md` · Epic [#125](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/125)
