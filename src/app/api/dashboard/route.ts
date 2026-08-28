import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() {
  const items = await db.inventoryItem.findMany({
      where: { archivedAt: null },
    }),
    recent = await db.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { item: { select: { name: true, sku: true } } },
    });
  return NextResponse.json({
    totalItems: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    checked: items.filter((i) => i.status === "Checked").length,
    unchecked: items.filter((i) => i.status !== "Checked").length,
    low: items.filter((i) => i.quantity <= i.minimumStock).length,
    recent,
  });
}
