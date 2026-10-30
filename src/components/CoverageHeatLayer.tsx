"use client";

import { useEffect } from "react";
import type * as Leaflet from "leaflet";
import { coverageHeatRings } from "@/lib/coverage-heat-style";
import type { CoverageView } from "@/lib/coverage-visual";
import type { LocalCoverageSample } from "@/lib/local-coverage";

type Props = {
  map: Leaflet.Map | null;
  leaflet: typeof Leaflet | null;
  samples: LocalCoverageSample[];
  view: CoverageView;
  visible: boolean;
};

/**
 * Native Leaflet vector circles render in the overlay pane (above OSM tiles,
 * below the marker pane). Avoids the sibling-canvas stacking problem and
 * keeps the shading correctly geo-anchored while zooming/panning.
 */
export default function CoverageHeatLayer({ map, leaflet, samples, view, visible }: Props) {
  useEffect(() => {
    if (!map || !leaflet || !visible || samples.length === 0) return;
    const group = leaflet.layerGroup().addTo(map);
    for (const sample of samples) {
      for (const ring of coverageHeatRings(sample, view)) {
        leaflet.circle([sample.centre.lat, sample.centre.lon], {
          radius: ring.radiusMetres,
          color: ring.colour,
          opacity: ring.strokeOpacity,
          fillColor: ring.colour,
          fillOpacity: ring.fillOpacity,
          weight: ring.weight,
          dashArray: ring.dashArray,
          interactive: false,
          bubblingMouseEvents: false,
          className: "signal-ofcom-heat-ring"
        }).addTo(group);
      }
    }
    return () => { if (map.hasLayer(group)) map.removeLayer(group); };
  }, [map, leaflet, samples, view, visible]);
  return null;
}
