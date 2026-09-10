import { NextResponse } from "next/server";
export function apiError(error: unknown, status = 400) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return NextResponse.json({ error: "Inventory Code、SKU 或 Label Code 已存在（包括其他部門或已封存的 item）。請使用不同編號，或編輯原有項目。" }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "要求無法處理";
  return NextResponse.json({ error: message }, { status });
}
