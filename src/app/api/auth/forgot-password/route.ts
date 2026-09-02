import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function POST(req:Request){const {email}=await req.json();const user=await db.user.findUnique({where:{email:String(email||"").trim().toLowerCase()}});if(user?.active&&!user.deletedAt){const pending=await db.passwordResetRequest.findFirst({where:{userId:user.id,status:"PENDING"}});if(!pending)await db.passwordResetRequest.create({data:{userId:user.id}});}return NextResponse.json({message:"如帳戶存在，重設申請已送交管理員。請聯絡管理員取得臨時密碼。"});}
