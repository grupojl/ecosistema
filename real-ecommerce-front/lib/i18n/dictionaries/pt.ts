import type { Dictionary } from './types';

export const pt = {
  nav: { home: 'Início', products: 'Produtos' },
  store: {
    poweredBy:          '{store} — com tecnologia Welver',
    defaultDescription: 'Compre online na {store}.',
    heroCta:            'Ver todos os produtos',
    categories:         'Categorias',
    products:           'Produtos',
    seeAll:             'Ver todos →',
    empty:              'Esta loja ainda não tem produtos cadastrados.',
    emptyHint:          'O administrador pode adicioná-los pelo painel.',
  },
  catalog: {
    allProducts:   'Todos os produtos',
    productCount:  { one: '{count} produto disponível', other: '{count} produtos disponíveis' },
    empty:         'Ainda não há produtos disponíveis.',
    emptyCategory: 'Não há produtos nesta categoria.',
    noImage:       'Sem imagem',
    previous:      '← Anterior',
    next:          'Próxima →',
    pageOf:        '{page} / {total}',
    back:          '← Voltar',
    pageTitle:     'Página {page}',
  },
  product: {
    backToProducts: '← Voltar aos produtos',
    variants:       'Variantes disponíveis',
    outOfStock:     '(esgotado)',
    fromPrice:      'A partir de {price}',
    contactToBuy:   'Para comprar, entre em contato diretamente com a loja.',
    goToSite:       'Ir para o site de {store}',
  },
  localeSwitcher: { label: 'Idioma' },
} satisfies Dictionary;
