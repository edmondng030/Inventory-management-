import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth/")) return NextResponse.next();
  const user = await currentUser();
  if (user) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|templates/).*)"] };
