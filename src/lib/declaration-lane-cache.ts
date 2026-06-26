import type { Doc } from "../../convex/_generated/dataModel";

type DeclarationLane = Doc<"declarations"> | null;

const laneById = new Map<string, DeclarationLane>();

export function rememberDeclarationLane(id: string, lane: DeclarationLane) {
  if (!id) return;
  laneById.set(id, lane);
}

export function getRememberedDeclarationLane(id: string | null | undefined) {
  if (!id) return undefined;
  return laneById.get(id);
}

export function clearDeclarationLaneCache() {
  laneById.clear();
}
