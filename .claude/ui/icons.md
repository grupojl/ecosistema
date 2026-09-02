# Íconos

## Set principal: Lucide React

El ecosistema usa exclusivamente `lucide-react` como set de íconos.
Ya está instalado en el catalog de pnpm — no se instala otra librería de íconos.

```tsx
import { ShoppingCart, Users, Settings, AlertCircle } from 'lucide-react'
```

Explorador de íconos disponibles: https://lucide.dev/icons/

## Tamaños estándar

| Contexto | Tamaño | Clase Tailwind |
|---|---|---|
| Ícono inline en texto | 14px | `h-3.5 w-3.5` |
| Ícono en botón sm | 14px | `h-3.5 w-3.5` |
| Ícono en botón default | 16px | `h-4 w-4` |
| Ícono en botón lg | 18px | `h-4.5 w-4.5` |
| Ícono standalone en lista | 18px | `h-[18px] w-[18px]` |
| Ícono de estado (empty state) | 40–48px | `h-10 w-10` o `h-12 w-12` |
| Ícono hero / ilustración | 64px+ | `h-16 w-16` |

## Íconos semánticos fijos (no cambiar)

Estos íconos tienen un significado establecido en el ecosistema.
Cambiarlos genera inconsistencia visual.

| Ícono | Uso | Componente Lucide |
|---|---|---|
| Organización / empresa | Módulo de orgs | `Building2` |
| Colaboradores / equipo | Módulo de collaborators | `Users` |
| Configuración | Config, settings | `Settings` |
| Perfil de usuario | Avatar sin foto | `User` |
| Pedidos | Órdenes | `ShoppingBag` o `Package` |
| Carrito | Cart | `ShoppingCart` |
| Catálogo / productos | Listado de productos | `LayoutGrid` |
| Stock | Inventario | `Boxes` |
| Error / alerta crítica | Error state | `AlertCircle` |
| Advertencia | Warning | `AlertTriangle` |
| Éxito / check | Confirmación | `CheckCircle` o `Check` |
| Editar | Botón de edición | `Pencil` o `Edit` |
| Eliminar | Botón destructivo | `Trash2` |
| Copiar | Copy to clipboard | `Copy` |
| Copiado (feedback) | Después de copiar | `Check` |
| Volver | Back navigation | `ChevronLeft` |
| Más opciones | Kebab menu | `MoreVertical` |
| Cerrar / X | Cerrar modal | `X` |
| Buscar | Search input | `Search` |
| Cargar / spinner | Loading state | `Loader2` con `animate-spin` |
| Seguridad / clave | Secrets | `ShieldCheck` o `KeyRound` |
| Webhook | Webhooks | `Webhook` |
| Link / URL | Links externos | `Link` o `ExternalLink` |
| Afiliado / referido | Affiliate | `Star` o `Gift` |
| Auditoría / historial | Audit logs | `History` o `ClipboardList` |

## Reglas de uso

- Todos los íconos en botones van **a la izquierda del texto** (salvo el de navegación "ir a" que va a la derecha)
- El spinner de carga siempre es `<Loader2 className="animate-spin" />`
- Los íconos de estado vacío (empty state) van centrados con `mx-auto` y color `text-muted-foreground`
- Nunca usar íconos rellenos y de contorno mezclados en la misma pantalla

## Íconos no usar

- ❌ Emojis como íconos de UI (solo en contenido generado por el usuario)
- ❌ `react-icons` u otras librerías — solo `lucide-react`
- ❌ Íconos SVG inline pegados en el JSX — usar siempre el componente de Lucide
