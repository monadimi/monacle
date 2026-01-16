import Ideaboard from "@/components/cowork/Ideaboard";
import { getBoard } from "@/app/actions/cowork";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getBoard(id);

  if (!result.success || !result.board) {
    if (result.error?.includes("404")) {
      notFound();
    }
    return <div>Error loading board: {result.error}</div>;
  }

  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");
  const user = session?.value ? JSON.parse(session.value) : null;

  if (!user) {
    redirect("/");
  }

  return <Ideaboard initialData={result.board as any} currentUser={user} />;
}
