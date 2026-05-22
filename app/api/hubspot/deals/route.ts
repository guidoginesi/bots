import { cookies } from "next/headers";
import { fetchHubSpotDealsPayload } from "@/lib/hubspotDeals";
import {
  REPORTS_COOKIE,
  reportsAuthConfigured,
  verifyReportsSession,
} from "@/lib/reportsAuth";

export const runtime = "nodejs";
export const maxDuration = 30;

async function isAuthorized(request: Request): Promise<boolean> {
  if (request.headers.get("x-vercel-cron") === "1") return true;

  if (!reportsAuthConfigured()) return true;

  const cookieStore = await cookies();
  const session = cookieStore.get(REPORTS_COOKIE)?.value;
  return verifyReportsSession(session);
}

export async function GET(request: Request) {
  if (!process.env.HUBSPOT_TOKEN) {
    return Response.json(
      { error: "HUBSPOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  if (!(await isAuthorized(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fresh =
    searchParams.has("fresh") ||
    searchParams.has("_t") ||
    searchParams.get("nocache") === "1";

  try {
    const payload = await fetchHubSpotDealsPayload();
    return Response.json(payload, {
      headers: fresh
        ? {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vercel-CDN-Cache-Control": "no-store",
          }
        : {
            "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
          },
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "HubSpot fetch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
