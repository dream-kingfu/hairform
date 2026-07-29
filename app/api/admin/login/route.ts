import { loginAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { password?: unknown };
  if (typeof payload.password !== "string" || payload.password.length > 256) {
    return Response.json({ error: "admin_login_failed" }, { status: 401 });
  }
  try {
    const session = await loginAdmin(request, payload.password);
    return Response.json({ authenticated: true, csrfToken: session.csrfToken, expiresAt: session.expiresAt }, {
      headers: { "Set-Cookie": session.cookie, "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("admin_login_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "admin_login_failed" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}
