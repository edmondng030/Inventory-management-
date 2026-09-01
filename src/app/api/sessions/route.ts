import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function GET() {
  const sessions = await db.checkSession.findMany({
    orderBy: { createdAt: "desc" },
    include: { checkLogs: true },
  });
  const all = await db.inventoryItem.findMany({ where: { archivedAt: null } });
  return NextResponse.json(
    sessions.map((s) => {
      const expected = all.filter(
        (i) =>
          (!s.locationFilter || i.userLocation === s.locationFilter || i.location === s.locationFilter) &&
          (!s.categoryFilter || i.category === s.categoryFilter),
      );
      const checked = new Set(s.checkLogs.map((l) => l.itemId));
      return {
        ...s,
        stats: {
          expected: expected.length,
          checked: checked.size,
          unchecked: expected.filter((i) => !checked.has(i.id)).length,
          missing: expected.filter((i) => i.status === "Missing").length,
        },
      };
    }),
  );
}
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!String(b.name || "").trim()) throw new Error("Session Name 為必填");
    return NextResponse.json(
      await db.checkSession.create({
        data: {
          name: b.name.trim(),
          locationFilter: b.locationFilter || null,
          categoryFilter: b.categoryFilter || null,
        },
      }),
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
