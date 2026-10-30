import { COVERAGE_OPERATORS } from "./ofcom-coverage";
import type { CoverageOperator } from "./ofcom-coverage";
import type { LocalCoverageSample } from "./local-coverage";

export type CoverageView = "All" | CoverageOperator;
export const COVERAGE_VIEWS: readonly CoverageView[] = ["All", ...COVERAGE_OPERATORS];

/** Derived presentation only. No synthetic Ofcom scores are created. */
export type CoverageVisual = {
  label: string;
  level: 0 | 1 | 2 | 3 | 4 | null;
  details: string;
};
export function sampleVisual(sample: LocalCoverageSample, view: CoverageView): CoverageVisual {
  if (sample.propertyCount === 0) return { label: "?", level: null, details: "No property-level predictions" };
  if (view !== "All") {
    if (sample.varies[view]) return { label: "≠", level: null, details: "Ofcom ratings differ by property" };
    const value = sample.ratings[view];
    if (value === null) return { label: "?", level: null, details: "No consistent coverage rating" };
    return { label: String(value), level: value, details: "Ofcom " + view + " rating " + value + "/4" };
  }
  // All = conservative comparison, not an Ofcom rating.
  // Count only networks whose 3–4 score is identical across every returned property.
  const known = COVERAGE_OPERATORS.filter(network =>
    sample.ratings[network] !== null && !sample.varies[network]);
  const inHome = known.filter(network => (sample.ratings[network] ?? 0) >= 3).length;
  const uncertain = known.length < COVERAGE_OPERATORS.length;
  if (uncertain && inHome === 0) {
    return { label: "?", level: null, details: "Not enough consistent network ratings to compare" };
  }
  return {
    label: String(inHome) + (uncertain ? "+" : ""),
    level: inHome as 0 | 1 | 2 | 3 | 4,
    details: uncertain
      ? "At least " + inHome + " of 4 networks consistently predict in-home reception"
      : inHome + " of 4 networks consistently predict in-home reception"
  };
}

export const VISUAL_RGB = [
  [206, 66, 81], [243, 164, 81], [241, 206, 99], [180, 214, 155], [61, 165, 121]
] as const;
