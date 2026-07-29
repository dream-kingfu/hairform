import { requireAdmin } from "@/lib/server/admin-auth";
import { adminDashboardData, isAnalysisProvider, updateRuntimeConfig } from "@/lib/server/ai-runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return Response.json({ error: "admin_unauthorized" }, { status: 401 });
  return Response.json(await adminDashboardData(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const admin = await requireAdmin(request, { write: true });
  if (!admin) return Response.json({ error: "admin_unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({})) as { revision?: unknown; analysisProvider?: unknown; imagePreviewEnabled?: unknown };
  if (!Number.isInteger(payload.revision) || !isAnalysisProvider(payload.analysisProvider) || typeof payload.imagePreviewEnabled !== "boolean") {
    return Response.json({ error: "invalid_config" }, { status: 400 });
  }
  try {
    const config = await updateRuntimeConfig({
      revision: payload.revision as number,
      analysisProvider: payload.analysisProvider,
      imagePreviewEnabled: payload.imagePreviewEnabled,
      ipFingerprint: admin.ipFingerprint,
    });
    return Response.json({ config });
  } catch (error) {
    const code = error instanceof Error ? error.message : "config_update_failed";
    const status = code === "config_conflict" ? 409 : code === "provider_not_configured" || code === "provider_health_required" ? 422 : 500;
    return Response.json({ error: code }, { status });
  }
}
