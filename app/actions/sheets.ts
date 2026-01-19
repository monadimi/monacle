"use server";

import { cookies } from "next/headers";
import PocketBase from "pocketbase";
import { getAdminClient } from "@/lib/admin";

const PB_URL = process.env.POCKETBASE_API_URL || "https://monadb.snowman0919.site";

export type SheetData = {
  columns: { id: string; label: string; type: 'text' | 'number' | 'category'; width?: number }[];
  rows: Record<string, any>[];
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  charts: { id: string; type: 'bar' | 'line' | 'pie' | 'area'; xKey: string; yKeys: string[]; title: string; color?: string }[];
};

const INITIAL_SHEET_DATA: SheetData = {
  columns: [
    { id: 'col_1', label: 'Item', type: 'text', width: 200 },
    { id: 'col_2', label: 'Value', type: 'number', width: 150 },
  ],
  rows: [
    { id: 'row_1', col_1: 'A', col_2: 10 },
    { id: 'row_2', col_1: 'B', col_2: 20 },
    { id: 'row_3', col_1: 'C', col_2: 15 },
  ],
  charts: []
};

// Create a new Sheet
export async function createSheet(
  title: string = "Untitled Sheet",
  description: string = "A visual dataset."
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) throw new Error("Unauthorized");
    const user = JSON.parse(session.value);

    // Use Admin Client which works reliably
    const pb = await getAdminClient();

    const data = {
      title,
      description,
      author: user.id, // Explicitly set author from session
      data: INITIAL_SHEET_DATA,
      is_shared: false,
      is_deleted: false,
      type: "sheet" 
    };

    console.log("Creating sheet via Admin payload:", JSON.stringify(data, null, 2));
    const record = await pb.collection("sheets").create(data);
    return { success: true, id: record.id };
  } catch (error: unknown) {
    console.error("Create Sheet Error:", error);
    // console.error("Values:", (error as any).response); // Optional: keep or comment out
    return { success: false, error: (error as Error).message };
  }
}

// Get a Sheet
export async function getSheet(id: string) {
  try {
    const pb = await getAdminClient();
    const record = await pb.collection("sheets").getOne(id);

    return {
      success: true,
      sheet: {
        id: record.id,
        title: record.title,
        description: record.description,
        data: record.data as SheetData,
        author: record.author,
        is_shared: record.is_shared,
        updated: record.updated,
      },
      // Using admin client, authStore.model is admin, not user. 
      // But SheetPage passes session user as currentUser, so this field is less critical here 
      // or we can parse session again if strictly needed.
      currentUser: null 
    };
  } catch (error: unknown) {
    console.error("Get Sheet Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// Update a Sheet
export async function updateSheet(id: string, updates: Partial<{ title: string; data: SheetData; is_shared: boolean }>) {
  try {
    const pb = await getAdminClient();

    const data: any = { ...updates };
    if (updates.data) {
        data.data = updates.data;
    }

    const record = await pb.collection("sheets").update(id, data);
    return { success: true };
  } catch (error: unknown) {
    console.error("Update Sheet Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

// List user sheets
export async function listUserSheets() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get("monacle_session");
        if (!session?.value) return { success: true, items: [] };
        const user = JSON.parse(session.value);

        const pb = await getAdminClient();
    
        const records = await pb.collection("sheets").getList(1, 50, {
            sort: '-updated',
            filter: `author = "${user.id}" && is_deleted = false`
        });
        
        return { success: true, items: records.items };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

// Delete a Sheet (Soft Delete)
export async function deleteSheet(id: string) {
    try {
        const pb = await getAdminClient();
        // Soft delete: set is_deleted = true
        await pb.collection("sheets").update(id, { is_deleted: true });
        return { success: true };
    } catch (error: unknown) {
        console.error("Delete Sheet Error:", error);
        return { success: false, error: (error as Error).message };
    }
}
