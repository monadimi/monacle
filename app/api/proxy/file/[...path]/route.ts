import { NextRequest, NextResponse } from "next/server";
import { RecordModel } from "pocketbase";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

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
    const user = session?.value ? JSON.parse(session.value) : null;

    if (!user || !user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Admin Client (Cached)
    const pb = await getAdminClient();

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
      } catch {
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
    } catch {
      return new NextResponse("Not Found", { status: 404 });
    }

    // 4. Stream File
    // We use the admin token to fetch the file token-less?
    // Actually, getting the file via API usually doesn't require "admin login" if public,
    // but requires token if private.
    // Since we are proxying, we can use the fetch method with the admin token header.

    const fileUrl = pb.files.getURL(
      { collectionId, id: recordId } as unknown as RecordModel,
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
    let contentType =
      response.headers.get("content-type") || "application/octet-stream";

    // Allow overriding filename via query param (for preserving Korean names)
    const queryFilename = request.nextUrl.searchParams.get("filename");
    const cleanName =
      queryFilename || filename.replace(/_[a-z0-9]+\.([^.]+)$/i, ".$1");
    // Also use the extension from the display name if acceptable, or fallback to file extension
    const ext = cleanName.split(".").pop()?.toLowerCase();

    // Force correct content type for known extensions if generic
    if (contentType === "application/octet-stream" || !contentType) {
      if (ext === "pdf") contentType = "application/pdf";
      else if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || ""))
        contentType = `image/${ext === "svg" ? "svg+xml" : ext}`;
      else if (["mp4", "webm", "mov"].includes(ext || ""))
        contentType = `video/${ext === "mov" ? "quicktime" : ext}`;
      else if (["txt", "md", "html", "css", "js", "json"].includes(ext || ""))
        contentType = "text/plain";
    }

    // Determine disposition based on type
    const isPreviewable =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType === "application/pdf" ||
      contentType.startsWith("text/");
    const dispositionType = isPreviewable ? "inline" : "attachment";
    const encodedName = encodeURIComponent(cleanName);

    // Apply Throttling (5MB/s)
    let streamBody: any = response.body;
    const BANDWIDTH_LIMIT = 1024 * 1024 * 5;

    if (streamBody) {
      streamBody = makeThrottledStream(streamBody, BANDWIDTH_LIMIT);
    }

    return new NextResponse(streamBody, {
      headers: {
        "Content-Type": contentType,
        // Cache images aggressively (immutable), others standard 1h
        "Cache-Control": contentType.startsWith("image/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
        // Remove Pragma/Expires to let Cache-Control take precedence or set appropriately
        // "Pragma": "no-cache",
        // "Expires": "0",
        // Use filename* for proper UTF-8 handling
        "Content-Disposition": `${dispositionType}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (error: unknown) {
    console.error("Proxy Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

function makeThrottledStream(
  inputStream: ReadableStream<any>,
  bytesPerSecond: number
): ReadableStream<Uint8Array> {
  const reader = inputStream.getReader();
  let start = Date.now();
  let bytesSent = 0;

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      bytesSent += value.byteLength;
      const elapsedSeconds = (Date.now() - start) / 1000;
      const expectedSeconds = bytesSent / bytesPerSecond;

      if (elapsedSeconds < expectedSeconds) {
        const delay = (expectedSeconds - elapsedSeconds) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });
}
