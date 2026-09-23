/**
 * stores/use-locale-store.ts — real-ecommerce-front
 *
 * Recuerda el último idioma que el visitante navegó en /[locale]/tienda/...
 * para que checkout() (que hoy vive fuera de las rutas con idioma, en
 * app/(site)/checkout) pueda mandarlo al backend sin depender de la URL.
 *
 * sessionStorage, no localStorage: el idioma "recordado" es de la sesión de
 * compra actual, no una preferencia permanente (esa es la cookie NEXT_LOCALE
 * del selector explícito — ver lib/i18n/config.ts). No se testea a nivel
 * store (Zustand + sessionStorage necesita jsdom); la decisión que sí
 * importa testear vive en lib/checkout/resolve-checkout-locale.ts, puro.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LocaleMemoryState {
  locale:    string | null
  setLocale: (locale: string) => void
}

export const useLocaleStore = create<LocaleMemoryState>()(
  persist(
    (set) => ({
      locale: null,
      setLocale: (locale: string) => set({ locale }),
    }),
    {
      name: 'welver_locale_memory',
      storage: typeof window !== 'undefined'
        ? {
            getItem:    (key: string) => {
              const raw = sessionStorage.getItem(key)
              return raw ? JSON.parse(raw) : null
            },
            setItem:    (key: string, value: unknown) => sessionStorage.setItem(key, JSON.stringify(value)),
            removeItem: (key: string) => sessionStorage.removeItem(key),
          }
        : undefined,
    },
  ),
)
