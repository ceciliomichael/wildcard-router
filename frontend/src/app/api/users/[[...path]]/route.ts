import { forwardToBackendApi } from "../../../../server/backendProxy";

export const dynamic = "force-dynamic";

type Params = {
  path?: string[];
};

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["users"]);
}

export async function POST(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["users"]);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<Params> },
): Promise<Response> {
  return forwardToBackendApi(request, context.params, ["users"]);
}
