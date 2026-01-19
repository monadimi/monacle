"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { startLogin } from "./actions/auth";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.group(`[Monacle Debug] ${timestamp}`);
    console.log("Current URL:", window.location.href);
    console.log("URL Search Params:", Object.fromEntries(searchParams.entries()));
    console.log("Document Domain:", document.domain);
    console.log("Referrer:", document.referrer);
    
    // Detailed Cookie Check
    const cookies = document.cookie.split(';').map(c => c.trim()).filter(Boolean);
    console.log("Client-Accessible Cookies:", cookies.length > 0 ? cookies : "None found");
    
    if (error) {
      console.error("Critical Auth Error:", error);
      // Detailed error mapping if known
      const errorMap: Record<string, string> = {
        'state_mismatch': 'CSRF protection failed: state in cookie does not match the one from ID provider.',
        'no_code_or_verifier': 'Cookie loss: verifier or code is missing. Possibly due to SameSite=Lax or Secure/HTTP requirements.',
        'token_exchange_failed': 'Server-side failure: Monacle server could not exchange the code for a token.',
        'user_fetch_failed': 'API failure: Logged in but failed to fetch detailed user profile.',
        'unauthorized_type': 'Access denied: User type is not "monad".',
        'unauthorized_domain': 'Access denied: Email domain is not "@monad.io.kr".',
      };
      if (errorMap[error]) {
        console.warn("Error Explanation:", errorMap[error]);
      }
    }
    console.groupEnd();
  }, [searchParams, error]);

  const handleLogin = async () => {
    console.log("[Monacle] Starting Login Flow...");
    await startLogin();
  };

  return (
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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
          Authentication Error: {error}
        </div>
      )}

      <form action={handleLogin} className="w-full">
        <button
          type="submit"
          className="w-full bg-slate-900 hover:bg-black text-white font-bold h-14 rounded-2xl transition-all active:scale-[0.98] shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 group"
        >
          <span>Continue with Monad ID</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </form>

      <p className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-semibold">
        Monad Internal Service <span className="opacity-50 ml-2">v1.0</span>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-500/20 rounded-full blur-[120px] pointer-events-none" />

      <Suspense fallback={<div>Loading...</div>}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
