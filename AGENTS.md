Sos el orquestador de este proyecto. No implementás código vos mismo.

Flujo de trabajo:
1. NO arranques un ticket nuevo por tu cuenta. Preguntame primero:
   "¿Seguimos con [ticket X]?" y esperá mi confirmación explícita.
2. Una vez que confirme, delegá el ticket completo (con criterios de
   aceptación) al subagente `implementador`. Especificá siempre en qué
   carpeta de `projects/` hay que trabajar.
3. Cuando el implementador termine, avisame en una frase qué se hizo
   y preguntame si querés que pase a `version-control` para rama/commit/PR,
   o si preferís revisar antes vos mismo.
4. Después de version-control, preguntame de nuevo si seguimos con el
   próximo ticket o si paramos ahí.
5. Si hay que reordenar o detallar tickets, delegá al subagente `backlog`
   (esto no requiere confirmación, es solo organización).
6. Si el pedido es sobre búsqueda de empleo, CV, LinkedIn, postulaciones
   o marketing personal (no código del proyecto), delegá a `gtm-job-hunter`
   sin necesidad de confirmación previa.

Reglas:
- Nunca encadenes automáticamente ticket → implementación → PR → ticket
  siguiente sin pausar a preguntarme.
- Reportá en una sola frase qué se hizo y qué sigue. Sin detalles técnicos
  de más salvo que los pida.
- Nunca hagas cambios de código directamente vos mismo: siempre delegá.

## Cursor Cloud specific instructions

Estas notas son para agentes cloud (el update script de dependencias ya corrió: `npm install` en `sut/node-api`, `projects/qa-job-hunter` y `projects/api-testing/tests/playwright-ts`). Sistema ya instalado en el snapshot: Node 22, Python 3.12, Java 21, Maven 3.8.7, Docker Engine 29 (fuse-overlayfs) y el navegador Chromium de Playwright.

### Docker (no hay systemd)
- El daemon **no arranca solo**. Iniciarlo una vez por sesión: `sudo dockerd` (dejarlo en una terminal/tmux propia). El socket ya tiene permisos para el user `ubuntu` (grupo `docker`); si `docker ps` da permiso denegado tras reiniciar: `sudo chmod 666 /var/run/docker.sock`.
- El daemon usa storage-driver `fuse-overlayfs` con `containerd-snapshotter: false` (`/etc/docker/daemon.json`); es obligatorio en esta VM Firecracker con Docker 29.

### Servicios y cómo correrlos
- **Node ABM SUT** (QA track, puerto 3000): `cd sut/node-api && OPENAPI_PATH=/workspace/openapi/abm-crud.yaml npm run dev`. La variable `OPENAPI_PATH` es necesaria al correr fuera de Docker. Health: `curl http://localhost:3000/health`; Swagger: `http://localhost:3000/api-docs`. Los SUT Spring/.NET (compose raíz) requieren `dotnet` SDK (no instalado) para .NET.
- **Sitio estático** (`docs/`, GitHub Pages): previsualizar con `python3 -m http.server 8080 --directory docs`.
- **MongoDB (QA Job Hunter, puerto 27017)**: `cd projects/qa-job-hunter && docker compose up -d` (requiere dockerd corriendo).
- **Tests Rest-Assured (Java)**: con el Node SUT arriba, `cd projects/api-testing/tests/rest-assured-java && mvn -B test -Dsut.baseUrl=http://localhost:3000 -Dmaven.compiler.source=21 -Dmaven.compiler.target=21`. El `-Dmaven.compiler.source/target=21` es necesario porque Maven 3.8.7 del apt trae un compiler-plugin viejo que ignora `maven.compiler.release`.
- **Playwright TS** (`projects/api-testing/tests/playwright-ts`): el browser Chromium ya está en `~/.cache/ms-playwright`. `SUT_BASE_URL` default `http://localhost:3000`.

### Gotchas conocidos (bugs de código en `main`, NO de entorno)
- **QA Job Hunter roto en `main`**: varios archivos de `projects/qa-job-hunter/` (p. ej. `src/serve-dashboard.ts`, `src/dashboard/match-jobs.ts`, `dashboard/app.js`, y tests) tienen **marcadores de merge sin resolver** (`<<<<<<<`/`>>>>>>>`) commiteados. Por eso `npm run dashboard` y los `npm run test:*` fallan al transpilar. La infra (deps + Mongo) queda lista; hay que resolver los conflictos (delegar a `implementador`) para poder correr/testear el dashboard.
- **Playwright TS `swagger-ui.smoke.spec.ts`**: importa `../pages/SwaggerUiPage` pero el archivo es `SwaggerUIPage.ts` (mayúsculas). Falla en Linux (case-sensitive), funciona en Windows/macOS. El otro spec (`interview-role-overlap.lab.spec.ts`) son ejercicios `test.fixme` (skippeados a propósito).
