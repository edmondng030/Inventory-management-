import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { STATUSES } from "@/lib/inventory";

const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "請選擇 item").max(1000, "每次最多處理 1000 個 items")
    .transform((values) => [...new Set(values)]),
  status: z.enum(STATUSES).optional(),
  archive: z.boolean().optional(),
  departmentId: z.string().min(1).optional(),
}).refine(
  (data) => [Boolean(data.status), data.archive === true, Boolean(data.departmentId)].filter(Boolean).length === 1,
  "請選擇一項批量操作",
);

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { ids, status, archive, departmentId } = bulkActionSchema.parse(await req.json());
    const target = departmentId ? await db.department.findUnique({ where: { id: departmentId } }) : null;
    if (departmentId && !target) throw new Error("找不到目標 Inventory／部門");
    let updatedCount = 0;
    let skippedCount = 0;
    await db.$transaction(async (tx) => {
      for (const id of ids) {
        const old = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
        const shouldSkip = old.archivedAt
          || (status && (old.status === "Borrowed" || old.status === status))
          || (archive && old.status === "Borrowed")
          || (departmentId && old.departmentId === departmentId);
        if (shouldSkip) {
          skippedCount++;
          continue;
        }
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
