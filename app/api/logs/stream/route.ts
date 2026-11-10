import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const backendBaseUrl = (): string => {
  const internal = process.env.LOGSPECTRA_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "");
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (publicUrl) return publicUrl.replace(/\/+$/, "");
  return "http://localhost:8081";
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

  const upstream = await fetch(`${backendBaseUrl()}/api/v1/logs/stream${search}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

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
