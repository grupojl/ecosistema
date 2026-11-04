/**
 * Configuración general de una organización (municipio) y de su storefront público.
 *
 * Dos documentos por organización, guardados como JSON y validados SIEMPRE con estos esquemas (ni al leer ni al escribir se
 * confía en lo guardado):
 *   · `general`    — cómo opera la organización: zona horaria, idioma, horario de atención, contacto y el asistente de chat.
 *   · `storefront` — lo que ve el público: marca, SEO, redes, enlaces legales, aviso destacado, qué contacto se muestra y
 *                    el chat web (con los dominios autorizados a incrustarlo).
 *
 * Todo campo tiene un valor por defecto: `GeneralSettingsSchema.parse({})` es una configuración válida y completa.
 * Un campo de texto vacío ('') significa «sin definir» (así los formularios no mezclan null con string).
 */
import { z } from 'zod';

export const LOCALES = ['es', 'pt', 'en', 'fr', 'de'] as const;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const text = (max: number, fallback = '') => z.string().trim().max(max).default(fallback);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora con formato HH:MM');

/** Solo http(s): nunca `javascript:` ni `data:` en un enlace que el público va a abrir. */
const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Debe empezar con http:// o https://')
  .default('');

const email = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || z.email().safeParse(v).success, 'Correo inválido')
  .default('');

const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === '' || /^[+\d][\d\s().-]{5,}$/.test(v), 'Teléfono inválido')
  .default('');

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const timezone = z
  .string()
  .max(64)
  .refine(isValidTimeZone, 'Zona horaria desconocida')
  .default('America/Argentina/Buenos_Aires');

// ── General ──────────────────────────────────────────────────────────────────

const DaySchema = z
  .object({
    open: z.boolean().default(true),
    from: hhmm.default('09:00'),
    to: hhmm.default('17:00'),
  })
  .refine((d) => !d.open || d.from < d.to, { message: 'El cierre debe ser posterior a la apertura', path: ['to'] });

const weekday = DaySchema.prefault({});
const weekend = DaySchema.prefault({ open: false });

export const HoursSchema = z.object({
  /** `always` = atención sin horario (24/7); `schedule` = según la grilla semanal. */
  mode: z.enum(['always', 'schedule']).default('schedule'),
  weekly: z
    .object({ mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: weekend, sun: weekend })
    .prefault({}),
  note: text(300),
});

export const AssistantSchema = z.object({
  enabled: z.boolean().default(true),
  name: text(60, 'Asistente'),
  welcomeMessage: text(500, 'Hola, soy el asistente virtual. ¿En qué puedo ayudarte?'),
  outOfHoursMessage: text(500, 'Estamos fuera del horario de atención. Te respondemos el próximo día hábil.'),
  /** Cuando no hay información cargada para responder: se admite no saber y se deriva a una persona. */
  fallbackMessage: text(500, 'No tengo esa información. Te derivo con una persona del área.'),
  disclaimer: text(300, 'Soy un asistente automático: la información puede requerir confirmación.'),
  /** Solo responde con el contenido cargado por la organización (no inventa datos oficiales). */
  answerOnlyFromContent: z.boolean().default(true),
  handoffEmail: email,
});

export const GeneralSettingsSchema = z.object({
  timezone,
  defaultLocale: z.enum(LOCALES).default('es'),
  contact: z.object({ publicEmail: email, emergencyPhone: phone }).prefault({}),
  hours: HoursSchema.prefault({}),
  assistant: AssistantSchema.prefault({}),
});
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

// ── Storefront ───────────────────────────────────────────────────────────────

/** Origen exacto (esquema + host [+ puerto]), sin ruta. http solo para localhost. */
const origin = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(
    /^(https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?|http:\/\/localhost(:\d{1,5})?)$/,
    'Debe ser un origen como https://www.ejemplo.gob.ar (sin barra ni ruta)',
  );

export const StorefrontSettingsSchema = z.object({
  brand: z.object({ publicName: text(80), tagline: text(120) }).prefault({}),
  seo: z.object({ title: text(70), description: text(160) }).prefault({}),
  social: z
    .object({ instagram: httpUrl, facebook: httpUrl, x: httpUrl, youtube: httpUrl, linkedin: httpUrl, tiktok: httpUrl })
    .prefault({}),
  legal: z.object({ termsUrl: httpUrl, privacyUrl: httpUrl, returnsUrl: httpUrl }).prefault({}),
  announcement: z
    .object({ enabled: z.boolean().default(false), text: text(200), linkUrl: httpUrl, linkLabel: text(40) })
    .refine((a) => !a.enabled || a.text !== '', { message: 'Escribí el texto del aviso', path: ['text'] })
    .prefault({}),
  display: z
    .object({
      showEmail: z.boolean().default(true),
      showEmergencyPhone: z.boolean().default(true),
      showHours: z.boolean().default(true),
    })
    .prefault({}),
  webChat: z
    .object({
      enabled: z.boolean().default(false),
      position: z.enum(['right', 'left']).default('right'),
      greeting: text(200),
      /** Sitios autorizados a incrustar el chat web de esta organización. */
      allowedOrigins: z
        .array(origin)
        .max(20)
        .default([])
        .transform((list) => [...new Set(list)]),
    })
    .prefault({}),
});
export type StorefrontSettings = z.infer<typeof StorefrontSettingsSchema>;

/** Lo que cualquiera puede leer del storefront: sin dominios autorizados ni mensajes internos del asistente. */
export interface PublicStorefrontSettings {
  brand: StorefrontSettings['brand'];
  seo: StorefrontSettings['seo'];
  social: StorefrontSettings['social'];
  legal: StorefrontSettings['legal'];
  announcement: StorefrontSettings['announcement'] | null;
  display: StorefrontSettings['display'];
  webChat: { enabled: boolean; position: 'right' | 'left'; greeting: string };
  /** Solo lo que la organización decidió mostrar (`display`); lo demás llega vacío o null. */
  contact: { email: string; emergencyPhone: string; hours: GeneralSettings['hours'] | null };
  locale: GeneralSettings['defaultLocale'];
  timezone: string;
}
