import { NextRequest, NextResponse } from "next/server";
import { RecordModel } from "pocketbase";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

export const maxDuration = 300; // 5 minutes for long-running stitching

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (!path || path.length < 2) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    let collectionId: string;
    let recordId: string;
    let filename: string;

    if (path.length === 2) {
      // Legacy or internal shorthand: /api/proxy/file/[recordId]/[filename]
      collectionId = "cloud";
      [recordId, filename] = path;
    } else {
      // Standard: /api/proxy/file/[collectionId]/[recordId]/[filename]
      [collectionId, recordId, filename] = path;
    }

    // 1. Verify Session
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = session?.value ? JSON.parse(session.value) : null;

    // 2. Admin Client (Cached)
    const pb = await getAdminClient();

    // 3. Ownership and Sharing Check
    let record;
    try {
      record = await pb.collection(collectionId).getOne(recordId);

      const isShared = record.is_shared === true || record.is_shared === "true";
      const isOwner =
        user && (record.owner === user.id || record.owner === user.email);

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
      const isTeam = user && record.owner === teamId && teamId !== "";

      // Access logic:
      // Allow if:
      // 1. It's shared (is_shared: true)
      // 2. User is owner
      // 3. User is part of team
      if (!isShared && !isOwner && !isTeam) {
        if (!user) {
          return new NextResponse("Unauthorized", { status: 401 });
        }
        console.error(
          `Forbidden access: User ${user.id} is not owner of ${recordId} (protected)`
        );
        return new NextResponse("Forbidden", { status: 403 });
      }
    } catch (err) {
      console.error(
        `Proxy GetOne Failed for ${collectionId}/${recordId}:`,
        err
      );
      return new NextResponse("Not Found", { status: 404 });
    }

    // 4. Caching: Handle 304 Not Modified
    const fileLastModified = new Date(record.updated).toUTCString();
    // Strong ETag based on updated timestamp
    const etag = `W/"${record.updated.replace(/[^a-zA-Z0-9]/g, "")}"`;

    const ifNoneMatch = request.headers.get("if-none-match");
    const ifModifiedSince = request.headers.get("if-modified-since");

    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Last-Modified": fileLastModified,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (ifModifiedSince) {
      const cachedTime = new Date(ifModifiedSince).getTime();
      const serverTime = new Date(record.updated).getTime();
      const serverTimeSec = Math.floor(serverTime / 1000) * 1000;
      const cachedTimeSec = Math.floor(cachedTime / 1000) * 1000;

      if (cachedTimeSec >= serverTimeSec) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Last-Modified": fileLastModified,
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }

    // 5. Stream File (Stitching Logic)
    const files = Array.isArray(record.file) ? record.file : [record.file];
    files.sort();

    const isSplitPart = (name: string) => /\.part\d+/.test(name);
    const hasSplitParts = files.length > 1 && files.every(isSplitPart);

    let streamBody: any;
    const queryFilename = request.nextUrl.searchParams.get("filename");
    const thumb = request.nextUrl.searchParams.get("thumb");

    let cleanName =
      queryFilename ||
      record.name ||
      filename.replace(/_[a-z0-9]+\.([^.]+)$/i, ".$1");
    let contentType: string | null = null;

    if (hasSplitParts) {
      const getPartNum = (name: string) => {
        const match = name.match(/\.part(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };
      files.sort((a, b) => getPartNum(a) - getPartNum(b));

      const fileToken = await pb.files.getToken();
      const fileUrls = files.map((f: string) =>
        pb.files.getURL(record, f, { token: fileToken })
      );

      streamBody = makeStitchedStream(
        fileUrls,
        { Authorization: pb.authStore.token },
        files
      );
      cleanName = cleanName.replace(/\.part\d+.*$/, "");
    } else {
      const fileToken = await pb.files.getToken();
      const fileUrl = pb.files.getURL(
        record,
        filename,
        thumb ? { thumb, token: fileToken } : { token: fileToken }
      );
      const response = await fetch(fileUrl, {
        headers: { Authorization: pb.authStore.token },
      });

      if (!response.ok)
        return new NextResponse("File fetch failed", {
          status: response.status,
        });
      streamBody = response.body;
      contentType =
        response.headers.get("content-type") || "application/octet-stream";
    }

    const ext = cleanName.split(".").pop()?.toLowerCase();
    if (!contentType || contentType === "application/octet-stream") {
      if (thumb) contentType = "image/jpeg";
      else if (ext === "pdf") contentType = "application/pdf";
      else if (
        ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")
      ) {
        contentType = `image/${ext === "svg" ? "svg+xml" : ext}`;
      } else if (["mp4", "webm", "mov"].includes(ext || "")) {
        contentType = `video/${ext === "mov" ? "quicktime" : ext}`;
      } else if (
        ["txt", "md", "html", "css", "js", "json"].includes(ext || "")
      ) {
        contentType = "text/plain";
      }
    }

    const finalContentType = contentType || "application/octet-stream";
    const isRiskyType = [
      "text/html",
      "text/htm",
      "image/svg+xml",
      "application/javascript",
    ].includes(finalContentType.toLowerCase());
    const isPreviewable =
      !isRiskyType &&
      (finalContentType.startsWith("image/") ||
        finalContentType.startsWith("video/") ||
        finalContentType === "application/pdf" ||
        finalContentType.startsWith("text/"));
    const dispositionType = isPreviewable ? "inline" : "attachment";
    const encodedName = encodeURIComponent(cleanName);

    const BANDWIDTH_LIMIT = 1024 * 1024 * 5;
    if (streamBody && !thumb) {
      streamBody = makeThrottledStream(streamBody, BANDWIDTH_LIMIT);
    }

    const headers: Record<string, string> = {
      "Content-Type": finalContentType,
      "Cache-Control":
        finalContentType.startsWith("image/") || thumb
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
      "Last-Modified": fileLastModified,
      ETag: etag,
      "Content-Disposition": `${dispositionType}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox",
    };

    if (record.size && !thumb) {
      headers["Content-Length"] = record.size.toString();
    }

    return new NextResponse(streamBody, { headers });
  } catch (error: unknown) {
    console.error("Proxy Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

function makeStitchedStream(
  urls: string[],
  headers: HeadersInit,
  filesDebug: string[]
): ReadableStream<Uint8Array> {
  let currentIdx = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream({
    async pull(controller) {
      while (true) {
        if (!reader) {
          if (currentIdx >= urls.length) {
            controller.close();
            return;
          }
          const url = urls[currentIdx];
          try {
            const res = await fetch(url, { headers });
            if (!res.ok)
              throw new Error(`Part fetch failed: ${filesDebug[currentIdx]}`);
            if (!res.body) throw new Error("No body");
            reader = res.body.getReader();
          } catch (e) {
            controller.error(e);
            return;
          }
        }
        try {
          const { done, value } = await reader.read();
          if (done) {
            reader = null;
            currentIdx++;
            continue;
          }
          controller.enqueue(value);
          return;
        } catch (e) {
          controller.error(e);
          return;
        }
      }
    },
    cancel(reason) {
      if (reader) reader.cancel(reason);
    },
  });
}

function makeThrottledStream(
  inputStream: any,
  bytesPerSecond: number
): ReadableStream<Uint8Array> {
  if (typeof inputStream.getReader !== "function") return inputStream;
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
