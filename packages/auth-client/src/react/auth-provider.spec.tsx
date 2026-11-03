// @vitest-environment jsdom
/**
 * AuthProvider compartido (los fronts autenticados): la cadena de sesión de ADR-004 / ADR-020. Lo que se verifica es el
 * comportamiento que decide quién entra y quién no:
 *   · sesión por COOKIE de otro front (sin usuario de Firebase en este origen)
 *   · alta con Firebase: sync → cookie → perfil, y solo entonces el usuario queda autenticado
 *   · un dispositivo cerrado desde «Dispositivos» (401 al crear la cookie) cierra también su Firebase local
 *   · cerrar sesión en otro front se refleja aquí (auth.ping)
 */
import * as React from 'react';
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  listener: null as null | ((u: unknown) => void | Promise<void>),
  currentUser: null as null | { getIdToken: (force?: boolean) => Promise<string> },
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn(),
}));
vi.mock('../firebase/firebase', () => ({
  getFirebaseAuth: () => ({ get currentUser() { return fb.currentUser; } }),
  getIdToken: (...a: unknown[]) => fb.getIdToken(...a),
  signInWithGoogle: (...a: unknown[]) => fb.signInWithGoogle(...a),
  signOut: (...a: unknown[]) => fb.signOut(...a),
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => { fb.listener = cb; return vi.fn(); },
}));

const ping = vi.hoisted(() => ({ status: 'unknown' as 'open' | 'closed' | 'unknown', fn: vi.fn() }));
vi.mock('../http/ping-session', () => ({ pingSession: (...a: unknown[]) => { ping.fn(...a); return Promise.resolve(ping.status); } }));

const refresh = vi.hoisted(() => ({ due: true, mark: vi.fn(), clear: vi.fn() }));
vi.mock('../http/session-refresh', () => ({
  sessionRefreshDue: () => refresh.due,
  markSessionRefreshed: () => refresh.mark(),
  clearSessionRefreshed: () => refresh.clear(),
}));

import { AuthProvider, useAuth } from './auth-provider';
import { getActiveOrganizationId, setActiveOrganizationId } from '../http/api-fetch';

const BACK = 'http://sass.test';
const me = (over: Record<string, unknown> = {}) => ({
  user: { id: 'u1', firebaseUid: 'fb1', email: 'ana@x.com', displayName: 'Ana', photoUrl: null, referralCode: 'ref-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  organization: { id: 'o1', name: 'Org 1', slug: 'org-1' },
  organizations: [{ id: 'o1', name: 'Org 1', slug: 'org-1' }],
  collaborations: [{ organizationId: 'o2', role: 'ADMIN', permissions: { canEditListings: true } }],
  ...over,
});

interface Backend { me: unknown | 'unauthorized' | 'error'; sessionPost: number; syncStatus: number; calls: Array<{ method: string; url: string; auth?: string }> }
let backend: Backend;
const trpcOk = (data: unknown) => new Response(JSON.stringify({ result: { data } }), { status: 200 });

beforeEach(() => {
  vi.useRealTimers();
  fb.listener = null;
  fb.currentUser = null;
  fb.signInWithGoogle.mockReset().mockResolvedValue(undefined);
  fb.signOut.mockReset().mockResolvedValue(undefined);
  fb.getIdToken.mockReset().mockResolvedValue('ID-TOKEN');
  ping.status = 'unknown';
  ping.fn.mockClear();
  refresh.due = true;
  refresh.mark.mockClear();
  refresh.clear.mockClear();
  window.sessionStorage.clear();
  setActiveOrganizationId(null);
  backend = { me: me(), sessionPost: 200, syncStatus: 200, calls: [] };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    backend.calls.push({ method, url, auth: (init?.headers as Record<string, string> | undefined)?.['Authorization'] });
    if (url.endsWith('/auth/session')) return new Response('{}', { status: method === 'POST' ? backend.sessionPost : 200 });
    if (url.includes('auth.sync')) return backend.syncStatus === 200 ? trpcOk({ ok: true }) : new Response('{}', { status: backend.syncStatus });
    if (url.includes('auth.me')) {
      if (backend.me === 'unauthorized') return new Response('{}', { status: 401 });
      if (backend.me === 'error') return new Response('{}', { status: 503 });
      return trpcOk(backend.me);
    }
    return new Response('{}', { status: 404 });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider sassBackUrl={`${BACK}/api/v1/`}>{children}</AuthProvider>;
const setup = () => renderHook(() => useAuth(), { wrapper });
const fbUser = (token = 'ID-TOKEN') => {
  const u = { getIdToken: vi.fn().mockResolvedValue(token) };
  fb.currentUser = u;
  return u;
};
const meCalls = () => backend.calls.filter((c) => c.url.includes('auth.me'));

describe('useAuth', () => {
  it('fuera del provider falla con un mensaje claro', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/dentro de AuthProvider/);
  });
});

describe('sesión por cookie de otro front (sin usuario de Firebase aquí)', () => {
  it('con cookie válida el usuario queda autenticado SOLO con la cookie (nunca Bearer)', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toMatchObject({ email: 'ana@x.com', isOwner: true, affiliateCode: 'ref-1' });
    expect(meCalls().every((c) => c.auth === undefined)).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('sin cookie válida (401) queda sin sesión y deja de cargar (se muestra el login)', async () => {
    backend.me = 'unauthorized';
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('un 5xx transitorio se reintenta antes de rendirse (no manda a /login por un back que arranca)', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const original = fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('auth.me')) { attempts++; return attempts < 3 ? new Response('{}', { status: 503 }) : trpcOk(me()); }
      return original(input, init);
    }));
    const { result } = setup();
    await act(async () => { void fb.listener?.(null); await vi.advanceTimersByTimeAsync(5000); });
    expect(attempts).toBeGreaterThanOrEqual(3); // (el arranque rápido y el observador de Firebase consultan por separado)
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('si el back sigue caído tras los reintentos, queda sin sesión', async () => {
    vi.useFakeTimers();
    backend.me = 'error';
    const { result } = setup();
    await act(async () => { void fb.listener?.(null); await vi.advanceTimersByTimeAsync(10_000); });
    expect(meCalls().length).toBeGreaterThanOrEqual(3);
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('alta con Firebase: sync → cookie → perfil', () => {
  it('con usuario de Firebase hace sync (Bearer), crea la cookie y recién entonces autentica', async () => {
    const { result } = setup();
    const user = fbUser();
    await act(async () => { await fb.listener?.(user); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    const order = backend.calls.map((c) => `${c.method} ${c.url.replace(BACK, '').replace(/\?.*/, '')}`);
    expect(order).toContain('POST /api/v1/trpc/auth.sync');
    expect(order).toContain('POST /auth/session');
    expect(backend.calls.find((c) => c.url.includes('auth.sync'))?.auth).toBe('Bearer ID-TOKEN');
    expect(order.indexOf('POST /auth/session')).toBeGreaterThan(order.indexOf('POST /api/v1/trpc/auth.sync'));
    expect(refresh.mark).toHaveBeenCalled();
    expect(result.current.organizationId).toBe('o1');
  });

  it('un 401 al crear la cookie = dispositivo cerrado desde «Dispositivos»: cierra el Firebase local y NO autentica', async () => {
    backend.sessionPost = 401;
    backend.me = 'unauthorized';
    const { result } = setup();
    await act(async () => { await fb.listener?.(fbUser()); });
    await waitFor(() => expect(fb.signOut).toHaveBeenCalled());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('si falla la cookie por otra razón (p. ej. 429) y no hay cookie previa, avisa el error y no autentica', async () => {
    backend.sessionPost = 429;
    backend.me = 'unauthorized';
    const { result } = setup();
    await act(async () => { await fb.listener?.(fbUser()); });
    await waitFor(() => expect(result.current.authError).toMatch(/No pudimos iniciar tu sesión segura/));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('si el sync da 401 cierra el Firebase local', async () => {
    backend.syncStatus = 401;
    setup();
    await act(async () => { await fb.listener?.(fbUser()); });
    await waitFor(() => expect(fb.signOut).toHaveBeenCalled());
  });

  it('una recarga con la cookie renovada hace poco entra por cookie (1 request) sin repetir la cadena', async () => {
    refresh.due = false;
    const { result } = setup();
    await act(async () => { await fb.listener?.(fbUser()); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(backend.calls.some((c) => c.url.includes('auth.sync'))).toBe(false);
    expect(backend.calls.some((c) => c.method === 'POST' && c.url.endsWith('/auth/session'))).toBe(false);
  });
});

describe('perfil y organización activa', () => {
  it('las organizaciones propias son OWNER y las colaboraciones MEMBER (sin duplicar)', async () => {
    backend.me = me({ collaborations: [{ organizationId: 'o1', role: 'ADMIN', permissions: {} }, { organizationId: 'o2', role: 'ADMIN', permissions: { x: true } }] });
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user!.tenants.map((t) => [t.organizationId, t.role])).toEqual([['o1', 'OWNER'], ['o2', 'MEMBER']]);
  });

  it('un colaborador sin organización propia no es dueño', async () => {
    backend.me = me({ organization: null, organizations: [], collaborations: [{ organizationId: 'o9', role: 'VIEWER', permissions: {} }] });
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toMatchObject({ isOwner: false, organization: null });
    expect(result.current.organizationId).toBe('o9');
  });

  it('recuerda la organización activa y solo si el usuario todavía tiene acceso a ella', async () => {
    window.sessionStorage.setItem('real_active_org_id', 'o2');
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.organizationId).toBe('o2'));

    cleanup();
    window.sessionStorage.setItem('real_active_org_id', 'org-ajena');
    const second = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(second.result.current.organizationId).toBe('o1')); // la guardada ya no es suya
  });

  it('setOrganizationId cambia la activa, la guarda y la expone para los headers', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    act(() => result.current.setOrganizationId('o2'));
    expect(result.current.organizationId).toBe('o2');
    expect(window.sessionStorage.getItem('real_active_org_id')).toBe('o2');
    expect(getActiveOrganizationId()).toBe('o2');
  });
});

describe('cerrar sesión y refrescar', () => {
  it('logout: borra la cookie en el back, cierra Firebase y limpia usuario y organización', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    await act(async () => { await result.current.logout(); });
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.url === `${BACK}/auth/session`)).toBe(true);
    expect(fb.signOut).toHaveBeenCalled();
    expect(refresh.clear).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.organizationId).toBeNull();
    expect(getActiveOrganizationId()).toBeNull();
  });

  it('logout igual cierra la sesión local si el back no responde', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await act(async () => { await result.current.logout(); });
    expect(fb.signOut).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('loginWithGoogle abre el login de Firebase', async () => {
    const { result } = setup();
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(fb.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('refreshUser vuelve a pedir el perfil; si falla, conserva el anterior', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    backend.me = me({ user: { id: 'u1', firebaseUid: 'fb1', email: 'nuevo@x.com', displayName: 'N', photoUrl: null, referralCode: null, createdAt: '', updatedAt: '' } });
    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user?.email).toBe('nuevo@x.com');
    backend.me = 'error';
    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user?.email).toBe('nuevo@x.com'); // silencioso: no se pierde la sesión por un fallo puntual
  });
});

describe('sesión en vivo entre fronts (auth.ping)', () => {
  const trigger = async () => {
    // useSessionWatch revalida al volver a la pestaña
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
  };

  it('si otro front cerró la sesión, este se desloguea (y cierra su Firebase)', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    ping.status = 'closed';
    await trigger();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(fb.signOut).toHaveBeenCalled();
    expect(refresh.clear).toHaveBeenCalled();
  });

  it('si otro front abrió la sesión, este entra solo', async () => {
    backend.me = 'unauthorized';
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    backend.me = me();
    ping.status = 'open';
    await trigger();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  });

  it('un corte de red (unknown) NO desloguea a nadie', async () => {
    const { result } = setup();
    await act(async () => { await fb.listener?.(null); });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    ping.status = 'unknown';
    await trigger();
    expect(result.current.isAuthenticated).toBe(true);
    expect(fb.signOut).not.toHaveBeenCalled();
  });
});

describe('render', () => {
  it('renderiza a sus hijos', () => {
    const { getByText } = render(<AuthProvider sassBackUrl={BACK}><p>contenido</p></AuthProvider>);
    expect(getByText('contenido')).toBeTruthy();
  });
});
