/**
 * @file app/dashboard/page.tsx
 * @purpose Entry point for dashboard, redirects to default view.
 * @scope Routing redirection.
 */
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/dashboard/drive");
}
