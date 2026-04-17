import { type NextRequest, NextResponse } from "next/server";

import {
  createTerminalEventStream,
  DEFAULT_TERMINAL_COLUMNS,
  DEFAULT_TERMINAL_ROWS,
  openTerminalSession,
} from "@/lib/terminal-session";
import { resolveAuthenticatedUser } from "@/server/terminal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDimension(value: string | null, fallback: number): number {
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 10 || parsedValue > 500) {
    return fallback;
  }

  return parsedValue;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      return NextResponse.json(
        { error: "Terminal session id is required." },
        { status: 400 },
      );
    }

    const cols = parseDimension(
      request.nextUrl.searchParams.get("cols"),
      DEFAULT_TERMINAL_COLUMNS,
    );
    const rows = parseDimension(
      request.nextUrl.searchParams.get("rows"),
      DEFAULT_TERMINAL_ROWS,
    );

    const result = openTerminalSession(sessionId, user.id, { cols, rows });
    if (result.status === "missing_target") {
      return NextResponse.json(
        { error: result.message },
        { status: 412 },
      );
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { session } = result;

    const response = new NextResponse(createTerminalEventStream(session), {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });

    return response;
  } catch (error) {
    console.error("Terminal stream failed to start.", error);
    return NextResponse.json(
      { error: "Failed to start terminal stream." },
      { status: 500 },
    );
  }
}
