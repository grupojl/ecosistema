'use client';

/**
 * Selector de idioma. Es un `ActionMenu` de @real/ui: hoja de acciones con filas grandes en compact, popover desde medium.
 * Cada idioma es una URL propia (SEO, ADR-016): al elegir se guarda la cookie y se navega a la misma página en ese idioma.
 */
import { usePathname } from 'next/navigation';
import { Check, Globe } from 'lucide-react';
import { ActionMenu, Button } from '@real/ui';
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

export function LocaleSwitcher({ current, label }: LocaleSwitcherProps) {
  const pathname = usePathname() ?? '/';

  function choose(locale: Locale): void {
    document.cookie =
      `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    window.location.assign(swapLocaleInPath(pathname, locale));
  }

  return (
    <ActionMenu
      title={label}
      items={LOCALES.map((locale) => ({
        label: LOCALE_NAMES[locale],
        icon: locale === current ? <Check /> : undefined,
        disabled: locale === current,
        onSelect: () => choose(locale),
      }))}
    >
      <Button variant="ghost" size="sm" aria-label={`${label}: ${LOCALE_NAMES[current]}`}>
        <Globe aria-hidden="true" />
        <span className="uppercase">{current}</span>
      </Button>
    </ActionMenu>
  );
}
