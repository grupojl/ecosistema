# 08 — Norte de testing: qué testear y por qué

> Referentes: **Stripe** (tests sobre efectos de dinero), **Google** (Beyoncé Rule),
> **Vercel** (E2E pragmático — paths críticos, no cobertura decorativa).

---

## El principio

**Stripe:** el test que importa es el que verifica qué pasa cuando el provider falla.
**Google:** toda invariante tiene un test que la rompe deliberadamente.
**Vercel:** E2E solo en los paths que, si se rompen, el negocio para.

---

## Regla 1 — Services: invariantes de negocio, no implementación

```ts
// ❌ prueba implementación — inútil si refactorizás
expect(prisma.payment.create).toHaveBeenCalled();

// ✅ invariante de tenant isolation
it('nunca retorna datos de otro tenant', async () => {
  await seedPayment({ organizationId: 'org-A' });
  const result = await service.listPayments({ organizationId: 'org-B' });
  expect(result.data).toHaveLength(0);
});

// ✅ audit trail antes de ejecutar
it('crea AdminAction antes de suspender', async () => {
  const auditSpy   = jest.spyOn(auditService, 'create');
  const suspendSpy = jest.spyOn(orgClient, 'suspend');
  suspendSpy.mockRejectedValueOnce(new Error('timeout'));
  await expect(service.suspendOrg(input)).rejects.toThrow();
  expect(auditSpy).toHaveBeenCalledBefore(suspendSpy);
});
```

---

## Regla 2 — Guards: cobertura 100%

```ts
// ✅ UID no autorizado → 403
it('rechaza UID fuera de allowlist con 403', async () => {
  const ctx = mockContext({ uid: 'uid-no-autorizado' });
  await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
});

// ✅ token expirado → 401
it('rechaza token expirado con 401', async () => {
  firebaseAdmin.verifyIdToken.mockRejectedValueOnce(new Error('token has expired'));
  await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
});
```

---

## Regla 3 — E2E: solo paths que paran el negocio

```
superadmin:
  1. Login Firebase → redirige a /dashboard
  2. Dashboard 0 alertas → EmptyState "Todo operativo"
  3. Suspender org → ConfirmDialog → AdminAction creado
```

---

## Cobertura mínima

| Capa | Cobertura |
|------|-----------|
| Guards | 100% |
| Domain services | 85% |
| Integration clients | 80% |
| Controllers HTTP | 70% |
| Frontend hooks | 70% |
| E2E | 3-5 flows críticos |

---

## Señal de test bien escrito

1. El nombre describe qué invariante protege, no qué función llama
2. Si lo borrás y el código se rompe en prod, el test lo hubiera detectado
3. Si refactorizás sin cambiar comportamiento, el test sigue pasando
