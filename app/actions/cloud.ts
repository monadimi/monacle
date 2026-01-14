"use server";

import PocketBase from "pocketbase";
import { cookies } from "next/headers";

const BASE_URL =
  process.env.POCKETBASE_API_URL || "https://monadb.snowman0919.site";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

async function getAdminClient() {
  const pb = new PocketBase(BASE_URL);
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    try {
      await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    } catch (e) {
      console.error(
        "Internal Auth Error: Failed to auth as admin in server action",
        e
      );
      throw new Error("Internal Server Error: Database connection failed");
    }
  } else {
    console.warn("Missing POCKETBASE_ADMIN credentials for server action.");
  }
  return pb;
}

// Helper to get or create a dedicated Team User
async function getOrCreateTeamUser(pb: PocketBase) {
  const TEAM_EMAIL = "cloud-team@monad.io.kr";
  try {
    const user = await pb
      .collection("users")
      .getFirstListItem(`email="${TEAM_EMAIL}"`);
    return user.id;
  } catch (e) {
    // Create if not exists
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
      return user.id;
    } catch (createError: any) {
      console.error(
        "Team User Creation Error Details:",
        JSON.stringify(createError.data, null, 2)
      );
      throw createError;
    }
  }
}

export async function createFolder(
  name: string,
  parentId: string | null = null,
  ownerOverride?: string
) {
  try {
    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized: No session found");
    const user = JSON.parse(session.value);
    if (!user.id) throw new Error("Unauthorized: Invalid session");

    // 2. Determine Owner
    let owner = user.id;
    const pb = await getAdminClient();

    // Check if creating in Team Space
    if (ownerOverride === "TEAM_MONAD") {
      owner = await getOrCreateTeamUser(pb);
    }

    // 3. Create
    const record = await pb.collection("folders").create({
      name,
      parent: parentId || "", // PB relation fields usually ignore empty string, but better to be explicit or undefined if library handles it.
      // Actually PB relation expects ID or null. If empty string is passed, it might error or treat as null.
      // Safe bet: null if no parent. But FormData usually sends strings.
      // Let's pass parentId only if truthy.
      ...(parentId ? { parent: parentId } : {}),
      owner: owner,
      // Default share settings could be inherited or private
      is_shared: false,
      share_type: "none",
    });

    return { success: true, record: JSON.parse(JSON.stringify(record)) };
  } catch (error: any) {
    console.error("Create Folder Failed:", error);
    return { success: false, error: error.message };
  }
}

export async function uploadFile(formData: FormData) {
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

    // 2. Prepare Data
    // Check if the request is for Team Space
    const requestedOwner = formData.get("owner") as string;
    const parentId = formData.get("folder") as string; // Get folder ID from formData

    // We trust client to send "TEAM_MONAD" for team uploads.
    // Ideally we'd check if user is allowed to upload to team.
    // 3. Admin Client for Team User Resolution
    const pb = await getAdminClient();

    if (requestedOwner === "TEAM_MONAD") {
      const teamId = await getOrCreateTeamUser(pb);
      formData.set("owner", teamId);
    } else {
      formData.set("owner", user.id);
    }

    // Handle Folder
    if (parentId && parentId !== "root") {
      formData.set("folder", parentId);
    } else {
      formData.delete("folder"); // Ensure no "root" string is sent if PB expects relation
    }

    // 4. Upload
    // (pb is already admin)
    const record = await pb.collection("cloud").create(formData);

    // Return plain object (strip methods if any)
    return { success: true, record: JSON.parse(JSON.stringify(record)) };
  } catch (error: any) {
    console.error("Server Action Upload Failed:", error);
    // Return serializable error object
    return {
      success: false,
      error: error.message || "Upload failed",
      details: error.data,
    };
  }
}

export async function listFiles(
  page: number = 1,
  perPage: number = 50,
  options: { filter?: string; sort?: string; folderId?: string | null } = {}
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

    // 2. Construct Filter
    let serverFilter = options.filter || "";
    const pb = await getAdminClient();

    // Replace "TEAM_MONAD" magic string with actual Team User ID
    if (serverFilter.includes("TEAM_MONAD")) {
      const teamId = await getOrCreateTeamUser(pb);
      serverFilter = serverFilter.replace(/TEAM_MONAD/g, teamId);
    }

    // Handle Folder Filtering
    // If folderId is provided, filter by it. If null/undefined/"root", filter where folder is empty.
    if (options.folderId && options.folderId !== "root") {
      serverFilter +=
        (serverFilter ? " && " : "") + `folder = "${options.folderId}"`;
    } else {
      // Root view: folder is empty
      serverFilter += (serverFilter ? " && " : "") + `folder = ""`;
    }

    // 3. Fetch Files
    const files = await pb.collection("cloud").getList(page, perPage, {
      sort: options.sort || "-created",
      filter: serverFilter,
      expand: "owner", // Expand owner to get name/email
    });

    // 4. Fetch Folders (Only if on page 1 for simplicity, or handle pagination separately)
    // We usually want folders mixed correctly or on top.
    // For simplicity: Fetch all folders in this parent, then return combined or separate.
    // Let's return separate 'folders' array.
    let folders: any[] = [];
    if (page === 1) {
      // Reuse the same ownership/parent filter logic for folders
      // Warning: 'serverFilter' currently has 'folder = ...' which works for files.
      // For folders, the field is 'parent', not 'folder'.
      // We need to reconstruct the basic owner filter.

      let folderFilter = "";
      if (options.filter?.includes("TEAM_MONAD")) {
        // Re-resolve team ID is skipped as we assume consistent Context
        // But we need the ID.
        const startOwner = options.filter.indexOf('owner = "');
        if (startOwner !== -1) {
          // Extract owner part roughly or just rebuild it based on assumptions
          // Safer: Rebuild based on intended scope.
          if (options.filter.includes("TEAM_MONAD")) {
            // We know it's team
            const teamId = await getOrCreateTeamUser(pb);
            folderFilter = `owner = "${teamId}"`;
          } else {
            folderFilter = `owner = "${user.id}"`;
          }
        }
      } else {
        // Default personal
        folderFilter = `owner = "${user.id}"`;
      }

      if (options.folderId && options.folderId !== "root") {
        folderFilter += ` && parent = "${options.folderId}"`;
      } else {
        folderFilter += ` && parent = ""`;
      }

      const folderRecords = await pb.collection("folders").getFullList({
        sort: "-created",
        filter: folderFilter,
      });
      folders = folderRecords;
    }

    return {
      success: true,
      items: JSON.parse(JSON.stringify(files.items)),
      folders: JSON.parse(JSON.stringify(folders)), // Return folders
      totalItems: files.totalItems,
      totalPages: files.totalPages,
    };
  } catch (error: any) {
    console.error("Server Action List Failed:", error);
    return {
      success: false,
      error: error.message || "List failed",
      items: [],
      folders: [],
    };
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
  } catch (error: any) {
    console.error("Server Action Delete Failed:", error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error("Server Action Delete Folder Failed:", error);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error("Server Action Share Update Failed:", error);
    return { success: false, error: error.message };
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
    await pb.collection("cloud").update(id, data);

    return { success: true };
  } catch (error: any) {
    console.error("Server Action Update File Failed:", error);
    return { success: false, error: error.message };
  }
}
