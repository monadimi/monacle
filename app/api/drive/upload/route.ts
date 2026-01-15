import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient, getTeamUserId, setCachedTeamId } from "@/lib/admin";
import PocketBase from "pocketbase";

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

    // Upload to PocketBase
    const record = await pb.collection("cloud").create(formData);

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
