# Welver — Dominio

> Estado: borrador v0.8. Lo marcado con **[Decidido]** sale de las respuestas dadas a las preguntas abiertas. Lo marcado con **[Propuesta]** es una mejora sugerida sobre la idea original y está pendiente de confirmar. Todo lo demás sale de la idea original.

## Pilares y camino al 10/10

> **Empresa 10/10 de referencia:** **Intercom (Fin)** como producto de atención con IA, y **Granicus** como modelo de venta a gobiernos. **Boti** (Ciudad de Buenos Aires) es la prueba de que el modelo funciona.
> **Nivel actual de la especificación: 6,5/10.** Equivale a un concepto sólido de producto de IA para gobiernos, con calidad, privacidad, moneda, tope de costos y camino de contratación del piloto definidos. Lo que lo frena: faltan los montos, el piloto va en autoservicio puro con un municipio poco digitalizado, la voz se construye sin prueba técnica previa y el saludo libre choca con la regla de identificarse como IA.
> **Escala de referencia:** Intercom 9 · Boti 7 (para una ciudad) · Welver 6,5.

### Pilares

| # | Pilar | Hoy | Para llegar al 10 |
|---|---|---|---|
| 1 | **Calidad y confiabilidad de la IA** (no inventa, cita la fuente) | Reglas, meta de 95%, "resuelta" definida (sin insistencia en 24 h) y preguntas trampa al 100% antes de publicar | Evaluación continua de respuestas, citas del ente y control de errores en trámites públicos |
| 2 | **Base de conocimiento y organigrama** | Definido (árbol, texto y PDFs, versiones); piloto en municipio chico, sin sitio web para importar y con carga en autoservicio; sin control de datos viejos (se usa la última versión) | Importación del sitio del municipio y control de datos desactualizados |
| 3 | **Canales y voz** (Meta, WhatsApp) | Definido; voz por Meta que se construye sin prueba técnica previa de latencia ni de costo; sin límite de minutos | Todos los canales y la voz funcionando con latencia menor a 1 segundo |
| 4 | **Modelo comercial** (paquete único, descuento anual) | 4 tramos en dólares y tope por tramo (3 veces el uso medio del piloto); faltan los montos | Precio cerrado, moneda de cobro y protección contra costos de uso ilimitado |
| 5 | **Venta a gobierno y cumplimiento** | Parcial: región de nube, contrato de datos, retención configurable y convenio de prueba a los 60 días si el fondo no responde; sin camino de licitaciones | Camino de licitaciones y contratos, datos alojados en el país y política de privacidad |
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
- Camino de venta a municipios (licitaciones, contratos, datos en el país). *(Datos en el país y convenio de prueba a los 60 días decididos; faltan las licitaciones.)*
- ~~Método para medir la calidad de las respuestas de la IA.~~ *(Decidido, con definición de "resuelta" y pruebas de seguridad.)*
- ~~Confirmación de la voz por Meta.~~ *(Decidida; se construye sin prueba técnica previa.)*
- ~~Métricas de éxito por versión.~~ *(Definidas.)*

**Solo con producto funcionando (llevan a 9–10):**
- Un municipio piloto con datos reales de consultas resueltas.
- Evidencia de que la IA no responde cosas incorrectas.
- Casos de éxito que sirvan para vender a los siguientes.

## 1. Resumen

Welver es una aplicación que provee a los municipios de **atención al ciudadano 24/7 con IA**.

El municipio contrata una membresía, conecta sus redes sociales, arma su organigrama y carga la información de cada ente municipal. Esa base alimenta a un asistente de IA que informa al ciudadano en tiempo real por los canales del municipio.

### Idea original (se conserva tal cual como base)

- El municipio accede al sistema mediante el pago de 3 membresías: básica, intermedia y VIP.
- Al ingresar, por defecto, el municipio puede configurar las credenciales de Meta y TikTok para conectar sus redes al sistema.
- También puede ir al dashboard, donde puede crear un organigrama y cargar datos de cada ente municipal.
- Esa base sirve para informar al ciudadano en tiempo real.
- Hay dos roles: administrador (tiene acceso a la base de la organización y da acceso a los otros) y colaboradores (usuarios creados por el admin, que gestionan el municipio según los permisos que les dio).
- Las membresías se dividen en:
  - **Básica:** acceso al sistema y asistente IA con chat para todas las redes.
  - **Intermedia:** básica + crear APIs para usar la IA en sistemas municipales, con perfiles para cada uso específico.
  - **VIP:** intermedia + respuesta por llamada de voz con IA.

## 2. Usuarios del sistema

| Actor | Quién es | Qué busca |
|---|---|---|
| **Municipio** | La organización cliente (tenant). | Atender a los ciudadanos las 24 h sin aumentar personal. |
| **Administrador** | Responsable del municipio en la plataforma. | Configurar el sistema y dar acceso al equipo. |
| **Colaborador** | Empleado del municipio. | Mantener actualizada la información de su área. |
| **Ciudadano** | Quien consulta por redes, web o teléfono. | Respuestas rápidas y correctas. No tiene cuenta en el sistema. |
| **Sistema municipal** | Software del municipio que consume la API. | Usar la IA desde sus propias aplicaciones (plan intermedio y VIP). |
| **Superadmin de la plataforma** | Equipo dueño de Welver. | Gestionar municipios, planes y estadísticas globales. |

## 3. Glosario

- **Municipio:** cliente de la plataforma. Es el tenant.
- **Ente municipal:** área u organismo del municipio (Tránsito, Rentas, Obras, Salud…). Forma parte del organigrama.
- **Organigrama:** árbol jerárquico de entes del municipio.
- **Base de conocimiento:** información cargada por ente y usada por la IA para responder.
- **Canal:** red por la que el ciudadano se comunica (WhatsApp, Instagram, Messenger, TikTok, web, voz).
- **Perfil:** configuración de la IA para un uso específico, expuesta mediante una API (plan intermedio y VIP).
- **Membresía:** plan contratado (básica, intermedia, VIP).

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
| Gestionar membresía y facturación | Sí | No |
| Crear perfiles y claves de API | Sí | Según permiso |
| Ver métricas | Sí | Según permiso |

### [Propuesta]
- Los permisos del colaborador se asignan **por ente**. Cada colaborador solo ve y edita las áreas que le asignaron.
- Rol **auditor / solo lectura** para control interno. **[Decidido]** llega en la v2.
- **[Decidido]** Los colaboradores no atienden conversaciones: gestionan el organigrama y alimentan la IA, que atiende al ciudadano.

## 5. Membresías

### Original
| | Básica | Intermedia | VIP |
|---|---|---|---|
| Acceso al sistema (dashboard) | Sí | Sí | Sí |
| Asistente IA con chat en todas las redes | Sí | Sí | Sí |
| APIs para sistemas municipales, con perfiles | No | Sí | Sí |
| Respuesta por llamada de voz con IA | No | No | Sí |

### [Decidido] Paquete único
Se vende **un paquete con todo incluido** (chat en todos los canales, APIs con perfiles y voz), sin planes ni límites de uso por plan. Se paga mensual o anual, con descuento por pago anual, y el precio es escalonado según la población del municipio. Las tablas de arriba y de abajo quedan como idea original.

### [Propuesta] Cuotas por plan (superado por el paquete único)
Además de las funciones, cada plan tendría límites medibles. Los valores quedan por definir.

| Límite | Básica | Intermedia | VIP |
|---|---|---|---|
| Mensajes de IA por mes | por definir | por definir | por definir |
| Canales conectados | por definir | por definir | por definir |
| Colaboradores | por definir | por definir | por definir |
| Perfiles de API | 0 | por definir | por definir |
| Peticiones de API por minuto | — | por definir | por definir |
| Minutos de voz por mes | — | — | por definir |

Debe definirse qué pasa al superar un límite: corte, cobro extra o aviso. **[Decidido]** En v1 no hay límites por plan, pero sí un **límite de peticiones** (request limit).

### [Propuesta] Cobro
Muchos municipios pagan por factura, transferencia u orden de compra, no con tarjeta. Se contemplan dos modos:
- **Pago online** (Stripe o Mercado Pago, mediante el servicio de pagos).
- **Facturación manual:** un administrador de la plataforma activa o renueva el plan.

**[Decidido]** La facturación es **mensual o anual**, con descuento por pago anual (ver sección 13.2).

## 6. Entidades del dominio

| Entidad | Descripción |
|---|---|
| **Municipio** | Tenant. Tiene plan, estado y configuración (marca, mercado, idioma). |
| **Membresía** | Plan activo del municipio, con vigencia y cuotas. |
| **Canal conectado** | Credenciales y estado de cada red (Meta, TikTok). |
| **Ente** | Nodo del organigrama, con un ente padre opcional. |
| **Dato de conocimiento** | Información de un ente. [Propuesta] Tiene estado (borrador, publicado), autor y versión. |
| **Colaborador** | Usuario del municipio, con permisos por ente. |
| **Invitación** | Alta de un colaborador por el admin. |
| **Perfil de API** | Configuración de la IA para un uso: instrucciones, subconjunto de la base, claves y límites. |
| **Conversación** | Intercambio con un ciudadano, con su canal, estado y mensajes. |

## 7. Flujos principales

### 7.1 Alta del municipio (original)
1. El municipio elige una membresía y la paga.
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

### 7.5 Uso de la API (plan intermedio y VIP)
1. El admin crea un perfil para un uso específico.
2. Obtiene una clave de API para ese perfil.
3. El sistema municipal consume la IA con esa clave.

### 7.6 Llamada de voz (plan VIP)
1. El ciudadano llama al número del municipio.
2. La IA responde por voz con la misma base de conocimiento.

## 8. Reglas de negocio

### Originales
- Un municipio solo accede al sistema con una membresía activa.
- Las funciones disponibles dependen del plan contratado.
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

| Integración | Uso | Plan |
|---|---|---|
| Meta (WhatsApp, Instagram, Messenger) | Canales de atención | Todos |
| TikTok | Canal de atención | Todos |
| Widget web **[Decidido]** (v2) | Chat en el sitio del municipio, vía API | Todos |
| Pasarela de pagos | Cobro de membresías | Todos |
| API de Welver | Uso de la IA desde sistemas municipales | Intermedia y VIP |
| Telefonía y voz | Llamadas atendidas por IA | VIP |

**[Propuesta]** La verificación de negocio y la revisión de app de Meta pueden tardar semanas. Se sugiere un asistente guiado de conexión, o que la plataforma conecte los canales en nombre del municipio.

## 10. Mapeo a la plataforma

| Necesidad de Welver | Ya existe | Falta |
|---|---|---|
| Canales Meta y TikTok | chatia (WhatsApp, Instagram, Messenger, TikTok) | Asistente guiado de conexión |
| Base de conocimiento | `KnowledgeBase`, `KbDocument` en chatia | Ligarla a entes, con publicación y vigencia |
| Asistente IA | `AssistantConfig` y proveedores LLM | Guardrails y citas de fuente |
| Roles y colaboradores | `Collaborator` e `Invitation` en el SaaS | Permisos por ente |
| Membresías y cuotas | `QuotaConfig` y `FeatureFlag` | Definir los 3 planes |
| Cobro | pasarelapagos | Facturación manual |
| API para sistemas municipales | — | Perfiles y claves con alcance |
| Organigrama | — | Modelo de entes |
| Voz | — | Servicio nuevo |
| Métricas | analytics | Tablero de temas y huecos de información |
| Gestión global de municipios | superadmin | Vista de planes y consumo |

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
| 10 | Precio | Escalonado según la población del municipio. |

## 13. Especificación por versión

Esta sección se arma con tus respuestas: cada pregunta respondida pasa acá y sale de la sección 14. **[Decidido]** sale de tus respuestas. **[Pendiente]** tiene una pregunta abierta en la sección 14.

### 13.1 Reglas generales (todas las versiones)

- **[Decidido]** Welver solo **informa**: no recibe reclamos ni gestiona trámites ni deriva a personas.
- **[Decidido]** Un municipio = una organización; el organigrama se crea dentro de ella.
- **[Decidido]** La IA atiende primero en el idioma del país del municipio, pero responde en el idioma en que le escriben o hablan.
- **[Decidido]** **Paquete único con todo incluido** (chat en todos los canales, APIs con perfiles y voz). Reemplaza el esquema de tres membresías. Se paga mensual o anual, con un **descuento por pago anual** uniforme de alrededor del 15–20%. El precio es **escalonado según la población** del municipio, en **4 tramos**: hasta 20.000 habitantes, de 20.000 a 100.000, de 100.000 a 500.000 y más de 500.000. La **voz va incluida**, con política de uso razonable, y hay un **tope alto contractual de mensajes por mes**. **Moneda: dólares** (cobra la LLC de EE.UU. por transferencia), con montos que salen del costo por conversación medido en el piloto más un margen fijo; el piloto va con precio reducido. **Tope de mensajes:** uno por tramo, de 3 veces el uso medio del piloto, con aviso al admin al 80% y sin corte; se renegocia en el contrato. **[Pendiente]** los montos finales y quién paga: puede ser un fondo de desarrollo que financia al municipio y que podría proponer una **licencia**.
- **[Decidido]** **Cobro por transferencia bancaria.** Se usa Stripe en una LLC de EE.UU., con facturas que incluyen los datos de transferencia (ACH, wire, SEPA) y conciliación automática. En v1 el admin marca la factura como pagada a mano. Así todos transfieren a un solo banco.
- **[Decidido]** **Vencimiento:** período de gracia de 7 a 14 días con aviso; luego suspensión: la IA deja de responder, los canales se pausan y el panel queda en solo lectura. Los datos se conservan indefinidamente. La verificación del pago es manual en v1 y por webhook cuando haya pasarela.

- **[Decidido]** **Datos de ciudadanos:** región de nube elegible por país y contrato de tratamiento de datos con cada municipio.
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
