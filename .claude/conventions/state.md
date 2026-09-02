# Convención: estado del cliente — Zustand vs TanStack Query

## Regla de oro

**Si el dato viene del servidor → TanStack Query.**
**Si el dato es sobre la UI → Zustand.**

No hay excepciones. Si dudás, preguntá: "¿Este valor cambiaría si recargo la página?"
Si sí → TanStack. Si no importa → Zustand.

## TanStack Query — datos de servidor

Todo lo que viene de una llamada tRPC o fetch vive en TanStack Query con
una `queryKey` explícita. Nunca en estado local de componente ni en Zustand.

```ts
// ✅ CORRECTO — dato de servidor en TanStack Query
const { data: products } = trpc.adminCatalog.list.useQuery({ organizationId })

// ❌ PROHIBIDO — dato de servidor en useState
const [products, setProducts] = useState([])
useEffect(() => { fetch('/api/products').then(setProducts) }, [])

// ❌ PROHIBIDO — dato de servidor en Zustand
const useProductsStore = create((set) => ({
  products: [],
  fetchProducts: async () => { ... set({ products }) }
}))
```

### Reglas de queryKey

- Una queryKey por entidad + parámetros que la identifican
- Invalidar la queryKey exacta en cada mutation relacionada
- `staleTime` según frecuencia de cambio:
  - Configuración de org (flags, themes): `staleTime: 5 * 60 * 1000` (5 min)
  - Datos de negocio (productos, pedidos): `staleTime: 60 * 1000` (1 min)
  - Perfil del usuario: `staleTime: 10 * 60 * 1000` (10 min)
  - Datos en tiempo real: `staleTime: 0`

## Zustand — estado de UI puro

Solo estado que NO viene del servidor y NO necesita sincronizarse con él.

```ts
// ✅ CORRECTO — estado de UI puro
const useShoppingBagStore = create((set) => ({
  isOpen: false,
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
}))

// ✅ CORRECTO — preferencia de UI (con persist si debe sobrevivir recarga)
const useSidebarStore = create(
  persist(
    (set) => ({ isCollapsed: false, toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })) }),
    { name: 'sidebar-state' }
  )
)

// ❌ PROHIBIDO — dato de servidor en Zustand
const useCartStore = create((set) => ({
  items: [],        // ← esto viene del servidor (cart.get)
  total: 0,         // ← esto viene del servidor
  fetchCart: ...    // ← esto es un fetch, va en TanStack Query
}))
```

### Casos válidos para Zustand

| Estado | Store | Por qué Zustand |
|--------|-------|-----------------|
| Modal open/close | `useShoppingBagStore` | No viene del servidor |
| Sidebar collapsed | `useSidebarStore` | Preferencia de UI local |
| Login modal visible | `useUIStore` | Estado de UI transitorio |
| Tab activo en una página | local `useState` | Tan local que ni store necesita |

### Casos que PARECEN Zustand pero son TanStack

| ❌ Tentación | ✅ Correcto |
|---|---|
| `cartItems` en un store | `trpc.customer.cart.get.useQuery()` |
| `userProfile` en un store | `trpc.auth.me.useQuery()` |
| `activeOrganization` en un store | viene del `TenantContext` → `useAuth()` |
| `featureFlags` en un store | `trpc.configFlags.list.useQuery()` |

## Detector de violaciones

Un campo en un store de Zustand que también existe en una queryKey es un bug:
```bash
# Buscar campos potencialmente duplicados
grep -r "create(" --include="*.ts" ./*-front/stores/
# Comparar contra las queryKeys del mismo front
grep -r "useQuery\|useMutation" --include="*.ts" ./*-front/hooks/
```

En S4: ESLint rule `@real/no-server-data-in-zustand` detecta esto automáticamente.
