# Rest Assured — ABM API tests (Java)

Lab instructor: [`docs/guides/labs/LAB-05-rest-assured-api.md`](../../../../docs/guides/labs/LAB-05-rest-assured-api.md)

Suite JUnit 5 + Rest Assured contra el SUT Node (`:3000`), trazada a AC del contrato OpenAPI y escenarios Gherkin.

## Quick start

```powershell
# 1. SUT (desde raíz del monorepo)
cd C:\Users\gabri\projects\GGZenLab-Portfolio
docker compose up -d
curl http://localhost:3000/health

# 2. Tests
cd projects\api-testing\tests\rest-assured-java
mvn test -Dsut.baseUrl=http://localhost:3000
```

## Estructura

```
src/test/java/com/qaportfolio/api/
├── BaseApiTest.java      # baseURI desde -Dsut.baseUrl
└── AbmCrudAcTests.java   # AC-001 … AC-010 (ordenados)
```

## Trazabilidad

| Artefacto | Path |
|-----------|------|
| OpenAPI | `openapi/abm-crud.yaml` |
| Gherkin | `projects/api-testing/gherkin/abm-crud.feature` |
| Casos manuales | `projects/api-testing/test-design/manual-test-cases.md` |

## CI

Job **`rest-assured`** en `.github/workflows/api-tests.yml` — mismo comando Maven con SUT Node en background.

## Requisitos

- JDK **21**
- Maven **3.9+**
- Docker (SUT compartido del monorepo)
