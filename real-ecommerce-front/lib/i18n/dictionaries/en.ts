import type { Dictionary } from '@/lib/i18n/dictionaries/types';

export const en = {
  nav: { home: 'Home', products: 'Products' },
  store: {
    poweredBy:          '{store} — powered by Welver',
    defaultDescription: 'Shop online at {store}.',
    heroCta:            'Browse all products',
    categories:         'Categories',
    products:           'Products',
    seeAll:             'See all →',
    empty:              "This store doesn't have any products yet.",
    emptyHint:          'The owner can add them from the dashboard.',
  },
  catalog: {
    allProducts:   'All products',
    productCount:  { one: '{count} product available', other: '{count} products available' },
    empty:         'No products available yet.',
    emptyCategory: 'There are no products in this category.',
    noImage:       'No image',
    previous:      '← Previous',
    next:          'Next →',
    pageOf:        '{page} / {total}',
    back:          '← Back',
    pageTitle:     'Page {page}',
  },
  product: {
    backToProducts: '← Back to products',
    variants:       'Available variants',
    outOfStock:     '(out of stock)',
    fromPrice:      'From {price}',
    contactToBuy:   'To make a purchase, contact the store directly.',
    goToSite:       'Go to {store} website',
  },
  localeSwitcher: { label: 'Language' },
} satisfies Dictionary;
