# GGZenLab Portfolio

**GGZenLab Portfolio** — monorepo con dos tracks: **QA** (testing contract-first, labs y mini-proyectos) y **Product Owner (AI Code Assisted)** (productos y herramientas agentic construidos con asistencia de IA).

**GitHub:** [gabrielagarayzavalia/GGZenLab-Portfolio](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio)  
**Sitio (bilingüe EN/ES):** https://gabrielagarayzavalia.github.io/GGZenLab-Portfolio/

| Track | Ruta en el sitio | Contenido |
|-------|------------------|-----------|
| Hub | `/` | Elegí QA o Product Owner |
| QA | `/qa/` | API Testing, Performance, Labs, Backlog |
| Product Owner | `/product-owner/` | QA Job Hunter y futuros productos |

Demuestra pruebas contract-first sobre APIs ABM (Node, Spring Boot, .NET), documentación Gherkin, casos manuales y automatizados (Postman, Rest-Assured, Playwright C#, Selenium), y performance con JMeter.

## Sitio (GitHub Pages)

El sitio estático vive en [`docs/`](docs/). Tras configurar Pages con **GitHub Actions**, la URL será:

`https://gabrielagarayzavalia.github.io/GGZenLab-Portfolio/` (idioma por defecto: inglés; selector EN/ES en el sitio)

La ruta legacy `/qa-portfolio/` redirige a `/qa/`.

## Inicio rápido

### Levantar los tres SUTs

```bash
docker compose up --build
```

| SUT   | Puerto | Swagger UI        |
|-------|--------|---------------------|
| Node  | 3000   | http://localhost:3000/api-docs |
| Spring| 8080   | http://localhost:8080/swagger-ui.html |
| .NET  | 5000   | http://localhost:5000/swagger |

### Contrato OpenAPI

Fuente de verdad: [`openapi/abm-crud.yaml`](openapi/abm-crud.yaml)

### Mini-proyectos

| Proyecto | Carpeta | Descripción |
|----------|---------|-------------|
| API Testing | [`projects/api-testing/`](projects/api-testing/) | Gherkin, casos manuales, Postman, automatización |
| Performance | [`projects/performance-jmeter/`](projects/performance-jmeter/) | JMeter sobre la API ABM |
| Mapa corrupción y tierras | [`projects/mapa-corrupcion-tierras/`](projects/mapa-corrupcion-tierras/) | Dash + Plotly: casos históricos de tierras en Argentina |

## Ejecutar pruebas automatizadas

### Rest-Assured (Java)

```bash
cd projects/api-testing/tests/rest-assured-java
mvn test -Dsut.baseUrl=http://localhost:3000
```

### Playwright C# (API)

```bash
cd projects/api-testing/tests/playwright-csharp
dotnet test -- SUT_BASE_URL=http://localhost:3000
```

### Selenium Java (Swagger UI)

```bash
cd projects/api-testing/tests/selenium-java
mvn test -Dsut.swaggerUiUrl=http://localhost:3000/api-docs
```

### JMeter

```bash
jmeter -n -t projects/performance-jmeter/jmeter/ABM-load-test.jmx \
  -JbaseUrl=http://localhost:3000 -l results.jtl -e -o jmeter-report
```

## Estructura

```
docs/              → GitHub Pages
openapi/           → Contrato ABM
sut/               → node-api, spring-api, dotnet-api
projects/          → api-testing, performance-jmeter
.github/workflows/ → CI/CD
```

## Versionado

- Conventional Commits: `feat(api-node):`, `test(rest-assured):`, `docs(pages):`
- Ramas: `main`, `feature/*`
- Tags sugeridos: `api-v1.0.0`

## Backlog de skills

Ver [BACKLOG.md](BACKLOG.md) y la página [Skills Backlog](docs/backlog/index.html) — próximos: Docker (profundización), CI/CD Azure DevOps, Jenkins.

## Práctica hands-on

Instrucciones paso a paso (Docker, tests, CI/CD): [docs/guides/index.html](docs/guides/index.html)

## Licencia

MIT — uso libre para portfolio y aprendizaje.
