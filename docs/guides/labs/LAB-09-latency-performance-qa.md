# LAB-09 — Latency & response-time validation — planned

**Estado:** outline · **Track:** job-skills (avisos de empleo)  
**Gap en portfolio:** Knowledge of latency and performance validation (e.g., TTFT, call setup time, response timing)

**Stack previsto:** JMeter · k6 · Playwright trace · extiende [`projects/performance-jmeter/`](../../../projects/performance-jmeter/)

---

## Objetivo

Medir y validar SLAs de timing: TTFT (LLM/API), call setup (voz), p95/p99 de respuesta HTTP.

---

## Prerrequisitos (cuando arranques)

- LAB-00 y LAB-02 recomendados
- SUT o agente con endpoint medible (API ABM, Job Hunter LLM, etc.)

---

## Outline de pasos (instructor completará en sesión)

1. Definir AC de timing (TTFT < X ms, p95 < Y ms)
2. JMeter: timers, percentiles, assertions sobre latencia
3. k6: thresholds en script TypeScript
4. Playwright: trace + network timing para UI
5. Reporte con evidencia y comparación baseline vs cambio

---

## Para arrancar en chat

> **Lab LAB-09, paso 1** — modo instructor, JMeter timing sobre API ABM.

**Variantes:** `jmeter-timing` · `k6-ttft` · `playwright-trace`
