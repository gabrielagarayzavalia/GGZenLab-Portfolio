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

## Contrato CV (#208) vs timer de página

El budget **25s** / fail **45s** por página del modal (`PERF_TEST`) mide wall-clock del paso, **no** redefine el contrato de selección CV:

- Insistir CV del rol: **30s** (`RESUME_INSIST_MS` en `resume-contract.ts`).
- Si el paso resume incluye esos 30s, el timer de página puede fallar (>45s) aunque el contrato haya hecho soft-stop correcto.
- DoD de #208: `npm run smoke:resume` + dry-run con outcome acorde; perf se reporta aparte.

## Qué queda holgado a propósito

- Delays de tipeo (40–100ms/char).
- Timeouts de click (4s) y `waitFor` de controles (8–20s).
- Jitter entre jobs.
- `fill-answers.ts` sleeps internos (B24-02/03 follow-up si hace falta).

## Scrape/discover (B24-02)

Constantes `SCRAPE` en `src/apply/timing.ts` + waits condicionados en `2-scrape-jobs.ts`:

| Zona | Antes | Después |
|------|-------|---------|
| Tras goto search | 3000ms | wait cards + **1200ms** |
| Scroll lista | 1500ms | **600ms** |
| Click card → detalle | 2000ms | wait título + **800ms** |
| See more JD | 500ms | **300ms** |

Jitter anti-ban entre avisos en applied-list scrape queda holgado a propósito.

## Cómo medir

```bash
# Dry-run 1 aviso (cronometrar wall-clock + perf por página)
Measure-Command { $env:DRY_RUN_MAX='1'; $env:PERF_TEST='1'; npm run easy-apply:dry-run }

# Campaña dry-run: sin Excel mid; Excel solo post-reconcile
npm run campaign -- --dry-run --apply-max=1 --yes
```

### Umbrales por página de modal

| Umbral | Valor | Efecto |
|--------|-------|--------|
| Budget | **25s** | Meta; si se supera → `OVER` (warn) |
| Fail | **45s** | Con `PERF_TEST=1` → error (exit 6) |

Timer: `ModalPageTimer` en `src/apply/timing.ts` (labels `open-modal`, `pasoN-contact`, `pasoN-resume`, …).

Comparar wall-clock antes/después en el mismo jobId. Expectativa: **varios segundos menos por paso** del modal + menos espera al abrir aviso.
