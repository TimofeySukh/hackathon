/** Agent-chosen cap: include every strong-tier match plus audit slack. */
export function computeAutoGroupLimit(strongCount: number, peopleInGraph: number): number {
  if (strongCount > 0) {
    return Math.min(peopleInGraph, strongCount + 12)
  }
  return Math.min(48, Math.max(12, Math.ceil(peopleInGraph * 0.02)))
}
