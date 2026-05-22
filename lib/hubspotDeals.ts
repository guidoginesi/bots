const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "closedate",
  "hubspot_owner_id",
  "pipeline",
  "hs_mrr",
  "amount",
  "hs_tcv",
  "fee_variable",
  "gmv_mensual_estimado",
  "pais_pow",
  "deal_currency_code",
];

const LI_PROPERTIES = [
  "name",
  "amount",
  "price",
  "quantity",
  "hs_mrr",
  "hs_recurring_billing_period",
];

const UNDO_STAGES = new Set([
  "1005171560",
  "1005171561",
  "1005171562",
  "1005324570",
  "1005171563",
  "1005171564",
  "1005171565",
  "1005171566",
]);

type HubSpotDeal = {
  properties: Record<string, string | null | undefined>;
  associations?: Record<
    string,
    { results?: { id: string }[] } | undefined
  >;
};

type HubSpotLineItem = {
  id: string;
  properties?: Record<string, string | null | undefined>;
};

export type DashboardDeal = {
  n: string;
  s: string;
  c: string | null;
  o: string | null | undefined;
  b: "pow" | "undo";
  p: string | null;
  a: number;
  gmv?: number;
  fv?: number;
  li?: { n: string; a: number; ot?: true }[];
  ot?: number;
};

export type HubSpotDealsPayload = {
  deals: DashboardDeal[];
  stageMap: Record<string, string>;
  owners: Record<string, string>;
  contacts: { n: string; s: string; b: string }[];
  contactsTotal: number | null;
  fetchedAt: string;
};

async function hs(path: string, opts: RequestInit = {}) {
  const token = process.env.HUBSPOT_TOKEN;
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${path}`);
  return res.json();
}

async function fetchAllDeals(): Promise<HubSpotDeal[]> {
  const deals: HubSpotDeal[] = [];
  let after: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      limit: "100",
      properties: DEAL_PROPERTIES.join(","),
      associations: "line_items",
    });
    if (after) params.set("after", after);

    const data = (await hs(`/crm/v3/objects/deals?${params}`)) as {
      results?: HubSpotDeal[];
      paging?: { next?: { after?: string } };
    };
    deals.push(...(data.results || []));

    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;
  }

  return deals;
}

async function fetchLineItems(ids: string[]): Promise<HubSpotLineItem[]> {
  if (!ids.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

  const results = await Promise.all(
    chunks.map((chunk) =>
      hs("/crm/v3/objects/line_items/batch/read", {
        method: "POST",
        body: JSON.stringify({
          properties: LI_PROPERTIES,
          inputs: chunk.map((id) => ({ id })),
        }),
      }).then((d) => (d as { results?: HubSpotLineItem[] }).results || [])
    )
  );

  return results.flat();
}

function getBrand(deal: HubSpotDeal): "pow" | "undo" {
  const stage = deal.properties.dealstage;
  return stage && UNDO_STAGES.has(stage) ? "undo" : "pow";
}

function lineItemAssoc(deal: HubSpotDeal) {
  return (
    deal.associations?.["line items"]?.results ||
    deal.associations?.line_items?.results ||
    []
  );
}

async function fetchStageMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const data = (await hs("/crm/v3/pipelines/deals")) as {
      results?: { stages?: { id: string; label: string }[] }[];
    };
    for (const pipe of data.results || []) {
      for (const stage of pipe.stages || []) {
        if (stage.id && stage.label) map[stage.id] = stage.label;
      }
    }
  } catch (e) {
    console.warn("fetchStageMap:", e);
  }
  return map;
}

async function fetchOwners(): Promise<Record<string, string>> {
  const owners: Record<string, string> = {};
  try {
    let after: string | undefined;
    do {
      const params = new URLSearchParams({ limit: "100" });
      if (after) params.set("after", after);
      const data = (await hs(`/crm/v3/owners?${params}`)) as {
        results?: {
          id: string;
          firstName?: string;
          lastName?: string;
        }[];
        paging?: { next?: { after?: string } };
      };
      for (const o of data.results || []) {
        const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
        if (o.id && name) owners[String(o.id)] = name;
      }
      after = data.paging?.next?.after;
    } while (after);
  } catch (e) {
    console.warn("fetchOwners:", e);
  }
  return owners;
}

async function fetchContactsMeta() {
  const empty = { total: null as number | null, recent: [] as { n: string; s: string; b: string }[] };
  try {
    const search = (await hs("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
        properties: ["firstname", "lastname", "email", "company"],
        limit: 8,
      }),
    })) as {
      total?: number;
      results?: { properties?: Record<string, string> }[];
    };

    const recent = (search.results || []).map((c) => {
      const p = c.properties || {};
      const name =
        [p.firstname, p.lastname].filter(Boolean).join(" ").trim() ||
        p.email ||
        "Sin nombre";
      return { n: name, s: p.company || "", b: "pow" };
    });

    return { total: search.total ?? null, recent };
  } catch (e) {
    console.warn("fetchContactsMeta:", e);
    return empty;
  }
}

function lineItemAmount(l: HubSpotLineItem): number {
  return parseFloat(l.properties?.amount || l.properties?.price || "0") || 0;
}

function isOneTimeLineItem(l: HubSpotLineItem): boolean {
  const amt = lineItemAmount(l);
  if (amt <= 0) return false;
  const liMrr = parseFloat(l.properties?.hs_mrr || "0") || 0;
  const period = l.properties?.hs_recurring_billing_period;
  return liMrr <= 0 && !period;
}

function mapDeal(deal: HubSpotDeal, lineItems: HubSpotLineItem[]): DashboardDeal {
  const p = deal.properties;
  const closedate = p.closedate ? p.closedate.split("T")[0] : null;
  const mrr = parseFloat(p.hs_mrr || p.amount || "0") || 0;
  const tcv = parseFloat(p.hs_tcv || "0") || 0;
  const gmv = parseFloat(p.gmv_mensual_estimado || "0") || 0;
  const fv = parseFloat(p.fee_variable || "0") || 0;
  const country = p.pais_pow || null;

  const li = lineItems
    .filter((l) => l.properties?.name && lineItemAmount(l) > 0)
    .map((l) => ({
      n: l.properties!.name as string,
      a: lineItemAmount(l),
      ...(isOneTimeLineItem(l) ? { ot: true as const } : {}),
    }));

  let ot = li.filter((x) => x.ot).reduce((s, x) => s + x.a, 0);
  if (ot === 0 && mrr <= 0 && tcv > 0) ot = tcv;

  return {
    n: p.dealname || "Sin nombre",
    s: p.dealstage || "",
    c: closedate,
    o: p.hubspot_owner_id,
    b: getBrand(deal),
    p: country,
    a: mrr,
    ...(gmv > 0 ? { gmv } : {}),
    ...(fv > 0 ? { fv } : {}),
    ...(li.length ? { li } : {}),
    ...(ot > 0 ? { ot } : {}),
  };
}

export async function fetchHubSpotDealsPayload(): Promise<HubSpotDealsPayload> {
  const rawDeals = await fetchAllDeals();

  const liIdSet = new Set<string>();
  rawDeals.forEach((d) => {
    lineItemAssoc(d).forEach((a) => liIdSet.add(a.id));
  });

  const allLineItems = await fetchLineItems([...liIdSet]);
  const liById = Object.fromEntries(allLineItems.map((l) => [l.id, l]));

  const deals = rawDeals.map((d) => {
    const lineItems = lineItemAssoc(d)
      .map((a) => liById[a.id])
      .filter(Boolean) as HubSpotLineItem[];
    return mapDeal(d, lineItems);
  });

  const [stageMap, owners, contactsMeta] = await Promise.all([
    fetchStageMap(),
    fetchOwners(),
    fetchContactsMeta(),
  ]);

  return {
    deals,
    stageMap,
    owners,
    contacts: contactsMeta.recent,
    contactsTotal: contactsMeta.total,
    fetchedAt: new Date().toISOString(),
  };
}
