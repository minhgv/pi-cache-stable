import { classifyDrift, SnapshotComparison } from "../core/drift.js";
import { extractStructuralView, StructuralView } from "../core/structural-view.js";
import { PolicyEngine, PiCacheStableConfig } from "../policy/engine.js";
import { JsonlSink } from "./jsonl.js";

export interface TelemetryRecord {
  timestamp: number;
  epoch: number;
  sequence: number;
  mode: string;
  providerShape: string;
  driftReason: string;
  stableMessagePrefixCount: number;
  details: string;
  counts: StructuralView["counts"];
  systemHash: string;
  rawToolsHash: string;
  canonicalToolsHash: string;
  fullPayloadHash: string;
}

export class CacheObserver {
  private policyEngine: PolicyEngine;
  private epoch = 1;
  private sequence = 0;
  private prevView?: StructuralView;
  private isEpochBoundaryNext = false;
  private sink?: JsonlSink;

  constructor(userConfig?: Partial<PiCacheStableConfig>) {
    this.policyEngine = new PolicyEngine(userConfig);
    const cfg = this.policyEngine.getConfig();
    if (cfg.telemetry.enabled && cfg.telemetry.sinkPath) {
      this.sink = new JsonlSink(cfg.telemetry.sinkPath);
    }
  }

  public boundary(reason: string): void {
    this.epoch++;
    this.sequence = 0;
    this.prevView = undefined;
    this.isEpochBoundaryNext = true;
  }

  public observe(payload: Record<string, unknown>): SnapshotComparison | undefined {
    if (!this.policyEngine.isEnabled()) {
      return undefined;
    }

    try {
      this.sequence++;
      const currView = extractStructuralView(payload);
      const comparison = classifyDrift(this.prevView, currView, this.isEpochBoundaryNext);
      this.isEpochBoundaryNext = false;
      this.prevView = currView;

      const record: TelemetryRecord = {
        timestamp: Date.now(),
        epoch: this.epoch,
        sequence: this.sequence,
        mode: this.policyEngine.getMode(),
        providerShape: currView.providerShape,
        driftReason: comparison.driftReason,
        stableMessagePrefixCount: comparison.stableMessagePrefixCount,
        details: comparison.details,
        counts: currView.counts,
        systemHash: currView.systemHash,
        rawToolsHash: currView.rawToolsHash,
        canonicalToolsHash: currView.canonicalToolsHash,
        fullPayloadHash: currView.fullPayloadHash,
      };

      if (this.sink) {
        this.sink.write(record as unknown as Record<string, unknown>);
      }

      return comparison;
    } catch {
      // Fail-open: return undefined if observation encounters error
      return undefined;
    }
  }
}
