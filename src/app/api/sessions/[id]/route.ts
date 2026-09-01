import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      { markMissing = false } = await req.json();
    const session = await db.checkSession.findUniqueOrThrow({
      where: { id },
      include: { checkLogs: true },
    });
    await db.$transaction(async (tx) => {
      if (markMissing) {
        const checked = session.checkLogs.map((x) => x.itemId);
        const items = await tx.inventoryItem.findMany({
          where: {
            archivedAt: null,
            ...(session.locationFilter
              ? { OR: [{ userLocation: session.locationFilter }, { location: session.locationFilter }] }
              : {}),
            ...(session.categoryFilter
              ? { category: session.categoryFilter }
              : {}),
          },
        });
        for (const item of items.filter((i) => !checked.includes(i.id))) {
          const next = await tx.inventoryItem.update({
            where: { id: item.id },
            data: { status: "Missing" },
          });
          await tx.auditLog.create({
            data: {
              itemId: item.id,
              action: "MARK_MISSING",
              source: "Manual",
              previousValue: JSON.stringify(item),
              newValue: JSON.stringify(next),
            },
          });
        }
      }
      await tx.checkSession.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
