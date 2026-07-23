# Easy Apply — performance waits (B24 / #143)

## Inventario (baseline pre-calibración)

| Zona | Antes (típico) | Motivo aparente |
|------|----------------|-----------------|
| `page-ready` `networkidle` job | hasta **15s** | LinkedIn casi nunca idle |
| `page-ready` `networkidle` modal | hasta **8s** | idem |
| Settle post-selectores job | 600ms fijo | holgura UI |
| Settle modal post-loader | 400ms fijo | holgura UI |
| Post-Next/Review (`easy-apply`) | **1500–2500ms** fijo | esperar paso |
| Post-Submit | **2500ms** fijo | esperar Done |
| Entre avisos | 2000 + 0–1500ms | anti-ban |
| `fill-answers` sleeps | muchos 200–700ms | tipado / dropdowns |

Suma fija solo en orquestación EA (sin fill): ~**19s** de `sleep()` por corrida multi-paso + hasta **23s** de networkidle soft.

## Calibración (esta PR)

| Cambio | Después | Por qué |
|--------|---------|---------|
| `networkidle` soft | **2.5s** max | selectores ya esperan shell/CTA/modal |
| Job/modal settle | 200 / 150ms | loader+visible ya cubren |
| Post-Next | `waitForEasyApplyStepSettle` (~loader + **550ms**) | condicionado > sleep ciego |
| Post-Submit | settle + **900ms** | Done/banner siguen con timeout propio |
| Entre avisos | **700 + 0–800ms** | anti-ban mínimo |
| Tipado `pressSequentially` | sin tocar | humano / anti-ban |

Constantes: `src/apply/timing.ts`.

## Qué queda holgado a propósito

- Delays de tipeo (40–100ms/char).
- Timeouts de click (4s) y `waitFor` de controles (8–20s).
- Jitter entre jobs.
- `fill-answers.ts` sleeps internos (B24-02/03 follow-up si hace falta).

## Scrape/discover (B24-02)

Fuera de esta ola EA. Inventario rápido: `2-scrape-jobs.ts` / discover tienen sleeps propios — calibrar en PR aparte.

## Cómo medir

```bash
# Dry-run 1 aviso (cronometrar wall-clock)
Measure-Command { $env:DRY_RUN_MAX='1'; npm run easy-apply:dry-run }
```

Comparar wall-clock antes/después en el mismo jobId. Expectativa: **varios segundos menos por paso** del modal + menos espera al abrir aviso.
