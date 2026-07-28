# Plan de performance — v1

**Objetivo v1:** Establecer **línea base** y umbrales mínimos; no optimizar ni load-test a escala.  
**Fuera de scope v1:** stress test, soak 24h, profiling LinkedIn, comparativas cloud.

---

## 1. Objetivos

| ID | Objetivo | Prioridad v1 |
|----|----------|--------------|
| PERF-V1-01 | Dashboard API responde <2s con seed local | Alta |
| PERF-V1-02 | Match-jobs compose no degrada con ~500 jobs seed | Media |
| PERF-V1-03 | Easy Apply dry-run: tiempo por paso modal dentro de `timing.ts` | Media (doc) |
| PERF-V1-04 | Export xlsx <5s para <200 filas | Media |
| PERF-V1-05 | Lighthouse score dashboard estático aceptable | Baja |

---

## 2. Herramientas por capa

| Capa | Herramienta | Por qué |
|------|-------------|---------|
| **API HTTP** | **k6** (scripts ligeros) o `curl` + `Measure-Command` | Ya hay cultura Node; k6 script simple en `scripts/perf/` futuro |
| **Dashboard UI** | **Lighthouse** (Chrome DevTools / CLI) | Página estática + fetch API; no requiere JMeter |
| **Easy Apply waits** | **Documentado** en `docs/easy-apply-perf.md` + `tests/apply/timing.test.ts` | Constantes ya versionadas |
| **Mongo** | Manual: `db.jobs.count()` + explain en Compass | JMeter overkill v1 |
| **Campaña pipeline** | **No** JMeter en v1 | Depende de LinkedIn rate limits |

> **No usar JMeter en v1** salvo que ya tengas `.jmx` en el monorepo (no hay). k6 + Lighthouse cubren el 80%.

---

## 3. Escenarios mínimos

### PERF-V1-A — API smoke timing (k6 o PowerShell)

**Precondición:** `docker compose up -d`, `npm run tracker:seed`, dashboard en 3847.

| Endpoint | Método | VUs | Duración | Threshold |
|----------|--------|-----|----------|-----------|
| `/api/health` | GET | 1 | 30s | p95 < 200ms |
| `/api/dashboard/match-jobs` | GET | 1 | 30s | p95 < 2000ms |
| `/api/tracker/applications` | GET | 1 | 30s | p95 < 2000ms |
| `/api/tracker/export/xlsx` | GET | 1 | 1 iter | < 5000ms total |

**Script k6 esqueleto (futuro):**

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE = __ENV.DASHBOARD_URL || 'http://localhost:3847';

export default function () {
  const res = http.get(`${BASE}/api/dashboard/match-jobs`);
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

### PERF-V1-B — Lighthouse dashboard

1. Abrir `http://localhost:3847/` con DevTools → Lighthouse → Performance.
2. Modo: Desktop, sin throttling (local).
3. **Threshold sugerido v1:** Performance score ≥ 70 (local); LCP < 2.5s.

### PERF-V1-C — Easy Apply timing (manual / unit)

- Correr `npm run test:timing` — valida constantes no regresen.
- Dry-run 1 job: anotar tiempo total consola; comparar con baseline en `docs/easy-apply-perf.md`.
- **Threshold v1:** sin sleeps nuevos >2.5s sin justificación en PR.

### PERF-V1-D — Compose match-jobs con volumen

1. Seed ampliado (o duplicar jobs en Mongo test).
2. Medir `GET match-jobs` con 100 / 500 documentos.
3. **Threshold v1:** 500 jobs → p95 < 3s local.

---

## 4. Métricas a registrar

| Métrica | Fuente | Dónde guardar |
|---------|--------|---------------|
| `http_req_duration` p95 | k6 | `local/reports/perf-v1-YYYY-MM-DD.md` |
| TTFB match-jobs | Postman / curl | mismo reporte |
| Tamaño body match-jobs (KB) | curl `-w %{size_download}` | mismo |
| Lighthouse Performance | LH JSON export | adjunto opcional |
| EA tiempo por job dry-run | consola | nota manual |

---

## 5. Thresholds sugeridos (v1 — local dev)

| Escenario | Métrica | Threshold | Acción si falla |
|-----------|---------|-----------|-----------------|
| Health | p95 latency | < 200ms | Investigar bind/port |
| Match-jobs | p95 latency | < 2000ms | Índices Mongo, compose query |
| Export xlsx 200 filas | total time | < 5000ms | ExcelJS buffer, projection |
| Dashboard Lighthouse | Performance | ≥ 70 | Assets, fetch duplicados |
| EA dry-run 1 job | wall clock | < 3 min | `timing.ts`, waits LinkedIn |

---

## 6. Qué NO hacer en v1

| No hacer | Razón |
|----------|-------|
| Load test >10 VUs contra dashboard local | Sin valor; no es producción |
| JMeter plan completo campaña | LinkedIn bloquea; datos no reproducibles |
| Perf test en CI obligatorio | Flaky en runners compartidos |
| Profiling Playwright LinkedIn en CI | Sesión + anti-bot |
| Comparar v1 Excel vs v2 Mongo en prod | Scope mezclado; usar seed controlado |
| Optimizar antes de baseline | Primero medir 3 corridas y documentar |

---

## 7. Próximos pasos (post v1)

1. Agregar `scripts/perf/k6-match-jobs.js` + npm script `perf:smoke`.
2. Baseline en `local/reports/perf-baseline-v1.md` tras 3 corridas.
3. Gate opcional en PR: k6 1 VU si label `perf` en issue.
4. Tras testids: Lighthouse CI con `@lhci/cli` solo en `dashboard/`.

---

## Definition of Done — perf v1

- [ ] 1 reporte baseline con 4 endpoints medidos
- [ ] Thresholds documentados (este archivo)
- [ ] `npm run test:timing` en regression automatizada
- [ ] Sin regresión de sleeps en `timing.ts` sin review
