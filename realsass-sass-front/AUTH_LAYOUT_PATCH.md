# Cambios manuales requeridos en app/layout.tsx

## 1. Agregar al inicio del archivo
```tsx
import '@/lib/firebase'; // inicializa Firebase antes del AuthProvider
```

## 2. Actualizar AuthProvider con la prop sassBackUrl
```tsx
// ANTES:
<AuthProvider>{children}</AuthProvider>

// DESPUES:
<AuthProvider sassBackUrl={process.env.NEXT_PUBLIC_API_URL!}>
  {children}
</AuthProvider>
```
