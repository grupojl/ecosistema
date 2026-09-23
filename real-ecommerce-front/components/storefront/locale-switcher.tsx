'use client';

import { usePathname } from 'next/navigation';
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  isLocale,
  type Locale,
} from '@/lib/i18n/config';

const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  es: 'Español',
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
};

/** Reemplaza el primer segmento (/es/...) por el idioma destino. */
export function swapLocaleInPath(pathname: string, target: Locale): string {
  const segments = pathname.split('/');
  if (isLocale(segments[1])) {
    segments[1] = target;
    return segments.join('/');
  }
  return `/${target}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

interface LocaleSwitcherProps {
  current: Locale;
  label:   string;
}

/**
 * La elección explícita se persiste en cookie → gana sobre Accept-Language
 * y país en futuras visitas (patrón Airbnb/Booking). Es un <a> real con
 * hrefLang: navegable sin JS y descubrible por crawlers.
 */
export function LocaleSwitcher({ current, label }: LocaleSwitcherProps) {
  const pathname = usePathname() ?? '/';

  function persistChoice(locale: Locale): void {
    document.cookie =
      `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  return (
    <nav aria-label={label} className="flex gap-2 text-xs flex-wrap">
      {LOCALES.map((locale) =>
        locale === current ? (
          <span key={locale} aria-current="true" className="font-semibold text-foreground">
            {LOCALE_NAMES[locale]}
          </span>
        ) : (
          <a
            key={locale}
            href={swapLocaleInPath(pathname, locale)}
            hrefLang={locale}
            lang={locale}
            onClick={() => persistChoice(locale)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {LOCALE_NAMES[locale]}
          </a>
        ),
      )}
    </nav>
  );
}
