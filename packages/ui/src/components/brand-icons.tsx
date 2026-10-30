/**
 * Logos de proveedores de acceso. Son colores de marca de terceros: la única excepción a «solo tokens».
 * Decorativos (`aria-hidden`): el nombre del proveedor va siempre en el texto del botón.
 */
const base = "size-5 shrink-0"

export function GoogleIcon({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.55c2.08-1.91 3.28-4.73 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.55-2.75c-.98.66-2.24 1.05-3.73 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.83 14.08a6.6 6.6 0 0 1 0-4.16V7.08H2.17a11 11 0 0 0 0 9.84l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.08l3.66 2.84C6.7 7.31 9.13 5.38 12 5.38Z" />
    </svg>
  )
}

export function MicrosoftIcon({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" /><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" /><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}

export function GithubIcon({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

export function AppleIcon({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M16.37 12.6c-.02-2.18 1.78-3.23 1.86-3.28-1.01-1.48-2.59-1.69-3.15-1.71-1.34-.14-2.62.79-3.3.79-.68 0-1.73-.77-2.84-.75-1.46.02-2.8.85-3.55 2.16-1.52 2.63-.39 6.52 1.09 8.65.72 1.04 1.58 2.21 2.7 2.17 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.68.7 2.83.68 1.17-.02 1.9-1.06 2.61-2.11.82-1.2 1.16-2.37 1.18-2.43-.03-.01-2.26-.87-2.25-3.47ZM14.2 6.2c.6-.73 1-1.74.89-2.75-.86.04-1.9.57-2.52 1.3-.55.64-1.04 1.67-.91 2.66.96.07 1.94-.49 2.54-1.21Z" />
    </svg>
  )
}

export function FacebookIcon({ className = base }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.45 18.63.07 12 .07S0 5.45 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.06 24 12.07Z" />
    </svg>
  )
}
