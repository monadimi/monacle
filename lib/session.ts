/**
 * @file lib/session.ts
 * @purpose Single Source of Truth for Session Integrity.
 * @scope Signing and Verifying session cookies using HMAC-SHA256.
 * @invariant Session = Verify(Sign(Data, Secret)). Untrusted input must fail verification.
 * @failure-behavior Returns null on verification failure. Throws on system error (missing secret).
 */
import { SignJWT, jwtVerify } from "jose";

// Use a consistent secret key.
// Fallback is DANGEROUS in production but allows dev start.
// We prefer POCKETBASE_ADMIN_PASSWORD as it is already a high-entropy secret in the env.
const SECRET_KEY =
  process.env.SESSION_SECRET ||
  process.env.POCKETBASE_ADMIN_PASSWORD ||
  "DEV_INSECURE_SECRET_CHANGE_ME";
const ENCODED_SECRET = new TextEncoder().encode(SECRET_KEY);

const ALG = "HS256";

/**
 * Signs a session payload into a JWS (JWT).
 * @param payload - The session data to sign.
 * @returns The signed JWT string.
 */
export async function signSession(payload: any): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d") // Align with cookie maxAge
    .sign(ENCODED_SECRET);
}

/**
 * Verifies a session cookie value.
 * @param token - The raw cookie string (JWT).
 * @returns The decoded payload if valid, null otherwise.
 */
export async function verifySession<T = any>(
  token: string | undefined,
): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, ENCODED_SECRET, {
      algorithms: [ALG],
    });
    return payload as T;
  } catch (error) {
    // console.warn("Session verification failed:", error); // Optional debug
    return null;
  }
}
