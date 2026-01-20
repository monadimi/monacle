
import { cookies } from "next/headers";
import { getSheet } from "@/app/actions/sheets";
import SheetEditor from "@/components/cowork/SheetEditor";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/session";

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  const user = await verifySession(session?.value);
  if (!user) {
    redirect("/login");
  }
  const { success, sheet, error } = await getSheet(id);

  if (!success) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Sheet not found</h1>
        <p className="text-slate-500 mb-8">{error}</p>
        <a href="/dashboard/cowork" className="text-indigo-600 hover:underline">
          Go back to dashboard
        </a>
      </div>
    );
  }

  return <SheetEditor initialData={sheet} currentUser={user} />;
}
