import { access, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { loadReportsManifest } from "@/lib/reportsManifest";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function contentTypeFor(file: string): string {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> }
) {
  const { file } = await context.params;

  if (file.includes("..") || file.includes("/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const manifestFiles = new Set(loadReportsManifest().map((r) => r.file));
  const isManifestHtml = manifestFiles.has(file) && file.endsWith(".html");
  const isReportDocx = file.endsWith(".docx");

  if (!isManifestHtml && !isReportDocx) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "reports", file);
  if (!(await fileExists(filePath))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = isManifestHtml
    ? await readFile(filePath, "utf8")
    : await readFile(filePath);

  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(file),
  };
  if (isManifestHtml) {
    Object.assign(headers, NO_STORE);
  }

  return new NextResponse(body, { headers });
}
