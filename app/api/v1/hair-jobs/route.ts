import { cleanupExpiredJobs, createJobIdentity, hashToken, insertJob, isDemoMode, jobCookie, putAsset } from "@/lib/server/jobs";
import { consumeNewJobLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    await cleanupExpiredJobs();
    const form = await request.formData();
    const photo = form.get("photo");
    const mask = form.get("mask");
    if (!(photo instanceof File)) return Response.json({ error: "photo_required" }, { status: 400 });
    if (!ALLOWED_TYPES.has(photo.type)) return Response.json({ error: "unsupported_file_type" }, { status: 415 });
    if (photo.size <= 0 || photo.size > MAX_FILE_SIZE) return Response.json({ error: "file_too_large" }, { status: 413 });
    if (mask instanceof File && (mask.type !== "image/png" || mask.size > MAX_FILE_SIZE)) {
      return Response.json({ error: "invalid_mask" }, { status: 400 });
    }

    const rateLimit = await consumeNewJobLimit(request);
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

    const { jobId, token } = createJobIdentity();
    const originalKey = `jobs/${jobId}/original`;
    const maskKey = mask instanceof File ? `jobs/${jobId}/mask.png` : undefined;
    await putAsset(originalKey, await photo.arrayBuffer(), photo.type);
    if (maskKey && mask instanceof File) await putAsset(maskKey, await mask.arrayBuffer(), "image/png");
    const { expiresAt } = await insertJob({
      id: jobId,
      tokenHash: await hashToken(token),
      originalKey,
      maskKey,
      demoMode: isDemoMode(),
    });
    return Response.json(
      { jobId, accessToken: token, status: "validating", expiresAt: new Date(expiresAt).toISOString(), demoMode: isDemoMode() },
      { status: 201, headers: { "Set-Cookie": jobCookie(jobId, token, 86400, new URL(request.url).protocol === "https:") } },
    );
  } catch {
    return Response.json({ error: "create_job_failed" }, { status: 500 });
  }
}
