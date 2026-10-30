import type { LatLon } from "./types";
import type { CoverageOperator, CoverageRating, CoverageResponse } from "./ofcom-coverage";
import { COVERAGE_OPERATORS } from "./ofcom-coverage";
import { validCoordinates } from "./geo";

/**
 * Transient, on-request postcode-centroid samples, not a predicted coverage raster.
 * A score is plotted only when EVERY returned property has the same reported level.
 * Otherwise the marker is explicitly marked 'varies' and links to property lookup.
 */
export type LocalCoverageSample = {
  postcode: string;
  centre: LatLon; // postcode centroid, NOT the precise location of a property
  propertyCount: number;
  ratings: Record<CoverageOperator, CoverageRating>;
  varies: Record<CoverageOperator, boolean>;
};
export type LocalCoverageResult = {
  centre: LatLon;
  searchRadiusMetres: number;
  samples: LocalCoverageSample[];
  failedLookups: number;
  source: "Ofcom";
  kind: "sampled-postcode-centroids";
};
export const LOCAL_SAMPLE_RADIUS_METRES = 650;
export const MAX_LOCAL_SAMPLES = 9;

export function sampleTargets(centre: LatLon): LatLon[] {
  if (!validCoordinates(centre)) return [];
  const latitudeOffset = LOCAL_SAMPLE_RADIUS_METRES / 111_320;
  const longitudeOffset = LOCAL_SAMPLE_RADIUS_METRES /
    (111_320 * Math.max(0.2, Math.cos(centre.lat * Math.PI / 180)));
  const points: Array<[number, number]> = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707]
  ];
  return points.map(([n, e]) => ({
    lat: centre.lat + n * latitudeOffset,
    lon: centre.lon + e * longitudeOffset
  })).filter(validCoordinates);
}

export function summariseSample(coverage: CoverageResponse, centre: LatLon): LocalCoverageSample {
  const ratings = {} as Record<CoverageOperator, CoverageRating>;
  const varies = {} as Record<CoverageOperator, boolean>;
  for (const operator of COVERAGE_OPERATORS) {
    const values = coverage.properties.map(property => property.ratings[operator]);
    const distinct = [...new Set(values)];
    const allValid = distinct.length === 1 && distinct[0] !== null && distinct[0] !== undefined;
    ratings[operator] = allValid ? distinct[0] : null;
    varies[operator] = distinct.length > 1;
  }
  return {
    postcode: coverage.postcode,
    centre,
    propertyCount: coverage.properties.length,
    ratings,
    varies
  };
}
