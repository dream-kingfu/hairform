import { bindings, ensureSchema, hashToken } from "./jobs";
import { writeAdminAudit } from "./ai-runtime";
import { verifyPasswordHash } from "./admin-crypto";

const COOKIE_NAME = "hairform_admin_session";
const IDLE_MS = 2 * 60 * 60_000;
const ABSOLUTE_MS = 12 * 60 * 60_000;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_LOCK_MS = 30 * 60_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function randomToken() {
  const value = new Uint8Array(32);
  crypto.getRandomValues(value);
  return bytesToBase64(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function verifyPassword(password: string) {
  return verifyPasswordHash(password, bindings.ADMIN_PASSWORD_HASH);
}

function cookieValue(request: Request) {
  return (request.headers.get("cookie") || "").split(";").map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ABSOLUTE_MS / 1000)}`;
}

function address(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function adminIpFingerprint(request: Request) {
  const salt = bindings.ADMIN_SESSION_SECRET || bindings.RATE_LIMIT_SALT || "hairform-admin-audit";
  return hashToken(`${salt}:${address(request)}`);
}

async function sessionHash(value: string) {
  const secret = bindings.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("admin_not_configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loginLock(fingerprint: string) {
  await ensureSchema();
  return bindings.DB.prepare("SELECT expires_at FROM service_state WHERE state_key = ? AND expires_at > ?")
    .bind(`admin_lock:${fingerprint}`, Date.now()).first<{ expires_at: number }>();
}

async function recordLoginFailure(fingerprint: string) {
  const now = Date.now();
  const windowStart = Math.floor(now / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS;
  const key = `admin_login:${fingerprint}:${windowStart}`;
  const row = await bindings.DB.prepare(`INSERT INTO rate_limit_buckets (rate_key, count, created_at, expires_at)
    VALUES (?, 1, ?, ?) ON CONFLICT(rate_key) DO UPDATE SET count = count + 1 RETURNING count`)
    .bind(key, now, windowStart + LOGIN_WINDOW_MS).first<{ count: number }>();
  if ((row?.count ?? 1) >= 5) {
    await bindings.DB.prepare(`INSERT INTO service_state (state_key, state_value, updated_at, expires_at)
      VALUES (?, 'locked', ?, ?) ON CONFLICT(state_key) DO UPDATE SET state_value = 'locked', updated_at = excluded.updated_at, expires_at = excluded.expires_at`)
      .bind(`admin_lock:${fingerprint}`, now, now + LOGIN_LOCK_MS).run();
  }
}

export async function loginAdmin(request: Request, password: string) {
  await ensureSchema();
  if (!bindings.ADMIN_PASSWORD_HASH || !bindings.ADMIN_SESSION_SECRET || bindings.ADMIN_SESSION_SECRET.length < 32) throw new Error("admin_login_failed");
  const fingerprint = await adminIpFingerprint(request);
  if (await loginLock(fingerprint)) {
    await writeAdminAudit("login_failed", { details: { reason: "locked" }, ipFingerprint: fingerprint });
    throw new Error("admin_login_failed");
  }
  if (!(await verifyPassword(password))) {
    await recordLoginFailure(fingerprint);
    await writeAdminAudit("login_failed", { details: { reason: "invalid" }, ipFingerprint: fingerprint });
    throw new Error("admin_login_failed");
  }
  const token = randomToken();
  const csrf = randomToken();
  const now = Date.now();
  await bindings.DB.prepare(`INSERT INTO admin_sessions (
    token_hash, csrf_hash, password_version, created_at, last_active_at, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(await sessionHash(token), await sessionHash(csrf), bindings.ADMIN_PASSWORD_VERSION || "1", now, now, now + ABSOLUTE_MS).run();
  await writeAdminAudit("login_success", { ipFingerprint: fingerprint });
  return { cookie: sessionCookie(token), csrfToken: csrf, expiresAt: new Date(now + ABSOLUTE_MS).toISOString() };
}

export async function requireAdmin(request: Request, options: { write?: boolean } = {}) {
  await ensureSchema();
  const token = cookieValue(request);
  if (!token) return null;
  let tokenHash: string;
  try { tokenHash = await sessionHash(token); } catch { return null; }
  const row = await bindings.DB.prepare("SELECT * FROM admin_sessions WHERE token_hash = ?")
    .bind(tokenHash).first<{ csrf_hash: string; password_version: string; created_at: number; last_active_at: number; expires_at: number }>();
  const now = Date.now();
  if (!row || row.expires_at <= now || now - row.last_active_at > IDLE_MS || row.password_version !== (bindings.ADMIN_PASSWORD_VERSION || "1")) {
    if (row) await bindings.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  if (options.write) {
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).host !== new URL(request.url).host) return null;
    const csrf = request.headers.get("x-admin-csrf");
    if (!csrf || await sessionHash(csrf) !== row.csrf_hash) return null;
  }
  await bindings.DB.prepare("UPDATE admin_sessions SET last_active_at = ? WHERE token_hash = ?").bind(now, tokenHash).run();
  return { tokenHash, expiresAt: row.expires_at, ipFingerprint: await adminIpFingerprint(request) };
}

export async function logoutAdmin(request: Request) {
  const token = cookieValue(request);
  if (token) {
    try { await bindings.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sessionHash(token)).run(); } catch { /* already effectively revoked */ }
  }
}

export async function rotateAdminCsrf(request: Request) {
  const session = await requireAdmin(request);
  if (!session) return null;
  const csrfToken = randomToken();
  await bindings.DB.prepare("UPDATE admin_sessions SET csrf_hash = ?, last_active_at = ? WHERE token_hash = ?")
    .bind(await sessionHash(csrfToken), Date.now(), session.tokenHash).run();
  return { csrfToken, expiresAt: new Date(session.expiresAt).toISOString() };
}
