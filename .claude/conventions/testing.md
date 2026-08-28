# Testing

## Stack

- Backend: Jest + Supertest
- Frontend: Vitest + React Testing Library + Playwright
- Cobertura mínima: 85% en paths críticos (S4 pendiente)

## Reglas duras

- Un test de domain (cuando exista la capa domain/application separada)
  nunca importa `@nestjs/*` ni `@prisma/client` — se testea sin mockear nada.
- Cada módulo nuevo incluye: unit tests de la lógica de dominio + integration
  test del contrato HTTP/tRPC.

## Configuración actual detectada

`jest` config vive inline en cada `package.json` de los backs
(`realsass-sass-back`, `realsass-ecommerce-back`):
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

## Estado actual (gap conocido)

S4 ("tests 85% + OpenTelemetry") está en roadmap, no completado. No hay
evidencia en el packing revisado de tests actuales — priorizar cuando se
consolide Capa 3/4 (domain/repository) del backend, porque testear domain
puro es más barato que testear services acoplados a Prisma.
