#!/usr/bin/env node
/**
 * Copia HTML desde app-directorio (u otras rutas) a public/reports/
 * y quita el login embebido (la protección la hace middleware + REPORTS_PASSWORD).
 *
 * CRM: genera variantes Pow y Undo desde crm-dashboard.html (app-directorio).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { injectReportTopbar } from "../../app-directorio/report-topbar.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "reports");
const REPORT_HTML = path.join(ROOT, "report-html");
const CRM_SOURCE = path.join(ROOT, "..", "app-directorio", "crm-dashboard.html");

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
    source: path.join(REPORT_HTML, "crm-dashboard.html"),
    file: "crm-dashboard.html",
    title: "CRM Dashboard · Pow",
    description: "Pipeline comercial · Pow",
  },
  {
    slug: "crm-dashboard-undo",
    source: path.join(REPORT_HTML, "crm-dashboard-undo.html"),
    file: "crm-dashboard-undo.html",
    title: "CRM Dashboard · Undo",
    description: "Pipeline comercial · Undo",
  },
  {
    slug: "markova-comision",
    source: path.join(ROOT, "..", "app-directorio", "markova-comision-report.html"),
    file: "markova-comision-report.html",
    title: "Markova · Comisión e ingresos",
    description: "Main vs Outlet · simulador de comisión · Jun 2026",
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

function buildCrmVariants() {
  if (!fs.existsSync(CRM_SOURCE)) {
    console.warn(`⚠️  CRM omitido (no existe): ${CRM_SOURCE}`);
    return false;
  }
  fs.mkdirSync(REPORT_HTML, { recursive: true });
  fs.copyFileSync(CRM_SOURCE, path.join(REPORT_HTML, "crm-dashboard.html"));
  execSync("python3 scripts/patch-crm-dashboards.py", {
    cwd: ROOT,
    stdio: "inherit",
  });
  return true;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

if (buildCrmVariants()) {
  console.log("✓ CRM variants ← app-directorio/crm-dashboard.html");
}

const manifest = { reports: [] };

for (const entry of SOURCES) {
  if (!fs.existsSync(entry.source)) {
    console.warn(`⚠️  Omitido (no existe): ${entry.source}`);
    continue;
  }
  const raw = fs.readFileSync(entry.source, "utf8");
  const cleaned = injectReportTopbar(stripEmbeddedAuth(raw), {
    title: entry.title,
    force: true,
  });
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
