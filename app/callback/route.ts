import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedVerifier = cookieStore.get("verifier")?.value;
  const storedState = cookieStore.get("state")?.value;

  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const CLIENT_ID = process.env.MONAD_CLIENT_ID || "MONACLE_DEV";

  console.log("Debug Callback:", {
    code: code?.substring(0, 5) + "...",
    state,
    storedVerifier: storedVerifier ? "Present" : "Missing",
    redirect_uri: `${BASE_URL}/callback`,
    client_id: CLIENT_ID,
  });

  // 1. Validate State
  if (!state || !storedState || state !== storedState) {
    console.error("State Validation Failed");
    return NextResponse.redirect(new URL("/?error=state_mismatch", req.url));
  }

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, req.url));
  }

  if (!code || !storedVerifier) {
    console.error("Missing Code or Verifier");
    return NextResponse.redirect(
      new URL("/?error=no_code_or_verifier", req.url)
    );
  }

  try {
    // 2. Exchange Code for Token
    const payload = {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: `${BASE_URL}/callback`,
      code,
      code_verifier: storedVerifier,
    };

    console.log("Token Exchange Payload:", JSON.stringify(payload, null, 2));

    const tokenRes = await fetch("https://id.monad.io.kr/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", req.url)
      );
    }

    const { access_token } = await tokenRes.json();

    try {
      const parts = access_token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        console.log("JWT Payload Debug:", payload);
      }
    } catch (e) {
      console.error("Failed to parse JWT for debug", e);
    }

    // 3. Fetch User Info
    const userRes = await fetch("https://id.monad.io.kr/api/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "X-Client-Id": CLIENT_ID,
      },
    });

    if (!userRes.ok) {
      const err = await userRes.text();
      console.error("User info fetch failed:", userRes.status, err);
      return NextResponse.redirect(
        new URL("/?error=user_fetch_failed", req.url)
      );
    }

    const userData = await userRes.json();
    console.log("Logged in user:", userData);

    // 4. Check User Type
    if (userData.type !== "monad") {
      return NextResponse.redirect(
        new URL("/?error=unauthorized_type", req.url)
      );
    }

    if (!userData.email?.endsWith("@monad.io.kr")) {
      return NextResponse.redirect(
        new URL("/?error=unauthorized_domain", req.url)
      );
    }

    // 5. Store Session
    // We store the access_token so the client can use it for PocketBase requests.
    const sessionData = {
      ...userData,
      token: access_token, // Important: Pass this to client
    };

    cookieStore.set("monacle_session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
    });

    // Clean up temporary auth cookies
    cookieStore.delete("verifier");
    cookieStore.delete("state");

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/?error=server_error", req.url));
  }
}
