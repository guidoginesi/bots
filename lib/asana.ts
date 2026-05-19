const ASANA_BASE = "https://app.asana.com/api/1.0";

function getHeaders(): HeadersInit {
  const pat = process.env.ASANA_PAT;
  if (!pat) throw new Error("Missing ASANA_PAT");
  return {
    Authorization: `Bearer ${pat}`,
    "Content-Type": "application/json",
  };
}

export interface AsanaTask {
  gid: string;
  name: string;
  permalink_url: string;
}

export interface AsanaStory {
  gid: string;
  resource_subtype: string;
  text: string;
  created_at: string;
  created_by: { name: string } | null;
}

export async function fetchTask(taskGid: string): Promise<AsanaTask> {
  const url = `${ASANA_BASE}/tasks/${taskGid}?opt_fields=gid,name,permalink_url`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`Asana fetchTask failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data as AsanaTask;
}

export async function fetchCommentStories(
  taskGid: string
): Promise<AsanaStory[]> {
  const url = `${ASANA_BASE}/tasks/${taskGid}/stories?opt_fields=gid,resource_subtype,text,created_at,created_by.name&limit=100`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(
      `Asana fetchStories failed: ${res.status} ${await res.text()}`
    );
  }
  const json = await res.json();
  const stories: AsanaStory[] = json.data ?? [];
  return stories
    .filter((s) => s.resource_subtype === "comment_added")
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 20);
}

export async function registerWebhook(
  projectGid: string,
  targetUrl: string
): Promise<{ gid: string }> {
  const res = await fetch(`${ASANA_BASE}/webhooks`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      data: {
        resource: projectGid,
        target: targetUrl,
        filters: [
          { resource_type: "story", action: "added" },
          { resource_type: "task", action: "changed" },
        ],
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Asana registerWebhook failed: ${res.status} ${await res.text()}`
    );
  }
  const json = await res.json();
  return json.data as { gid: string };
}
