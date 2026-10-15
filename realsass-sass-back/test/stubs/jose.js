// jose@6 (traída por firebase-admin) es solo ESM y jest corre en CommonJS. Los tests unitarios no verifican JWT reales:
// el stub evita cargar el paquete. Quien necesite firmar/verificar debe mockear 'firebase-admin/auth'.
module.exports = {};
