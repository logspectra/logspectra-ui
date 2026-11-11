import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Browser calls same-origin /api/logs/stream; this handler proxies to Spring SSE.
 * LOGSPECTRA_API_URL = in-container reachability (e.g. http://logspectra-backend:8081).
 * NEXT_PUBLIC_API_BASE_URL = browser reachability (e.g. http://localhost:8081) — not used here in prod Docker.
 */
const backendBaseUrl = (): string => {
  const internal = process.env.LOGSPECTRA_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "");

  const isProd = process.env.NODE_ENV === "production";
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!isProd) {
    return (publicUrl || "http://localhost:8081").replace(/\/+$/, "");
  }

  if (publicUrl && !/localhost|127\.0\.0\.1/i.test(publicUrl)) {
    return publicUrl.replace(/\/+$/, "");
  }

  return "http://logspectra-backend:8081";
};

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search;
  const headers = new Headers();
  headers.set("Accept", "text/event-stream");

  const auth = request.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);

  const projectId = request.headers.get("x-project-id");
  if (projectId) headers.set("X-Project-Id", projectId);

  const userId = request.headers.get("x-user-id");
  if (userId) headers.set("X-User-Id", userId);

  const upstreamUrl = `${backendBaseUrl()}/api/v1/logs/stream${search}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream fetch failed";
    return new Response(
      JSON.stringify({
        message,
        upstream: upstreamUrl,
        hint: "Set LOGSPECTRA_API_URL to your API from inside the UI container (e.g. http://logspectra-backend:8081 in Compose).",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => upstream.statusText);
    return new Response(body || upstream.statusText, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
