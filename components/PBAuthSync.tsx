"use client";

import { useEffect } from "react";
import pb from "@/lib/pocketbase";

export default function PBAuthSync({ token }: { token?: string }) {
  useEffect(() => {
    if (token) {
      pb.authStore.save(token, null);
    }
  }, [token]);

  return null;
}
