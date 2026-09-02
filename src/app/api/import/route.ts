import { db } from "@/lib/db";
import { itemSchema } from "@/lib/inventory";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.rows) || body.rows.length > 10000)
      throw new Error("資料列數不可超過 10,000");
    let inserted = 0,
      updated = 0,
      skipped = 0;
    const errors: { row: number; message: string }[] = [];
    await db.$transaction(async (tx) => {
      for (let n = 0; n < body.rows.length; n++) {
        try {
          const data = itemSchema.parse(body.rows[n]);
          const departmentId = body.departmentId || null;
          const old = await tx.inventoryItem.findFirst({
            where: {
              OR: [
                ...(data.inventoryCode ? [{ inventoryCode: data.inventoryCode }] : []),
                ...(data.sku ? [{ sku: data.sku }] : []),
                ...(data.labelCode ? [{ labelCode: data.labelCode }] : []),
              ],
            },
          });
          if (old) {
            const next = await tx.inventoryItem.update({
              where: { id: old.id },
              data: { ...data, departmentId },
            });
            await tx.auditLog.create({
              data: {
                itemId: old.id,
                action: "IMPORT_UPDATE",
                source: "Excel Import",
                previousValue: JSON.stringify(old),
                newValue: JSON.stringify(next),
                quantityChange: next.quantity - old.quantity,
              },
            });
            updated++;
          } else {
            const next = await tx.inventoryItem.create({ data: { ...data, departmentId } });
            await tx.auditLog.create({
              data: {
                itemId: next.id,
                action: "IMPORT_CREATE",
                source: "Excel Import",
                newValue: JSON.stringify(next),
              },
            });
            inserted++;
          }
        } catch (e) {
          skipped++;
          errors.push({
            row: n + 2,
            message: e instanceof Error ? e.message : "錯誤",
          });
        }
      }
      await tx.importJob.create({
        data: {
          fileName: String(body.fileName || "upload.xlsx"),
          insertedCount: inserted,
          updatedCount: updated,
          skippedCount: skipped,
          errorCount: errors.length,
          errors: JSON.stringify(errors),
        },
      });
    });
    return NextResponse.json({ inserted, updated, skipped, errors });
  } catch (e) {
    return apiError(e);
  }
}
