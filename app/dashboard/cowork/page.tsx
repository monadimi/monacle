import CoworkInterface from "@/components/CoworkInterface";
import { listUserForms, listUserDocs, listUserBoards, listUserDecks } from "@/app/actions/cowork";
import { listUserSheets } from "@/app/actions/sheets";

export const dynamic = "force-dynamic";

export default async function CoworkPage() {
  const [formsRes, docsRes, boardsRes, decksRes, sheetsRes] = await Promise.all([
    listUserForms(),
    listUserDocs(),
    listUserBoards(),
    listUserDecks(),
    listUserSheets()
  ]);

  const forms = formsRes.success ? formsRes.forms : [];
  const docs = docsRes.success ? docsRes.docs : [];
  const boards = boardsRes.success ? boardsRes.boards : [];
  const decks = decksRes.success ? decksRes.decks : [];
  const sheets = sheetsRes.success ? sheetsRes.items : [];

  return <CoworkInterface initialItems={[
    ...(forms as any), 
    ...(docs as any), 
    ...(boards as any), 
    ...(decks as any),
    ...(sheets as any)
  ]} />;
}
