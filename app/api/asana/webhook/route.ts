import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchTask, fetchCommentStories } from "@/lib/asana";
import { sendToGoogleChat } from "@/lib/chat";
import { containsAnyTag, stripTags } from "@/lib/text";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AsanaEvent {
  resource?: { gid: string; resource_type: string };
  parent?: { gid: string; resource_type: string };
}

interface AsanaEventBody {
  events?: AsanaEvent[];
}

// ─── HMAC verification ────────────────────────────────────────────────────────

function verifySignature(
  secret: string,
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Retrieve hook secret from DB ────────────────────────────────────────────

async function getHookSecret(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("asana_webhook_config")
    .select("hook_secret")
    .not("hook_secret", "is", null)
    .limit(1)
    .single();
  return data?.hook_secret ?? null;
}

// ─── Extract unique task GIDs from events ────────────────────────────────────

function extractTaskGids(events: AsanaEvent[]): Set<string> {
  const gids = new Set<string>();
  for (const event of events) {
    if (event.resource?.resource_type === "task") {
      gids.add(event.resource.gid);
    } else if (event.parent?.resource_type === "task") {
      gids.add(event.parent.gid);
    }
  }
  return gids;
}

// ─── Process a single task ────────────────────────────────────────────────────

async function processTask(taskGid: string, projectGid: string): Promise<void> {
  const [task, stories] = await Promise.all([
    fetchTask(taskGid),
    fetchCommentStories(taskGid),
  ]);

  for (const story of stories) {
    // Check dedup
    const { data: existing } = await supabaseAdmin
      .from("asana_processed_stories")
      .select("story_gid")
      .eq("story_gid", story.gid)
      .maybeSingle();

    if (existing) continue;

    if (!containsAnyTag(story.text)) continue;

    const cleanText = stripTags(story.text);
    const authorName = story.created_by?.name ?? "Desconocido";

    let forwarded = false;
    let chatStatus: number | null = null;
    let errorMsg: string | null = null;

    try {
      chatStatus = await sendToGoogleChat({
        authorName,
        taskName: task.name,
        commentText: cleanText,
        permalink: task.permalink_url,
        timestamp: story.created_at,
        taskGid,
      });
      forwarded = chatStatus >= 200 && chatStatus < 300;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    // Insert log
    await supabaseAdmin.from("asana_message_log").insert({
      project_gid: projectGid,
      task_gid: taskGid,
      story_gid: story.gid,
      author_name: authorName,
      comment_text: cleanText,
      forwarded,
      forwarded_at: forwarded ? new Date().toISOString() : null,
      chat_thread_key: `asana-task-${taskGid}`,
      chat_response_status: chatStatus,
      error: errorMsg,
    });

    // Mark as processed only if sent successfully (allows retry on error)
    if (forwarded) {
      await supabaseAdmin
        .from("asana_processed_stories")
        .upsert(
          { story_gid: story.gid, task_gid: taskGid },
          { onConflict: "story_gid", ignoreDuplicates: true }
        );
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── (A) Handshake ──────────────────────────────────────────────────────────
  const hookSecret = req.headers.get("x-hook-secret");
  if (hookSecret) {
    // Persist secret for every configured project
    const projectGids = (process.env.ASANA_PROJECT_GIDS ?? "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);

    for (const projectGid of projectGids) {
      await supabaseAdmin
        .from("asana_webhook_config")
        .upsert(
          { project_gid: projectGid, hook_secret: hookSecret, is_enabled: true },
          { onConflict: "project_gid" }
        );
    }

    return new NextResponse(null, {
      status: 204,
      headers: { "X-Hook-Secret": hookSecret },
    });
  }

  // ── (B) Event ──────────────────────────────────────────────────────────────
  const rawBody = await req.text();

  // Verify HMAC signature if we have a stored secret
  const signature = req.headers.get("x-hook-signature");
  if (signature) {
    const storedSecret = await getHookSecret();
    if (storedSecret && !verifySignature(storedSecret, rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: AsanaEventBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events: AsanaEvent[] = body.events ?? [];
  if (events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Resolve allowed project GIDs
  const allowedProjects = new Set(
    (process.env.ASANA_PROJECT_GIDS ?? "")
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
  );

  const taskGids = extractTaskGids(events);

  // Respond immediately, process in background (Vercel edge keeps alive)
  const processingPromises: Promise<void>[] = [];

  for (const taskGid of taskGids) {
    // Use first allowed project as the log project_gid (single-project setup is most common)
    const projectGid = allowedProjects.values().next().value ?? "unknown";
    processingPromises.push(
      processTask(taskGid, projectGid).catch((err) => {
        console.error(`processTask error for ${taskGid}:`, err);
      })
    );
  }

  // Fire and forget — but wait up to 9s to stay within Asana's 10s window
  await Promise.race([
    Promise.allSettled(processingPromises),
    new Promise((resolve) => setTimeout(resolve, 9000)),
  ]);

  return NextResponse.json({ ok: true });
}
