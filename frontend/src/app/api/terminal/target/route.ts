import { type NextRequest, NextResponse } from "next/server";

import {
  clearTerminalSshTarget,
  getTerminalSshTargetPublic,
  setTerminalSshTarget,
} from "@/lib/terminal-ssh-target";
import { destroyTerminalSessionsByOwner } from "@/lib/terminal-session";
import { resolveAuthenticatedUser } from "@/server/terminal-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TerminalTargetBody {
  username: string;
  host: string;
  port?: number | null;
  password?: string | null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = getTerminalSshTargetPublic(user.id);
  return NextResponse.json({ target });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await resolveAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request
      .json()
      .catch(() => null)) as TerminalTargetBody | null;
    if (
      !body ||
      typeof body.username !== "string" ||
      typeof body.host !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid SSH target payload." },
        { status: 400 },
      );
    }

    const target = setTerminalSshTarget(user.id, {
      username: body.username,
      hostOrUrl: body.host,
      port: body.port,
      password: body.password,
    });

    destroyTerminalSessionsByOwner(user.id);
    return NextResponse.json({
      target: {
        username: target.username,
        host: target.host,
        port: target.port,
      },
      ok: true,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to configure SSH terminal target.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  clearTerminalSshTarget(user.id);
  destroyTerminalSessionsByOwner(user.id);
  return NextResponse.json({ ok: true });
}
