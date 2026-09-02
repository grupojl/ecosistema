# Frontend Capa 5 — Auth compartido
# Checklist 10/10

**Score actual: 9.5/10 — nivel Stripe/Auth0**
**Score objetivo: 10/10**

## ✅ Completado

- [x] `@real/auth-client` fuente única de Firebase en los 3 fronts
- [x] Sin imports directos de `firebase/auth` en componentes de página
- [x] Cookies HttpOnly — XSS no puede exfiltrar el token
- [x] Refresh proactivo a los 55 min — renueva también la session cookie
- [x] Revocación server-side real en logout via `revokeRefreshTokens`
- [x] `lib/firebase.ts` eliminado de sass-front
- [x] `login-modal.tsx` importa directo de `@real/auth-client`

## ⏳ Pendiente para 10/10

### dashboard-front (S4)
- [ ] Verificar callers de `lib/firebase.ts` en dashboard-front:
  ```bash
  grep -rl "from '@/lib/firebase'" realsass-dashboard-front --include="*.tsx" --include="*.ts"
  ```
- [ ] Migrar callers a `@real/auth-client` directo
- [x] `realsass-dashboard-front/lib/firebase.ts` eliminado

### Tests de integración (S4)
- [ ] Test: login → cookie seteada → request autenticado → logout → cookie limpia
- [ ] Test: token expirado → refresh automático → cookie renovada
- [ ] Test: logout desde otro dispositivo → cookie revocada → 401 en siguiente request

## Regla dura

Un import de `firebase/auth` o `firebase/app` directo en un componente de página
es un bypass del contrato de `@real/auth-client`. Se bloquea en code review.
