import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "@/lib/db";

const scrypt = promisify(nodeScrypt);
const COOKIE = "inventory_session";
export async function hashPassword(password: string) { const salt=randomBytes(16).toString("hex"); const hash=(await scrypt(password,salt,64)) as Buffer; return `${salt}:${hash.toString("hex")}`; }
export async function verifyPassword(password:string, stored:string) { const [salt,hex]=stored.split(":"); if(!salt||!hex)return false; const expected=Buffer.from(hex,"hex"); const actual=(await scrypt(password,salt,expected.length)) as Buffer; return expected.length===actual.length&&timingSafeEqual(expected,actual); }
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
export async function startSession(userId:string) { const token=randomBytes(32).toString("hex"); const expiresAt=new Date(Date.now()+30*86400000); await db.authSession.create({data:{userId,tokenHash:digest(token),expiresAt}}); (await cookies()).set(COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",expires:expiresAt}); }
export async function currentUser() { const token=(await cookies()).get(COOKIE)?.value; if(!token)return null; const session=await db.authSession.findUnique({where:{tokenHash:digest(token)},include:{user:{include:{department:true}}}}); return session&&session.expiresAt>new Date()?session.user:null; }
export async function requireUser(){const user=await currentUser();if(!user)throw new Error("請先登入");return user;}
export async function endSession(){const store=await cookies();const token=store.get(COOKIE)?.value;if(token)await db.authSession.deleteMany({where:{tokenHash:digest(token)}});store.delete(COOKIE);}
