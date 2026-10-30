/** Guía 10/10 de welver.html: [grupo, ícono lucide, [[criterio, hecho(1)/pendiente(0)]]]. */
export type GuideGroup = readonly [name: string, icon: string, items: ReadonlyArray<readonly [text: string, done: 0 | 1]>]

export const GUIDE: readonly GuideGroup[] = [
 [
  "1 · Mobile-first, 3 clases de tamaño",
  "smartphone",
  [
   [
    "Puntos de corte únicos compact / medium / expanded en tailwind.config (sm, md, lg y xl eliminados)",
    1
   ],
   [
    "CSS y JS usan los mismos valores (600 / 840); ningún punto de corte propio",
    1
   ],
   [
    "Anchos que dependen del contenedor resueltos con auto-fit/minmax y consulta de contenedor, no con breakpoints nuevos",
    1
   ],
   [
    "Vista previa por clase de tamaño, con carga diferida",
    1
   ],
   [
    "Mapear los puntos de corte al tema de Tailwind de @real/ui (DT-UI-01)",
    0
   ]
  ]
 ],
 [
  "2 · La navegación cambia de forma, no de contenido",
  "navigation",
  [
   [
    "Barra inferior (compact), riel (medium) y barra completa colapsable (expanded)",
    1
   ],
   [
    "Las tres presentaciones salen de una sola lista de destinos: mismas rutas",
    1
   ],
   [
    "Máximo 5 destinos en la barra inferior, con badge accesible",
    1
   ],
   [
    "Implementar el patrón en realsass-dashboard-front y realsass-sass-front (Tauri lo hereda)",
    0
   ]
  ]
 ],
 [
  "3 · Táctil primero",
  "pointer",
  [
   [
    "Objetivos ≥ 44×44 en compact, medium y táctil, comprobado con el auditor en vivo",
    1
   ],
   [
    "Nada esencial depende de hover: el tooltip se abre al tocar y con foco",
    1
   ],
   [
    "Atajos de teclado (Ctrl/⌘ K) solo como mejora, nunca requisito",
    1
   ],
   [
    "Auditoría en dispositivos reales (iOS Safari y Android Chrome)",
    0
   ]
  ]
 ],
 [
  "4 · Tokens únicos en @real/ui",
  "palette",
  [
   [
    "Tokens HSL con opacidad, dark mode por clase y tokens *-ink para texto sobre tintes",
    1
   ],
   [
    "Tema Claro / Oscuro / Sistema persistente, con contraste AA calculado en vivo",
    1
   ],
   [
    "Elevación, capas z-index y duraciones de motion documentadas",
    1
   ],
   [
    "Fuente única en @real/ui que genere tailwind.config y globals.css de los 3 frontends",
    0
   ],
   [
    "Regla de lint que prohíba hex y px sueltos dentro de los frontends",
    0
   ]
  ]
 ],
 [
  "5 · Rendimiento y accesibilidad",
  "gauge",
  [
   [
    "Contraste AA calculado en vivo para cada par de tokens, en claro y oscuro",
    1
   ],
   [
    "Foco visible y teclado WAI-ARIA en dialog, tabs, menú, combobox y acordeón",
    1
   ],
   [
    "prefers-reduced-motion respetado y zoom nunca bloqueado (viewport sin user-scalable=no)",
    1
   ],
   [
    "Sin parpadeo al cargar: tema aplicado antes del primer pintado",
    1
   ],
   [
    "Core Web Vitals del storefront (LCP, INP, CLS) en umbral «bueno»",
    0
   ],
   [
    "Tailwind compilado y fuentes autoalojadas, sin CDN",
    0
   ],
   [
    "axe y Lighthouse sin errores en CI",
    0
   ]
  ]
 ],
 [
  "6 · Estados completos en toda pantalla",
  "layers",
  [
   [
    "Cargando (skeleton), vacío, error con reintento y sin permisos en la tabla y en Empty state",
    1
   ],
   [
    "Sin resultados con «Limpiar filtros»; formularios con resumen de errores",
    1
   ],
   [
    "Acciones destructivas con «Deshacer»",
    1
   ],
   [
    "Aplicar los 4 estados en cada pantalla con datos de los 3 frontends",
    0
   ]
  ]
 ],
 [
  "Motion",
  "wand-sparkles",
  [
   [
    "Tokens de curvas y duraciones (ease-out, ease-in, standard, spring, sheet) usados en toda la página",
    1
   ],
   [
    "Entrada de página escalonada (cabecera, hero, índice, métricas) y reveal al hacer scroll una sola vez",
    1
   ],
   [
    "10 patrones con demo: escalonado, skeleton→contenido, contador, éxito/error, botón con estados, switch con resorte, toast con cuenta atrás, tabs con indicador y contenido direccional, reordenar con FLIP y avisos que se deslizan",
    1
   ],
   [
    "Motion avanzado: onda al pulsar, cabecera con elevación, paralaje suave, barra de progreso de scroll, foco de luz que sigue al cursor, indicador deslizante de navegación y vibración ligera en táctil",
    1
   ],
   [
    "Cambio de tema instantáneo, sin transiciones a medias",
    1
   ],
   [
    "Modales: en compact todo entra desde abajo; el panel lateral se desliza 28 px (antes recorría todo el ancho)",
    1
   ],
   [
    "Solo transform y opacity; sin reveal ni ambiente con prefers-reduced-motion; el contenido es visible si falla el JS",
    1
   ],
   [
    "Tokens y hooks de motion (useReveal, useCountUp) en @real/ui y prueba de que reduced-motion los desactiva",
    0
   ]
  ]
 ],
 [
  "Modales adaptables",
  "app-window",
  [
   [
    "Una base <dialog> con 6 presentaciones (centrado, hoja inferior, panel lateral, pantalla completa, superior, popover anclado) elegidas por clase de tamaño y recalculadas al girar",
    1
   ],
   [
    "Todo se adapta: búsqueda a pantalla completa, menú de acciones como hoja y selector de país como hoja con búsqueda en compact",
    1
   ],
   [
    "Hoja inferior nativa: agarre, arrastre para cerrar (también desde el contenido), una sola altura (ajustada o alta, sin alturas intermedias), teclado virtual y zona segura",
    1
   ],
   [
    "Tablet con componentes de escritorio: índice lateral, modales centrados, panel lateral, menús anclados y riel (la hoja y la barra inferior son solo de compact)",
    1
   ],
   [
    "«Atrás» del sistema y Esc cierran el modal superior; salida animada; scroll bloqueado; toasts por encima",
    1
   ],
   [
    "Guardia de cambios sin guardar con confirmación anidada y foco inicial seguro",
    1
   ],
   [
    "Menú adaptable: hoja de acciones en compact, popover anclado en medium y expanded",
    1
   ],
   [
    "Probador de presentaciones con simulación de clase y atributos copiables",
    1
   ],
   [
    "Primitivo Modal en @real/ui (Radix Dialog + Vaul) con la misma API por clase de tamaño",
    0
   ],
   [
    "Pruebas de gestos (arrastre, «atrás») en iOS Safari y Android Chrome reales",
    0
   ]
  ]
 ],
 [
  "Gobierno y rendimiento",
  "badge-check",
  [
   [
    "Tarjeta de salud que se calcula sola: contraste, auditor de accesibilidad, táctil, zoom, desbordes, reducir movimiento, exportación, LCP, CLS y DOM",
    1
   ],
   [
    "Definición de «hecho» para componentes nuevos (guardada) y reglas de versionado, deprecación y propuesta de cambios",
    1
   ],
   [
    "Hero sin opacity 0 en los textos principales: el LCP de la guía dejó de depender de la animación; lo no crítico se difiere a después de la primera pintura",
    1
   ],
   [
    "DOM por pantalla real por debajo de 1.500 elementos y LCP «bueno» en el storefront, medidos en CI",
    0
   ],
   [
    "Tarjeta de salud ejecutada en cada PR (Playwright) con umbral que bloquee el merge",
    0
   ]
  ]
 ],
 [
  "Temas, tokens y verificación en vivo",
  "wand-sparkles",
  [
   [
    "Exportación de tokens (CSS, preset de Tailwind y JSON de Design Tokens) leída de los valores reales de la página",
    1
   ],
   [
    "Auditor de accesibilidad sobre el DOM real: nombres, etiquetas, ids, referencias ARIA, títulos, landmarks y contraste de cada texto visible",
    1
   ],
   [
    "Core Web Vitals (LCP, INP, CLS, FCP) medidos en vivo y tabla de estado de los componentes",
    1
   ],
   [
    "Ayuda de atajos de teclado (?)",
    1
   ],
   [
    "Pipeline que consuma tokens.json (p. ej. Style Dictionary) y genere el CSS y el preset de los 3 frontends",
    0
   ],
   [
    "Mismas reglas del auditor ejecutadas con axe y Playwright en CI, con la columna «Pruebas» de la tabla de componentes en verde",
    0
   ]
  ]
 ],
 [
  "Gráficos y datos",
  "chart-column",
  [
   [
    "Paleta categórica de 8 series validada por script en claro y oscuro contra las superficies del sistema (ΔE, luminosidad, contraste)",
    1
   ],
   [
    "Tarjetas de métrica (cifra principal, variación, minigráfico), línea, columnas apiladas, barras, mapa de calor y medidores con las marcas finas de la guía",
    1
   ],
   [
    "Cada gráfico: leyenda que aísla series, tooltip que también abre con teclado, tabla gemela, resumen para lectores de pantalla y colores por entidad (no por posición)",
    1
   ],
   [
    "Un filtro de rango que escopa todo el panel y conserva el marco al recargar; exportación a CSV",
    1
   ],
   [
    "Patrones 45°/135° opt-in (ajuste, impresión y colores forzados) y animaciones que se apagan con movimiento reducido",
    1
   ],
   [
    "Componentes de gráficos en @real/ui sobre una librería (p. ej. visx o Recharts) con estos mismos tokens y reglas",
    0
   ],
   [
    "Pruebas de contraste y de CVD de la paleta de gráficos en CI al cambiar un token",
    0
   ]
  ]
 ],
 [
  "Errores y estados del sistema",
  "triangle-alert",
  [
   [
    "Anatomía única (emblema, qué pasó, qué hacer, acciones, ayuda contextual) que se adapta por contenedor en compact, medium y expanded",
    1
   ],
   [
    "9 escenarios: 404, 403, 401, 429 con cuenta atrás, 500 con ID copiable, 503 con ETA, sin conexión, tiempo agotado y pago rechazado",
    1
   ],
   [
    "Patrones dentro de la pantalla: error en un bloque, banner de conexión real, sesión expirada y carga lenta",
    1
   ],
   [
    "Guía de textos, 10 reglas (código HTTP real, noindex, sin trazas, foco al título) y contraste AA en los 3 tonos",
    1
   ],
   [
    "Implementar not-found.tsx, error.tsx y global-error.tsx con este diseño en los 3 frontends",
    0
   ],
   [
    "ID de error (request-id) propagado desde el backend, visible en el 500 y buscable en el monitoreo",
    0
   ],
   [
    "Modo mantenimiento activable con ETA y página 503 servida por el CDN",
    0
   ]
  ]
 ],
 [
  "Referencia y verificación",
  "shield-check",
  [
   [
    "Preview con ver/copiar HTML, búsqueda Ctrl/⌘ K, mapa de teclado y guía de contenido es-LA",
    1
   ],
   [
    "Props y variantes de todos los componentes (Storybook o similar)",
    0
   ],
   [
    "Pruebas visuales por clase de tamaño y tema",
    0
   ],
   [
    "Test automático de contraste y de áreas táctiles que falle el build",
    0
   ],
   [
    "Componentes React (cva) publicados con las mismas clases que este archivo",
    0
   ]
  ]
 ]
] as unknown as readonly GuideGroup[]
