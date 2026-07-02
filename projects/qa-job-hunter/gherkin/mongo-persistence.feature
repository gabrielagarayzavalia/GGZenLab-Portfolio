@mongo @job-hunter @persistence
Feature: Persistencia Mongo — runs y empleos
  Como analista de calidad
  Quiero validar que los análisis y empleos se persisten en MongoDB
  Para asegurar trazabilidad entre pipeline, API y dashboard

  # Acceptance Criteria (B-06 lab)
  # JH-T-B06-1-03: seed desde jobs-result.json
  # JH-T-B06-2-02: cada analyze crea analysis_runs
  # JH-T-B06-3-01: GET /api/jobs devuelve empleos ordenados

  Background:
    Given MongoDB local está disponible en "mongodb://localhost:27017/qa_job_hunter"
    And existe el archivo "output/jobs-result.json" con empleos analizados

  @JH-T-B06-1-03 @smoke
  Scenario: Seed de empleos desde JSON existente
    When ejecuto "npm run db:seed"
    Then la colección "jobs" contiene al menos un documento
    And la colección "analysis_runs" contiene al menos un documento
    And cada job tiene los campos "id", "title", "company", "matchPercent" y "url"

  @JH-T-B06-2-02
  Scenario: Un run de análisis persiste metadatos del scrape
    Given ejecuté "npm run db:seed" exitosamente
    When consulto el último documento en "analysis_runs"
    Then el campo "scrapedAt" está presente
    And los campos "totalFound" y "totalAnalyzed" son números mayores o iguales a cero

  @JH-T-B06-3-01 @smoke
  Scenario: Listar empleos vía API desde Mongo
    Given ejecuté "npm run db:seed" exitosamente
    And el dashboard está corriendo en "http://localhost:3847"
    When envío GET a "/api/jobs?sort=matchPercent&order=desc"
    Then el código de respuesta es 200
    And el cuerpo JSON contiene un array "jobs"
    And el primer empleo tiene "matchPercent" mayor o igual que el segundo cuando order=desc

  @JH-T-B06-2-03
  Scenario: Upsert por URL evita duplicados
    Given ejecuté "npm run db:seed" exitosamente
    When ejecuto "npm run db:seed" por segunda vez
    Then el conteo de documentos en "jobs" no aumenta respecto al primer seed
