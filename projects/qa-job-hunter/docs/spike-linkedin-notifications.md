# Spike B-37 — LinkedIn Notifications feed (discovery)

**Story:** [US-JH-B37-0 #248](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/248)  
**Rama:** `spike/b37-linkedin-notifications`  
**Fecha:** 2026-07-25  
**Estado:** spike cerrado — **no integrado** a `run-hunt.ts`

## TL;DR

| | |
|---|---|
| **Veredicto** | **GO parcial** — fuente viable como *complemento* de Gmail, no como reemplazo |
| **PoC** | `npm run discover-notifications` — 3 ítems procesados, 8 `JobEntry`, 0 errores de navegación |
| **Script** | `scripts/discover-notifications.ts` + helpers browser en `scripts/notifications-browser.js` |

---

## 1. Inventario DOM (`/notifications`)

Ejecutado con sesión `es-AR`, viewport 1280×900, scroll finito ~6 rondas.

| Aspecto | Hallazgo |
|---------|----------|
| **Contenedor feed** | `div.scaffold-finite-scroll__content` (scroll infinito / virtualizado) |
| **Ítem estable** | `.nt-card` (~22 visibles tras scroll inicial; hasta ~97 tras más scroll) |
| **Selectores frágiles** | `li.nt-card`, `li.notification-card`, `[data-test-notification-item]` → **0 nodos** en esta cuenta |
| **Timestamp** | Texto corto relativo: `3h`, `5h`, `11h` (no siempre en `<time datetime>`) |
| **CTA job alert** | Botón/link **View jobs** / **Ver empleos** dentro de `.nt-card` |
| **Prefijo accesibilidad** | Muchos textos empiezan con `Unread notification.` (ignorar en filtro; matchear el cuerpo) |
| **Virtualización** | Re-scroll al volver de destino; re-navegar a `/notifications` más fiable que `goBack()` |
| **Destino tras click** | `https://www.linkedin.com/jobs/search/?alertAction=viewjobs&currentJobId=…` o `jobs/search-results/?currentJobId=…` |
| **Jobs en destino** | Misma lista virtualizada que `discover-list.ts`: `[data-occludable-job-id]` + paneles de detalle |

### Muestras de timestamp parseadas

| Texto DOM | `ageHours` aprox. |
|-----------|-------------------|
| `3h` | 3 |
| `5h` | 5 |
| `11h` | 11 |
| `just now` / `ahora` | 0 |
| `2d` / `hace 2 d` | 48 |

Parser implementado en `parseRelativeAgeHours()` — soporta EN/ES abreviado.

---

## 2. Filtro de notificaciones relevantes

### Incluir (case-insensitive)

| Patrón | Ejemplo real (captura 2026-07-24 / run 2026-07-25) |
|--------|-----------------------------------------------------|
| `new opportunities` | `software quality assurance engineer: new opportunities in Argentina.` |
| `other recommendations for you` | `Senior QA Automation Engineer (Playwright) at Miratech and 5 other recommendations for you.` |

### Excluir

| Patrón | Ejemplo |
|--------|---------|
| `#hiring` | `Seguimos buscando personal, #hiring ¿Conoces a alguien…?` |
| `know someone` / `conocés a alguien` | posts sociales de hiring |
| likes, comments, connections | `liked your comment`, `connection request`, etc. |

### Fixtures

`docs/fixtures/notifications-capture-2026-07-24.json` — self-test:

```bash
npm run discover-notifications -- --test-fixtures
```

### Nota EN vs ES

En cuenta `locale: es-AR`, los **job alerts siguen en inglés** (`new opportunities`, `View jobs`). Para producción conviene añadir patrones ES opcionales (`nuevas oportunidades`, `otras recomendaciones para ti`) aunque hoy no fueron necesarios en el PoC.

---

## 3. PoC Playwright

### Comandos

```bash
# Dry-run (default): no escribe jobs.json
npm run discover-notifications -- --max-items=3 --lookback-hours=336

# Persistir en local/qa-job-applied-list/jobs.json
npm run discover-notifications -- --max-items=5 --lookback-hours=24 --merge

# Ver browser (debug)
npm run discover-notifications -- --headed --max-items=1
```

### Variables / flags

| Parámetro | Default | Máx | Descripción |
|-----------|---------|-----|-------------|
| `--lookback-hours` / `NOTIFICATIONS_LOOKBACK_HOURS` | `24` | `336` (14 días) | Ventana temporal sobre timestamp relativo |
| `--max-items` | `3` | — | Tope de ítems job-alert a procesar por corrida |
| `--merge` | off | — | Mergea en `jobs.json` (sin flag = dry-run) |
| `--headed` | off | — | Browser visible |

### Loop implementado

1. `goto /notifications` + scroll feed  
2. Extraer `.nt-card` → filtrar por patrón + lookback  
3. Por cada ítem: `goto /notifications` → click **View jobs** (o link)  
4. Scrape lista destino (mismo contrato `JobEntry` que `discover-list.ts`)  
5. `goto /notifications` → siguiente ítem  

### Resultado dry-run 2026-07-25

| Métrica | Valor |
|---------|-------|
| Notificaciones en DOM | 97 |
| Relevantes (filtro + 336h) | 15 |
| Ítems procesados | 3 |
| Jobs scrapeados (QA) | 8 |
| Errores navegación | 0 |
| Artefacto | `local/qa-job-applied-list/spike-notifications/last-run.json` |

**Ítems 2–3 devolvieron 0 jobs nuevos** porque los `jobId` ya habían sido vistos en el ítem 1 (solapamiento entre alertas genéricas y específicas) — comportamiento esperado para dedupe.

---

## 4. Propuesta `notificationsLookbackHours`

```typescript
// Config futura (search-config o hunt-config)
notificationsLookbackHours: number; // default 24, clamp 1..336
```

| Valor | Uso sugerido |
|-------|----------------|
| `24` | Corrida diaria en `run-hunt` (bajo riesgo rate-limit) |
| `72` | Recuperar fin de semana |
| `336` | Backfill manual / spike; no recomendado en cron diario |

Si `ageHours === null` (timestamp no parseado), el spike **incluye** el ítem y deja log — en producción debería loguear warning y contar como “unknown age”.

---

## 5. Dedupe vs fuentes actuales

| Fuente | Clave | Relación con Notifications |
|--------|-------|----------------------------|
| `local/.../jobs.json` | `jobId` | Mismo merge `Map<jobId, JobEntry>` que `discover-gmail.ts` / `discover-list.ts` |
| Gmail (`discover-gmail`) | `jobId` desde mail | **Alta superposición** con alertas `new opportunities` (mismo origen LinkedIn Job Alert) |
| `discover-list` | `jobId` desde search | Baja superposición; search es keyword-driven |
| Notifications | `jobId` desde alert/recommendation landing | Aporta **recommendations for you** que Gmail puede no enviar |

### Estrategia recomendada (implementación futura)

1. Correr Notifications **después** de Gmail en el pipeline → dedupe natural por `jobId`.  
2. Tag opcional en `JobEntry`: `source: "notifications" | "gmail" | "search"` (requiere extender tipo — fuera de scope spike).  
3. No re-procesar ítems cuyo `notificationUrn` ya se visitó en la sesión (cache local `processed-notifications.json`).  
4. Nunca escribir `Descartado` en Excel — política tracker existente.

---

## 6. Pros / contras / riesgos

| Pros | Contras |
|------|---------|
| Descubre **recommendations for you** no siempre mailadas | Mucho solapamiento con Gmail Job Alerts |
| Un click → lista scrapeable (mismo stack que list search) | DOM frágil (`.nt-card`, clases `artdeco`) |
| Filtro textual simple y testeable con fixtures | Timestamps relativos sin `datetime` ISO |
| Complementa sin reemplazar discover-gmail | Scroll + N clicks = más lento y más visible que Gmail |
| | Riesgo **ToS / automatización** LinkedIn (igual que resto del hunter) |
| | **Rate-limit** si lookback alto + muchos View jobs |
| | UI EN mezclada en locale ES — mantener patrones bilingües |
| | Virtualización: índices `.nth()` pueden desalinearse si feed cambia entre scrolls |

---

## 7. Recomendación: **GO parcial**

### Implementar (story futura)

- Paso opcional en `run-hunt.ts` **post-`discover-gmail`**, pre-scrape.  
- `notificationsLookbackHours: 24`, `maxNotificationItems: 5`.  
- Guardrails: `sleep` 1–2s entre ítems; tope diario de clicks.  
- Métricas: `notificationsItemsSeen`, `notificationsJobsAdded`, `notificationsDuplicates`.

### No hacer aún

- Reemplazar Gmail como fuente canónica.  
- Correr con lookback 336h en cron.  
- Depender solo de texto EN sin fallback ES.

### Criterio de éxito productivo

En 1 semana de uso: **≥1 jobId nuevo/semana** que no entró por Gmail ni discover-list, con **0 bloqueos de sesión**.

---

## 8. Archivos del spike

| Archivo | Rol |
|---------|-----|
| `scripts/discover-notifications.ts` | Orquestación PoC |
| `scripts/notifications-browser.js` | Funciones `page.evaluate` (evita bug `__name` de tsx) |
| `docs/fixtures/notifications-capture-2026-07-24.json` | Fixtures filtro |
| `local/.../spike-notifications/last-run.json` | Último reporte (gitignored vía `local/`) |

**No modificado:** `run-hunt.ts`, producción, `Empleos_Tracker.xlsx`.
