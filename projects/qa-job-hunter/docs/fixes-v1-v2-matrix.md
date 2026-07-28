# Matriz de fixes — release/v1 vs release/v2

Referencia de **bugs y correcciones** (issues/PRs `fix/`) en las dos líneas de Job Hunter. No incluye stories de producto ni features nuevas.

**Última actualización:** 2026-07-27  
**Líneas:** `release/v1` (tag `v1-final`, congelada) · `release/v2` (activa)

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Fix aplicado en esa línea |
| ❌ | No presente en esa línea |
| ⚠️ | Abierto, parcial o en progreso |

### Estado en v2

| Estado | Significado |
|--------|-------------|
| **Activo** | Código en uso en `release/v2` |
| **Pendiente** | Issue abierto; fix no mergeado o incompleto |
| **Deprecado** | Sigue existiendo pero no es el camino recomendado |
| **Reemplazado** | Sustituido por otro mecanismo (ver nota) |
| **Eliminado** | Código o path retirado en v2 |
| **Supersedido en parte** | Fix mergeado pero trabajo nuevo lo extiende o corrige |

---

## Fixes puntuales (bugs / correcciones)

| Fix | v1 | v2 | Estado en v2 |
|-----|:--:|:--:|--------------|
| **EA: Enviada solo si Submit confirmado** ([#111](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/111)) | ✅ | ✅ | **Activo** |
| **EA: Clicks CV solo dentro del modal** ([#110](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/110), [#112](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/112)) | ✅ | ✅ | **Activo** |
| **EA: Remuneración pretendida** ([PR #108](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/108)) | ✅ | ✅ | **Activo** |
| **EA: Teléfono +54 / país** ([#151](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/151)) | ✅ | ✅ | **Activo** |
| **EA: Aviso cerrado → Excel cerrada al toque** ([#152](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/152) + `detect-apply`) | ✅ | ✅ | **Activo** — solo path Easy Apply; pipeline scrape sin equivalente ([#360](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/360)) |
| **EA: Matchers ES Capgemini/Macro** ([#153](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/153), [#166](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/166)) | ✅ | ✅ | **Activo** |
| **EA: Skills Manual/Apache, híbrida, Functionary** ([#159](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/159), [#164](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/164)) | ✅ | ✅ | **Activo** |
| **EA: XML/NiFi/Tosca en mapa skills** ([#158](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/158)) | ✅ | ✅ | **Activo** |
| **EA: Notas con nombres de campo** (B-30 [#186](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/186), [#198](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/198)) | ✅ | ✅ | **Activo** |
| **EA: Dry-run soft + Next contact** ([#202](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/202)) | ✅ | ✅ | **Activo** |
| **EA: CV step rápido + contrato timeout** ([#207](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/207), [#208](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/208)) | ✅ | ✅ | **Activo** |
| **EA: Cancel web + tree-kill Windows** ([#324](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/324) → [PR #325](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/325)) | ❌ | ✅ | **Activo** (solo v2) |
| **EA: Toggle Automation CV sel vacía** ([#211](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/211)) | ⚠️ | ⚠️ | **Pendiente** (sprint-2) |
| **EA: Falso blocked tras Next** ([#245](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/245)) | ⚠️ | ⚠️ | **Pendiente** |
| **Sync: nunca escribir Descartado** ([#161](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/161), [#162](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/162)) | ✅ | ✅ | **Activo** |
| **Sync: soportar estado Duplicado** ([#161](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/161)) | ✅ | ✅ | **Activo** |
| **Campaña: Gmail default, scrape search opt-in** ([#160](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/160), [#163](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/163)) | ✅ | ✅ | **Activo** |
| **Campaña: evitar lock Excel excel↔reconcile** ([#262](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/262) → [PR #262](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/262)) | ❌ | ✅ | **Activo** (solo v2) |
| **Scrape: waits calibrados** ([#145](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/145) → [#207](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/207)) | ✅ | ✅ | **Activo** |
| **Login LinkedIn robusto** ([#157](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/157), [#165](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/165)) | ✅ | ✅ | **Activo** |
| **Match: falsos 100% regex** ([#347](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/347) → [PR #349](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/349)) | ❌ | ✅ | **Supersedido en parte** por [#359](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/359) (rama sin merge) y [#360](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/360) |
| **Config API 404 / health** ([#241](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/241) → [PR #243](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/243)) | ❌ | ✅ | **Activo** |
| **Config preguntas: radio Yes, Bachelor, PT** ([#253](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/253)) | ⚠️ | ⚠️ | **Pendiente** |
| **Dashboard: estados alineados a tracker + flash** ([#348](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/348) → [PR #348](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/348)) | ❌ | ✅ | **Activo** (solo v2) |
| **`/run`: cancel no queda como error** ([#353](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/353) → [PR #354](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/pull/354)) | ❌ | ✅ | **Activo** — código mergeado; issue #353 puede seguir abierto |
| **Match alto sin matchedSkills** ([#335](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/335)) | ❌ | ⚠️ | **Pendiente** |
| **Avisos nuevos no entran** (B-20 [#114](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/114)) | ❌ | ⚠️ | **Pendiente** |

---

## Fixes de mecanismo (transición v1 → v2)

Comportamientos corregidos o reemplazados al sumar tracker web, Mongo y dashboard.

| Fix / comportamiento | v1 | v2 | Estado en v2 |
|----------------------|:--:|:--:|--------------|
| **Excel como store único post-campaña** | ✅ canónico | ✅ sigue | **Deprecado como único** — Mongo paralelo (B-38); Excel con flag |
| **`sync.py` / export Python → Excel** | ✅ | ✅ | **Deprecado** — convive con dual-write EA ([#298](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/298)); no eliminado |
| **Dashboard lee `jobs-result.json` + JSON local** | ✅ | ⚠️ | **Deprecado** — shim `/api/results` → match-jobs ([#316](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/316)); Mongo vía API |
| **`application-status.json` en cliente** | ✅ | ❌ | **Reemplazado** — writes a Mongo ([#314](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/314)) |
| **`mergeJobsWithStoredState` en `app.js`** | ✅ | ❌ | **Eliminado** — API match-jobs ([#313](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/313)) |
| **Reconcile → solo Excel + Gmail** | ✅ | ✅ | **Activo pero incompleto** — sin dual-write a Mongo ([#361](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/361), [#362](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/362)) |
| **Abrir Excel mid-campaña** | ✅ default | ❌ default | **Deprecado** — `OPEN_DESKTOP_EXCEL=1`; tracker web default |
| **Repo / path `QA-portfolio`** | — | ❌ | **Eliminado** del monorepo |

---

## Resumen

- **v1:** fixes concentrados en Easy Apply, Excel, sync y campaña Gmail; poco dashboard/Mongo.
- **v2:** hereda esos fixes **más** capa B-38 (dashboard, tracker, Mongo) y fixes de campaña/web (#262, #325, #348, #354, #349).
- **No eliminados de golpe:** Excel, `sync.py`, lectura legacy de resultados — **deprecados o en transición**.
- **Hueco nuevo v2:** reconcile y avisos cerrados en scrape **no** tienen el mismo tratamiento que EA ([#360](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/360), [#361](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/361)–[#362](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/362)).

## Mantenimiento

Actualizar esta matriz cuando:

1. Se mergee un PR `fix/` a `release/v2`.
2. Se cierre o reabra un issue de bug en sprint-2.
3. Un mecanismo pase de **Deprecado** a **Eliminado** o **Reemplazado**.

Documentos relacionados:

- [`docs/versionado-ramas.md`](./versionado-ramas.md)
- [`docs/campaign-flow.md`](./campaign-flow.md)
- [`BACKLOG.md`](../BACKLOG.md) · [`BACKLOG-REFINED.md`](../BACKLOG-REFINED.md)
