"use client";

import { Bike, Car, Footprints, Navigation } from "lucide-react";
import type { WiFiPlace } from "@/lib/types";
import { googleMapsDirectionsUrl } from "@/lib/directions";

type Props = { place: WiFiPlace; compact?: boolean; className?: string };
export default function WiFiDirections({ place, compact = false, className = "" }: Props) {
  if (compact) {
    return <a className={"wifi-directions-link " + className}
      href={googleMapsDirectionsUrl(place, "walking")}
      target="_blank" rel="noopener noreferrer"
      aria-label={"Walking directions to " + place.name + " in Google Maps"}>
      <Navigation size={14} aria-hidden="true"/> Directions
    </a>;
  }
  return <div className={"wifi-direction-modes " + className} aria-label={"Directions to " + place.name}>
    <a href={googleMapsDirectionsUrl(place, "walking")} target="_blank" rel="noopener noreferrer"
       aria-label={"Walking directions to " + place.name + " in Google Maps"}>
      <Footprints size={15} aria-hidden="true"/> Walk
    </a>
    <a href={googleMapsDirectionsUrl(place, "bicycling")} target="_blank" rel="noopener noreferrer"
       aria-label={"Cycling directions to " + place.name + " in Google Maps"}>
      <Bike size={15} aria-hidden="true"/> Cycle
    </a>
    <a href={googleMapsDirectionsUrl(place, "driving")} target="_blank" rel="noopener noreferrer"
       aria-label={"Driving directions to " + place.name + " in Google Maps"}>
      <Car size={15} aria-hidden="true"/> Drive
    </a>
  </div>;
}
