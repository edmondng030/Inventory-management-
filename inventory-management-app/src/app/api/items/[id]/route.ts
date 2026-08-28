import { db } from "@/lib/db";
import { itemSchema } from "@/lib/inventory";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await db.inventoryItem.findUnique({
    where: { id },
    include: {
      auditLogs: { orderBy: { createdAt: "desc" } },
      checkLogs: { orderBy: { checkedAt: "desc" } },
    },
  });
  return item
    ? NextResponse.json(item)
    : apiError(new Error("找不到 item"), 404);
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      body = await req.json(),
      old = await db.inventoryItem.findUniqueOrThrow({ where: { id } });
    const merged = itemSchema.parse({
      ...old,
      ...body,
      quantity: body.quantity ?? old.quantity,
    });
    const item = await db.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id },
        data: merged,
      });
      await tx.auditLog.create({
        data: {
          itemId: id,
          action: "UPDATE",
          source: body.source || "Manual",
          previousValue: JSON.stringify(old),
          newValue: JSON.stringify(updated),
          quantityChange: updated.quantity - old.quantity,
        },
      });
      return updated;
    });
    return NextResponse.json(item);
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const item = await db.$transaction(async (tx) => {
      const old = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          itemId: id,
          action: "ARCHIVE",
          source: "Manual",
          previousValue: JSON.stringify(old),
          newValue: JSON.stringify(updated),
        },
      });
      return updated;
    });
    return NextResponse.json(item);
  } catch (e) {
    return apiError(e);
  }
}
