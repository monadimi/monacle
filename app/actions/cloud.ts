"use server";

import PocketBase from "pocketbase";
import { cookies } from "next/headers";
import { getAdminClient, getTeamUserId, setCachedTeamId } from "@/lib/admin";

// Helper to get or create a dedicated Team User
async function getOrCreateTeamUser(pb: PocketBase) {
  // Try cache first
  const cached = await getTeamUserId(pb);
  if (cached) return cached;

  const TEAM_EMAIL = "cloud-team@monad.io.kr";
  try {
    // This part is largely redundant if getTeamUserId covers fetch,
    // but getTeamUserId returns null on error.
    // So if we are here, it means we probably need to create it (or fetch failed).

    // Creation Logic
    const pwd = "team_password_secure_" + Math.random().toString(36);
    try {
      const user = await pb.collection("users").create({
        email: TEAM_EMAIL,
        emailVisibility: true,
        password: pwd,
        passwordConfirm: pwd,
        name: "Team Monacle",
        nickname: "Team Monacle",
        type: "monad",
      });
      setCachedTeamId(user.id);
      return user.id;
    } catch (createError: unknown) {
      // It might have existed but getTeamUserId failed/returned null for some reason?
      // Or race condition. Try fetch one last time strictly.
      try {
        const user = await pb
          .collection("users")
          .getFirstListItem(`email="${TEAM_EMAIL}"`);
        setCachedTeamId(user.id);
        return user.id;
      } catch {
        console.error(
          "Team User Creation Error Details:",
          JSON.stringify((createError as { data: unknown }).data, null, 2)
        );
        throw createError;
      }
    }
  } catch (e) {
    throw e;
  }
}

export async function createFolder(
  name: string,
  parentId?: string,
  ownerHint?: string
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    // Use Cached Client
    const pb = await getAdminClient();

    let owner = user.id;

    // Check owner hint for Team context at root
    if (ownerHint === "TEAM_MONAD") {
      owner = await getOrCreateTeamUser(pb);
    }

    if (parentId) {
      // Check parent ownership
      try {
        const parent = await pb.collection("folders").getOne(parentId);
        owner = parent.owner;
      } catch {
        // ignore
      }
    }

    const data = {
      name,
      parent: parentId || "", // Relation ID or empty
      owner: owner,
      is_shared: false,
      share_type: "none",
    };

    const record = await pb.collection("folders").create(data);
    return { success: true, folder: record };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export async function uploadFile(formData: FormData) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();

    // ...
    const file = formData.get("file") as File;
    const folderId = formData.get("folderId") as string;

    // Determine owner
    let owner = user.id;
    if (folderId) {
      try {
        const parent = await pb.collection("cloud").getOne(folderId);
        owner = parent.owner;
      } catch {
        /* ignore */
      }
    }

    const data = {
      file: file,
      name: file.name, // Use original filename
      owner: owner,
      folder: folderId || "",
    };

    const record = await pb.collection("cloud").create(data);
    return { success: true, file: record };
  } catch (error: unknown) {
    console.error("Server Action Upload Failed:", error);
    return {
      success: false,
      error: (error as Error).message || "Upload failed",
      details: (error as { data?: unknown }).data,
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
  } = {}
) {
  try {
    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) {
      throw new Error("Unauthorized: No session found");
    }

    const user = JSON.parse(session.value);
    if (!user.id) {
      throw new Error("Unauthorized: Invalid session");
    }

    // 2. Client & Filter
    const pb = await getAdminClient();

    let serverFilter = options.filter || "";
    if (serverFilter.includes("TEAM_MONAD")) {
      const teamId = await getOrCreateTeamUser(pb);
      serverFilter = serverFilter.replace(/TEAM_MONAD/g, teamId);
    }

    // --- Files (cloud) ---
    // --- Files (cloud) ---
    let fileFilter = serverFilter;

    // Apply Type Filter
    if (options.type && options.type !== "all") {
      if (options.type === "image") {
        fileFilter +=
          (fileFilter ? " && " : "") +
          `(file ~ '.jpg' || file ~ '.jpeg' || file ~ '.png' || file ~ '.gif' || file ~ '.webp' || file ~ '.svg')`;
      } else if (options.type === "video") {
        fileFilter +=
          (fileFilter ? " && " : "") +
          `(file ~ '.mp4' || file ~ '.mov' || file ~ '.webm')`;
      } else if (options.type === "doc") {
        fileFilter +=
          (fileFilter ? " && " : "") +
          `(file ~ '.pdf' || file ~ '.doc' || file ~ '.txt' || file ~ '.md' || file ~ '.json')`;
      }
    }

    if (options.search) {
      fileFilter +=
        (fileFilter ? " && " : "") +
        `(file ~ "${options.search}" || name ~ "${options.search}")`;
    }

    if (options.folderId && options.folderId !== "root") {
      fileFilter +=
        (fileFilter ? " && " : "") + `folder = "${options.folderId}"`;
    } else {
      fileFilter += (fileFilter ? " && " : "") + `folder = ""`;
    }

    // --- Folders (folders) ---
    // If specific file type filter is active (image/video/doc), we usually DO NOT show folders
    // because we are looking for specific files. Showing empty folders is confusing.
    // Also, we cannot filter categories on folders easily.
    // So if options.type is present and not 'all', we return empty folders.

    let folderFilter = serverFilter;
    let shouldFetchFolders = !options.type || options.type === "all";

    if (shouldFetchFolders) {
      if (options.search) {
        folderFilter +=
          (folderFilter ? " && " : "") + `name ~ "${options.search}"`;
      }

      if (options.folderId && options.folderId !== "root") {
        folderFilter +=
          (folderFilter ? " && " : "") + `parent = "${options.folderId}"`;
      } else {
        folderFilter += (folderFilter ? " && " : "") + `parent = ""`;
      }
    }

    // Optimization: Parallel Request
    const filesPromise = pb.collection("cloud").getList(page, perPage, {
      sort: options.sort || "-created",
      filter: fileFilter + " && file != ''", // Only files
      expand: "owner",
    });

    const foldersPromise =
      page === 1 && shouldFetchFolders
        ? pb.collection("folders").getList(1, 100, {
            filter: folderFilter,
            sort: "-created",
          })
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
    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);
    if (!user.id) throw new Error("Unauthorized");

    // 2. Admin Check
    const pb = await getAdminClient();
    const record = await pb.collection("cloud").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    // Ownership Check
    if (
      record.owner !== user.id &&
      record.owner !== user.email &&
      record.owner !== teamId
    ) {
      throw new Error("Forbidden: You do not own this file");
    }

    await pb.collection("cloud").delete(id);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteFolder(id: string) {
  try {
    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    // 2. Admin Check
    const pb = await getAdminClient();

    // Check ownership
    const record = await pb.collection("folders").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);
    if (record.owner !== user.id && record.owner !== teamId) {
      throw new Error("Forbidden");
    }

    // 3. Cascade Delete (Simple implementation)
    // Delete all files in folder
    const files = await pb
      .collection("cloud")
      .getFullList({ filter: `folder = "${id}"` });
    for (const file of files) {
      await pb.collection("cloud").delete(file.id);
    }

    // Recursively delete subfolders?
    // For MVP, maybe strict block if subfolders exist? Or strict recursion.
    // Let's implement 1-level recursion for files, but if subfolders exist, they become orphaned or we delete them too.
    // Let's do a recursive function helper if needed, but for now simple delete of explicit children.
    const subfolders = await pb
      .collection("folders")
      .getFullList({ filter: `parent = "${id}"` });
    // This could timeout for large trees. Ideally backend does CASCADE.
    // We'll rely on PocketBase CASCADE behavior if configured? PB doesn't default cascade delete unless API Rules allow or configured.
    // Let's manually delete immediate children to be safe for MVP.
    for (const sub of subfolders) {
      await pb.collection("folders").delete(sub.id); // This might fail if IT has children
    }

    await pb.collection("folders").delete(id);

    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Delete Folder Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFileShare(
  id: string,
  data: { is_shared: boolean; share_type: string; short_id?: string }
) {
  try {
    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);
    if (!user.id) throw new Error("Unauthorized");

    // 2. Admin Check
    const pb = await getAdminClient();
    const record = await pb.collection("cloud").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    // Ownership Check
    if (record.owner !== user.id && record.owner !== user.email) {
      if (record.owner !== teamId) {
        throw new Error("Forbidden");
      }
    }

    // 3. Update
    await pb.collection("cloud").update(id, data);

    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Share Update Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFile(
  id: string,
  data: { name?: string; folder?: string }
) {
  try {
    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);
    if (!user.id) throw new Error("Unauthorized");

    // 2. Admin Check
    const pb = await getAdminClient();
    const record = await pb.collection("cloud").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    // Ownership Check
    if (
      record.owner !== user.id &&
      record.owner !== user.email &&
      record.owner !== teamId
    ) {
      throw new Error("Forbidden: You do not own this file");
    }

    // 3. Update
    // If renaming, we update 'name' field.
    // If moving, we update 'folder' field.

    // Check ownership change on move
    if (data.folder) {
      try {
        const newParent = await pb.collection("folders").getOne(data.folder);
        // Cast to unknown first to avoid strict type error if we didn't define data type fully
        // @ts-expect-error - dynamic assignment
        (data as unknown as Record<string, unknown>).owner = newParent.owner;
      } catch {
        // If folder not found (maybe moving to root?), or error.
        // If moving to root (data.folder=""), this block won't run if we check truthy,
        // BUT data.folder could be non-empty ID that fails.
        // If data.folder is set but invalid, update will fail anyway.
      }
    }

    await pb.collection("cloud").update(id, data);

    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Update File Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateFolder(
  id: string,
  data: { name?: string; parent?: string }
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();
    const record = await pb.collection("folders").getOne(id);
    const teamId = await getOrCreateTeamUser(pb);

    if (record.owner !== user.id && record.owner !== teamId) {
      throw new Error("Forbidden");
    }

    // Check ownership change on move
    if (data.parent) {
      try {
        const newParent = await pb.collection("folders").getOne(data.parent);
        // @ts-expect-error - dynamic assignment
        (data as unknown as Record<string, unknown>).owner = newParent.owner;
      } catch {
        // ignore
      }
    }

    await pb.collection("folders").update(id, data);
    return { success: true };
  } catch (error: unknown) {
    console.error("Server Action Update Folder Failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getStorageUsage(isTeam: boolean) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    const pb = await getAdminClient();
    let ownerId = user.id;

    if (isTeam) {
      ownerId = await getOrCreateTeamUser(pb);
    }

    // Fetch only the size field for all files owned by this user/team
    // Using skipTotal=true for performance as we don't need count if we use getFullList
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
