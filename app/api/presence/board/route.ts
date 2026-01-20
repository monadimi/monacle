import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";
import { verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    if (!boardId) {
      return NextResponse.json({ error: "Missing boardId" }, { status: 400 });
    }

    const pb = await getAdminClient();
    const allItems = await pb.collection("board_presence").getFullList({
      $autoCancel: false,
    });

    const items = allItems.filter((i) => i.board_id === boardId);

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: unknown) {
    console.error("Board Presence GET Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifySession(session.value);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const boardId = body?.boardId;
    if (!boardId) {
      return NextResponse.json({ error: "Missing boardId" }, { status: 400 });
    }

    const pb = await getAdminClient();
    let record;
    try {
      record = await pb
        .collection("board_presence")
        .getFirstListItem(`board_id = "${boardId}" && user_id = "${user.id}"`);
    } catch {
      record = null;
    }

    const payload = {
      board_id: String(boardId),
      user_id: String(user.id),
      name: String(user.name || user.email || "User"),
      avatar: String(user.avatar || ""),
    };

    const saved = record
      ? await pb.collection("board_presence").update(record.id, payload)
      : await pb.collection("board_presence").create(payload);

    return NextResponse.json({ item: saved }, { status: 200 });
  } catch (error: unknown) {
    console.error("Board Presence POST Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await verifySession(session.value);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");
    if (!boardId) {
      return NextResponse.json({ error: "Missing boardId" }, { status: 400 });
    }

    const pb = await getAdminClient();
    try {
      const record = await pb
        .collection("board_presence")
        .getFirstListItem(`board_id = "${boardId}" && user_id = "${user.id}"`);
      await pb.collection("board_presence").delete(record.id);
    } catch {
      // ignore if missing
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("Board Presence DELETE Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
