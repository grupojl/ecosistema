# Backend Capa 5 — Contrato AppRouter tipado
# Checklist 10/10

**Score actual: 9.5/10 — nivel Vercel/PlanetScale**
**Score objetivo: 10/10**

## ✅ Completado

- [ ] `SassAppRouter` + `EcommerceAppRouter` tipados en `@real/trpc`
- [ ] Cero casts `as any` — type-safety end-to-end
- [ ] Procedure renombrado = build de los 3 fronts falla antes de llegar a Railway
- [ ] 11 routers tRPC en sass-back
- [ ] 4 routers tRPC en ecommerce-back

## ⏳ Pendiente para 10/10

### CI gate (S4)
- [ ] GitHub Actions / Railway CI: correr `typecheck` de los 3 fronts en cada PR
  que modifique `realsass-sass-back/src/trpc/` o `realsass-ecommerce-back/src/trpc/`
  → Si falla el typecheck de un front, el PR no puede mergearse

### Integration tests del contrato (S4)
- [ ] Supertest contra cada router: input inválido → error Zod tipado
- [ ] Supertest: procedure autenticado sin cookie → 401
- [ ] Supertest: procedure de owner como collaborador → 403

## Regla dura

`@real/trpc` exporta el tipo real (`SassAppRouter`, `EcommerceAppRouter`), nunca `AnyRouter`.
Si hay un cast `as any` en un router o en el índice de `@real/trpc`, es un bug de Capa 5. Ver ADR-007.
