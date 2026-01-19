import SheetEditor from "@/components/cowork/SheetEditor";
import { getSheet } from "@/app/actions/sheets";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import PBAuthSync from "@/components/PBAuthSync";

export default async function PublicSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSheet(id);

  if (!result.success || !result.sheet) {
    notFound();
  }

  // Security check: Only allow if is_shared is true
  if (!result.sheet.is_shared) {
    notFound();
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");
  const user = session?.value ? JSON.parse(session.value) : null;

  const canEdit = false; // Sheets sharing is currently View-Only MVP

  return (
    <>
      <PBAuthSync token={user?.token} />
      <div className="w-full h-[100dvh] overflow-hidden">
        <SheetEditor initialData={result.sheet} currentUser={user} readOnly={!canEdit} />
      </div>
    </>
  );
}
