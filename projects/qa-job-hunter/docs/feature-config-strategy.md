# Feature config y flags — estrategia Job Hunter

**Evaluación:** 2026-07 · Plan «feature flags evaluación»  
**Veredicto:** **No** LaunchDarkly / Unleash / Flagsmith ahora. **Sí** documentar toggles existentes; **sí** config centralizado liviano **después** de cerrar highs sprint-2 ([#289 B-39](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/289)).

Toggles operativos hoy: [`docs/campaign-flow.md`](./campaign-flow.md).

---

## Nivel 1 — Ahora (sin código nuevo)

- [x] Tabla env/CLI en `campaign-flow.md`
- **Regla spikes:** script separado + env opt-in; no cablear a `run-campaign` hasta go/no-go (B-37 notifications, Indeed discover, etc.)
- **Regla fixes:** merge directo; no flag permanente (sprint-2 medium fixes)

---

## Nivel 2 — Feature config centralizado (B-39) — **POSPONIDO**

**Story:** [#289 US-JH-B39](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/289) · prioridad medium · post-B25

### Gate de implementación (decisión registrada)

| Condición | Estado |
|-----------|--------|
| [#150 B-25](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/150) desacople dominios | Cerrada — dominios siguen evolucionando vía B-23 / B-38 |
| Highs sprint-2 abiertas | **Bloqueante** — no implementar `features.json` hasta cerrar tanda high |
| Duplicación health vs env tolerable | Sí, con `campaign-flow.md` |

**No implementar Nivel 2 hasta:**

1. Cerrar stories `priority:high` del sprint-2 activo (tracker dual-write, dashboard↔tracker, etc.)
2. Retomar explícitamente [#289](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/289)

### Diseño previsto (cuando se implemente B-39)

```json
{
  "discovery": { "gmail": true, "linkedinSearch": false, "notifications": true },
  "apply": { "productive": true, "dailyLimit": 10 },
  "ui": { "configCvs": true, "webTracker": true, "openDesktopExcel": false }
}
```

- `local/features.json` (gitignored o `.example` en repo)
- `src/config/features.ts` → `isFeatureEnabled(path)` + override env (`FEATURE_NOTIFICATIONS=0`)
- `/api/health` y campaña leen el mismo helper

---

## Nivel 3 — Gating freemium (post B-36) — **PENDIENTE go/no-go**

**Spike:** [#225 US-JH-B36](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/225) freemium / límites free

### Decisión a tomar tras spike B-36

| Opción | Cuándo elegir | Esfuerzo |
|--------|---------------|----------|
| **A — `planLimits` local** | 1 usuaria, sin cloud; límites free (1 sitio, 1–2 CVs) en JSON + helper encima de B-39 | Bajo |
| **B — Config UI (B-18)** | Límites editables en `/config` sin redeploy | Medio |
| **C — Unleash / Flagsmith self-hosted** | Multi-user + deploy cloud ([#22 B-12](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/22), [#23 B-16](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/23)) | Alto |

**Recomendación pre-spike:** si B-36 = GO → empezar con **A** (planLimits en `features.json`); escalar a **C** solo con cloud + multi-user.

### Kill switch sin redeploy

Si EA productivo rompe LinkedIn y hace falta apagar apply en caliente **antes** de cloud:

1. Env `APPLY_MAX=0` o `--skip-apply` (ya existe)
2. Futuro: `features.json` → `apply.productive: false`
3. Servicio externo solo si hay deploy remoto frecuente

---

## Qué NO flaggear

- Flujos únicos y estables: reconcile Gmail, política Excel `Descartado` (solo usuaria)
- Spikes en progreso: rama + script aislado > flag permanente
- Tracker web-first (B-38): flag `OPEN_DESKTOP_EXCEL` para Excel legacy, no FF de producto

---

## Disparadores para escalar a FF «de verdad»

| Disparador | Backlog |
|------------|---------|
| Freemium con límites | [#225 B-36](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/225) |
| Multi-usuario | [#22 B-12](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/22) |
| Deploy cloud | [#23 B-16](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/23) |
| UI secciones ocultas masivas | [#94 B-18](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/94) Config |

Hasta entonces: **config gates** (límites por plan) > **feature flags distribuidos**.

---

## Referencias

| Recurso | Uso |
|---------|-----|
| [`campaign-flow.md`](./campaign-flow.md) | Tabla toggles actual |
| [#289 B-39](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/289) | Story implementación Nivel 2 |
| [#150 B-25](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/150) | Desacople (cerrada) |
| [#225 B-36](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/225) | Spike freemium → Nivel 3 |
