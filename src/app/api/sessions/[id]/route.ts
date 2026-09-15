import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sessionItemWhere } from "@/lib/session-scope";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      { markMissing = false } = await req.json();
    await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "CheckSession" WHERE id = ${id} FOR UPDATE`;
    const session = await tx.checkSession.findUniqueOrThrow({
      where: { id },
      include: { checkLogs: true },
    });
      if (session.status !== "ACTIVE") throw new Error("此盤點批次已結束");
      if (markMissing) {
        const checked = session.checkLogs.map((x) => x.itemId);
        const items = await tx.inventoryItem.findMany({
          where: { AND: [sessionItemWhere(session), { archivedAt: null }] },
        });
        for (const item of items.filter((i) => !checked.includes(i.id))) {
          const next = await tx.inventoryItem.update({
            where: { id: item.id },
            data: { status: "Missing" },
          });
          await tx.auditLog.create({
            data: {
              itemId: item.id,
              action: "MARK_MISSING",
              source: "Manual",
              previousValue: JSON.stringify(item),
              newValue: JSON.stringify(next),
            },
          });
        }
      }
      await tx.checkSession.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return apiError(new Error("只限管理員刪除盤點批次"), 403);
    const { id } = await params;
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CheckSession" WHERE id = ${id} FOR UPDATE`;
      const session = await tx.checkSession.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true, status: true, _count: { select: { checkLogs: true } } },
      });
      await tx.checkLog.updateMany({ where: { sessionId: id }, data: { sessionId: null } });
      await tx.checkSession.delete({ where: { id } });
      return { ok: true, name: session.name, preservedCheckLogs: session._count.checkLogs };
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
