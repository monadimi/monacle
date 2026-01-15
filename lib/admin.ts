import PocketBase from "pocketbase";

const BASE_URL =
  process.env.POCKETBASE_API_URL || "https://monadb.snowman0919.site";
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

// Global cache to persist across invocations in the same container/isolate
let cachedPb: PocketBase | null = null;
let cachedTeamId: string | null = null;

export async function getAdminClient() {
  // Return cached instance if token is still valid
  if (cachedPb && cachedPb.authStore.isValid) {
    return cachedPb;
  }

  const pb = new PocketBase(BASE_URL);

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    try {
      await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
      pb.autoCancellation(false); // Disable auto-cancellation for parallel requests
      cachedPb = pb; // Cache the authenticated instance
      console.log("[AdminClient] Authenticated successfully (New Session)");
    } catch (e) {
      console.error("[AdminClient] Auth Failed:", e);
      throw new Error("Failed to authenticate as admin");
    }
  } else {
    console.warn("[AdminClient] Missing credentials");
  }

  return pb;
}

export async function getTeamUserId(pb: PocketBase) {
  if (cachedTeamId) return cachedTeamId;

  const TEAM_EMAIL = "cloud-team@monad.io.kr";
  try {
    const user = await pb
      .collection("users")
      .getFirstListItem(`email="${TEAM_EMAIL}"`);
    cachedTeamId = user.id;
    return user.id;
  } catch {
    // If not found, create (though ideally this should be rare)
    // For read-heavy paths, we might fail here if not exists, but cloud.ts handles creation.
    // Let's defer creation logic to cloud.ts or handle it here if we want to centralize.
    return null;
  }
}

export function setCachedTeamId(id: string) {
  cachedTeamId = id;
}
