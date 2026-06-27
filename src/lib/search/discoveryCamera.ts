import { ZONE_ONLY_SCALE } from '../board/constants'

/** Keep large result sets in zone-only view (same idea as the 3000-person board at 0.1 scale). */
export function discoveryFocusMaxScale(totalMatches: number): number {
  if (totalMatches > 400) return ZONE_ONLY_SCALE - 0.04
  if (totalMatches > 120) return ZONE_ONLY_SCALE - 0.02
  if (totalMatches > 40) return ZONE_ONLY_SCALE + 0.08
  return 1.1
}
