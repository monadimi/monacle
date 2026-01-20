/**
 * @file app/actions/file.ts
 * @purpose Handles server-side operations for individual File records.
 * @scope Uploading, updating, deleting, and modifying share settings for files.
 * @out-of-scope Folder management, batch operations (handled by client loop), authentication (handled by helpers).
 * @failure-behavior Returns { success: false, error: string } for handled errors, throws for critical system failures.
 */
"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";
import { verifySession } from "@/lib/session";
import { incrementVersion, getOrCreateTeamUser } from "./common";

export async function uploadFile(formData: FormData) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();

    const file = formData.get("file") as File;
    const folderId = formData.get("folderId") as string;
    const isTeam = formData.get("isTeam") === "true";

    // Determine owner
    let owner = user.id;
    if (folderId) {
      try {
        const parent = await pb.collection("cloud").getOne(folderId);
      } catch {
        /* ignore */
      }
    }

    const version = await incrementVersion(pb);
    const data = {
      file: file,
      name: file.name,
      owner: owner,
      folder: folderId || "",
      is_shared: false,
      share_type: "none",
      tVersion: version,
    };

    const record = await pb.collection("cloud").create(data);
    return { success: true, file: record };
  } catch (error: unknown) {
    console.error("Server Action Upload Failed:", error);
    return {
      success: false,
      error: (error as Error).message || "Upload failed",
      details: (error as any).data,
    };
  }
}

export async function listFiles(
  page: number = 1,
  perPage: number = 50,
  options: {
    filter?: string;
    sort?: string;
    folderId?: string | null;
    search?: string;
    type?: "image" | "video" | "doc" | "all";
  } = {},
) {
  // Re-implementing listFiles logic
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized: Invalid session");

    const pb = await getAdminClient();

    // 1. Determine Ownership Scope
    let targetOwnerId = user.id;
    if (options.filter && options.filter.includes("TEAM_MONAD")) {
      targetOwnerId = await getOrCreateTeamUser(pb);
    }

    console.log("[listFiles] Inputs:", {
      userId: user.id,
      targetOwnerId,
      options,
      isTeamRequest: options.filter?.includes("TEAM_MONAD"),
    });

    // Begin constructing strict filter
    let fileFilter = `owner = "${targetOwnerId}"`;

    // 2. Apply Type Filter
    if (options.type && options.type !== "all") {
      let typeCondition = "";
      if (options.type === "image")
        typeCondition = `(file ~ '.jpg' || file ~ '.jpeg' || file ~ '.png' || file ~ '.gif' || file ~ '.webp' || file ~ '.svg')`;
      else if (options.type === "video")
        typeCondition = `(file ~ '.mp4' || file ~ '.mov' || file ~ '.webm')`;
      else if (options.type === "doc")
        typeCondition = `(file ~ '.pdf' || file ~ '.doc' || file ~ '.txt' || file ~ '.md' || file ~ '.json')`;

      if (typeCondition) {
        fileFilter += ` && ${typeCondition}`;
      }
    }

    // 3. Apply Search Filter (Sanitized)
    if (options.search) {
      // Robust sanitization: Escape double quotes and backslashes
      // This prevents breaking out of the double-quoted string literal in PB filter
      const safeSearch = options.search.replace(/[\\"]/g, "\\$&");
      fileFilter += ` && (file ~ "${safeSearch}" || name ~ "${safeSearch}")`;
    }

    // Critical: options.filter is purposefully IGNORED to prevent injection.
    // Only internal logic (team check) uses it safely at the start.

    // 4. Apply Folder Filter
    if (options.folderId && options.folderId !== "root") {
      fileFilter += ` && folder = "${options.folderId}"`;
    } else {
      fileFilter += ` && folder = ""`;
    }

    // 5. Construct Folder List Filter
    let folderFilter = `owner = "${targetOwnerId}"`;
    const shouldFetchFolders = !options.type || options.type === "all";

    if (shouldFetchFolders) {
      if (options.search) {
        const safeSearch = options.search.replace(/"/g, '\\"');
        folderFilter += ` && name ~ "${safeSearch}"`;
      }
      if (options.folderId && options.folderId !== "root") {
        folderFilter += ` && parent = "${options.folderId}"`;
      } else {
        folderFilter += ` && parent = ""`;
      }
    }

    // 6. Validate Sort
    const validSorts = [
      "created",
      "-created",
      "updated",
      "-updated",
      "name",
      "-name",
      "size",
      "-size",
    ];
    let safeSort = "-created";
    if (options.sort && validSorts.includes(options.sort)) {
      safeSort = options.sort;
    }

    const filesPromise = pb.collection("cloud").getList(page, perPage, {
      sort: safeSort,
      filter: fileFilter + " && file != ''",
      expand: "owner",
    });

    const foldersPromise =
      page === 1 && shouldFetchFolders
        ? pb
            .collection("folders")
            .getList(1, 100, { filter: folderFilter, sort: "-created" })
        : Promise.resolve({ items: [] });

    const [filesResult, foldersResult] = await Promise.all([
      filesPromise,
      foldersPromise,
    ]);

    return {
      success: true,
      files: filesResult.items,
      folders: foldersResult.items,
      totalPages: filesResult.totalPages,
    };
  } catch (error: unknown) {
    console.error("List Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteFile(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");
    if (!user.id) throw new Error("Unauthorized");

    const pb = await getAdminClient();
    const record = await pb.collection("cloud").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    if (record.owner !== user.id && record.owner !== teamId) {
      throw new Error("Forbidden: You do not own this file");
    }

    await pb.collection("cloud").delete(id);
    const version = await incrementVersion(pb);

    try {
      await pb.collection("tDeleted").create({
        targetId: id,
        type: "file",
        tVersion: version,
        owner: record.owner,
      });
    } catch (e) {
      console.error("Failed to log file deletion:", e);
    }

    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFileShare(
  id: string,
  data: { is_shared: boolean; share_type: string; short_id?: string },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");
    if (!user.id) throw new Error("Unauthorized");

    const pb = await getAdminClient();
    const record = await pb.collection("cloud").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    if (record.owner !== user.id) {
      if (record.owner !== teamId) throw new Error("Forbidden");
    }

    const version = await incrementVersion(pb);
    const updateData = { ...data, tVersion: version };
    await pb.collection("cloud").update(id, updateData);

    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Share Update Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFile(
  id: string,
  data: { name?: string; folder?: string },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");
    if (!user.id) throw new Error("Unauthorized");

    const pb = await getAdminClient();
    const record = await pb.collection("cloud").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    if (record.owner !== user.id && record.owner !== teamId) {
      throw new Error("Forbidden: You do not own this file");
    }

    if (data.folder) {
      try {
        const newParent = await pb.collection("folders").getOne(data.folder);

        // Security Check: User must own the destination folder
        // or be in the team if it's a team folder (omitted for now as team logic works via owner)
        if (newParent.owner !== user.id && newParent.owner !== teamId) {
          throw new Error(
            "Forbidden: You cannot move files to a folder you do not own.",
          );
        }

        (data as any).owner = newParent.owner;
      } catch (e) {
        // High Vulnerability Fix: Explicitly rethrow ALL errors.
        // If we cannot validate the destination folder (404, network error, forbidden),
        // we MUST NOT allow the file to be moved there.
        // Proceeding would result in files in folders with mismatched ownership.
        throw e;
      }
    }

    const version = await incrementVersion(pb);
    const updateData = { ...data, tVersion: version };
    await pb.collection("cloud").update(id, updateData);

    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Update File Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getStorageUsage(isTeam: boolean) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();
    let ownerId = user.id;

    if (isTeam) {
      ownerId = await getOrCreateTeamUser(pb);
    }

    const records = await pb.collection("cloud").getFullList({
      filter: `owner = "${ownerId}"`,
      fields: "size",
      $autoCancel: false,
    });

    const totalBytes = records.reduce((acc, file) => acc + (file.size || 0), 0);

    return { success: true, totalBytes, fileCount: records.length };
  } catch (error: unknown) {
    console.error("Storage Usage Check Failed:", error);
    return {
      success: false,
      totalBytes: 0,
      fileCount: 0,
      error: (error as Error).message,
    };
  }
}
