import { readFileSync } from "fs";
import path from "path";

export type ReportEntry = {
  slug: string;
  file: string;
  title: string;
  description: string;
};

export function loadReportsManifest(): ReportEntry[] {
  const manifestPath = path.join(
    process.cwd(),
    "public",
    "reports",
    "manifest.json"
  );
  const raw = readFileSync(manifestPath, "utf8");
  const data = JSON.parse(raw) as { reports: ReportEntry[] };
  return data.reports ?? [];
}
