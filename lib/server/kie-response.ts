type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function visit(value: unknown, seen: Set<object>, allowString = false, depth = 0): string | undefined {
  if (depth > 12) return undefined;
  if (typeof value === "string") return allowString ? nonEmpty(value) : undefined;
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const found = visit(value[index], seen, allowString, depth + 1);
      if (found) return found;
    }
    return undefined;
  }

  const record = value as JsonRecord;
  const outputText = nonEmpty(record.output_text);
  if (outputText) return outputText;

  const type = typeof record.type === "string" ? record.type : "";
  if (type.includes("output_text")) {
    const text = nonEmpty(record.text);
    if (text) return text;
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    if (!isRecord(choice)) continue;
    const found = visit(choice.message ?? choice.delta, seen, true, depth + 1);
    if (found) return found;
  }

  for (const key of ["output", "content", "response", "message", "data", "result", "events"] as const) {
    const candidate = record[key];
    const allowNestedString = key === "content" || key === "message" || key === "result";
    const found = visit(candidate, seen, allowNestedString, depth + 1);
    if (found) return found;
  }

  return undefined;
}

export function extractKieResponseText(payload: unknown) {
  const text = visit(payload, new Set<object>());
  if (!text) throw new Error("analysis_output_missing");
  return text;
}

export function describeKieResponseShape(payload: unknown) {
  if (!isRecord(payload)) return { kind: Array.isArray(payload) ? "array" : typeof payload };
  const response = isRecord(payload.response) ? payload.response : undefined;
  return {
    kind: "object",
    type: typeof payload.type === "string" ? payload.type : undefined,
    keys: Object.keys(payload).slice(0, 12),
    responseKeys: response ? Object.keys(response).slice(0, 12) : undefined,
    eventCount: Array.isArray(payload.events) ? payload.events.length : undefined,
  };
}
