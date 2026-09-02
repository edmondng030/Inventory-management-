import { db } from "@/lib/db";
import { hashPassword, requireUser, startSession, verifyPassword } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function POST(req:Request){const user=await requireUser();const {currentPassword,newPassword}=await req.json();if(String(newPassword).length<8)return NextResponse.json({error:"新密碼至少需要 8 位"},{status:400});if(!(await verifyPassword(String(currentPassword),user.passwordHash)))return NextResponse.json({error:"目前密碼不正確"},{status:400});const passwordHash=await hashPassword(String(newPassword));await db.$transaction([db.user.update({where:{id:user.id},data:{passwordHash}}),db.authSession.deleteMany({where:{userId:user.id}})]);await startSession(user.id);return NextResponse.json({ok:true});}
