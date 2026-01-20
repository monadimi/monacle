/**
 * @file app/page.tsx
 * @purpose Public entry point and login interface for Monacle.
 * @scope Session check, Redirection, Login UI Rendering.
 * @failure-behavior Redirects to dashboard if logged in, otherwise shows LoginInterface.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginInterface from "@/components/LoginInterface";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("monacle_session");

  console.log("[LoginPage] Server Session Check:", {
    hasSession: !!session,
    valueLength: session?.value?.length,
    cookies: cookieStore.getAll().map(c => c.name)
  });

  if (session?.value) {
    try {
      const parsed = JSON.parse(decodeURIComponent(session.value));
      if (parsed?.token) {
        redirect("/dashboard");
      }
    } catch {
      // invalid cookie, ignore
    }
  }

  return <LoginInterface />;
}
