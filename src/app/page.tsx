import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  return <Dashboard />;
}

