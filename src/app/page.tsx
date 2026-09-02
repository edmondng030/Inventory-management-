import AppShell from "@/components/AppShell";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Home(){const user=await currentUser();if(!user)redirect("/login");return <AppShell initialUser={{id:user.id,name:user.name,email:user.email,role:user.role}}/>}
