import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/admin";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("monacle_session");
    if (!session?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");
    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const pb = await getAdminClient();
    const items = await pb.collection("doc_presence").getFullList({
      filter: `doc_id = "${docId}"`,
      sort: "-updated",
      $autoCancel: false,
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: unknown) {
    console.error("Presence GET Error:", error);
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
    const user = JSON.parse(decodeURIComponent(session.value));

    const body = await request.json();
    const docId = body?.docId;
    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const pb = await getAdminClient();
    let record;
    try {
      record = await pb
        .collection("doc_presence")
        .getFirstListItem(`doc_id = "${docId}" && user_id = "${user.id}"`);
    } catch {
      record = null;
    }

    const payload = {
      doc_id: String(docId),
      user_id: String(user.id),
      name: String(user.name || user.email || "User"),
      avatar: String(user.avatar || ""),
    };

    const saved = record
      ? await pb.collection("doc_presence").update(record.id, payload)
      : await pb.collection("doc_presence").create(payload);

    return NextResponse.json({ item: saved }, { status: 200 });
  } catch (error: unknown) {
    console.error("Presence POST Error:", error);
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
    const user = JSON.parse(decodeURIComponent(session.value));

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");
    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const pb = await getAdminClient();
    try {
      const record = await pb
        .collection("doc_presence")
        .getFirstListItem(`doc_id = "${docId}" && user_id = "${user.id}"`);
      await pb.collection("doc_presence").delete(record.id);
    } catch {
      // ignore if missing
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("Presence DELETE Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
