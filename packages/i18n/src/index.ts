/**
 * @real/i18n — idioma compartido de los paneles. Ver config.ts para el porqué (cookie, no URL).
 * Lo que usa el servidor (next/headers) vive aparte en `@real/i18n/server`.
 */
export * from './config';
export * from './negotiate';
export * from './format';
export * from './messages';
export { LocaleSwitcher, type LocaleSwitcherProps } from './locale-switcher';
export { I18nProvider, useLocale, useMessages, useIntlLocale, useSetLocale, type I18nProviderProps } from './react';
export * from './login-messages';
