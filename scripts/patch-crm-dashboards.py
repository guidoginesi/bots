#!/usr/bin/env python3
"""Split CRM dashboards into Pow-only and Undo-only variants."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
POW = ROOT / "report-html/crm-dashboard.html"
UNDO = ROOT / "report-html/crm-dashboard-undo.html"

MARCA_BLOCK = """    <motion class="filter-row">
      <span class="filter-label">MARCA</span>
      <div class="filter-group">
        <button class="ftab all active" onclick="setBrand('all',this)">Todos</button>
        <button class="ftab pow" onclick="setBrand('pow',this)">Pow</button>
        <button class="ftab undo" onclick="setBrand('undo',this)">Undo</button>
      </motion>
    </motion>

""".replace("motion", "div")

EMP_BLOCK = """      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:10px;font-weight:600;color:#B4B2A9;letter-spacing:.06em;width:52px;flex-shrink:0">EMPRESA</span>
        <div class="filter-group" style="flex:1;max-width:220px">
          <button class="ftab all active" id="fstab-all" onclick="setFunnelEmpresa('all',this)">Todas</button>
          <button class="ftab pow" id="fstab-pow" onclick="setFunnelEmpresa('pow',this)">Pow</button>
          <button class="ftab undo" id="fstab-undo" onclick="setFunnelEmpresa('undo',this)">Undo</button>
        </div>
      </div>

"""

UNDO_FUNNEL = """const FUNNEL_ORDER=[
  "1005171560","1005171561","1005171562","1005324570",
  "1005171563","1005171564","1005171565"
];
const FUNNEL_COLORS={
  "1005171560":"#B4B2A9","1005171561":"#7F77DD","1005171562":"#378ADD",
  "1005324570":"#D85A30","1005171563":"#BA7517","1005171564":"#D4537E",
  "1005171565":"#1D9E75"
};"""


def fix_motion_tags(t: str) -> str:
    t = t.replace("</motion>", "</div>")
    t = re.sub(r"<motion(\s)", r"<div\1", t)
    return t


def apply_brand_filters(t: str) -> str:
    t = t.replace(
        "function getCRMFiltered(){\n  return DEALS.filter(d=>{\n    if(activeBrand!=='all'&&d.b!==activeBrand)return false;",
        "function getCRMFiltered(){\n  return DEALS.filter(d=>{\n    if(d.b!==DASHBOARD_BRAND)return false;",
    )
    t = t.replace(
        "  const bd=activeBrand==='all'?DEALS:DEALS.filter(d=>d.b===activeBrand);",
        "  const bd=DEALS.filter(d=>d.b===DASHBOARD_BRAND);",
    )
    t = t.replace(
        "  const contacts=activeBrand==='all'?CONTACTS:CONTACTS.filter(c=>c.b===activeBrand);",
        "  const contacts=CONTACTS.filter(c=>c.b===DASHBOARD_BRAND);",
    )
    t = t.replace(
        "function getFunnelDeals(){\n  return DEALS.filter(d=>{\n    if(funnelEmpresa!=='all'&&d.b!==funnelEmpresa)return false;",
        "function getFunnelDeals(){\n  return DEALS.filter(d=>{\n    if(d.b!==DASHBOARD_BRAND)return false;",
    )
    t = t.replace(
        "  const base=DEALS.filter(d=>{\n    if(funnelEmpresa!=='all'&&d.b!==funnelEmpresa)return false;\n    if(funnelSearch&&!d.n.toLowerCase().includes(funnelSearch))return false;\n    return true;\n  });\n  const years=",
        "  const base=DEALS.filter(d=>{\n    if(d.b!==DASHBOARD_BRAND)return false;\n    if(funnelSearch&&!d.n.toLowerCase().includes(funnelSearch))return false;\n    return true;\n  });\n  const years=",
    )
    t = t.replace(
        "  const base=DEALS.filter(d=>{\n    if(funnelEmpresa!=='all'&&d.b!==funnelEmpresa)return false;\n    if(funnelYear!=='all'&&(d.c||'').split('-')[0]!==funnelYear)return false;\n    if(funnelSearch&&!d.n.toLowerCase().includes(funnelSearch))return false;\n    return true;\n  });\n  const countries=",
        "  const base=DEALS.filter(d=>{\n    if(d.b!==DASHBOARD_BRAND)return false;\n    if(funnelYear!=='all'&&(d.c||'').split('-')[0]!==funnelYear)return false;\n    if(funnelSearch&&!d.n.toLowerCase().includes(funnelSearch))return false;\n    return true;\n  });\n  const countries=",
    )
    t = t.replace("selectFunnelStage('closedlost')", "selectFunnelStage(LOST_STAGE_ID)")
    t = t.replace("selectedFunnelStage!=='closedlost'", "selectedFunnelStage!==LOST_STAGE_ID")
    t = t.replace(
        "  const showDetail = funnelSearch || funnelEmpresa!=='all';",
        "  const showDetail = true;",
    )
    t = t.replace(
        "  const empresaLabel = funnelEmpresa==='all'?'Todas':funnelEmpresa==='pow'?'Pow':'Undo';",
        "  const empresaLabel = DASHBOARD_BRAND==='pow'?'Pow':'Undo';",
    )
    t = t.replace(
        "  } else if(funnelEmpresa!=='all'){\n    ctxLabel=`Totales por servicio · ${funnelEmpresa==='pow'?'Pow':'Undo'} · ${kpiMode==='won'?'Cierre ganado':'Funnel activo'}`;",
        "  } else {\n    ctxLabel=`Totales por servicio · ${DASHBOARD_BRAND==='pow'?'Pow':'Undo'} · ${kpiMode==='won'?'Cierre ganado':'Funnel activo'}`;",
    )
    return t


def patch_pow(t: str) -> str:
    if "const DASHBOARD_BRAND=" not in t:
        t = t.replace(
            "const FLAGS=",
            "const DASHBOARD_BRAND='pow';\nconst LOST_STAGE_ID='closedlost';\nconst FLAGS=",
        )
    t = fix_motion_tags(t)
    t = t.replace(MARCA_BLOCK, "")
    t = t.replace(EMP_BLOCK, "")
    t = re.sub(r"<h1>CRM Dashboard[^<]*</h1>", "<h1>CRM Dashboard · Pow</h1>", t, count=1)
    t = re.sub(r"<title>CRM Dashboard[^<]*</title>", "<title>CRM Dashboard · Pow</title>", t, count=1)
    t = t.replace(
        "<h1>Funnel de Ventas</h1><p class=\"meta\">Pipeline Pow ·",
        "<h1>Funnel de Ventas · Pow</h1><p class=\"meta\">Pipeline Pow ·",
    )
    t = t.replace(
        "<h1>Real vs Objetivo</h1><p class=\"meta\">Cierre ganado · Comparación contra metas 2026 ·",
        "<h1>Real vs Objetivo · Pow</h1><p class=\"meta\">Cierre ganado · Comparación contra metas 2026 ·",
    )
    t = t.replace('stab-tip">Real vs Objetivo</span>', 'stab-tip">Real vs Objetivo · Pow</span>')
    t = apply_brand_filters(t)
    return t


def patch_undo(t: str) -> str:
    t = fix_motion_tags(t)
    t = t.replace(MARCA_BLOCK, "")
    t = t.replace(EMP_BLOCK, "")
    t = re.sub(
        r"const DASHBOARD_BRAND='pow'",
        "const DASHBOARD_BRAND='undo'",
        t,
    )
    if "const DASHBOARD_BRAND=" not in t:
        t = t.replace(
            "const FLAGS=",
            "const DASHBOARD_BRAND='undo';\nconst LOST_STAGE_ID='1005171566';\nconst FLAGS=",
        )
    t = t.replace("LOST_STAGE_ID='closedlost'", "LOST_STAGE_ID='1005171566'")
    t = re.sub(r"<h1>CRM Dashboard[^<]*</h1>", "<h1>CRM Dashboard · Undo</h1>", t, count=1)
    t = re.sub(r"<title>CRM Dashboard[^<]*</title>", "<title>CRM Dashboard · Undo</title>", t, count=1)
    t = t.replace(
        "<h1>Funnel de Ventas</h1><p class=\"meta\">Pipeline Pow ·",
        "<h1>Funnel de Ventas · Undo</h1><p class=\"meta\">Pipeline Undo ·",
    )
    t = t.replace(
        "<h1>Real vs Objetivo</h1><p class=\"meta\">Cierre ganado · Comparación contra metas 2026 ·",
        "<h1>Real vs Objetivo · Undo</h1><p class=\"meta\">Cierre ganado · Comparación contra metas 2026 ·",
    )
    t = t.replace('stab-tip">Real vs Objetivo</span>', 'stab-tip">Real vs Objetivo · Undo</span>')
    t = t.replace("sync diario · Pow ·", "sync diario · Undo ·")
    t = re.sub(
        r"const FUNNEL_ORDER=\[[\s\S]*?\];\nconst FUNNEL_COLORS=\{[\s\S]*?\};",
        UNDO_FUNNEL,
        t,
        count=1,
    )
    t = t.replace('stab-tip">CRM Dashboard</span>', 'stab-tip">CRM · Undo</span>')
    t = t.replace('stab-tip">Funnel de Ventas</span>', 'stab-tip">Funnel Undo</span>')
    t = apply_brand_filters(t)
    return t


def main():
    base = POW.read_text()
    POW.write_text(patch_pow(base))
    UNDO.write_text(patch_undo(base))
    print("Patched", POW.name, "and", UNDO.name)


if __name__ == "__main__":
    main()
