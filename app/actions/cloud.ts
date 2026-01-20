/**
 * @file app/actions/cloud.ts
 * @purpose Legacy aggregation point for cloud actions.
 * @description
 * Re-exports server actions from specific module files.
 * This file itself is NOT a Server Action boundary (no "use server"),
 * allowing it to re-export actions from other "use server" files correctly.
 */

export {
  uploadFile,
  listFiles,
  deleteFile,
  updateFileShare,
  updateFile,
  getStorageUsage,
} from "./file";

export { createFolder, deleteFolder, updateFolder } from "./folder";

export { pruneOldDeletedRecords, incrementVersion } from "./common";
