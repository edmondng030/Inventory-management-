BEGIN;
DELETE FROM "CheckLog" WHERE "itemId" IN (SELECT "id" FROM "InventoryItem" WHERE "id" LIKE 'seed-%');
DELETE FROM "AuditLog" WHERE "itemId" IN (SELECT "id" FROM "InventoryItem" WHERE "id" LIKE 'seed-%');
DELETE FROM "InventoryItem" WHERE "id" LIKE 'seed-%';
COMMIT;
