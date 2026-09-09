import type { Prisma } from "@prisma/client";

type Scope = { scopeVersion: number; expectedItemIds: string[]; departmentId: string | null; locationFilter: string | null; categoryFilter: string | null };
export function sessionItemWhere(session: Scope): Prisma.InventoryItemWhereInput {
  if (session.scopeVersion >= 1) return { id: { in: session.expectedItemIds } };
  return {
    archivedAt: null,
    ...(session.departmentId ? { departmentId: session.departmentId } : {}),
    ...(session.locationFilter ? { OR: [{ userLocation: session.locationFilter }, { location: session.locationFilter }] } : {}),
    ...(session.categoryFilter ? { category: session.categoryFilter } : {}),
  };
}
export function sessionStats(items: { id: string; status: string }[], logs: { itemId: string }[]) {
  const checked = new Set(logs.map(log => log.itemId));
  return { expected: items.length, checked: items.filter(i => checked.has(i.id)).length, unchecked: items.filter(i => !checked.has(i.id)).length, missing: items.filter(i => i.status === "Missing" && !checked.has(i.id)).length };
}
