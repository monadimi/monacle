import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";
import { signSession } from "@/lib/session";

function getExternalBaseUrl(req: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.trim().length > 0) {
    return envBase.replace(/\/+$/, "");
  }

  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";

  return `${proto}://${host}`.replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const baseUrl = getExternalBaseUrl(req);
  const redirectUri = `${baseUrl}/callback`;
  const clientId = process.env.MONAD_CLIENT_ID || "MONACLE_DEV";

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, baseUrl),
    );
  }

  const cookieStore = await cookies();
  const storedVerifier = cookieStore.get("verifier")?.value;
  const storedState = cookieStore.get("state")?.value;

  console.log("[Callback] Request Params:", { code: !!code, state, error });
  console.log("[Callback] Stored Cookies:", {
    verifier: !!storedVerifier,
    state: storedState,
  });

  if (!state || !storedState || state !== storedState) {
    console.error("[Callback] State mismatch:", {
      received: state,
      stored: storedState,
    });
    return NextResponse.redirect(new URL("/?error=state_mismatch", baseUrl));
  }

  if (!code || !storedVerifier) {
    console.error("[Callback] Missing code or verifier:", {
      code: !!code,
      verifier: !!storedVerifier,
    });
    return NextResponse.redirect(
      new URL("/?error=no_code_or_verifier", baseUrl),
    );
  }

  try {
    const form = new URLSearchParams();
    form.set("grant_type", "authorization_code");
    form.set("client_id", clientId);
    form.set("redirect_uri", redirectUri);
    form.set("code", code);
    form.set("code_verifier", storedVerifier);

    const tokenRes = await fetch("https://id.monad.io.kr/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, errText);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", baseUrl),
      );
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson?.access_token;

    if (!accessToken || typeof accessToken !== "string") {
      console.error("Token response missing access_token:", tokenJson);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", baseUrl),
      );
    }

    const userRes = await fetch("https://id.monad.io.kr/api/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Client-Id": clientId,
      },
    });

    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("User info fetch failed:", userRes.status, errText);
      return NextResponse.redirect(
        new URL("/?error=user_fetch_failed", baseUrl),
      );
    }

    const userData = await userRes.json();

    if (userData?.type !== "monad") {
      return NextResponse.redirect(
        new URL("/?error=unauthorized_type", baseUrl),
      );
    }

    if (
      !userData?.email ||
      typeof userData.email !== "string" ||
      !userData.email.endsWith("@monad.io.kr")
    ) {
      return NextResponse.redirect(
        new URL("/?error=unauthorized_domain", baseUrl),
      );
    }

    // --- Sync with PocketBase ---
    const pb = await getAdminClient();
    let pbUser;

    try {
      pbUser = await pb
        .collection("users")
        .getFirstListItem(`email="${userData.email}"`);
      console.log("[Callback] Found existing PB user:", pbUser.id);
    } catch {
      console.log("[Callback] PB user not found, creating one...");
      // Create user if not exists
      const randomPassword =
        Math.random().toString(36).slice(-12) +
        Math.random().toString(36).slice(-12);
      pbUser = await pb.collection("users").create({
        email: userData.email,
        password: randomPassword,
        passwordConfirm: randomPassword,
        name: userData.name || userData.nickname || "Monad User",
        emailVisibility: true,
        type: "monad",
      });
      console.log("[Callback] Created new PB user:", pbUser.id);
    }

    const isProd =
      process.env.NODE_ENV === "production" &&
      !baseUrl.includes("localhost") &&
      !baseUrl.includes("127.0.0.1");

    const res = NextResponse.redirect(new URL("/dashboard", baseUrl));

    // For compatibility with dashboard layout/server actions
    const sessionData = {
      id: pbUser.id,
      name: pbUser.name,
      email: pbUser.email,
      avatar: pbUser.avatar,
      token: accessToken,
    };

    const signedSession = await signSession(sessionData);

    res.cookies.set("monacle_session", signedSession, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    res.cookies.set("monacle_token", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    res.cookies.delete("verifier");
    res.cookies.delete("state");

    return res;
  } catch (e) {
    console.error("Callback handler error:", e);
    return NextResponse.redirect(new URL("/?error=server_error", baseUrl));
  }
}
