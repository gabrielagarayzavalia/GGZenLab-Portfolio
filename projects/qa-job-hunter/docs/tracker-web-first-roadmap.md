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
4. **Excel:** solo import inicial, export backup, transición.
5. **Un store:** unificar dashboard + campaña (no `/api/results` ni `application-status.json` paralelos).
6. **A largo plazo:** supersede [#131 B-23](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/131) (Excel Escritorio canónico).
7. **B-06 Mongo:** reorientar a colección `applications` / postulaciones (no cerrar [#52](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/52) jobs UI hasta post-spike).

**Separado:** [#213 B33-0](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/213) Grafana — observabilidad; no mezclar con tracker.

---

## Fases

| Fase | ID backlog | Entregable | Depende de |
|------|------------|------------|------------|
| **0 Spike** | B-38-0 (#264) | Inventario, API diseño, PoC grillas, wireframe mobile, plan migración, go/no-go (#273) | — |
| **1 MVP desktop** | B-38-1 (placeholder) | `/tracker` AG Grid + API CRUD + import .xlsx | Spike GO |
| **2 Mobile lite** | B-38-2 (placeholder) | `/m-lite` cards, misma API | B-38-1 |
| **3 Retiro Excel writers** | B-38-3 (placeholder) | Dual-write → Mongo-only; applied-list sin writer Escritorio | B-38-1, B-23 |

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
B-38-1 MVP desktop → B-38-2 mobile → B-38-3 retiro Excel
         │
         ├── B-08 #17 tracking → columnas del tracker (no store aparte)
         ├── B-14 #18 home → futura home puede ser `/tracker`
         └── B-06 #35–#53 → Mongo `applications`; no cerrar #52 hasta post-spike
```

**B-23 (#131):** coexistencia dual-write en transición; **supersede futuro** cuando B-38-3 complete.

---

## Stories post-spike (placeholders — crear issues tras go/no-go #273)

| ID | Título propuesto | Prioridad | Notas |
|----|------------------|-----------|-------|
| **B-38-1** | MVP desktop `/tracker` (AG Grid + API) | High | Wire a `applications` Mongo |
| **B-38-2** | Mobile lite `/m` cards | Medium | Misma API que desktop |
| **B-38-3** | Retiro writers Excel applied-list | High | Cierra loop con #131; política estados Excel |

Detalle tasks: ver breakdown en [`spike-tracker-web.md`](./spike-tracker-web.md) sección B38-0-06 (B38-1…B38-10).

---

## Para el implementador del spike

1. Rama: `spike/b38-tracker-web` desde `release/v2`.
2. No integrar al pipeline productivo (`run-hunt` / campaign) en esta pasada.
3. PoC UI: `npm run dashboard` → rutas poc documentadas en spike doc.
4. Comentar progreso en #264; marcar checkboxes en spike doc + issues #265–#273.
5. Entregar go/no-go en #273 antes de pedir stories B-38-1…3 en backlog.
