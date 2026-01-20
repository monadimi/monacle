/**
 * @file components/cowork/hooks/usePresence.ts
 * @purpose Manages real-time user presence (who is online) for a specific document/board.
 * @scope Fetching presence list, sending heartbeats, cleaning up stale users.
 */
import { useState, useCallback, useEffect, useRef } from "react";

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  updated: string;
}

export function usePresence(
  docId: string,
  currentUser?: {
    id?: string;
    email?: string;
    name?: string;
    avatar?: string;
  } | null,
  type: "doc" | "board" = "doc",
) {
  const [activeEditors, setActiveEditors] = useState<PresenceUser[]>([]);

  const buildAvatarUrl = useCallback(
    (user?: { id?: string; avatar?: string }) => {
      if (!user?.avatar || !user?.id) return undefined;
      if (user.avatar.startsWith("http")) return user.avatar;
      return `https://monadb.snowman0919.site/api/files/users/${user.id}/${user.avatar}`;
    },
    [],
  );

  const getLocalEditor = useCallback(() => {
    if (!currentUser?.id) return null;
    return {
      userId: currentUser.id,
      name: currentUser.name || currentUser.email || "User",
      avatarUrl: buildAvatarUrl(currentUser),
      updated: new Date().toISOString(),
    };
  }, [currentUser, buildAvatarUrl]);

  const mergeEditors = useCallback((items: PresenceUser[]) => {
    const deduped = new Map<string, PresenceUser>();
    for (const item of items) {
      if (!deduped.has(item.userId)) {
        deduped.set(item.userId, item);
      }
    }
    return Array.from(deduped.values());
  }, []);

  const fetchPresenceList = useCallback(async () => {
    try {
      const endpoint = type === "doc" ? "/api/presence" : "/api/presence/board";
      const param = type === "doc" ? `docId=${docId}` : `boardId=${docId}`;
      const res = await fetch(`${endpoint}?${param}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json();
      const local = getLocalEditor();

      const next = (data.items || []).map((record: any) => ({
        userId: record.user_id,
        name: record.name || "User",
        avatarUrl: buildAvatarUrl({
          id: record.user_id,
          avatar: record.avatar,
        }),
        updated: record.updated,
      }));

      setActiveEditors((prev) => {
        const combined = local ? [local, ...next] : next;
        return mergeEditors(combined);
      });
    } catch {
      // ignore errors
    }
  }, [docId, type, buildAvatarUrl, getLocalEditor, mergeEditors]);

  const upsertPresence = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const endpoint = type === "doc" ? "/api/presence" : "/api/presence/board";
      const body = type === "doc" ? { docId } : { boardId: docId };

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // ignore
    }
  }, [docId, type, currentUser]);

  const cleanupStale = useCallback(() => {
    const cutoff = Date.now() - 30000; // 30s timeout
    setActiveEditors((prev) =>
      prev.filter((item) => {
        const updatedAt = Date.parse(item.updated || "");
        return Number.isNaN(updatedAt) || updatedAt >= cutoff;
      }),
    );
  }, []);

  // Stable refs for intervals
  const fetchRef = useRef(fetchPresenceList);
  const upsertRef = useRef(upsertPresence);
  const cleanupRef = useRef(cleanupStale);

  useEffect(() => {
    fetchRef.current = fetchPresenceList;
  }, [fetchPresenceList]);
  useEffect(() => {
    upsertRef.current = upsertPresence;
  }, [upsertPresence]);
  useEffect(() => {
    cleanupRef.current = cleanupStale;
  }, [cleanupStale]);

  useEffect(() => {
    if (!docId) return;

    fetchRef.current();
    upsertRef.current();

    const heartbeat = setInterval(() => upsertRef.current(), 12000);
    const refresh = setInterval(() => fetchRef.current(), 6000);
    const cleanup = setInterval(() => cleanupRef.current(), 15000);

    return () => {
      clearInterval(heartbeat);
      clearInterval(refresh);
      clearInterval(cleanup);
      // Optional: Send delete on exit
      // const endpoint = type === 'doc' ? '/api/presence' : '/api/presence/board';
      // const param = type === 'doc' ? `docId=${docId}` : `boardId=${docId}`;
      // fetch(`${endpoint}?${param}`, { method: "DELETE", keepalive: true }).catch(() => {});
    };
  }, [docId, type]);

  return { activeEditors };
}
