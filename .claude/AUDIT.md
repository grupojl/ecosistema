# AUDIT.md — Protocolo de auditoría de welver/

**Propósito:** Este archivo le dice a Claude exactamente cómo auditar el repo
en una sesión nueva. No es un checklist genérico — es un protocolo reproducible
que produce un score comparable entre sesiones.

---

## Cómo ejecutar una auditoría

En una sesión nueva, decirle a Claude:

> "Ejecutá el protocolo de auditoría de .claude/AUDIT.md y actualizá AUDIT-LAST.md"

Claude debe:
1. Leer AUDIT-LAST.md para conocer el estado anterior
2. Leer los archivos listados en cada dimensión
3. Asignar score con evidencia concreta (nunca score sin citar archivo + línea)
4. Escribir el resultado en AUDIT-LAST.md

---

## Dimensiones de evaluación

### DIMENSIÓN 1 — TypeScript Strict (peso: 15%)

**Archivos a leer:**
- `tsconfig.base.json` (raíz)
- `realsass-sass-back/tsconfig.json`
- `realsass-ecommerce-back/tsconfig.json`

**Qué buscar:**
```bash
grep -r "noImplicitAny.*false" */tsconfig*.json    # → 0 resultados = 10/10
grep -r "as any" realsass-sass-back/src            # → 0 resultados = 10/10
grep -r "as any" realsass-ecommerce-back/src       # contar ocurrencias
grep -r "class-validator" realsass-ecommerce-back/src --include="*.ts"  # → 0 = 10/10
```

**Rubrica:**
- 10/10: strict completo en todos los tsconfig, 0 `as any` en negocio, 0 class-validator
- 9/10: strict activo pero 1-3 `as any` con comentario `// @real/jsonb-cast`
- 7/10: strict activo pero class-validator residual en algún módulo
- 5/10: `noImplicitAny: false` en algún tsconfig
- 0/10: sin strict, `any` libre sin comentario

---

### DIMENSIÓN 2 — Arquitectura de capas backend (peso: 20%)

**Archivos a leer:**
- `realsass-sass-back/src/` — verificar estructura por módulo
- `realsass-ecommerce-back/src/` — verificar estructura por módulo
- `.claude/checklists/backend-capas-3-4-domain-repo.md`

**Qué buscar:**

Capa 1 — Auth/Tenant:
```bash
grep -r "createTrpcAuthMiddleware\|TenantGuard\|@Tenant()" realsass-sass-back/src
# verificar que NO hay resolución manual de Firebase en controllers
```

Capa 2 — Zod/tRPC:
```bash
grep -r "class-validator\|IsString\|IsEnum" realsass-sass-back/src --include="*.ts"
# → 0 en routers/ = 10/10
```

Capa 3+4 — Domain/Repository:
```bash
# Verificar que los services NO importan PrismaService directamente
grep -r "PrismaService" realsass-sass-back/src --include="*.service.ts" -l
# Solo collaborators.service.ts es la excepción documentada
```

Capa 5 — AppRouter tipado:
```bash
grep -r "AnyRouter\|as any" packages/trpc/src    # → 0 = 10/10
```

Capa 6 — Multi-tenant:
```bash
grep -r "\.findMany\|\.findFirst\|\.findUnique" realsass-sass-back/src --include="*.service.ts"
# Verificar que TODOS tienen organizationId en el where
```

**Rubrica por módulo (sass-back tiene 11, ecommerce-back tiene catalog como molde):**
- 10/10: domain/ + repository/ + service inyecta IRepository, 0 PrismaService en service
- 8/10: domain/ + repository/ pero service tiene 1-2 queries directas a Prisma
- 5/10: service llama Prisma directamente, sin repository
- 3/10: sin separación de capas

---

### DIMENSIÓN 3 — Frontend — Fetch y estado (peso: 15%)

**Archivos a leer:**
- `real-ecommerce-front/lib/store/client.ts`
- `realsass-sass-front/lib/trpc/client.ts`
- `realsass-sass-front/hooks/use-config.ts`
- `realsass-dashboard-front/lib/trpc/client.ts`

**Qué buscar:**
```bash
# No debe haber fetch() manual en hooks de datos
grep -rn "fetch(" realsass-sass-front/hooks --include="*.ts"    # → 0
grep -rn "useEffect.*fetch\|fetch(" realsass-dashboard-front    # → 0 en hooks de datos
grep -rn "import.*from.*@/lib/ecommerce" real-ecommerce-front   # → 0 = build desbloqueado
```

**Rubrica:**
- 10/10: todos los datos via tRPC, lib/store/client.ts usa server caller, 0 fetch manual en hooks
- 8/10: 1-2 fetch manuales en hooks de datos legacy
- 5/10: mezcla de fetch y tRPC sin patrón claro

---

### DIMENSIÓN 4 — Seguridad (peso: 15%)

**Archivos a leer:**
- `realsass-sass-back/src/main.ts`
- `realsass-ecommerce-back/src/main.ts`
- `realsass-sass-back/src/auth/auth.controller.ts`

**Qué buscar:**
```bash
grep "helmet" realsass-sass-back/src/main.ts           # debe aparecer
grep "helmet" realsass-ecommerce-back/src/main.ts      # debe aparecer
grep "@Throttle" realsass-sass-back/src/auth/auth.controller.ts  # debe aparecer
grep "ALLOWED_ORIGINS\|enableCors" */src/main.ts       # sin wildcard '*'
grep "migrate deploy" */Dockerfile                     # debe aparecer en los 2 backs
```

**Rubrica:**
- 10/10: Helmet ✅, rate limiting en auth ✅, CORS sin wildcard ✅, migrate deploy ✅
- 8/10: todo menos rate limiting
- 6/10: falta Helmet o CORS con wildcard
- 3/10: sin ninguna medida de seguridad

---

### DIMENSIÓN 5 — Configuración y entorno (peso: 10%)

**Archivos a leer:**
- `realsass-sass-back/.env.example`
- `realsass-ecommerce-back/.env.example`
- Inicio de cada `main.ts` (validación de env)

**Qué buscar:**
```bash
ls realsass-sass-back/.env.example        # debe existir
ls realsass-ecommerce-back/.env.example   # debe existir
grep "process.exit\|REQUIRED_ENV\|faltante" realsass-sass-back/src/main.ts
grep "catalog:.*catalog:" pnpm-workspace.yaml   # named catalogs prohibidos → 0
```

**Rubrica:**
- 10/10: .env.example ✅, validación al arranque ✅, catalog único ✅
- 8/10: .env.example pero sin validación al arranque
- 5/10: sin .env.example

---

### DIMENSIÓN 6 — CI/CD (peso: 10%)

**Archivos a leer:**
- `.github/workflows/` — listar archivos
- Contenido de cada workflow

**Qué buscar:**
```bash
ls .github/workflows/    # debe tener 7 archivos
grep "typecheck\|build" .github/workflows/*.yml   # todos deben tener ambos steps
grep "path" .github/workflows/*.yml               # todos deben tener path filters
```

**Rubrica:**
- 10/10: 7 workflows ✅, path filters ✅, typecheck + build ✅
- 7/10: workflows presentes pero sin path filters o sin build
- 0/10: sin workflows

---

### DIMENSIÓN 7 — Deuda técnica activa (peso: 15%)

**Archivos a leer:**
- `.claude/roadmap/deuda-tecnica.md`
- `.claude/roadmap/sprints.md`
- `.claude/checklists/README.md`

**Qué buscar:**
- Deudas marcadas ❌ BLOQUEANTE que afectan producción hoy
- Componentes o archivos legacy sin eliminar
```bash
grep -r "@/lib/ecommerce\|catalog-header\|product-gallery" real-ecommerce-front  # → 0
```

**Rubrica:**
- 10/10: 0 deuda bloqueante, legacy eliminado
- 7/10: deuda no bloqueante documentada y priorizada
- 4/10: deuda bloqueante activa (rompe build o genera bug en prod)

---

## Fórmula de score global

```
Score = (D1*0.15 + D2*0.20 + D3*0.15 + D4*0.15 + D5*0.10 + D6*0.10 + D7*0.15)
```

---

## Output esperado

Al terminar la auditoría, Claude debe escribir en `.claude/AUDIT-LAST.md`:
- Fecha
- Score por dimensión con evidencia (archivo + línea o grep result)
- Score global
- Top 3 gaps por impacto
- Comparación con auditoría anterior (delta)

**Regla:** un score sin evidencia es inválido. Si no se pudo leer el archivo, marcar como `⚠️ no verificado`.

