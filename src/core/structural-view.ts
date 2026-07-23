import { canonicalStringify, shortFingerprint } from "./hash.js";
import { canonicalizeTools, ToolDefinition } from "./schema-canonicalizer.js";

export interface StructuralView {
  providerShape: "openai" | "anthropic" | "antigravity" | "unknown";
  systemPromptText: string;
  systemHash: string;
  rawToolsHash: string;
  canonicalToolsHash: string;
  messageHashes: string[];
  fullPayloadHash: string;
  counts: {
    messages: number;
    tools: number;
    systemBytes: number;
  };
}

/**
 * Extracts a structural view and regional fingerprints from a raw provider request payload.
 */
export function extractStructuralView(payload: Record<string, unknown>): StructuralView {
  const fullPayloadHash = shortFingerprint(canonicalStringify(payload));
  let providerShape: "openai" | "anthropic" | "antigravity" | "unknown" = "unknown";
  let systemPromptText = "";
  let rawTools: ToolDefinition[] = [];
  let rawMessages: unknown[] = [];

  // 1. Antigravity / Gemini CLI shape check
  if (payload.requestType === "agent" || payload.userAgent === "antigravity" || (payload.request && typeof payload.request === "object")) {
    providerShape = "antigravity";
    const req = (payload.request as Record<string, unknown>) || payload;
    if (req.systemInstruction && typeof req.systemInstruction === "object") {
      const parts = (req.systemInstruction as { parts?: Array<{ text?: string }> }).parts || [];
      systemPromptText = parts.map((p) => p.text || "").join("\n");
    }
    if (Array.isArray(req.tools)) rawTools = req.tools as ToolDefinition[];
    if (Array.isArray(req.contents)) rawMessages = req.contents as unknown[];
  }
  // 2. OpenAI / DeepSeek / MiMo / Grok shape check
  else if (Array.isArray(payload.messages)) {
    rawMessages = payload.messages as unknown[];
    if (Array.isArray(payload.tools)) {
      rawTools = payload.tools as ToolDefinition[];
    }
    providerShape = "openai";

    // Extract system messages
    const sysMsgs = rawMessages.filter(
      (m) => typeof m === "object" && m !== null && ((m as { role?: string }).role === "system" || (m as { role?: string }).role === "developer")
    );
    systemPromptText = sysMsgs.map((m) => String((m as { content?: unknown }).content || "")).join("\n");
  }
  // 3. Anthropic Messages shape check
  else if (payload.system !== undefined || Array.isArray(payload.messages)) {
    providerShape = "anthropic";
    if (typeof payload.system === "string") {
      systemPromptText = payload.system;
    } else if (Array.isArray(payload.system)) {
      systemPromptText = canonicalStringify(payload.system);
    }
    if (Array.isArray(payload.tools)) rawTools = payload.tools as ToolDefinition[];
    if (Array.isArray(payload.messages)) rawMessages = payload.messages as unknown[];
  }

  const systemHash = shortFingerprint(systemPromptText);
  const { rawHash: rawToolsHash, canonicalHash: canonicalToolsHash } = canonicalizeTools(rawTools);
  const messageHashes = rawMessages.map((m) => shortFingerprint(canonicalStringify(m)));

  return {
    providerShape,
    systemPromptText,
    systemHash,
    rawToolsHash,
    canonicalToolsHash,
    messageHashes,
    fullPayloadHash,
    counts: {
      messages: rawMessages.length,
      tools: rawTools.length,
      systemBytes: Buffer.byteLength(systemPromptText, "utf8"),
    },
  };
}
