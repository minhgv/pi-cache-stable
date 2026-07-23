import { CacheObserver } from "./telemetry/observer.js";
import { PiCacheStableConfig } from "./policy/engine.js";

export interface MinimalPiExtensionApi {
  on(event: string, handler: (...args: any[]) => void): void;
}

/**
 * Extension factory function for OpenClaw and Pi CLI.
 */
export default function cacheStableExtension(
  pi: MinimalPiExtensionApi,
  config?: Partial<PiCacheStableConfig>
) {
  const observer = new CacheObserver(config);

  pi.on("before_provider_request", (event: { payload?: Record<string, unknown> }) => {
    if (event?.payload && typeof event.payload === "object") {
      observer.observe(event.payload);
    }
    // Always return undefined to ensure 100% observe-mode safety (payload remains untouched)
    return undefined;
  });

  pi.on("session_compact", () => observer.boundary("compaction"));
  pi.on("session_start", (event: { reason?: string }) => observer.boundary(`session:${event?.reason || "start"}`));
  pi.on("session_tree", () => observer.boundary("tree"));
  pi.on("model_select", () => observer.boundary("model"));
}
