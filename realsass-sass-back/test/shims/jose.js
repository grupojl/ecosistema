// Stub de `jose` solo para Jest (ver moduleNameMapper en jest.config.js). El código real corre con la librería de verdad.
const unsupported = () => { throw new Error('jose no está disponible en los tests: mockeá firebase-admin'); };
module.exports = new Proxy({}, { get: (_t, prop) => (prop === '__esModule' ? false : unsupported) });
