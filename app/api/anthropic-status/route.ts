import { NextRequest } from "next/server";

// Anthropic's Statuspage summary endpoint
const UPSTREAM = "https://status.anthropic.com/api/v2/status.json";

export const dynamic = "force-dynamic";

type UpstreamBody = {
  page: { updated_at: string };
  status: {
    indicator: "none" | "minor" | "major" | "critical" | "maintenance";
    description: string;
  };
};

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(UPSTREAM, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return Response.json(
        { indicator: "unknown", description: "status unavailable" },
        { status: 200, headers: { "Cache-Control": "public, max-age=30" } },
      );
    }
    const body = (await res.json()) as UpstreamBody;
    return Response.json(
      {
        indicator: body.status.indicator,
        description: body.status.description,
        updated_at: body.page.updated_at,
      },
      { headers: { "Cache-Control": "public, max-age=30" } },
    );
  } catch {
    return Response.json(
      { indicator: "unknown", description: "status unavailable" },
      { status: 200, headers: { "Cache-Control": "public, max-age=30" } },
    );
  }
}
