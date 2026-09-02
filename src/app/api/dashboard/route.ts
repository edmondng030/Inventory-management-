import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const departmentId = new URL(req.url).searchParams.get("departmentId") || undefined;
  const items = await db.inventoryItem.findMany({
      where: { archivedAt: null, departmentId },
    }),
    recent = await db.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { item: { select: { name: true, sku: true } } }, where: departmentId ? { item: { departmentId } } : undefined,
    });
  return NextResponse.json({
    totalItems: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    checked: items.filter((i) => i.status === "Checked").length,
    unchecked: items.filter((i) => i.status !== "Checked").length,
    recent,
  });
}
