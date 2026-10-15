import type { Request } from 'express'
import type { MarketsService } from '@/markets/markets.service'
import type { TrpcContext } from '@/trpc/trpc'
/**
 * Contrato tRPC de Markets con el router REAL y el service mockeado.
 *
 * Seguridad (corregida en la sesión de RLS): antes TODOS los procedures eran públicos y recibían organizationId /
 * id por input, así que cualquiera podía crear, cambiar o borrar los mercados de otra organización.
 */
import { createMarketsRouter } from '@/trpc/routers/markets.router'

const ORG = '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b'
const MARKET = '7a1c9d2e-8b3f-4c5d-a6e7-2f3a4b5c6d7e'

const mockService: jest.Mocked<MarketsService> = {
  list:          jest.fn(),
  create:        jest.fn(),
  update:        jest.fn(),
  setDefault:    jest.fn(),
  delete:        jest.fn(),
  resolveMarket: jest.fn(),
  seedDefaultMarket: jest.fn(),
}

const ctx = (over: Partial<TrpcContext> = {}, headers: Record<string, string> = {}): TrpcContext =>
  ({ req: { headers } as unknown as Request, uid: null, organizationId: null, role: null, userId: null, ...over }) as TrpcContext

const OWNER = { uid: 'u1', organizationId: ORG, role: 'OWNER' as const }
const COLLABORATOR = { uid: 'u1', organizationId: ORG, role: 'COLLABORATOR' as const }

type Mutation = 'create' | 'update' | 'setDefault' | 'delete'
const MUTATIONS: readonly Mutation[] = ['create', 'update', 'setDefault', 'delete']
const INPUT: Record<Mutation, unknown> = {
  create: { countryCode: 'AR' },
  update: { id: MARKET },
  setDefault: { id: MARKET },
  delete: { id: MARKET },
}

describe('marketsRouter (tRPC)', () => {
  const router = createMarketsRouter(mockService)
  const as = (over: Partial<TrpcContext> = {}, headers: Record<string, string> = {}) => router.createCaller(ctx(over, headers))
  const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: { code?: string }) => e.code)
  const callMutation = (caller: ReturnType<typeof as>, proc: Mutation): Promise<unknown> => {
    switch (proc) {
      case 'create':     return caller.create({ countryCode: 'AR' })
      case 'update':     return caller.update({ id: MARKET })
      case 'setDefault': return caller.setDefault({ id: MARKET })
      case 'delete':     return caller.delete({ id: MARKET })
    }
  }
  const noServiceCalls = () => Object.values(mockService).every((fn) => fn.mock.calls.length === 0)

  beforeEach(() => jest.clearAllMocks())

  describe('contrato', () => {
    it('list usa la organización del CONTEXTO (no hay organizationId en el input)', async () => {
      mockService.list.mockResolvedValue([])

      const result = await as(OWNER).list()

      expect(Array.isArray(result)).toBe(true)
      expect(mockService.list).toHaveBeenCalledWith(ORG)
    })

    it('create valida countryCode de 2 letras', async () => {
      await expect(as(OWNER).create({ countryCode: 'ARG' })).rejects.toThrow()
      expect(mockService.create).not.toHaveBeenCalled()
    })

    it('create inyecta la organización del contexto', async () => {
      mockService.create.mockResolvedValue({} as never)

      await as(OWNER).create({ countryCode: 'co' })

      expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, countryCode: 'CO' }))
    })

    it('setDefault recibe un uuid y la organización del contexto', async () => {
      mockService.setDefault.mockResolvedValue({ isDefault: true } as never)

      await as(OWNER).setDefault({ id: MARKET })

      expect(mockService.setDefault).toHaveBeenCalledWith(ORG, MARKET)
    })
  })

  describe('autorización', () => {
    it.each(MUTATIONS)('%s sin sesión => UNAUTHORIZED y no toca el service', async (proc) => {
      expect(INPUT[proc]).toBeDefined()
      expect(await code(callMutation(as(), proc))).toBe('UNAUTHORIZED')
      expect(noServiceCalls()).toBe(true)
    })

    it.each(MUTATIONS)('%s con un COLABORADOR => FORBIDDEN y no toca el service', async (proc) => {
      expect(await code(callMutation(as(COLLABORATOR), proc))).toBe('FORBIDDEN')
      expect(noServiceCalls()).toBe(true)
    })

    it('list admite a un colaborador pero no a quien no es miembro', async () => {
      mockService.list.mockResolvedValue([])
      expect(await code(as(COLLABORATOR).list())).toBe('OK')
      expect(await code(as({ uid: 'u1', organizationId: ORG }).list())).toBe('FORBIDDEN')
      expect(await code(as().list())).toBe('UNAUTHORIZED')
    })
  })

  describe('resolve (solo servicio a servicio)', () => {
    const input = { organizationId: ORG, countryCode: 'co' }
    const saved = process.env['INTERNAL_API_KEY']
    afterEach(() => {
      if (saved === undefined) delete process.env['INTERNAL_API_KEY']
      else process.env['INTERNAL_API_KEY'] = saved
    })

    it('con la clave de servicio resuelve y pasa el país en mayúsculas', async () => {
      process.env['INTERNAL_API_KEY'] = 'clave-de-servicio'
      mockService.resolveMarket.mockResolvedValue({ countryCode: 'CO' } as never)

      await as({}, { 'x-internal-api-key': 'clave-de-servicio' }).resolve(input)

      expect(mockService.resolveMarket).toHaveBeenCalledWith(ORG, 'CO')
    })

    it('admite la clave vieja durante una rotación ("nueva,vieja")', async () => {
      process.env['INTERNAL_API_KEY'] = 'nueva,vieja'
      mockService.resolveMarket.mockResolvedValue({} as never)

      expect(await code(as({}, { 'x-internal-api-key': 'vieja' }).resolve(input))).toBe('OK')
    })

    it('sin clave, con clave incorrecta o sin INTERNAL_API_KEY configurada => UNAUTHORIZED', async () => {
      process.env['INTERNAL_API_KEY'] = 'clave-de-servicio'
      expect(await code(as().resolve(input))).toBe('UNAUTHORIZED')
      expect(await code(as({}, { 'x-internal-api-key': 'otra' }).resolve(input))).toBe('UNAUTHORIZED')

      delete process.env['INTERNAL_API_KEY']
      expect(await code(as({}, { 'x-internal-api-key': '' }).resolve(input))).toBe('UNAUTHORIZED')
      expect(mockService.resolveMarket).not.toHaveBeenCalled()
    })

    it('un usuario autenticado SIN la clave de servicio tampoco puede resolver', async () => {
      process.env['INTERNAL_API_KEY'] = 'clave-de-servicio'
      expect(await code(as(OWNER).resolve(input))).toBe('UNAUTHORIZED')
    })
  })
})
