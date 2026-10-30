/** Páginas de error del sistema (welver.html → «Errores»). `icon` y `primary[1]` son nombres lucide en kebab-case. */
export type ErrorTone = 'info' | 'warning' | 'danger'
export interface SystemError {
  tab: string; tone: ErrorTone; code?: string; bigIcon?: string; icon: string; eyebrow: string; title: string; text: string
  primary: readonly [label: string, icon: string]; secondary?: readonly [label: string, icon: string]
  extra?: 'search' | 'role' | 'saved' | 'id' | 'eta' | 'decline' | 'countdown'
}

export const ERRORS = {
 "401": {
  "tab": "401",
  "tone": "info",
  "code": "401",
  "icon": "key-round",
  "eyebrow": "Sesión expirada",
  "title": "Tu sesión terminó",
  "text": "Por seguridad cerramos la sesión tras un rato sin actividad. Inicia sesión y volverás exactamente donde estabas.",
  "primary": [
   "Iniciar sesión",
   "log-in"
  ],
  "secondary": [
   "Ir al inicio",
   "home"
  ],
  "extra": "saved"
 },
 "403": {
  "tab": "403",
  "tone": "warning",
  "code": "403",
  "icon": "lock",
  "eyebrow": "Error 403 · Sin permiso",
  "title": "No tienes acceso a esta sección",
  "text": "Tu rol actual no incluye Reportes. Pide acceso al propietario de la tienda.",
  "primary": [
   "Solicitar acceso",
   "mail"
  ],
  "secondary": [
   "Volver al panel",
   "layout-dashboard"
  ],
  "extra": "role"
 },
 "404": {
  "tab": "404",
  "tone": "info",
  "code": "404",
  "icon": "compass",
  "eyebrow": "Error 404 · No encontramos la página",
  "title": "Esta página se perdió en el camino",
  "text": "El enlace puede estar roto o la página ya no existe. Tus datos y tu sesión siguen intactos.",
  "primary": [
   "Ir al inicio",
   "home"
  ],
  "secondary": [
   "Volver atrás",
   "arrow-left"
  ],
  "extra": "search"
 },
 "429": {
  "tab": "429",
  "tone": "warning",
  "code": "429",
  "icon": "gauge",
  "eyebrow": "Error 429 · Demasiadas solicitudes",
  "title": "Vas muy rápido",
  "text": "Hiciste muchas solicitudes seguidas. Espera unos segundos y vuelve a intentarlo.",
  "primary": [
   "Reintentar",
   "rotate-ccw"
  ],
  "extra": "countdown"
 },
 "500": {
  "tab": "500",
  "tone": "danger",
  "code": "500",
  "icon": "bug",
  "eyebrow": "Error 500 · Algo falló de nuestro lado",
  "title": "Tuvimos un problema",
  "text": "No fue tu culpa y ya avisamos al equipo. Puedes reintentar; tus datos están a salvo.",
  "primary": [
   "Reintentar",
   "rotate-ccw"
  ],
  "secondary": [
   "Ir al inicio",
   "home"
  ],
  "extra": "id"
 },
 "503": {
  "tab": "503",
  "tone": "warning",
  "code": "503",
  "icon": "wrench",
  "eyebrow": "Mantenimiento programado",
  "title": "Volvemos en unos minutos",
  "text": "Estamos mejorando la plataforma. Tus pedidos y tu catálogo no se tocan.",
  "primary": [
   "Avisarme cuando vuelva",
   "bell"
  ],
  "secondary": [
   "Ver estado del servicio",
   "activity"
  ],
  "extra": "eta"
 },
 "offline": {
  "tab": "Sin conexión",
  "tone": "warning",
  "bigIcon": "wifi-off",
  "icon": "cloud-off",
  "eyebrow": "Sin conexión",
  "title": "Parece que te quedaste sin internet",
  "text": "Revisa tu conexión. Lo que hiciste se guardó en este dispositivo y se enviará cuando vuelvas.",
  "primary": [
   "Reintentar",
   "rotate-ccw"
  ],
  "secondary": [
   "Ver lo guardado",
   "database"
  ]
 },
 "timeout": {
  "tab": "Tiempo agotado",
  "tone": "warning",
  "code": "408",
  "icon": "hourglass",
  "eyebrow": "Error 408 · Tiempo de espera agotado",
  "title": "Está tardando más de lo normal",
  "text": "El servidor no respondió a tiempo. Puede ser algo pasajero.",
  "primary": [
   "Reintentar",
   "rotate-ccw"
  ],
  "secondary": [
   "Cancelar",
   "x"
  ],
  "extra": "id"
 },
 "pago": {
  "tab": "Pago",
  "tone": "danger",
  "code": "402",
  "icon": "credit-card",
  "eyebrow": "Pago no procesado",
  "title": "Tu banco rechazó el pago",
  "text": "No se hizo ningún cobro. Prueba con otra tarjeta o elige otro medio de pago.",
  "primary": [
   "Probar con otra tarjeta",
   "credit-card"
  ],
  "secondary": [
   "Elegir otro medio",
   "wallet"
  ],
  "extra": "decline"
 }
} as const satisfies Record<string, SystemError>

export type ErrorKey = keyof typeof ERRORS
