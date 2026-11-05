# Welver — Dominio

> Estado: borrador v0.8. Lo marcado con **[Decidido]** sale de las respuestas dadas a las preguntas abiertas. Lo marcado con **[Propuesta]** es una mejora sugerida sobre la idea original y está pendiente de confirmar. Todo lo demás sale de la idea original.

## Pilares y camino al 10/10

> **Empresa 10/10 de referencia:** **Intercom (Fin)** como producto de atención con IA, y **Granicus** como modelo de venta a gobiernos. **Boti** (Ciudad de Buenos Aires) es la prueba de que el modelo funciona.
> **Nivel actual de la especificación: 6,5/10.** Equivale a un concepto sólido de producto de IA para gobiernos, con calidad, privacidad, moneda, tope de costos y camino de contratación del piloto definidos. Lo que lo frena: faltan los montos, el piloto va en autoservicio puro con un municipio poco digitalizado, la voz se construye sin prueba técnica previa y el saludo libre choca con la regla de identificarse como IA.
> **Escala de referencia:** Intercom 9 · Boti 7 (para una ciudad) · Welver 6,5.


- Un municipio es un cliente (tenant). Dentro tiene un organigrama: secretarías, y dentro de ellas áreas o entidades (Salud, Obras Públicas, Rentas, Cultura y demás).
- Cada secretaría o entidad carga su propio contenido: trámites, requisitos, horarios, direcciones, teléfonos, preguntas frecuentes.
- El chat atiende al ciudadano con ese contenido. Si pregunta por un permiso de obra, responde con lo que cargó Obras Públicas, no con lo de Salud. Si no sabe o es un caso para una persona, deriva a la entidad correcta.

### Pilares

| # | Pilar | Hoy | Para llegar al 10 |
|---|---|---|---|
| 1 | **Calidad y confiabilidad de la IA** (no inventa, cita la fuente) | Reglas, meta de 95%, "resuelta" definida (sin insistencia en 24 h) y preguntas trampa al 100% antes de publicar | Evaluación continua de respuestas, citas del ente y control de errores en trámites públicos |
| 2 | **Base de conocimiento y organigrama** | Definido (árbol, texto y PDFs, versiones); piloto en municipio chico, sin sitio web para importar y con carga en autoservicio; sin control de datos viejos (se usa la última versión) | Importación del sitio del municipio y control de datos desactualizados |
| 3 | **Canales y voz** (Meta, WhatsApp) | Definido; voz por Meta que se construye sin prueba técnica previa de latencia ni de costo; sin límite de minutos | Todos los canales y la voz funcionando con latencia menor a 1 segundo |
| 4 | **Modelo comercial** (paquete único, descuento anual) | 4 tramos en dólares y tope por tramo (3 veces el uso medio del piloto); faltan los montos | Precio cerrado, moneda de cobro y protección contra costos de uso ilimitado |
| 5 | **Venta a gobierno y cumplimiento** | Parcial: región de datos por municipio (ADR-031), contrato de datos, retención configurable y convenio de prueba a los 60 días si el fondo no responde; sin camino de licitaciones | Camino de licitaciones y contratos, datos alojados en el país y política de privacidad |
| 6 | **Métricas e impacto** | Tablero definido (v2), con ahorro calculado con el costo de atención del municipio y casos de éxito con métricas agregadas autorizadas por contrato | Medición de consultas resueltas y satisfacción, con casos de éxito para vender al siguiente municipio |
| 7 | **Operación y costos** | No definido | Costo por conversación medido y capacidad de atender muchos municipios a la vez |

### Qué falta para el 10/10 por versión

| Versión | Hoy | Qué falta para el 10/10 | Preguntas (sección 14) |
|---|---|---|---|
| **Generales** | 7/10 | Los montos finales de los 4 tramos y el camino de licitaciones | Pendiente de datos del piloto |
| **v1** | 7/10 | Cobertura mínima de la base antes de abrir al público (piloto en autoservicio con municipio poco digitalizado) | Ronda 7, v1 1 |
| **v2** | 6,5/10 | Postura sobre la página de estado pública y cobertura de datos viejos | Ronda 7, v2 1 |
| **v3** | 5/10 | Conciliar el saludo libre con la identificación como IA, y alerta de costo de voz sin límite de minutos | Ronda 7, v3 1–2 |

### Requisitos para el 10/10

**Se pueden resolver en este documento (llevan a 8):**
- Precio, moneda y protección de costos del paquete único. *(Decididos tramos, dólares y tope; faltan los montos.)*
- Camino de venta a municipios (licitaciones, contratos, datos en el país). *(Convenio de prueba a los 60 días decidido. Datos en el país: el municipio argentino queda en la región lógica `ar`, pero hoy se sirve desde infraestructura en EE.UU., con contrato de transferencia internacional (ADR-031); no se puede prometer residencia física en Argentina y queda condicionado a la validación legal. Faltan las licitaciones.)*
- ~~Método para medir la calidad de las respuestas de la IA.~~ *(Decidido, con definición de "resuelta" y pruebas de seguridad.)*
- ~~Confirmación de la voz por Meta.~~ *(Decidida; se construye sin prueba técnica previa.)*
- ~~Métricas de éxito por versión.~~ *(Definidas.)*

**Solo con producto funcionando (llevan a 9–10):**
- Un municipio piloto con datos reales de consultas resueltas.
- Evidencia de que la IA no responde cosas incorrectas.
- Casos de éxito que sirvan para vender a los siguientes.

## 1. Resumen

Welver es una aplicación que provee a los municipios de **atención al ciudadano 24/7 con IA**.

El municipio contrata el paquete completo (el precio depende de la población del municipio), conecta sus redes sociales, arma su organigrama y carga la información de cada ente municipal. Esa base alimenta a un asistente de IA que informa al ciudadano en tiempo real por los canales del municipio.

### Idea original (se conserva tal cual como base)

- El municipio accede al sistema mediante el pago del **paquete completo**, con precio según la población del municipio (reemplaza las 3 membresías originales: básica, intermedia y VIP).
- Al ingresar, por defecto, el municipio puede configurar las credenciales de Meta y TikTok para conectar sus redes al sistema.
- También puede ir al dashboard, donde puede crear un organigrama y cargar datos de cada ente municipal.
- Esa base sirve para informar al ciudadano en tiempo real.
- Hay dos roles: administrador (tiene acceso a la base de la organización y da acceso a los otros) y colaboradores (usuarios creados por el admin, que gestionan el municipio según los permisos que les dio).
- El paquete incluye todo: acceso al sistema, asistente IA con chat para todas las redes, APIs para usar la IA en sistemas municipales (con perfiles para cada uso específico) y respuesta por llamada de voz con IA.

## 2. Usuarios del sistema

| Actor | Quién es | Qué busca |
|---|---|---|
| **Municipio** | La organización cliente (tenant). | Atender a los ciudadanos las 24 h sin aumentar personal. |
| **Administrador** | Responsable del municipio en la plataforma. | Configurar el sistema y dar acceso al equipo. |
| **Colaborador** | Empleado del municipio. | Mantener actualizada la información de su área. |
| **Ciudadano** | Quien consulta por redes, web o teléfono. | Respuestas rápidas y correctas. No tiene cuenta en el sistema. |
| **Sistema municipal** | Software del municipio que consume la API. | Usar la IA desde sus propias aplicaciones (API, v2). |
| **Superadmin de la plataforma** | Equipo dueño de Welver. | Gestionar municipios, precios por tramo y estadísticas globales. |

## 3. Glosario

- **Municipio:** cliente de la plataforma. Es el tenant.
- **Ente municipal:** área u organismo del municipio (Tránsito, Rentas, Obras, Salud…). Forma parte del organigrama.
- **Organigrama:** árbol jerárquico de entes del municipio.
- **Base de conocimiento:** información cargada por ente y usada por la IA para responder.
- **Canal:** red por la que el ciudadano se comunica (WhatsApp, Instagram, Messenger, TikTok, web, voz).
- **Perfil:** configuración de la IA para un uso específico, expuesta mediante una API (v2).
- **Paquete:** producto único que contrata el municipio, con todo incluido. Su precio depende del tramo de población.
- **Tramo:** rango de población del municipio que fija el precio (hasta 20.000, 20.000–100.000, 100.000–500.000, más de 500.000).

## 4. Roles y permisos

### Original
- **Administrador:** accede a la base de la organización y da acceso a los demás.
- **Colaborador:** usuario creado por el admin; gestiona el municipio con los permisos que el admin le dio.

### Permisos
| Acción | Admin | Colaborador |
|---|---|---|
| Conectar redes (Meta, TikTok) | Sí | No |
| Crear y editar el organigrama | Sí | Según permiso |
| Cargar y editar datos de un ente | Sí | Solo los entes asignados |
| Crear colaboradores y asignar permisos | Sí | No |
| Gestionar suscripción y facturación | Sí | No |
| Crear perfiles y claves de API | Sí | Según permiso |
| Ver métricas | Sí | Según permiso |

### [Propuesta]
- Los permisos del colaborador se asignan **por ente**. Cada colaborador solo ve y edita las áreas que le asignaron.
- Rol **auditor / solo lectura** para control interno. **[Decidido]** llega en la v2.
- **[Decidido]** Los colaboradores no atienden conversaciones: gestionan el organigrama y alimentan la IA, que atiende al ciudadano.

## 5. Modelo comercial: paquete único

### [Decidido] Se vende el paquete completo
Ya no hay membresías ni planes. Todo municipio recibe lo mismo: chat con IA en todos los canales, APIs con perfiles y voz (según el alcance de cada versión). Lo único que cambia es el **precio, que depende de la población del municipio**.

| Tramo | Población |
|---|---|
| 1 | Hasta 20.000 habitantes |
| 2 | De 20.000 a 100.000 |
| 3 | De 100.000 a 500.000 |
| 4 | Más de 500.000 |

- Se paga **mensual o anual**, con descuento por pago anual (ver 13.1).
- Moneda: dólares. Los montos finales de cada tramo siguen pendientes (ver 13.1).
- No hay funciones bloqueadas por plan. La protección es el tope alto de mensajes por tramo y el request limit anti-abuso (ver 13.1 y 13.2).

> **Superado:** la idea original de 3 membresías (básica, intermedia, VIP) y su tabla de cuotas por plan quedaron reemplazadas por el paquete único.

### [Propuesta] Cobro
Muchos municipios pagan por factura, transferencia u orden de compra, no con tarjeta. Se contemplan dos modos:
- **Pago online** (Stripe o Mercado Pago, mediante el servicio de pagos).
- **Facturación manual:** un administrador de la plataforma activa o renueva la suscripción.

**[Decidido]** La facturación es **mensual o anual**, con descuento por pago anual (ver sección 13.1).

## 6. Entidades del dominio

| Entidad | Descripción |
|---|---|
| **Municipio** | Tenant. Tiene población, tramo de precio, estado y configuración (marca, mercado, idioma). |
| **Suscripción** | Paquete activo del municipio: tramo, período (mensual o anual), vigencia y tope de mensajes. |
| **Canal conectado** | Credenciales y estado de cada red (Meta, TikTok). |
| **Ente** | Nodo del organigrama, con un ente padre opcional. |
| **Dato de conocimiento** | Información de un ente. [Propuesta] Tiene estado (borrador, publicado), autor y versión. |
| **Colaborador** | Usuario del municipio, con permisos por ente. |
| **Invitación** | Alta de un colaborador por el admin. |
| **Perfil de API** | Configuración de la IA para un uso: instrucciones, subconjunto de la base, claves y límites. |
| **Conversación** | Intercambio con un ciudadano, con su canal, estado y mensajes. |

## 7. Flujos principales

### 7.1 Alta del municipio (original)
1. El municipio informa su población, se le asigna el tramo de precio y paga el paquete.
2. Accede al sistema.
3. Configura por defecto las credenciales de Meta y TikTok para conectar sus redes.

### 7.2 Organigrama y carga de datos (original)
1. El admin entra al dashboard y crea el organigrama.
2. Se carga la información de cada ente municipal.
3. Esa base queda disponible para informar al ciudadano en tiempo real.

### 7.3 Gestión de equipo (original)
1. El admin crea colaboradores.
2. Asigna los permisos con los que cada uno gestiona el municipio.

### 7.4 Atención al ciudadano (original, detalle propuesto)
1. El ciudadano escribe por un canal conectado.
2. La IA responde usando la base de conocimiento del municipio.
3. **[Decidido]** Si no tiene la información, lo dice e indica el canal oficial del ente correspondiente. No hay derivación a personas.

### 7.5 Uso de la API (v2)
1. El admin crea un perfil para un uso específico.
2. Obtiene una clave de API para ese perfil.
3. El sistema municipal consume la IA con esa clave.

### 7.6 Llamada de voz (v3)
1. El ciudadano llama al número del municipio.
2. La IA responde por voz con la misma base de conocimiento.

## 8. Reglas de negocio

### Originales
- Un municipio solo accede al sistema con una suscripción activa.
- Todos los municipios tienen las mismas funciones; el precio depende del tramo de población.
- La IA informa según los datos cargados por el municipio.
- Solo el admin da acceso a otros usuarios.

### [Propuestas]
- **La IA no inventa:** solo responde con datos de la base y, cuando es posible, indica de qué ente salió el dato.
- **Si no sabe, lo dice** e indica un canal oficial (no deriva a personas).
- **Tiempo real = lo publicado.** Los cambios pasan por borrador y publicación. Lo publicado se refleja de inmediato.
- **Vigencia:** **[Decidido]** los datos no vencen por fecha; se controlan con el historial de versiones y los mandatos.
- **Transparencia:** la IA se identifica como asistente automático.
- **Privacidad:** se define qué datos del ciudadano se guardan y por cuánto tiempo, conforme a la ley local de protección de datos.
- **Aislamiento:** un municipio nunca ve datos de otro.

## 9. Integraciones

| Integración | Uso | Versión |
|---|---|---|
| Meta (WhatsApp, Instagram, Messenger) | Canales de atención | v1 |
| TikTok | Canal de atención | v1 |
| Widget web **[Decidido]** | Chat en el sitio del municipio, vía API | v2 |
| Pasarela de pagos | Cobro del paquete | v1 |
| API de Welver | Uso de la IA desde sistemas municipales | v2 |
| Telefonía y voz | Llamadas atendidas por IA | v3 |

**[Propuesta]** La verificación de negocio y la revisión de app de Meta pueden tardar semanas. Se sugiere un asistente guiado de conexión, o que la plataforma conecte los canales en nombre del municipio.

## 10. Mapeo a la plataforma

| Necesidad de Welver | Ya existe | Falta |
|---|---|---|
| Canales Meta y TikTok | chatia (WhatsApp, Instagram, Messenger, TikTok) | Asistente guiado de conexión |
| Base de conocimiento | `KnowledgeBase`, `KbDocument` en chatia | Ligarla a entes, con publicación y vigencia |
| Asistente IA | `AssistantConfig` y proveedores LLM | Guardrails y citas de fuente |
| Roles y colaboradores | `Collaborator` e `Invitation` en el SaaS | Permisos por ente |
| Paquete único y precio por tramo | `QuotaConfig` y `FeatureFlag` | Tramos de población, tope de mensajes por tramo y request limit |
| Cobro | pasarelapagos | Facturación manual |
| API para sistemas municipales | — | Perfiles y claves con alcance |
| Organigrama | — | Modelo de entes |
| Voz | — | Servicio nuevo |
| Métricas | analytics | Tablero de temas y huecos de información |
| Gestión global de municipios | superadmin | Vista de tramos, suscripciones y consumo |

El tenant `welver` ya existe como módulo en los microservicios (chatia, notificaciones, analytics, pasarelapagos y marketing).

## 11. Alcance por versión

- **v1:** paquete único (facturación mensual y anual), conexión de redes (una cuenta por ente), organigrama, carga de datos, roles, asistente IA por chat en todos los canales. Sin derivación a personas.
- **v2:** perfiles y APIs (por municipio y por dependencia), tablero de métricas con exportación, rol auditor e importación desde el sitio del municipio.
- **v3:** voz con IA, solo llamadas entrantes, a través de Meta.

**[Decidido]** No hay reclamos: Welver es puramente informativo, 24/7, con los datos de la municipalidad.

*(El reparto es una propuesta. Hay que confirmarlo.)*

## 12. Decisiones tomadas

| # | Tema | Decisión |
|---|---|---|
| 1 | Ecosistema | Welver es un ecosistema aparte: asistente al ciudadano con IA. |
| 2 | Reclamos | No hay reclamos. La app es puramente informativa, 24/7, con los datos de la municipalidad. |
| 3 | Voz | Solo llamadas entrantes; responde en base a lo que dice el ciudadano. |
| 4 | Organizaciones | Una organización es un municipio; desde ahí se crea el organigrama. No hay varios municipios por cuenta. |
| 5 | Idiomas | El idioma del país del municipio por defecto, y responde en el idioma en que le hablen. |
| 6 | Paquete único | No hay planes: se vende un paquete con todo incluido y descuento si se paga anual. |
| 7 | Atención sin personas | La IA atiende al ciudadano. Los colaboradores solo gestionan el organigrama y alimentan la IA. |
| 8 | Cobro | Por transferencia bancaria, con Stripe en una LLC de EE.UU. como camino a un solo banco receptor. |
| 9 | Vencimiento | Período de gracia, luego suspensión del servicio; los datos se conservan. |
| 10 | Precio | Escalonado según la población del municipio (4 tramos). Ya no hay membresías: se vende el paquete completo. |

## 13. Especificación por versión

Esta sección se arma con tus respuestas: cada pregunta respondida pasa acá y sale de la sección 14. **[Decidido]** sale de tus respuestas. **[Pendiente]** tiene una pregunta abierta en la sección 14.

### 13.1 Reglas generales (todas las versiones)

- **[Decidido]** Welver solo **informa**: no recibe reclamos ni gestiona trámites ni deriva a personas.
- **[Decidido]** Un municipio = una organización; el organigrama se crea dentro de ella.
- **[Decidido]** La IA atiende primero en el idioma del país del municipio, pero responde en el idioma en que le escriben o hablan.
- **[Decidido]** **Paquete único con todo incluido** (chat en todos los canales, APIs con perfiles y voz). Reemplaza el esquema de tres membresías. Se paga mensual o anual, con un **descuento por pago anual** uniforme de alrededor del 15–20%. El precio es **escalonado según la población** del municipio, en **4 tramos**: hasta 20.000 habitantes, de 20.000 a 100.000, de 100.000 a 500.000 y más de 500.000. La **voz va incluida**, con política de uso razonable, y hay un **tope alto contractual de mensajes por mes**. **Moneda: dólares** (cobra la LLC de EE.UU. por transferencia), con montos que salen del costo por conversación medido en el piloto más un margen fijo; el piloto va con precio reducido. **Tope de mensajes:** uno por tramo, de 3 veces el uso medio del piloto, con aviso al admin al 80% y sin corte; se renegocia en el contrato. **[Pendiente]** los montos finales y quién paga: puede ser un fondo de desarrollo que financia al municipio y que podría proponer una **licencia**.
- **[Decidido]** **Cobro por transferencia bancaria.** Se usa Stripe en una LLC de EE.UU., con facturas que incluyen los datos de transferencia (ACH, wire, SEPA) y conciliación automática. En v1 el admin marca la factura como pagada a mano. Así todos transfieren a un solo banco.
- **[Decidido]** **Vencimiento:** período de gracia de 7 a 14 días con aviso; luego suspensión: la IA deja de responder, los canales se pausan y el panel queda en solo lectura. Los datos se conservan indefinidamente. La verificación del pago es manual en v1 y por webhook cuando haya pasarela.

- **[Decidido]** **Datos de ciudadanos:** cada municipio tiene una **región de datos** (`Organization.dataRegion`, ADR-031), distinta de su país (`countryCode`, que define la ley aplicable). Hoy hay dos regiones lógicas, `ar` y `us`, pero no hay infraestructura propia en Argentina: un municipio argentino queda en `ar` con sus datos alojados en EE.UU., y eso se cubre con **contrato de tratamiento de datos con transferencia internacional** firmado antes de activar. **[Pendiente]** validación legal por un abogado local (Ley 25.326). Si un municipio exige datos físicamente en el país, se habilita una región nueva (ADR propio); no se promete antes.
- **[Decidido]** **Calidad de la IA:** un conjunto de preguntas de prueba por municipio, evaluado de forma continua, con meta de **al menos 95%** de respuestas correctas y con fuente. Las preguntas de prueba las arma **el equipo junto con el municipio en el onboarding** y se amplían con los huecos de información registrados.
- **[Decidido]** **Primer municipio:** piloto de **3 a 6 meses** con precio reducido y métricas acordadas desde el inicio. Será un **municipio pequeño con poca digitalización**, en **Argentina** (Ley 25.326 como base legal y Mercado Pago como respaldo de cobro).
- **[Decidido]** Si paga un fondo de desarrollo, **no se arma ninguna forma de contratación hasta recibir su propuesta** (posiblemente una licencia). Se espera **60 días**; si no hay propuesta, se ofrece al municipio piloto un **convenio de prueba de 3 a 6 meses** por la vía de compra de monto menor que permita su norma local.


### 13.2 v1 — Paquete, redes, organigrama, datos, roles y chat IA

**Redes y canales**
- **[Decidido]** El municipio carga sus credenciales de Meta y TikTok.
- **[Decidido]** Hay **una cuenta por ente** (cada área con su propio WhatsApp o Instagram), mapeada al organigrama.
- **[Decidido]** La IA atiende en **todos los canales desde el primer día**.
- **[Decidido]** El **admin del municipio conecta todas** las cuentas. El **widget web queda para la v2**: cada sitio usa la API con su propio diseño.

**Organigrama y datos**
- **[Decidido]** El organigrama es un **árbol con un solo padre por ente**, sin límite de profundidad (se sugiere hasta 5 niveles), más **vínculos transversales** para programas compartidos entre áreas.
- **[Decidido]** Los datos de cada ente se cargan como **texto libre y archivos PDF**; la IA los interpreta por recuperación (RAG). No hay plantillas por tipo de dato.
- **[Decidido]** Importación: **carga manual + planilla CSV y PDFs** en v1; importar desde el sitio del municipio llega en v2.
- **[Decidido]** Publicación: **borrador → revisión → publicado**, con aprobación activable por ente. Además hay **historial de versiones** para restaurar o crear versiones nuevas (por ejemplo, un nuevo mandato).
- **[Decidido]** **Cambio de gestión:** foto (snapshot) del organigrama y los datos por mandato; el anterior queda archivado y se puede restaurar o duplicar. Los datos **no vencen por fecha**: se controlan con el historial de versiones.

**Atención sin personas**
- **[Decidido]** **No hay derivación a humano.** El colaborador solo gestiona el organigrama y alimenta la IA, que se encarga de toda la atención al ciudadano.
- **[Decidido]** Cuando la IA no sabe, **lo dice, indica el canal oficial del ente** (teléfono, web, dirección) y **registra la pregunta como hueco de información**. El admin ve una **lista semanal** con las preguntas sin respuesta más repetidas.

**Límites y privacidad**
- **[Decidido]** No hay límites de uso por plan. Hay un **request limit por ciudadano**, como protección anti-abuso.
- **[Decidido]** Privacidad: **retención configurable** (90 días por defecto), aviso al iniciar el chat con enlace a la política y opción de eliminar datos.

**Roles**
- **[Decidido]** El rol auditor o de solo lectura **no entra en v1**; llega en v2 junto con el tablero de métricas.

**Onboarding, IA y criterio 10/10**
- **[Decidido]** **Carga de la base inicial en el piloto:** **autoservicio puro desde el primer día**, sin sesiones asistidas del equipo.
- **[Decidido]** **Alta de redes en Meta:** el municipio hace todo el trámite con un **sistema de documentación que guía al personal** para conectarse.
- **[Decidido]** **Onboarding:** autoservicio con guías paso a paso, **plantilla de organigrama por tipo de municipio** y un asistente que avisa qué falta cargar.
- **[Decidido]** **Temas sensibles:** la IA no opina de política ni da asesoría legal o médica, y siempre se identifica como asistente automático.
- **[Decidido]** **Citas de fuente:** siempre el ente y el documento de donde salió el dato, con enlace cuando exista.
- **[Decidido]** **Seguridad base:** separación estricta entre municipios, cifrado, registro de acciones y verificación en dos pasos para el admin.
- **[Decidido]** **Pruebas de seguridad de la IA:** un set de preguntas trampa (política, consejo legal o médico, datos de otro municipio, intentos de hacerla decir algo no cargado) que debe pasar al **100%** antes de publicar.
- **[Decidido]** **Criterio 10/10 de la v1:** tasa de resolución de al menos **80%** de las consultas respondidas sin que el ciudadano insista, medida desde el primer mes. Una consulta cuenta como **resuelta** cuando el ciudadano no repite la pregunta ni insiste en las 24 h siguientes, o marca "me sirvió"; las respuestas "no sé" no cuentan como resueltas.


### 13.3 v2 — Perfiles y APIs, tablero de métricas

- **[Decidido]** **Perfiles de API flexibles:** primero el municipio con su API y su información; después se crean según cómo se organice (por ejemplo secretarías y dependencias), de forma flexible para adaptarse a cada país.
- **[Decidido]** **Claves de API:** rotación por el admin, alcance por perfil, límite por minuto, registro de uso y clave visible una sola vez al crearla.
- **[Decidido]** La API es **solo de consulta**: preguntar y recibir respuesta, coherente con que la app es informativa.
- **[Decidido]** **Sin límite de peticiones de API:** la idea es atender al ciudadano sin límite, y por eso el precio es alto.
- **[Decidido]** **Tablero de métricas:** temas más consultados, preguntas sin respuesta, volumen por canal y satisfacción (no hay derivaciones a humano).
- **[Decidido]** **Huecos de información:** informe de preguntas sin respuesta; el admin decide qué cargar. No es automático.
- **[Decidido]** El tablero se **exporta** como PDF y CSV, y se puede compartir con un enlace de solo lectura con vencimiento.
- **[Decidido]** Llega el rol **auditor / solo lectura** y la importación desde el sitio del municipio.
- **[Decidido]** Cada perfil define **instrucciones y tono, entes visibles, idioma, límites de uso y canales permitidos**. Los perfiles se organizan en **jerarquía**: el del municipio es la base y cada secretaría crea uno propio que hereda y restringe entes visibles.
- **[Decidido]** La API tiene un **límite alto por clave solo por seguridad** (no comercial), con alerta al admin si se supera.
- **[Decidido]** El **widget web** llega en esta versión: cada sitio usa la API con su propio diseño.

**API, métricas y criterio 10/10**
- **[Decidido]** **Disponibilidad:** 99,9% con página de estado pública. Si no se cumple, **no se informa ni se compensa**: es un asunto interno de la empresa, sin créditos de servicio. **[Pendiente]** si la página de estado pública se mantiene con esta regla (Ronda 7, v2 1).
- **[Decidido]** **Datos desactualizados:** sin recordatorios ni control de vigencia; la IA usa siempre la **última versión publicada** de cada dato.
- **[Decidido]** **Documentación:** pública, con ejemplos y un entorno de prueba. El entorno es un **municipio de ejemplo precargado** con organigrama y datos ficticios.
- **[Decidido]** **Impacto en el tablero:** consultas atendidas fuera de horario y estimación de ahorro de atención, calculada como consultas atendidas por la IA multiplicadas por un **costo promedio de atención que configura el municipio**.
- **[Decidido]** **Casos de éxito:** se publican métricas agregadas (consultas, resolución y ahorro estimado) con autorización firmada del municipio desde el contrato del piloto.
- **[Decidido]** **Criterio 10/10 de la v2:** al menos **2 sistemas** del municipio consumiendo la API con más del **99%** de respuestas exitosas.


### 13.4 v3 — Voz con IA

- **[Decidido]** Solo **llamadas entrantes**: la IA responde en base a lo que dice el ciudadano.
- **[Decidido]** La voz se conecta **a través de Meta** y de sus productos. Empieza con **llamadas por WhatsApp**; la **telefonía tradicional** se suma más adelante.
- **[Decidido]** **Grabación y transcripción:** no se fija una regla única; las dos opciones (solo transcripción con aviso, o grabar siempre con aviso) quedan **a elección de cada municipio**.
- **[Decidido]** **Sin transferencia a personas:** si la IA no puede resolver por voz, aparece como **no disponible y pasa a chat**.
- **[Decidido]** Cuando la voz pasa a chat **no se envía un resumen**, porque cada mensaje saliente tiene costo en Meta; solo se avisa que el chat sigue disponible.
- **[Decidido]** Las **transcripciones** las ven el admin y los colaboradores del ente correspondiente.
- **[Decidido]** **Idiomas:** multilingüe con detección automática y una voz por defecto, con pocas voces para elegir.
- **[Decidido]** **Latencia:** objetivo de menos de 1 segundo hasta la primera palabra, y el ciudadano puede interrumpir.
- **[Decidido]** La voz usa la **misma base y perfiles que el chat**, con instrucciones propias de voz (respuestas más cortas, sin enlaces).

**Costo y criterio 10/10**
- **[Decidido]** **Tope por llamada:** **5 minutos** (antes 10), con aviso antes de cortar. **Sin límite de minutos mensuales**: solo rige el tope por llamada. Al llegar al tope, la IA avisa que el ciudadano puede seguir en el chat del municipio, sin enviarle ningún mensaje.
- **[Decidido]** **Aviso de IA en la llamada:** saludo inicial **totalmente configurable por cada municipio**, que asume la responsabilidad. **[Pendiente]** conciliarlo con la regla de que la IA siempre se identifica como asistente automático (Ronda 7, v3 1).
- **[Decidido]** **Calidad con acentos:** panel de pruebas con llamadas reales de distintos acentos del país y una meta de comprensión, antes de lanzar.
- **[Decidido]** **Voz por WhatsApp (Meta):** se construye directo y se mide después, **sin prueba técnica previa** de latencia ni de costo por minuto.
- **[Decidido]** **Criterio 10/10 de la v3:** al menos **70%** de las llamadas resueltas por voz sin pasar a chat, con latencia menor a 1 segundo.


## 14. Preguntas abiertas por versión

Ronda 7: las respuestas de la ronda 6 pasaron a la sección 13. Quedan solo las preguntas que frenan el puntaje de cada versión (ver la tabla del principio).

**Cómo responder:** marcá con `[x]` la opción elegida (cada una cita cómo lo resolvió una empresa de referencia). La última opción es para escribir tu propia respuesta. Las respuestas ya escritas en `respuesta:` se mantienen.

### v1 — Paquete, redes, organigrama, datos, roles y chat IA

1. Piloto en autoservicio puro con un municipio poco digitalizado: ¿qué cobertura mínima de la base se exige antes de abrir al público?
respuesta:
   - [ ] A) **(Recomendada)** Que al menos el 70% de las preguntas de prueba tengan una respuesta cargada en la base; si no se llega, el asistente no se publica en los canales. — *Ref: Intercom Fin (no se activa sin contenido suficiente).*
   - [ ] B) Se abre igual y se completa con los huecos de información que se vayan registrando. — *Ref: Chatbase (se publica con la base que haya).*
   - [ ] C) Propia: 

### v2 — Perfiles y APIs y tablero de métricas

1. Disponibilidad de 99,9% "solo interna" pero con página de estado pública decidida antes: ¿cuál prevalece?
respuesta:
   - [ ] A) **(Recomendada)** Se mantiene la página de estado pública solo con el estado actual y el historial, sin promesas de compensación. — *Ref: Stripe (página de estado pública).*
   - [ ] B) No hay página pública: el estado es interno de la empresa. — *Ref: Chatbase (sin página de estado).*
   - [ ] C) Propia: 

### v3 — Voz con IA

1. El saludo es totalmente configurable, pero la regla general dice que la IA siempre se identifica como asistente automático: ¿cuál prevalece?
respuesta:
   - [ ] A) **(Recomendada)** Se mantiene todo configurable, pero el sistema agrega solo la frase de identificación al inicio, fuera del texto que edita el municipio. — *Ref: Google Duplex (se identifica como asistente automático).*
   - [ ] B) Nada se agrega: el municipio decide y asume la responsabilidad. — *Ref: Twilio (mensajes iniciales totalmente configurables).*
   - [ ] C) Propia: 
2. Voz sin límite de minutos y sin prueba técnica previa: ¿qué alerta de costo interna se pone?
respuesta:
   - [ ] A) **(Recomendada)** Alerta interna cuando un municipio supera 3 veces el promedio de minutos de su tramo, sin cortar el servicio. — *Ref: Stripe (revisión de cuentas con uso atípico).*
   - [ ] B) Sin alerta: se revisa el costo de voz en la factura mensual del proveedor. — *Ref: Twilio (facturación por uso).*
   - [ ] C) Propia: 


## 15. Plataforma: base y construcción

Esta sección baja Welver a la plataforma del ecosistema (`CLAUDE.md`, `services/`, `modules/`, `contracts/`). Dice qué se hereda tal cual, qué entidades y funciones hay que construir y en qué orden. Lo **[Propuesta]** hay que confirmarlo antes de implementar. Sirve de molde para Manzana y Mexus.

**Particularidad de Welver:** no es comercio. No usa `realsass-ecommerce-back` ni el storefront. El "público" son los canales de chat, la API y la voz. Casi todo lo propio es **conocimiento + organigrama + canales**.

### 15.1 Qué se hereda sin tocar

| Capacidad | Dónde vive hoy | Uso en Welver |
|---|---|---|
| Identidad, sesión, dispositivos | `realsass-sass-back` (`User`, `UserSession`, cookies HttpOnly, ADR-004/020) | Login del admin y los colaboradores |
| Organización = tenant | `Organization` (`ecosystemId`, `slug`, `status`, `enabledProducts`, `countryCode`, `dataRegion`) | Un municipio = una organización, con `ecosystemId = "welver"` |
| Colaboradores e invitaciones | `Collaborator` (permisos JSONB, ADR-001), `Invitation` | Equipo del municipio |
| Flags, cuotas, secretos, auditoría, webhooks | `FeatureFlag`, `QuotaConfig`, `SecretConfig`, `ConfigAuditLog`, `WebhookEndpoint` | Activar API/voz/widget, tope de mensajes, credenciales de Meta y TikTok, registro de acciones |
| Idioma y país | `Market`, `@real/i18n`, ADR-016/017/028 | Idioma por país del municipio |
| Reportes de usuario | `FeedbackReport` (ADR-027) | Problemas informados desde el panel |
| WhatsApp por organización | ADR-025, `whatsapp.*` en sass-back → chatia | Base del alta de canales (hoy es una sola cuenta por organización) |
| IA, base de conocimiento, canales | chatia en ecosistema-ms (`KnowledgeBase`, `KbDocument`, `AssistantConfig`) | Motor del asistente |
| Avisos, métricas, cobro, gestión global | notificaciones, analytics, pasarelapagos, superadmin (ecosistema-ms) | Avisos al admin, tablero, cobro del paquete, vista de municipios |
| UI | `@real/ui` (`AppShell`, `PageHeader`, `StatCard`, `Table stack`, los 4 estados) | Todo el panel, sin UI propia |

### 15.2 Entidades que hay que construir

| Entidad | Origen | Notas |
|---|---|---|
| **Municipio** | Extiende `Organization` | Agregar población (el tramo se deriva), plantilla de organigrama elegida y retención de datos. |
| **Suscripción** | Nueva | Tramo, período, vigencia, estado (activa, gracia, suspendida) y tope de mensajes. `Organization.plan` queda como espejo. |
| **Ente** | Nueva | Árbol con padre único; hasta 5 niveles sugeridos. |
| **Vínculo transversal** | Nueva | Relación entre entes para programas compartidos. |
| **Dato de conocimiento** | Nueva (liga con `KbDocument` de chatia) | Texto o PDF por ente; borrador, revisión, publicado; autor y versión. |
| **Mandato (foto)** | Nueva | Snapshot de organigrama y datos; archivar, restaurar, duplicar. |
| **Canal por ente** | Extiende `SecretConfig` / ADR-025 | Una cuenta de Meta o TikTok por ente. |
| **Permiso por ente** | Extiende los permisos JSONB de `Collaborator` | Lista de entes asignados por colaborador. |
| **Perfil de API** (v2) | Nueva | Instrucciones, entes visibles, idioma, canales; jerarquía municipio → secretaría. |
| **Clave de API** (v2) | Nueva | Visible una sola vez; rotación, alcance, límite por minuto, registro de uso. Hoy `/settings/api-keys` es un placeholder. |
| **Pregunta de prueba** | Nueva | Set de calidad (meta 95%) y de seguridad (100%) por municipio. |
| **Hueco de información** | Nueva | Pregunta sin respuesta, con conteo y lista semanal. |
| **Conversación** | chatia | Se consulta, no se duplica. |

### 15.3 Funciones por capa

**Back [Decidido 2026-11-06]:** NO hay `welver-back` aparte. Welver vive en `realsass-sass-back` (módulo `src/welver/`, sin hop de red para el tenant) y se publica en el mismo `SassAppRouter` de `@real/trpc`; `ecommerce-back` y el storefront se eliminaron. (Antes estaba propuesto un back propio.)
- `organigrama.*`: crear, mover, vincular y archivar entes.
- `conocimiento.*`: cargar texto o PDF, importar CSV, borrador → revisión → publicado, versiones, mandato.
- `canales.*`: conectar, estado y pausa por ente.
- `calidad.*`: preguntas de prueba, corrida y resultado (95% / 100%).
- `huecos.*`: lista semanal.
- `perfiles.*` y `claves.*` (v2); `suscripcion.*` (estado, tramo, factura).
- Pública por REST (única excepción permitida): API de consulta de Welver (v2) y webhooks inbound de Meta.

**Front:**
- `realsass-sass-front` (admin): alta del municipio, pago, conexión de redes, claves de API, facturación.
- `realsass-dashboard-front` (colaboradores): organigrama, carga de datos, huecos, métricas, conversaciones, equipo y permisos por ente.
- `realsass-docs-front`: documentación pública de la API y guías de conexión a Meta (v1/v2).
- Sin `real-ecommerce-front` ni app de escritorio.

**Reglas que aplican:** tRPC para todo lo interno (REST solo para la API pública y los webhooks), `organizationId` en cada modelo con RLS, vistas con cargando / vacío / error / sin permisos, y contratos tipados desde `@real/trpc/dist` (ADR-019).

### 15.4 Configuración por tenant

| Mecanismo | Valores para Welver |
|---|---|
| `ecosystemId` | `welver` |
| `FeatureFlag` | `welver.api` (v2), `welver.widget` (v2), `welver.voice` (v3), `welver.auditor` (v2), `welver.approval` (aprobación por ente) |
| `QuotaConfig` | Tope mensual de mensajes por tramo (3× el uso medio del piloto, aviso al 80%) y request limit por ciudadano |
| Permisos de colaborador | Por ente: ver, editar, aprobar y publicar |
| Retención | 90 días por defecto, configurable por municipio. Primer consumidor de la tabla de políticas por país (ADR-031) |
| Región de datos | `Organization.dataRegion` (`ar` para Argentina, `us` para EE.UU.; hoy ambas en infraestructura de EE.UU.), asignada al crear el municipio desde su país; no editable |

### 15.5 Orden de construcción

1. **Base (v1):** `ecosystemId` y población en `Organization`, suscripción con facturación manual, organigrama, conocimiento con versiones y mandatos, permisos por ente.
2. **Canales (v1):** conexión de Meta y TikTok por ente sobre chatia, y asistente con citas de fuente.
3. **Calidad (v1):** preguntas de prueba, corrida de calidad y huecos de información.
4. **v2:** perfiles y claves de API, tablero de métricas con exportación, widget, rol auditor, importación desde el sitio.
5. **v3:** voz por WhatsApp (Meta).

### 15.6 Decisiones que faltan para empezar

- Validación legal de los datos en EE.UU. para municipios argentinos y redacción del contrato de transferencia internacional (ADR-031).
- Tabla de políticas por país (retención, consentimiento, borrado, exportación): Welver es su primer consumidor.

- ~~Confirmar el back propio contra un módulo dentro de `sass-back`.~~ **Resuelto 2026-11-06:** módulo dentro de `sass-back` (ver 15.3).
- Dónde guardar los datos de conocimiento: la fuente es el back nuevo y chatia recibe una copia indexada (a definir).
- Cómo se reparten los entes y las cuentas de Meta cuando el WhatsApp de ADR-025 es único por organización.

### 15.7 Estado de la implementación (2026-11-06)

**Hecho en `realsass-sass-back`** (detalle y tabla de routers en `services/realsass-sass-back.md`): municipio y tramos, suscripción con
ciclo de vida y facturación manual, organigrama con plantillas y vínculos, permisos por ente, conocimiento con versiones y CSV,
mandatos, registro de canales, calidad/seguridad/cobertura, huecos de información, y perfiles y claves de API (v2).
Todo con aislamiento por `organizationId` verificado contra Postgres real.

**Pendiente (integraciones):** Meta/TikTok, índice de chatia, subida y lectura de PDFs, ejecución de las corridas de calidad por la IA,
endpoint público de la API, cobro online, cron de vencimientos, cuotas de mensajes, voz (v3) y los fronts.

**Preguntas de la sección 14 que siguen abiertas** y que el código deja parametrizadas: cobertura mínima del piloto (70% implementado
como en la opción A recomendada), página de estado y saludo de voz.
