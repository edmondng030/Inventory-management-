import { db } from "@/lib/db";
import { hashPassword,startSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function POST(req:Request){try{if(await db.user.count())return NextResponse.json({error:"系統已完成初始設定"},{status:409});const {name,email,password}=await req.json();if(!String(name).trim()||!/^\S+@\S+\.\S+$/.test(String(email))||String(password).length<8)throw new Error("請輸入名稱、有效電郵及至少 8 位密碼");const user=await db.user.create({data:{name:String(name).trim(),email:String(email).trim().toLowerCase(),passwordHash:await hashPassword(String(password)),role:"ADMIN"}});await startSession(user.id);return NextResponse.json({id:user.id,name:user.name,email:user.email,role:user.role},{status:201});}catch(e){return apiError(e)}}
