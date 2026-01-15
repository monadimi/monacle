import CoworkInterface from "@/components/CoworkInterface";
import { listUserForms, listUserDocs } from "@/app/actions/cowork";

export const dynamic = "force-dynamic";

export default async function CoworkPage() {
  const [formsRes, docsRes] = await Promise.all([
    listUserForms(),
    listUserDocs()
  ]);

  const forms = formsRes.success ? formsRes.forms : [];
  const docs = docsRes.success ? docsRes.docs : [];

  return <CoworkInterface initialItems={[...(forms as any), ...(docs as any)]} />;
}
