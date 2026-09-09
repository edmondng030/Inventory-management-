import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { sessionItemWhere, sessionStats } from "@/lib/session-scope";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    const departmentId = new URL(req.url).searchParams.get("departmentId");
    const sessions = await db.checkSession.findMany({ where: departmentId ? { departmentId } : {}, orderBy: { createdAt: "desc" }, include: { checkLogs: true } });
    return NextResponse.json(await Promise.all(sessions.map(async session => {
      const items = await db.inventoryItem.findMany({ where: sessionItemWhere(session), select: { id: true, name: true, inventoryCode: true, status: true } });
      const checked = new Set(session.checkLogs.map(log => log.itemId));
      return { ...session, stats: sessionStats(items, session.checkLogs), uncheckedItems: items.filter(i => !checked.has(i.id)) };
    })));
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const b = z.object({ name: z.string().trim().min(1).max(200), departmentId: z.string().min(1, "請先選擇 Inventory／部門"), locationFilter: z.string().max(300).optional(), categoryFilter: z.string().max(300).optional() }).parse(await req.json());
    const session = await db.$transaction(async tx => {
      const department = await tx.department.findUniqueOrThrow({ where: { id: b.departmentId } });
      const scope = { departmentId: department.id, locationFilter: b.locationFilter || null, categoryFilter: b.categoryFilter || null, scopeVersion: 0, expectedItemIds: [] };
      const items = await tx.inventoryItem.findMany({ where: sessionItemWhere(scope), select: { id: true } });
      return tx.checkSession.create({ data: { ...scope, name: b.name, departmentName: department.name, scopeVersion: 1, expectedItemIds: items.map(i => i.id) } });
    });
    return NextResponse.json(session, { status: 201 });
  } catch (error) { return apiError(error); }
}
