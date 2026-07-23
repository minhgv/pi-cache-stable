import test from "node:test";
import assert from "node:assert";
import { CacheObserver } from "../dist/telemetry/observer.js";
import { canonicalizeTools } from "../dist/core/schema-canonicalizer.js";
import { extractStructuralView } from "../dist/core/structural-view.js";

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

  const { canonicalTools, canonicalHash } = canonicalizeTools(toolsUnsorted);
  assert.strictEqual(canonicalTools[0].name, "read");
  assert.strictEqual(canonicalTools[1].name, "write");
  assert.deepStrictEqual(canonicalTools[0].parameters.required, ["file"]);
  assert.deepStrictEqual(canonicalTools[1].parameters.required, ["content", "file"]);
});

test("CacheObserver tracks sequence and handles boundaries cleanly", () => {
  const observer = new CacheObserver({
    global: { mode: "observe", failOpen: true, killSwitch: false },
    telemetry: { enabled: false, sink: "none", sampleRate: 1.0 },
  });

  const payload = {
    messages: [
      { role: "system", content: "Stable system prompt" },
      { role: "user", content: "Turn 1" },
    ],
  };

  const res1 = observer.observe(payload);
  assert.strictEqual(res1.driftReason, "first_request");

  const res2 = observer.observe(payload);
  assert.strictEqual(res2.driftReason, "first_request");

  observer.boundary("compaction");
  const res3 = observer.observe(payload);
  assert.strictEqual(res3.driftReason, "epoch_boundary");
});
