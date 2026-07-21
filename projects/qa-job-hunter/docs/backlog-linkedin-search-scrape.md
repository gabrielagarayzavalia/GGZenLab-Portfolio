# Backlog — mejorar LinkedIn search scrape

**Estado:** fuera del flujo diario. Discovery canónico = Gmail API (`npm run campaign` / `gmail:fetch`).

**Problema:** `npm run scrape` (`src/2-scrape-jobs.ts`) busca por keywords en LinkedIn Jobs y a menudo lista cards no-QA (misma SERP basura / UI LinkedIn). El match Ollama (`3-analyze-match.ts`) no arregla el discovery.

**Objetivo (PR futuro):**

1. Forzar filtros útiles en la URL de búsqueda (`f_AL` Easy Apply, geo AR/Remote, `f_TPR`, etc.).
2. Descartar cards cuyo título no pase `TITLE_KEYWORDS` **antes** de abrir detalle (ya parcialmente; endurecer).
3. No usar este path como fallback cuando la cola Easy Apply está vacía.
4. Opt-in explícito: `DISCOVERY=linkedin_search` + aviso en consola.

**No hacer:** mezclar este scrape con `run-pipeline` de applied-list (ese scrape es solo detalle JD de URLs de Gmail).
