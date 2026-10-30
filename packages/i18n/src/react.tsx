'use client';

/**
 * react.tsx — provider y hooks de idioma para Client Components.
 *
 * El layout (Server Component) negocia el idioma, carga SOLO el diccionario de ese idioma y se lo pasa al provider:
 * el cliente nunca descarga los demás. Mismo patrón que el storefront (diccionario por props, no fetch).
 *
 *   <I18nProvider locale={locale} messages={dictionary}>…</I18nProvider>
 *   const d = useMessages<FrontDictionary>();   →   d.login.title
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS, type Locale } from './config';
import { intlLocale } from './format';

interface I18nContextValue {
  locale:   Locale;
  messages: object;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  locale:   Locale;
  messages: object;
  children: ReactNode;
}

export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale/useMessages deben usarse dentro de <I18nProvider>.');
  return ctx;
}

export function useLocale(): Locale {
  return useI18nContext().locale;
}

/** El diccionario completo del front, tipado por quien lo llama. */
export function useMessages<D extends object>(): D {
  return useI18nContext().messages as D;
}

/** BCP-47 para Intl (fechas, números, moneda): idioma de la interfaz + región opcional de la organización. */
export function useIntlLocale(regionCountryCode?: string | null): string {
  const locale = useLocale();
  return intlLocale(locale, regionCountryCode);
}

/**
 * Cambia el idioma: guarda la cookie (la misma NEXT_LOCALE del storefront) y refresca para que el servidor renderice
 * en el idioma nuevo. Sin recarga completa: el estado del cliente (sesión, formularios) se conserva.
 */
export function useSetLocale(): (locale: Locale) => void {
  const router = useRouter();
  return useCallback((locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    router.refresh();
  }, [router]);
}
