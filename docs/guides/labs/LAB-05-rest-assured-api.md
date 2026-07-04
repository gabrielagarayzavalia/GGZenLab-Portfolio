# LAB-05 — API con Rest Assured (Java)

**Tipo:** QA Automation / API testing  
**Duración:** ~45–60 min  
**Objetivo:** Ejecutar tests API contract-first con Rest Assured + JUnit 5, mapearlos a AC/Gherkin y extender la suite con un caso nuevo.

**Infra:** [`projects/api-testing/tests/rest-assured-java/`](../../../projects/api-testing/tests/rest-assured-java/)

---

## Prerrequisitos

- [LAB-00](./LAB-00-setup-ggzenlab.md) completado (Docker OK)
- **JDK 21** + **Maven 3.9+** (`java -version`, `mvn -version`)
- Monorepo clonado: `C:\Users\gabri\projects\GGZenLab-Portfolio`
- Recomendado: haber visto [LAB-02 CI/CD](./LAB-02-cicd-github-actions-qa.md) (job `rest-assured` en GitHub Actions)

---

## Paso 1/8 — Levantar el SUT (Node API)

Desde la **raíz del monorepo**:

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
docker compose up -d
```

Verificá health:

```powershell
curl http://localhost:3000/health
```

**Esperado:** respuesta OK (status 200).

**Checkpoint ✋:** ¿el SUT responde en `:3000`?

---

## Paso 2/8 — Explorar el proyecto de tests

```powershell
cd projects\api-testing\tests\rest-assured-java
Get-ChildItem -Recurse -Filter *.java
```

Archivos clave:

| Archivo | Rol |
|---------|-----|
| `pom.xml` | Dependencias: Rest Assured 5, JUnit 5, Hamcrest |
| `BaseApiTest.java` | Configura `RestAssured.baseURI` desde `-Dsut.baseUrl` |
| `AbmCrudAcTests.java` | 10 tests ordenados AC-001 … AC-010 |

Contrato y trazabilidad:

- OpenAPI: `openapi/abm-crud.yaml`
- Gherkin: `projects/api-testing/gherkin/abm-crud.feature`

**Checkpoint ✋:** ¿encontraste `AbmCrudAcTests.java`?

---

## Paso 3/8 — Correr la suite

Con el SUT arriba:

```powershell
mvn test -Dsut.baseUrl=http://localhost:3000
```

**Esperado:** `BUILD SUCCESS`, 10 tests passed.

Si falla compilación por `org.hamcrest.Matchers`, revisá que `pom.xml` incluya la dependencia `hamcrest` (Rest Assured 5.x no la trae transitiva para asserts estáticos).

**Checkpoint ✋:** ¿cuántos tests pasaron?

---

## Paso 4/8 — Trazabilidad AC-001 (Create)

Abrí `AbmCrudAcTests.java` y buscá:

```java
@DisplayName("AC-001 Create valid item")
void ac001_createItem()
```

Compará con el escenario en `projects/api-testing/gherkin/abm-crud.feature` (crear ítem válido).

**Pregunta instructor:** ¿qué valida el test además del status 201? (`id`, `name`, …)

**Checkpoint ✋:** ¿podés explicar el flujo Given/When/Then en lenguaje Rest Assured?

---

## Paso 5/8 — Orden y estado compartido

La clase usa `@TestMethodOrder(MethodOrderer.OrderAnnotation.class)` y guarda `createdId` del AC-001 para update/delete posteriores.

**Pregunta instructor:** ¿qué pasa si AC-001 falla y corrés AC-005?

**Esperado:** AC-005 usa `Assumptions.assumeTrue(createdId != null)` y se saltea.

**Checkpoint ✋:** ¿entendés por qué el orden importa en esta suite?

---

## Paso 6/8 — Tu turno: agregar un test (edge case)

Agregá un test **AC-011** (o similar) que valide crear ítem con `name` duplicado o payload inválido extra — seguí el patrón existente:

```java
@Test
@Order(11)
@DisplayName("AC-011 Duplicate name rejected")
void ac011_duplicateName() {
    // POST mismo name que AC-001 → esperá 409 o 400 según contrato
}
```

Corré solo ese test (opcional):

```powershell
mvn test -Dsut.baseUrl=http://localhost:3000 -Dtest=AbmCrudAcTests#ac011_duplicateName
```

**Checkpoint ✋:** ¿el test refleja el comportamiento real del SUT?

---

## Paso 7/8 — Relación con CI (LAB-02)

El workflow `.github/workflows/api-tests.yml` ejecuta el mismo comando en el job **`rest-assured`**:

```yaml
mvn -q -B test -Dsut.baseUrl=http://localhost:3000
```

En GitHub: **Actions → API Tests → rest-assured**.

**Pregunta instructor:** ¿por qué Playwright y Selenium pueden pasar y Rest Assured fallar en el mismo workflow?

**Checkpoint ✋:** ¿viste el job en Actions después de pushear?

---

## Paso 8/8 — Definition of Done

- [ ] SUT healthy en `:3000`
- [ ] `mvn test` verde localmente
- [ ] AC-001 mapeado a Gherkin explicado con tus palabras
- [ ] Al menos **un** test nuevo agregado o documentado
- [ ] Entendés el job `rest-assured` en CI

---

## Comandos útiles

```powershell
# Solo un test
mvn test -Dsut.baseUrl=http://localhost:3000 -Dtest=AbmCrudAcTests#ac003_listPaged

# Ver dependencias
mvn dependency:tree

# Bajar SUT
cd C:\Users\gabri\projects\GGZenLab-Portfolio
docker compose down
```

---

## Ejercicio opcional

1. Extraer un `ItemsApiClient` con métodos `createItem`, `listItems`, `deleteItem`.
2. Refactorizar AC-001 para usar el client (capa OOP).
3. Correr la suite completa y confirmar que sigue verde.

---

## Siguiente

→ [LAB-02 CI/CD](./LAB-02-cicd-github-actions-qa.md) · [LAB-04 Playwright](./LAB-04-playwright-pom-typescript.md) · [LAB-06 PowerShell](./LAB-06-powershell-qa.md)

---

## Para arrancar en chat

> **Lab Rest Assured, paso 1** — modo instructor. Repo: `GGZenLab-Portfolio`.
