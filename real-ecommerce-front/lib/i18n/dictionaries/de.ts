import type { Dictionary } from '@/lib/i18n/dictionaries/types';

export const de = {
  nav: { home: 'Startseite', products: 'Produkte' },
  store: {
    poweredBy:          '{store} — powered by Welver',
    defaultDescription: 'Kaufen Sie online bei {store} ein.',
    heroCta:            'Alle Produkte ansehen',
    categories:         'Kategorien',
    products:           'Produkte',
    seeAll:              'Alle ansehen →',
    empty:              'Dieser Shop hat noch keine Produkte.',
    emptyHint:          'Der Inhaber kann sie über das Dashboard hinzufügen.',
  },
  catalog: {
    allProducts:   'Alle Produkte',
    productCount:  { one: '{count} Produkt verfügbar', other: '{count} Produkte verfügbar' },
    empty:         'Noch keine Produkte verfügbar.',
    emptyCategory: 'In dieser Kategorie gibt es keine Produkte.',
    noImage:       'Kein Bild',
    previous:      '← Zurück',
    next:          'Weiter →',
    pageOf:        '{page} / {total}',
    back:          '← Zurück',
    pageTitle:     'Seite {page}',
  },
  product: {
    backToProducts: '← Zurück zu den Produkten',
    variants:       'Verfügbare Varianten',
    outOfStock:     '(nicht vorrätig)',
    fromPrice:      'Ab {price}',
    contactToBuy:   'Um einen Kauf zu tätigen, wenden Sie sich direkt an den Shop.',
    goToSite:       'Zur Website von {store}',
  },
  localeSwitcher: { label: 'Sprache' },
} satisfies Dictionary;
