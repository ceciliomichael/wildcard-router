import { NextResponse } from "next/server";
import { buildBackendRoutesUrl } from "../../../../server/backendApiBase";

export const dynamic = "force-dynamic";

type Params = {
  path?: string[];
};

const FORWARDED_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  "x-api-key",
] as const;
const RESPONSE_HEADERS = [
  "allow",
  "cache-control",
  "content-type",
  "etag",
  "last-modified",
] as const;

function copyRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const headerName of FORWARDED_HEADERS) {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }
  return headers;
}

function toClientResponse(upstreamResponse: Response): Response {
  const headers = new Headers();

  for (const headerName of RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers,
  });
}

async function forwardToBackend(
  request: Request,
  paramsPromise: Promise<Params>,
): Promise<Response> {
  try {
    const params = await paramsPromise;
    const currentUrl = new URL(request.url);
    const upstreamUrl = buildBackendRoutesUrl(
      params.path ?? [],
      currentUrl.search,
    );
    const method = request.method.toUpperCase();
    const headers = copyRequestHeaders(request);
    const init: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    if (method !== "GET" && method !== "HEAD") {
      init.body = await request.text();
    }

    const upstreamResponse = await fetch(upstreamUrl, init);
    return toClientResponse(upstreamResponse);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Invalid backend API base URL"
        ? "Server configuration error"
        : "Backend unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackend(request, context.params);
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackend(request, context.params);
}

export async function PUT(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackend(request, context.params);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackend(request, context.params);
}
