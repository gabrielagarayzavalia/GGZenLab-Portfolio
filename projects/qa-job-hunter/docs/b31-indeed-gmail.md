# B-31 — Indeed + Gmail sitios (hunter)

Story [#191](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/191).

## Desacople

| Repo | Responsabilidad |
|------|-----------------|
| **qa-job-applied-list** | Labels/filters Gmail `Empleo/Sitios-de-empleo/{linkedin,indeed}`; fetch |
| **qa-job-hunter** (este) | Indeed como fuente scrape/discover (`IndeedAdapter`, #59 / #194) |

Docs labels (canónico): applied-list `docs/gmail-labels.md` + `docs/b31-gmail-sitios-inventory.md`.

## Hunter — Indeed

- Adapter: `src/adapters/indeed-adapter.ts` (AR MVP, **Playwright** — fetch crudo da 403)
- Contrato: `src/adapters/types.ts` (`JobSourceAdapter`)
- Smoke fixture: `npm run smoke:indeed`
- Live discover: `npm run discover:indeed` → `output/jobs-indeed-raw.json`
- Nota: Indeed puede servir captcha; 0 resultados = documentar, no inventar jobs.

UI de fuentes/sitios (Config B-18): `dashboard` → `/config#fuentes` / `#sitios`.
Persistencia MVP: `output/config-sources.json` (`isSourceEnabled` en discover).
