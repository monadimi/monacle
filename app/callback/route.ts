import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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

  const cookieStore = cookies();
  const storedVerifier = cookieStore.get("verifier")?.value;
  const storedState = cookieStore.get("state")?.value;

  const baseUrl = getExternalBaseUrl(req);
  const redirectUri = `${baseUrl}/callback`;
  const clientId = process.env.MONAD_CLIENT_ID || "MONACLE_DEV";

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, baseUrl)
    );
  }

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=state_mismatch", baseUrl));
  }

  if (!code || !storedVerifier) {
    return NextResponse.redirect(
      new URL("/?error=no_code_or_verifier", baseUrl)
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
      const err = await tokenRes.text();
      console.error("Token exchange failed:", tokenRes.status, err);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", baseUrl)
      );
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson?.access_token;

    if (!accessToken || typeof accessToken !== "string") {
      console.error("Token response missing access_token:", tokenJson);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", baseUrl)
      );
    }

    const userRes = await fetch("https://id.monad.io.kr/api/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Client-Id": clientId,
      },
    });

    if (!userRes.ok) {
      const err = await userRes.text();
      console.error("User info fetch failed:", userRes.status, err);
      return NextResponse.redirect(
        new URL("/?error=user_fetch_failed", baseUrl)
      );
    }

    const userData = await userRes.json();

    if (userData?.type !== "monad") {
      return NextResponse.redirect(
        new URL("/?error=unauthorized_type", baseUrl)
      );
    }

    if (
      !userData?.email ||
      typeof userData.email !== "string" ||
      !userData.email.endsWith("@monad.io.kr")
    ) {
      return NextResponse.redirect(
        new URL("/?error=unauthorized_domain", baseUrl)
      );
    }

    const isProd = process.env.NODE_ENV === "production";

    cookieStore.set("monacle_token", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    cookieStore.delete("verifier");
    cookieStore.delete("state");

    return NextResponse.redirect(new URL("/dashboard", baseUrl));
  } catch (e) {
    console.error("Callback handler error:", e);
    return NextResponse.redirect(new URL("/?error=server_error", baseUrl));
  }
}
