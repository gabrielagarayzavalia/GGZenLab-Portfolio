# LAB-07 — LLM & conversational agents QA — planned

**Estado:** outline · **Track:** job-skills (avisos de empleo)  
**Gap en portfolio:** Experience testing AI/LLM, voice agents, or conversational automation systems

**Stack previsto:** Ollama · eval harness · Job Hunter LLM · Playwright chat UI

---

## Objetivo

Practicar QA de sistemas con IA: calidad semántica, regresión de prompts, latencia TTFT y flujos conversacionales (texto; voz en LAB-08).

---

## Prerrequisitos (cuando arranques)

- LAB-00 OK
- [`projects/qa-job-hunter/`](../../../projects/qa-job-hunter/) con Ollama o API LLM configurada
- Dataset golden de prompts/respuestas esperadas

---

## Outline de pasos (instructor completará en sesión)

1. Definir AC para match analysis (Job Hunter) — no alucinación, formato JSON
2. Harness de eval: input fijo → respuesta → assert semántico / schema
3. Medir TTFT y tiempo total de respuesta (ver LAB-09)
4. Regresión: correr suite ante cambio de prompt o modelo
5. (Opcional) UI conversacional con Playwright

---

## Para arrancar en chat

> **Lab LAB-07, paso 1** — modo instructor, Ollama eval harness.

**Variantes:** `ollama-eval` · `playwright-chat` · `python-deepeval`
