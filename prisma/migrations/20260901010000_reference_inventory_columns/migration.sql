ALTER TABLE "InventoryItem" ADD COLUMN "poNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InventoryItem" ADD COLUMN "inventoryCode" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "productCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InventoryItem" ADD COLUMN "serialNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InventoryItem" ADD COLUMN "userLocation" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "InventoryItem_inventoryCode_key" ON "InventoryItem"("inventoryCode");
