import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GlobalRail from "@/components/GlobalRail";
import PBAuthSync from "@/components/PBAuthSync";
import { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  if (!session?.value) {
    redirect("/");
  }

  let user;
  try {
    user = JSON.parse(decodeURIComponent(session.value));
  } catch {
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
