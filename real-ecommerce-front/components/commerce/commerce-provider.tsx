'use client'

/**
 * CommerceProvider — sesión del cliente (Firebase), bolsa y cliente tRPC de UNA tienda (ADR-021).
 *
 * Va en el layout de /{locale}/{slug}. El cliente existe dentro de su ecosistema (proyecto Firebase) y de ESTA
 * organización: cada request lleva `Authorization: Bearer <ID token>` + `x-organization-id`, y el back deriva el
 * cliente de ahí. El carrito se guarda por organización en localStorage (lib/commerce/storage.ts).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc, createStoreTrpcClient } from '@/lib/trpc/client'
import { getDictionary, intlLocale, type Dictionary } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/config'
import { cartKey, sessionKey, newSessionId, type CustomerSession } from '@/lib/commerce/storage'
import { currentIdToken, isFirebaseConfigured, signInWithGoogle, signOutCustomer, watchCustomer } from '@/lib/commerce/firebase'

interface CommerceContextValue {
  organizationId: string
  storeName:      string
  locale:         Locale
  dict:           Dictionary
  /** Etiqueta para Intl (idioma + país de la tienda), p. ej. 'es-AR'. */
  intlTag:        string
  /** /{locale}/{slug} */
  basePath:       string
  /** null = sin ingresar. `ready` distingue "todavía leyendo la sesión de Firebase" de "no hay cliente". */
  customer:       CustomerSession | null
  ready:          boolean
  sessionId:      string
  cartId:         string | null
  setCartId:      (id: string | null) => void
  /** Abre Google. Resuelve cuando termina; el cliente aparece en `customer` por la observación de Firebase. */
  signIn:         () => Promise<void>
  signOut:        () => Promise<void>
  /** El ingreso no se puede usar (faltan las variables de Firebase). */
  authUnavailable: boolean
  authError:      boolean
  authOpen:       boolean
  openAuth:       () => void
  closeAuth:      () => void
  /** Panel del avatar abierto (cuenta + bolsa + pedidos). */
  panel:          boolean
  setPanel:       (open: boolean) => void
}

const CommerceContext = createContext<CommerceContextValue | null>(null)

export function useCommerce(): CommerceContextValue {
  const ctx = useContext(CommerceContext)
  if (!ctx) throw new Error('useCommerce debe usarse dentro de <CommerceProvider>')
  return ctx
}

function read(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch { /* storage bloqueado: queda solo en memoria */ }
}

interface Props {
  organizationId: string
  storeName:      string
  countryCode:    string
  slug:           string
  locale:         Locale
  children:       ReactNode
}

export function CommerceProvider({ organizationId, storeName, countryCode, slug, locale, children }: Props) {
  const [customer, setCustomer] = useState<CustomerSession | null>(null)
  const [cartId, setCartIdState] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [ready, setReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [panel, setPanel] = useState(false)

  const orgRef = useRef(organizationId)
  orgRef.current = organizationId

  // Sesión de Firebase: aparece/desaparece sola (también al volver a la pestaña o renovar el token).
  useEffect(() => watchCustomer((user) => {
    setCustomer(user && user.email
      ? { uid: user.uid, email: user.email, name: user.displayName, photoUrl: user.photoURL }
      : null)
    setReady(true)
  }), [])

  // Carrito y sessionId de ESTA tienda.
  useEffect(() => {
    setCartIdState(read(cartKey(organizationId)))
    let sid = read(sessionKey(organizationId))
    if (!sid) { sid = newSessionId(); write(sessionKey(organizationId), sid) }
    setSessionId(sid)
  }, [organizationId])

  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
  }))
  const [trpcClient] = useState(() => createStoreTrpcClient({
    getOrganizationId: () => orgRef.current,
    getIdToken:        currentIdToken,
  }))

  const setCartId = useCallback((id: string | null) => {
    setCartIdState(id)
    write(cartKey(orgRef.current), id)
  }, [])

  const signIn = useCallback(async () => {
    setAuthError(false)
    try {
      await signInWithGoogle()
      setAuthOpen(false)
      void queryClient.invalidateQueries()
    } catch (err) {
      const code = (err as { code?: string }).code
      // Cerrar la ventana de Google no es un error del usuario.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      setAuthError(true)
    }
  }, [queryClient])

  const signOut = useCallback(async () => {
    await signOutCustomer()
    setCartIdState(null)
    write(cartKey(orgRef.current), null)
    setPanel(false)
    queryClient.clear() // nada del cliente anterior queda en memoria
  }, [queryClient])

  const value = useMemo<CommerceContextValue>(() => ({
    organizationId, storeName, locale, dict: getDictionary(locale),
    intlTag: intlLocale(locale, countryCode), basePath: `/${locale}/${slug}`,
    customer, ready, sessionId, cartId, setCartId, signIn, signOut,
    authUnavailable: !isFirebaseConfigured(), authError,
    authOpen, openAuth: () => { setPanel(false); setAuthError(false); setAuthOpen(true) }, closeAuth: () => setAuthOpen(false),
    panel, setPanel,
  }), [organizationId, storeName, countryCode, slug, locale, customer, ready, sessionId, cartId, setCartId, signIn, signOut, authError, authOpen, panel])

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
