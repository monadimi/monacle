/**
 * @file app/actions/docs.ts
 * @purpose Server Actions for Monacle Docs (Collaborative document editing).
 * @scope CRUD for Docs, Sharing toggle, List filtering.
 * @failure-behavior Returns { success: false, error: string } on failure.
 */
"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

export async function createDoc(
  title: string = "제목 없는 문서",
  content: string = "",
  parentId: string | null = null,
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

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
        tVersion: record.tVersion || 0,
        updated: record.updated,
        is_shared: record.is_shared,
        share_type: record.share_type,
        share_team: record.share_team || false,
        lastClientId: record.lastClientId || "",
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
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const doc = await pb.collection("docs").getOne(id);
    if (doc.author !== user.id) throw new Error("Forbidden");

    await pb.collection("docs").update(id, { is_deleted: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDoc(
  id: string,
  data: {
    title?: string;
    content?: string;
    isActive?: boolean;
    tVersion?: number;
    lastClientId?: string;
    parent_id?: string;
  },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = session?.value
      ? JSON.parse(decodeURIComponent(session.value))
      : null;

    const pb = await getAdminClient();

    // Verify Ownership or Edit Shared Access (AUTH REQUIRED)
    const record = await pb.collection("docs").getOne(id);

    // Must be logged in to edit, even if doc is shared for edit
    if (!user) {
      throw new Error("Unauthorized: Please log in to edit this document");
    }

    const isOwner = record.author === user.id;
    const isEditShared = record.is_shared && record.share_type === "edit";

    if (!isOwner && !isEditShared) {
      throw new Error(
        "Forbidden: You do not have permission to edit this document",
      );
    }

    if (
      data.tVersion !== undefined &&
      record.tVersion >= data.tVersion &&
      data.lastClientId !== record.lastClientId
    ) {
      return {
        success: false,
        conflict: true,
        latestDoc: {
          id: record.id,
          title: record.title,
          content: record.content,
          tVersion: record.tVersion,
          lastClientId: record.lastClientId,
        },
      };
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
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();

    // Show root docs or sub-docs
    // Include docs owned by user OR shared with team (only for root level list usually)
    let filter = "";
    if (parentId) {
      filter = `author = "${user.id}" && is_deleted = false && parent_id = "${parentId}"`;
    } else {
      filter = `(author = "${user.id}" || (is_shared = true && share_team = true)) && is_deleted = false && parent_id = ""`;
    }

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
  collection: "forms" | "docs" | "sheets" | "boards",
  id: string,
  isShared: boolean,
  shareType: "view" | "edit" = "view",
  shareTeam: boolean = false,
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const record = await pb.collection(collection).getOne(id);
    if (record.author !== user.id) throw new Error("Forbidden");

    await pb.collection(collection).update(id, {
      is_shared: isShared,
      share_type: isShared ? shareType : "none",
      share_team: isShared ? shareTeam : false,
    });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
