import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function GET(){const [count,user]=await Promise.all([db.user.count(),currentUser()]);return NextResponse.json({needsSetup:count===0,user:user?{id:user.id,name:user.name,email:user.email,role:user.role}:null});}
