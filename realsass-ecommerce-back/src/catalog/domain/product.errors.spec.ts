import {
  CannotPublishWithoutStockError, DomainError, DuplicateSkuInProductError, InvalidHandleError,
  InvalidVariantPriceError, ProductWithoutVariantsError,
} from '@/catalog/domain/product.errors';

describe('errores de dominio del catálogo', () => {
  const cases: Array<[string, DomainError, string]> = [
    ['InvalidHandleError', new InvalidHandleError('Mi Producto!'), 'INVALID_HANDLE'],
    ['InvalidVariantPriceError', new InvalidVariantPriceError(0), 'INVALID_VARIANT_PRICE'],
    ['DuplicateSkuInProductError', new DuplicateSkuInProductError('SKU-1'), 'DUPLICATE_SKU_IN_PRODUCT'],
    ['ProductWithoutVariantsError', new ProductWithoutVariantsError(), 'PRODUCT_WITHOUT_VARIANTS'],
    ['CannotPublishWithoutStockError', new CannotPublishWithoutStockError('p-1'), 'CANNOT_PUBLISH_WITHOUT_STOCK'],
  ];

  it.each(cases)('%s es un DomainError con código estable (la UI se apoya en él)', (_name, error, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(10);
  });

  it('los mensajes incluyen el dato inválido', () => {
    expect(new InvalidHandleError('Mi Producto!').message).toContain('Mi Producto!');
    expect(new InvalidVariantPriceError(-5).message).toContain('-5');
    expect(new DuplicateSkuInProductError('SKU-1').message).toContain('SKU-1');
    expect(new CannotPublishWithoutStockError('p-1').message).toContain('p-1');
  });
});
