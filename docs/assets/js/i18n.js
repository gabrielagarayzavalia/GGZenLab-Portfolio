(function (global) {
  const STORAGE_KEY = 'ggzenlab-lang';
  const DEFAULT_LANG = 'en';
  const SUPPORTED = ['en', 'es'];

  const messages = {
    en: {
      'meta.title.home': 'GGZenLab | Software QA & Test Automation',
      'meta.title.api': 'API Testing | GGZenLab',
      'meta.title.perf': 'Performance JMeter | GGZenLab',
      'meta.title.guides': 'Practice Labs | GGZenLab',
      'meta.title.backlog': 'Skills Backlog | GGZenLab',
      'meta.desc.home': 'GGZenLab — Senior QA portfolio with hands-on labs, Gherkin stories, and contract-first APIs.',
      'nav.home': 'Home',
      'nav.api': 'API Testing',
      'nav.perf': 'Performance',
      'nav.guides': 'Practice Labs',
      'nav.backlog': 'Backlog',
      'nav.github': 'GitHub',
      'lang.label': 'Language',
      'hero.title': 'Software Quality Analyst & Test Automation Engineer',
      'hero.subtitle': 'GGZenLab technical portfolio: mini-projects documented as a Senior QA Analyst — Gherkin user stories, acceptance criteria, manual and automated test cases, evidence reports, and contract-first systems under test.',
      'section.projects': 'Mini-projects',
      'section.backlog': 'Skills backlog (up next)',
      'section.practice': 'Hands-on practice',
      'card.api.title': 'API Testing — REST CRUD',
      'card.api.tools': 'Swagger · Postman · Rest-Assured · Playwright C# · Selenium',
      'card.api.desc': 'Three implementations of the same OpenAPI contract (Node, Spring, .NET). Tests mapped to AC-001…AC-010.',
      'card.api.btn': 'View project',
      'card.perf.title': 'Performance — JMeter',
      'card.perf.tools': 'Apache JMeter · load on ABM API',
      'card.perf.desc': 'Load and stress tests on the API mini-project: list, create, and delete under concurrent users.',
      'card.perf.btn': 'View project',
      'card.guides.title': 'Practice labs',
      'card.guides.tools': 'Docker · local runs · step-by-step',
      'card.guides.desc': 'Follow guided instructions to run SUTs, execute tests, and reproduce reports — learn by doing.',
      'card.guides.btn': 'Start practicing',
      'card.backlog.title': 'Skills backlog',
      'card.backlog.tools': 'Docker · GitHub Actions · Azure · Jenkins',
      'card.backlog.desc': 'Planned mini-projects to publish and practice CI/CD and container workflows.',
      'card.backlog.btn': 'View backlog',
      'footer.text': 'Monorepo QA-portfolio · GitHub Pages · Contract-first QA · GGZenLab',
      'backlog.item.docker': 'Docker — containerize SUTs, compose stacks, lab on site',
      'backlog.item.gh': 'CI/CD — GitHub Actions (pipelines in this repo)',
      'backlog.item.azure': 'CI/CD — Azure DevOps Pipelines',
      'backlog.item.jenkins': 'CI/CD — Jenkins (local or cloud)',
      'backlog.item.agile': 'Agile PM — GitHub Projects for user stories, tasks & sprints',
      'backlog.agile.desc': 'GitHub Projects board: epics, stories from Gherkin, QA tasks, sprint practice — integrated with this repo.',
      'backlog.accounts.agile': 'GitHub Projects (free — gabrielagarayzavalia)',
      'guides.accounts.agile': 'Agile PM — GitHub Projects (active); also Jira/Trello/Azure Boards optional.',
      'backlog.status.planned': 'Planned',
      'backlog.status.progress': 'In progress',
      'backlog.status.done': 'Done',
      'guides.intro': 'Use these labs to practice everything published in the portfolio. Each step maps to files in the monorepo.',
      'guides.docker.title': 'Lab 1 — Docker & SUTs',
      'guides.docker.step1': 'Install Docker Desktop (Windows/Mac) or Docker Engine (Linux).',
      'guides.docker.step2': 'Clone the repo: git clone https://github.com/gabrielagarayzavalia/QA-portfolio.git',
      'guides.docker.step3': 'From the repo root run: docker compose up --build',
      'guides.docker.step4': 'Verify: Node :3000/health, Spring :8080/health, .NET :5000/health',
      'guides.docker.step5': 'Open Swagger UIs linked from the API Testing project page.',
      'guides.tests.title': 'Lab 2 — Run automated tests',
      'guides.tests.ra': 'Rest-Assured: cd projects/api-testing/tests/rest-assured-java && mvn test -Dsut.baseUrl=http://localhost:3000',
      'guides.tests.pw': 'Playwright C#: cd projects/api-testing/tests/playwright-csharp && dotnet test (set SUT_BASE_URL=http://localhost:3000)',
      'guides.tests.sel': 'Selenium: cd projects/api-testing/tests/selenium-java && mvn test -Dsut.swaggerUiUrl=http://localhost:3000/api-docs',
      'guides.tests.jmeter': 'JMeter: jmeter -n -t projects/performance-jmeter/jmeter/ABM-load-test.jmx -JbaseHost=localhost -JbasePort=3000 -l results.jtl -e -o jmeter-report',
      'guides.cicd.title': 'Lab 3 — CI/CD (GitHub Actions)',
      'guides.cicd.step1': 'Push to main on GitHub — workflows in .github/workflows/ run automatically.',
      'guides.cicd.step2': 'Enable Pages: Settings → Pages → Source: GitHub Actions.',
      'guides.cicd.step3': 'Review Actions tab for api-suts, api-tests, pages, and performance (manual).',
      'guides.projects.title': 'Lab 4 — GitHub Projects (agile board)',
      'guides.projects.step1': 'Push this repo to github.com/gabrielagarayzavalia/QA-portfolio if not already.',
      'guides.projects.step2': 'Create project: github.com/users/gabrielagarayzavalia/projects/new — name it GGZenLab QA Portfolio, link this repo.',
      'guides.projects.step3': 'Reform Status (sprint only): To Do → In Progress → In Review → Ready for QA → QA In Progress → Done. Remove Backlog and Ready from Status.',
      'guides.projects.step3b': 'Use Iteration Backlog for product backlog (separate from Status). Sprint board filters @current iteration.',
      'guides.projects.step4': 'Create labels (epic, user-story, task) — see projects/agile/github-projects/README.md.',
      'guides.projects.step5': 'Create issues in the repo (Epic, Story, Task) — Issues → New issue → choose template.',
      'guides.projects.step6': 'Project → Add item → search each issue and add to the board (Iteration: Backlog).',
      'guides.projects.step7': 'Sprint planning: only Stories and Tasks → Iteration Sprint 1 → To Do. Epics stay in Backlog iteration, never on the sprint board.',
      'guides.projects.link': 'Full setup guide in repo',
      'guides.accounts.title': 'Accounts for upcoming backlog items',
      'guides.accounts.gh': 'GitHub — you already have gabrielagarayzavalia (free).',
      'guides.accounts.azure': 'Azure — free account at azure.microsoft.com; Azure DevOps free org at dev.azure.com (no credit card for DevOps basic).',
      'guides.accounts.jenkins': 'Jenkins — no account required for local Docker; CloudBees CI / other SaaS optional.',
      'api.h1': 'Mini-project: API Testing (REST CRUD)',
      'api.intro': 'Contract-first validation of CRUD and listing across three SUTs implementing openapi/abm-crud.yaml.',
      'api.tools.title': 'Tools demonstrated',
      'api.swagger.title': 'Swagger (local with Docker)',
      'api.docs.title': 'QA documentation in the repo',
      'api.report.title': 'Senior QA report summary',
      'api.report.body': 'AC-001 to AC-010 validated against OpenAPI v1.0.0 on all three stacks. Multi-tool automation with 1:1 traceability between AC, manual (TC-M) and automated (TC-A) cases.',
      'api.report.result': 'Result: smoke suite in CI against Node; full regression runnable locally per SUT.',
      'api.quick.title': 'Quick run',
      'perf.h1': 'Mini-project: Performance (JMeter)',
      'perf.intro': 'Load tests on the ABM API from the first mini-project, with Gherkin story and AC-PERF-001 to AC-PERF-003.',
      'perf.scope.title': 'Scope',
      'perf.ac1': 'AC-PERF-001: GET list — 50 concurrent users, p95 < 500 ms (reference target)',
      'perf.ac2': 'AC-PERF-002: POST create — moderate load without HTTP errors',
      'perf.ac3': 'AC-PERF-003: DELETE — error rate < 1% under configured load',
      'perf.artifacts.title': 'Artifacts',
      'perf.cli.title': 'CLI execution',
      'perf.prereq.title': 'Prerequisite',
      'perf.prereq.body': 'Start the Node SUT: docker compose up node-api',
      'backlog.h1': 'Skills backlog',
      'backlog.intro': 'Mini-projects and labs to publish and practice. Status updates as each skill ships on GGZenLab.',
      'backlog.col.skill': 'Skill / mini-project',
      'backlog.col.tools': 'Tools',
      'backlog.col.accounts': 'Accounts needed',
      'backlog.col.status': 'Status',
      'backlog.docker.desc': 'Deep-dive Docker lab: images, compose, healthchecks, multi-SUT orchestration documented on site.',
      'backlog.gh.desc': 'Extend pipelines: matrix builds, artifacts, Newman, quality gates.',
      'backlog.azure.desc': 'Mirror pipelines in Azure DevOps; YAML pipelines; service connections.',
      'backlog.jenkins.desc': 'Jenkinsfile, agents, pipeline as code; optional local Jenkins in Docker.',
      'backlog.accounts.none': 'None (local)',
      'backlog.accounts.azure': 'Azure free + Azure DevOps org',
      'backlog.accounts.jenkins': 'Optional — local Docker only',
      'footer.back': '← Back to home'
    },
    es: {
      'meta.title.home': 'GGZenLab | QA de Software y Automatización',
      'meta.title.api': 'API Testing | GGZenLab',
      'meta.title.perf': 'Performance JMeter | GGZenLab',
      'meta.title.guides': 'Laboratorios prácticos | GGZenLab',
      'meta.title.backlog': 'Backlog de skills | GGZenLab',
      'meta.desc.home': 'GGZenLab — portfolio QA Senior con laboratorios, historias Gherkin y APIs contract-first.',
      'nav.home': 'Inicio',
      'nav.api': 'API Testing',
      'nav.perf': 'Performance',
      'nav.guides': 'Práctica',
      'nav.backlog': 'Backlog',
      'nav.github': 'GitHub',
      'lang.label': 'Idioma',
      'hero.title': 'Analista de Calidad de Software e Ingeniería en Automatización de Pruebas',
      'hero.subtitle': 'Portfolio técnico GGZenLab documentado como Analista QA Senior: user stories Gherkin, criterios de aceptación, casos manuales y automatizados, reportes con evidencias y sistemas bajo prueba contract-first.',
      'section.projects': 'Mini-proyectos',
      'section.backlog': 'Backlog de skills (próximos)',
      'section.practice': 'Práctica hands-on',
      'card.api.title': 'API Testing — ABM REST',
      'card.api.tools': 'Swagger · Postman · Rest-Assured · Playwright C# · Selenium',
      'card.api.desc': 'Tres implementaciones del mismo contrato OpenAPI (Node, Spring, .NET). Pruebas alineadas a AC-001…AC-010.',
      'card.api.btn': 'Ver proyecto',
      'card.perf.title': 'Performance — JMeter',
      'card.perf.tools': 'Apache JMeter · carga sobre API ABM',
      'card.perf.desc': 'Pruebas de rendimiento sobre el mini-proyecto API: listado, creación y eliminación bajo carga.',
      'card.perf.btn': 'Ver proyecto',
      'card.guides.title': 'Laboratorios prácticos',
      'card.guides.tools': 'Docker · ejecución local · paso a paso',
      'card.guides.desc': 'Instrucciones guiadas para levantar SUTs, ejecutar tests y reproducir reportes — aprender haciendo.',
      'card.guides.btn': 'Empezar a practicar',
      'card.backlog.title': 'Backlog de skills',
      'card.backlog.tools': 'Docker · GitHub Actions · Azure · Jenkins',
      'card.backlog.desc': 'Mini-proyectos planificados para publicar y practicar CI/CD y contenedores.',
      'card.backlog.btn': 'Ver backlog',
      'footer.text': 'Monorepo QA-portfolio · GitHub Pages · Contract-first QA · GGZenLab',
      'backlog.item.docker': 'Docker — containerizar SUTs, compose, lab en el sitio',
      'backlog.item.gh': 'CI/CD — GitHub Actions (pipelines en este repo)',
      'backlog.item.azure': 'CI/CD — Azure DevOps Pipelines',
      'backlog.item.jenkins': 'CI/CD — Jenkins (local o cloud)',
      'backlog.item.agile': 'Gestión ágil — GitHub Projects para user stories, tasks y sprints',
      'backlog.agile.desc': 'Tablero GitHub Projects: epics, stories desde Gherkin, tasks QA, práctica de sprint — integrado al repo.',
      'backlog.accounts.agile': 'GitHub Projects (gratis — gabrielagarayzavalia)',
      'guides.accounts.agile': 'Gestión ágil — GitHub Projects (activo); Jira/Trello/Azure Boards opcionales.',
      'backlog.status.planned': 'Planificado',
      'backlog.status.progress': 'En progreso',
      'backlog.status.done': 'Hecho',
      'guides.intro': 'Usá estos laboratorios para practicar todo lo publicado en el portfolio. Cada paso apunta a archivos del monorepo.',
      'guides.docker.title': 'Lab 1 — Docker y SUTs',
      'guides.docker.step1': 'Instalá Docker Desktop (Windows/Mac) o Docker Engine (Linux).',
      'guides.docker.step2': 'Cloná el repo: git clone https://github.com/gabrielagarayzavalia/QA-portfolio.git',
      'guides.docker.step3': 'Desde la raíz del repo: docker compose up --build',
      'guides.docker.step4': 'Verificá: Node :3000/health, Spring :8080/health, .NET :5000/health',
      'guides.docker.step5': 'Abrí las Swagger UI desde la página del proyecto API Testing.',
      'guides.tests.title': 'Lab 2 — Ejecutar pruebas automatizadas',
      'guides.tests.ra': 'Rest-Assured: cd projects/api-testing/tests/rest-assured-java && mvn test -Dsut.baseUrl=http://localhost:3000',
      'guides.tests.pw': 'Playwright C#: cd projects/api-testing/tests/playwright-csharp && dotnet test (SUT_BASE_URL=http://localhost:3000)',
      'guides.tests.sel': 'Selenium: cd projects/api-testing/tests/selenium-java && mvn test -Dsut.swaggerUiUrl=http://localhost:3000/api-docs',
      'guides.tests.jmeter': 'JMeter: jmeter -n -t projects/performance-jmeter/jmeter/ABM-load-test.jmx -JbaseHost=localhost -JbasePort=3000 -l results.jtl -e -o jmeter-report',
      'guides.cicd.title': 'Lab 3 — CI/CD (GitHub Actions)',
      'guides.cicd.step1': 'Push a main en GitHub — los workflows en .github/workflows/ se ejecutan solos.',
      'guides.cicd.step2': 'Activá Pages: Settings → Pages → Source: GitHub Actions.',
      'guides.cicd.step3': 'Revisá la pestaña Actions: api-suts, api-tests, pages y performance (manual).',
      'guides.projects.title': 'Lab 4 — GitHub Projects (tablero ágil)',
      'guides.projects.step1': 'Subí este repo a github.com/gabrielagarayzavalia/QA-portfolio si aún no está.',
      'guides.projects.step2': 'Creá el project: github.com/users/gabrielagarayzavalia/projects/new — nombre GGZenLab QA Portfolio, vinculá el repo.',
      'guides.projects.step3': 'Reformá Status (solo sprint): To Do → In Progress → In Review → Ready for QA → QA In Progress → Done. Sacá Backlog y Ready del Status.',
      'guides.projects.step3b': 'Usá Iteration Backlog para el product backlog (aparte del Status). El board filtra la iteración @current.',
      'guides.projects.step4': 'Creá labels (epic, user-story, task) — ver projects/agile/github-projects/README.md.',
      'guides.projects.step5': 'Creá issues en el repo (Epic, Story, Task) — Issues → New issue → elegí plantilla.',
      'guides.projects.step6': 'Project → Add item → buscá cada issue y agregalo (Iteration: Backlog).',
      'guides.projects.step7': 'Sprint planning: solo Stories y Tasks → Iteration Sprint 1 → To Do. Las Epics quedan en Backlog, nunca en el board del sprint.',
      'guides.projects.link': 'Guía completa en el repo',
      'guides.accounts.title': 'Cuentas para ítems del backlog',
      'guides.accounts.gh': 'GitHub — ya tenés gabrielagarayzavalia (gratis).',
      'guides.accounts.azure': 'Azure — cuenta gratis en azure.microsoft.com; Azure DevOps gratis en dev.azure.com (DevOps básico sin tarjeta).',
      'guides.accounts.jenkins': 'Jenkins — no hace falta cuenta para Docker local; CloudBees u otro SaaS opcional.',
      'api.h1': 'Mini-proyecto: API Testing (ABM REST)',
      'api.intro': 'Validación contract-first del ABM y listado sobre tres SUTs que implementan openapi/abm-crud.yaml.',
      'api.tools.title': 'Herramientas demostradas',
      'api.swagger.title': 'Swagger (local con Docker)',
      'api.docs.title': 'Documentación QA en el repositorio',
      'api.report.title': 'Resumen del reporte (Analista QA Senior)',
      'api.report.body': 'Se validaron AC-001 a AC-010 sobre OpenAPI v1.0.0 en los tres stacks. Automatización multi-herramienta con trazabilidad 1:1 entre AC, manuales (TC-M) y automatizados (TC-A).',
      'api.report.result': 'Resultado: humo en CI contra Node; regresión completa ejecutable localmente por SUT.',
      'api.quick.title': 'Ejecución rápida',
      'perf.h1': 'Mini-proyecto: Performance (JMeter)',
      'perf.intro': 'Pruebas de carga sobre la API ABM del primer mini-proyecto, con Gherkin y AC-PERF-001 a AC-PERF-003.',
      'perf.scope.title': 'Alcance',
      'perf.ac1': 'AC-PERF-001: GET listado — 50 usuarios concurrentes, p95 < 500 ms (referencia)',
      'perf.ac2': 'AC-PERF-002: POST creación — carga moderada sin errores HTTP',
      'perf.ac3': 'AC-PERF-003: DELETE — tasa de error < 1% bajo carga configurada',
      'perf.artifacts.title': 'Artefactos',
      'perf.cli.title': 'Ejecución CLI',
      'perf.prereq.title': 'Prerrequisito',
      'perf.prereq.body': 'Levantá el SUT Node: docker compose up node-api',
      'backlog.h1': 'Backlog de skills',
      'backlog.intro': 'Mini-proyectos y labs por publicar y practicar. El estado se actualiza cuando cada skill sale en GGZenLab.',
      'backlog.col.skill': 'Skill / mini-proyecto',
      'backlog.col.tools': 'Herramientas',
      'backlog.col.accounts': 'Cuentas necesarias',
      'backlog.col.status': 'Estado',
      'backlog.docker.desc': 'Lab Docker profundo: imágenes, compose, healthchecks, orquestación multi-SUT documentada en el sitio.',
      'backlog.gh.desc': 'Extender pipelines: matrix, artifacts, Newman, quality gates.',
      'backlog.azure.desc': 'Replicar pipelines en Azure DevOps; YAML; service connections.',
      'backlog.jenkins.desc': 'Jenkinsfile, agents, pipeline as code; Jenkins local opcional en Docker.',
      'backlog.accounts.none': 'Ninguna (local)',
      'backlog.accounts.azure': 'Azure gratis + org Azure DevOps',
      'backlog.accounts.jenkins': 'Opcional — solo Docker local',
      'footer.back': '← Volver al inicio'
    }
  };

  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    apply(lang);
    document.querySelectorAll('[data-lang-switch]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.langSwitch === lang);
    });
  }

  function t(key, lang) {
    const l = lang || getLang();
    return (messages[l] && messages[l][key]) || messages.en[key] || key;
  }

  function apply(lang) {
    const l = lang || getLang();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr');
      const text = t(key, l);
      if (attr) el.setAttribute(attr, text);
      else el.textContent = text;
    });
    const titleKey = document.body.getAttribute('data-i18n-title');
    if (titleKey) document.title = t(titleKey, l);
    const metaDesc = document.querySelector('meta[name="description"]');
    const descKey = document.body.getAttribute('data-i18n-desc');
    if (metaDesc && descKey) metaDesc.setAttribute('content', t(descKey, l));
  }

  function initLangSwitcher() {
    document.querySelectorAll('[data-lang-switch]').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.langSwitch));
    });
    setLang(getLang());
  }

  global.GGZenI18n = { getLang, setLang, t, apply, initLangSwitcher, DEFAULT_LANG };
})(window);
