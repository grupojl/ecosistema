/**
 * Contrato de traducciones. Agregar una key acá obliga (en compile time) a
 * traducirla en es/pt/en — `satisfies Dictionary` rompe el typecheck si falta.
 */
export interface PluralForms {
  one:   string;
  other: string;
}

export interface Dictionary {
  nav: {
    home:     string;
    products: string;
  };
  store: {
    poweredBy:          string; // {store}
    defaultDescription: string; // {store}
    heroCta:            string;
    categories:         string;
    products:           string;
    seeAll:             string;
    empty:              string;
    emptyHint:          string;
  };
  catalog: {
    allProducts:   string;
    productCount:  PluralForms; // {count}
    empty:         string;
    emptyCategory: string;
    noImage:       string;
    previous:      string;
    next:          string;
    pageOf:        string; // {page} {total}
    back:          string;
    pageTitle:     string; // {page}
  };
  product: {
    backToProducts: string;
    variants:       string;
    outOfStock:     string;
    fromPrice:      string; // {price}
    contactToBuy:   string;
    goToSite:       string; // {store}
  };
  localeSwitcher: {
    label: string;
  };
}
