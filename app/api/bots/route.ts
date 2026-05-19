import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { BOT_REGISTRY } from "@/lib/botRegistry";

export async function GET() {
  const db = getSupabaseAdmin();

  const { data: configs } = await db
    .from("asana_webhook_config")
    .select("project_gid, is_enabled, hook_secret");

  const rows = configs ?? [];
  const hasSecret = rows.some((r) => r.hook_secret !== null);
  const allEnabled = rows.length > 0 && rows.every((r) => r.is_enabled);

  const bots = BOT_REGISTRY.map((bot) => {
    if (bot.id === "asana-chat") {
      return {
        ...bot,
        enabled: allEnabled,
        connected: hasSecret,
        projectCount: rows.length,
      };
    }
    return { ...bot, enabled: false, connected: false, projectCount: 0 };
  });

  return NextResponse.json(bots);
}
