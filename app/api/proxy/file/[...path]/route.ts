import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (!path || path.length < 3) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    const [collectionId, recordId, filename] = path;

    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");

    if (!session?.value) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = JSON.parse(session.value);
    if (!user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Admin Client
    const pb = new PocketBase(
      process.env.POCKETBASE_API_URL || "https://monadb.snowman0919.site"
    );
    await pb.admins.authWithPassword(
      process.env.POCKETBASE_ADMIN_EMAIL!,
      process.env.POCKETBASE_ADMIN_PASSWORD!
    );

    // 3. Ownership Check (Optional but recommended)
    // We can fetch the record to check if the user has access.
    // Ideally, we should check "view" permission.
    try {
      const record = await pb.collection(collectionId).getOne(recordId);
      // Check if owner is user OR if shared with "TEAM_MONAD" OR shared publicly (if implemented)
      // Team Check: Resolve Team User ID
      let teamId = "";
      try {
        const teamUser = await pb
          .collection("users")
          .getFirstListItem('email="cloud-team@monad.io.kr"');
        teamId = teamUser.id;
      } catch (e) {
        /* ignore */
      }

      const isOwner = record.owner === user.id || record.owner === user.email;
      const isTeam = record.owner === teamId && teamId !== "";

      // For thumbnails, maybe we can be slightly lenient if we trust the UI not to leak IDs?
      // But strictly:
      if (!isOwner && !isTeam) {
        // Check sharing status if needed (e.g. valid shared link access)
        // For now, simple strict check.
        return new NextResponse("Forbidden", { status: 403 });
      }
    } catch (e) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // 4. Stream File
    // We use the admin token to fetch the file token-less?
    // Actually, getting the file via API usually doesn't require "admin login" if public,
    // but requires token if private.
    // Since we are proxying, we can use the fetch method with the admin token header.

    const fileUrl = pb.files.getUrl(
      { collectionId, id: recordId } as any,
      filename
    );

    // We need to fetch the file content ourselves and stream it.
    // pb.files.getUrl returns a string. We need to fetch that string with Auth header.

    const response = await fetch(fileUrl, {
      headers: {
        Authorization: pb.authStore.token, // Admin token
      },
    });

    if (!response.ok) {
      return new NextResponse("File fetch failed", { status: response.status });
    }

    // Verify content type
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const cleanName = filename.replace(/_[a-z0-9]+\.([^.]+)$/i, ".$1");

    return new NextResponse(response.body as any, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          cleanName
        )}"`,
      },
    });
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
