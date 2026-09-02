import { endSession } from "@/lib/auth";
import { NextResponse } from "next/server";
export async function POST(){await endSession();return NextResponse.json({ok:true});}
