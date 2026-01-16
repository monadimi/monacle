import CoworkInterface from "@/components/CoworkInterface";
import { listUserForms, listUserDocs, listUserBoards } from "@/app/actions/cowork";

export const dynamic = "force-dynamic";

export default async function CoworkPage() {
  const [formsRes, docsRes, boardsRes] = await Promise.all([
    listUserForms(),
    listUserDocs(),
    listUserBoards()
  ]);

  const forms = formsRes.success ? formsRes.forms : [];
  const docs = docsRes.success ? docsRes.docs : [];
  const boards = boardsRes.success ? boardsRes.boards : [];

  return <CoworkInterface initialItems={[...(forms as any), ...(docs as any), ...(boards as any)]} />;
}
