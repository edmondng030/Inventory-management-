import { db } from "@/lib/db";
import { itemSchema } from "@/lib/inventory";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const u = new URL(req.url),
    q = u.searchParams.get("q") || "",
    status = u.searchParams.get("status") || "",
    category = u.searchParams.get("category") || "",
    location = u.searchParams.get("location") || "",
    departmentId = u.searchParams.get("departmentId") || "";
  const items = await db.inventoryItem.findMany({
    where: {
      archivedAt: null,
      AND: [
        q
          ? {
              OR: [
                { inventoryCode: { contains: q } },
                { productCode: { contains: q } },
                { serialNumber: { contains: q } },
                { userLocation: { contains: q } },
                { sku: { contains: q } },
                { labelCode: { contains: q } },
                { name: { contains: q } },
              ],
            }
          : {},
        status ? { status } : {},
        category ? { category } : {},
        location ? { OR: [{ userLocation: { contains: location } }, { location }] } : {},
        departmentId ? { departmentId } : {},
      ],
    },
    orderBy: { updatedAt: "desc" }, include: { department: true, loans: { where: { returnedAt: null }, include: { user: { select: { id: true, name: true } } } } },
  });
  return NextResponse.json(items);
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = itemSchema.parse(body);
    const item = await db.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({ data: { ...data, departmentId: body.departmentId || null } });
      await tx.auditLog.create({
        data: {
          itemId: created.id,
          action: "CREATE",
          source: "Manual",
          newValue: JSON.stringify(created),
        },
      });
      return created;
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
