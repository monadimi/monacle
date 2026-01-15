import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, getTeamUserId, setCachedTeamId } from "@/lib/admin";
import PocketBase from "pocketbase";

export const maxDuration = 300; // 5 minutes for large chunk handling

// Helper duplicated from actions/cloud.ts to ensure independence
async function getOrCreateTeamUser(pb: PocketBase) {
  const cached = await getTeamUserId(pb);
  if (cached) return cached;

  const TEAM_EMAIL = "cloud-team@monad.io.kr";
  try {
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
    } catch {
      const user = await pb
        .collection("users")
        .getFirstListItem(`email="${TEAM_EMAIL}"`);
      setCachedTeamId(user.id);
      return user.id;
    }
  } catch (e) {
    throw e;
  }
}

// Helper for incrementing version
// Helper for incrementing version
async function incrementVersion(pb: PocketBase): Promise<number> {
  const VERSION_Record_ID = "nubmsjlcwqh10wb";
  try {
    const record = await pb.collection("tVersion").getOne(VERSION_Record_ID);
    const nextVersion = (record.version || 0) + 1;
    await pb.collection("tVersion").update(VERSION_Record_ID, {
      version: nextVersion,
    });
    return nextVersion;
  } catch (e) {
    console.error("Failed to increment version on upload:", e);
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = JSON.parse(session.value);

    const formData = await request.formData();
    const isTeam = formData.get("isTeam") === "true";

    // We shouldn't need to manually parse file blobs, pb.collection.create handles FormData natively
    // if we pass standard Request Objects, but here we have NextRequest.
    // However, JS SDK `create` accepts `FormData` object.

    const pb = await getAdminClient();
    let ownerId = user.id;

    if (isTeam) {
      ownerId = await getOrCreateTeamUser(pb);
    }

    // Append proper owner
    formData.append("owner", ownerId);

    // Generate unique short_id
    // Simple 10-char random string
    const short_id = Math.random().toString(36).substring(2, 12);
    formData.append("short_id", short_id);

    // Handle root folder
    if (!formData.has("folder") || formData.get("folder") === "root") {
      formData.delete("folder");
    }

    // Cleanup extra fields if necessary or just pass through
    formData.delete("isTeam");

    // Check for recordId to support Chunked Uploads (Append)
    const recordId = formData.get("recordId") as string | null;
    let record;

    const version = await incrementVersion(pb);
    formData.append("tVersion", version.toString());

    if (recordId) {
      // Append mode
      // Security Check: Verify ownership
      const existing = await pb.collection("cloud").getOne(recordId);
      if (existing.owner !== ownerId) {
        console.error(
          `[Upload] Forbidden: User ${ownerId} tried to update record owned by ${existing.owner}`
        );
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      formData.delete("recordId"); // Cleanup
      const existingFiles = existing.file;

      console.log(
        `[Upload] Appending to record ${recordId}. Current files:`,
        existingFiles
      );

      if (existingFiles) {
        if (Array.isArray(existingFiles)) {
          existingFiles.forEach((f: string) => {
            formData.append("file", f);
          });
        } else if (typeof existingFiles === "string") {
          formData.append("file", existingFiles);
        }
      }

      // New chunk is already in formData as 'file' (Blob)
      record = await pb.collection("cloud").update(recordId, formData);
      console.log(`[Upload] Update complete. Files now:`, record.file);
    } else {
      // NEW RECORD: Default sharing to off if not provided
      if (!formData.has("share_type")) formData.set("share_type", "none");
      if (!formData.has("is_shared")) formData.set("is_shared", "false");
      record = await pb.collection("cloud").create(formData);
    }

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error("Upload Error:", error);
    // Return detailed PB error if available
    const errorMessage = error?.data
      ? JSON.stringify(error.data)
      : error.message || "Upload failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
