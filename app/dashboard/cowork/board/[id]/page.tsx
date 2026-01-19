import Ideaboard from "@/components/cowork/Ideaboard";
import { getBoard } from "@/app/actions/cowork";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";

type UserSession = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
};

function parseUserCookie(value?: string): UserSession | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

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
  const user = parseUserCookie(session?.value);

  if (!user || !user.id || !user.email || !user.name) {
    redirect("/");
  }

  return <Ideaboard initialData={result.board as any} currentUser={user} />;
}
