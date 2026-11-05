# Manzana — Dominio

> Estado: borrador v0.9. Lo marcado con **[Propuesta]** es una mejora sugerida sobre la idea original y está pendiente de confirmar. Lo marcado con **[Decidido]** sale de las respuestas dadas a las preguntas abiertas (rondas 1 y 2). Todo lo demás sale de la idea original.

## Pilares y camino al 10/10

> **Empresa 10/10 de referencia:** **Shopify**. Para equipos usados, **Back Market**; para canje y soporte, el modelo de **Apple**.
> **Nivel actual de la especificación: 7,5/10.** Equivale a la definición de producto de una plataforma de comercio vertical en etapa pre-semilla, con reglas de negocio, cobros validables, métricas de actividad y pruebas de campo definidos. Lo que lo frena: la marca Apple queda en manos de cada tienda, wholesale se construye sin proveedores acordados, y no hay meta de crecimiento ni comparativo con la competencia.
> **Escala de referencia:** Shopify 10 · Back Market 8,5 · Manzana 7,5.

### Pilares

| # | Pilar | Hoy | Para llegar al 10 |
|---|---|---|---|
| 1 | **Catálogo, inventario y puntos de venta** (con franquicias) | Sólido: dos catálogos, plantilla, franquicias, tienda activa definida y stock verificado por conteo de muestra | Probado con tiendas reales, con terminal y stock sincronizado |
| 2 | **Modelo de negocio** (2,5% al comprador, sin membresía, afiliados) | Definido, sin ingresos hasta v2; el 2,5% se separa con Mercado Pago por autorización (OAuth); IA en pausa tras 90 días sin vender | Costo y ganancia por tienda, y evidencia de que el comprador acepta el cargo |
| 3 | **Wholesale y dropshipping** | Reglas definidas (feed JSON, ruteo, pago dividido con prueba técnica, respaldo de 15 minutos con stock de seguridad); se construye sin proveedores acordados | Proveedores reales conectados, con feeds, ruteo y pago dividido operando |
| 4 | **Usados, mantenimiento y garantía** (confianza) | Definido: IMEI opcional por tokens con etiqueta "no verificado", garantía por serie, reparación con plazo que fija la tienda | Verificación de IMEI confiable, garantías por serie y órdenes de servicio en producción |
| 5 | **Marca y legal** | Acuerdo con Apple tras tener volumen; mientras tanto cada tienda responde por su uso de marca bajo los términos, sin aviso de la plataforma | Reglas de uso de la marca Apple, venta de usados y equipos robados, y protección de datos |
| 6 | **Operación sin conexión y móvil** | Definido (WatermelonDB, app Expo), con prueba de campo de 72 h y simulador de conflictos | Probado en campo, con conflictos de sincronización resueltos |
| 7 | **Mercado y crecimiento** | Parcial: canales definidos (referidos, afiliados, alianzas, marketing), pero sin meta numérica ni comparativo con la competencia | Plan para las primeras tiendas, análisis de competidores y soporte |

### Qué falta para el 10/10 por versión

| Versión | Hoy | Qué falta para el 10/10 | Preguntas (sección 14) |
|---|---|---|---|
| **Generales** | 7/10 | Meta de crecimiento y comparativo con la competencia (decidido no tenerlos por ahora) | Se retoma con datos del piloto |
| **v1** | 8/10 | Protección de la plataforma ante el uso de la marca Apple por las tiendas | Ronda 7, v1 1 |
| **v2** | 7,5/10 | Reglas de la pausa de IA por inactividad (afecta a toda la plataforma) | Ronda 7, generales 1 |
| **v3** | 6,5/10 | Proveedores reales acordados antes de abrir wholesale | Ronda 7, v3 1 |

### Requisitos para el 10/10

**Se pueden resolver en este documento (llevan a 8,5):**
- Relevamiento de proveedores y condiciones de dropshipping.
- Riesgos de marca Apple y venta de usados, con su marco legal.
- Modelo de datos, seguridad y requisitos de rendimiento.
- Costo y ganancia por tienda y métricas de éxito por versión.
- Plan de salida al mercado y análisis de competidores.

**Solo con producto funcionando (llevan a 9–10):**
- Wholesale operando con proveedores reales.
- Verificación de usados y garantías en producción.
- Pagos divididos funcionando.
- Tiendas activas que generen ventas y datos.

## 1. Resumen

Manzana es un servicio de software para la **gestión automatizada de tiendas Apple**.

Cada tienda crea su organización, conecta sus redes para que la IA (chatia) atienda a los clientes, administra su catálogo y sus puntos de venta, y puede operar con mayoristas y ofrecer soporte técnico. Quien no tiene tienda puede registrarse como afiliado y ganar dinero sugiriendo tiendas.

### Idea original (se conserva tal cual como base)

**Usuarios**
- **Owner:** dueño de la organización.
- **Colaborador:** asignado por el owner.

**Reglas base**
- El usuario crea su organización, o crea su código de afiliado para sugerir tiendas y obtener una ganancia.
- El usuario que creó su organización puede configurar las credenciales del sistema a redes, así chatia gestiona la atención al cliente.
- En el dashboard, el owner o el colaborador con el rol asignado pueden crear productos para el catálogo y puntos de venta relacionados a la organización.
- El owner, o un colaborador con el permiso dado por el owner, puede crear en la aplicación de escritorio un perfil basado en la organización para el punto de venta. Así se mantiene la sesión abierta sin depender del Gmail de un usuario.

**Áreas del proyecto**
- **Puntos de venta:** locales físicos que cargan inventario. Pueden vender productos usados, nuevos o de otras marcas.
- **Wholesale:** conectar mayoristas para que los minoristas no dependan de invertir capital en stock y generar una venta automática tipo dropshipping.
- **Mantenimiento:** ligado a la organización y, opcionalmente, a los puntos de venta. La idea es dar soporte técnico a los productos de la marca.

### Modelo de negocio

- **Se cobra un 2,5% sobre la venta.**
- **No hay membresía:** la barrera de entrada para los negocios es cero. Una tienda empieza sin pagar nada y la plataforma gana cuando la tienda vende.

**[Decidido]**
- **Sobre qué ventas se aplica:** solo sobre las **cobradas por la pasarela**, es decir, dentro del uso del ecosistema. Las ventas en efectivo o por otros medios fuera del sistema no pagan comisión.
- **Facturación:** la tienda gestiona su propia facturación fiscal, como en otras empresas de software. La plataforma **no emite comprobantes fiscales**: entrega un **CSV** con las ventas para facilitar el trabajo del contador (modelo similar al de Stripe).

**[Propuesta] Reglas a definir**
- **Cómo se cobra:** descuento automático en el pago online: la pasarela retiene el 2,5% y liquida el resto a la tienda. Como solo se cobra sobre lo que pasa por la pasarela, desaparece la liquidación periódica de mostrador.
- **Quién lo paga:** **[Decidido]** el **comprador**, como cargo extra. El criterio queda unificado con Mexus y la tienda recibe el valor completo de su venta.
- **Qué incluye la base de cálculo:** precio del producto sin impuestos, sin propinas y sin envío. Hay que definirlo.
- **Devoluciones y anulaciones:** la comisión se revierte en proporción.
- **Transparencia:** la tienda ve en el dashboard cuánto se le cobró y por qué venta.
- **Costos de la pasarela:** el 2,5% es de la plataforma. La comisión de Stripe o Mercado Pago es aparte y la paga la tienda.
- **Contenido del CSV:** fecha, venta, producto, base, comisión, medio de pago, impuestos informados y estado (pagada, devuelta).

## 2. Actores

| Actor | Quién es | Qué busca |
|---|---|---|
| **Owner / socio** | Dueño de la organización. Puede haber varios (socios). | Operar y escalar su negocio. |
| **Colaborador** | Empleado asignado por el owner, con un rol. | Hacer su parte del trabajo (vender, cargar catálogo, reparar). |
| **Afiliado** | Usuario con código de afiliado. No necesita tener tienda. | Ganar una comisión por tiendas que sugiere. |
| **Cliente final** | Quien compra, consulta o lleva un equipo a reparar. | Comprar, recibir atención y soporte. |
| **Mayorista** | Proveedor de stock para minoristas. | Vender a través de las tiendas sin gestionar cada venta. |
| **Terminal de punto de venta** | La app de escritorio instalada en un local. | Operar de forma continua sin depender de una persona. |
| **Superadmin de la plataforma** | Equipo dueño de Manzana. | Gestionar organizaciones, afiliados y estadísticas globales. |

## 3. Glosario

- **Organización:** la empresa o tienda cliente (tenant).
- **Punto de venta (POS):** local físico de la organización.
- **Terminal:** instalación de la app de escritorio vinculada a un punto de venta.
- **Catálogo:** productos que ofrece la organización.
- **Producto usado:** equipo de segunda mano, con estado y número de serie o IMEI.
- **Mayorista (wholesale):** proveedor que publica stock para que los minoristas lo revendan.
- **Dropshipping:** el minorista vende sin tener el stock; el mayorista despacha.
- **Orden de servicio:** solicitud de soporte técnico sobre un equipo.
- **Código de afiliado:** código con el que un afiliado sugiere tiendas.
- **Programa de afiliados de la tienda:** porcentaje de venta que una tienda decide ofrecer a los afiliados que la recomienden.
- **Comisión de plataforma:** 2,5% sobre las ventas cobradas por la pasarela. Es la única fuente de ingresos de la plataforma: no hay membresía.
- **Storefront:** tienda web pública de la organización, parte del ecosistema storefront.

## 4. Roles y permisos

### Original
- **Owner:** dueño de la organización. Asigna roles y permisos.
- **Colaborador:** actúa según el rol que le asignó el owner.

### [Decidido]
- Una organización puede tener **varios owners o socios**.
- Los **técnicos son colaboradores** de la organización.

### [Propuesta] Roles de colaborador sugeridos
| Rol | Acciones |
|---|---|
| **Gerente de punto de venta** | Gestiona un local: inventario, ventas, caja y equipo. |
| **Vendedor** | Registra ventas y consulta stock en su local. |
| **Encargado de catálogo** | Crea y edita productos. |
| **Técnico** | Gestiona órdenes de servicio. |
| **Gestor de wholesale** | Administra la relación con mayoristas y órdenes de dropshipping. |

### Permisos
| Acción | Owner | Colaborador |
|---|---|---|
| Configurar credenciales de redes (chatia) | Sí | No |
| Crear productos del catálogo | Sí | Según rol |
| Crear puntos de venta | Sí | Según rol |
| Crear el perfil de terminal de escritorio | Sí | Solo con permiso dado por el owner |
| Gestionar colaboradores y roles | Sí | No |
| Ver ventas y reportes | Sí | Según rol y local |

### [Propuesta]
- Los permisos pueden limitarse **por punto de venta**: un vendedor solo ve el local donde trabaja.
- El afiliado no accede a datos de las organizaciones que sugiere. Solo ve su panel de referidos y ganancias.
- Con varios owners hay que definir si todos tienen el mismo poder o si existe un owner principal (ver preguntas v1).

## 5. Afiliados

### Original
Un usuario puede crear un código de afiliado para sugerir tiendas y obtener una ganancia.

### [Decidido]
- El programa de afiliados es **una opción de la tienda**: la tienda decide si ofrece un porcentaje de venta a los afiliados que quieran recomendarla. No es un reparto fijo del 2,5% de la plataforma.
- Por lo tanto, la ganancia del afiliado sale de lo que la tienda ofrece, y el 2,5% de la plataforma no se ve afectado.

### [Propuesta] Reglas a definir
- **Base y porcentaje:** la tienda fija el porcentaje (con un mínimo y un máximo permitidos por la plataforma) y la base sobre la que se calcula.
- **Qué ventas generan comisión al afiliado:** todas las ventas de la tienda referida, o solo las de clientes que llegaron por el afiliado. Solo se pueden liquidar ventas cobradas por la pasarela.
- **Duración:** por cuánto tiempo cobra el afiliado (para siempre, 12 meses, hasta un tope), definida por la tienda.
- **Cuándo se considera válida una referencia:** por ejemplo, cuando la tienda registra su primera venta cobrada por la pasarela.
- **Quién paga y cómo:** retención automática en la pasarela y reparto, o liquidación periódica por la plataforma.
- **Anti-fraude:** impedir que alguien se refiera a sí mismo o a una organización propia.
- **Pagos al afiliado:** método, monto mínimo y frecuencia.
- **Panel del afiliado:** tiendas referidas, estado y ganancias acumuladas.
- **Un mismo usuario** puede ser afiliado y owner, con cuentas separadas de ganancias y de operación.

## 6. Entidades del dominio

| Entidad | Descripción |
|---|---|
| **Organización** | Tenant. Tiene uno o varios owners, estado y configuración. |
| **Colaborador** | Usuario con rol dentro de una organización. |
| **Afiliado** | Usuario con código propio y registro de referidos. |
| **Referido** | Relación entre un afiliado y una organización sugerida. |
| **Oferta de afiliación** | Porcentaje y condiciones que una tienda ofrece a los afiliados. |
| **Canal conectado** | Credenciales de redes con las que chatia atiende a clientes. |
| **Punto de venta** | Local físico de la organización. [Decidido] Puede tener distinto dueño (franquicia). |
| **Franquicia** | Entidad que agrupa tiendas de distintos dueños. La crea el franquiciador y cada franquiciado es owner solo de su punto de venta. |
| **Terminal** | Dispositivo de escritorio vinculado a un punto de venta. |
| **Producto** | Ítem del catálogo, con variantes. Mayoría Apple, con otros ítems de tecnología permitidos. |
| **Unidad de inventario** | Existencia de un producto en un punto de venta. [Propuesta] Los equipos llevan número de serie o IMEI. |
| **Venta** | Operación en un punto de venta o en línea. |
| **Comisión de plataforma** | Registro del 2,5% por cada venta cobrada por la pasarela. |
| **Mayorista** | Proveedor conectado. |
| **Orden de wholesale** | Pedido de dropshipping hacia un mayorista. |
| **Orden de servicio** | Solicitud de soporte técnico sobre un equipo Apple. |
| **Cliente** | Persona que compra o consulta. |
| **Conversación** | Atención de chatia por una red. |

## 7. Áreas del proyecto

### 7.1 Puntos de venta

**Original**
- Locales físicos que cargan inventario.
- Pueden vender productos usados, nuevos o de otras marcas.
- Se crean desde el dashboard, relacionados a la organización.

**[Decidido]**
- El catálogo es **mayormente Apple**, pero la tienda puede subir también otros ítems de tecnología.
- Una organización puede tener **varios puntos de venta con distintos dueños** (franquicias) y también varios dueños o socios a nivel organización.
- La **tienda web pública** es el storefront del ecosistema: el mismo catálogo se publica ahí.

**[Propuesta] Detalles a considerar**
- **Inventario por local**, con transferencias entre puntos de venta de la misma organización.
- **Productos serializados:** cada equipo lleva número de serie o IMEI, y se vende una unidad concreta.
- **Equipos usados:** estado o grado (A, B, C), salud de batería, accesorios incluidos, fotos, y verificación de que no esté bloqueado ni reportado como robado.
- **Plan canje:** recibir un equipo usado como parte de pago.
- **Caja:** apertura y cierre de turno, medios de pago, arqueo.
- **Comprobantes:** la tienda factura con su propio sistema; Manzana exporta CSV (ver modelo de negocio).
- **Garantía:** plazo y condiciones por producto, nuevo o usado.

### 7.2 Wholesale

**Original**
- Conectar mayoristas para que los minoristas no dependan de invertir capital en stock.
- Generar una venta automática tipo dropshipping.

**[Decidido]**
- Se trabajará en la **v3**. Antes hay que presentar una idea y relevar qué tienen los proveedores.
- Garantías, devoluciones y reclamos: **responde la tienda que generó la venta**.

**[Propuesta] Idea para la v3 (a validar con proveedores)**

Se sugiere empezar por **proveedores externos conectados** y no por mayoristas como usuarios plenos de la plataforma. Así se valida la demanda sin construir un portal completo para el mayorista.

1. **Relevamiento previo:** qué ofrecen los proveedores hoy (API, feed, planilla, portal propio), si aceptan dropshipping, plazos de despacho y condiciones.
2. **Conectores por proveedor:** importan catálogo, precio y stock por API, feed o CSV programado.
3. **La tienda elige** qué productos ofrecer y define su margen.
4. **El cliente compra** en la tienda; el pago entra por la pasarela con el 2,5% de comisión.
5. **El sistema genera la orden** hacia el proveedor (por API, email o planilla según lo que soporte) y registra el costo.
6. **Seguimiento:** el proveedor informa despacho y el cliente recibe el tracking.
7. **Más adelante**, si hay interés, un portal de mayorista como usuario de la plataforma.

**Reglas a definir**
- Sincronización de stock y precio para no vender lo que no hay.
- Quién gestiona el envío y quién lo paga.
- Comisión de plataforma: se aplica una vez, sobre la venta final cobrada al cliente por la pasarela.
- Condiciones para que un proveedor sea aceptado.
- Cómo se paga al proveedor: la tienda directamente, o con pago dividido desde la pasarela.

### 7.3 Mantenimiento

**Original**
- Ligado a la organización y, opcionalmente, a los puntos de venta.
- Da soporte técnico a los productos de la marca.

**[Decidido]**
- Atiende **cualquier equipo de la marca Apple** que el cliente solicite a la organización, lo haya comprado ahí o no.
- Depende de la organización y quienes lo ejecutan son **colaboradores** de ella.

**[Propuesta] Flujo de una orden de servicio**
1. Recepción del equipo: cliente, equipo, serie o IMEI, falla reportada y estado físico.
2. Diagnóstico y presupuesto.
3. Aprobación del cliente.
4. Reparación, con repuestos usados.
5. Entrega, con garantía de la reparación.

Estados sugeridos: recibido, en diagnóstico, esperando aprobación, en reparación, listo para retirar, entregado, cancelado.

- El cliente recibe avisos de cada cambio de estado (servicio de notificaciones).
- Se registra el historial de reparaciones por equipo.
- Puede operar sin punto de venta (taller propio) o dentro de uno.
- Si el presupuesto o la reparación se cobran por la pasarela, aplica el 2,5%.

## 8. Aplicación de escritorio y sesión del punto de venta

### Original
El owner, o un colaborador con permiso, puede crear en la aplicación de escritorio un perfil basado en la organización para el punto de venta. Así la sesión se mantiene abierta sin depender del Gmail de un usuario.

### [Decidido]
- El **modo sin conexión** no es parte de la v1: se integra **WatermelonDB en la v3** para la terminal y la app móvil. El dashboard web requiere conexión.

### [Propuesta] Cómo estructurarlo
- Cada **terminal** se registra una vez, con un código de vinculación generado en el dashboard. A partir de ahí tiene su propia credencial, ligada a la organización y al punto de venta.
- La credencial de la terminal **se puede revocar** desde el dashboard (por ejemplo, si roban la computadora).
- La terminal mantiene la sesión abierta, pero **cada venta se registra a nombre de la persona que opera**, con un PIN o un cambio rápido de operador.
- Queda auditoría de quién hizo cada operación.
- La terminal solo accede a lo del punto de venta al que está vinculada.

## 9. Reglas de negocio

### Originales
- Un usuario puede crear una organización o un código de afiliado.
- Solo el owner configura las credenciales de las redes.
- Los productos y los puntos de venta pertenecen a una organización.
- Un colaborador actúa según el rol que le dio el owner.

### [Decididas]
- **Comisión del 2,5%** solo sobre ventas cobradas por la pasarela.
- **Garantías y devoluciones** las responde la tienda que generó la venta, también en wholesale.
- **Facturación** a cargo de la tienda; la plataforma entrega CSV.
- **Afiliados**: la tienda decide si ofrece porcentaje y cuánto.

### [Propuestas]
- **Aislamiento:** una organización nunca ve datos de otra. Dentro de una organización con franquicias, cada punto de venta con distinto dueño solo ve lo suyo salvo lo que se comparta explícitamente.
- **Un equipo, una unidad:** un mismo número de serie no puede venderse dos veces.
- **Stock coherente:** no se vende más de lo que hay en el local o en el proveedor.
- **Marca:** el sistema no debe presentar una tienda como distribuidor oficial de Apple si no lo es. Hay que revisar el uso de marca y las leyes de comercio y de equipos usados.
- **Equipos usados:** se exige serie o IMEI, y se advierte de equipos con bloqueo o reporte de robo.
- **Datos de clientes:** se guardan según la ley local de protección de datos.
- **Sin membresía:** crear una organización es gratis y no hay planes. Todas las funciones están disponibles desde el inicio.
- **Comisión registrada:** se registra por cada venta, con su base de cálculo, y se revierte ante devoluciones o anulaciones.
- **Sin ventas, sin costo:** una tienda sin ventas por la pasarela no paga nada.

## 10. Mapeo a la plataforma

| Necesidad de Manzana | Ya existe | Falta |
|---|---|---|
| Atención al cliente por redes | chatia (WhatsApp, Instagram, Messenger, TikTok) | Contexto de tienda: catálogo, stock y precios para la IA |
| Organizaciones y colaboradores | SaaS (`Organization`, `Collaborator`, `Invitation`) | Roles propios de Manzana, permisos por punto de venta y múltiples owners |
| Afiliados | SaaS (`AffiliateData`) | Oferta de afiliación por tienda, panel y pagos |
| Catálogo, variantes e inventario | ecommerce-back (`Product`, `ProductVariant`, `InventoryItem`) | Serie o IMEI, estado de usados, inventario por local |
| Tienda web pública | Ecosistema storefront | Publicar el catálogo de Manzana |
| Ventas en línea | ecommerce-back (carrito y pedidos) | — |
| Punto de venta | App de escritorio (Tauri) y puntos de venta | Ventas de mostrador, caja, terminales y operadores |
| Cobros | pasarelapagos | Retención automática del 2,5% y, en v3, división de pagos para wholesale |
| Comisión del 2,5% | pasarelapagos (`Payment`, `PaymentEvent`) y superadmin | Registro de la comisión por cada pago y reparto al afiliado |
| Exportación contable | analytics / ecommerce-back | Exportación CSV de ventas y comisiones |
| Avisos al cliente | notificaciones (WhatsApp, email y push) | Plantillas de órdenes de servicio |
| Campañas | marketing y workers | — |
| Métricas | analytics | Ventas por local, rotación de stock |
| Mayoristas | — | Conectores a proveedores y flujo de wholesale (nuevo, v3) |
| Mantenimiento | — | Órdenes de servicio (nuevo, v2) |
| Modo sin conexión | — | WatermelonDB en terminal y app móvil (v3) |
| App móvil | — | App para la organización: atención, órdenes de servicio, stock y ventas (v2) |
| Gestión global | superadmin | Vista de organizaciones, afiliados y comisiones |

El tenant `manzana` ya existe como módulo en los microservicios (chatia, notificaciones, analytics, pasarelapagos y marketing).

## 11. Alcance por versión

- **v1:** organizaciones (con owners/socios y poderes entre ellos), colaboradores, conexión de redes con un botón (chatia, ecosistema ms), catálogo por punto de venta con plantillas precargadas, puntos de venta con stock y vista general, storefront solo para ver el catálogo y terminal de escritorio con perfil de organización (dashboard). **Sin pagos, sin CSV y sin afiliados**: llegan más adelante con los pagos.
- **v2:** ventas de mostrador completas (caja y ticket interno), equipos usados con serie o IMEI, mantenimiento (órdenes de servicio, solicitadas por storefront, chat o recepción) y **aplicación móvil** (Expo/React Native) para la organización (owner y colaboradores), orientada a optimizar los procesos del día a día. La app móvil es una mejora operacional para cada usuario, no un derivado del dashboard.
- **v3:** wholesale y dropshipping (con proveedores relevados previamente), plan canje y **modo sin conexión con WatermelonDB** (terminal y app móvil; el dashboard web requiere conexión).

*(El reparto es una propuesta. Hay que confirmarlo.)*

## 12. Decisiones tomadas (ex preguntas abiertas v0.2)

| # | Tema | Decisión |
|---|---|---|
| 1 | Comisión | Se aplica a lo cobrado por la pasarela, dentro del ecosistema. |
| 2 | Afiliados | Opción de la tienda: ofrece un porcentaje de venta a quien la recomiende. |
| 3 | Mayoristas | Idea a presentar en v3, tras relevar qué tienen los proveedores. |
| 4 | Garantías en wholesale | Responde la tienda que generó la venta. |
| 5 | Marcas | Mayoría Apple; la tienda puede agregar otros ítems de tecnología. |
| 6 | Fiscal | La tienda gestiona su facturación; la plataforma entrega CSV. |
| 7 | Mantenimiento | Cualquier equipo Apple; lo atienden colaboradores de la organización. |
| 8 | Sin conexión | WatermelonDB en v3 para terminal y móvil; el dashboard requiere conexión. |
| 9 | Franquicias | Sí, varios puntos de venta con distintos dueños; la organización puede tener dueños o socios. |
| 10 | Tienda web | Es el storefront del ecosistema. |

## 13. Especificación por versión

Esta sección se arma con tus respuestas: cada pregunta respondida pasa acá y sale de la sección 14. **[Decidido]** sale de tus respuestas. **[Pendiente]** tiene una pregunta abierta en la sección 14.

### 13.1 Reglas generales (todas las versiones)

- **[Decidido]** El 2,5% lo paga el **comprador** como cargo extra, igual que en Mexus. Se muestra como una **línea separada "Cargo de servicio"** antes de pagar, junto al total de la compra.
- **[Decidido]** Pasarela inicial: **Mercado Pago, en Argentina**. Los cobros los maneja y configura el microservicio de pagos junto con las pasarelas; Manzana no implementa la lógica de cobro.
- **[Decidido]** Una venta de mostrador en efectivo no paga comisión, pero **se puede cargar manualmente** para tener inventario y CSV.
- **[Decidido]** Los servicios con costo externo (por ejemplo la consulta de IMEI) se ofrecen como **servicios o apps internas que paga la tienda con tokens de consumo**, para que la plataforma no absorba el costo por cada consulta. Consumen tokens **todos los servicios con costo externo**: consulta de IMEI, otras verificaciones y notificaciones salientes de mantenimiento por WhatsApp.

- **[Decidido]** **Sin membresía, sin cupo de IA:** la plataforma absorbe el costo de IA y soporte de una tienda hasta que empiece a vender. Se controla con una **pausa automática de la IA** a las tiendas que pasan **90 días sin vender**, hasta que vuelvan a vender (reemplaza la alerta interna por monto). **[Pendiente]** reglas de aviso y reactivación (Ronda 7, generales 1).
- **[Decidido]** **Crecimiento tras el piloto:** referidos entre tiendas y programa de afiliados, alianzas con distribuidores y mayoristas, y marketing para que cualquiera pueda crear su tienda. **Sin meta numérica**: se ajusta según lo que muestre el piloto. Tampoco hay comparativo con la competencia por ahora.
- **[Decidido]** **Privacidad:** GDPR como estándar global, con adaptación por país (por ejemplo la Ley 25.326 de Argentina), igual que en Mexus.
- **[Decidido]** **Ventaja principal frente a Shopify POS:** costo cero de entrada y comisión solo cuando la tienda vende.


### 13.2 v1 — Organizaciones, redes, catálogo, puntos de venta y terminal

**Alcance:** gestión de la tienda. Sin pagos, sin CSV y sin afiliados (llegan en v2).

**Organización y owners**
- **[Decidido]** Con varios owners o socios, los **poderes se reparten de forma democrática**, por socio o en general, para el manejo del sistema.
- **[Decidido]** Las **acciones críticas** (quitar un owner, eliminar la organización, cambiar la pasarela) se deciden por **votación por mayoría entre owners**. El resto se reparte por área: finanzas, catálogo y personal. Cada owner tiene **un voto** y alcanza la **mayoría simple** (más del 50%).

**Franquicias**
- **[Decidido]** Existe una entidad **Franquicia/Grupo** que crea el franquiciador. Cada franquiciado es **owner solo de su punto de venta** y ve únicamente su local. El catálogo y los precios sugeridos del franquiciador son de **solo lectura** para ellos.
- **[Decidido]** Por ahora la plataforma **no calcula regalías**: el franquiciador ve las ventas de cada local y las liquida por fuera.

**Catálogo**
- **[Decidido]** Hay **dos catálogos**: el del **mayorista** (base por defecto, para la venta tipo dropshipping) y el de **cada punto de venta**.
- **[Decidido]** La **plataforma mantiene la plantilla** de catálogo base (modelos, colores y capacidades) y la tienda solo agrega precio y stock, para precargar rápido.

**Redes y atención con IA (chatia)**
- **[Decidido]** La conexión la resuelve el **ecosistema ms**: la tienda aprieta un botón y conecta su business con la app del ecosistema, que opera como **tech provider en Meta**. El alta usa un flujo guiado de registro embebido (el cliente inicia sesión con Meta y elige su número o cuenta).
- **[Decidido]** La IA usa catálogo y stock de los puntos de venta. Elige el punto de venta **por la ubicación del cliente**, contra la dirección de cada punto que tiene el producto en stock. Si el pedido es online, busca el centro de distribución más cercano.
- **[Decidido]** Un ciclo de venta con **LangGraph** guía al cliente. La IA deja el **pedido precargado** (un link a una bolsa) y, cuando el cliente decide cerrar, el link lleva a la página donde termina la compra.
- **[Decidido]** Como en v1 no hay pagos, el pedido queda **"a coordinar"**: el punto de venta lo confirma por chat y el cliente lo retira o acuerda el pago en el local. Estados: **Nuevo → Confirmado por el punto de venta → Retirado o Cancelado**, con **vencimiento automático** (por ejemplo 48 h).
- **[Decidido]** El cliente puede **pedir atención personalizada** si no quiere hablar con la IA. Lo pide con un **botón o la frase "hablar con una persona"** y la conversación pasa al **vendedor del punto de venta más cercano**.

**Puntos de venta, terminal y storefront**
- **[Decidido]** La terminal gestiona el **catálogo y el stock de su punto de venta** y ofrece una **vista generalizada** de todos.
- **[Decidido]** El storefront público sale en v1, **solo para ver el catálogo**, sin cobros.

**Marca, primeras tiendas y criterio 10/10**
- **[Decidido]** **Marca Apple:** se busca un **acuerdo con Apple** (programa de revendedores autorizados) para las tiendas que cumplan los requisitos. **El trámite se inicia cuando haya volumen de ventas**, no durante el piloto. Mientras tanto, **cada tienda responde por su uso de marca** bajo los términos de servicio, sin aviso de la plataforma. **[Pendiente]** si eso alcanza para proteger a la plataforma (Ronda 7, v1 1).
- **[Decidido]** **Primeras tiendas:** piloto con **3 a 5 tiendas conocidas**, con onboarding asistido y el catálogo cargado por el equipo. El perfil no está fijo: depende de las tiendas que se consigan, priorizando **tiendas pequeñas con un solo local** para validar lo básico. El catálogo se carga por **planilla (CSV) con la plantilla Apple precargada**.
- **[Decidido]** **Criterio 10/10 de la v1:** una tienda carga su catálogo en **menos de un día**, el stock queda correcto en **al menos el 98%** de los productos y hay **3 tiendas activas a las 8 semanas**. Una tienda **activa** actualiza el stock al menos una vez por semana y recibe o confirma al menos un pedido "a coordinar" al mes. El stock se verifica con un **conteo físico de 50 productos** al cierre de las semanas 2 y 8.
- **[Decidido]** **Medición de la IA de ventas:** porcentaje de conversaciones que terminan en pedido precargado, porcentaje de esos que el punto de venta confirma y cero precios o stock inventados por la IA.


### 13.3 v2 — Pagos, mostrador, usados, mantenimiento y app móvil

**Pagos y afiliados**
- **[Decidido]** Los **cobros online y los afiliados entran en v2**, junto con los pagos del mostrador y de mantenimiento. El CSV para el contador llega con los pagos.
- **[Decidido]** El afiliado cobra un porcentaje de lo que **gana la tienda**, no del 2,5% de la plataforma. La plataforma fija un mínimo y un máximo (por ejemplo 1% a 10%) y la tienda elige la duración, hasta 12 meses. La **base de cálculo** es el **precio de venta sin impuestos**. No hay tope relativo al margen: **cada organización define el porcentaje según su porción de ganancia**, dentro del mínimo y máximo de la plataforma. **Sin aviso** cuando el porcentaje supera el margen: la organización decide.

**Mostrador y caja**
- **[Decidido]** Comprobante: **ticket interno + CSV**; la facturación la maneja el contador de la tienda.
- **[Decidido]** **Caja por punto de venta:** apertura con fondo inicial, movimientos (ventas, ingresos y egresos) y cierre con arqueo y diferencia.
- **[Decidido]** El arqueo muestra la **diferencia al cerrar**.
- **[Decidido]** **Cobro del 2,5%:** la tienda conecta su Mercado Pago por autorización (OAuth) y cada cobro lleva la comisión de la plataforma; se valida con una prueba real antes de empezar la v2.
- **[Decidido]** **Mostrador:** QR dinámico de la pasarela en la terminal y un lector de tarjeta compatible, con el cargo de servicio visible, para incentivar el cobro por pasarela (el efectivo no paga comisión).

**Equipos usados**
- **[Decidido]** Verificación de IMEI: **servicio opcional** de consulta a una base global de IMEI reportados desde el alta del equipo. Se ofrece como app del **catálogo de servicios internos** (suscripción mensual) y el consumo se traslada a la tienda como **tokens de consumo**. Los tokens funcionan con una **cantidad mensual incluida en la suscripción y recarga al agotarse**.
- **[Decidido]** Los grados de usados dependen del modelo; **se define más adelante**.
- **[Decidido]** **Usado sin IMEI verificado:** etiqueta visible "IMEI no verificado" en la ficha y declaración de la tienda de que el equipo es legítimo.
- **[Decidido]** **Garantía por número de serie** (de usados y reparaciones): el plazo lo define la tienda por producto y, al consultar la serie, se muestra la vigencia.

**Mantenimiento**
- **[Decidido]** El cliente solicita la reparación **por storefront, chat con IA o recepción**. La solicitud la **acepta un colaborador autorizado** para mantenimiento. Si ningún técnico la acepta, **escala al gerente** del punto de venta tras un tiempo configurable y se avisa al cliente.
- **[Decidido]** Presupuesto y reparación se pueden **pagar por pasarela**. La seña o pago anticipado depende del **punto de venta** y del acuerdo con el cliente.
- **[Decidido]** **Repuestos:** módulo dentro de mantenimiento. Cada repuesto en una orden lleva **cantidad, costo, precio al cliente y margen**. Si hay ítems en el inventario se descuentan (opcional); si no, se cargan manualmente en la orden.
- **[Decidido]** **Tiempo de reparación:** referencia estándar de **5 días hábiles**, pero **el plazo lo define cada tienda**, con aviso de cada cambio de estado.

**App móvil**
- **[Decidido]** La app móvil es **para la organización** (owner y colaboradores), para optimizar los procesos del día a día. **No incluye al cliente final** (actualiza la decisión anterior).
- **[Decidido]** Se desarrolla en **Expo / React Native** para iOS y Android. No replica el dashboard.
- **[Decidido]** Funciones: chat de atención (IA y personas), órdenes de servicio, stock por punto de venta, ventas del día, notificaciones y **escaneo de código o número de serie con la cámara** para el inventario.

**Antifraude y criterio 10/10**
- **[Decidido]** **Venta online de equipos de alto valor:** 3D Secure, revisión manual sobre un monto configurable y verificación de identidad al retirar, además de las protecciones de la pasarela. La revisión manual la hace el **equipo de la plataforma**. El monto es configurable por tienda con un mínimo fijado por la plataforma; respuesta en **4 horas hábiles** y, si el equipo no llega, pasa al gerente del punto de venta.
- **[Decidido]** **Criterio 10/10 de la v2:** el **100%** de las ventas con número de serie registrado, garantías consultables y tiempo medio de reparación medido.


### 13.4 v3 — Wholesale, plan canje y modo sin conexión

**Wholesale**
- **[Decidido]** El proveedor acepta que la venta la hace la **tienda con su marca**: despacha sin identificarse y solo recibe su pago. El cliente ve siempre a la tienda.
- **[Decidido]** Conexión de proveedores con un **conector estándar de feed**: cada proveedor publica en un formato común y la plataforma lo consume. Formato: **esquema propio en JSON** que los proveedores envían por API.
- **[Decidido]** El pago se **divide automáticamente desde la pasarela**. El 2,5% se calcula sobre el **total cobrado al cliente**, como un fee. El dinero se libera al proveedor **al confirmarse la entrega al cliente**. Se valida antes con una **prueba técnica con una cuenta real de Mercado Pago** (retención, división y liberación diferida); si no es posible, el dinero se libera al despachar.
- **[Decidido]** Si el proveedor se queda **sin stock**, se hace **ruteo al siguiente proveedor con stock** y se avisa al cliente; si ninguno tiene, se reembolsa. Criterio: **orden de prioridad definido por la tienda**.
- **[Decidido]** **Devoluciones:** la tienda recibe el equipo y gestiona la devolución con el proveedor.

**Plan canje**
- **[Decidido]** Tabla de valores base por modelo y capacidad + cuestionario de estado y **ajuste final tras la inspección del técnico**. El 2,5% se calcula sobre lo realmente cobrado por la pasarela (ya descontado el canje). El equipo recibido **entra al inventario como unidad de usado en estado "pendiente de revisión"**, que el técnico completa, y la tienda **decide cuándo publicarlo** en la sección de usados (no es automático).

**Modo sin conexión (WatermelonDB)**
- **[Decidido]** **Offline-first:** ventas de mostrador (efectivo), consulta de stock y órdenes de servicio funcionan sin conexión y sincronizan al volver. Pagos por pasarela y chat requieren conexión.
- **[Decidido]** **Terminal y app móvil** operan sin conexión hasta **72 h**; el **dashboard web requiere conexión**. Queda confirmado: el dashboard no opera sin conexión. Prueba de campo: 2 terminales y 1 móvil sin conexión por 72 h en una tienda piloto, más un simulador de conflictos (misma serie vendida en dos puntos, transferencias a medias), con meta de **0 series vendidas dos veces**.
- **[Decidido]** **Conflictos:** las unidades serializadas se **asignan a un punto de venta** y sin conexión solo se vende lo asignado a ese punto. Las transferencias entre puntos de venta se hacen **con confirmación de recepción** del punto de destino.

**Proveedores, precios y criterio 10/10**
- **[Decidido]** **Requisitos para aceptar a un proveedor:** feed o API, despacho en 48 h como máximo y política de garantía y devoluciones definida. Se construye el **conector estándar** y los proveedores se suman; **no se exige un acuerdo previo con proveedores reales** (Ronda 7, v3 1).
- **[Decidido]** **Stock del proveedor:** sincronización **en tiempo real por webhook**. Si el proveedor no tiene webhook, se conecta con **sincronización periódica cada 15 minutos** como respaldo. Contra la sobreventa: **stock de seguridad** (por ejemplo 1 unidad menos de la informada) y **confirmación del proveedor antes de cobrar** la venta.
- **[Decidido]** **Precios Apple:** Apple tiene **precio de venta establecido para resellers**, por lo que el margen de la tienda sale de la diferencia con el costo del proveedor. Los equipos **Apple nuevos** llevan el precio de reventa establecido por el proveedor; los **usados y otras marcas**, precio libre. El porcentaje del afiliado se calcula sobre ese precio y el margen acotado lo asume la organización.
- **[Decidido]** **Criterio 10/10 de la v3:** más del **95%** de las órdenes de dropshipping entregadas a tiempo y menos del **1%** con defectos. La entrega a tiempo se mide con el **seguimiento del proveedor contra la fecha prometida al cliente**.


## 14. Preguntas abiertas por versión

Ronda 7: las respuestas de la ronda 6 pasaron a la sección 13. Quedan solo las preguntas que frenan el puntaje de cada versión (ver la tabla del principio).

**Cómo responder:** marcá con `[x]` la opción elegida (cada una cita cómo lo resolvió una empresa de referencia). La última opción es para escribir tu propia respuesta. Las respuestas ya escritas en `respuesta:` se mantienen.

### Generales (afectan a todas las versiones)

1. Pausa de la IA a los 90 días sin vender: ¿cómo se avisa y se reactiva?
respuesta:
   - [ ] A) **(Recomendada)** Aviso al owner a los 75 días; la pausa afecta solo a la IA (el catálogo, la terminal y el storefront siguen funcionando) y se reactiva sola con la primera venta cobrada por la pasarela o a pedido del owner. — *Ref: Shopify (aviso previo a la pausa de tiendas inactivas).*
   - [ ] B) Sin aviso previo; se reactiva a pedido. — *Ref: Square (cuentas inactivas sin aviso).*
   - [ ] C) Propia: 

### v1 — Organizaciones, redes, catálogo, puntos de venta y terminal

1. Cada tienda responde por su uso de la marca Apple, sin aviso de la plataforma: ¿alcanza para proteger a Manzana?
respuesta:
   - [ ] A) **(Recomendada)** Además de los términos, el storefront muestra por defecto "tienda independiente, no distribuidor autorizado de Apple"; solo se puede quitar si la tienda acredita serlo. — *Ref: Back Market (marca propia, con aviso claro sobre el estado del equipo).*
   - [ ] B) Alcanza con los términos de servicio, como está decidido. — *Ref: Shopify (la tienda responde por su contenido).*
   - [ ] C) Propia: 

### v3 — Wholesale, plan canje y modo sin conexión

1. Wholesale se construye sin acuerdo previo con proveedores reales: ¿cuándo se considera listo para abrirse a las tiendas?
respuesta:
   - [ ] A) **(Recomendada)** Cuando haya al menos 2 proveedores reales conectados y entregando en pruebas; hasta entonces no se abre a las tiendas. — *Ref: Back Market (acuerdos con reacondicionadores antes de escalar).*
   - [ ] B) Se abre con el conector listo y se suman los proveedores que lleguen. — *Ref: Shopify (apps de dropshipping sobre una API abierta).*
   - [ ] C) Propia: 


## 15. Plataforma: base y construcción

Esta sección baja Manzana a la plataforma del ecosistema (`CLAUDE.md`, `services/`, `modules/`, `contracts/`). Dice qué se hereda tal cual, qué entidades y funciones hay que construir y en qué orden. Lo **[Propuesta]** hay que confirmarlo antes de implementar.

**Particularidad de Manzana:** es comercio, así que es el caso que más reutiliza la plataforma: catálogo, inventario, carrito, órdenes y storefront ya existen. Lo nuevo es lo que rodea al comercio: puntos de venta y franquicias, serie e IMEI, afiliados, wholesale y mantenimiento.

### 15.1 Qué se hereda sin tocar

| Capacidad | Dónde vive hoy | Uso en Manzana |
|---|---|---|
| Identidad, sesión, dispositivos | `realsass-sass-back` (ADR-004/020) | Login del owner y los colaboradores |
| Organización = tenant | `Organization` (`ecosystemId`, `slug`, `status`, `storeStatus`, `countryCode`, `dataRegion`) | Una tienda = una organización, con `ecosystemId = "manzana"` |
| Colaboradores e invitaciones | `Collaborator` (permisos JSONB, ADR-001), `Invitation` | Equipo de la tienda |
| Afiliados | `AffiliateData` (modelo base) | Código de afiliado y referidos |
| Flags, cuotas, secretos, tema, plantillas, auditoría, webhooks | `FeatureFlag`, `QuotaConfig`, `SecretConfig`, `ThemeConfig`, `ContentTemplate`, `ConfigAuditLog`, `WebhookEndpoint` | Activar módulos por versión, credenciales de redes y de la pasarela, tema del storefront, plantillas precargadas del catálogo |
| Catálogo | `ecommerce-back`: `Category`, `Product`, `ProductVariant` | Catálogo Apple y de otras marcas |
| Inventario | `InventoryItem` y reserva atómica de stock en el checkout | Stock por producto |
| Carrito y órdenes | `Cart`, `CartItem`, `Order`, `OrderItem`, `OrderStatusEvent`, `OutboxEvent`, `IdempotencyKey` (ADR-029) | Ventas en línea; las de mostrador se apoyan en lo mismo |
| Clientes | `StoreCustomer`, `CustomerAddress`, `CustomerActivityEvent` (ADR-021) | Compradores |
| Storefront | `real-ecommerce-front` (`/{locale}/{slug}`, SEO e idioma, Markets) | Vitrina pública del catálogo |
| Escritorio | `realsass-dashboard-desktop` (Tauri, ADR-023) | Terminal del punto de venta |
| IA y canales | chatia (ecosistema-ms) | Atención por redes |
| Cobros, avisos, campañas, métricas, gestión global | pasarelapagos, notificaciones, marketing, analytics, superadmin | Ver 15.3 |

### 15.2 Entidades que hay que construir

| Entidad | Origen | Notas |
|---|---|---|
| **Punto de venta** | Nueva | Sede de la organización; agrupa inventario, terminales y operadores. |
| **Franquicia** | Nueva | Agrupa tiendas de distintos dueños. [Propuesta] Cada franquiciado es su propia `Organization`, enlazada a la franquicia, para no romper el aislamiento por `organizationId`. |
| **Owners múltiples** | Extiende `Organization` (hoy tiene un solo `userId`) | Socios con poderes entre ellos; cambio de modelo en sass-back. |
| **Permisos por punto de venta** | Extiende los permisos JSONB de `Collaborator` | Un colaborador puede operar solo en algunos locales. |
| **Terminal** | Nueva | Dispositivo de escritorio ligado a un punto de venta, con credencial y operador. |
| **Unidad de inventario** | Extiende `InventoryItem` | Serie o IMEI, condición (nuevo, usado), estado de verificación y garantía por serie. |
| **Inventario por local** | Extiende `InventoryItem` | Hoy el stock es por organización. |
| **Plantilla de catálogo** | Reutiliza `ContentTemplate` (a evaluar) | Plantillas Apple precargadas. |
| **Venta de mostrador** | Extiende `Order` | Origen, punto de venta, operador, caja y ticket interno (v2). |
| **Comisión de plataforma** | pasarelapagos (`Payment`, `PaymentEvent`) | 2,5% por pago de la pasarela; se revierte en proporción (v2 con pagos). |
| **Oferta de afiliación, Referido, Pago al afiliado** | Extiende `AffiliateData` | Porcentaje por tienda y liquidación. |
| **Mayorista, Feed, Orden de wholesale** (v3) | Nueva | Feed JSON, ruteo, respaldo de 15 minutos con stock de seguridad. |
| **Orden de servicio y Garantía** (v2) | Nueva | Solicitada por storefront, chat o recepción; plazo fijado por la tienda. |
| **Conversación** | chatia | Se consulta, no se duplica. |

### 15.3 Funciones por capa

**Back [Propuesta]:** el catálogo, el inventario y las ventas se extienden dentro de `realsass-ecommerce-back`, sin duplicar sus modelos. Los dominios nuevos (afiliados ampliados, wholesale, órdenes de servicio) se arman como módulos con `domain/` + `repository/` (molde: `catalog/`). Si wholesale crece, pasa a un back propio en v3.
- `adminCatalog.*` y `adminInventory.*` (existen): sumar punto de venta, serie o IMEI, condición y plantillas.
- `puntosDeVenta.*`, `terminales.*`, `franquicias.*`: alta, vínculo, permisos y estado.
- `adminOrders.*` y `pos.*`: venta de mostrador, caja, ticket (v2).
- `afiliados.*`: oferta, referidos y liquidación.
- `servicio.*`: órdenes de servicio, estados y garantía (v2).
- `wholesale.*`: mayoristas, feed, ruteo y orden (v3).
- Cobro y comisión: pasarelapagos con Mercado Pago por autorización (OAuth); el CSV de ventas sale de analytics o del back.
- REST solo para webhooks inbound (mayoristas, pasarela) y para API pública futura.

**Front:**
- `realsass-sass-front` (owner): alta de organización, redes con un botón, franquicia, afiliados y datos de la pasarela.
- `realsass-dashboard-front` (colaboradores): catálogo por local, inventario, puntos de venta, órdenes de servicio, métricas, equipo.
- `real-ecommerce-front`: vitrina del catálogo (v1 solo para ver, sin compra).
- `realsass-dashboard-desktop`: terminal del punto de venta con el perfil de la organización.
- App móvil (Expo, v2): proyecto nuevo; consume los mismos routers tRPC.

**Reglas que aplican:** tRPC para todo lo interno, `organizationId` en cada modelo con RLS, reserva de stock atómica y confirmación de pagos idempotente (ADR-029), `@real/ui` sin UI propia, 4 estados en cada vista, y contratos desde `@real/trpc/dist` (ADR-019).

### 15.4 Configuración por tenant

| Mecanismo | Valores para Manzana |
|---|---|
| `ecosystemId` | `manzana` |
| Región de datos | `Organization.dataRegion` (`ar` o `us`, ADR-031; hoy ambas en la misma infraestructura). `countryCode` define la ley; `Market` define a qué países vende |
| `FeatureFlag` | `manzana.pos` (v2), `manzana.used` (v2), `manzana.service` (v2), `manzana.mobile` (v2), `manzana.wholesale` (v3), `manzana.offline` (v3), `manzana.affiliates` |
| `QuotaConfig` | Puntos de venta, terminales y colaboradores por tienda (a definir) |
| Permisos de colaborador | Por punto de venta: catálogo, inventario, caja, servicio, afiliados |
| Pasarela | Mercado Pago con OAuth por tienda; el 2,5% se separa en cada autorización |

### 15.5 Orden de construcción

1. **v1 base:** `ecosystemId`, owners múltiples, puntos de venta, catálogo por local con plantillas, stock por local, redes con un botón, vitrina y terminal con perfil. Sin pagos, CSV ni afiliados.
2. **v2:** pagos con comisión y CSV, mostrador y caja, usados con serie o IMEI, órdenes de servicio, afiliados y app móvil.
3. **v3:** wholesale y dropshipping, plan canje y modo sin conexión (WatermelonDB).

### 15.6 Decisiones que faltan para empezar

- Región de datos (ADR-031): hoy una sola región para tiendas de Argentina y de EE.UU. Una tienda que vende a otros países (Markets) sigue regida por la ley de su país de origen; las reglas de datos de compradores de otros países se revisan antes de abrir esos mercados.

- Franquicias: confirmar que cada franquiciado es su propia organización o si hace falta un nivel de tenant bajo la organización.
- El modo sin conexión de la terminal contradice el escritorio como "cascarón fino" de ADR-023. Hace falta un ADR nuevo antes de la v3.
- La comisión del 2,5% y el CSV son iguales en Manzana y Mexus: conviene construirlos una sola vez en pasarelapagos y analytics, no por empresa.
