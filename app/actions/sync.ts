"use server";

import PocketBase from "pocketbase";
import { cookies } from "next/headers";
import { getAdminClient, getTeamUserId } from "@/lib/admin";

// Helper to get global version
async function getCurrentVersion(pb: PocketBase): Promise<number> {
  try {
    const record = await pb.collection("tVersion").getOne("nubmsjlcwqh10wb");
    return record.version || 0;
  } catch {
    return 0;
  }
}

export async function getDeltaUpdates(
  localVersion: number,
  ownerFilter?: string
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(decodeURIComponent(session.value));

    const pb = await getAdminClient();
    const serverVersion = await getCurrentVersion(pb);

    // If local version matches server, nothing to do
    // BUT check for FORCE_REFRESH env
    const forceRefresh =
      process.env.FORCE_REFRESH === "true" ||
      process.env.FORCE_REFRESH === "True";

    // Check for Reset Conditions:
    // 1. FORCE_REFRESH is true
    // 2. Local Version > Server Version (Impossible state / Reset)
    // 3. Local Version is NaN or negative (Invalid)
    // 4. Too far behind (> 300)

    const MAX_VERSION_DIFF = 300;
    const isVersionInvalid = isNaN(localVersion) || localVersion < 0;
    const isFutureVersion = localVersion > serverVersion;
    // Only check for "Too Old" if we actually have a version (non-zero)
    // If localVersion is 0, it means fresh or reset state, so we should sync everything.
    const isTooOld =
      localVersion > 0 && serverVersion - localVersion > MAX_VERSION_DIFF;

    if (forceRefresh || isVersionInvalid || isFutureVersion || isTooOld) {
      return {
        success: true,
        hasUpdates: true,
        resetRequired: true,
        version: serverVersion,
      };
    }

    if (localVersion >= serverVersion) {
      return { success: true, hasUpdates: false, version: serverVersion };
    }

    let teamId = "";
    if (ownerFilter && ownerFilter.includes("TEAM_MONAD")) {
      teamId = (await getTeamUserId(pb)) || "";
    }

    // 1. Fetch Updated/Created Files
    // Condition: tVersion > localVersion AND (owner = me OR shared)
    // For simplicity, we filter by owner if provided, or simple "my files" rule?
    // The previous listFiles logic had owner filtering.
    // Let's rely on standard filtering logic:
    // If ownerFilter is "personal", we want `owner = user.id`.
    // If "team", `owner = teamId`.

    let baseFilter = "";
    if (ownerFilter === "personal") {
      baseFilter = `owner = "${user.id}"`;
    } else if (ownerFilter === "team") {
      baseFilter = `owner = "${teamId}"`; // Assuming teamId resolved
    } else {
      // Fallback: fetch everything user has access to? Might be too much.
      // Let's restrict to user.id if not specified
      baseFilter = `owner = "${user.id}"`;
    }

    // But! We also need to sync files that are SHARED with me?
    // Current listFiles didn't explicitly handle "shared with me" separately well,
    // it was just filtering by owner usually.
    // Let's stick to the requested scope: "files visible in current view context".
    // Actually, sync needs to be broader if we cache EVERYTHING.
    // Proposal: Sync ALL files owned by user + Team files.
    // Filter: (owner = user.id || owner = teamId) && tVersion > localVersion

    // Resolve Team ID
    if (!teamId) teamId = (await getTeamUserId(pb)) || "";

    const syncFilter = `(owner = "${user.id}" || owner = "${teamId}") && tVersion > ${localVersion}`;

    // Use Auto-Cancellation false to prevent aborts
    const filesPromise = pb.collection("cloud").getFullList({
      filter: syncFilter,
      $autoCancel: false,
    });

    const foldersPromise = pb.collection("folders").getFullList({
      filter: syncFilter,
      $autoCancel: false,
    });

    // 2. Fetch Deleted Items
    // Condition: tDeleted where tVersion > localVersion AND (owner = user.id || owner = teamId)
    const deletedPromise = pb.collection("tDeleted").getFullList({
      filter: syncFilter,
      $autoCancel: false,
    });

    const [files, folders, deleted] = await Promise.all([
      filesPromise,
      foldersPromise,
      deletedPromise,
    ]);

    return {
      success: true,
      hasUpdates: true,
      version: serverVersion,
      changes: {
        files,
        folders,
        deleted,
      },
    };
  } catch (error: unknown) {
    console.error("Sync Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getSchemaVersion() {
  const MAX_RETRIES = 3;
  let lastError: any;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const pb = await getAdminClient();
      // Record ID provided by user: dnp7sf942vkqpnv
      const record = await pb
        .collection("schema_version")
        .getOne("dnp7sf942vkqpnv");
      return { success: true, version: record.version || 0 };
    } catch (error: any) {
      lastError = error;
      console.error(`getSchemaVersion Effort ${i + 1} failed:`, error.message);
      // Only retry on potential gateway/network issues (502, 503, 504)
      if (
        error.status !== 502 &&
        error.status !== 503 &&
        error.status !== 504
      ) {
        break;
      }
      // Wait a bit before retry
      if (i < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  console.error(
    "Schema Version Fetch definitively failed after retries. Using silent fallback."
  );
  return {
    success: false,
    error: lastError?.message || "Connection failed",
    version: 0,
  };
}
