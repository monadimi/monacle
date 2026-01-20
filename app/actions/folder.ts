/**
 * @file app/actions/folder.ts
 * @purpose Handles server-side operations for Folder structure.
 * @scope Creating, deleting, and renaming folders.
 * @out-of-scope File content storage, bulk file pruning.
 * @failure-behavior Validates ownership before modification; errors propagate to UI.
 */
"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";
import { incrementVersion, getOrCreateTeamUser } from "./common";

export async function createFolder(
  name: string,
  parentId?: string,
  ownerHint?: string,
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();

    let owner = user.id;

    if (ownerHint === "TEAM_MONAD") {
      owner = await getOrCreateTeamUser(pb);
    }

    if (parentId) {
      try {
        const parent = await pb.collection("folders").getOne(parentId);
        owner = parent.owner;
      } catch {
        // ignore
      }
    }

    const version = await incrementVersion(pb);
    const data = {
      name,
      parent: parentId || "",
      owner: owner,
      is_shared: false,
      share_type: "none",
      tVersion: version,
    };

    const record = await pb.collection("folders").create(data);
    return { success: true, folder: record };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteFolder(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const record = await pb.collection("folders").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);
    if (record.owner !== user.id && record.owner !== teamId) {
      throw new Error("Forbidden");
    }

    const files = await pb
      .collection("cloud")
      .getFullList({ filter: `folder = "${id}"` });
    for (const file of files) {
      await pb.collection("cloud").delete(file.id);
    }

    const subfolders = await pb
      .collection("folders")
      .getFullList({ filter: `parent = "${id}"` });
    for (const sub of subfolders) {
      await pb.collection("folders").delete(sub.id);
    }

    await pb.collection("folders").delete(id);
    const version = await incrementVersion(pb);

    try {
      await pb.collection("tDeleted").create({
        targetId: id,
        type: "folder",
        tVersion: version,
        owner: record.owner,
      });
    } catch (e) {
      console.error("Failed to log folder deletion:", e);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Delete Folder Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFolder(
  id: string,
  data: { name?: string; parent?: string },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const record = await pb.collection("folders").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    if (record.owner !== user.id && record.owner !== teamId) {
      throw new Error("Forbidden");
    }

    if (data.parent) {
      try {
        const newParent = await pb.collection("folders").getOne(data.parent);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any).owner = newParent.owner;
      } catch {
        // ignore
      }
    }

    const version = await incrementVersion(pb);
    const updateData = { ...data, tVersion: version };
    await pb.collection("folders").update(id, updateData);
    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Update Folder Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}
