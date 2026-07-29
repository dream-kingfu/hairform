import { requireAdmin } from "@/lib/server/admin-auth";
import { isAnalysisProvider, runProviderHealthTest } from "@/lib/server/ai-runtime";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ providerId: string }> };

export async function POST(request: Request, context: Context) {
  const admin = await requireAdmin(request, { write: true });
  if (!admin) return Response.json({ error: "admin_unauthorized" }, { status: 401 });
  const { providerId } = await context.params;
  if (!isAnalysisProvider(providerId)) return Response.json({ error: "provider_not_allowed" }, { status: 400 });
  const result = await runProviderHealthTest(providerId, admin.ipFingerprint);
  return Response.json(result, { status: result.status === "ok" ? 200 : 502 });
}
