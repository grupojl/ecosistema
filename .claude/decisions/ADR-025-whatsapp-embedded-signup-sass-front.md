# ADR-025: Conectar WhatsApp desde el panel del dueño — realsass-sass-front (Embedded Signup)

**Fecha:** 2026-10-20
**Estado:** Aceptado (2026-10-20), opción B elegida. **Implementado y compilando, sin probar contra Meta** (falta la app de Meta: `checklists/meta-whatsapp-app.md`).

> Este ADR cubre solo la parte de **este repo**. La decisión de plataforma (una app de Meta Tech Provider,
> Embedded Signup, `ChannelAccount` y suscripción de la WABA) la tomó ecosistema-ms:
> `C:\Users\magnum\Desktop\test\ecosistema-ms\.claude\decisions\ADR-024-whatsapp-tech-provider-embedded-signup.md`.
> Los dos repos tienen un "ADR-024" distinto (allá WhatsApp, acá `ADR-024-ui-ux-adaptable`); no chocan porque son
> repos separados, y por eso este es el ADR-025.

## Contexto

Cada organización debe conectar **su propio** WhatsApp y hacerse cargo de su WABA y de su gasto en Meta (ADR-024 de ecosistema-ms).
Eso se hace con Embedded Signup, que arranca en el navegador del cliente: solo un front puede mostrarlo. **Por ahora es el panel del dueño (`realsass-sass-front`)**, que es desde donde se administra la organización (config, secretos, colaboradores); los colaboradores del `realsass-dashboard-front` no lo ven.

Estado real al 2026-10-20:

- **Probado (en ecosistema-ms, con un atajo):** el circuito webhook → cola → IA → respuesta por la Graph API, con una org de humo
  creada por script y el token temporal de una persona. No es el flujo de producción.
- **No existe en este repo:** ninguna pantalla ni llamada a `channel-accounts`. El dashboard (colaboradores) solo tiene `/chat`, `/chat/proyectos`
  y `/chat/prueba` (esta última, código de prueba aislado).
- **Excepción vigente:** `realsass-dashboard-front` habla con chatia por REST manual (`lib/chat-ia-client.ts`), con un TODO para
  migrar a tRPC. El principio no negociable del repo dice que lo interno va por tRPC.

## Decisión

1. **Sección "WhatsApp" en `realsass-sass-front`**, dentro de `/profile/config` junto a webhooks y secretos (se autoriza ahí por ahora; el dashboard de colaboradores no la tiene;
   si más adelante hace falta verla desde el dashboard, sería solo lectura). Contiene:
   - botón que abre Embedded Signup con el SDK de Facebook (cargado solo en esta pantalla);
   - **estado de conexión** de la cuenta (conectada, pendiente, con error), leído del back;
   - **desconexión**.
2. **Lo que el navegador entrega al back es solo el `code` de Embedded Signup** (y los ids que devuelve el SDK). El canje por el
   token del cliente, el cifrado y la suscripción de la WABA son del back (ecosistema-ms). El front **nunca** ve ni guarda
   `accessToken` ni `appSecret`.
3. **Permisos por rol de la organización:** solo los roles autorizados pueden conectar o desconectar; los demás ven el estado en
   solo lectura o no ven la pantalla. El chequeo vale **en el back** (la UI solo oculta). Qué roles exactamente: ver pregunta abierta 1.
4. **Estados de la vista** (ADR-024-ui-ux-adaptable): cargando, vacío (sin WhatsApp conectado), error y sin permisos. Compact primero
   (el dueño puede estar en el celular).
5. **El diseño del canal de comunicación se decide aparte** (sección siguiente). Lo que sí queda fijado: **no se agrega más fetch
   manual**. La feature nace contra un contrato tipado.

## Canal sass-front ↔ chatia — decidido: opción B (2026-10-20)

El principio "todo interno por tRPC" choca con `lib/chat-ia-client.ts` (REST con TODO). Opciones:

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| **A. tRPC directo a chatia** (recomendada) | chatia expone un `ChatIaAppRouter` en `@real/trpc` (ya previsto en el TODO de `chat-ia-client.ts`); sass-front lo consume con un cliente tRPC propio (en un front con más de un back, contexto propio: ver `services/realsass-dashboard-front.md`) | Cumple el principio; contrato end-to-end (ADR-019); es la dirección que ya lleva el chat IA; la feature nueva nace tipada y de paso arrastra la migración de `chat-ia-client.ts` | Hay que construir el router en chatia y publicarlo en el `dist` de `@real/trpc` (orden de build, ADR-019); chatia vive en otro repo, así que el contrato cruza repos |
| **B. tRPC vía `realsass-sass-back`** | sass-front llama a un router `channels.*` en sass-back, su back habitual, que reenvía a chatia por gRPC o HTTP interno | Cumple el principio; sass-back ya resuelve rol/permisos de la organización; el navegador no toca a chatia | Un salto más y un proxy que mantener (aunque sass-front ya usa solo tRPC de sass-back, así que no suma un segundo cliente); sass-back pasa a conocer un dominio que no es suyo |
| **C. REST directo a chatia** (status quo) | `chatIaFetch('/channel-accounts', …)` | Es lo más rápido; chatia ya lo expone | Agrava la excepción al principio, sin tipado extremo a extremo, y suma una pantalla sensible a un cliente que ya está marcado para eliminarse |

**Se eligió B.** sass-front ya habla solo tRPC con sass-back (cookie + `x-organization-id`), así que no suma un segundo cliente ni una excepción al principio; sass-back ya resuelve rol OWNER y step-up; y el navegador nunca toca a chatia.

```
sass-front --tRPC whatsapp.{status,connect,disconnect}--> sass-back --HTTP interno + x-internal-api-key--> chatia /internal/whatsapp/:orgId
```

- **sass-back** (`src/whatsapp/`, `trpc/routers/whatsapp.router.ts`): `ownerProcedure`; `connect` y `disconnect` con `enforceStepUp`; la organización sale del contexto validado, nunca del input. Variable `CHATIA_BACK_URL` (+ `INTERNAL_API_KEY`, igual en chatia); sin ellas responde 503 (falla cerrado). Un 5xx de chatia no se reenvía tal cual.
- **chatia** (ecosistema-ms): endpoints internos `GET /internal/whatsapp/:orgId`, `POST .../embedded-signup`, `DELETE .../:id`, protegidos por `InternalApiKeyGuard`. Aseguran la organización en el ecosistema, canjean el `code`, verifican que el número pertenece a la WABA, suscriben la app y **verifican** la suscripción.
- La opción A (router propio de chatia) sigue siendo el destino de `chat-ia-client.ts` (DT-WA-03), pero ya no bloquea esta feature.

## Preguntas abiertas (no se inventan respuestas acá)

1. ¿Qué roles pueden conectar/desconectar? Hoy los roles son OWNER y COLLABORATOR con permisos JSONB (ADR-001). Propuesta a validar:
   solo OWNER, porque la WABA y el pago quedan a nombre de la organización.
2. Forma exacta de la respuesta de estado (campos, valores) y de la desconexión: la define el endpoint de ecosistema-ms, que no existe todavía.
3. ¿Un solo número de WhatsApp por organización o varios? El modelo `ChannelAccount` permite varios; el producto no lo decidió.
4. Si la sección se queda en `/profile/config` o pasa a una página propia, y si el dashboard de colaboradores la muestra en solo lectura.
5. Qué pasa en el panel si Meta suspende la app compartida (riesgo ya anotado en el ADR-024 de ecosistema-ms): mensaje al cliente y a quién escala.
6. Si se elige A: dónde vive el `ChatIaAppRouter` y cómo entra al build de `@real/trpc` sin romper el orden de ADR-019.

## Respuestas a las preguntas abiertas (2026-10-20)

1. **Roles:** solo OWNER (`ownerProcedure`). Los colaboradores no ven ni usan la sección.
2. **Forma del estado:** `{ accountId, status: CONNECTED | ERROR, displayPhone, errorMessage } | null`, inferida del contrato (`contracts/whatsapp-channel.md`). `ERROR` incluye token vencido o WABA sin suscripción.
3. **Cuántos números:** el panel muestra **uno** (el WhatsApp activo de la organización). El modelo permite varios; queda abierto si el producto los quiere (DT-WA-04).
4. **Ruta:** sección dentro de `/profile/config`.
5. **Suspensión de la app compartida:** sin definir (DT-WA-04).
6. Resuelta con la opción B: no hay `ChatIaAppRouter` por ahora.

## Alternativas descartadas

- **Pedir a cada organización que cree su propia app de Meta** — descartada en ecosistema-ms (App Review por cliente, soporte nuestro).
- **Cargar Phone ID + token a mano desde el front** — el token quedaría en manos de un operador y en el navegador; los temporales vencen en 24 h.
- **Hacer el canje del `code` en el navegador** — exigiría exponer `appSecret` al cliente. Prohibido.

## Consecuencias

**Se gana:** onboarding de un clic, sin secretos en el front, y una feature que no suma deuda de fetch manual (con la opción A).

**Se sacrifica / queda como deuda consciente:** la pantalla depende de que ecosistema-ms construya el endpoint de Embedded Signup y de que
Meta apruebe la app (Tech Provider, acceso avanzado): hoy ninguna de las dos cosas existe. El SDK de Facebook es una dependencia externa
cargada en el navegador (checklist R4 de ADR-018: dueño y CSP de la pantalla).

## Referencias

- `.claude/contracts/whatsapp-channel.md` (qué manda y recibe el front)
- `ADR-024` de ecosistema-ms (ruta arriba), `ADR-018-politica-dependencias.md`, `ADR-019-contratos-trpc-desde-dist.md`, `ADR-024-ui-ux-adaptable.md`
- `realsass-sass-front/features/whatsapp`, `realsass-sass-front/components/config/whatsapp-section.tsx`, `realsass-sass-front/app/profile/config/page.tsx`
- `realsass-dashboard-front/lib/chat-ia-client.ts` (la excepción de fetch manual que existe hoy)
- `ecosistema-ms/chatia-backend/src/modules/common/channel-accounts/channel-accounts.controller.ts`
