import { db } from "@/lib/db";
import { exportCell } from "@/lib/excel";
import * as XLSX from "xlsx";
export async function GET(req: Request) {
  const u = new URL(req.url),
    sessionId = u.searchParams.get("sessionId");
  const items = await db.inventoryItem.findMany({
    where: { archivedAt: null },
    orderBy: { sku: "asc" },
  });
  const checks = await db.checkLog.findMany({
    where: sessionId ? { sessionId } : {},
    include: { item: true, session: true },
    orderBy: { checkedAt: "desc" },
  });
  const audits = await db.auditLog.findMany({
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });
  const inventory = items.map((i) => ({
    "PO No.": exportCell(i.poNumber),
    "Inventory Code": exportCell(i.inventoryCode),
    "Product Code": exportCell(i.productCode),
    "Product Description": exportCell(i.name),
    Qty: i.quantity,
    "Serial No.": exportCell(i.serialNumber),
    "User/ Location": exportCell(i.userLocation || i.location),
    Status: i.status === "Checked" ? "Y" : i.status === "Unchecked" ? "N" : i.status,
    SKU: exportCell(i.sku),
    "Label Code": exportCell(i.labelCode),
    Description: exportCell(i.description),
    Category: exportCell(i.category),
    Unit: exportCell(i.unit),
    Location: exportCell(i.location),
    "Minimum Stock": i.minimumStock,
    Remark: exportCell(i.remark),
    "Last Checked At": i.lastCheckedAt?.toISOString() || "",
    "Updated At": i.updatedAt.toISOString(),
  }));
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({
      wch: Math.min(40, Math.max(12, k.length + 4)),
    }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Inventory", inventory);
  add(
    "Check Logs",
    checks.map((l) => ({
      Session: l.session?.name || "",
      SKU: l.item.sku,
      Item: l.item.name,
      Detected: l.detectedValue,
      Method: l.detectionMethod,
      Confidence: l.confidence,
      CheckedAt: l.checkedAt.toISOString(),
      CheckedBy: l.checkedBy,
    })),
  );
  add(
    "Audit Logs",
    audits.map((a) => ({
      SKU: a.item.sku,
      Item: a.item.name,
      Action: a.action,
      Source: a.source,
      QuantityChange: a.quantityChange,
      PerformedBy: a.performedBy,
      CreatedAt: a.createdAt.toISOString(),
    })),
  );
  add("Summary", [
    {
      TotalItems: items.length,
      TotalQuantity: items.reduce((s, i) => s + i.quantity, 0),
      Checked: items.filter((i) => i.status === "Checked").length,
      ExportedAt: new Date().toISOString(),
    },
  ]);
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  return new Response(out, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventory-export-${stamp}.xlsx"`,
    },
  });
}
