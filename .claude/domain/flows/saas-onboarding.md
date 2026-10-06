# Flow: SaaS Onboarding — Registro → Organización activa

> Estado: 🔲 Por completar
> Servicios: `realsass-sass-back` · `realsass-sass-front`
> Usuarios: visitante que se registra por primera vez

---

## Quién lo recorre

Un dueño de negocio que llegó a la landing y quiere crear su tienda.
No necesariamente técnico. Puede venir de anuncio, referido o búsqueda orgánica.

---

## Pantallas involucradas

| Pantalla | Ruta | Servicio |
|---------|------|---------|
| Landing | `/` | sass-front (estático) |
| Login / Registro | `/login` | sass-front → Firebase Auth |
| SSO callback | `/auth/sso` | sass-front → sass-back tRPC auth |
| Dashboard inicial | `/dashboard` | sass-front → sass-back tRPC |
| Invitación colaborador | `/invite/[token]` | sass-front → sass-back tRPC |

---

## Pasos

```
1. Visitante llega a la landing (/)
   → Ve propuesta de valor, pricing, CTA
   → TODO: ¿hay trial gratuito? ¿requiere tarjeta?

2. Click en CTA → /login
   → Firebase Auth (Google SSO o email/password)
   → TODO: ¿registro separado o solo login con auto-registro?

3. Firebase callback → /auth/sso
   → sass-back verifica token Firebase
   → Crea o recupera User + Organization en DB
   → Setea custom claims (organizationId, role: OWNER)
   → Redirige a /dashboard

4. Primera vez en /dashboard
   → TODO: ¿hay onboarding wizard paso a paso?
   → TODO: ¿qué ve el tenant con la tienda vacía?

5. Configuración inicial mínima para estar live
   → TODO: pasos obligatorios (nombre de tienda, slug, un producto)
```

---

## Estados alternativos

> TODO: Firebase falla, email ya existe, plan expirado, invitación vencida.

---

## Invariantes

- Un usuario nunca pertenece a dos organizaciones sin invitación explícita
- Los custom claims de Firebase siempre reflejan el estado real en DB
- Un tenant sin organización activa no accede al dashboard de tienda
