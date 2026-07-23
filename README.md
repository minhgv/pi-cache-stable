# pi-cache-stable

> **Production-grade prompt cache stabilization and telemetry engine for Pi CLI and OpenClaw.**

`pi-cache-stable` is a zero-dependency, fail-open runtime extension designed to maximize **Hardware KV Prompt Cache Hit Rates (>85%+)**, prevent cache drift, and provide real-time telemetry diagnostics across LLM providers including Google Antigravity, Anthropic, DeepSeek, GLM, Xiaomi MiMo, and Grok.

---

## 📌 Key Features

1. **Deterministic Schema Canonicalization:** Automatically sorts tool names and JSON schema property arrays alphabetically to eliminate KV cache invalidation caused by non-deterministic tool order.
2. **Provider-Aware Reasoning Policy:** Preserves thought signatures for Google Antigravity & Anthropic while stripping redundant historical reasoning blocks for DeepSeek-R1, GLM, and Xiaomi MiMo.
3. **100% Fail-Open Architecture:** Any execution anomaly or unexpected schema format automatically falls back to the original unmodified payload without interrupting developer experience or API calls.
4. **Real-time Telemetry Diagnostics:** Emits SHA-256 system prompt fingerprints, tool schema hashes, and sequence tracking to `.jsonl`, `console`, or `memory`.

---

## ⚙️ Configuration & Provider Matching Rules

Configuration is managed via `~/.pi/agent/extensions/pi-cache-stable/index.ts` or `.pi/config.json`.

```typescript
export default function (pi: any) {
  cacheStableExtension(pi, {
    global: {
      mode: "enforce",       // "enforce" | "observe" | "suggest" | "off"
      failOpen: true,        // Fallback 100% to original payload on any error
      killSwitch: false
    },
    canonicalization: {
      sortToolNames: true,        // Deterministic sorting of tool names
      sortRequiredArrays: true,   // Deterministic sorting of required property arrays
      sortDependentRequired: true,
      deepSortProperties: true
    },
    reasoningPolicy: {
      preserveThoughtSignatures: true,
      stripReasoningHistory: {
        "google-antigravity": false, // PRESERVE thought signatures
        "anthropic": false,          // PRESERVE thought signatures
        "deepseek": true,            // STRIP historical reasoning
        "glm": true,                 // STRIP historical reasoning
        "xiaomi-mimo": true,         // STRIP historical reasoning
        "xai-grok": true             // STRIP historical reasoning
      }
    },
    telemetry: {
      enabled: true,
      sink: "jsonl",
      sinkPath: "/Users/giapminh79/.openclaw/labs/pi-cache-stable/telemetry.jsonl"
    }
  });
}
```

---

## 🎯 Provider Name Matching Specifications

The keys in `reasoningPolicy.stripReasoningHistory` use **Case-Insensitive Substring & Prefix Matching** against the active Provider ID / Model Name:

| Provider Key in Config | Matching Provider IDs / Model Names | Reasoning Policy Behavior |
| :--- | :--- | :--- |
| `"google-antigravity"` | `google-antigravity`, `google-antigravity/gemini-3.6-flash-high`, `antigravity` | `false` — Preserve thought signatures |
| `"anthropic"` | `anthropic`, `anthropic/claude-3-5-sonnet`, `anthropic/claude-3-opus` | `false` — Preserve thought signatures |
| `"openai"` | `openai`, `openai/gpt-4o`, `openai/gpt-4o-mini`, `o1`, `o3-mini` | `false` — Managed automatically via OpenAI Cache Engine |
| `"openai-codex"` | `openai-codex`, `codex`, `gpt-5.1`, `gpt-5.1-codex-max`, `gpt-5.2-codex`, `gpt-5.3-codex`, `gpt-5.4` | `false` — Managed automatically via OpenAI Cache Engine |
| `"deepseek"` | `deepseek`, `deepseek-ai/deepseek-r1` | `true` — Strip historical reasoning turns |
| `"glm"` | `glm`, `glm-4`, `zhipu/glm-4` | `true` — Strip historical reasoning turns |
| `"xiaomi-mimo"` | `xiaomi-mimo`, `xiaomi-mimo/mimo-v1`, `xiaomi-mimo/mimo-coder` | `true` — Strip historical reasoning turns |
| `"xai-grok"` | `xai-grok`, `grok-3` | `true` — Strip historical reasoning turns |

> ⚠️ **Configuration Warning:** Provider keys MUST match the exact substring of the Provider ID exposed by OpenClaw or Pi CLI. For instance, using `"mimo"` instead of `"xiaomi-mimo"` when OpenClaw passes `xiaomi-mimo` will cause a mismatch and fallback to `false`.

---

## 📊 Monitoring & Telemetry Commands

### Live Watch Command
```bash
watch -n 1 "tail -n 5 ~/.openclaw/labs/pi-cache-stable/telemetry.jsonl | jq -c '{timestamp, sequence, mode, driftReason, stableMessagePrefixCount, systemHash}'"
```

### Calculate Cache Hit & Stable Prefix Rate
```bash
jq -s 'map(.stableMessagePrefixCount) | {total_requests: length, avg_stable_prefix: (add/length)}' ~/.openclaw/labs/pi-cache-stable/telemetry.jsonl
```

### Inspect Cache Drift Violations
```bash
jq -c 'select(.driftReason != "none" and .driftReason != "first_request") | {sequence, driftReason, details}' ~/.openclaw/labs/pi-cache-stable/telemetry.jsonl
```

---

## 🚨 Emergency Kill Switch

Setting the environment variable `PI_CACHE_KILL_SWITCH=1` instantly disables all canonicalization, fingerprinting, and telemetry hooks with zero runtime overhead:

```bash
PI_CACHE_KILL_SWITCH=1 picode
```

---

## 📄 License

MIT © Minh & AGY
