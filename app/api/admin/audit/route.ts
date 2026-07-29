import { requireAdmin } from "@/lib/server/admin-auth";
import { bindings, ensureSchema } from "@/lib/server/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return Response.json({ error: "admin_unauthorized" }, { status: 401 });
  await ensureSchema();
  const rows = await bindings.DB.prepare("SELECT action, provider_id, details_json, created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 100")
    .all<{ action: string; provider_id: string | null; details_json: string; created_at: number }>();
  return Response.json({ audit: rows.results.map((row) => ({ action: row.action, providerId: row.provider_id, details: JSON.parse(row.details_json), createdAt: new Date(row.created_at).toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
}
