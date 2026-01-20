/**
 * @file app/actions/forms.ts
 * @purpose Server Actions for Monacle Forms (survey creation, retrieval, responses).
 * @scope CRUD for Forms, Response submission, Statistics updates.
 * @failure-behavior Returns { success: false, error: string } on failure.
 */
"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

export async function createForm(
  title: string = "새로운 설문지",
  description: string = "설문지에 대한 설명을 입력해주세요.",
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

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
        isActive: record.isActive,
        is_shared: record.is_shared,
        share_team: record.share_team,
      },
    };
  } catch (error: unknown) {
    console.error("Get Form Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function updateForm(
  id: string,
  data: {
    title?: string;
    description?: string;
    questions?: Record<string, unknown>[];
  },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

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

export async function deleteForm(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const form = await pb.collection("forms").getOne(id);
    if (form.author !== user.id) throw new Error("Forbidden");

    await pb.collection("forms").update(id, { is_deleted: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function submitResponse(
  formId: string,
  answers: Record<string, unknown>,
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

export async function listUserForms() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();

    // Include forms owned by user OR shared with team
    const filter = `author = "${user.id}" || (is_shared = true && share_team = true && is_deleted = false)`;

    const records = await pb.collection("forms").getList(1, 50, {
      filter,
      sort: "-created",
    });

    return { success: true, forms: records.items };
  } catch (error: unknown) {
    console.error("List Forms Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getFormResponses(formId: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

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

export async function toggleFormStatus(formId: string, isActive: boolean) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

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
