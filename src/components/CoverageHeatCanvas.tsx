"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type { CoverageView } from "@/lib/coverage-visual";
import { sampleVisual, VISUAL_RGB } from "@/lib/coverage-visual";
import type { LocalCoverageSample } from "@/lib/local-coverage";

type Props = {
  map: Leaflet.Map | null;
  samples: LocalCoverageSample[];
  view: CoverageView;
  visible: boolean;
};

/**
 * Transient soft halos centred on real queried postcode centroids.
 * Not a continuous signal prediction, interpolation grid or stored dataset.
 */
export default function CoverageHeatCanvas({ map, samples, view, visible }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !map) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const element = map.getContainer();
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!visible) return;
      const metres = 710;
      for (const sample of samples) {
        const info = sampleVisual(sample, view);
        if (info.level === null) continue; // no fabricated colour for unknown/mixed data
        const centre = map.latLngToContainerPoint([sample.centre.lat, sample.centre.lon]);
        const north = map.latLngToContainerPoint([sample.centre.lat + metres / 111320, sample.centre.lon]);
        const radius = Math.max(24, Math.min(190, Math.abs(centre.y - north.y)));
        if (centre.x + radius < 0 || centre.y + radius < 0 ||
            centre.x - radius > width || centre.y - radius > height) continue;
        const [r, g, b] = VISUAL_RGB[info.level];
        const gradient = ctx.createRadialGradient(centre.x, centre.y, 6, centre.x, centre.y, radius);
        gradient.addColorStop(0, "rgba(" + r + "," + g + "," + b + ",0.42)");
        gradient.addColorStop(0.42, "rgba(" + r + "," + g + "," + b + ",0.24)");
        gradient.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    map.on("move zoom resize", schedule);
    schedule();
    return () => { map.off("move zoom resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [map, samples, view, visible]);
  return <canvas className="signal-heat-canvas" ref={ref} aria-hidden="true" />;
}
