/** Contenido de referencia de welver.html (tablas y listas que no dependen del DOM). */

export const PILLARS = [
  { n: 1, title: 'Mobile-first, 3 clases', state: 'ok', text: 'Compact < 600 · medium 600–839 · expanded ≥ 840. Puntos de corte únicos; sm/md/lg no existen.' },
  { n: 2, title: 'La navegación cambia de forma', state: 'ok', text: 'Barra inferior, riel y barra completa, generados desde una sola lista de destinos.' },
  { n: 3, title: 'Táctil primero', state: 'ok', text: 'Objetivos ≥ 44×44, nada esencial en hover, atajos solo como mejora. Auditable en vivo.' },
  { n: 4, title: 'Tokens únicos', state: 'ok', text: 'Color, espaciado, radios, tipografía y motion con dark mode, en @real/ui (welver.css).' },
  { n: 5, title: 'Rendimiento y accesibilidad', state: 'todo', text: 'AA calculado en vivo, foco, teclado, reduced-motion y zoom libre. Core Web Vitals se miden en el storefront real.' },
  { n: 6, title: 'Estados completos', state: 'ok', text: 'Cargando, vacío, error con reintento y sin permisos, más las páginas de error del sistema.' },
] as const

export const FRONT_PRIORITY = [
  ['real-ecommerce-front', 'Cliente final, casi siempre en celular', 'Prioridad 1: rendimiento y conversión; mobile primero'],
  ['realsass-dashboard-front', 'Dueño / colaboradores', 'Densidad en expanded; lo esencial operable en compact'],
  ['realsass-sass-front', 'Dueño (cuenta, organizaciones)', 'Igual que el dashboard'],
  ['realsass-dashboard-desktop (Tauri)', 'Dueño en escritorio', 'Hereda el dashboard; sin reglas propias'],
] as const

export const ANTI_PATTERNS = [
  ['Puntos de corte propios de un front', 'Alta', 'Solo compact / medium / expanded'],
  ['Funcionalidad solo accesible con hover', 'Bloqueante', 'Tooltip también al tocar y con foco'],
  ['Objetivos táctiles < 44 px', 'Alta', 'Medido con el auditor'],
  ['user-scalable=no / maximum-scale=1', 'Alta', 'Viewport sin bloqueo de zoom'],
  ['Valores visuales hardcodeados (hex, px)', 'Media', 'Excepciones: demo de espaciado, theme-color'],
  ['Pantalla con datos sin cargando / vacío / error', 'Alta', '4 estados en la tabla'],
  ['Navegación distinta (otras rutas) según dispositivo', 'Alta', 'Una lista, tres presentaciones'],
  ['Animación sin respetar prefers-reduced-motion', 'Media', 'Regla global'],
] as const

export const TYPE_ROLES = [
  ['Display', 'Source Serif 4', '600 – 800', 'Títulos hero, headings grandes'],
  ['Body', 'Inter', '400 – 600', 'Texto de interfaz, párrafos'],
  ['Mono', 'JetBrains Mono', '400 – 500', 'Código, SKUs, IDs técnicos'],
] as const

export const TYPE_CRITERIA = [
  'Variable font (performance en web)',
  'Latín extendido (ñ, acentos, ç)',
  'Licencia libre uso comercial (OFL)',
  'Legible en tamaños pequeños en mobile',
  'Cifras tabulares (tabular-nums) en importes y tablas',
  'Títulos con text-balance, párrafos con text-pretty',
] as const

export const LAYERS = [
  ['z-20', '20', 'Sidebar en modo drawer'],
  ['z-30', '30', 'Dropdown, popovers, índice móvil'],
  ['z-40', '40', 'Topbar sticky'],
  ['top layer', '—', '<dialog> modal: siempre encima, sin z-index'],
  ['z-[60]', '60', 'Toasts'],
  ['z-[100]', '100', 'Skip link'],
] as const

export const KEYMAP = [
  ['Global', 'Ctrl/⌘ K abre la búsqueda · Tab primero llega a «Saltar al contenido»'],
  ['Dialog · Drawer · Búsqueda', 'Tab queda atrapado dentro · Esc cierra · el foco vuelve al botón que lo abrió'],
  ['Tabs', '← → cambian · Inicio Fin'],
  ['Menú (Dropdown)', '↓ abre · ↑ ↓ Inicio Fin navegan · Esc cierra y devuelve el foco'],
  ['Combobox', '↓ ↑ mueven · Enter elige · Esc cierra'],
  ['Acordeón', 'Enter / Espacio · ↑ ↓ Inicio Fin entre cabeceras'],
  ['Tabla', 'Cabeceras ordenables con Enter · aria-sort anuncia el orden · Espacio marca filas'],
  ['Tooltip', 'Aparece con foco o hover · Esc lo oculta sin mover el foco'],
] as const

export const A11Y_RULES = [
  'Foco siempre visible (ring con offset o outline)',
  'El color nunca es el único canal: los estados llevan icono y texto',
  'Errores de formulario: texto + aria-invalid + resumen enfocable',
  'Notificaciones: aria-live, se pausan con hover/foco y no caducan si tienen acción',
  'Regiones con scroll son enfocables y están etiquetadas',
  'Respeta prefers-reduced-motion y prefers-color-scheme',
] as const

export const MOTION_DURATIONS = [
  ['100 ms', 'Presionar un botón (feedback inmediato)'],
  ['150 ms', 'Hover, foco, color, tooltip'],
  ['200–220 ms', 'Modal centrado, salida de toasts y paneles'],
  ['300–340 ms', 'Hojas inferiores, pantallas completas, tabs, toasts'],
  ['550–650 ms', 'Entrada de página y reveal al hacer scroll'],
  ['16 s', 'Ambiente (fondo del hero); nunca compite con el contenido'],
] as const

export const MOTION_CURVES = [
  ['ease-out', 'cubic-bezier(.22, 1, .36, 1)', 'Entra'],
  ['ease-in', 'cubic-bezier(.4, 0, 1, 1)', 'Sale'],
  ['ease-standard', 'cubic-bezier(.2, 0, 0, 1)', 'Cambia de estado'],
  ['ease-soft', 'cubic-bezier(.25, .8, .3, 1)', 'Modales en compact'],
  ['ease-sheet', 'cubic-bezier(.32, .72, 0, 1)', 'Hojas y paneles'],
] as const

export const MODAL_MOTION = [
  ['Hoja, pantalla completa, búsqueda y panel (compact)', 'Sube 20 px y aparece poco a poco', 'Baja 10 px con fundido', '520 / 200 ms'],
  ['Alertas (escritorio)', 'Suben 22 px desde abajo, en el centro', 'Bajan 14 px', '460 / 200 ms'],
  ['Alertas (móvil)', 'Suben desde el borde de la barra inferior hasta el centro', 'Bajan hacia la barra', '460 / 200 ms'],
  ['Toasts', 'Suben desde abajo (en móvil, sobre la barra inferior)', 'Bajan 14 px', '460 / 220 ms'],
  ['Centrado (medium, expanded)', 'Escala de 96 % a 100 % con fundido', 'Escala a 97 % con fundido', '200 / 150 ms'],
  ['Panel lateral (medium, expanded)', 'Se desliza 28 px con fundido', '20 px con fundido', '300 / 170 ms'],
] as const

export const MOTION_RULES = [
  'Anima solo transform y opacity: son baratas y no provocan reflujo.',
  'La salida es más corta que la entrada; lo que se va no debe hacer esperar.',
  'Escalonado máximo: 8 elementos × 60 ms. Más allá, entran juntos.',
  'El reveal ocurre una sola vez por elemento; no se repite al volver a pasar.',
  'El movimiento nunca bloquea: todo se puede interrumpir o usar mientras anima.',
  'Resorte (--ease-spring) solo para confirmar acciones, no para entradas de página.',
  'Con prefers-reduced-motion no hay reveal, ni deslizamientos ni ambiente: el contenido aparece al instante.',
  'Si falla el JavaScript, todo el contenido sigue visible.',
  'El movimiento no retrasa el LCP: el título y el texto principal nunca parten de opacity: 0.',
] as const

export const SIZE_CLASSES = [
  ['Compact (sin prefijo)', '< 600 px', 'Celular', 'Barra inferior (≤ 5 destinos)', '1 columna · tablas como tarjetas · dialog como bottom sheet'],
  ['Medium (medium:)', '600 – 839 px', 'Tablet / celular horizontal', 'Riel lateral de íconos', '2 columnas · tabla completa · dialog centrado, panel lateral y menús anclados'],
  ['Expanded (expanded:)', '≥ 840 px', 'Desktop', 'Barra lateral completa (colapsable)', '3+ columnas según el espacio · contenedor max-w-7xl'],
] as const

export const RESPONSIVE_RULES = [
  'Objetivos táctiles ≥ 44×44 en compact, medium y cualquier dispositivo táctil (pointer: coarse)',
  'Nada esencial depende de hover',
  'Inputs a 16 px en móvil y tablet: iOS no hace zoom al enfocar',
  'viewport sin maximum-scale ni user-scalable=no: el zoom nunca se bloquea',
  'Sin scroll horizontal de página: solo en tablas, tabs y chips',
  'Safe-area (env(safe-area-inset-bottom)) en sheets, barra inferior y toasts',
  'Si el ancho depende del contenedor (no del viewport) se usa auto-fit/minmax o una consulta de contenedor, nunca un punto de corte nuevo',
] as const

// 1 cumple · 0 pendiente · 'n' no aplica   [teclado, lector, 3 clases, oscuro, motion, estados, pruebas]
export const COMPONENT_STATUS: ReadonlyArray<readonly [string, ...Array<0 | 1 | 'n'>]> = [
  ['Button', 1, 1, 1, 1, 1, 'n', 0], ['Input · Select · Textarea', 1, 1, 1, 1, 'n', 1, 0], ['Combobox · Date', 1, 1, 1, 1, 1, 1, 0],
  ['Form con validación', 1, 1, 1, 1, 1, 1, 0], ['Card · Badge · Alert', 'n', 1, 1, 1, 1, 'n', 0], ['Modales (6 presentaciones)', 1, 1, 1, 1, 1, 1, 0],
  ['Menú adaptable', 1, 1, 1, 1, 1, 'n', 0], ['Toast', 1, 1, 1, 1, 1, 'n', 0], ['Tooltip', 1, 1, 1, 1, 1, 'n', 0], ['Tabs', 1, 1, 1, 1, 1, 'n', 0],
  ['Accordion', 1, 1, 1, 1, 1, 'n', 0], ['Stepper', 'n', 1, 1, 1, 1, 'n', 0], ['Table', 1, 1, 1, 1, 1, 1, 0], ['Navegación adaptable', 1, 1, 1, 1, 1, 'n', 0],
  ['Búsqueda (Ctrl K)', 1, 1, 1, 1, 1, 1, 0], ['Páginas de error', 1, 1, 1, 1, 1, 'n', 0], ['Gráficos', 1, 1, 1, 1, 1, 1, 0],
]
export const STATUS_COLUMNS = ['Teclado', 'Lector', '3 clases', 'Oscuro', 'Motion', 'Estados', 'Pruebas'] as const

export const DOD: ReadonlyArray<readonly [group: string, items: readonly string[]]> = [
  ['Documentación', ['Cuándo usarlo y cuándo no (una línea clara)', 'API y variantes con ejemplo copiable', 'Textos en es-LA según la guía de contenido']],
  ['Accesibilidad', ['Teclado completo según WAI-ARIA', 'Nombre accesible y roles correctos ⚡', 'Contraste AA en claro y oscuro ⚡', 'Foco visible y orden de tabulación lógico']],
  ['Adaptación', ['Probado en compact, medium y expanded sin scroll horizontal ⚡', 'Objetivos táctiles de 44×44 donde hay toque ⚡', 'Nada esencial depende de hover']],
  ['Comportamiento', ['Estados: cargando, vacío, error y sin permisos', 'Movimiento solo con transform y opacity, y apagado con reducir movimiento', 'No retrasa el LCP ni provoca saltos de diseño']],
  ['Entrega', ['Fila nueva en la tabla de estado de componentes', 'Pruebas automáticas (axe, Playwright y visuales) en CI', 'Entrada en el historial con su versión']],
]

export const VERSIONING = [
  ['Mayor (2.0)', 'Cambia la API de un componente o se renombra o elimina un token. Siempre con guía de migración.'],
  ['Menor (1.4)', 'Componente, variante o token nuevo. Compatible hacia atrás.'],
  ['Parche (1.4.1)', 'Corrección de accesibilidad, contraste o comportamiento sin cambiar la API.'],
] as const

export const VERSION_RULES = [
  'Deprecar antes de retirar: se marca, se avisa en consola y en esta guía, y se mantiene durante una versión menor completa antes de quitarlo en la siguiente mayor.',
  'Los tokens renombrados dejan un alias con el nombre antiguo hasta la próxima mayor.',
  'Un cambio de contraste o de tamaño táctil es siempre un parche o una mayor, nunca «estético».',
  'Los tres frontends consumen la misma versión; no se admite un frontend en una versión distinta.',
] as const

export const CHANGELOG = [
  ['1.5', 'Gráficos y datos con paleta validada; exportación de tokens; auditor de accesibilidad y Core Web Vitals en vivo; gobierno del sistema.'],
  ['1.4', 'Páginas de error y estados del sistema (404, 403, 401, 429, 500, 503, sin conexión, tiempo agotado y pago), banner de conexión y sesión expirada.'],
  ['1.3', 'Motion: entrada escalonada, reveal al hacer scroll, tabs direccionales, FLIP, onda al pulsar y avisos que se deslizan. Cambio de tema instantáneo.'],
  ['1.2', 'Modales adaptables (6 presentaciones), navegación adaptable, menús y selectores como hoja en compact; tablet con componentes de escritorio.'],
  ['1.1', 'Norte UI/UX (ADR-024): clases de tamaño compact, medium y expanded; táctil primero; estados completos.'],
  ['1.0', 'Base: tokens HSL, tipografía, componentes, dark mode.'],
] as const

export const PROPOSAL_STEPS = [
  ['Problema real', 'Describe el caso y enlaza al menos dos pantallas que lo necesitan. Sin dos usos, aún no es del sistema.'],
  ['Decisión', 'Si toca el norte (breakpoints, navegación, táctil, tokens), se escribe un ADR; si no, basta una propuesta corta.'],
  ['Prototipo aquí', 'Se construye en components/ui de esta app con los tokens existentes, en las 3 clases de tamaño y en claro y oscuro.'],
  ['Definición de «hecho»', 'Pasa la lista de arriba y la tarjeta de salud no empeora (contraste, auditor, táctil).'],
  ['Publicación', 'Se porta a @real/ui, se actualiza la tabla de estado y se anota en el historial con su versión.'],
  ['Retirada', 'Todo componente que ningún frontend usa durante dos versiones se depreca. Un sistema pequeño y usado vale más que uno grande y olvidado.'],
] as const

export const CONTENT_RULES = [
  { title: 'Botones: verbo + objeto', good: 'Guardar cambios · Crear pedido · Eliminar producto', bad: 'Aceptar · OK · Enviar · Sí' },
  { title: 'Errores: qué pasó + cómo arreglarlo', good: 'El correo no es válido. Revisa que tenga el formato nombre@dominio.com.', bad: 'Error 422. Entrada inválida.' },
  { title: 'Confirmaciones destructivas: nombra lo que se pierde', good: '¿Eliminar «Camiseta Essential»? Se quitará del catálogo. [Cancelar] [Eliminar producto]', bad: '¿Estás seguro? [No] [Sí]' },
  { title: 'Estados vacíos: motivo + siguiente paso', good: 'Aún no tienes pedidos. Crea el primero para empezar.', bad: 'No hay datos.' },
] as const

export const ERROR_RULES = [
  'Toda ruta tiene su error. En Next.js: not-found.tsx, error.tsx y global-error.tsx, con este diseño.',
  'El código HTTP es real: un 404 responde 404 (no un «soft 404» con 200) y no se indexa (noindex).',
  'Nunca se muestran trazas, nombres de tablas ni mensajes técnicos. Se muestra un ID de error que soporte puede buscar.',
  'Tono humano y sin culpa: «No encontramos la página», no «Has introducido una URL inválida».',
  'Siempre hay una acción principal que resuelve y una salida (inicio, volver). Cero callejones.',
  'Accesibilidad: el foco pasa al título, document.title cambia y el contraste es AA en los tres tonos.',
  'Reintentos con espera creciente y límite; un 429 muestra cuánto falta, no un botón que no responde.',
  'Sin conexión no se pierde trabajo: se guarda en el dispositivo y se avisa al reconectar.',
  'Las ilustraciones son decorativas (aria-hidden); el significado vive en el texto.',
  'Se diseñan y se prueban en las tres clases de tamaño, igual que cualquier pantalla.',
] as const

export const NOTICE_KINDS = [
  ['Toast', 'Confirmar algo ya hecho', '4,5 s (9 s con acción)', 'status'],
  ['Alerta en línea', 'Contexto de una sección o formulario', 'Hasta resolverse', 'status · alert'],
  ['Centro de notificaciones', 'Historial de lo que pasó mientras no mirabas', 'Hasta eliminarlo', 'dialog · list'],
  ['Banner', 'Estado de toda la página o cuenta', 'Persistente, descartable', 'status'],
  ['Badge · contador', 'Estado o cantidad pendiente', 'Permanente', 'aria-label'],
  ['Progreso', 'Una operación en curso', 'Hasta terminar', 'progressbar'],
  ['Modal de alerta', 'Algo irreversible o que bloquea', 'Hasta decidir', 'alertdialog'],
] as const

export const NOTICE_RULES = [
  'Un aviso, un trabajo: confirmar (toast), contextualizar (alerta), avisar de la sesión (banner), contar (badge).',
  'Nunca información esencial en un toast: desaparece. Lo que hay que leer o resolver vive en la página.',
  'Tono humano y concreto: qué pasó y qué sigue, sin códigos ni culpa.',
  'Máximo cuatro toasts a la vez: los repetidos se agrupan (×3), un error pasa por delante y el resto espera en cola.',
  'Lo importante queda también en el centro de notificaciones: el toast desaparece, el historial no.',
  'El color acompaña, no informa solo: cada tipo tiene icono y texto, con contraste AA.',
  'Los cambios se anuncian a lectores de pantalla (status / alert) sin robar el foco.',
  'Lo crítico (sin conexión, pago fallido) no se puede descartar hasta que se resuelva.',
] as const

export const MODAL_TYPES = [
  ['Alerta', 'Confirmar algo irreversible', 'Centrado, botones apilados', 'Centrado', 'Centrado', 'alertdialog'],
  ['Formulario corto', 'Editar o crear algo pequeño', 'Hoja inferior', 'Centrado', 'Centrado', 'dialog'],
  ['Selección', 'Elegir entre muchos elementos', 'Hoja alta', 'Centrado', 'Centrado', 'dialog'],
  ['Detalle', 'Ver un elemento sin perder la lista', 'Pantalla completa con «atrás»', 'Panel derecho', 'Panel derecho', 'dialog'],
  ['Filtros', 'Refinar una lista', 'Hoja inferior', 'Panel derecho', 'Panel derecho', 'dialog'],
  ['Formulario largo', 'Crear algo con muchos campos', 'Pantalla completa', 'Centrado grande', 'Centrado grande', 'dialog'],
  ['Menú de acciones', 'Acciones de un elemento, ordenar', 'Hoja de acciones', 'Popover anclado', 'Popover anclado', 'menu'],
  ['Búsqueda', 'Buscar y ejecutar comandos', 'Pantalla completa', 'Superior', 'Superior', 'combobox'],
] as const

export const MODAL_RULES = [
  'Siempre hay un botón visible para cerrar. Arrastrar es un atajo, nunca la única forma.',
  'Un modal bloquea: si no hace falta bloquear, usa un popover o el contenido en línea.',
  'Máximo 2 niveles apilados (por ejemplo, la confirmación de descartar sobre un formulario).',
  'Acciones destructivas: alertdialog, foco en la opción segura y sin cierre al tocar fuera.',
  'Título obligatorio (aria-labelledby); el foco vuelve al botón que lo abrió.',
  'Hojas con una sola altura: se ajusta al contenido o es alta (92 % máx.). Nada de alturas intermedias.',
  'Formularios largos en compact: pantalla completa con barra superior y acciones fijas abajo.',
  'El botón «atrás» del sistema y Esc cierran el modal superior, no la página.',
  'Los toasts se muestran por encima del modal (capa superior), nunca detrás.',
  'En compact las acciones de hojas y pantallas completas van en una sola fila (Cancelar | acción principal); las alertas mantienen los botones apilados.',
] as const

export const CHART_SERIES = [
  ['Serie 1', '--chart-1', 'Entidad principal (p. ej. Tienda online)'], ['Serie 2', '--chart-2', ''], ['Serie 3', '--chart-3', ''], ['Serie 4', '--chart-4', ''],
  ['Serie 5', '--chart-5', ''], ['Serie 6', '--chart-6', ''], ['Serie 7', '--chart-7', ''], ['Serie 8', '--chart-8', 'Última; nunca hay un noveno color'],
] as const

export const CHART_FORMS = [
  ['Una cifra actual (con tendencia)', 'Tarjeta de métrica: valor, variación y minigráfico', 'Un gráfico de una sola barra'],
  ['La cifra con la que abre el panel', 'Cifra principal (≥ 48 px, una por vista)', 'Dos o más cifras gigantes'],
  ['Una proporción contra un límite', 'Medidor con pista del mismo tono', 'Un pastel de 2 porciones'],
  ['Evolución en el tiempo', 'Línea (área si es una sola serie)', 'Eje doble: inventa correlaciones'],
  ['Ranking de categorías', 'Barras horizontales, un solo color', 'Colorear cada barra por su valor'],
  ['Parte de un todo en el tiempo', 'Columnas apiladas con separación de 2 px', 'Donut para comparar valores cercanos'],
  ['Intensidad en una cuadrícula (día × hora)', 'Mapa de calor secuencial', 'Arcoíris: no se ordena'],
  ['Más de ~7 clases con significado', 'Tabla (o tabla + gráfico)', 'Más colores'],
] as const

export const CHART_RULES = [
  'Un solo eje. Dos magnitudes distintas son dos gráficos o un índice a base 100.',
  'El color sigue a la entidad, nunca a su posición: al filtrar, las demás series conservan su color.',
  'Marcas finas: línea de 2 px, barras de máximo 24 px con 4 px redondeados solo en la punta, puntos con anillo de 2 px.',
  'Rejilla y ejes en hairline sólido, nunca discontinuo. El texto usa los colores de texto, nunca el de la serie.',
  'Dos o más series: leyenda siempre. Etiquetas directas solo en lo importante; si chocan, se omiten.',
  'El tooltip mejora, nunca es la única vía: cada valor está en una etiqueta o en la tabla. Se abre también con teclado.',
  'Todo gráfico tiene su tabla gemela y un resumen para lectores de pantalla.',
  'Los filtros van en una fila sobre los gráficos y los escopan a todos. Recargar mantiene el marco.',
  'Los patrones (45° y 135°) son opt-in: ajuste de accesibilidad, impresión o colores forzados. Nunca decorativos.',
  'Las animaciones se apagan con movimiento reducido.',
] as const

export const LOGIN_RULES = [
  'Una sola acción: no hay «crear cuenta». El primer acceso registra y los siguientes inician sesión, con el mismo botón.',
  'Se avisa si la cuenta es nueva («Cuenta creada») o existente («Sesión iniciada»).',
  'Si el correo ya está registrado con otro proveedor (account-exists-with-different-credential), se indica con cuál entrar.',
  'Ventana bloqueada, sin conexión o dominio no autorizado tienen su propio mensaje y una salida clara.',
  'Botones de 46 px, foco visible, modal con foco atrapado y cierre con Esc o «atrás» del sistema.',
] as const

export const FORM_RULES = [
  'Siempre una label visible: el placeholder no es etiqueta. La ayuda va debajo; el error, debajo con icono y texto.',
  'Valida al salir del campo y al enviar; no mientras la persona todavía escribe.',
  'Si hay errores, un resumen enfocable arriba con enlaces a cada campo; el foco pasa al resumen.',
  'Escribe el error como «qué pasó + cómo arreglarlo». Nunca «Campo inválido».',
  'Marca lo obligatorio con asterisco y explícalo; lo opcional dice «Opcional».',
  'Usa el tipo y el inputMode correctos (email, tel, numeric) y autocomplete: el teclado del celular se adapta.',
  'Listas cortas: select nativo. Más de ~7 opciones: combobox con búsqueda.',
  'Contraseñas con botón de mostrar/ocultar y medidor de fuerza; nunca bloquees el pegado.',
  'Un campo, un trabajo: no pidas dos veces lo que ya sabes; separa los formularios largos en pasos.',
  'El botón de enviar se deshabilita solo mientras envía y cambia su texto («Creando cuenta…»).',
] as const
