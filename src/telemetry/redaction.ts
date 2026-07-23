const SENSITIVE_KEY_REGEX = /authorization|api[-_]?key|token|secret|password|cookie|bearer|signature/i;

/**
 * Recursively redacts sensitive keys from an object before telemetry recording.
 */
export function sanitizeTelemetryData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeTelemetryData);
  }

  const obj = data as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeTelemetryData(obj[key]);
    }
  }

  return sanitized;
}
