import crypto from "crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";

export default function LoginPage() {
  const startLogin = async () => {
    "use server";

    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const CLIENT_ID = process.env.MONAD_CLIENT_ID || "MONACLE_DEV"; // Placeholder

    // 1. PKCE Generation
    const verifier = base64URLEncode(crypto.randomBytes(32));
    const challenge = base64URLEncode(
      crypto.createHash("sha256").update(verifier).digest()
    );
    const state = base64URLEncode(crypto.randomBytes(16));

    // 2. Store verifier in cookie for callback verification
    const cookieStore = await cookies();
    cookieStore.set("verifier", verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production" });
    cookieStore.set("state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production" });

    // 3. Redirect to Monad ID
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: "https://monacle.snowman0919.site/callback",
      response_type: "code",
      scope: "email name type",
      state: state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    redirect(`https://id.monad.io.kr/authorize?${params}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-panel w-full max-w-md p-8 md:p-12 relative z-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-slate-200 transform rotate-3 overflow-hidden p-4">
          <img src="/monacle.svg" alt="Monacle Logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight text-slate-900">
          Monacle
        </h1>
        <p className="text-slate-600 mb-10 text-lg">
          Secure cloud storage for the <span className="font-semibold text-indigo-600">Monad</span> team.
        </p>

        <form action={startLogin} className="w-full">
          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-black text-white font-bold h-14 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 group"
          >
            <span>Continue with Monad ID</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <p className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-semibold">
          Monad Internal Service
        </p>
      </div>
    </main>
  );
}

function base64URLEncode(str: Buffer) {
  return str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
