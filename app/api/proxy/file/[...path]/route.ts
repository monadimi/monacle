/**
 * @file app/api/proxy/file/[...path]/route.ts
 * @purpose Proxies file requests to PocketBase, handling authentication, caching, and stitching of large files.
 * @scope File streaming, Access control (Shared/Owner/Team), HTTP Caching (ETag/Last-Modified).
 * @out-of-scope File uploading, metadata modification.
 * @failure-behavior Returns 404 for missing files, 401/403 for unauthorized access, 500 for internal errors.
 */
import { NextRequest, NextResponse } from "next/server";
import PocketBase, { RecordModel } from "pocketbase";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

export const maxDuration = 300; // 5 minutes for long-running stitching
const POCKETBASE_API_URL =
  process.env.POCKETBASE_API_URL || "https://monadb.snowman0919.site";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
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
    const session = parseJsonCookie(cookieStore.get("monacle_session")?.value);
    const user = session ?? null;

    const userToken = resolveUserToken(cookieStore, session);

    // 2. Admin Client (Cached) with safe fallback
    let pb: PocketBase;
    try {
      pb = await getAdminClient();
    } catch (err) {
      console.error("[Proxy] Admin client unavailable, falling back:", err);
      pb = new PocketBase(POCKETBASE_API_URL);
    }
    if (!pb.authStore.isValid && userToken) {
      pb.authStore.save(userToken, {
        collectionId: "users",
        collectionName: "users",
      } as RecordModel);
    }

    // 3. Ownership and Sharing Check
    let record;
    try {
      record = await pb.collection(collectionId).getOne(recordId);
    } catch (err) {
      if (collectionId !== "cloud") {
        try {
          console.warn(
            `[Proxy] Collection ${collectionId} not found, retrying with cloud`,
          );
          collectionId = "cloud";
          record = await pb.collection(collectionId).getOne(recordId);
        } catch (fallbackErr) {
          console.error(
            `Proxy GetOne Failed for ${collectionId}/${recordId}:`,
            fallbackErr,
          );
          return new NextResponse("Not Found", { status: 404 });
        }
      } else {
        console.error(
          `Proxy GetOne Failed for ${collectionId}/${recordId}:`,
          err,
        );
        return new NextResponse("Not Found", { status: 404 });
      }
    }

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
        `Forbidden access: User ${user.id} is not owner of ${recordId} (protected)`,
      );
      return new NextResponse("Forbidden", { status: 403 });
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

    let streamBody: ReadableStream<Uint8Array> | null = null;
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

      const fileToken = await getFileTokenSafe(pb);
      const fileUrls = files.map((f: string) => {
        const url = pb.files.getURL(
          record,
          f,
          fileToken ? { token: fileToken } : undefined,
        );
        console.log(`[Proxy] Generated Part URL: ${url}`);
        return url;
      });

      streamBody = makeStitchedStream(
        fileUrls,
        pb.authStore.isValid ? { Authorization: pb.authStore.token } : {},
        files,
      );
      cleanName = cleanName.replace(/\.part\d+.*$/, "");
    } else {
      const fileToken = await getFileTokenSafe(pb);
      const fileUrl = pb.files.getURL(record, filename, {
        ...(thumb ? { thumb } : {}),
        ...(fileToken ? { token: fileToken } : {}),
      });
      const response = await fetch(fileUrl, {
        headers: pb.authStore.isValid
          ? { Authorization: pb.authStore.token }
          : {},
      });
      console.log(`[Proxy] Fetching file from: ${fileUrl}`);

      if (!response.ok) {
        console.error(
          `[Proxy] Upstream fetch failed: ${response.status} ${response.statusText}`,
        );
        return new NextResponse("File fetch failed", {
          status: response.status,
        });
      }
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
  filesDebug: string[],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeThrottledStream(
  inputStream: ReadableStream<Uint8Array> | any,
  bytesPerSecond: number,
): ReadableStream<Uint8Array> {
  if (typeof inputStream.getReader !== "function") return inputStream;
  const reader = inputStream.getReader();
  const start = Date.now();
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

function parseJsonCookie(value?: string): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

function resolveUserToken(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  session: Record<string, unknown> | null,
): string | null {
  const directToken = cookieStore.get("monacle_token")?.value;
  if (directToken) return directToken;

  const sessionToken =
    typeof session?.token === "string" ? session.token : null;
  if (sessionToken) return sessionToken;

  const pbAuth = parseJsonCookie(cookieStore.get("pb_auth")?.value);
  const pbAuthToken = typeof pbAuth?.token === "string" ? pbAuth.token : null;
  if (pbAuthToken) return pbAuthToken;

  return null;
}

async function getFileTokenSafe(pb: PocketBase): Promise<string | null> {
  try {
    return await pb.files.getToken();
  } catch (error) {
    console.error("[Proxy] Failed to get file token:", error);
    return null;
  }
}
