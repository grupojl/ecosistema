# Auditorías del monorepo

Scripts de verificación de las reglas de `.claude/` (arquitectura, contratos, seguridad, etc.).
Se corren desde la raíz del repo.

| Script | Qué verifica |
|---|---|
| `contratos-tipado.sh` | Contratos tRPC (ADR-019): sin `as any`, `@ts-ignore` ni `as unknown as` |
| `phantom-deps.cjs` | Dependencias fantasma (ADR-018) — lo llama `dependencias.sh` |
| `arquitectura.sh` | Capas: services → repository, sin Prisma directo |
| `seguridad.sh` | Guards, procedures, tenant isolation, runAsSystem (S8), cableado de RLS (S9), mutaciones públicas (S10) |
| `observabilidad.sh` | Logs, métricas, trazas |
| `testing.sh` | Tests donde la regla los exige: dominio, services críticos, guards, máquina de estados de órdenes |
| `dependencias.sh` | Política de dependencias (ADR-018) |
| `deploy.sh` | Railway / Docker |

```bash
make a                 # todas
make a A=seguridad     # una sola
bash scripts/audit/run.sh --ci   # todas; exit 1 si alguna tiene hallazgos
```
