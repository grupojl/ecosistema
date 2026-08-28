# Reglas duras — checklist de code review

Cada regla tiene: descripción, severidad, y cómo se enforcea (o se va a enforcear).

## Severidades

- 🔴 BLOQUEANTE — no se mergea hasta resolver
- 🟡 WARNING — se mergea con ticket de deuda abierto
- 🔵 CONVENCIÓN — se comenta en PR pero no bloquea

---

## Backend

### 🔴 Ningún back reimplementa firebaseAuth/tenantContext a mano
Usar `createTrpcAuthMiddleware` de `@real/auth-server`.
→ Enforcement objetivo: `dependency-cruiser` rule `no-local-firebase-verify`
→ Estado: manual (pendiente S4)

### 🔴 Cero DTOs nuevos con class-validator
Todo input nuevo = schema Zod colocado junto al router.
→ Enforcement objetivo: ESLint rule `@real/no-new-class-validator`
→ Estado: manual (pendiente S4)

### 🔴 Ningún query sin organizationId en el where
Un query sin `organizationId` es filtración de datos entre tenants.
→ Enforcement objetivo: ESLint rule `@real/no-unscoped-prisma-query`
→ Estado: manual — revisión obligatoria en PR

### 🔴 Ningún service importa PrismaService directamente (post-migración)
Una vez que un módulo migra a Repository, el service no puede importar Prisma.
→ Enforcement objetivo: `dependency-cruiser` rule `no-prisma-in-service`
→ Estado: no aplica aún — capas 3/4 pendientes en la mayoría de módulos

### 🔴 Ningún import cruza la frontera entre backs
`realsass-sass-back` no puede importar desde `realsass-ecommerce-back` ni viceversa.
→ Enforcement objetivo: `dependency-cruiser` rule `no-cross-service-import`
→ Estado: manual

### 🟡 Un test de domain nunca importa @nestjs/* ni @prisma/client
El domain es lógica pura — si necesita NestJS para testearse, la separación falló.
→ Enforcement objetivo: Jest `moduleNameMapper` que falla si se importa desde dominio
→ Estado: no aplica aún — S4

### 🟡 Cambiar un procedure no debe romper el build de los fronts
Señal de que el contrato AppRouter está bien tipado.
→ Enforcement: CI corre `typecheck` en los 3 fronts después de cada cambio en backs
→ Estado: manual (CI no configurado aún)

---

## Frontend

### 🔴 Ningún fetch manual nuevo sin TODO documentado
```ts
// CORRECTO
// TODO(S-chat): migrar a tRPC cuando chat-ia-back exponga /api/v1/trpc
const data = await chatIaFetch('/conversations', orgId)

// PROHIBIDO — fetch manual sin justificación
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`)
```
→ Enforcement objetivo: ESLint rule `@real/no-bare-fetch`
→ Estado: manual

### 🔴 Ningún componente con useEffect para datos de servidor
Datos de servidor = TanStack Query. useEffect para datos = fetch manual disfrazado.
→ Enforcement objetivo: ESLint rule `@real/no-useeffect-fetch`
→ Estado: manual

### 🔴 Todo dato asíncrono tiene los tres estados: loading, error, data
Sin Skeleton/EmptyState el componente está incompleto.
→ Enforcement: code review — el revisor verifica los tres estados siempre
→ Estado: manual

### 🟡 Ningún store Zustand con campos que existen en una queryKey
El dato vive en TanStack Query, no duplicado en Zustand.
→ Enforcement: manual — arquitectura de stores revisada en PR
→ Estado: no aplica aún (Zustand sin stores implementados)

### 🟡 Ningún componente con array literal inline de más de 2 objetos
```ts
// PROHIBIDO en código mergeado a producción
const categories = [{ id: '1', name: 'Ropa' }, { id: '2', name: 'Zapatos' }, ...]
```
→ Enforcement objetivo: ESLint rule `@real/no-inline-mock-data`
→ Estado: manual

### 🔵 Server Component por defecto, Client Component solo si hay interactividad
Agregar `'use client'` requiere justificación en el comentario del componente.
→ Enforcement: convención de code review
→ Estado: convención

### 🔵 Un firebase/auth importado directo en una page es bypass del contrato
Usar siempre `@real/auth-client`.
→ Enforcement: manual
→ Estado: ✅ respetado en los 3 fronts actualmente

---

## Infraestructura

### 🔴 Toda variable de configuración entre servicios viaja por env var
No asumir `.env` compartido ni paths hardcodeados.
→ Enforcement: Dockerfile review obligatorio en PRs que tocan configuración
→ Estado: manual

### 🟡 Verificar qué builder usa Railway: Dockerfile o nixpacks.toml
Los 3 fronts tienen ambos — confirmar en Railway dashboard cuál está activo.
→ Enforcement: checklist de deploy en `conventions/deploy.md`
→ Estado: pendiente verificación

---

## Cómo usar este archivo en un PR

1. Leer la lista antes de aprobar cualquier PR.
2. Marcar cada regla como ✅ verificada o ❌ violada.
3. Si es 🔴 y está violada → bloquear el merge.
4. Si es 🟡 y está violada → aprobar con ticket de deuda creado.
5. Si es 🔵 → comentar en el PR, no bloquear.
