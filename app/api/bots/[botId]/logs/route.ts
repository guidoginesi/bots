import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  if (botId === "asana-chat") {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("asana_message_log")
      .select(
        "id, task_gid, story_gid, author_name, comment_text, forwarded, forwarded_at, chat_response_status, error, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  }

  return NextResponse.json({ error: "Bot not found" }, { status: 404 });
}
