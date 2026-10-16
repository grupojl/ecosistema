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
    learnMore:          string;
    bagTitle:           string;
    bagEmpty:           string;
    footerShop:         string;
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
    metaDescription:     string; // {store}
    categoryDescription: string; // {category} {store}
  };
  product: {
    backToProducts: string;
    variants:       string;
    outOfStock:     string;
    fromPrice:      string; // {price}
    contactToBuy:   string;
    goToSite:       string; // {store}
  };
  notFound: { title: string; body: string; hint: string; back: string };
  commerce: {
    signIn: string;
    signOut: string;
    account: string;
    myOrders: string;
    authTitle: string;
    authIntro: string;
    continueWithGoogle: string;
    authUnavailable: string;
    continuing: string;
    authError: string;
    bagSignIn: string;
    subtotal: string;
    checkout: string;
    remove: string;
    quantity: string;
    addToCart: string;
    adding: string;
    added: string;
    viewBag: string;
    chooseVariant: string;
    outOfStock: string;
    checkoutTitle: string;
    shippingTitle: string;
    summary: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    placeOrder: string;
    placingOrder: string;
    needSignIn: string;
    orderPlacedTitle: string;
    orderPlacedBody: string; // {store}
    orderNumber: string;
    ordersTitle: string;
    ordersEmpty: string;
    total: string;
    shipTo: string;
    backToStore: string;
    loading: string;
    genericError: string;
    status: {
      PENDING_PAYMENT: string;
      PAID: string;
      FULFILLING: string;
      SHIPPED: string;
      DELIVERED: string;
      CANCELLED: string;
      REFUNDED: string;
    };
  };
  localeSwitcher: {
    label: string;
  };
}
