import { StructuralView } from "./structural-view.js";

export type DriftReason =
  | "first_request"
  | "system_changed"
  | "tool_set_changed"
  | "tool_order_changed"
  | "tool_schema_changed"
  | "message_prefix_changed"
  | "provider_shape_changed"
  | "payload_metadata_changed"
  | "epoch_boundary"
  | "unsupported_shape";

export interface SnapshotComparison {
  driftReason: DriftReason;
  stableMessagePrefixCount: number;
  messagePrefixDriftIndex?: number;
  details: string;
}

/**
 * Calculates prefix common count between two message hash lists.
 */
export function calculateCommonMessagePrefix(prevHashes: string[], currHashes: string[]): number {
  const minLen = Math.min(prevHashes.length, currHashes.length);
  let matchCount = 0;
  for (let i = 0; i < minLen; i++) {
    if (prevHashes[i] === currHashes[i]) {
      matchCount++;
    } else {
      break;
    }
  }
  return matchCount;
}

/**
 * Classifies drift between a current structural view and a previous snapshot.
 */
export function classifyDrift(
  prevView: StructuralView | undefined,
  currView: StructuralView,
  isEpochBoundary: boolean
): SnapshotComparison {
  if (isEpochBoundary) {
    return {
      driftReason: "epoch_boundary",
      stableMessagePrefixCount: 0,
      details: "Request followed an explicit session/compaction/model boundary",
    };
  }

  if (!prevView) {
    return {
      driftReason: "first_request",
      stableMessagePrefixCount: 0,
      details: "First request in active epoch",
    };
  }

  if (currView.providerShape !== prevView.providerShape) {
    return {
      driftReason: "provider_shape_changed",
      stableMessagePrefixCount: 0,
      details: `Provider shape changed from ${prevView.providerShape} to ${currView.providerShape}`,
    };
  }

  if (currView.systemHash !== prevView.systemHash) {
    return {
      driftReason: "system_changed",
      stableMessagePrefixCount: 0,
      details: `System prompt hash changed from ${prevView.systemHash} to ${currView.systemHash}`,
    };
  }

  if (currView.canonicalToolsHash !== prevView.canonicalToolsHash) {
    if (currView.counts.tools !== prevView.counts.tools) {
      return {
        driftReason: "tool_set_changed",
        stableMessagePrefixCount: 0,
        details: `Tool count changed from ${prevView.counts.tools} to ${currView.counts.tools}`,
      };
    }
    return {
      driftReason: "tool_schema_changed",
      stableMessagePrefixCount: 0,
      details: `Canonical tool schema hash changed from ${prevView.canonicalToolsHash} to ${currView.canonicalToolsHash}`,
    };
  }

  if (currView.rawToolsHash !== prevView.rawToolsHash) {
    return {
      driftReason: "tool_order_changed",
      stableMessagePrefixCount: 0,
      details: `Raw tool hash changed from ${prevView.rawToolsHash} to ${currView.rawToolsHash} (Canonical hash unchanged)`,
    };
  }

  const commonCount = calculateCommonMessagePrefix(prevView.messageHashes, currView.messageHashes);
  if (prevView.messageHashes.length > 0 && commonCount < prevView.messageHashes.length) {
    return {
      driftReason: "message_prefix_changed",
      stableMessagePrefixCount: commonCount,
      messagePrefixDriftIndex: commonCount,
      details: `Message prefix diverged at index ${commonCount} (Previous message count: ${prevView.messageHashes.length})`,
    };
  }

  if (currView.fullPayloadHash !== prevView.fullPayloadHash) {
    return {
      driftReason: "payload_metadata_changed",
      stableMessagePrefixCount: commonCount,
      details: "Top-level request metadata changed (e.g. temperature, maxTokens, requestId)",
    };
  }

  return {
    driftReason: "first_request",
    stableMessagePrefixCount: commonCount,
    details: "Byte-identical prompt prefix maintained",
  };
}
