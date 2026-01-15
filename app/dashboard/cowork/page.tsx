import CoworkInterface from "@/components/CoworkInterface";
import { listUserForms } from "@/app/actions/cowork";

export const dynamic = "force-dynamic";

export default async function CoworkPage() {
  const result = await listUserForms();
  const forms = result.success ? result.forms : [];

  return <CoworkInterface initialForms={forms} />;
}
