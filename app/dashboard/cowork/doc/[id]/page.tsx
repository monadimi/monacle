import DocEditor from "@/components/cowork/DocEditor";
import { getDoc } from "@/app/actions/cowork";
import { notFound } from "next/navigation";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getDoc(id);

  if (!result.success || !result.doc) {
    if (result.error?.includes("404")) {
      notFound();
    }
    return <div>Error loading document: {result.error}</div>;
  }

  return <DocEditor docId={id} initialData={result.doc} />;
}
