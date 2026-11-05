# Mexus — Dominio

> Estado: borrador v0.9. Lo marcado con **[Propuesta]** es una mejora sugerida sobre la idea original y está pendiente de confirmar. Lo marcado con **[Decidido]** sale de las respuestas dadas a las preguntas abiertas (rondas 1 y 2). Todo lo demás sale de la idea original.

## Pilares y camino al 10/10

> **Empresa 10/10 de referencia:** **Toast** (y **Fudo** como vara local en Argentina).
> **Nivel actual de la especificación: 8/10.** Equivale a la definición de producto de un MVP muy bien armado de una startup de punto de venta gastronómico en etapa semilla: flujos, reglas, cobro, hardware, expansión y metas con valor casi completos, pero todavía sin producto ni clientes. Lo que lo frena: el piloto va sin soporte humano (con un boliche de noche), el "pedido con error" solo cuenta reclamos, la v2 no tiene metas numéricas y no hay comparativo con Toast y Fudo.
> **Escala de referencia:** Square 9,5 · Toast 9 · Mexus 8.

### Pilares

| # | Pilar | Hoy | Para llegar al 10 |
|---|---|---|---|
| 1 | **Producto y flujos** (barra, mesas, pedidos, pagos, offline) | Sólido: v1 a v4 definidas | Probado en locales reales, con hardware certificado (impresoras, pantallas de comandas) y soporte |
| 2 | **Modelo de negocio** (2,5% al comensal, sin membresía) | Definido, con umbral de 30% por app, plan B (cargo incluido) y prueba A/B de 4 semanas en 2 locales; no validado | Piloto que confirme que el comensal acepta el cargo, comparación contra Toast y Fudo, y costo y ganancia por local |
| 3 | **Pagos y cumplimiento** | Pasarela elegida (Mercado Pago, luego Stripe); contracargos a cargo del local con evidencia del sistema; el 2,5% se separa con Mercado Pago por autorización (OAuth), a validar en la v1 | Modelo fiscal por país, antifraude, conciliación y reembolsos auditados |
| 4 | **Confiabilidad y seguridad** | Parcial: 99,5% con monitoreo externo y panel de estado, respaldo diario, doble verificación y registro de acciones; el piloto va sin soporte humano (solo documentación y chat de IA), también de noche | Metas de disponibilidad y velocidad, respaldos, auditoría de acciones y modo sin conexión probado en campo |
| 5 | **Datos y métricas** | Casi completo: línea base medida en v1 y metas con valor en v3 y v4; la v2 solo mide, sin meta numérica; "error" solo cuenta reclamos | Métricas de éxito por versión (tiempo de atención, errores, ventas por mesa) y ciclo de mejora continua |
| 6 | **Mercado y crecimiento** | Parcial: EE.UU. con piloto en una ciudad, propinas por mozo y documentación en el idioma local; sin plan de primeros locales ni comparativo con Toast y Fudo | Plan para los primeros locales, onboarding, soporte y mapa de competidores |

### Qué falta para el 10/10 por versión

| Versión | Hoy | Qué falta para el 10/10 | Preguntas (sección 16) |
|---|---|---|---|
| **Generales** | 8/10 | Comparativo con Toast y Fudo (decidido no tenerlo por ahora) | Se retoma con datos del piloto |
| **v1** | 8/10 | Cobertura de noche sin soporte humano y detección de errores que el cliente no reclama | Ronda 7, v1 1–2 |
| **v2** | 8/10 | Meta numérica para ticket promedio y rotación de mesas | Ronda 7, v2 1 |
| **v3** | 8,5/10 | Solo queda validarlo con locales reales | Con producto funcionando |
| **v4** | 8/10 | Solo queda validarlo con locales reales | Con producto funcionando |

### Requisitos para el 10/10

**Se pueden resolver en este documento (llevan a 8,5):**
- Modelo fiscal y legal por país.
- Requisitos de seguridad, disponibilidad y rendimiento.
- Costo y ganancia por local (unidad económica).
- Métricas de éxito por versión.
- Plan de salida al mercado y análisis de competidores.

**Solo con producto funcionando (llevan a 9–10):**
- Pilotos con locales reales que validen el cargo del 2,5%.
- Hardware certificado y soporte operando.
- Disponibilidad medida de forma sostenida.
- Un catálogo de apps con uso real.

## 1. Resumen

Mexus es un sistema de gestión de **barra de servicio o mostrador (Front Bar)**, para el punto de venta y la zona de caja de locales gastronómicos.

Optimiza el proceso de la barra o mostrador, las mesas y los pedidos para **agilizar la atención al cliente**. El local tiene un dashboard para administrar su entorno, un punto de venta para su equipo y un **storefront** público desde el que el cliente gestiona su experiencia.

### Idea original (se conserva tal cual como base)

- Sistema de gestión de barra de servicio o mostrador (Front Bar), para gestión de punto de venta y zona de caja.
- Optimizar el proceso de las barras o mostrador, mesas y pedidos para agilizar la atención al cliente.
- Hay una organización con owners y colaboradores.
- El owner tiene acceso para cargar las credenciales de su pasarela de pago y de la atención al cliente con IA.
- El dashboard es para la gestión del entorno, con accesos para colaboradores. Estaría bueno que el owner pueda crear **tipos de colaboradores** para dejar seteados los tipos de acceso.
- Se puede cargar el stock de forma aproximada, no exacta: por ejemplo "10 pizzas", no "1 kg de harina y 100 g de queso = 10 pizzas".
- Entran órdenes desde las apps integradas con IA, que gestiona los pedidos, o desde una mesa.
- El storefront es la carta de presentación del local, tipo Linktree, para que el usuario gestione su experiencia desde ahí:
  - Llamar a un colaborador (mozo).
  - Generar un pedido.
  - Ver el estado del pedido.
  - Ver la carta.
  - Generar pagos y dejar propina al mozo.

### Modelo de negocio

- **Se cobra un 2,5% sobre la venta.**
- **No hay membresía:** la barrera de entrada para los negocios es cero. Un local empieza sin pagar nada y la plataforma gana cuando el local vende.

**[Decidido]**
- **Quién lo paga:** el **consumidor**, como **cargo extra (extra fee)**. El local recibe el valor completo de su consumo.
- **Sobre qué ventas se aplica:** solo las ventas hechas **dentro del sistema**.
- **Facturación:** el local gestiona su facturación fiscal con sus propios medios. La plataforma **solo provee el software** y entrega un **CSV** con las ventas, como hacen Stripe y otras plataformas. No hay país ni normativa fiscal fija por ahora.

**[Propuesta] Reglas a definir**
- **Qué significa "dentro del sistema":** pagos online (storefront y chat) y, además, ventas de mostrador registradas por el cajero. Si solo cuentan los pagos por pasarela, el efectivo y el posnet del local quedan fuera (ver preguntas generales).
- **Cómo se cobra:**
  - **Pagos online:** la pasarela suma el cargo al total del comensal y lo separa para la plataforma.
  - **Ventas de mostrador registradas:** si se decide cobrarlas, el cargo se suma al ticket y el sistema lo liquida al local por período.
- **Transparencia hacia el comensal:** el cargo se muestra como línea separada antes de pagar (consumo, cargo de servicio, propina). Es importante por normativa de protección al consumidor.
- **Qué incluye la base de cálculo:** consumo sin impuestos y **sin propinas**. La propina es del mozo y no paga comisión.
- **Devoluciones y anulaciones:** el cargo se revierte en proporción.
- **Transparencia hacia el local:** ve en el dashboard cuánto se cobró y por qué venta.
- **Costos de la pasarela:** el 2,5% es de la plataforma. La comisión de Stripe o Mercado Pago es aparte y la paga el local.
- **Contenido del CSV:** fecha, cuenta, ítems, consumo, propina, cargo de plataforma, medio de pago, impuestos informados y estado.

## 2. Actores

| Actor | Quién es | Qué busca |
|---|---|---|
| **Owner** | Dueño de la organización. | Operar el local y cobrar con su propia cuenta. |
| **Colaborador** | Empleado con un tipo de colaborador asignado. | Hacer su tarea rápido (tomar pedidos, preparar, cobrar). |
| **Cliente** | Comensal en el local o que retira. Puede iniciar sesión para ver sus tickets y pedidos. | Pedir, seguir su pedido y pagar sin esperar. |
| **Terminal** | Dispositivo del local (caja, barra, cocina). | Operar de forma continua. |
| **Superadmin de la plataforma** | Equipo dueño de Mexus. | Gestionar organizaciones y estadísticas globales. |

## 3. Glosario

- **Organización:** el negocio cliente (tenant). En la v1 tiene un solo local.
- **Local:** sede física con barra, mesas o ambas.
- **Front Bar:** barra o mostrador de atención y cobro.
- **Mesa:** lugar de consumo, identificado en el storefront por un código o QR.
- **Storefront:** página pública del local, tipo Linktree, para el cliente.
- **Carta:** productos que ofrece el local.
- **Tipo de colaborador:** conjunto de permisos con nombre, creado por el owner (por ejemplo "Mozo" o "Cajero").
- **Pedido:** conjunto de ítems pedidos por un cliente.
- **Stock aproximado:** cantidad disponible en unidades del producto final (10 pizzas), no en ingredientes.
- **Propina:** monto que el cliente deja al mozo al pagar.
- **Cargo de plataforma (extra fee):** 2,5% que paga el consumidor sobre las ventas dentro del sistema. Es la única fuente de ingresos de la plataforma: no hay membresía.
- **Apps integradas:** aplicaciones internas o externas conectadas al local (chat con IA, delivery, reservas). Se desarrollan sobre todo en la v3.
- **Ticket:** comprobante interno del consumo que el cliente puede ver al iniciar sesión.

## 4. Roles y permisos

### Original
- **Owner:** dueño de la organización. Carga las credenciales de pago y de atención con IA.
- **Colaborador:** tiene accesos según su tipo. El owner puede crear tipos de colaborador para dejar los accesos preconfigurados.

### [Propuesta] Tipos de colaborador sugeridos de fábrica
El owner puede usarlos, editarlos o crear los suyos.

| Tipo | Acciones típicas |
|---|---|
| **Gerente** | Todo lo operativo: carta, stock, equipo (sin credenciales) y reportes. |
| **Cajero** | Cobra, abre y cierra caja, anula con autorización. |
| **Mozo** | Toma pedidos, atiende llamados de sus mesas, recibe propinas. |
| **Barra / Cocina** | Ve las comandas de su sector y marca el avance. |
| **Solo lectura** | Ve reportes, sin modificar. |

### Permisos
| Acción | Owner | Colaborador |
|---|---|---|
| Cargar credenciales de pago y de IA | Sí | No |
| Crear tipos de colaborador | Sí | No |
| Invitar colaboradores y asignar tipo | Sí | No |
| Editar carta y precios | Sí | Según tipo |
| Ajustar stock | Sí | Según tipo |
| Tomar y cobrar pedidos | Sí | Según tipo |
| Ver reportes | Sí | Según tipo |

### [Propuesta]
- Los permisos se limitan **por local** (relevante desde la v3, cuando haya varios).
- Las acciones sensibles (anular, descuentos, devoluciones) piden autorización de un tipo con permiso, y quedan registradas.

## 5. Entidades del dominio

| Entidad | Descripción |
|---|---|
| **Organización** | Tenant, con owner, estado y configuración. |
| **Local** | Sede física de la organización. [Decidido] Uno solo en la v1. |
| **Credenciales** | Pasarela de pago propia y canales de atención con IA. |
| **Tipo de colaborador** | Conjunto de permisos con nombre. |
| **Colaborador** | Usuario con un tipo asignado. |
| **Producto** | Ítem de la carta. [Propuesta] Con variantes, modificadores y sector de preparación. |
| **Stock** | Cantidad aproximada disponible por producto. |
| **Mesa** | Lugar de consumo, con estado y mozo asignado. |
| **Sesión de mesa** [Propuesta] | Cuenta abierta de una mesa mientras está ocupada. |
| **Pedido** | Ítems pedidos, con origen, estado y total. |
| **Llamado** | Pedido de atención de un cliente a un mozo. |
| **Pago** | Cobro de un pedido o una cuenta, con su cargo de plataforma. |
| **Propina** | Monto asociado a un pago y destinado a un mozo. |
| **Cuenta de cliente** | Usuario final que inicia sesión para ver sus tickets y pedidos. |
| **Ticket** | Comprobante interno de una cuenta pagada. |
| **Storefront** | Página pública del local, con tema y enlaces. |
| **Conversación** | Atención de chatia por una red. |

## 6. Gestión del entorno (dashboard)

### Original
- Gestión del entorno con accesos a colaboradores y tipos de colaborador.
- Carga de stock aproximado.

### Stock aproximado
- Se carga en **unidades de producto final** (10 pizzas), no en ingredientes. Es una decisión de diseño: evita recetas e inventario de materias primas.
- **[Propuesta] Comportamiento:**
  - Cada pedido descuenta del stock del producto.
  - Estados visibles: disponible, pocas unidades, agotado.
  - Umbral configurable para avisar que quedan pocas.
  - Un producto agotado se oculta o se marca en la carta, el storefront y la IA.
  - Ajuste manual rápido por cualquier colaborador con permiso.
  - Productos sin control de stock (por ejemplo bebidas de barra) pueden marcarse como siempre disponibles.
- **Evolución futura:** stock por ingredientes y recetas, solo si el negocio lo pide.

### [Propuesta] Carta
- Categorías, fotos, descripción, precio y disponibilidad.
- **Variantes** (tamaños) y **modificadores** ("sin cebolla", "extra queso").
- **Combos** y promociones.
- **Sector de preparación** por producto (barra, cocina), para repartir las comandas.
- Alérgenos y horarios de la carta (desayuno, almuerzo, cena).

### [Propuesta] Mesas
- Plano o lista de mesas del local.
- Estados: libre, ocupada, pidió la cuenta.
- Asignación de mozo o zona.
- Unir y separar mesas.

## 7. Pedidos

### Original
Las órdenes entran desde las apps integradas con IA, que gestiona los pedidos, o desde una mesa.

### [Decidido]
- El alcance es **solo consumo en el local y retiro**. No hay delivery propio.
- En la **v3** se integran sistemas de delivery externos como parte del módulo de apps integradas.

### Orígenes
| Origen | Descripción |
|---|---|
| **Chat con IA** | El cliente pide por una red conectada (WhatsApp, Instagram, etc.) y chatia arma el pedido para retiro o consumo en el local. |
| **Mesa** | El cliente pide desde el storefront abierto por el QR de su mesa. |
| **Mostrador** [Propuesta] | El colaborador carga el pedido en el punto de venta. |
| **Mozo** [Propuesta] | El mozo toma el pedido en su dispositivo. |

### [Propuesta] Ciclo de vida de un pedido
1. **Nuevo:** ingresa por cualquier origen.
2. **Confirmado:** el local lo acepta. Puede ser automático según configuración.
3. **En preparación:** la barra o la cocina lo trabajan.
4. **Listo:** esperando entrega o retiro.
5. **Entregado.**
6. **Pagado.** También puede cancelarse en cualquier etapa anterior.

- Cada sector (barra, cocina) ve solo sus ítems, en una pantalla de comandas.
- El cliente ve el estado en el storefront, y el mozo recibe una alerta cuando algo está listo.
- Los pedidos de un mismo cliente o mesa se agrupan en una **cuenta**.

## 8. Storefront

### Original
Carta de presentación del local, tipo Linktree, desde la que el usuario gestiona su experiencia:
- Llamar a un colaborador (mozo).
- Generar un pedido.
- Ver el estado del pedido.
- Ver la carta.
- Generar pagos y dar propina al mozo.

### [Decidido]
- El cliente puede **iniciar sesión para ver su ticket**, lo que permite tener el registro del usuario y de sus pedidos.
- Se puede **pagar desde el storefront sin que el mozo confirme**. El mozo recibe el aviso del pago y no tiene que ir a la mesa a controlarlo.

### [Propuesta] Detalles
- **Una URL por local** y un **QR por mesa**, que identifica la mesa automáticamente.
- **Pedir sin registro:** el cliente entra y pide sin crear cuenta. El inicio de sesión es **opcional** y da acceso a historial, tickets y pedidos anteriores. Un pedido hecho sin sesión puede vincularse a la cuenta después.
- **Enlaces del local:** redes, ubicación, horarios y WhatsApp, como en un Linktree. Las reservas quedan para la v3.
- **Tema visual** del local (logo y colores).
- **Llamar al mozo:** un botón que avisa al mozo de esa mesa, con motivos opcionales ("cuenta", "ayuda").
- **Pagar:**
  - La cuenta completa.
  - Dividir entre varias personas, o pagar solo los ítems propios.
  - Propina con montos o porcentajes sugeridos.
  - Línea visible del cargo de plataforma.
- **Control de abuso:** un QR no debe permitir pedir sin estar en el local, ni dejar pedidos fantasma. Se define con códigos de sesión de mesa o confirmación del mozo. Como el pago no requiere confirmación del mozo, hay que proteger bien el caso de pago por error o fraude.
- Idioma y moneda según el local.

## 9. Pagos y propinas

### Original
El owner carga las credenciales de su pasarela de pago. Los cobros del storefront incluyen la propina al mozo.

### [Decidido]
- Para la propina se elige **lo que mejor funcione a nivel de software y de uso** (ver propuesta).
- El comensal paga el cargo de plataforma de 2,5% como extra fee sobre ventas dentro del sistema.

### [Propuesta] Reglas a definir
- **Los pagos van a la cuenta del local**, usando sus propias credenciales. Para cobrar el 2,5% hay dos caminos: que la pasarela separe el cargo en cada pago (requiere una cuenta que permita dividir el cobro), o liquidarlo después sobre las ventas registradas. Hay que decidir cuál.
- **Destino de la propina (recomendación):** se acredita al **local junto con el pago**, queda registrada con el mozo asignado a la mesa, y el local la liquida a sus colaboradores. Motivos: una sola cuenta de cobro, sin que cada mozo necesite cuenta en la pasarela, y sin complicar lo fiscal. Se configura por local: **mozo asignado**, **fondo común repartido** o **reparto por reglas**.
- **Cobro en el local:** efectivo, tarjeta y transferencia, además del pago online. El cajero los registra.
- **Cierre de caja:** arqueo por turno y por medio de pago.
- **Comprobantes:** el local factura por su cuenta; el cliente ve un ticket interno al iniciar sesión; la plataforma exporta CSV.
- **Reembolsos y anulaciones:** con autorización y registro.

## 10. Atención al cliente con IA

### Original
El owner carga las credenciales para tener atención al cliente con IA, y la IA gestiona pedidos.

### [Propuesta] Qué hace la IA
- Responde sobre la carta, horarios y ubicación.
- Toma pedidos para retirar o consumir en el local (sin delivery).
- Informa el estado de un pedido.
- Respeta el stock: no ofrece lo que está agotado.
- **Deriva a una persona** cuando no puede resolver.
- Conoce el sector (barra, cocina) y las reglas del local (por ejemplo, un horario de pedidos).

## 11. Reglas de negocio

### Originales
- Un local pertenece a una organización con uno o más owners.
- Solo el owner carga credenciales.
- Los accesos de un colaborador dependen de su tipo.
- El stock se maneja de forma aproximada, en unidades de producto final.

### [Decididas]
- **Cargo de plataforma:** lo paga el consumidor como extra fee, solo en ventas dentro del sistema.
- **Un local por organización** en la v1.
- **Sin delivery** hasta la v3; solo consumo en el local y retiro.
- **Pago sin confirmación del mozo**, con aviso al mozo.
- **Facturación** a cargo del local; la plataforma entrega CSV.

### [Propuestas]
- **Aislamiento:** una organización nunca ve datos de otra.
- **Disponibilidad coherente:** lo agotado no se puede pedir por ningún origen.
- **Una cuenta, un cobro:** una cuenta pagada no puede cobrarse dos veces.
- **Trazabilidad:** toda anulación, descuento y ajuste de stock queda registrado con su autor.
- **Resiliencia:** la v1 es de prueba y puede depender de internet; la v2 suma WatermelonDB para seguir operando sin conexión.
- **Sin membresía:** crear una organización es gratis y no hay planes. Todas las funciones están disponibles desde el inicio.
- **Cargo registrado:** se registra por cada venta, con su base de cálculo, y se revierte ante devoluciones o anulaciones. Las propinas no pagan cargo.
- **Sin ventas, sin costo:** un local sin ventas no paga nada.
- **Datos del cliente:** al haber cuentas de cliente, se guardan según la ley local de protección de datos.

## 12. Mapeo a la plataforma

| Necesidad de Mexus | Ya existe | Falta |
|---|---|---|
| Organizaciones y colaboradores | SaaS (`Organization`, `Collaborator`, `Invitation`) | Tipos de colaborador definidos por el owner |
| Carta y productos | ecommerce-back (`Category`, `Product`, `ProductVariant`) | Modificadores, combos y sector de preparación |
| Stock | ecommerce-back (`InventoryItem`) | Stock aproximado por unidad de producto final |
| Pedidos | ecommerce-back (`Cart`, `Order`, `OrderStatusEvent`) | Origen del pedido, mesa, cuenta y comandas por sector |
| Pagos | pasarelapagos (Stripe, Mercado Pago) | Propinas, división de cuenta, cargo extra al consumidor y cobros en el local |
| Cargo del 2,5% | pasarelapagos (`Payment`, `PaymentEvent`) y superadmin | Cálculo y registro por venta, separación en el pago y reversión |
| Exportación contable | analytics / ecommerce-back | Exportación CSV de ventas y cargos |
| Atención con IA | chatia (módulo `mexus`) | Toma de pedidos conectada a carta y stock |
| Avisos | notificaciones (push, WhatsApp, email) | Alertas al mozo (incluido pago recibido) y al cliente por estado del pedido |
| Tema del storefront | SaaS (`ThemeConfig`) | Página pública con QR por mesa |
| Cuentas de cliente | SaaS (usuarios) | Inicio de sesión del cliente, tickets e historial |
| Punto de venta | App de escritorio (Tauri) | Mostrador, caja, comandas y credencial por terminal |
| Tiempo real | WebSocket y SSE en los servicios | Canal de comandas y estado de pedidos |
| Sin conexión | — | WatermelonDB (v2) |
| Apps integradas (delivery, reservas) | — | Módulo de apps internas y externas (v3) |
| Métricas | analytics | Ventas por producto, hora, mozo y mesa |
| Gestión global | superadmin | Vista de organizaciones y consumo |

El tenant `mexus` ya existe como módulo en los microservicios (chatia, notificaciones, analytics, pasarelapagos y marketing).

## 13. Alcance por versión

- **v1 (versión de prueba):** organización con **un local**, colaboradores con tipos, carta, stock aproximado, mesas, pedidos desde mesa y mostrador, storefront tipo Linktree con QR, llamado al mozo, estado del pedido.
- **v2:** pagos en general con propina y división de cuenta, atención con IA que toma pedidos, comandas por sector, cierre de caja y **WatermelonDB** para no depender de internet.
- **v3:** varios locales por organización, modo sin conexión completo, reportes avanzados, app para facilitar el uso de los colaboradores en el local, y **módulo de apps integradas** para conectar al local apps externas o internas que agilicen su operación o sean de uso personal (delivery, reservas).
- **v4:** expansión global con varios locales y **app para el cliente**, para encontrar locales cercanos y gestionar sus pedidos desde la app.

*(El reparto es una propuesta. Hay que confirmarlo.)*

## 14. Decisiones tomadas (ex preguntas abiertas v0.2)

| # | Tema | Decisión |
|---|---|---|
| 1 | Apps integradas | Internas y externas según la versión; es más una v3. |
| 2 | Delivery | Solo consumo en el local y retiro. Integración con sistemas de delivery en v3. |
| 3 | Propina | Lo que sea mejor a nivel de software y uso (recomendación en la sección 9). |
| 4 | Cargo 2,5% | Lo paga el consumidor como extra fee, solo en ventas dentro del sistema. |
| 5 | Sin internet | La v1 es de prueba; la v2 agrega WatermelonDB. |
| 6 | Tickets | El cliente ve su ticket iniciando sesión, así queda el registro de usuario y pedidos. |
| 7 | Locales | Uno en la v1; varios más adelante (v3). |
| 8 | Pago sin mozo | Se permite pagar sin confirmación; el mozo recibe el aviso. |
| 9 | Reservas | Se evaluarán en la v3 con las apps integradas. |
| 10 | Fiscal | Solo software; la facturación la maneja el local y la plataforma entrega CSV. |

## 15. Especificación por versión

Esta sección se arma con tus respuestas: cada pregunta respondida pasa acá y sale de la sección 16. **[Decidido]** sale de tus respuestas. **[Pendiente]** tiene una pregunta abierta en la sección 16.

### 15.1 Reglas generales (todas las versiones)

- **[Decidido]** "Ventas dentro del sistema" = lo **cobrado por la pasarela del sistema**. Después se evalúa integrar posnet u otros medios para mejorar la experiencia del local.
- **[Decidido]** El 2,5% se paga **siempre que se use la app** como **fee**: puede cobrarlo un colaborador en el mostrador o el comensal que genera el pago. **Sin tope** para pedidos pequeños o grandes (depende del comensal).
- **[Decidido]** Pasarelas por región: en América, **Stripe y Mercado Pago**. Se empieza con **Mercado Pago en Argentina**.
- **[Decidido]** El software se adapta a distintos tipos de local: bar, restaurante, cafetería, pizzería y también **nightclubs o boliches**. La idea es que sea **flexible**, no solo para restaurantes.

- **[Decidido]** **Sin membresía, sin cupo de IA:** la plataforma absorbe el costo de IA y soporte de un local hasta que empiece a vender. **Pausa automática de la IA** a los locales sin actividad por 90 días. Aviso al owner a los **75 días** y **reactivación con un clic** cuando vuelva a vender o a cargar la carta.
- **[Decidido]** **Costo por local:** panel interno de costo por local (IA, soporte e infraestructura) con revisión mensual y un valor de alerta provisional que se ajusta con los datos de las semanas 4 a 8 del piloto.
- **[Decidido]** **Competencia:** sin comparativo con Toast y Fudo por ahora.


### 15.2 v1 — Versión de prueba

- **[Decidido]** Objetivo: **validar el flujo con 1 o 2 locales reales durante 4 a 8 semanas** (un bar o restaurante con mesas y un boliche, para validar la flexibilidad). Solo **registra pedidos y agiliza el uso de las mesas**; los pagos llegan en la v2.
- **[Decidido]** Sin pagos, **la cuenta la marca como pagada el cajero** o el colaborador que tomó la mesa.
- **[Decidido]** Al asignar una mesa se genera su **QR**, y el local lo imprime y lo coloca.
- **[Decidido]** Control de abuso del QR: **el mozo confirma cada pedido**.
- **[Decidido]** El pedido por mesa **requiere confirmación del local** antes de pasar a preparación.
- **[Decidido]** El llamado al mozo aparece **en la pantalla** indicando la mesa, como una **alerta tipo notificación de red social**.
- **[Decidido]** La carta inicial se carga **a mano, con planilla o con foto del menú procesada por IA**, y siempre con una **vista previa editable** que marca los errores antes de publicar.
- **[Decidido]** Dispositivos del equipo: app de escritorio, navegador del celular o tablet.
- **[Decidido]** El inicio de sesión del cliente para ver tickets **no entra en v1**: llega con los pagos en la v2.
- **[Decidido]** Métricas de éxito del piloto: **tiempo de atención por mesa, proporción de pedidos por QR y errores de pedido**.
- **[Decidido]** Si el mozo no confirma o no atiende un llamado: **alerta persistente en pantalla**, sin escalado.
- **[Decidido]** Boliches: la v1 usa el **flujo genérico de mesas**; el consumo mínimo y las mesas VIP llegan en la v3.

**Soporte, seguridad y criterio 10/10**
- **[Decidido]** **Onboarding y soporte:** autoservicio apoyado en una **página de documentación** con guías de carga de carta, QR y roles, videos cortos, preguntas frecuentes y un **chat de IA de ayuda desde la v1**. **No hay acompañamiento humano** en el piloto, tampoco en el horario nocturno del boliche (Ronda 7, v1 1).
- **[Decidido]** **Seguridad base:** roles, registro de acciones, respaldo diario y verificación en dos pasos para el owner.
- **[Decidido]** **Criterio para pasar de la v1 a la v2:** umbrales definidos antes del piloto: disponibilidad de **99,5%** en horario de servicio (medida con **monitoreo externo, alertas y un panel de estado**), al menos **95%** de pedidos sin error y menor tiempo de atención que antes. El "antes" se mide con **2 semanas de muestreo** (de la hora en que entra el pedido a la hora de entrega) en cada local, antes de instalar el sistema. Un pedido **con error** es el que el cliente reclama (Ronda 7, v1 2).


### 15.3 v2 — Pagos, IA, comandas y WatermelonDB

**Pagos**
- **[Decidido]** Los medios de cobro son **los que acepte la pasarela**; el cierre de caja se apoya en eso.
- **[Decidido]** **Propina:** se acredita al **local** con una **etiqueta del mozo** y de la propina. El reparto es una **regla configurable por cada local**.
- **[Decidido]** **División de cuenta flexible.** El 2,5% se calcula **sobre el total** de la cuenta y, al dividirla, cada parte lleva su proporción del cargo agregado.
- **[Decidido]** El **pago sin confirmación del mozo** se mantiene. Para reembolsos o errores, el **owner habilita a un supervisor** que autoriza y la acción **queda registrada**.

**IA que toma pedidos**
- **[Decidido]** La IA **arma el pedido**; el cliente lo **confirma** y se envía al local junto con el pago. El pago queda **pendiente** hasta que el local toma el pedido y pasa a **aprobado**.
- **[Decidido]** El local tiene un **tiempo máximo configurable** (por ejemplo 5 minutos): si no responde, el pedido se cancela y se reembolsa.

**Comandas**
- **[Decidido]** **Ambos:** pantalla de comandas (KDS) como principal e **impresora térmica de red** (ESC/POS: Epson, Star) para la barra y como respaldo.

**Mesas, sin conexión y sincronización**
- **[Decidido]** Cada mozo **toma las mesas que quiera** y el sistema evita duplicados. Para evitar conflictos sin conexión, el local tiene su **sesión o cuenta de local** y cada mozo gestiona su **propia cuenta**: solo el **encargado de una o varias mesas** puede modificarlas.
- **[Decidido]** WatermelonDB con **interruptores por módulo** que configura el local: manejo de mesas, comandas y cobros en efectivo. Los pagos online se desactivan sin conexión.

**Cliente**
- **[Decidido]** El ticket muestra ítems, cargo, propina, fecha y local, y se puede **descargar o enviar por email**.
- **[Decidido]** Cuenta de cliente con **Firebase**, con **inicio de sesión solo con Google**. Se piden **términos y condiciones**, pero **no datos personales** más allá de lo que da Firebase.
- **[Decidido]** **Impresoras:** de red (ESC/POS: Epson y Star) **más Bluetooth y USB**. Lista inicial garantizada: una impresora Epson y una Star, una tablet para la pantalla de comandas y un lector; el resto queda como "no garantizado".
- **[Decidido]** **Transferencia de mesas:** el mozo la transfiere con registro y el otro mozo la acepta.
- **[Decidido]** El **supervisor** autoriza anulaciones, descuentos, reembolsos y correcciones de una cuenta ya pagada.

**Validación, riesgos y criterio 10/10**
- **[Decidido]** **Validación del cargo del 2,5%:** medir qué porcentaje de comensales paga por la app y cuántos abandonan al ver el cargo, con un umbral de **al menos 30% por app**. Si no se alcanza, se **revisa el modelo y se muestra el cargo incluido en el precio**. Antes del lanzamiento: **prueba A/B en 2 locales durante 4 semanas**, cargo separado contra cargo incluido en el precio, midiendo abandono y porcentaje de pago por la app.
- **[Decidido]** **Antifraude:** el de la pasarela más reglas propias (montos y repeticiones) y una política clara de contracargos: **los asume el local**, y la plataforma aporta la evidencia del sistema (ticket y confirmación del mozo) para disputar.
- **[Decidido]** **Cobro del 2,5%:** el local conecta su Mercado Pago por autorización (OAuth) y cada cobro lleva la comisión de la plataforma; se valida con una prueba real durante la v1.
- **[Decidido]** **Si la pasarela se cae:** modo degradado; se siguen tomando pedidos, se cobra en caja y los pagos online se reanudan al volver.
- **[Decidido]** **Propuesta de valor frente a Fudo y Toast:** costo cero de entrada, storefront con QR por mesa e IA que toma pedidos, con cobro solo cuando el local vende.
- **[Decidido]** **Criterio 10/10 de la v2:** ticket promedio, rotación de mesas y porcentaje de pagos por la app. **Solo se miden, sin meta numérica** (salvo el umbral de 30% por app); ver Ronda 7, v2 1.


### 15.4 v3 — Varios locales, apps integradas y app de colaboradores

- **[Decidido]** **Carta:** se puede **copiar a uno o varios locales** como copia independiente, sin sincronización, y cada local también puede cargar la suya.
- **[Decidido]** **Colaboradores en varios locales:** el **dueño autoriza** a qué locales accede cada uno; flexible.
- **[Decidido]** **Apps integradas:** prioridad en **delivery** e **impresoras o dispositivos**. Son apps que el equipo propone según las necesidades del local, de **uso interno**, no de terceros. Habrá un **catálogo de apps** para instalar por local.
- **[Decidido]** **Delivery externo** a través de un **agregador** que conecta varias apps de delivery con el punto de venta. El tratamiento del 2,5% en estos pedidos se define después.
- **[Decidido]** **Apps de uso personal del local:** optimizan procesos, por ejemplo usar el **teléfono como posnet** (cobro por **NFC y QR dinámico**) o **marcar una mesa como libre u ocupada**.
- **[Decidido]** **Reservas:** por el **chat con IA** o el **storefront**, con **seña** o lo que diga el local, y **siempre aprueba el local**. La app es solo para colaboradores en esta versión.
- **[Decidido]** **App de colaboradores:** para todos (mozos, cocina, gerentes) con las funciones que optimicen el uso.
- **[Decidido]** **Reportes avanzados:** opcionales, dentro de las analíticas de la organización.
- **[Decidido]** **Modo sin conexión completo:** KDS e impresión funcionando por **red local sin internet**, y **pagos offline con tope de monto y 72 h**.
- **[Decidido]** **Tope de pagos offline:** cada local lo configura dentro de un máximo que fija la plataforma. Si un pago offline se rechaza al sincronizar, **lo asume el local**, con aviso previo en la terminal.
- **[Decidido]** Las integraciones de delivery **no son una fuente de ingresos**: sirven para ganar clientes y completar el producto. Cada app de delivery **se gestiona desde la propia app de delivery**: la plataforma no gana nada ni paga el costo del agregador, y el local tiene la integración de forma cómoda. Esos pedidos **descuentan stock y suman a los reportes** del local, sin cargo de la plataforma.
- **[Decidido]** **Seña de reservas** por la pasarela: paga el 2,5% y se descuenta de la cuenta final.
- **[Decidido]** **Mesas VIP y consumo mínimo (boliches):** lo decide cada local: consumo mínimo con seña previa por la pasarela, solo mesa reservada, o ambas.

**Escala y criterio 10/10**
- **[Decidido]** **Reportes de varios locales:** tablero consolidado por organización con filtro por local, mozo y horario.
- **[Decidido]** **Capacidad:** se valida con **pruebas en los locales iniciales**; solo se avanza de versión si pasan. Alcance: **3 locales durante 4 semanas**, con carga real y simulada, antes de abrir al resto.
- **[Decidido]** **Apps integradas:** cada app pide permisos mínimos por local y el owner los aprueba.
- **[Decidido]** **Criterio 10/10 de la v3:** porcentaje de locales con más de una app instalada, tiempo de atención y pedidos por delivery. Valores: al menos **50%** de los locales con 2 o más apps instaladas, tiempo de atención **15% menor** que en la v1 y delivery como **10%** de los pedidos en los locales con la integración.


### 15.5 v4 — Expansión global y app del cliente

- **[Decidido]** **App del cliente** que **complementa** al storefront (no lo reemplaza): pedir y pagar, descubrir locales cercanos, historial y fidelización.
- **[Decidido]** **Descubrimiento:** solo locales de la plataforma, como un **mapa** con cercanía y reseñas. Los locales **no pagan** por destacarse.
- **[Decidido]** **Reseñas:** solo de clientes con un **pedido verificado** en la plataforma.
- **[Decidido]** **Privacidad:** un solo estándar global basado en **GDPR** (consentimiento, acceso, borrado y datos mínimos), con ajustes por país como LGPD en Brasil y la Ley 25.326 en Argentina.
- **[Decidido]** **Expansión global** significa llevar la empresa a otros países. Monedas, idiomas, impuestos y pasarelas por país ya están definidos en el ecosistema.
- **[Decidido]** El 2,5% es **siempre el mismo**, sin variar por país ni volumen.
- **[Decidido]** **Mapa base de OpenStreetMap** (sin costo por carga), con los locales de Mexus como puntos.
- **[Decidido]** **Moderación:** el local puede responder reseñas pero no borrarlas; los reportes los revisa el superadmin.
- **[Decidido]** **Fidelización:** puntos que sirven en **toda la red de locales** de la plataforma. **Cada local aporta un porcentaje de la venta al fondo de puntos**; la plataforma no financia los puntos. El aporte es **opcional**: el local elige sumarse y decide su aporte dentro de un rango (por ejemplo 1% a 3% de la venta); el que no se suma no ofrece puntos.

**Expansión y criterio 10/10**
- **[Decidido]** **Orden de expansión:** primero Argentina, el **segundo país es Estados Unidos** y de ahí **el resto del continente americano y España**. Reemplaza el orden anterior (primero Latinoamérica hispanohablante, por idioma y Mercado Pago). Entrada a EE.UU.: **piloto de 2 a 3 locales en una sola ciudad** (por ejemplo con mucha comunidad hispanohablante), con Stripe, impuesto local por tienda y documentación en inglés, antes de abrir el resto del país.
- **[Decidido]** **Propinas en EE.UU.:** se mantiene el modelo de acreditarlas al local, con registro por mozo para que el local pueda repartirlas y reportarlas.
- **[Decidido]** **Soporte por país:** documentación con **chat de IA**, sin socios locales, en el **idioma del país del local más inglés**.
- **[Decidido]** **Criterio 10/10 de la v4:** locales activos por país y **retención a 12 meses**. Valores: retención de al menos **80%** de los locales y **50 locales activos** en un país antes de abrir el siguiente.


## 16. Preguntas abiertas por versión

Ronda 7: las respuestas de la ronda 6 pasaron a la sección 15. Quedan solo las preguntas que frenan el puntaje de cada versión (ver la tabla del principio).

**Cómo responder:** marcá con `[x]` la opción elegida (cada una cita cómo lo resolvió una empresa de referencia). La última opción es para escribir tu propia respuesta. Las respuestas ya escritas en `respuesta:` se mantienen.

### v1 — Versión de prueba

1. El piloto va sin soporte humano y uno de los locales es un boliche que opera de noche: ¿cómo se cubre una caída del sistema?
respuesta:
   - [ ] A) **(Recomendada)** Alerta automática al equipo cuando cae el servicio en el horario de servicio de un local, modo contingencia en papel con guía impresa y respuesta al día siguiente. — *Ref: Toast (guías de contingencia ante caídas).*
   - [ ] B) Nada especial: se resuelve al día siguiente. — *Ref: Square (soporte en horario comercial).*
   - [ ] C) Propia: 
2. Un pedido "con error" solo cuenta si el cliente reclama: ¿cómo se detectan los errores que nadie reclama?
respuesta:
   - [ ] A) **(Recomendada)** Se suman los reclamos, las correcciones del mozo y las cancelaciones por error registradas en el sistema. — *Ref: Toast (precisión de pedidos como métrica).*
   - [ ] B) Se mantiene solo el reclamo del cliente. — *Ref: Square (reclamos de clientes).*
   - [ ] C) Propia: 

### v2 — Pagos, IA, comandas y WatermelonDB

1. Ticket promedio y rotación de mesas solo se miden, sin meta: ¿cuándo se fija un valor?
respuesta:
   - [ ] A) **(Recomendada)** Al cerrar el piloto de la v1, con la línea base medida, se fija una meta numérica para cada uno antes de empezar la v2. — *Ref: Toast (casos de clientes con mejoras medidas).*
   - [ ] B) Se siguen midiendo sin meta. — *Ref: Square (reportes sin objetivos).*
   - [ ] C) Propia: 


## 17. Plataforma: base y construcción

Esta sección baja Mexus a la plataforma del ecosistema (`CLAUDE.md`, `services/`, `modules/`, `contracts/`). Dice qué se hereda tal cual, qué entidades y funciones hay que construir y en qué orden. Lo **[Propuesta]** hay que confirmarlo antes de implementar.

**Particularidad de Mexus:** reutiliza el comercio (carta = catálogo, pedido = orden, storefront = carta pública), pero agrega **tiempo real y mesa**: cuentas abiertas, comandas por sector, llamados al mozo y propinas. Lo propio es el servicio en salón, no la venta.

### 17.1 Qué se hereda sin tocar

| Capacidad | Dónde vive hoy | Uso en Mexus |
|---|---|---|
| Identidad, sesión, dispositivos | `realsass-sass-back` (ADR-004/020) | Login del owner, los colaboradores y la terminal |
| Organización = tenant | `Organization` (`ecosystemId`, `slug`, `status`, `storeStatus`, `countryCode`, `dataRegion`) | Un local o grupo = una organización, con `ecosystemId = "mexus"` |
| Colaboradores e invitaciones | `Collaborator` (permisos JSONB, ADR-001), `Invitation` | Equipo del local |
| Flags, cuotas, secretos, tema, auditoría, webhooks | `FeatureFlag`, `QuotaConfig`, `SecretConfig`, `ThemeConfig`, `ConfigAuditLog`, `WebhookEndpoint` | Activar módulos por versión, credenciales de pasarela y de chatia, tema del storefront |
| Carta | `ecommerce-back`: `Category`, `Product`, `ProductVariant` | Carta con categorías y variantes |
| Stock | `InventoryItem` y reserva atómica | Stock aproximado por producto final |
| Pedidos | `Cart`, `Order`, `OrderItem`, `OrderStatusEvent`, `OutboxEvent`, `IdempotencyKey` (ADR-029) | Pedido con estados y registro de cambios |
| Cuentas de cliente | `StoreCustomer`, `CustomerActivityEvent` (ADR-021) | Cuenta del comensal con tickets e historial |
| Storefront | `real-ecommerce-front` (`/{locale}/{slug}`, SEO e idioma) | Carta pública tipo Linktree, con QR por mesa |
| Escritorio | `realsass-dashboard-desktop` (Tauri, ADR-023) | Terminal de mostrador y caja |
| IA, avisos, cobros, métricas, gestión global | chatia, notificaciones, pasarelapagos, analytics, superadmin (ecosistema-ms) | Ver 17.3 |

### 17.2 Entidades que hay que construir

| Entidad | Origen | Notas |
|---|---|---|
| **Local** | Nueva | Sede física. Uno solo en la v1; varios en la v3. |
| **Tipo de colaborador** | Extiende `Collaborator` | Conjunto de permisos con nombre, definido por el owner; se aplica al JSONB de permisos. |
| **Modificador, Combo, Sector de preparación** | Extiende `Product` / `ProductVariant` | Barra, cocina, etc. |
| **Mesa** | Nueva | Estado, mozo asignado y QR propio. |
| **Cuenta de mesa** | Nueva | Se abre al ocupar la mesa, junta pedidos y se cierra al pagar. |
| **Pedido** | Extiende `Order` | Origen (mesa, mostrador, IA, app), mesa y cuenta, sector, mozo. |
| **Comanda** | Nueva | Vista de un pedido por sector de preparación (v2). |
| **Llamado al mozo** | Nueva | Evento en tiempo real con estado: pendiente, atendido. |
| **Pago, división de cuenta** | pasarelapagos (`Payment`, `PaymentEvent`) | Cuenta dividida por ítem o por partes (v2). |
| **Propina** | Nueva | Asignada a un mozo; no paga comisión. |
| **Cargo de plataforma (2,5%)** | pasarelapagos | Línea separada al comensal; se revierte en proporción. |
| **Ticket** | Nueva | Comprobante interno de la cuenta pagada (no fiscal). |
| **Terminal y credencial** | Nueva | Terminal por local con credencial propia (v2). |
| **Cierre de caja** | Nueva | Resumen por turno (v2). |
| **App integrada** (v3) | Nueva | Conexión de apps externas o propias (delivery, reservas). |
| **Conversación** | chatia | Se consulta, no se duplica. |

### 17.3 Funciones por capa

**Back [Propuesta]:** extender `realsass-ecommerce-back` con módulos nuevos (`mesas`, `cuentas`, `comandas`, `llamados`, `propinas`) con `domain/` + `repository/` (molde: `catalog/`). Si el tiempo real exige otra escala, el canal de comandas pasa a un back propio en v3.
- `adminCatalog.*` y `adminInventory.*` (existen): sumar modificadores, combos, sectores y stock aproximado.
- `adminOrders.*` y `customer.*` (existen): sumar origen, mesa y cuenta.
- `mesas.*`, `cuentas.*`, `llamados.*`: abrir, agregar pedidos, dividir, cerrar.
- `comandas.*`: cola por sector, con estados y suscripción en vivo.
- `propinas.*` y `pagos.*`: propina por mozo, cargo visible antes de pagar.
- `colaboradores.tipos.*`: tipos con permisos.
- Tiempo real: SSE o WebSocket para llamados, comandas y estado del pedido. Es un canal de datos, no un fetch del cliente. Se integra en el contrato tRPC con suscripciones.
- REST solo para webhooks inbound (pasarela y apps integradas).

**Front:**
- `realsass-sass-front` (owner): alta, credenciales de pasarela y de chatia, tipos de colaborador.
- `realsass-dashboard-front` (colaboradores): carta, stock, mesas, pedidos, caja, métricas.
- `real-ecommerce-front`: carta pública por QR, pedido, llamado al mozo, estado, pago y propina.
- `realsass-dashboard-desktop`: mostrador y caja. Con WatermelonDB (v2) deja de ser un cascarón fino.
- App del colaborador (v3) y app del cliente (v4): proyectos nuevos sobre los mismos routers.

**Reglas que aplican:** tRPC para todo lo interno, `organizationId` en cada modelo con RLS, pedidos y pagos idempotentes (ADR-029), `@real/ui` sin UI propia, 4 estados en cada vista, táctil (objetivos ≥44 px) y contratos desde `@real/trpc/dist` (ADR-019).

### 17.4 Configuración por tenant

| Mecanismo | Valores para Mexus |
|---|---|
| `ecosystemId` | `mexus` |
| Región de datos | `Organization.dataRegion` (`ar` o `us`, ADR-031; hoy ambas en la misma infraestructura). `countryCode` define la ley; `Market` define a qué países vende |
| `FeatureFlag` | `mexus.tables` (v1), `mexus.payments` (v2), `mexus.ai-orders` (v2), `mexus.kds` (v2), `mexus.offline` (v2/v3), `mexus.multi-venue` (v3), `mexus.apps` (v3) |
| `QuotaConfig` | Locales, terminales, mesas y colaboradores por organización |
| Permisos de colaborador | Por tipo: mesa, caja, comandas, carta, métricas, cierre |
| Pasarela | Mercado Pago con OAuth del local; el cargo se separa en cada pago |

### 17.5 Orden de construcción

1. **v1 (prueba):** `ecosystemId`, local único, tipos de colaborador, carta con stock aproximado, mesas con QR, pedidos de mesa y mostrador, storefront, llamado al mozo, estado del pedido.
2. **v2:** pagos con propina, división de cuenta y cargo del 2,5%, IA que toma pedidos, comandas por sector, cierre de caja, terminal con WatermelonDB.
3. **v3:** varios locales, modo sin conexión completo, reportes avanzados, app del colaborador, apps integradas.
4. **v4:** expansión global con varios locales y app del cliente.

### 17.6 Decisiones que faltan para empezar

- Región de datos (ADR-031): hoy una sola región para locales de Argentina y de EE.UU. Con varios locales o expansión global (v3/v4), cada país nuevo se revisa antes de abrirse; el piloto de EE.UU. usa la misma región.

- El tiempo real (llamados, comandas) necesita definir el transporte dentro de tRPC y qué back lo sirve.
- La terminal con WatermelonDB contradice el escritorio como "cascarón fino" de ADR-023. Hace falta un ADR nuevo antes de la v2.
- Con varios locales (v3), hay que decidir si cada local es un `Local` dentro de una organización o una organización por local.
- El cargo del 2,5% y el CSV son iguales a los de Manzana: construirlos una sola vez.
