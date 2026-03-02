/**
 * Registers Asana webhooks for each project in ASANA_PROJECT_GIDS.
 *
 * Usage:
 *   cp .env.local.example .env.local   # fill in your values
 *   npm run register-webhook
 */

import { config } from "dotenv";
import path from "path";

// Load .env.local if present
config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { registerWebhook } from "../lib/asana";

async function main() {
  const projectGidsRaw = process.env.ASANA_PROJECT_GIDS ?? "";
  const targetUrl = process.env.ASANA_WEBHOOK_TARGET_URL ?? "";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!projectGidsRaw || !targetUrl || !supabaseUrl || !supabaseKey) {
    console.error(
      "❌ Missing required env vars: ASANA_PROJECT_GIDS, ASANA_WEBHOOK_TARGET_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const projectGids = projectGidsRaw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  for (const projectGid of projectGids) {
    console.log(`\n📡 Registering webhook for project ${projectGid}…`);

    try {
      const webhook = await registerWebhook(projectGid, targetUrl);
      console.log(`✅ Webhook created: ${webhook.gid}`);

      // Upsert config row (hook_secret will be filled on handshake)
      const { error } = await supabase
        .from("asana_webhook_config")
        .upsert(
          { project_gid: projectGid, is_enabled: true },
          { onConflict: "project_gid" }
        );

      if (error) {
        console.warn(`⚠️  Supabase upsert warning for ${projectGid}:`, error.message);
      } else {
        console.log(`🗄️  Config row upserted for ${projectGid}`);
      }
    } catch (err) {
      console.error(
        `❌ Failed for ${projectGid}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n✔ Done. Asana will now perform the handshake to your endpoint.");
}

main();
