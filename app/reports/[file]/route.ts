import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ALLOWED_HTML = new Set([
  "ceo-scorecard.html",
  "crm-dashboard.html",
  "crm-dashboard-undo.html",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> }
) {
  const { file } = await context.params;
  if (!ALLOWED_HTML.has(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "report-html", file);
  const body = await readFile(filePath, "utf8");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
