export interface ChatMessagePayload {
  authorName: string;
  taskName: string;
  commentText: string;
  permalink: string;
  timestamp: string;
  taskGid: string;
}

export async function sendToGoogleChat(
  payload: ChatMessagePayload
): Promise<number> {
  const baseUrl = process.env.GC_WEBHOOK_URL;
  if (!baseUrl) throw new Error("Missing GC_WEBHOOK_URL");

  const threadKey = `asana-task-${payload.taskGid}`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  const url = `${baseUrl}${separator}threadKey=${threadKey}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;

  const date = new Date(payload.timestamp).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });

  const text =
    `📌 *E/R* | ${payload.authorName}\n` +
    `*${payload.taskName}*\n` +
    `${payload.commentText}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  return res.status;
}
