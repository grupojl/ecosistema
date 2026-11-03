-- Rellena la fila de stock de las variantes que no la tienen.
-- Hasta ahora PrismaCatalogRepository.createProduct no creaba InventoryItem, así que adminInventory.setStock respondía 404
-- para todo producto creado desde el panel. Solo inserta lo que falta (stock 0): no modifica ninguna fila existente.
INSERT INTO "inventory_items" ("id", "variant_id", "organization_id", "quantity_available", "quantity_reserved", "updated_at")
SELECT gen_random_uuid()::text, v."id", v."organization_id", 0, 0, CURRENT_TIMESTAMP
FROM "product_variants" v
LEFT JOIN "inventory_items" i ON i."variant_id" = v."id"
WHERE i."id" IS NULL;
