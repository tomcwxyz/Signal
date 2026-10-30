import type { CoverageView } from "./coverage-visual";
import { sampleVisual, VISUAL_RGB } from "./coverage-visual";
import type { LocalCoverageSample } from "./local-coverage";

/**
 * Deliberately local, translucent shading around sampled postcode centroids.
 * No interpolation, no manufactured coverage readings and no stored raster.
 */
export type HeatRing = {
  radiusMetres: number;
  colour: string;
  fillOpacity: number;
  strokeOpacity: number;
  weight: number;
  dashArray?: string;
};

export function coverageHeatRings(sample: LocalCoverageSample, view: CoverageView): HeatRing[] {
  const visual = sampleVisual(sample, view);
  if (visual.level === null) {
    // Explicitly visualise uncertainty instead of treating unknown as zero coverage.
    return [{
      radiusMetres: 580,
      colour: "#60798b",
      fillOpacity: 0,
      strokeOpacity: 0.75,
      weight: 2,
      dashArray: "5 8"
    }];
  }
  const [r, g, b] = VISUAL_RGB[visual.level];
  const colour = `rgb(${r}, ${g}, ${b})`;
  return [
    { radiusMetres: 850, colour, fillOpacity: 0.13, strokeOpacity: 0, weight: 0 },
    { radiusMetres: 550, colour, fillOpacity: 0.20, strokeOpacity: 0, weight: 0 },
    { radiusMetres: 285, colour, fillOpacity: 0.29, strokeOpacity: 0, weight: 0 }
  ];
}
