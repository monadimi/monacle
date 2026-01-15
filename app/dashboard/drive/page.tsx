import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DriveInterface from "@/components/DriveInterface";

export default async function DrivePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  if (!session?.value) {
    redirect("/");
  }

  let user;
  try {
    user = JSON.parse(session.value);
  } catch {
    redirect("/");
  }

  // user is passed to DriveInterface
  return <DriveInterface user={user} />;
}
