import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const { ids, status, archive } = await req.json();
    if (!Array.isArray(ids) || !ids.length) throw new Error("請選擇 item");
    await db.$transaction(async (tx) => {
      for (const id of ids) {
        const old = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
        const data = archive ? { archivedAt: new Date() } : { status };
        const next = await tx.inventoryItem.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            itemId: id,
            action: archive ? "ARCHIVE" : "BULK_STATUS",
            source: "Manual",
            previousValue: JSON.stringify(old),
            newValue: JSON.stringify(next),
          },
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
