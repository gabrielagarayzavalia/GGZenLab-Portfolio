# LAB-05 — API con Rest Assured (Java) — próximo

**Estado:** guía preparada · practicar en chat con instructor  
**Stack:** Java 17 · Maven · Rest Assured · JUnit/TestNG · contract-first

---

## Objetivo

Ejecutar y **extender** tests API mapeados a AC del OpenAPI ABM, usando capas OOP (base test, helpers) como en el repo.

---

## Prerrequisitos (cuando arranques)

- LAB-00 OK
- JDK 17 + Maven
- SUT Node up: `docker compose up -d` (raíz monorepo)

---

## Outline de pasos (instructor completará en sesión)

1. Verificar SUT `:3000/health`
2. Explorar `projects/api-testing/tests/rest-assured-java/`
3. Correr `mvn test -Dsut.baseUrl=http://localhost:3000`
4. Leer un test `@AC-001` y mapear a Gherkin `abm-crud.feature`
5. Agregar **un** test nuevo (ej. AC edge case) con patrón existente
6. Relacionar con LAB-02 (mismo comando en CI)

---

## Para arrancar en chat

> **Lab Rest Assured, paso 1** — modo instructor.

**Chat:** podés seguir aquí después de LAB-01/02/03 o abrir chat nuevo si cambiás de Java a otro stack.

---

## Referencia

- Gherkin: `projects/api-testing/gherkin/abm-crud.feature`
- Tests: `projects/api-testing/tests/rest-assured-java/`
- Postman: `projects/api-testing/postman/`
