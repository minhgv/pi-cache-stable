export interface PiCacheStableConfig {
  version: "1.0.0";
  global: {
    mode: "observe" | "suggest" | "enforce" | "off";
    failOpen: boolean;
    killSwitch: boolean;
  };
  canonicalization: {
    sortToolNames: boolean;
    sortRequiredArrays: boolean;
    sortDependentRequired: boolean;
    deepSortProperties: boolean;
  };
  prefixStability: {
    stripDynamicHead: boolean;
    compactionPolicy: "append_only_checkpoint" | "sliding_window" | "passthrough";
    maxVerbatimTailTokens: number;
  };
  reasoningPolicy: {
    stripReasoningHistory: Record<string, boolean>;
    preserveThoughtSignatures: boolean;
  };
  mcpIntegration: {
    stabilizeMcpToolOrder: boolean;
    treatCompactionAsEpochBoundary: boolean;
  };
  telemetry: {
    enabled: boolean;
    sink: "jsonl" | "console" | "memory" | "none";
    sinkPath?: string;
    sampleRate: number;
  };
}

export const DEFAULT_CONFIG: PiCacheStableConfig = {
  version: "1.0.0",
  global: {
    mode: "observe",
    failOpen: true,
    killSwitch: false,
  },
  canonicalization: {
    sortToolNames: true,
    sortRequiredArrays: true,
    sortDependentRequired: true,
    deepSortProperties: true,
  },
  prefixStability: {
    stripDynamicHead: true,
    compactionPolicy: "append_only_checkpoint",
    maxVerbatimTailTokens: 16384,
  },
  reasoningPolicy: {
    stripReasoningHistory: {
      deepseek: true,
      glm: true,
      "xiaomi-mimo": true,
      "xai-grok": true,
      "google-antigravity": false,
      anthropic: false,
    },
    preserveThoughtSignatures: true,
  },
  mcpIntegration: {
    stabilizeMcpToolOrder: true,
    treatCompactionAsEpochBoundary: true,
  },
  telemetry: {
    enabled: true,
    sink: "jsonl",
    sampleRate: 1.0,
  },
};

/**
 * Parameter Configuration Engine. Evaluates runtime settings and environment variable overrides.
 */
export class PolicyEngine {
  private config: PiCacheStableConfig;

  constructor(userConfig?: Partial<PiCacheStableConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      global: { ...DEFAULT_CONFIG.global, ...userConfig?.global },
      canonicalization: { ...DEFAULT_CONFIG.canonicalization, ...userConfig?.canonicalization },
      prefixStability: { ...DEFAULT_CONFIG.prefixStability, ...userConfig?.prefixStability },
      reasoningPolicy: { ...DEFAULT_CONFIG.reasoningPolicy, ...userConfig?.reasoningPolicy },
      mcpIntegration: { ...DEFAULT_CONFIG.mcpIntegration, ...userConfig?.mcpIntegration },
      telemetry: { ...DEFAULT_CONFIG.telemetry, ...userConfig?.telemetry },
    };
  }

  public isEnabled(): boolean {
    if (process.env.PI_CACHE_KILL_SWITCH === "1" || process.env.PI_CACHE_KILL_SWITCH === "true") {
      return false;
    }
    if (this.config.global.killSwitch || this.config.global.mode === "off") {
      return false;
    }
    return true;
  }

  public getMode(): "observe" | "suggest" | "enforce" | "off" {
    if (!this.isEnabled()) return "off";
    const envMode = process.env.PI_CACHE_MODE as "observe" | "suggest" | "enforce" | "off" | undefined;
    return envMode || this.config.global.mode;
  }

  public getConfig(): PiCacheStableConfig {
    return this.config;
  }

  public updateConfig(patch: Partial<PiCacheStableConfig>): void {
    this.config = {
      ...this.config,
      ...patch,
      global: { ...this.config.global, ...patch.global },
    };
  }
}
