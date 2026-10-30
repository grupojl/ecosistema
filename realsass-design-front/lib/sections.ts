import {
  Accessibility, BarChart3, Bell, Boxes, Compass, FileInput, Layers, LayoutPanelTop, LogIn, Palette, PenLine,
  ShieldCheck, Smartphone, Sparkles, SwatchBook, TriangleAlert, type LucideIcon,
} from 'lucide-react'

export interface DesignSection {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

export interface SectionGroup {
  label: string
  sections: readonly DesignSection[]
}

/** Secciones del sistema de diseño (espejo de `.claude/domain/welver.html`). Cada una es una ruta. */
export const GROUPS: readonly SectionGroup[] = [
  {
    label: 'Referencia',
    sections: [
      { id: 'norte', label: 'Norte UI/UX', description: 'Los 6 pilares, prioridad por front, anti-patrones y auditor táctil.', icon: Compass },
      { id: 'fundamentos', label: 'Fundamentos', description: 'Tipografía, paleta, espaciado, radios, capas e iconos.', icon: Palette },
      { id: 'accesibilidad', label: 'Accesibilidad', description: 'Contraste AA en vivo, teclado, auditor y Core Web Vitals.', icon: Accessibility },
      { id: 'motion', label: 'Motion', description: 'Duraciones, curvas, patrones y reglas de movimiento.', icon: Sparkles },
      { id: 'responsive', label: 'Responsive', description: 'Las 3 clases de tamaño y la vista previa por dispositivo.', icon: Smartphone },
    ],
  },
  {
    label: 'Componentes',
    sections: [
      { id: 'componentes', label: 'Componentes', description: 'Botones, campos, tablas, tarjetas, tabs y pasos de @real/ui.', icon: Boxes },
      { id: 'formularios', label: 'Formularios', description: 'Validación, controles, archivos y flujos por pasos.', icon: FileInput },
      { id: 'modales', label: 'Modales', description: 'Un primitivo, seis tipos; la presentación cambia con la clase de tamaño.', icon: LayoutPanelTop },
      { id: 'avisos', label: 'Avisos', description: 'Toasts, alertas en línea, banners, notificaciones y progreso.', icon: Bell },
      { id: 'estados', label: 'Estados', description: 'Cargando, vacío, error y sin permisos de toda vista con datos.', icon: Layers },
      { id: 'errores', label: 'Errores', description: 'Páginas de error del sistema y patrones que las acompañan.', icon: TriangleAlert },
      { id: 'login', label: 'Inicio de sesión', description: 'Modal mínimo con proveedores, sin campos.', icon: LogIn },
      { id: 'graficos', label: 'Gráficos', description: 'Paleta validada, forma según el trabajo y tabla gemela.', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    sections: [
      { id: 'temas', label: 'Temas y tokens', description: 'Exportar los tokens como CSS, preset de Tailwind o JSON.', icon: SwatchBook },
      { id: 'contenido', label: 'Contenido', description: 'Guía de voz y formatos es-LA.', icon: PenLine },
      { id: 'gobierno', label: 'Gobierno', description: 'Salud en vivo, definición de «hecho», versionado y guía 10/10.', icon: ShieldCheck },
    ],
  },
]

export const SECTIONS: readonly DesignSection[] = GROUPS.flatMap((g) => g.sections)
