import { rotateAdminCsrf } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await rotateAdminCsrf(request);
  return session
    ? Response.json({ authenticated: true, ...session }, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
