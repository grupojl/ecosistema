import type { Dictionary } from '@/lib/i18n/dictionaries/types';

export const fr = {
  nav: { home: 'Accueil', products: 'Produits' },
  store: {
    poweredBy:          '{store} — propulsé par Welver',
    defaultDescription: 'Achetez en ligne chez {store}.',
    heroCta:            'Voir tous les produits',
    categories:         'Catégories',
    products:           'Produits',
    seeAll:              'Voir tout →',
    empty:              "Cette boutique n'a pas encore de produits.",
    emptyHint:          "L'administrateur peut les ajouter depuis le tableau de bord.",
  },
  catalog: {
    allProducts:   'Tous les produits',
    productCount:  { one: '{count} produit disponible', other: '{count} produits disponibles' },
    empty:         'Aucun produit disponible pour le moment.',
    emptyCategory: "Il n'y a pas de produits dans cette catégorie.",
    noImage:       'Pas d\u2019image',
    previous:      '← Précédent',
    next:          'Suivant →',
    pageOf:        '{page} / {total}',
    back:          '← Retour',
    pageTitle:     'Page {page}',
  },
  product: {
    backToProducts: '← Retour aux produits',
    variants:       'Variantes disponibles',
    outOfStock:     '(rupture de stock)',
    fromPrice:      'À partir de {price}',
    contactToBuy:   'Pour effectuer un achat, contactez directement la boutique.',
    goToSite:       'Aller sur le site de {store}',
  },
  localeSwitcher: { label: 'Langue' },
} satisfies Dictionary;
