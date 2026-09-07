import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return NextResponse.json({ error: "只有管理員可刪除 Inventory／部門" }, { status: 403 });
    const { id } = await params;
    const result = await db.$transaction(async tx => {
      const department = await tx.department.findUniqueOrThrow({ where: { id } });
      const items = await tx.inventoryItem.findMany({ where: { departmentId: id } });
      for (const item of items) {
        const updated = await tx.inventoryItem.update({ where: { id: item.id }, data: { departmentId: null } });
        await tx.auditLog.create({ data: { itemId: item.id, action: "INVENTORY_DELETED_UNASSIGN", source: "Manual", previousValue: JSON.stringify(item), newValue: JSON.stringify(updated), performedBy: user.name } });
      }
      const users = await tx.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
      await tx.department.delete({ where: { id } });
      return { name: department.name, itemCount: items.length, userCount: users.count };
    });
    return NextResponse.json(result);
  } catch (e) { return apiError(e); }
}
