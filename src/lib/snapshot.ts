import type { SavedArea } from "./types";

export function ageInDays(savedAt: string, now = new Date()): number | null {
  const stamp = Date.parse(savedAt);
  if (!Number.isFinite(stamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - stamp) / 86400000));
}
export function snapshotNeedsReview(area: SavedArea, now = new Date()): boolean {
  const age = ageInDays(area.savedAt, now);
  return age === null || age >= 30;
}
