import { OrgSettingsService } from './org-settings.service';
import { GeneralSettingsSchema, StorefrontSettingsSchema } from './org-settings.schema';

function build(stored: { general?: unknown; storefront?: unknown } | null = null) {
  const repo = {
    findByOrg: jest.fn().mockResolvedValue(stored ? { general: stored.general ?? {}, storefront: stored.storefront ?? {}, updatedAt: new Date() } : null),
    saveGeneral: jest.fn().mockResolvedValue(undefined),
    saveStorefront: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn() };
  return { repo, audit, svc: new OrgSettingsService(repo as never, audit as never) };
}

describe('esquemas de configuración', () => {
  it('{} es una configuración válida y completa (todo tiene valor por defecto)', () => {
    const g = GeneralSettingsSchema.parse({});
    expect(g.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(g.defaultLocale).toBe('es');
    expect(g.hours.weekly.mon).toEqual({ open: true, from: '09:00', to: '17:00' });
    expect(g.hours.weekly.sat.open).toBe(false); // fin de semana cerrado por defecto
    expect(g.assistant.answerOnlyFromContent).toBe(true);
    const s = StorefrontSettingsSchema.parse({});
    expect(s.webChat).toEqual({ enabled: false, position: 'right', greeting: '', allowedOrigins: [] });
    expect(s.announcement.enabled).toBe(false);
  });

  it('rechaza zona horaria inválida, hora mal formada y cierre anterior a la apertura', () => {
    expect(GeneralSettingsSchema.safeParse({ timezone: 'Marte/Olympus' }).success).toBe(false);
    expect(GeneralSettingsSchema.safeParse({ hours: { weekly: { mon: { from: '25:00' } } } }).success).toBe(false);
    expect(GeneralSettingsSchema.safeParse({ hours: { weekly: { mon: { from: '18:00', to: '09:00' } } } }).success).toBe(false);
    // un día cerrado no valida el rango
    expect(GeneralSettingsSchema.safeParse({ hours: { weekly: { mon: { open: false, from: '18:00', to: '09:00' } } } }).success).toBe(true);
  });

  it('los enlaces solo admiten http(s): javascript: y data: se rechazan', () => {
    expect(StorefrontSettingsSchema.safeParse({ social: { instagram: 'javascript:alert(1)' } }).success).toBe(false);
    expect(StorefrontSettingsSchema.safeParse({ legal: { termsUrl: 'data:text/html,x' } }).success).toBe(false);
    expect(StorefrontSettingsSchema.safeParse({ social: { instagram: 'https://instagram.com/muni' } }).success).toBe(true);
  });

  it('un aviso activado exige texto', () => {
    expect(StorefrontSettingsSchema.safeParse({ announcement: { enabled: true, text: '' } }).success).toBe(false);
    expect(StorefrontSettingsSchema.safeParse({ announcement: { enabled: true, text: 'Cerrado el lunes' } }).success).toBe(true);
  });

  it('dominios del chat web: solo orígenes https (o localhost), sin ruta, sin duplicados', () => {
    const ok = StorefrontSettingsSchema.parse({ webChat: { allowedOrigins: ['https://www.muni.gob.ar', 'HTTPS://WWW.MUNI.GOB.AR', 'http://localhost:3000'] } });
    expect(ok.webChat.allowedOrigins).toEqual(['https://www.muni.gob.ar', 'http://localhost:3000']);
    for (const bad of ['http://muni.gob.ar', 'https://muni.gob.ar/ruta', 'muni.gob.ar', 'https://*.muni.gob.ar', '*']) {
      expect(StorefrontSettingsSchema.safeParse({ webChat: { allowedOrigins: [bad] } }).success).toBe(false);
    }
  });
});

describe('OrgSettingsService', () => {
  it('get sin nada guardado devuelve los valores por defecto y updatedAt null', async () => {
    const { svc } = build(null);
    const r = await svc.get('org-1');
    expect(r.updatedAt).toBeNull();
    expect(r.general).toEqual(GeneralSettingsSchema.parse({}));
    expect(r.storefront).toEqual(StorefrontSettingsSchema.parse({}));
  });

  it('un documento guardado inválido cae a los valores por defecto (no rompe el panel)', async () => {
    const { svc } = build({ general: { timezone: 'Marte/Olympus' }, storefront: 'basura' });
    const r = await svc.get('org-1');
    expect(r.general.timezone).toBe('America/Argentina/Buenos_Aires');
    expect(r.storefront).toEqual(StorefrontSettingsSchema.parse({}));
  });

  it('updateGeneral valida, guarda el documento completo y audita QUÉ secciones cambiaron (sin copiar contenido)', async () => {
    const { svc, repo, audit } = build(null);
    const saved = await svc.updateGeneral('org-1', 'uid-1', { defaultLocale: 'pt', assistant: { name: 'Ana' } });
    expect(saved.defaultLocale).toBe('pt');
    expect(repo.saveGeneral).toHaveBeenCalledWith('org-1', saved, 'uid-1');
    const call = audit.log.mock.calls[0]![0] as { configType: string; configKey: string; diff: { sections: string[] } };
    expect(call).toMatchObject({ configType: 'settings', configKey: 'general' });
    expect(call.diff.sections.sort()).toEqual(['assistant', 'defaultLocale']);
  });

  it('updateGeneral/updateStorefront rechazan entrada inválida sin guardar', async () => {
    const { svc, repo } = build(null);
    await expect(svc.updateGeneral('org-1', 'u', { timezone: 'x/y' })).rejects.toThrow();
    await expect(svc.updateStorefront('org-1', 'u', { social: { x: 'javascript:1' } })).rejects.toThrow();
    expect(repo.saveGeneral).not.toHaveBeenCalled();
    expect(repo.saveStorefront).not.toHaveBeenCalled();
  });

  it('getPublicStorefront respeta display, oculta el aviso apagado y NO expone dominios ni mensajes internos', async () => {
    const { svc } = build({
      general: { contact: { publicEmail: 'info@muni.gob.ar', emergencyPhone: '+54 11 5555-5555' }, assistant: { fallbackMessage: 'INTERNO' } },
      storefront: {
        display: { showEmail: true, showEmergencyPhone: false, showHours: false },
        webChat: { enabled: true, greeting: 'Hola', allowedOrigins: ['https://www.muni.gob.ar'] },
        announcement: { enabled: false, text: 'oculto' },
      },
    });
    const pub = await svc.getPublicStorefront('org-1');
    expect(pub.contact).toEqual({ email: 'info@muni.gob.ar', emergencyPhone: '', hours: null });
    expect(pub.announcement).toBeNull();
    expect(pub.webChat).toEqual({ enabled: true, position: 'right', greeting: 'Hola' });
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('allowedOrigins');
    expect(serialized).not.toContain('INTERNO');
  });

  it('isChatOriginAllowed: solo si el chat web está activo y el origen está autorizado (sin distinguir mayúsculas)', async () => {
    const on = build({ storefront: { webChat: { enabled: true, allowedOrigins: ['https://www.muni.gob.ar'] } } }).svc;
    expect(await on.isChatOriginAllowed('o', 'https://www.muni.gob.ar')).toBe(true);
    expect(await on.isChatOriginAllowed('o', 'HTTPS://WWW.MUNI.GOB.AR')).toBe(true);
    expect(await on.isChatOriginAllowed('o', 'https://otro.com')).toBe(false);
    const off = build({ storefront: { webChat: { enabled: false, allowedOrigins: ['https://www.muni.gob.ar'] } } }).svc;
    expect(await off.isChatOriginAllowed('o', 'https://www.muni.gob.ar')).toBe(false);
  });
});
