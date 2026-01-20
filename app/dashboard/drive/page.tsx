import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DriveInterface from "@/components/DriveInterface";
import { verifySession } from "@/lib/session";

export default async function DrivePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  if (!session?.value) {
    redirect("/");
  }

  let user;
  if (session?.value) {
    user = await verifySession(session.value);
    if (!user) redirect("/");
  } else {
    redirect("/");
  }

  // user is passed to DriveInterface
  return <DriveInterface user={user} />;
}
