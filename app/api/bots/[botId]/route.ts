import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const body = await req.json();
  const enabled: boolean = body.enabled;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }

  if (botId === "asana-chat") {
    const projectGids = (process.env.ASANA_PROJECT_GIDS ?? "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

    if (projectGids.length === 0) {
      return NextResponse.json({ error: "No project GIDs configured" }, { status: 500 });
    }

    const db = getSupabaseAdmin();
    const { error } = await db
      .from("asana_webhook_config")
      .update({ is_enabled: enabled })
      .in("project_gid", projectGids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enabled });
  }

  return NextResponse.json({ error: "Bot not found" }, { status: 404 });
}
