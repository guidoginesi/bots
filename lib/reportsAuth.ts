export const REPORTS_COOKIE = "pow_reports_session";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getReportsSessionToken(): Promise<string> {
  const password = process.env.REPORTS_PASSWORD;
  const secret = process.env.REPORTS_AUTH_SECRET || password;
  if (!password || !secret) {
    throw new Error("REPORTS_PASSWORD is not configured");
  }
  const payload = `pow-reports:v1:${secret}:${password}`;
  const data = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

export async function verifyReportsSession(
  cookieValue: string | undefined
): Promise<boolean> {
  if (!cookieValue || !process.env.REPORTS_PASSWORD) return false;
  try {
    const expected = await getReportsSessionToken();
    return timingSafeEqual(cookieValue, expected);
  } catch {
    return false;
  }
}

export function reportsAuthConfigured(): boolean {
  return Boolean(process.env.REPORTS_PASSWORD?.length);
}
