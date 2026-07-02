# SQL Lab — PostgreSQL en Docker

Lab instructor: [`docs/guides/labs/LAB-01-sql-select-join.md`](../../docs/guides/labs/LAB-01-sql-select-join.md)

## Quick start

```powershell
cd projects/sql-lab
docker compose up -d
docker compose ps
docker exec -it qa-sql-lab-postgres psql -U qa -d qa_practice
```

Connection string (DBeaver / DataGrip): `postgresql://qa:qa123@localhost:5432/qa_practice`

**Nota:** los scripts en `seed/` solo corren en el **primer** arranque del volumen. Si cambiás datos de seed: `docker compose down -v` y volvé a subir.
