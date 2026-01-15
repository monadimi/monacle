import { openDB, DBSchema, IDBPDatabase } from "idb";

interface MonacleDriveDB extends DBSchema {
  files: {
    key: string;
    value: any;
    indexes: { "by-folder": string; "by-owner": string };
  };
  folders: {
    key: string;
    value: any;
    indexes: { "by-parent": string; "by-owner": string };
  };
  meta: {
    key: string;
    value: any;
  };
}

const DB_NAME = "monacle-drive-db";
const DB_VERSION = 1;

export class LocalDrive {
  private _dbPromise: Promise<IDBPDatabase<MonacleDriveDB>> | null = null;

  private get dbPromise(): Promise<IDBPDatabase<MonacleDriveDB>> {
    if (!this._dbPromise) {
      if (typeof window === "undefined") {
        return Promise.reject(new Error("IndexedDB not available on server"));
      }
      this._dbPromise = openDB<MonacleDriveDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Files Store
          if (!db.objectStoreNames.contains("files")) {
            const store = db.createObjectStore("files", { keyPath: "id" });
            store.createIndex("by-folder", "folder");
            store.createIndex("by-owner", "owner");
          }
          // Folders Store
          if (!db.objectStoreNames.contains("folders")) {
            const store = db.createObjectStore("folders", { keyPath: "id" });
            store.createIndex("by-parent", "parent");
            store.createIndex("by-owner", "owner");
          }
          // Metadata Store (for sync version)
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta");
          }
        },
      });
    }
    return this._dbPromise;
  }

  constructor() {}

  async getSyncVersion(): Promise<number> {
    const db = await this.dbPromise;
    const val = await db.get("meta", "lastSyncVersion");
    return (val as number) || 0;
  }

  async setSyncVersion(version: number) {
    const db = await this.dbPromise;
    await db.put("meta", version, "lastSyncVersion");
  }

  async saveFiles(files: any[]) {
    if (!files.length) return;
    const db = await this.dbPromise;
    const tx = db.transaction("files", "readwrite");
    await Promise.all(files.map((f) => tx.store.put(f)));
    await tx.done;
  }

  async saveFolders(folders: any[]) {
    if (!folders.length) return;
    const db = await this.dbPromise;
    const tx = db.transaction("folders", "readwrite");
    await Promise.all(folders.map((f) => tx.store.put(f)));
    await tx.done;
  }

  async deleteFiles(ids: string[]) {
    if (!ids.length) return;
    const db = await this.dbPromise;
    const tx = db.transaction("files", "readwrite");
    await Promise.all(ids.map((id) => tx.store.delete(id)));
    await tx.done;
  }

  async deleteFolders(ids: string[]) {
    if (!ids.length) return;
    const db = await this.dbPromise;
    const tx = db.transaction("folders", "readwrite");
    await Promise.all(ids.map((id) => tx.store.delete(id)));
    await tx.done;
  }

  async clearAll() {
    const db = await this.dbPromise;
    await db.clear("files");
    await db.clear("folders");
    await db.clear("meta");
  }

  // --- Retrieval Methods ---

  async getAllFiles(ownerFilter?: string) {
    const db = await this.dbPromise;
    if (ownerFilter) {
      return db.getAllFromIndex("files", "by-owner", ownerFilter);
    }
    return db.getAll("files");
  }

  async getAllFolders(ownerFilter?: string) {
    const db = await this.dbPromise;
    if (ownerFilter) {
      return db.getAllFromIndex("folders", "by-owner", ownerFilter);
    }
    return db.getAll("folders");
  }
}

export const localDrive = new LocalDrive();
