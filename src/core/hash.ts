import { createHash } from "node:crypto";

/**
 * Computes a SHA-256 hex string of input text or buffer.
 */
export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Computes a short 16-character SHA-256 fingerprint.
 */
export function shortFingerprint(data: string | Buffer): string {
  return sha256(data).slice(0, 16);
}

/**
 * Idempotently serializes any JavaScript value into a deterministic JSON string.
 * Recursively sorts object keys while preserving array ordering.
 * Handles circular references gracefully.
 */
export function canonicalStringify(val: unknown, seen = new WeakSet()): string {
  if (val === undefined) return "null";
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val);
  }
  if (seen.has(val)) {
    return '"[Circular]"';
  }
  seen.add(val);

  if (Array.isArray(val)) {
    const res = "[" + val.map((item) => canonicalStringify(item, seen)).join(",") + "]";
    seen.delete(val);
    return res;
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalStringify(obj[key], seen)}`
  );
  seen.delete(val);
  return "{" + entries.join(",") + "}";
}
