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
    let record;
    try {
      record = await pb.collection(collectionId).getOne(recordId);
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
        console.error(
          `Forbidden access: User ${user.id} is not owner of ${recordId}`
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
    // Check for split parts
    const files = Array.isArray(record.file) ? record.file : [record.file];

    // Sort files just in case
    files.sort();

    // Determine if we are serving a split file
    // Condition: Multiple files exist AND they follow the pattern .partXXX
    // If the requested filename is one of them, we serve the WHOLE stitched file.
    // Or if the user requested the "base" name? But URL usually includes specific filename from UI.
    // The UI currently links to `file.file[0]`.
    // So if user clicks `movie.mp4.part001`, we should detect it's a part and serve the whole thing.

    const isSplitPart = (name: string) => /\.part\d+/.test(name);
    const hasSplitParts = files.length > 1 && files.every(isSplitPart);

    let streamBody: any;

    // Allow overriding filename via query param (for preserving Korean names)
    const queryFilename = request.nextUrl.searchParams.get("filename");
    const thumb = request.nextUrl.searchParams.get("thumb");

    // Base filename logic
    let cleanName =
      queryFilename ||
      record.name ||
      filename.replace(/_[a-z0-9]+\.([^.]+)$/i, ".$1");
    let contentType: string | null = null;

    if (hasSplitParts) {
      // Numerical Sort to ensure correct binary order
      const getPartNum = (name: string) => {
        const match = name.match(/\.part(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      };
      files.sort((a, b) => getPartNum(a) - getPartNum(b));

      // Completion Check: Verify if all chunks are present
      const maxPartNum = Math.max(...files.map(getPartNum));
      if (files.length < maxPartNum) {
        console.error(
          `[Proxy] record ${recordId} is missing parts! Found ${files.length}, expected ${maxPartNum}.`
        );
      }

      console.log(
        `[Proxy] Stitching Mode Active for record ${recordId} (${files.length} parts)`
      );
      // Stitching Mode
      cleanName = cleanName.replace(/\.part\d+.*$/, "");

      const fileUrls = files.map((f: string) => pb.files.getURL(record, f));

      streamBody = makeStitchedStream(
        fileUrls,
        { Authorization: pb.authStore.token },
        files
      );

      // Content Type sniffing?
      // We might default to octet-stream or try to guess from cleanName ext
    } else {
      // Single File Mode
      // Forward 'thumb' parameter to PocketBase
      const fileUrl = pb.files.getURL(
        record,
        filename,
        thumb ? { thumb } : undefined
      );
      const response = await fetch(fileUrl, {
        headers: { Authorization: pb.authStore.token },
      });

      if (!response.ok)
        return new NextResponse("File fetch failed", {
          status: response.status,
        });
      streamBody = response.body;

      // If generic content type, we might want to sniff from response?
      // But we reuse the cleanName logic below.
      if (!contentType)
        contentType =
          response.headers.get("content-type") || "application/octet-stream";
    }

    // Common Cleanup & Headers
    const ext = cleanName.split(".").pop()?.toLowerCase();

    // ... Content Type Logic (re-using existing block structure)
    if (!contentType || contentType === "application/octet-stream") {
      if (thumb) {
        // Thumbnails are always images (usually JPEG in PocketBase)
        contentType = "image/jpeg";
      } else if (ext === "pdf") {
        contentType = "application/pdf";
      } else if (
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

    // Final Fallback if still null/empty (though logic above tries to set it)
    const finalContentType = contentType || "application/octet-stream";

    const isRiskyType = [
      "text/html",
      "text/htm",
      "image/svg+xml",
      "application/javascript",
      "application/x-javascript",
      "application/x-php",
      "text/javascript",
    ].includes(finalContentType.toLowerCase());

    const isPreviewable =
      !isRiskyType &&
      (finalContentType.startsWith("image/") ||
        finalContentType.startsWith("video/") ||
        finalContentType === "application/pdf" ||
        finalContentType.startsWith("text/"));

    const dispositionType = isPreviewable ? "inline" : "attachment";
    const encodedName = encodeURIComponent(cleanName);

    // Apply Throttling (5MB/s) - Skip for thumbnails for low overhead
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
      "Accept-Ranges": "none",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox",
    };

    // Include Content-Length if available (important for download progress)
    if (record.size && !thumb) {
      headers["Content-Length"] = record.size.toString();
    }

    return new NextResponse(streamBody, { headers });
  } catch (error: unknown) {
    console.error("Proxy Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Helper: Stitched Stream
function makeStitchedStream(
  urls: string[],
  headers: HeadersInit,
  filesDebug: string[]
): ReadableStream<Uint8Array> {
  let currentIdx = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream({
    async pull(controller) {
      // Loop until we enqueue something or close
      while (true) {
        // If no reader active, open next one
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

            console.log(
              `[Proxy] Stitching part ${currentIdx + 1}/${urls.length}: ${
                res.headers.get("content-length") || "unknown"
              } bytes`
            );
            reader = res.body.getReader();
          } catch (e) {
            controller.error(e);
            return;
          }
        }

        // Read from current
        try {
          const { done, value } = await reader.read();
          if (done) {
            // Current stream finished
            reader = null;
            currentIdx++;
            continue; // Loop to next source immediately
          }
          controller.enqueue(value);
          return; // Done with this pull
        } catch (e) {
          controller.error(e);
          return;
        }
      }
    },
    cancel(reason) {
      if (reader) {
        reader.cancel(reason);
      }
    },
  });
}

function makeThrottledStream(
  inputStream: ReadableStream<any>,
  bytesPerSecond: number
): ReadableStream<Uint8Array> {
  // Safeguard: Check if it's a Web Stream
  if (typeof inputStream.getReader !== "function") {
    // If not a web stream (e.g. Node stream), bypass throttling to prevent crash
    // Or we could try Readable.toWeb(inputStream) if imported?
    // For now, bypass is safer to restore functionality.
    console.warn("Skipping throttling: inputStream is not a Web Stream");
    return inputStream;
  }

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
