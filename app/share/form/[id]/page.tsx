import FormViewer from "@/components/cowork/FormViewer";
import { getForm } from "@/app/actions/cowork";
import { notFound } from "next/navigation";

export default async function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getForm(id);

  if (!result.success || !result.form) {
    notFound(); // Public view should probably just 404 on error
  }

  return <FormViewer formId={id} initialData={result.form} />;
}
