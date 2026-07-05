# LAB-10 — Contract testing & WireMock — planned

**Estado:** outline · **Track:** job-skills (avisos de empleo)  
**Gap en portfolio:** Exposure to contract testing, WireMock, or other mock services

**Stack previsto:** WireMock · Pact · MSW — extiende contract-first de [`openapi/abm-crud.yaml`](../../../openapi/abm-crud.yaml)

---

## Objetivo

Probar consumidores sin SUT completo: mocks, consumer-driven contracts y validación de breaking changes.

---

## Prerrequisitos (cuando arranques)

- LAB-05 recomendado (Rest Assured)
- OpenAPI ABM como contrato de referencia

---

## Outline de pasos (instructor completará en sesión)

1. WireMock: stub de GET/POST según OpenAPI
2. Tests Rest Assured contra mock en lugar de SUT real
3. Pact: publicar contrato consumer → verificar provider
4. CI: fallar si contrato rompe
5. Documentar trazabilidad AC → mock → test

---

## Para arrancar en chat

> **Lab LAB-10, paso 1** — modo instructor, WireMock + Rest Assured.

**Variantes:** `wiremock-java` · `pact-js` · `msw-node`
