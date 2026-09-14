# 08 — Norte de testing: qué testear y por qué

> Referentes: **Stripe** (tests sobre efectos de dinero), **Google** (Beyoncé Rule —
> toda invariante tiene un test que la rompe deliberadamente),
> **Vercel** (E2E pragmático — paths críticos, no cobertura decorativa).
>
> Aplica a los tres monorepos. Los ejemplos usan el stack real del ecosistema.

---

## El principio que unifica los tres referentes

**Stripe:** un test que solo prueba el happy path de un pago no protege nada.
El test que importa es el que verifica qué pasa cuando el provider falla.

**Google (Beyoncé Rule):** "if you liked it you should have put a test on it."
Toda invariante de negocio que te importa tiene un test que la rompe deliberadamente.
Si `ecosystemId` es obligatorio en toda query, hay un test que lo omite y verifica
que los datos de otro tenant no aparecen — no que "falla graciosamente".

**Vercel:** no unit tests de componentes que solo prueban que React renderiza.
E2E en los 3-5 paths que, si se rompen, el negocio para. El resto es ruido.

---

## Regla 1 — Services: testear invariantes de negocio, no implementación

### Qué NO testear

```ts
// ❌ Test que prueba la implementación — se rompe si refactorizás Prisma
it('llama a prisma.payment.create', async () => {
  await service.createPayment(input);
  expect(prisma.payment.create).toHaveBeenCalled(); // inútil
});
```

### Qué SÍ testear

```ts
// ✅ Invariante de dominio — tenant isolation (Google Beyoncé Rule)
it('nunca retorna datos de otro tenant', async () => {
  await seedPayment({ organizationId: 'org-A', ecosystemId: 'eco-1' });

  const result = await service.listPayments({
    organizationId: 'org-B', // tenant diferente
    ecosystemId:    'eco-1',
  });

  expect(result.data).toHaveLength(0); // org-B no ve los datos de org-A
});

// ✅ Invariante de negocio — fallback cuando el provider falla (Stripe)
it('activa el provider de fallback cuando el CB está abierto', async () => {
  cbService.forceOpen('mercadopago');

  const result = await service.processPayment(paymentInput);

  expect(result.provider).toBe('stripe'); // usó el fallback
  expect(result.status).toBe('SUCCESS');
});

// ✅ Invariante de audit — la acción se registra ANTES de ejecutar
it('crea AdminAction antes de suspender la org', async () => {
  const auditSpy = jest.spyOn(auditService, 'create');
  const suspendSpy = jest.spyOn(orgClient, 'suspend');

  // Forzar fallo en la ejecución
  suspendSpy.mockRejectedValueOnce(new Error('timeout'));

  await expect(service.suspendOrg(input)).rejects.toThrow();

  // El audit debe existir aunque la acción haya fallado
  expect(auditSpy).toHaveBeenCalledBefore(suspendSpy);
});
```

---

## Regla 2 — Guards: testear allowlist y tenant isolation

Los guards son el límite del sistema. Un bug acá no lo detecta el usuario — lo
detecta el atacante. Cobertura 100% sin excepción.

```ts
// ✅ AdminGuard — UID no autorizado recibe 403, no 401
it('rechaza UID fuera de la allowlist con 403', async () => {
  const ctx = mockContext({ uid: 'uid-no-autorizado' });
  await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
});

// ✅ TenantGuard — ecosystemId del token no coincide con el recurso
it('bloquea acceso cross-tenant', async () => {
  const ctx = mockContext({
    ecosystemId: 'eco-1',         // token del ecosistema 1
    params: { ecosystemId: 'eco-2' }, // intentando acceder al ecosistema 2
  });
  await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
});

// ✅ FirebaseAuthGuard — token expirado recibe 401
it('rechaza token expirado con 401', async () => {
  firebaseAdmin.verifyIdToken.mockRejectedValueOnce(
    new Error('Firebase ID token has expired')
  );
  const ctx = mockContext({ token: 'token-expirado' });
  await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
});
```

---

## Regla 3 — E2E (Playwright): solo los paths que paran el negocio

No E2E de cada feature. Solo los 3-5 flows que, si se rompen, el negocio para.
Vercel llama a esto "smoke tests" — la pregunta es "¿está encendido?", no "¿funciona todo?".

### Paths críticos por repo

**superadmin:**
```
1. Login Firebase → redirige a /dashboard (auth rota = nadie entra)
2. Dashboard con 0 alertas → muestra "Todo operativo" (render roto = ceguera operativa)
3. Suspender org → ConfirmDialog → audit trail creado (acción destructiva sin audit = violación)
```

**ecosistema (welver):**
```
1. Login → dashboard de la org (auth rota = todos los clientes bloqueados)
2. Crear producto → aparece en storefront (catalog roto = ventas paradas)
3. Checkout → orden creada → stock decrementado (flujo de dinero roto = pérdida directa)
```

**ecosistema-ms:**
```
1. Mensaje entrante → respuesta del agente IA (chatia roto = todos los chats muertos)
2. Pago iniciado → procesado por provider → webhook recibido (pasarela rota = cobros parados)
3. Job encolado → procesado → DLQ vacía (workers rotos = acumulación silenciosa)
```

### Estructura de E2E

```
e2e/
  auth.spec.ts          ← login / logout / redirect
  critical-flows.spec.ts ← los paths que paran el negocio
  # nada más — no E2E de cada página
```

---

## Cobertura mínima por capa

| Capa | Cobertura | Qué se mide |
|------|-----------|-------------|
| Guards | 100% | Todos los casos de rechazo |
| Domain services (invariantes) | 85% | Paths de error, tenant isolation, efectos de dinero |
| Integration clients / adapters | 80% | Fallbacks, CB abierto, timeout |
| Controllers HTTP | 70% | Contratos de entrada/salida (Supertest) |
| Frontend hooks | 70% | Lógica de estado, no render |
| E2E | 3-5 flows | Paths que paran el negocio |

**Lo que no se mide:** cobertura de líneas en componentes UI, getters/setters triviales,
módulos de configuración de NestJS, factories de testing.

---

## Señal de que el test está bien escrito

Un test está bien escrito si:
1. Su nombre describe **qué invariante protege**, no qué función llama.
2. Si lo borrás y el código se rompe en producción, el test lo hubiera detectado.
3. Si refactorizás la implementación sin cambiar el comportamiento, el test sigue pasando.

Un test está mal escrito si:
1. Prueba que `prisma.findMany` fue llamado.
2. Solo cubre el happy path.
3. Se rompe cuando movés código a otro archivo sin cambiar lógica.
