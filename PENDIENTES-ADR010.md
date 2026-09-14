# Pendientes manuales — ADR-010 (post x.sh)

Estos cambios requieren leer código existente antes de modificar.
x.sh no los automatiza para evitar romper lógica de negocio.

---

## [B1] Eliminar controllers REST legacy — realsass-ecommerce-back

Los routers tRPC ya reemplazan estos controllers. Verificar antes:
1. `grep -r "from.*catalog.controller\|from.*cart.controller\|from.*orders.controller\|from.*customers.controller\|from.*store.controller" realsass-ecommerce-back/src`
   → debe dar 0 resultados (o solo el propio archivo)
2. Eliminar los archivos y sus imports en app.module.ts

Archivos a eliminar:
- `realsass-ecommerce-back/src/catalog/catalog.controller.ts`
- `realsass-ecommerce-back/src/cart/cart.controller.ts`
- `realsass-ecommerce-back/src/orders/orders.controller.ts`
- `realsass-ecommerce-back/src/customers/customers.controller.ts`
- `realsass-ecommerce-back/src/store/store.controller.ts`

---

## [B2] Domain + Repository en ecommerce-back

Módulos sin molde (cart, orders, customers). Seguir el patrón de `src/catalog/`:
- `domain/cart.entity.ts` — tipos puros, sin Prisma
- `domain/cart.errors.ts` — DomainError tipados
- `repository/cart.repository.interface.ts` — puerto
- `repository/prisma-cart.repository.ts` — adaptador con `toEntity()`

---

## [B3] ecommerce-front → tRPC server caller

`lib/store/client.ts` usa fetch REST manual. Reemplazar con createServerCaller().
Ver: `.claude/checklists/frontend-capa-1-fetch.md` y ADR-006.

---

## [B4] Eliminar joi de sass-back

`realsass-sass-back` tiene `joi` como dependencia. Identificar qué valida:
`grep -r "joi" realsass-sass-back/src --include="*.ts"`
Migrar esas validaciones a Zod inline en los routers correspondientes.
Luego eliminar joi del package.json.

---

## [OBS] main.ts — agregar import de instrumentation (1 línea)

Ver: `realsass-sass-back/src/instrumentation.PATCH.md`

---

## [CI] Branch protection en GitHub

1. Ir a github.com → repo → Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Activar: "Require status checks to pass before merging"
4. Agregar los 7 checks de CI como requeridos
5. Activar: "Do not allow bypassing the above settings"

---

## [TEST] Implementar los specs scaffoldeados

Los archivos `.spec.ts` generados en el bloque 2-D tienen `it.todo(...)`.
Implementar en este orden (ver .claude/checklists/tests-roadmap.md):
1. cross-tenant.spec.ts (seguridad)
2. *.entity.spec.ts (domain puro)
3. *.router.spec.ts (contratos tRPC)
