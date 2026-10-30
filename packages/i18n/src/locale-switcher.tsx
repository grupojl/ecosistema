'use client';

/**
 * LocaleSwitcher — selector de idioma listo para usar en cualquier panel. La pieza visual es `LanguageSwitcher`
 * de @real/ui; acá solo se cablea con el idioma real (cookie + refresco, ver useSetLocale).
 */
import { LanguageSwitcher } from '@real/ui';
import { LOCALES, LOCALE_NAMES, isLocale } from './config';
import { useLocale, useSetLocale } from './react';

const OPTIONS = LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }));

export interface LocaleSwitcherProps {
  /** Nombre accesible del selector, ya traducido (p. ej. `d.common.language`). */
  label:    string;
  compact?: boolean;
}

export function LocaleSwitcher({ label, compact }: LocaleSwitcherProps) {
  const locale    = useLocale();
  const setLocale = useSetLocale();
  return (
    <LanguageSwitcher
      value={locale}
      options={OPTIONS}
      label={label}
      compact={compact}
      onChange={(v) => { if (isLocale(v)) setLocale(v); }}
    />
  );
}
