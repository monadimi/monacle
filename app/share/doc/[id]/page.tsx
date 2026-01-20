import DocEditor from "@/components/cowork/DocEditor";
import { getDoc } from "@/app/actions/cowork";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import PBAuthSync from "@/components/PBAuthSync";

import { verifySession } from "@/lib/session";

export default async function PublicDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getDoc(id);

  if (!result.success || !result.doc) {
    notFound();
  }

  // Security check: Only allow if is_shared is true
  if (!result.doc.is_shared) {
    notFound();
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");
  const user = await verifySession(session?.value);

  const canEdit = result.doc.share_type === 'edit' && !!user;

  return (
    <>
      <PBAuthSync token={user?.token} />
      <DocEditor docId={id} initialData={result.doc as any} readOnly={!canEdit} currentUser={user} />
    </>
  );
}
