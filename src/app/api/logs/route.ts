import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    audits: await db.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: { item: { select: { name: true, sku: true } } },
    }),
    checks: await db.checkLog.findMany({
      take: 100,
      orderBy: { checkedAt: "desc" },
      include: {
        item: { select: { name: true, sku: true } },
        session: { select: { name: true } },
      },
    }),
    imports: await db.importJob.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
    }),
    loans: await db.loan.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { item: { select: { name: true, sku: true, inventoryCode: true } }, user: { select: { name: true } } } }),
  });
}
