import { DATA_REGIONS, DEFAULT_DATA_REGION, regionDe, toDataRegion } from './data-region';

describe('regionDe', () => {
  it('Argentina → ar y Estados Unidos → us', () => {
    expect(regionDe('AR')).toBe('ar');
    expect(regionDe('US')).toBe('us');
  });

  it('cualquier otro país cae en la región por defecto (us)', () => {
    expect(regionDe('CO')).toBe('us');
    expect(regionDe('MX')).toBe('us');
    expect(DEFAULT_DATA_REGION).toBe('us');
  });

  it('normaliza minúsculas y espacios', () => {
    expect(regionDe(' ar ')).toBe('ar');
  });

  it('nunca falla: país inválido, vacío o ausente → región por defecto', () => {
    expect(regionDe('ARG')).toBe(DEFAULT_DATA_REGION);
    expect(regionDe('')).toBe(DEFAULT_DATA_REGION);
    expect(regionDe(null)).toBe(DEFAULT_DATA_REGION);
    expect(regionDe(undefined)).toBe(DEFAULT_DATA_REGION);
  });

  it('solo devuelve regiones declaradas', () => {
    for (const c of ['AR', 'US', 'BR', 'ES', 'xx']) {
      expect(DATA_REGIONS).toContain(regionDe(c));
    }
  });
});

describe('toDataRegion', () => {
  it('acepta las regiones conocidas', () => {
    expect(toDataRegion('ar')).toBe('ar');
    expect(toDataRegion('us')).toBe('us');
  });

  it('dato corrupto o desconocido → región por defecto', () => {
    expect(toDataRegion('us-east')).toBe(DEFAULT_DATA_REGION);
    expect(toDataRegion('mars-1')).toBe(DEFAULT_DATA_REGION);
    expect(toDataRegion(null)).toBe(DEFAULT_DATA_REGION);
  });
});
