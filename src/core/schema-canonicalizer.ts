import { canonicalStringify, shortFingerprint } from "./hash.js";

export interface ToolDefinition {
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Idempotently canonicalizes a JSON Schema object by sorting object keys
 * and sorting set-like arrays (`required`, `dependentRequired`).
 */
export function canonicalizeJsonSchema(schema: unknown): unknown {
  if (schema === null || typeof schema !== "object") {
    return schema;
  }
  if (Array.isArray(schema)) {
    return schema.map(canonicalizeJsonSchema);
  }

  const obj = { ...(schema as Record<string, unknown>) };

  if (Array.isArray(obj.required)) {
    obj.required = [...new Set(obj.required.filter((x) => typeof x === "string"))].sort();
  }

  if (obj.dependentRequired && typeof obj.dependentRequired === "object") {
    const depReq = { ...(obj.dependentRequired as Record<string, unknown>) };
    for (const key of Object.keys(depReq)) {
      if (Array.isArray(depReq[key])) {
        depReq[key] = [...new Set((depReq[key] as unknown[]).filter((x) => typeof x === "string"))].sort();
      }
    }
    obj.dependentRequired = depReq;
  }

  if (obj.properties && typeof obj.properties === "object") {
    const props = { ...(obj.properties as Record<string, unknown>) };
    const sortedProps: Record<string, unknown> = {};
    for (const key of Object.keys(props).sort()) {
      sortedProps[key] = canonicalizeJsonSchema(props[key]);
    }
    obj.properties = sortedProps;
  }

  return obj;
}

/**
 * Canonicalizes a list of tool definitions by cloning, sorting set-like schema arrays,
 * and deterministically ordering the tools by name.
 */
export function canonicalizeTools(tools: ToolDefinition[]): {
  canonicalTools: ToolDefinition[];
  rawHash: string;
  canonicalHash: string;
} {
  const rawHash = shortFingerprint(canonicalStringify(tools));
  if (!Array.isArray(tools) || tools.length === 0) {
    return { canonicalTools: [], rawHash, canonicalHash: rawHash };
  }

  const cloned = tools.map((t) => {
    const name = t.name || (t.function as { name?: string })?.name || "unnamed";
    const schema = t.parameters || t.input_schema || t.function || {};
    return {
      ...t,
      name,
      parameters: t.parameters ? (canonicalizeJsonSchema(t.parameters) as Record<string, unknown>) : t.parameters,
      input_schema: t.input_schema ? (canonicalizeJsonSchema(t.input_schema) as Record<string, unknown>) : t.input_schema,
    };
  });

  // Sort tools by name deterministically
  cloned.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const canonicalHash = shortFingerprint(canonicalStringify(cloned));
  return { canonicalTools: cloned, rawHash, canonicalHash };
}
