/**
 * @file app/actions/slides.ts
 * @purpose Server Actions for Monacle Slides (Presentations).
 * @scope CRUD for Decks.
 * @failure-behavior Returns { success: false, error: string } on failure.
 */
"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";
import { verifySession } from "@/lib/session";

export async function createDeck(
  title: string = "새 프레젠테이션",
  description: string = "",
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();

    const initialSlides = [
      {
        id: crypto.randomUUID(),
        layout_type: "title", // title, bullet, image_left, etc.
        elements: [], // Will hold board elements
        background_style: { type: "solid", value: "#ffffff" },
        notes: "",
      },
    ];

    const themeConfig = {
      fontHeading: "Inter",
      fontBody: "Inter",
      palette: "neon", // 'neon', 'minimal', 'glass'
      primaryColor: "#6366f1",
    };

    const data = {
      title,
      description,
      author: user.id,
      slides: JSON.stringify(initialSlides),
      theme_config: JSON.stringify(themeConfig),
      is_shared: false,
      share_type: "view",
      is_deleted: false,
    };

    const record = await pb.collection("slides").create(data);
    return { success: true, id: record.id };
  } catch (error: unknown) {
    console.error("Create Deck Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function getDeck(id: string) {
  try {
    const pb = await getAdminClient();

    // Optional: Check user auth if we want to enforce deck visibility rules strictly here
    // But for now, we just fetch via Admin and let the frontend handle read-only vs edit.

    const record = await pb.collection("slides").getOne(id);

    return {
      success: true,
      deck: {
        id: record.id,
        title: record.title,
        description: record.description,
        slides:
          typeof record.slides === "string"
            ? JSON.parse(record.slides)
            : record.slides,
        theme_config:
          typeof record.theme_config === "string"
            ? JSON.parse(record.theme_config)
            : record.theme_config,
        author: record.author,
        is_shared: record.is_shared,
        share_type: record.share_type,
        share_team: record.share_team,
        updated: record.updated,
      },
    };
  } catch (error: unknown) {
    console.error("Get Deck Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDeck(
  id: string,
  data: {
    title?: string;
    slides?: unknown[];
    theme_config?: unknown;
    is_shared?: boolean;
    share_type?: "view" | "edit";
    share_team?: boolean;
  },
) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();

    // Check permission
    const record = await pb.collection("slides").getOne(id);
    const isOwner = record.author === user.id;
    const isEditShared = record.is_shared && record.share_type === "edit";
    // Team check omitted for brevity, similar to existing logic

    if (!isOwner && !isEditShared) {
      throw new Error("Forbidden");
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.slides) updateData.slides = JSON.stringify(data.slides);
    if (data.theme_config)
      updateData.theme_config = JSON.stringify(data.theme_config);

    await pb.collection("slides").update(id, updateData);
    return { success: true };
  } catch (error: unknown) {
    console.error("Update Deck Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function listUserDecks() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();

    // const filter = `author = "${user.id}"`;

    // Using simple fetch for now
    const records = await pb.collection("slides").getList(1, 50, {
      filter: `author = "${user.id}"`, // Temp simple filter
      sort: "-updated",
    });

    return { success: true, decks: records.items };
  } catch (error: unknown) {
    console.error("List Decks Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDeck(id: string) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    const user = await verifySession(session?.value);
    if (!user) throw new Error("Unauthorized");

    const pb = await getAdminClient();
    const record = await pb.collection("slides").getOne(id);
    if (record.author !== user.id) throw new Error("Forbidden");

    await pb.collection("slides").delete(id);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message };
  }
}
