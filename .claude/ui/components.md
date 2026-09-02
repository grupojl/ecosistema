# Guía de uso de componentes (@real/ui)

Todos los componentes se importan desde `@real/ui`.
Esta guía define cuándo usar cada uno y las reglas de uso en el ecosistema.

## Importación

```tsx
import { Button, Dialog, Avatar, Badge } from '@real/ui'
```

## Componentes disponibles (33)

### Acciones

| Componente | Cuándo usarlo | Variantes disponibles |
|---|---|---|
| `Button` | Toda acción del usuario | `default`, `outline`, `ghost`, `destructive`, `link` |
| `Toggle` | Activar/desactivar una opción visual | `default`, `outline` |
| `ToggleGroup` | Selección exclusiva entre opciones (ej: vista lista/grilla) | — |

**Regla:** el botón de acción principal de una pantalla siempre es `variant="default"`.
El botón de acción destructiva (eliminar, revocar) siempre es `variant="destructive"`.
Nunca usar `variant="link"` para acciones — solo para navegación real.

### Formularios

| Componente | Cuándo usarlo |
|---|---|
| `Input` | Texto libre de una línea |
| `Textarea` | Texto libre multilínea |
| `Select` | Elegir una opción de una lista fija |
| `Checkbox` | Opciones múltiples independientes |
| `RadioGroup` | Opciones excluyentes |
| `Switch` | Activar/desactivar algo con efecto inmediato |
| `Slider` | Valores numéricos dentro de un rango |
| `Label` | Siempre acompañando un campo de formulario |

**Regla:** todo input tiene su `Label` asociado. Sin label no se usa el input solo.

### Feedback y estado

| Componente | Cuándo usarlo |
|---|---|
| `Skeleton` | Mientras carga cualquier dato de servidor |
| `Progress` | Procesos con porcentaje conocido (upload, onboarding) |
| `Alert` | Mensajes de sistema no urgentes, inline en la página |
| `Sonner` (toast) | Confirmaciones de acciones exitosas o errores breves |
| `Badge` | Estado de un elemento (Activo, Pendiente, Archivado) |

**Regla:** usar `Skeleton` en el estado `isLoading`, `Alert` con `variant="destructive"` en el estado `error`.
Los toasts son para acciones completadas — no para errores de formulario (esos van inline).

### Contenedores

| Componente | Cuándo usarlo |
|---|---|
| `Card` | Agrupar información relacionada con borde y padding |
| `Separator` | Separar secciones dentro de un panel |
| `ScrollArea` | Contenido scrolleable con scroll custom |
| `Tabs` | Vistas alternativas del mismo contenido |
| `Collapsible` | Secciones que el usuario puede expandir/contraer |
| `Accordion` | Lista de secciones expandibles (FAQ, config agrupada) |

### Overlays

| Componente | Cuándo usarlo | Mobile |
|---|---|---|
| `Dialog` | Confirmaciones, formularios cortos | Usar `Drawer` en mobile |
| `Drawer` | Panel lateral o inferior en mobile | Nativo |
| `Sheet` | Panel que viene desde el lateral (filtros, detalles) | — |
| `AlertDialog` | Confirmaciones destructivas — no se pueden descartar fácil | — |
| `Popover` | Contenido contextual flotante anclado a un elemento | — |
| `HoverCard` | Preview de información al hacer hover | — |
| `DropdownMenu` | Menú de acciones con ícono o botón disparador | — |

**Regla:** acciones destructivas siempre en `AlertDialog` — nunca en `Dialog` simple.
En mobile, reemplazar `Dialog` por `Drawer` (usar el hook `useIsMobile()` de `@real/ui`).

### Navegación

| Componente | Cuándo usarlo |
|---|---|
| `NavigationMenu` | Navbar principal de una app |
| `Tooltip` | Explicación de un ícono o acción no obvia |
| `Avatar` | Foto o iniciales de un usuario |

### Notificaciones

| Componente | Cuándo usarlo |
|---|---|
| `Sonner` | Toasts de confirmación y error no crítico |

**Regla:** un solo `<Toaster />` en el layout raíz de cada app. No instanciar múltiples.

## Reglas generales

### Estados obligatorios en cualquier componente con datos async

```tsx
// ✅ Siempre los 3 estados
if (isLoading) return <Skeleton className="h-16 rounded-lg" />
if (error)     return <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
return <MiComponente data={data} />
```

### Tamaños estándar

| Contexto | Size prop |
|---|---|
| Botón en tabla o lista densa | `size="sm"` |
| Botón estándar en formulario | `size="default"` |
| Botón hero o CTA principal | `size="lg"` |
| Botón solo con ícono | `size="icon"` |

### Nunca hacer

- ❌ Crear un botón con `<div onClick>` en lugar de `<Button>`
- ❌ Usar colores directos (`text-blue-500`) en lugar de tokens semánticos (`text-primary`)
- ❌ Instanciar componentes shadcn copiando código — siempre importar desde `@real/ui`
