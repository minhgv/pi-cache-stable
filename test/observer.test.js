import test from "node:test";
import assert from "node:assert";
import { CacheObserver } from "../dist/telemetry/observer.js";
import { canonicalizeTools } from "../dist/core/schema-canonicalizer.js";
import { extractStructuralView } from "../dist/core/structural-view.js";
import { canonicalStringify } from "../dist/core/hash.js";
import { sanitizeTelemetryData } from "../dist/telemetry/redaction.js";
import cacheStableExtension from "../dist/openclaw-extension.js";

test("extractStructuralView extracts OpenAI shapes correctly", () => {
  const payload = {
    messages: [
      { role: "system", content: "You are a helpful coding assistant." },
      { role: "user", content: "Hello AI!" },
    ],
    tools: [
      { name: "write_file", parameters: { type: "object", required: ["path", "content"] } },
      { name: "read_file", parameters: { type: "object", required: ["path"] } },
    ],
  };

  const view = extractStructuralView(payload);
  assert.strictEqual(view.providerShape, "openai");
  assert.strictEqual(view.counts.messages, 2);
  assert.strictEqual(view.counts.tools, 2);
});

test("canonicalizeTools sorts tool names and required arrays deterministically", () => {
  const toolsUnsorted = [
    { name: "write", parameters: { required: ["file", "content"] } },
    { name: "read", parameters: { required: ["file"] } },
  ];

  const { canonicalTools } = canonicalizeTools(toolsUnsorted);
  assert.strictEqual(canonicalTools[0].name, "read");
  assert.strictEqual(canonicalTools[1].name, "write");
  const params0 = canonicalTools[0].parameters;
  const params1 = canonicalTools[1].parameters;
  assert.deepStrictEqual(params0.required, ["file"]);
  assert.deepStrictEqual(params1.required, ["content", "file"]);
});

test("canonicalStringify handles circular references without throwing", () => {
  const circularObj = { name: "test" };
  circularObj.self = circularObj;

  const result = canonicalStringify(circularObj);
  assert.strictEqual(typeof result, "string");
  assert.ok(result.includes('"[Circular]"'));
});

test("sanitizeTelemetryData redacts sensitive keys recursively", () => {
  const sensitiveData = {
    user: "minh",
    apiKey: "secret_12345",
    nested: {
      authorization: "Bearer token_xyz",
      password: "my_password",
    },
  };

  const sanitized = sanitizeTelemetryData(sensitiveData);
  assert.strictEqual(sanitized.apiKey, "[REDACTED]");
  assert.strictEqual(sanitized.nested.authorization, "[REDACTED]");
  assert.strictEqual(sanitized.nested.password, "[REDACTED]");
  assert.strictEqual(sanitized.user, "minh");
});

test("cacheStableExtension observe mode is 100% fail-open and leaves payload untouched", () => {
  const originalPayload = Object.freeze({
    messages: [{ role: "user", content: "Hello" }],
    tools: [{ name: "test_tool" }],
  });

  let handlerCalled = false;
  const mockPi = {
    on(event, handler) {
      if (event === "before_provider_request") {
        handlerCalled = true;
        const result = handler({ payload: originalPayload });
        assert.strictEqual(result, undefined);
      }
    },
  };

  cacheStableExtension(mockPi);
  assert.strictEqual(handlerCalled, true);
});
