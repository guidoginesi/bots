#!/usr/bin/env node
/**
 * Copia HTML desde app-directorio (u otras rutas) a public/reports/
 * y quita el login embebido (la protección la hace middleware + REPORTS_PASSWORD).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "reports");

/** @type {{ slug: string; source: string; file: string; title: string; description: string }[]} */
const SOURCES = [
  {
    slug: "ceo-scorecard",
    source: path.join(ROOT, "..", "app-directorio", "ceo-scorecard.html"),
    file: "ceo-scorecard.html",
    title: "CEO Scorecard",
    description: "Estado de resultados · Mayo 2026",
  },
  {
    slug: "crm-dashboard",
    source: path.join(ROOT, "..", "app-directorio", "crm-dashboard.html"),
    file: "crm-dashboard.html",
    title: "CRM Dashboard",
    description: "Pipeline comercial · Pow",
  },
];

function stripEmbeddedAuth(html) {
  let out = html.replace(/<body class="locked">/i, "<body>");
  out = out.replace(
    /  body\.locked\{overflow:hidden\}[\s\S]*?  \.auth-note\{[^}]+\}\n/,
    ""
  );
  const overlayRe = new RegExp(
    '<div id="auth-overlay">[\\s\\S]*?</' + "div" + ">\\n\\n"
  );
  out = out.replace(overlayRe, "");
  out = out.replace(
    /\nconst AUTH_KEY[\s\S]*?checkAuth\(\);\n\}\);\n/,
    "\n"
  );
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const manifest = { reports: [] };

for (const entry of SOURCES) {
  if (!fs.existsSync(entry.source)) {
    console.warn(`⚠️  Omitido (no existe): ${entry.source}`);
    continue;
  }
  const raw = fs.readFileSync(entry.source, "utf8");
  const cleaned = stripEmbeddedAuth(raw);
  const dest = path.join(OUT_DIR, entry.file);
  fs.writeFileSync(dest, cleaned);
  manifest.reports.push({
    slug: entry.slug,
    file: entry.file,
    title: entry.title,
    description: entry.description,
  });
  console.log(`✓ ${entry.file} ← ${path.relative(ROOT, entry.source)}`);
}

fs.writeFileSync(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);
console.log(`✓ manifest.json (${manifest.reports.length} informes)`);
