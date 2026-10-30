import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/ui'
import { RuleList } from '@/components/blocks'
import { LOGIN_RULES } from '@/lib/data/system'
import { LoginDemo } from './login-demo'

export const metadata: Metadata = { title: 'Inicio de sesión' }

export default function LoginPage() {
  return (
    <>
      <PageHeader
        title="Inicio de sesión"
        description="El acceso no tiene «crear cuenta» ni contraseñas: proveedores de Firebase Authentication (Google, Microsoft, Apple, GitHub) o un código de 6 dígitos por correo. La primera vez que alguien entra, la cuenta se crea sola."
      />
      <section className="space-y-3">
        <SectionHeader title="Modal y página completa" description="Prueba los proveedores, el flujo con código por correo (el código es 123456) y simula errores de Firebase. Es una demostración: no se conecta a Firebase." />
        <LoginDemo />
      </section>
      <section className="space-y-3">
        <SectionHeader title="Anatomía" size="sm" />
        <ol className="space-y-1 text-sm text-muted-foreground">
          <li><b className="text-foreground">1 Marca y mensaje:</b> el logo, un título y una línea que explica que la cuenta se crea sola.</li>
          <li><b className="text-foreground">2 Proveedores:</b> apilados a ancho completo (objetivo de 46 px).</li>
          <li><b className="text-foreground">3 Conectando:</b> el botón pulsado muestra el indicador y el resto se deshabilita; un solo intento a la vez.</li>
          <li><b className="text-foreground">4 Errores sin culpa:</b> un aviso arriba, traducido desde auth/*. Cerrar la ventana del proveedor no es un error.</li>
          <li><b className="text-foreground">5 Legal discreto:</b> términos y privacidad en una línea al pie.</li>
        </ol>
      </section>
      <section className="space-y-3">
        <SectionHeader title="Reglas" size="sm" />
        <RuleList items={LOGIN_RULES} />
      </section>
    </>
  )
}
