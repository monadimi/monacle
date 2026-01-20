import DocEditor from "@/components/cowork/DocEditor";
import { getDoc } from "@/app/actions/cowork";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";

import { verifySession } from "@/lib/session";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getDoc(id);

  if (!result.success || !result.doc) {
    if (result.error?.includes("404")) {
      notFound();
    }
    return <div>Error loading document: {result.error}</div>;
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");
  const user = await verifySession(session?.value);

  if (!user) {
    redirect("/");
  }

  return <DocEditor docId={id} initialData={result.doc as any} currentUser={user} />;
}
