# Checklist: InternalModule organizations — IMPLEMENTADO ✅

**Estado:** Aplicado en realsass-sass-back (sesión 2026-09-19)

## Verificación rápida

```bash
# Confirmar archivos
ls realsass-sass-back/src/internal/

# Confirmar schema limpio
grep -n "enum StoreStatus\|enum OrgStatus" \
  realsass-sass-back/prisma/schema.prisma
# → debe aparecer UNA sola vez cada uno

# Confirmar storeStatus solo en Organization
grep -n "storeStatus\|OrgStatus\|StoreStatus\|ecosystemId\|suspendedAt" \
  realsass-sass-back/prisma/schema.prisma
# → solo 7 líneas (2 enums + 5 campos de Organization)

# Confirmar ecommerceEnabled
grep -n "ecommerceEnabled" \
  realsass-sass-back/src/organizations/repository/prisma-organizations.repository.ts
# → ecommerceEnabled: org.storeStatus === 'ACTIVE',

# Confirmar InternalModule en AppModule
grep -n "InternalModule" realsass-sass-back/src/app.module.ts
```

## Migración pendiente (si no corrió)

```bash
cd realsass-sass-back
pnpm prisma migrate dev --name add-superadmin-org-fields
cd ..
make typecheck
make g
```
