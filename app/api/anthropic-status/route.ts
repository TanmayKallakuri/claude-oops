import { NextRequest } from "next/server";

const UPSTREAM = "https://status.anthropic.com/api/v2/summary.json";

export const dynamic = "force-dynamic";

type UpstreamStatus = {
  indicator: "none" | "minor" | "major" | "critical" | "maintenance";
  description: string;
};

type UpstreamComponent = {
  id: string;
  name: string;
  status:
    | "operational"
    | "degraded_performance"
    | "partial_outage"
    | "major_outage"
    | "under_maintenance";
  group?: boolean;
  group_id?: string | null;
  showcase?: boolean;
  only_show_if_degraded?: boolean;
};

type UpstreamBody = {
  page: { updated_at: string };
  status: UpstreamStatus;
  components: UpstreamComponent[];
};

export async function GET(_req: NextRequest) {
  const fallback = {
    indicator: "unknown" as const,
    description: "status unavailable",
    updated_at: "",
    components: [] as Array<{ id: string; name: string; status: string }>,
  };
  try {
    const res = await fetch(UPSTREAM, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return Response.json(fallback, { headers: { "Cache-Control": "public, max-age=30" } });
    }
    const body = (await res.json()) as UpstreamBody;

    // Filter: top-level, showcase-worthy components only. Skip group containers and hidden components.
    const flat = body.components
      .filter((c) => !c.group && c.showcase !== false)
      .filter((c) => !c.only_show_if_degraded || c.status !== "operational")
      .map((c) => ({ id: c.id, name: c.name, status: c.status }));

    return Response.json(
      {
        indicator: body.status.indicator,
        description: body.status.description,
        updated_at: body.page.updated_at,
        components: flat,
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return Response.json(fallback, { headers: { "Cache-Control": "public, max-age=30" } });
  }
}
