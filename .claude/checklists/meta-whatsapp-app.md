# Checklist — App de Meta para WhatsApp por organización (ADR-025 / ADR-024 de ecosistema-ms)

> Lo que sigue pasa en el panel de Meta (developers.facebook.com) y lo hace una persona con acceso al negocio: no se puede
> automatizar desde el código. Los nombres de menús y los requisitos de Meta **cambian**: confirmar cada paso contra la
> documentación vigente de "WhatsApp Embedded Signup" y "Tech Provider" antes de comprometer plazos con clientes.
> Nada de esto está hecho todavía (2026-10-20).

## 1. App y negocio (bloquea el resto)

- [ ] Una sola app de Meta para toda la plataforma (hoy "welver"), tipo Business, con los productos **WhatsApp** y **Facebook Login for Business**.
- [ ] Negocio de la plataforma **verificado** en el Business Manager.
- [ ] Alta como **Tech Provider** y **App Review** con acceso avanzado a `whatsapp_business_management` y `whatsapp_business_messaging` (requieren video de demostración y política de privacidad pública). Mientras no esté aprobado, solo conectan cuentas con rol en la app (modo desarrollo).
- [ ] App en modo **Live** cuando se apruebe.

## 2. Embedded Signup → `config_id`

- [ ] En Facebook Login for Business → Configuraciones, crear una configuración de **WhatsApp Embedded Signup** (permisos de WhatsApp). El id resultante es el `config_id`.
- [ ] Facebook Login → Configuración: agregar el dominio del panel del dueño (`realsass-sass-front`, local y producción) en **dominios permitidos del SDK de JavaScript** y como URI de redirección válido.

## 3. Webhook único

- [ ] Producto WhatsApp → Configuración → Webhook, objeto **WhatsApp Business Account**:
  - URL de callback: `https://<chatia-backend>/api/v1/webhooks/whatsapp` (**sin** id de número: Meta tiene una sola URL por app).
  - Verify token: el valor de `META_WEBHOOK_VERIFY_TOKEN` (cualquier cadena larga y aleatoria; la elegimos nosotros).
  - Suscribir el campo `messages`.
- [ ] El alta de cada cliente suscribe su WABA a la app (`subscribed_apps`); chatia lo hace y lo **verifica** en cada conexión.

## 4. Variables de entorno

| Servicio | Variable | Valor / de dónde sale |
|---|---|---|
| chatia-backend | `META_APP_ID` | Id de la app (Configuración básica) |
| chatia-backend | `META_APP_SECRET` | App Secret (Configuración básica). **Solo servidor**, nunca en un front |
| chatia-backend | `META_WEBHOOK_VERIFY_TOKEN` | La cadena del paso 3 |
| chatia-backend | `META_GRAPH_VERSION` | Formato `v23.0`; confirmar la vigente |
| chatia-backend | `CHANNEL_TOKEN_ENCRYPTION_KEY` | Clave que cifra los tokens de los clientes (32 bytes) |
| chatia-backend | `FIREBASE_PROJECT_ID` | Mismo proyecto Firebase de sass-back; el ecosistema debe estar registrado (`prisma/seed-welver.ts`) |
| chatia-backend | `INTERNAL_API_KEY` | **Mismo valor** que en sass-back |
| realsass-sass-back | `CHATIA_BACK_URL` | URL base de chatia, sin barra final |
| realsass-sass-back | `INTERNAL_API_KEY` | Mismo valor que en chatia |
| realsass-sass-front | `NEXT_PUBLIC_META_APP_ID` | Mismo App ID (es público) |
| realsass-sass-front | `NEXT_PUBLIC_META_CONFIG_ID` | El `config_id` del paso 2 |
| realsass-sass-front | `NEXT_PUBLIC_META_GRAPH_VERSION` | Misma versión que chatia |

`NEXT_PUBLIC_*` se incrustan al compilar: en Railway cargarlas como **Build Variables** y volver a desplegar.

## 5. Prueba de punta a punta (una cuenta con rol en la app)

1. Levantar chatia (con Redis), sass-back y sass-front con las variables de arriba.
2. Entrar como dueño → `/profile/config` → "Conectar WhatsApp" → completar el flujo de Meta con un número de prueba.
3. La sección debe mostrar el número y "Conectado" (el alta verificó la suscripción de la WABA).
4. Escribirle al número desde otro WhatsApp: el mensaje debe entrar por el webhook único, pasar por la cola y recibir respuesta del asistente.
5. "Desconectar": la sección vuelve al estado vacío y un mensaje nuevo ya no se procesa.
6. Revisar que ninguna respuesta de la API ni de la consola contenga tokens.

## Pendiente conocido (no bloquea la prueba)

- Normalización de números: hoy solo Argentina y México (`phone-normalization.ts`); falta cubrir otros países.
- Plantillas de mensaje (necesarias para escribir fuera de la ventana de 24 h): `sendMessage` solo envía texto e imagen.
- Token permanente / renovación: el estado de la sección avisa cuando el token venció y hay que reconectar.
