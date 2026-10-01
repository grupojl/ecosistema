# Datos PII y política de retención — welver/

**Última actualización:** 2026-09-30
**Aplica a:** realsass-sass-back (DB sass), realsass-ecommerce-back (DB ecommerce)

---

## Modelos con datos PII

### realsass-sass-back (DB: realsass_back_db)

| Modelo | Campo PII | Tipo | Retención |
|--------|-----------|------|-----------|
| `User` | `email` | PII directa | Mientras la cuenta está activa |
| `User` | `firebaseUid` | Identificador externo | Mientras la cuenta está activa |
| `Collaborator` | `email` | PII directa | Mientras la colaboración está activa |
| `AuditLog` | `ipAddress` | PII indirecta | 90 días → eliminar o anonimizar |
| `AuditLog` | `userId` | Referencia a User | 90 días |

### realsass-ecommerce-back (DB: realsass_ecommerce_db)

| Modelo | Campo PII | Tipo | Retención |
|--------|-----------|------|-----------|
| `Customer` | `email` | PII directa | Mientras la cuenta está activa |
| `Customer` | `name` | PII directa | Mientras la cuenta está activa |
| `Order` | `shippingAddress` | PII directa | 5 años (obligación fiscal en LATAM) |
| `Order` | `customerId` | Referencia a Customer | 5 años |

---

## Política de retención

| Tipo de dato | Retención | Acción al vencimiento |
|---|---|---|
| Cuenta activa (User/Customer) | Indefinido | N/A — datos activos |
| Cuenta eliminada por usuario | 30 días | Anonimizar: email → deleted_<uuid>@deleted.real |
| AuditLog (logs de cambios de config) | 90 días | Eliminar filas > 90 días |
| Orders (obligación fiscal) | 5 años | Mantener pero anonimizar Customer si se elimina |
| Logs de Railway (pino) | 7-30 días | Railway los elimina automáticamente |

---

## Eliminación de datos de cliente (E10-02)

Implementado en `customer.deleteAccount` procedure tRPC en ecommerce-back.
Ver: `realsass-ecommerce-back/src/customers/customer-delete.router.ts`

El proceso de eliminación:
1. Anonimiza el email del Customer: `deleted_<uuid>@deleted.real`
2. Elimina el nombre y campos de contacto
3. Mantiene Orders con customerId (obligación fiscal) pero sin PII legible
4. Genera AuditLog del evento de eliminación

---

## Datos que NO deben aparecer en logs (E10-03)

Los siguientes campos NUNCA deben loguearse en texto plano:
- `email` de User o Customer
- `shippingAddress` de Order
- `FIREBASE_PRIVATE_KEY`
- `SESSION_COOKIE_SECRET`
- `CONFIG_MASTER_KEY`

Los campos están protegidos por:
- pino-nestjs no loguea `req.body` por defecto
- ThrottlerGuard solo loguea IP y path, no payload
- SecurityLogger solo loguea uid (Firebase UID) no email

---

## Jurisdicción y marco legal

**LATAM — Argentina / otros países LATAM:**
- LGPD (Brasil): datos de clientes brasileños
- Ley 25.326 Argentina: datos de usuarios argentinos
- En caso de duda: aplicar el estándar más restrictivo

**Recomendación para certificación futura:** ISO 27001 o SOC 2 Type II
