"use client";

import { useEffect } from "react";
import pb from "@/lib/pocketbase";

export default function PBAuthSync({ token }: { token?: string }) {
  useEffect(() => {
    if (token) {
      pb.authStore.save(token, null);
      // Persist to cookie for server-side actions
      document.cookie = pb.authStore.exportToCookie({ httpOnly: false });
    }
  }, [token]);

  return null;
}
