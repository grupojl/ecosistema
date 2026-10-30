import { describe, expect, it } from 'vitest'
import { AppError, getErrorMessage, isApiError } from './errors'

describe('isApiError', () => {
  it('reconoce la forma del backend', () => {
    expect(isApiError({ statusCode: 400, message: 'x', error: 'Bad Request' })).toBe(true)
  })
  it('descarta lo que no la tiene', () => {
    for (const v of [null, undefined, 'texto', 42, {}, { statusCode: 400 }, { message: 'x' }]) {
      expect(isApiError(v)).toBe(false)
    }
  })
})

describe('getErrorMessage', () => {
  it('prioriza el mensaje del backend; si es lista, el primero', () => {
    expect(getErrorMessage({ statusCode: 400, error: 'e', message: 'no válido' })).toBe('no válido')
    expect(getErrorMessage({ statusCode: 400, error: 'e', message: ['email inválido', 'otro'] })).toBe('email inválido')
  })
  it('usa el mensaje de un Error común', () => {
    expect(getErrorMessage(new Error('falló'))).toBe('falló')
  })
  it('con cualquier otra cosa devuelve el texto por defecto o el pedido', () => {
    expect(getErrorMessage('raro')).toBe('Ocurrió un error inesperado')
    expect(getErrorMessage(null, 'Reintentá')).toBe('Reintentá')
  })
})

describe('AppError', () => {
  it('es un Error con código y estado', () => {
    const e = new AppError('no encontrado', 'NOT_FOUND', 404)
    expect(e).toBeInstanceOf(Error)
    expect(e).toMatchObject({ name: 'AppError', code: 'NOT_FOUND', statusCode: 404, message: 'no encontrado' })
    expect(getErrorMessage(e)).toBe('no encontrado')
  })
})
