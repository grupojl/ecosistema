import type { Dictionary } from '@/lib/i18n/dictionaries/types';

export const es = {
  nav: { home: 'Inicio', products: 'Productos' },
  store: {
    poweredBy:          '{store} — impulsado por Welver',
    defaultDescription: 'Comprá online en {store}.',
    heroCta:            'Ver todos los productos',
    categories:         'Categorías',
    products:           'Productos',
    seeAll:             'Ver todos →',
    empty:              'Esta tienda aún no tiene productos cargados.',
    emptyHint:          'El administrador puede agregarlos desde el dashboard.',
  },
  catalog: {
    allProducts:   'Todos los productos',
    productCount:  { one: '{count} producto disponible', other: '{count} productos disponibles' },
    empty:         'No hay productos disponibles todavía.',
    emptyCategory: 'No hay productos en esta categoría.',
    noImage:       'Sin imagen',
    previous:      '← Anterior',
    next:          'Siguiente →',
    pageOf:        '{page} / {total}',
    back:          '← Volver',
    pageTitle:     'Página {page}',
  },
  product: {
    backToProducts: '← Volver a productos',
    variants:       'Variantes disponibles',
    outOfStock:     '(sin stock)',
    fromPrice:      'Desde {price}',
    contactToBuy:   'Para realizar una compra, contactá directamente a la tienda.',
    goToSite:       'Ir al sitio de {store}',
  },
  localeSwitcher: { label: 'Idioma' },
} satisfies Dictionary;
