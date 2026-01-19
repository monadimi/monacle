"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

function base64URLEncode(str: Buffer) {
  return str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function startLogin() {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const CLIENT_ID = process.env.MONAD_CLIENT_ID || "MONACLE_DEV";

  // 1. PKCE Generation
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(
    crypto.createHash("sha256").update(verifier).digest()
  );
  const state = base64URLEncode(crypto.randomBytes(16));

  // 2. Store verifier in cookie for callback verification
  const cookieStore = await cookies();
  cookieStore.set("verifier", verifier, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax"
  });
  cookieStore.set("state", state, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax"
  });

  // 3. Redirect to Monad ID
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${BASE_URL}/callback`,
    response_type: "code",
    scope: "email name type",
    state: state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  console.log("[Auth Action] Redirecting to Monad ID:", {
    baseUrl: BASE_URL,
    clientId: CLIENT_ID,
    redirectUri: `${BASE_URL}/callback`,
    state: state,
    verifier: !!verifier,
  });

  redirect(`https://id.monad.io.kr/authorize?${params}`);
}
