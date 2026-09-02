import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { NextResponse } from "next/server";
export async function GET(){try{await requireUser();return NextResponse.json(await db.department.findMany({orderBy:{name:"asc"},include:{_count:{select:{items:true,users:true}}}}))}catch(e){return apiError(e,401)}}
export async function POST(req:Request){try{const user=await requireUser();if(user.role!=="ADMIN")return NextResponse.json({error:"只有管理員可建立 Inventory"},{status:403});const {name}=await req.json();const clean=String(name||"").trim();if(clean.length<2)throw new Error("Inventory／部門名稱至少 2 個字元");return NextResponse.json(await db.department.create({data:{name:clean}}),{status:201})}catch(e){return apiError(e)}}
