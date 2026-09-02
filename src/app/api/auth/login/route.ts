import { db } from "@/lib/db";
import { startSession,verifyPassword } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function POST(req:Request){const {email,password}=await req.json();const user=await db.user.findUnique({where:{email:String(email).trim().toLowerCase()}});if(!user||!(await verifyPassword(String(password),user.passwordHash)))return NextResponse.json({error:"電郵或密碼不正確"},{status:401});await startSession(user.id);return NextResponse.json({id:user.id,name:user.name,email:user.email,role:user.role});}
