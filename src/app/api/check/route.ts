import { db } from "@/lib/db";
import { sessionItemWhere } from "@/lib/session-scope";
import { matchScan } from "@/lib/scanner";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try {
    const {
      value,
      method = "Manual",
      confidence = 1,
      sessionId,
      itemId,
      candidates,
      userLocation,
    } = await req.json();
    if (userLocation !== undefined && (typeof userLocation !== "string" || userLocation.trim().length > 300)) return apiError(new Error("User／Location 必須為文字，最多 300 字"), 400);
    if (candidates !== undefined && (!Array.isArray(candidates) || candidates.length > 6 || candidates.some((v: unknown) => typeof v !== "string" || v.length > 100))) return apiError(new Error("辨認候選資料無效"), 400);
    const session = sessionId ? await db.checkSession.findUniqueOrThrow({ where: { id: sessionId } }) : null;
    if (session && session.status !== "ACTIVE") throw new Error("此盤點批次已結束");
    const items = await db.inventoryItem.findMany({
      where: { AND: [{ archivedAt: null }, session ? sessionItemWhere(session) : {}] },
      select: { id: true, sku: true, labelCode: true, inventoryCode: true, productCode: true, serialNumber: true, name: true, status: true, userLocation: true, loans: { where: { returnedAt: null }, include: { user: { select: { id: true, name: true } } } } },
    });
    if (candidates && !itemId) return NextResponse.json({ results: candidates.map((candidate: string) => ({ value: candidate, matches: matchScan(candidate, items) })) });
    const matches = matchScan(value, items);
    if (!itemId) return NextResponse.json({ matches });
    if (!items.some(item => item.id === itemId)) throw new Error("此 item 不在本次盤點範圍內或已封存");
    const item = await db.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    if (sessionId) {
      const duplicate = await db.checkLog.findFirst({
        where: { sessionId, itemId },
      });
      if (duplicate)
        return apiError(new Error("此 item 已在本次盤點掃描"), 409);
    }
    const result = await db.$transaction(async (tx) => {
      if (sessionId) {
        await tx.$queryRaw`SELECT id FROM "CheckSession" WHERE id = ${sessionId} FOR UPDATE`;
        const current = await tx.checkSession.findUniqueOrThrow({ where: { id: sessionId } });
        if (current.status !== "ACTIVE") throw new Error("此盤點批次已結束");
        if (await tx.checkLog.findFirst({ where: { sessionId, itemId } })) throw new Error("此 item 已在本次盤點掃描");
      }
      const now = new Date();
      const updated = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { status: "Checked", lastCheckedAt: now, ...(userLocation !== undefined ? { userLocation: userLocation.trim() } : {}) },
      });
      const log = await tx.checkLog.create({
        data: {
          sessionId: sessionId || null,
          itemId,
          detectedValue: value,
          detectionMethod: method,
          confidence,
          previousStatus: item.status,
          newStatus: "Checked",
          checkedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          itemId,
          action: "CHECK",
          source: "Camera Check",
          previousValue: JSON.stringify(item),
          newValue: JSON.stringify(updated),
        },
      });
      return { item: updated, log };
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
