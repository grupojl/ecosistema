// El notFound() del layout de [slug] (tienda inexistente) no lo atrapa el not-found.tsx de ese mismo segmento: Next lo
// busca en el segmento de arriba. Sin este archivo se veía el 404 genérico de Next, sin idioma y sin salida.
export { default } from './[slug]/not-found'
