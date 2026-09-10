import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const item = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "InventoryItem" WHERE id = ${id} FOR UPDATE`;
      const old = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      if (!old.archivedAt) return old;
      const updated = await tx.inventoryItem.update({ where: { id }, data: { archivedAt: null } });
      await tx.auditLog.create({ data: { itemId: id, action: "RESTORE", source: "Manual", performedBy: user.name, previousValue: JSON.stringify(old), newValue: JSON.stringify(updated), quantityChange: 0 } });
      return updated;
    });
    return NextResponse.json(item);
  } catch (error) { return apiError(error); }
}
