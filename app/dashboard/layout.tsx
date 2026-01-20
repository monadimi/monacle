import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GlobalRail from "@/components/GlobalRail";
import PBAuthSync from "@/components/PBAuthSync";
import { verifySession } from "@/lib/session";
import { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  if (!session?.value) {
    redirect("/");
  }

  const user = await verifySession(session.value);
  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <PBAuthSync token={user?.token} />
      <GlobalRail user={user} />
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>
    </div>
  );
}
