/**
 * @file app/actions/boards.ts
 * @purpose Server Actions for Monacle Ideaboard (Whiteboard).
 * @scope CRUD for Boards, Element updates, Image uploads for canvas.
 * @failure-behavior Returns { success: false, error: string } on failure.
 */
"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function createBoard(
  title: string = "제목 없는 보드",
  elements: any[] = [],
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();

    const data = {
      title,
      elements: JSON.stringify(elements),
      author: user.id,
      tVersion: 1,
      is_shared: false,
      share_type: "none",
      is_deleted: false,
    };

    const record = await pb.collection("boards").create(data);
    return { success: true, id: record.id };
  } catch (error: unknown) {
    console.error("Create Board Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getBoard(id: string) {
  try {
    const pb = await getAdminClient();
    const record = await pb.collection("boards").getOne(id);

    let elements = record.elements;
    if (typeof elements === "string") {
      try {
        elements = JSON.parse(elements);
      } catch {
        elements = [];
      }
    }

    return {
      success: true,
      board: {
        id: record.id,
        title: record.title,
        elements: elements,
        author: record.author,
        tVersion: record.tVersion || 0,
        updated: record.updated,
        is_shared: record.is_shared,
        share_type: record.share_type,
        share_team: record.share_team || false,
        lastClientId: record.lastClientId || "",
      },
    };
  } catch (error: unknown) {
    console.error("Get Board Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateBoard(
  id: string,
  data: {
    title?: string;
    elements?: unknown[];
    tVersion?: number;
    lastClientId?: string;
  },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = session?.value
      ? JSON.parse(decodeURIComponent(session.value))
      : null;
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();
    const record = await pb.collection("boards").getOne(id);

    const isOwner = record.author === user.id;
    const isEditShared = record.is_shared && record.share_type === "edit";

    if (!isOwner && !isEditShared) {
      throw new Error("Forbidden");
    }

    // Conflict detection
    if (
      data.tVersion !== undefined &&
      record.tVersion >= data.tVersion &&
      data.lastClientId !== record.lastClientId
    ) {
      return {
        success: false,
        conflict: true,
        latestBoard: {
          id: record.id,
          elements:
            typeof record.elements === "string"
              ? JSON.parse(record.elements)
              : record.elements,
          tVersion: record.tVersion,
          lastClientId: record.lastClientId,
        },
      };
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.elements) updateData.elements = JSON.stringify(data.elements);

    await pb.collection("boards").update(id, updateData);
    return { success: true };
  } catch (error: unknown) {
    console.error("Update Board Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteBoard(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const board = await pb.collection("boards").getOne(id);
    if (board.author !== user.id) throw new Error("Forbidden");

    await pb.collection("boards").update(id, { is_deleted: true });
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listUserBoards() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();

    // Confirmed to work without parameters
    const allRecords = await pb.collection("boards").getFullList();

    // Filter manually in JS to bypass the 400 error
    const boards = allRecords
      .filter((record) => record.author === user.id && !record.is_deleted)
      .map((record) => ({
        id: record.id,
        title: record.title,
        elements: record.elements,
        author: record.author,
        created: record.created,
        updated: record.updated,
        is_shared: record.is_shared,
        share_team: record.share_team,
        questions: (record as unknown as { questions: any }).questions, // For identification in UI if mapping overlap
      }))
      .sort(
        (a, b) =>
          new Date(b.updated || b.created).getTime() -
          new Date(a.updated || a.created).getTime(),
      );

    return { success: true, boards };
  } catch (error: unknown) {
    // @ts-expect-error - Error type is unknown but likely mostly has data/message
    console.error("List Boards Error:", error.data || (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

export async function uploadBoardImage(boardId: string, formData: FormData) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();

    // Verify ownership or edit access
    const board = await pb.collection("boards").getOne(boardId);
    const isOwner = board.author === user.id;
    const isEditShared = board.is_shared && board.share_type === "edit";

    if (!isOwner && !isEditShared) {
      throw new Error("Forbidden");
    }

    // Update the record with the file
    // PocketBase automatically appends if the field is multiple files
    const record = await pb.collection("boards").update(boardId, formData);

    // Return the specific filename that was just uploaded
    // Note: formData should contain a field like 'images'
    const uploadedFiles = record.images;
    const lastFile = uploadedFiles[uploadedFiles.length - 1];

    return {
      success: true,
      filename: lastFile,
      url: `https://monadb.snowman0919.site/api/files/boards/${boardId}/${lastFile}`,
    };
  } catch (error: unknown) {
    console.error("Upload Board Image Error:", error);
    return { success: false, error: (error as Error).message };
  }
}
