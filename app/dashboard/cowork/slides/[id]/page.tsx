
import { cookies } from "next/headers";
import { getDeck } from "@/app/actions/cowork";
import SlideEditor from "@/components/cowork/SlideEditor";
import { redirect } from "next/navigation";

function parseJsonCookie(value?: string): Record<string, unknown> | null {
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

export default async function SlidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  if (!session?.value) {
    redirect("/login");
  }

  const user = parseJsonCookie(session.value);
  if (!user) {
    redirect("/login");
  }
  const { success, deck, error } = await getDeck(id);

  if (!success) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Presentation not found</h1>
        <p className="text-slate-500 mb-8">{error}</p>
        <a href="/dashboard/cowork" className="text-indigo-600 hover:underline">
          Go back to dashboard
        </a>
      </div>
    );
  }

  return <SlideEditor initialData={deck} />;
}
