import {
  CannotDeactivateDefaultMarketError, CannotDeleteDefaultMarketError, DuplicateMarketError, MarketNotFoundError,
} from '@/markets/domain/market.errors';

describe('errores de Markets', () => {
  it('MarketNotFoundError distingue "ese país" de "no hay default"', () => {
    expect(new MarketNotFoundError('org-1', 'AR').message).toContain('country=AR');
    expect(new MarketNotFoundError('org-1').message).toContain('No default Market');
  });

  it.each([
    ['MarketNotFoundError', new MarketNotFoundError('o', 'AR')],
    ['DuplicateMarketError', new DuplicateMarketError('o', 'AR')],
    ['CannotDeactivateDefaultMarketError', new CannotDeactivateDefaultMarketError('m-1')],
    ['CannotDeleteDefaultMarketError', new CannotDeleteDefaultMarketError('m-1')],
  ])('%s es un Error con nombre propio', (name, error) => {
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(name);
  });

  it('borrar el default explica cómo seguir', () => {
    expect(new CannotDeleteDefaultMarketError('m-1').message).toContain('Set another as default first');
  });
});
