/**
 * @file app/actions/common.ts
 * @purpose Shared helper functions for file and folder operations.
 * @scope Global versioning, Team user resolution (Singleton-like logic), Maintenance tasks.
 * @out-of-scope Specific file or folder manipulation.
 * @failure-behavior Throws internal errors if system state is invalid (e.g. DB connection lost).
 */
"use server";

import PocketBase from "pocketbase";
import { getTeamUserId, setCachedTeamId, getAdminClient } from "@/lib/admin";

// Helper to get or create a dedicated Team User
export async function getOrCreateTeamUser(pb: PocketBase) {
  // Try cache first
  const cached = await getTeamUserId(pb);
  if (cached) return cached;

  const TEAM_EMAIL = "cloud-team@monad.io.kr";
  try {
    const pwd = "team_password_secure_" + Math.random().toString(36);
    try {
      const user = await pb.collection("users").create({
        email: TEAM_EMAIL,
        emailVisibility: true,
        password: pwd,
        passwordConfirm: pwd,
        name: "Team Monacle",
        nickname: "Team Monacle",
        type: "monad",
      });
      setCachedTeamId(user.id);
      return user.id;
    } catch (createError: unknown) {
      try {
        const user = await pb
          .collection("users")
          .getFirstListItem(`email="${TEAM_EMAIL}"`);
        setCachedTeamId(user.id);
        return user.id;
      } catch {
        console.error(
          "Team User Creation Error Details:",
          (createError as any).data,
        );
        throw createError;
      }
    }
  } catch (e) {
    throw e;
  }
}

// Global Version Control Helper
export async function incrementVersion(pb: PocketBase): Promise<number> {
  const VERSION_Record_ID = "nubmsjlcwqh10wb";
  try {
    const record = await pb.collection("tVersion").getOne(VERSION_Record_ID);
    const nextVersion = (record.version || 0) + 1;
    await pb.collection("tVersion").update(VERSION_Record_ID, {
      version: nextVersion,
    });
    return nextVersion;
  } catch (e) {
    console.error("Failed to increment version:", e);
    return 0;
  }
}

// Maintenance: Prune old deleted records
export async function pruneOldDeletedRecords() {
  const MAX_VERSION_DIFF = 300;
  try {
    const pb = await getAdminClient();
    // Get current version
    const verRecord = await pb.collection("tVersion").getOne("nubmsjlcwqh10wb");
    const currentVersion = verRecord.version || 0;

    if (currentVersion <= MAX_VERSION_DIFF) return { success: true, count: 0 };

    const threshold = currentVersion - MAX_VERSION_DIFF;

    // Find records older than threshold
    // Filter: tVersion < threshold
    const oldRecords = await pb.collection("tDeleted").getFullList({
      filter: `tVersion < ${threshold}`,
      fields: "id",
      $autoCancel: false,
    });

    if (oldRecords.length === 0) return { success: true, count: 0 };

    // Batch delete
    await Promise.all(
      oldRecords.map((r) => pb.collection("tDeleted").delete(r.id)),
    );

    return { success: true, count: oldRecords.length };
  } catch (e: unknown) {
    console.error("Prune Failed:", e);
    return { success: false, error: (e as Error).message };
  }
}
