import { db } from "@/lib/db";
import { itemSchema } from "@/lib/inventory";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const u = new URL(req.url),
    q = (u.searchParams.get("q") || "").trim(),
    status = u.searchParams.get("status") || "",
    category = u.searchParams.get("category") || "",
    location = u.searchParams.get("location") || "",
    departmentId = u.searchParams.get("departmentId") || "";
  const archive = u.searchParams.get("archive") || "all";
  if (!["active", "archived", "all"].includes(archive)) return apiError(new Error("封存篩選無效"), 400);
  const items = await db.inventoryItem.findMany({
    where: {
      ...(archive === "all" ? {} : { archivedAt: archive === "archived" ? { not: null } : null }),
      AND: [
        q
          ? {
              OR: [
                ...["inventoryCode", "productCode", "serialNumber", "userLocation", "sku", "labelCode", "name", "poNumber", "description", "remark", "location", "category", "id"].map(field => ({ [field]: { contains: q, mode: "insensitive" as const } })),
                { department: { name: { contains: q, mode: "insensitive" } } },
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
      const identifiers = ["inventoryCode", "sku", "labelCode"] as const;
      const existing = await tx.inventoryItem.findFirst({
        where: { OR: identifiers.filter(key => data[key]).map(key => ({ [key]: { equals: data[key]!, mode: "insensitive" as const } })) },
        include: { department: true },
      });
      if (existing) {
        const key = identifiers.find(key => data[key] && existing[key]?.toLowerCase() === data[key]?.toLowerCase())!;
        const label = { inventoryCode: "Inventory Code", sku: "SKU", labelCode: "Label Code" }[key];
        return { conflict: `${label}「${data[key]}」已被「${existing.name}」使用（${existing.department?.name || "未分配部門"}${existing.archivedAt ? "，已封存" : ""}）。請使用不同編號；如屬同一 item，請編輯原有項目。` };
      }
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
    if ("conflict" in item) return NextResponse.json({ error: item.conflict }, { status: 409 });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
