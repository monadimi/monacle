import FormBuilder from "@/components/cowork/FormBuilder";
import { getForm } from "@/app/actions/cowork";
import { notFound } from "next/navigation";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getForm(id);

  if (!result.success || !result.form) {
    if (result.error?.includes("404")) {
      notFound();
    }
    // Handle specific errors or show error state? For now, we fallback or just let Builder handle empty if needed, 
    // but better to show error.
    // However, if creating a NEW form via a different flow, we might not have it yet. 
    // But our plan is create-then-redirect. So it should exist.
    // If it fails, maybe unauthorized?
    return <div>Error loading form: {result.error}</div>;
  }

  return <FormBuilder formId={id} initialData={result.form} />;
}
