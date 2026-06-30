# 🎯 QA Job Hunter — LinkedIn + Claude AI

Sistema automatizado para encontrar empleos **QA Analyst / QA Automation** en LinkedIn,
analizar el % de match con tu perfil y preparar el CV a medida.

---

## ⚡ Requisitos previos

- Node.js 18+ instalado
- Cuenta de LinkedIn
- **Análisis local (recomendado):** [Ollama](https://ollama.com) — sin API key
- **Análisis en nube (opcional):** API Key de Anthropic en [console.anthropic.com](https://console.anthropic.com)

---

## 🚀 Setup inicial (solo una vez)

### 1. Instalar dependencias

```bash
npm install
npx playwright install chromium
```

### 2. Configurar tus datos

Abre `src/config.ts` y edita:

```ts
export const LINKEDIN_CREDENTIALS = {
  email: "tu_email@gmail.com",   // ← Tu email de LinkedIn
  password: "tu_password",        // ← Tu contraseña
};
```

### 3. Configurar análisis con IA

#### Opción A — Local con Ollama (recomendado, gratis)

Ideal para PCs con **8 GB RAM** (Intel Iris Xe). No requiere API key.

```powershell
# 1. Instalar Ollama desde https://ollama.com
# 2. Descargar modelo liviano (~1 GB)
ollama pull qwen2.5:1.5b

# 3. Verificar que Ollama corre (se inicia solo al instalar)
ollama list
```

Al correr `run-all.ts`, elegí la opción **B** (análisis local).

Análisis directo sin scraping:

```powershell
$env:LLM_PROVIDER = "ollama"
npx tsx src/3-analyze-match.ts
```

Modelos alternativos si tenés más RAM libre:

| Modelo | RAM aprox. | Comando |
|--------|------------|---------|
| `qwen2.5:1.5b` | ~1.5 GB | `ollama pull qwen2.5:1.5b` (default) |
| `llama3.2:3b` | ~2.5 GB | `ollama pull llama3.2:3b` |
| `phi3:mini` | ~2.5 GB | `ollama pull phi3:mini` |

Cambiar modelo:

```powershell
$env:OLLAMA_MODEL = "llama3.2:3b"
```

#### Opción B — Claude API (nube, requiere créditos)

**Windows (PowerShell):**
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-xxxxx"
$env:LLM_PROVIDER = "anthropic"
```

> 💡 Para no repetirlo cada vez, agrégalo a variables de entorno del sistema.

---

## 🎮 Uso

### Primera vez — Login + Scraping + Análisis (todo en uno):

```bash
npx tsx src/run-all.ts
```

Esto:
1. Abre LinkedIn y te loguea (puede pedir verificación manual si hay 2FA)
2. Guarda la sesión para futuros usos
3. Busca empleos QA Analyst y QA Automation
4. Analiza cada oferta con Claude
5. Muestra el dashboard con resultados

---

### Siguientes veces — Sin volver a loguearte:

```bash
npx tsx src/run-all.ts
```

El sistema detecta la sesión guardada y la reutiliza automáticamente.

---

### Pasos individuales (opcional):

```bash
# Solo login (primera vez)
npx tsx src/1-login.ts

# Solo scraping (usa sesión existente)
npx tsx src/2-scrape-jobs.ts

# Solo análisis local con Ollama (usa empleos ya scrapeados)
$env:LLM_PROVIDER = "ollama"
npx tsx src/3-analyze-match.ts

# Solo análisis Claude API (usa empleos ya scrapeados)
$env:LLM_PROVIDER = "anthropic"
npx tsx src/3-analyze-match.ts
```

---

### Dashboard web

Visualiza empleos con match en el navegador (lista + detalle):

```powershell
npm run dashboard
```

Abre `http://localhost:3847`. Lee `output/jobs-result.json`.

- **Lista (derecha):** titulo, empresa, % match, orden mayor/menor
- **Detalle (izquierda):** descripcion, skills, gaps, sugerencias CV, link LinkedIn

Puerto: `$env:DASHBOARD_PORT = "4000"`


## 📁 Archivos generados

```
output/
  jobs-result-raw.json   → Todos los empleos scrapeados
  jobs-result.json       → Empleos con análisis de match
  jobs-result.csv        → Exportable a Excel / Google Sheets
session/
  linkedin-session.json  → Sesión guardada (no compartir)
```

---

## ⚙️ Personalización

En `src/config.ts` puedes ajustar:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `SEARCH_TERMS` | Qué buscar | QA Analyst, QA Automation |
| `FILTERS.remote` | Solo remoto | `true` |
| `FILTERS.recentDays` | Publicados en N días | `7` |
| `FILTERS.maxJobsPerSearch` | Máx. por búsqueda | `15` |
| `MY_PROFILE` | Tu perfil para el match | Ya configurado |

---

## 🔧 Solución de errores frecuentes

| Error | Solución |
|-------|----------|
| `Cannot find module` | Correr `npm install` |
| `Session expired` | Borrar `session/` y correr `1-login.ts` |
| `API key not set` | Usar Ollama local (`LLM_PROVIDER=ollama`) o configurar `ANTHROPIC_API_KEY` |
| `Ollama no está corriendo` | Instalar Ollama y ejecutar `ollama pull qwen2.5:1.5b` |
| `ECMAScript imports error` | Usar `npx tsx` (nunca `ts-node`) |
| LinkedIn pide 2FA | El navegador se abre visible — completa manualmente |

---

## 📊 Qué te da el reporte final

Para cada empleo con **70%+ de match**:

- ✅ **% de match** exacto con tu perfil
- ✅ **Skills que ya tienes** y coinciden con la oferta
- ✅ **Gaps** menores (si existen)
- ✅ **3 frases** para personalizar tu CV para ese puesto (keywords ATS)
- ✅ **Resumen** de por qué aplica o no
- ✅ **Link directo** a la oferta

---

*Construido con Playwright + Ollama / Claude + TypeScript*

