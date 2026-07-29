function normalizeIp(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
}

export function rateLimitAllowlist(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map(normalizeIp)
      .filter(Boolean),
  );
}

export function isRateLimitAllowlisted(address: string, raw: string | undefined) {
  const normalized = normalizeIp(address);
  if (!normalized) return false;
  return rateLimitAllowlist(raw).has(normalized);
}
