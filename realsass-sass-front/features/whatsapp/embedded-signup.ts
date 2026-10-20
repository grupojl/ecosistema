// features/whatsapp/embedded-signup.ts
//
// SDK de Facebook + Embedded Signup. Se carga solo desde la pantalla de WhatsApp.
// Al navegador solo llegan el ID público de la app y el config_id; el canje del `code`
// lo hace el back (el appSecret nunca sale de ahí).

/** Lo único que el navegador entrega al back: el `code` y los ids que devuelve el SDK. */
export interface EmbeddedSignupResult {
  code:          string;
  wabaId:        string;
  phoneNumberId: string;
}

interface FbLoginResponse { authResponse?: { code?: string } | null }
interface FbSdk {
  init(opts: { appId: string; version: string; xfbml?: boolean; cookie?: boolean }): void;
  login(cb: (r: FbLoginResponse) => void, opts: Record<string, unknown>): void;
}
declare global {
  interface Window { FB?: FbSdk; fbAsyncInit?: () => void }
}

const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';

export function getEmbeddedSignupConfig(): { appId: string; configId: string; version: string } | null {
  const appId    = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
  if (!appId || !configId) return null;
  return { appId, configId, version: process.env.NEXT_PUBLIC_META_GRAPH_VERSION ?? 'v21.0' };
}

let sdkPromise: Promise<FbSdk> | null = null;

function loadSdk(appId: string, version: string): Promise<FbSdk> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FbSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new Error('El SDK de Facebook no se inicializó.'));
      window.FB.init({ appId, version, xfbml: false, cookie: true });
      resolve(window.FB);
    };
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => { sdkPromise = null; reject(new Error('No se pudo cargar el SDK de Facebook.')); };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

function isFacebookOrigin(origin: string): boolean {
  try { return /(^|\.)facebook\.com$/.test(new URL(origin).hostname); } catch { return false; }
}

/** Abre Embedded Signup y resuelve con el code + ids. Rechaza si el usuario cancela. */
export async function launchEmbeddedSignup(): Promise<EmbeddedSignupResult> {
  const cfg = getEmbeddedSignupConfig();
  if (!cfg) throw new Error('Falta configurar NEXT_PUBLIC_META_APP_ID / NEXT_PUBLIC_META_CONFIG_ID.');
  const fb = await loadSdk(cfg.appId, cfg.version);

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;
    let code: string | null = null;
    let settled = false;

    // Resuelve solo con el code Y los dos ids: el back verifica contra Meta que el número es de esa cuenta.
    const finish = () => {
      if (settled || !code) return;
      if (!wabaId || !phoneNumberId) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      resolve({ code, wabaId, phoneNumberId });
    };

    // Meta publica los ids de la WABA/número por postMessage durante el flujo.
    const onMessage = (ev: MessageEvent) => {
      if (!isFacebookOrigin(ev.origin)) return;
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          wabaId        = data.data?.waba_id ?? null;
          phoneNumberId = data.data?.phone_number_id ?? null;
          finish();
        }
      } catch { /* mensajes ajenos */ }
    };
    window.addEventListener('message', onMessage);

    fb.login(
      (r) => {
        const c = r.authResponse?.code;
        if (!c) {
          settled = true;
          window.removeEventListener('message', onMessage);
          reject(new Error('Conexión cancelada.'));
          return;
        }
        code = c;
        // El mensaje con los ids puede llegar antes o después del code: si faltan, se espera un momento y se aborta.
        finish();
        setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', onMessage);
          reject(new Error('Meta no entregó los datos de la cuenta. Repetí la conexión.'));
        }, 5000);
      },
      {
        config_id: cfg.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      },
    );
  });
}
