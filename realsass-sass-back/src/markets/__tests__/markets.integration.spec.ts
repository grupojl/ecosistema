import type { MarketsService } from '@/markets/markets.service'
/**
 * Integration test del contrato tRPC de Markets (router real + servicio mockeado).
 *
 * Seguridad: antes todas las operaciones eran públicas — cualquiera podía crear/borrar mercados de cualquier tienda.
 */
import { createMarketsRouter } from '@/trpc/routers/markets.router'
import { createCallerFactory } from '@/trpc/trpc'

const ORG       = '6f1c2a3b-0000-4000-8000-000000000001'
const OTHER_ORG = '6f1c2a3b-0000-4000-8000-0000000000aa'
const MARKET    = '6f1c2a3b-0000-4000-8000-000000000002'

const mockService: jest.Mocked<MarketsService> = {
  list:          jest.fn(),
  create:        jest.fn(),
  update:        jest.fn(),
  setDefault:    jest.fn(),
  delete:        jest.fn(),
  resolveMarket: jest.fn(),
  seedDefaultMarket: jest.fn(),
} as unknown as jest.Mocked<MarketsService>

const createCaller = createCallerFactory(createMarketsRouter(mockService))

type Ctx = Parameters<typeof createCaller>[0]
const ctxOf = (over: Partial<Record<string, unknown>> = {}, headers: Record<string, string> = {}): Ctx =>
  ({ req: { headers }, uid: null, organizationId: null, role: null, ...over }) as unknown as Ctx

const owner        = createCaller(ctxOf({ uid: 'u1', organizationId: ORG, role: 'OWNER' }))
const collaborator = createCaller(ctxOf({ uid: 'u2', organizationId: ORG, role: 'COLLABORATOR' }))
const anonymous    = createCaller(ctxOf())

describe('marketsRouter (tRPC integration)', () => {
  const OLD_KEY = process.env['INTERNAL_API_KEY']
  beforeEach(() => { jest.clearAllMocks(); process.env['INTERNAL_API_KEY'] = 'clave-interna' })
  afterAll(() => { process.env['INTERNAL_API_KEY'] = OLD_KEY })

  describe('autenticación (antes: todo público)', () => {
    it.each([
      ['list',       () => anonymous.list({})],
      ['create',     () => anonymous.create({ countryCode: 'AR' })],
      ['update',     () => anonymous.update({ id: MARKET, isActive: false })],
      ['setDefault', () => anonymous.setDefault({ id: MARKET })],
      ['delete',     () => anonymous.delete({ id: MARKET })],
    ])('%s sin sesión → rechazado y no toca el servicio', async (_n, call) => {
      await expect(call()).rejects.toThrow()
      expect(mockService.list).not.toHaveBeenCalled()
      expect(mockService.create).not.toHaveBeenCalled()
      expect(mockService.delete).not.toHaveBeenCalled()
    })

    it('un colaborador puede listar pero NO crear ni borrar (solo el dueño)', async () => {
      mockService.list.mockResolvedValue([])
      await expect(collaborator.list({})).resolves.toEqual([])
      await expect(collaborator.create({ countryCode: 'AR' })).rejects.toThrow()
      await expect(collaborator.delete({ id: MARKET })).rejects.toThrow()
      expect(mockService.delete).not.toHaveBeenCalled()
    })
  })

  describe('alcance por organización', () => {
    it('list usa la organización de la sesión, no la del input', async () => {
      mockService.list.mockResolvedValue([])
      await owner.list({})
      expect(mockService.list).toHaveBeenCalledWith(ORG)
    })

    it('pedir los mercados de OTRA organización → FORBIDDEN', async () => {
      await expect(owner.list({ organizationId: OTHER_ORG })).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(owner.create({ organizationId: OTHER_ORG, countryCode: 'AR' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(mockService.list).not.toHaveBeenCalled()
      expect(mockService.create).not.toHaveBeenCalled()
    })

    it('create crea SIEMPRE en la organización de la sesión y valida countryCode de 2 letras', async () => {
      mockService.create.mockResolvedValue({} as never)
      await owner.create({ countryCode: 'br' })
      expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, countryCode: 'BR' }))
      await expect(owner.create({ countryCode: 'ARG' })).rejects.toThrow()
    })

    it('update / setDefault / delete pasan la organización para que el servicio verifique pertenencia', async () => {
      mockService.update.mockResolvedValue({} as never)
      mockService.setDefault.mockResolvedValue({ isDefault: true } as never)
      mockService.delete.mockResolvedValue(undefined)
      await owner.update({ id: MARKET, isActive: false })
      await owner.setDefault({ id: MARKET })
      await owner.delete({ id: MARKET })
      expect(mockService.update).toHaveBeenCalledWith(MARKET, expect.anything(), ORG)
      expect(mockService.setDefault).toHaveBeenCalledWith(MARKET, ORG)
      expect(mockService.delete).toHaveBeenCalledWith(MARKET, ORG)
    })
  })

  describe('resolve (solo servicio-a-servicio)', () => {
    const input = { organizationId: ORG, countryCode: 'co' }

    it('con la clave interna correcta resuelve y pone el país en mayúsculas', async () => {
      mockService.resolveMarket.mockResolvedValue({ countryCode: 'CO' } as never)
      const internal = createCaller(ctxOf({}, { 'x-internal-api-key': 'clave-interna' }))
      await internal.resolve(input)
      expect(mockService.resolveMarket).toHaveBeenCalledWith(ORG, 'CO')
    })

    it.each([
      ['sin clave', {}],
      ['clave incorrecta', { 'x-internal-api-key': 'otra' }],
    ])('%s → UNAUTHORIZED', async (_n, headers) => {
      const caller = createCaller(ctxOf({}, headers as Record<string, string>))
      await expect(caller.resolve(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      expect(mockService.resolveMarket).not.toHaveBeenCalled()
    })

    it('si INTERNAL_API_KEY no está configurada se rechaza todo (fail-closed)', async () => {
      delete process.env['INTERNAL_API_KEY']
      const caller = createCaller(ctxOf({}, { 'x-internal-api-key': '' }))
      await expect(caller.resolve(input)).rejects.toThrow()
      expect(mockService.resolveMarket).not.toHaveBeenCalled()
    })
  })
})
