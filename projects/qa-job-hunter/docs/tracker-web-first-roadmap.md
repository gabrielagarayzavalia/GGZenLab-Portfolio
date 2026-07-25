# Tracker web-first — Roadmap producto (B-38)

**Línea activa:** `release/v2` · **Spike:** [US-JH-B38-0 #264](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/264)  
**Epic UI:** [EPIC-JH-UI #125](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/125)  
**Doc spike (técnico):** [`spike-tracker-web.md`](./spike-tracker-web.md)  
**Rama spike:** `spike/b38-tracker-web`

---

## Visión producto

1. **Fuente canónica futura:** API/DB web (`applications`) — no `Empleos_Tracker.xlsx` en el día a día.
2. **Desktop:** grilla completa — **AG Grid CE** 1ª opción; **Tabulator** 2ª.
3. **Mobile:** vista lite cards (`/m-lite`) — misma API, sin grilla densa.
4. **Excel:** import inicial, export backup; **legacy Desktop oculto por flag** (no retirar código).
5. **Un store:** unificar dashboard + campaña (no `/api/results` ni `application-status.json` paralelos).
6. **A largo plazo:** Mongo canónico; [#131 B-23](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/131) coexistencia — Excel legacy **gated**, no deleted.
7. **B-06 Mongo:** reorientar a colección `applications` / postulaciones (no cerrar [#52](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/52) jobs UI hasta post-spike).

**Separado:** [#213 B33-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/213) Grafana — observabilidad; no mezclar con tracker.

---

## Fases

| Fase | ID backlog | Entregable | Depende de |
|------|------------|------------|------------|
| **0 Spike** | B-38-0 (#264) | Inventario, API diseño, PoC grillas, wireframe mobile, plan migración, go/no-go (#273) | — |
| **1 MVP desktop** | B-38-1 ([#294](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/294)) | `/tracker` AG Grid + API CRUD + import .xlsx | Spike GO · PR [#293](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/293) |
| **2 Mobile lite** | B-38-2 ([#295](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/295)) | `/m-lite` cards wired API | #294 |
| **3 Excel legacy oculto** | B-38-3 ([#296](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/296)) | Mongo canónico; Desktop Excel solo con flag | #297, #298 |

---

## Spike tasks (canónicos — no duplicar)

| Task | Issue | Estado esperado |
|------|-------|-----------------|
| B38-0-01 Inventario + schema | [#265](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/265) | spike |
| B38-0-02 Persistencia + API | [#281](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/281) | spike |
| B38-0-03 PoC AG Grid vs Tabulator | [#267](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/267) | spike |
| B38-0-04 Wireframe mobile lite | [#269](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/269) | spike |
| B38-0-05 Plan migración + B-23 | [#271](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/271) | spike |
| B38-0-06 Reporte go/no-go | [#273](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/273) | spike |

Duplicados cerrados: #266, #268, #270, #272, #274 y segunda tanda #275–#287.

---

## Orden de ejecución (backlog)

```
B-38-0 spike (#264)  ──►  antes de asumir B-08 / B-14 como listas separadas
         │
         ▼ (post #273 GO)
B-38-1 MVP desktop → B-38-2 mobile → B-38-3 Excel legacy oculto (flag)
         │
         ├── B-08 #17 tracking → columnas del tracker (no store aparte)
         ├── B-14 #18 home → futura home puede ser `/tracker`
         └── B-06 #35–#53 → Mongo `applications`; no cerrar #52 hasta post-spike
```

**B-23 (#131):** dual-write en transición; Excel legacy **oculto por flag** — no retirar writers.

## Flag Excel legacy (decisión producto)

| Flag | Default | Efecto |
|------|---------|--------|
| `OPEN_DESKTOP_EXCEL=1` | off | Campaña abre `Empleos_Tracker.xlsx` mid-flow |
| `--open-excel` | — | CLI en `npm run campaign` |
| `ui.openDesktopExcel` (B-39) | `false` | Config centralizada |

Código `openTrackerExcel` / sync **se mantiene** — solo no es el path default.

---

## Stories post-spike (issues formales)

| ID | Issue | Prioridad |
|----|-------|-----------|
| B-38-1 MVP desktop | [#294](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/294) | High — PR [#293](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/293) |
| B-38-2 Mobile lite | [#295](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/295) + tasks [#302](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/302)–[#304](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/304) | Medium |
| B-38-3 Excel legacy (flag) | [#296](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/296) | High |
| B-38-5 Dual-write pipeline | [#297](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/297) | High |
| B-38-6 Dual-write EA | [#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298) | High |
| B-38-7 Import/export xlsx | [#299](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/299) | Medium |
| B-38-8 Deprecar legacy | [#300](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/300) | Low |
| B-38-9 Botonera /tracker | [#301](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/301) | Low |
| B-38-11 Spike dashboard ↔ tracker | [#305](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/305) + tasks [#306](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/306)–[#309](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/309) | High — **GO** · doc [`spike-dashboard-tracker-sync.md`](./spike-dashboard-tracker-sync.md) |
| B-38-12 API match-jobs dashboard | *(crear issue)* | High — post #297 |
| B-38-13 Schema analysis + matchRejected | *(crear issue)* | High |
| B-38-14 Wire dashboard lista | *(crear issue)* | High |
| B-38-15 Writes dashboard → tracker | *(crear issue)* | High |

**Orden sugerido:** merge #293 → cerrar #294 → **#305 spike dashboard (GO)** → #297+#298 → B-38-12…15 → **#300** → #296.

---

## Para el implementador del spike

1. Rama: `spike/b38-tracker-web` desde `release/v2`.
2. No integrar al pipeline productivo (`run-hunt` / campaign) en esta pasada.
3. PoC UI: `npm run dashboard` → rutas poc documentadas en spike doc.
4. Comentar progreso en #264; marcar checkboxes en spike doc + issues #265–#273.
5. Entregar go/no-go en #273 antes de pedir stories B-38-1…3 en backlog.
