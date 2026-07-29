import { clearAdminCookie, logoutAdmin, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await requireAdmin(request, { write: true }))) return Response.json({ error: "admin_unauthorized" }, { status: 401 });
  await logoutAdmin(request);
  return Response.json({ authenticated: false }, { headers: { "Set-Cookie": clearAdminCookie(), "Cache-Control": "no-store" } });
}
