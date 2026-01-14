import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DriveInterface from "@/components/DriveInterface";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  if (!session?.value) {
    redirect("/");
  }

  let user;
  try {
    user = JSON.parse(session.value);
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50/50 relative">
      {/* Background is handled by globals.css */}
      <DriveInterface user={user} />
    </div>
  );
}
