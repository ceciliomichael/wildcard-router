import { forwardToBackendApi } from "../../../../server/backendProxy";

export const dynamic = "force-dynamic";

type Params = {
  path?: string[];
};

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["routes"]);
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["routes"]);
}

export async function PUT(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["routes"]);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["routes"]);
}
