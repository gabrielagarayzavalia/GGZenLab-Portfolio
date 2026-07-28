# Matriz de cobertura — Automatización v1

**Leyenda:** ✅ recomendado · ⚠️ parcial · ❌ no · — no aplica

| Caso ID | Manual | Playwright | Postman | API test TS | No automatizable (razón) |
|---------|:------:|:----------:|:-------:|:-----------:|--------------------------|
| **API y salud** |
| SMK-V1-01 Health | ✅ smoke | — | ✅ | ✅ `tests/api` | — |
| SMK-V1-02 Match-jobs | — | — | ✅ | ✅ | — |
| SMK-V1-03 Filtro inválido | — | — | ✅ | ✅ | — |
| SMK-V1-04 Shim /api/results | — | — | ✅ | ✅ | — |
| SMK-V1-05 Jobs list | — | — | ✅ | ✅ | — |
| REG-V1-01 Seed | ✅ verificar | — | — | — | — |
| REG-V1-05 Sin Mongo 503 | ✅ | — | ✅ | ⚠️ skip si up | — |
| **Dashboard UI** |
| SMK-V1-06 Home lista | ✅ | ⚠️ futuro E2E | — | — | Selectores LinkedIn no; dashboard sí en v2 |
| SMK-V1-07 Filtro aplicados | ✅ | ⚠️ futuro | — | — | — |
| SMK-V1-08 Detalle aviso | ✅ | ⚠️ futuro | — | — | — |
| SMK-V1-09 m-lite | ✅ | ⚠️ futuro | ✅ GET | ⚠️ wiring only | — |
| REG-V1-08–14 UI dashboard | ✅ | ⚠️ `e2e:dashboard-full` | — | — | ROI bajo en v1; manual OK |
| **Writes tracker** |
| SMK-V1-10 Application status | ✅ | — | ✅ | ✅ script + unit | — |
| SMK-V1-11 Reject match | ✅ | — | ✅ | ✅ | — |
| SMK-V1-12 Undo reject | ✅ | — | ✅ | ✅ | — |
| REG-V1-16–19 Status variants | — | — | ✅ | ✅ unit | — |
| REG-V1-20 Sin header 403 | ✅ | — | ✅ | ⚠️ | — |
| **Config preguntas** |
| SMK-V1-13 List questions | — | — | ✅ | ✅ | — |
| SMK-V1-14 UI config | ✅ | ⚠️ futuro | — | ⚠️ wiring | — |
| REG-V1-26–30 Config bank | — | — | ✅ | ✅ | — |
| **Run / Apply** |
| SMK-V1-15 Status idle | — | — | ✅ | ✅ | — |
| SMK-V1-16 Start dry-run | ✅ | — | ✅ | ⚠️ unit | Spawn proceso hijo frágil en CI |
| SMK-V1-17 Cancel | — | — | ✅ | ✅ | — |
| REG-V1-31 EA dry-run CLI | ✅ | ✅ recordings | — | — | **❌ CI** — sesión LinkedIn, jobId destructivo |
| REG-V1-32–35 Run web UI | ✅ | ⚠️ futuro | ✅ | ⚠️ | — |
| **Pipeline / tracker** |
| SMK-V1-18 Applications | — | — | ✅ | ✅ | — |
| SMK-V1-19 Export xlsx | — | — | ✅ | ✅ | — |
| SMK-V1-20 Campaign gate | ✅ | — | — | ⚠️ script | Sin scrape real en gate |
| REG-V1-36–39 Tracker units | — | — | — | ✅ | — |
| REG-V1-40 Campaign | ✅ | — | — | ⚠️ | Gmail/LinkedIn externos |
| REG-V1-41 Excel flag | — | — | — | ✅ | — |
| REG-V1-42–43 Import/export | ✅ | — | ⚠️ | ✅ unit | Binario xlsx en CI OK |
| **Easy Apply LinkedIn** |
| REG-V1-44–47 Apply units | — | — | — | ✅ | — |
| REG-V1-48 Discard modal | ✅ | ⚠️ recording | — | — | **❌** — UI LinkedIn variable, anti-bot |

---

## Resumen ROI (v1)

| Capa | Casos | % del total | Esfuerzo | ROI |
|------|-------|-------------|----------|-----|
| **API test TS** (`npm run test:*`) | ~35 | **52%** | Ya existe | **Alto** — correr en cada PR |
| **Postman / Newman** | ~25 | 37% | 1–2 h setup | **Alto** — smoke HTTP sin código |
| **Playwright dashboard** | ~8 | 12% | 8–16 h | **Medio** — post v1, tras testids |
| **Playwright LinkedIn EA** | ~4 | 6% | Alto + frágil | **Bajo en v1** — manual + dry-run local |
| **Solo manual** | ~10 | 15% | — | Campaña real, UI exploratoria |

### Prioridad automatización (próximos PRs)

1. **Ya hecho:** `test:api`, `test:tracker`, `test:run-apply`, `test:match-jobs`
2. **Quick win:** Newman sobre `qa/v1/postman/` en CI (smoke HTTP)
3. **v1.1:** Playwright dashboard lista + filtros (sin LinkedIn)
4. **Post testids (fase 6):** E2E dashboard con selectores estables
5. **No priorizar v1:** EA submit real, campaña Gmail end-to-end en CI

### Regla de decisión

```
¿Toca LinkedIn UI o Gmail real?     → Manual + dry-run local
¿Es JSON in/out con Mongo?          → API test TS + Postman
¿Es regla de negocio pura?          → Unit test en tests/
¿Es layout dashboard sin testids?   → Manual v1; Playwright v1.1
```
