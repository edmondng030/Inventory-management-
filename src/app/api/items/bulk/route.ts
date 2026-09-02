import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { ids, status, archive, departmentId } = await req.json();
    if (!Array.isArray(ids) || !ids.length) throw new Error("請選擇 item");
    const target = departmentId ? await db.department.findUnique({ where: { id: departmentId } }) : null;
    if (departmentId && !target) throw new Error("找不到目標 Inventory／部門");
    let updatedCount = 0;
    let skippedCount = 0;
    await db.$transaction(async (tx) => {
      for (const id of ids) {
        const old = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
        if (departmentId && old.departmentId === departmentId) { skippedCount++; continue; }
        const data = departmentId ? { departmentId } : archive ? { archivedAt: new Date() } : { status };
        const next = await tx.inventoryItem.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            itemId: id,
            action: departmentId ? "TRANSFER_INVENTORY" : archive ? "ARCHIVE" : "BULK_STATUS",
            source: "Manual",
            previousValue: JSON.stringify(old),
            newValue: JSON.stringify(next),
            performedBy: user.name,
          },
        });
        updatedCount++;
      }
    });
    return NextResponse.json({ ok: true, updatedCount, skippedCount, targetName: target?.name });
  } catch (e) {
    return apiError(e);
  }
}
