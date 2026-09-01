CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "sku" TEXT,
  "labelCode" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL DEFAULT '未分類',
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT '件',
  "location" TEXT NOT NULL DEFAULT '未指定',
  "minimumStock" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Unchecked',
  "remark" TEXT NOT NULL DEFAULT '',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CheckSession" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationFilter" TEXT,
  "categoryFilter" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckSession_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CheckLog" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "itemId" TEXT NOT NULL,
  "detectedValue" TEXT NOT NULL,
  "detectionMethod" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "previousStatus" TEXT NOT NULL,
  "newStatus" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedBy" TEXT NOT NULL DEFAULT 'Admin',
  CONSTRAINT "CheckLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "quantityChange" INTEGER,
  "performedBy" TEXT NOT NULL DEFAULT 'Admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "insertedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errors" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");
CREATE UNIQUE INDEX "InventoryItem_labelCode_key" ON "InventoryItem"("labelCode");
CREATE INDEX "CheckLog_sessionId_itemId_idx" ON "CheckLog"("sessionId", "itemId");
ALTER TABLE "CheckLog" ADD CONSTRAINT "CheckLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CheckSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckLog" ADD CONSTRAINT "CheckLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
