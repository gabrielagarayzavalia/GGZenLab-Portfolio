# Regression — Green Path v1

**Objetivo:** Cobertura **más amplia** que smoke; happy path + variantes seguras sin destruir avisos LinkedIn.  
**Tiempo estimado manual completo:** 45–90 min · **Automatizado:** ~5 min (`npm run test:tracker` + `test:api` + `test:run-apply`)

**Scope v1:** Ver `docs/fixes-v1-v2-matrix.md` — fixes activos en v1 + capa dashboard B-38 estable en v2.

---

## 1. API y persistencia Mongo

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-01 | Seed empleos | `npm run db:seed` | Colección `jobs` poblada | **sí** — gherkin `JH-T-B06-1-03` |
| REG-V1-02 | Analysis runs metadata | Tras seed, consultar `analysis_runs` | `scrapedAt`, `totalAnalyzed` presentes | **sí** — gherkin `JH-T-B06-2-02` |
| REG-V1-03 | Jobs API orden desc | `GET /api/jobs?sort=matchPercent&order=desc` | Orden correcto | **sí** |
| REG-V1-04 | Match-jobs todos los filtros | Probar `filter=unmarked\|applied\|not_applied\|not_selected\|rejected` | `200` cada uno; sin 500 | **parcial** — compose unit; HTTP manual |
| REG-V1-05 | Match-jobs sin Mongo | Parar docker → `GET match-jobs` | `503` + hint seed | **parcial** — manual |
| REG-V1-06 | Feedback GET | `GET /api/feedback` | `200`, shape `rejections` | **sí** — feedback sync tests |
| REG-V1-07 | Legacy application-status GET | `GET /api/application-status` | `200` (JSON local legacy) | **parcial** |

## 2. Dashboard — lista, filtros, detalle

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-08 | Lista inicial carga | Abrir `/` tras seed | ≥1 fila; % match visible | **no** |
| REG-V1-09 | Filtro no aplicados | Filtro **No aplicados** | Excluye Enviada | **no** |
| REG-V1-10 | Filtro rechazados match | Filtro **Rechazados** | Solo `matchRejected` | **no** |
| REG-V1-11 | Detalle — skills match | Abrir detalle aviso con match alto | `matchedSkills` o equivalente visible | **no** |
| REG-V1-12 | Link LinkedIn | Click link en detalle | Abre URL job (nueva pestaña) | **no** |
| REG-V1-13 | Flash mensaje write | Marcar aplicado → mensaje éxito | Toast/flash visible <3s | **no** |
| REG-V1-14 | m-lite filtros | `/m-lite` orden por match | Cards ordenadas | **no** |
| REG-V1-15 | Tracker web `/tracker` | Abrir `/tracker` | Grilla applications; export visible | **parcial** — wiring test |

## 3. Writes application-status

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-16 | applied → Enviada | POST status `applied` | `estado: Enviada`, `fechaAplicacion` hoy | **sí** — `application-writes.test.ts` |
| REG-V1-17 | not_applied → Stand-by | POST `not_applied` | Stand-by + nota dashboard | **sí** |
| REG-V1-18 | not_selected → Cerrado | POST `not_selected` | Cerrado + próximo paso | **sí** |
| REG-V1-19 | Desmarcar Enviada | POST `status: null` desde Enviada | Vuelve Pendiente | **sí** |
| REG-V1-20 | Sin header user | POST sin `X-Tracker-User` | `403` | **parcial** — manual Postman |
| REG-V1-21 | jobId inexistente | POST con jobId fake | `404` | **parcial** |

## 4. Match reject / feedback sync

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-22 | Reject con razón | POST reject-match + reason | `matchRejected: true`, Stand-by | **sí** |
| REG-V1-23 | Undo reject | DELETE reject-match | `matchRejected: false`, Pendiente | **sí** |
| REG-V1-24 | Dual-write JSON | Tras reject, verificar `output/match-feedback.json` | Entrada presente; tras undo, ausente | **parcial** — requiere dashboard actualizado |
| REG-V1-25 | Legacy POST /api/feedback/reject | POST body `{ jobId, title, company, searchTerm, matchPercent, reason? }` | `200` (ruta legacy) | **parcial** — Postman |

## 5. Config — preguntas y banco apply

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-26 | Alta pregunta manual | POST `/api/config/questions` | `201`, status `unanswered` | **sí** — questions-store |
| REG-V1-27 | Responder pregunta | PATCH con `answer` + `status: answered` | Persiste en `output/config-questions.json` | **sí** |
| REG-V1-28 | UI estrategias respuesta | `/config` sección preguntas | Radio/select/text strategies visibles | **sí** — `test:config-answer-ui` |
| REG-V1-29 | Consumo en apply (unit) | Campo conocido en banco | `fill-config-bank` rellena sin pendiente | **sí** — `test:config-bank` |
| REG-V1-30 | Campo desconocido prod | Required sin regla | Pendiente + banco unanswered | **sí** — `test:unknown-strategy` |

## 6. Run / Apply dry-run

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-31 | Dry-run CLI | `npm run easy-apply:dry-run` (cola con 1 job) | Hasta Submit sin click; Excel pendiente | **no** — LinkedIn |
| REG-V1-32 | Run web dry-run | POST `/api/run/apply` mode dry_run | Proceso arranca; status actualiza | **parcial** |
| REG-V1-33 | Cancel race | Cancel durante run → status cancelled | No queda como `error` | **sí** — `test:run-apply` |
| REG-V1-34 | Run concurrente | POST apply dos veces seguidas | Segundo `409` | **parcial** — unit |
| REG-V1-35 | UI /run página | Abrir `/run` | Botones dry-run / cancel visibles | **no** |

## 7. Pipeline / campaña / tracker

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-36 | Pipeline sync unit | `tests/tracker/pipeline-sync.test.ts` | Pass | **sí** |
| REG-V1-37 | Apply queue map | `tests/tracker/apply-queue-map.test.ts` | Pass | **sí** |
| REG-V1-38 | Reconcile sync | `tests/tracker/reconcile-sync.test.ts` | Pass | **sí** |
| REG-V1-39 | Estado policy (no Descartado) | `tests/tracker/estado-policy.test.ts` | Automatización nunca escribe Descartado | **sí** |
| REG-V1-40 | Campaign dry-run gate | `npm run qa:dry-run-campaign` | Gate pass o skip documentado | **parcial** |
| REG-V1-41 | Excel legacy flag off | Default sin `OPEN_DESKTOP_EXCEL` | No abre Excel mid-campaña | **sí** — excel-legacy.test |
| REG-V1-42 | Import xlsx tracker | POST `/api/tracker/import/xlsx` (fixture) | Upsert applications | **parcial** — unit import |
| REG-V1-43 | Export roundtrip | Export xlsx → abrir en Excel/LibreOffice | Hoja `Empleos`, columna Match | **parcial** |

## 8. Easy Apply — reglas v1 (sin submit real)

| ID | Caso | Pasos | Esperado | Auto |
|----|------|-------|----------|------|
| REG-V1-44 | CV contract timeout | Unit `resume-contract` | Soft stop dry-run | **sí** |
| REG-V1-45 | Timing constants | `test:timing` | Pass | **sí** |
| REG-V1-46 | Aviso cerrado → cerrada | Detect closed job (unit/detect) | Estado cerrada sin EA | **parcial** |
| REG-V1-47 | Skills Yes/No map | Skill en `my-skills` → Yes | Unit field-options | **sí** |
| REG-V1-48 | Dry-run discard modal | Save/Discard → Discard | Sale sin enviar | **no** — LinkedIn |

---

## Comandos regression automatizado

```bash
npm run test:tracker      # ~48 tests
npm run test:api
npm run test:match-jobs
npm run test:run-apply
npm run test:config-bank
npm run test:unknown-strategy
npm run qa:regression-b38-13
```

## Conteo

| Métrica | Valor |
|---------|-------|
| Casos totales | 48 |
| Automatizado **sí** | 28 |
| **parcial** | 14 |
| **no** | 6 |
