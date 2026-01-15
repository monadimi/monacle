"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

// Server Action to Create a New Form
export async function createForm(
  title: string = "새로운 설문지",
  description: string = "설문지에 대한 설명을 입력해주세요."
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    const data = {
      title,
      description,
      author: user.id,
      questions: JSON.stringify([
        { id: "q1", type: "short", title: "질문 1", required: false },
      ]),
      isActive: true,
      viewCount: 0,
      responseCount: 0,
      is_shared: false,
      share_type: "none",
      is_deleted: false,
    };

    const record = await pb.collection("forms").create(data);
    return { success: true, id: record.id };
  } catch (error: unknown) {
    console.error("Create Form Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Server Action to Get a Form
export async function getForm(id: string) {
  try {
    const pb = await getAdminClient();
    const record = await pb.collection("forms").getOne(id);

    // Parse questions from JSON
    let questions = record.questions;
    if (typeof questions === "string") {
      try {
        questions = JSON.parse(questions);
      } catch {
        questions = [];
      }
    }

    return {
      success: true,
      form: {
        id: record.id,
        title: record.title,
        description: record.description,
        questions: questions,
        author: record.author,
      },
    };
  } catch (error: unknown) {
    console.error("Get Form Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Server Action to Deletete/Toggle a Form
export async function deleteForm(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();
    const form = await pb.collection("forms").getOne(id);
    if (form.author !== user.id) throw new Error("Forbidden");

    await pb.collection("forms").update(id, { is_deleted: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Server Action to Update a Form
export async function updateForm(
  id: string,
  data: {
    title?: string;
    description?: string;
    questions?: Record<string, unknown>[];
  }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    // Verify Ownership
    const record = await pb.collection("forms").getOne(id);
    if (record.author !== user.id) {
      throw new Error("Forbidden: You are not the author of this form");
    }

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.questions !== undefined)
      updateData.questions = JSON.stringify(data.questions);

    await pb.collection("forms").update(id, updateData);
    return { success: true };
  } catch (error: unknown) {
    console.error("Update Form Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Server Action to Submit a Response
export async function submitResponse(
  formId: string,
  answers: Record<string, unknown>
) {
  try {
    const pb = await getAdminClient();

    const data = {
      form: formId,
      answers: JSON.stringify(answers),
    };

    await pb.collection("form_responses").create(data);

    // Increment response count on form
    try {
      const form = await pb.collection("forms").getOne(formId);
      await pb
        .collection("forms")
        .update(formId, { responseCount: (form.responseCount || 0) + 1 });
    } catch {
      // ignore stat update error
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Submit Response Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Server Action to List User Forms (for Dashboard)
export async function listUserForms() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();
    const records = await pb.collection("forms").getList(1, 50, {
      filter: `author = "${user.id}"`,
      sort: "-created",
    });

    return { success: true, forms: records.items };
  } catch (error: unknown) {
    console.error("List Forms Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Server Action to Get Form Responses
export async function getFormResponses(formId: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    // Verify Ownership first
    const form = await pb.collection("forms").getOne(formId);
    if (form.author !== user.id) {
      throw new Error("Forbidden");
    }

    const records = await pb.collection("form_responses").getList(1, 100, {
      // Limit 100 for now
      filter: `form = "${formId}"`,
      sort: "-created",
    });

    // Parse answers JSON
    const responses = records.items.map((r) => {
      let answers = r.answers;
      if (typeof answers === "string") {
        try {
          answers = JSON.parse(answers);
        } catch {
          answers = {};
        }
      }
      return {
        id: r.id,
        created: r.created,
        answers,
      };
    });

    return { success: true, responses };
  } catch (error: unknown) {
    console.error("Get Responses Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Server Action to Toggle Form Status
export async function toggleFormStatus(formId: string, isActive: boolean) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    // Verify Ownership
    const form = await pb.collection("forms").getOne(formId);
    if (form.author !== user.id) {
      throw new Error("Forbidden");
    }

    await pb.collection("forms").update(formId, { isActive });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
// --- Document Actions (Monacle Docs) ---

export async function createDoc(
  title: string = "제목 없는 문서",
  content: string = "",
  parentId: string | null = null
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    const data = {
      title,
      content,
      author: user.id,
      isActive: true,
      tVersion: 1,
      is_shared: false,
      share_type: "none",
      is_deleted: false,
      parent_id: parentId || "",
    };

    const record = await pb.collection("docs").create(data);
    return { success: true, id: record.id };
  } catch (error: unknown) {
    console.error("Create Doc Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getDoc(id: string) {
  try {
    const pb = await getAdminClient();
    const record = await pb.collection("docs").getOne(id);

    return {
      success: true,
      doc: {
        id: record.id,
        title: record.title,
        content: record.content,
        author: record.author,
        tVersion: record.tVersion,
        updated: record.updated,
        is_shared: record.is_shared,
        share_type: record.share_type,
        parent_id: record.parent_id,
      },
    };
  } catch (error: unknown) {
    console.error("Get Doc Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDoc(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();
    const doc = await pb.collection("docs").getOne(id);
    if (doc.author !== user.id) throw new Error("Forbidden");

    await pb.collection("docs").update(id, { is_deleted: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateDoc(
  id: string,
  data: {
    title?: string;
    content?: string;
    isActive?: boolean;
    tVersion?: number;
    parent_id?: string;
  }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    // Verify Ownership
    const record = await pb.collection("docs").getOne(id);
    if (record.author !== user.id) {
      throw new Error("Forbidden: You are not the author of this document");
    }

    await pb.collection("docs").update(id, data);
    return { success: true };
  } catch (error: unknown) {
    console.error("Update Doc Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function listUserDocs(parentId: string | null = null) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    // Use the filter to show root docs (parent_id = "") or sub-docs
    const filter = parentId
      ? `author = "${user.id}" && is_deleted = false && parent_id = "${parentId}"`
      : `author = "${user.id}" && is_deleted = false && parent_id = ""`;

    const records = await pb.collection("docs").getList(1, 100, {
      filter,
      sort: "-updated",
    });

    return { success: true, docs: records.items };
  } catch (error: unknown) {
    console.error("List Docs Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function toggleSharing(
  collection: "forms" | "docs",
  id: string,
  isShared: boolean
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();
    const record = await pb.collection(collection).getOne(id);
    if (record.author !== user.id) throw new Error("Forbidden");

    await pb.collection(collection).update(id, {
      is_shared: isShared,
      share_type: isShared ? "public" : "none",
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
