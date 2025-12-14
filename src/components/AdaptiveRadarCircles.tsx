import React, { useEffect, useMemo } from "react";
import { PathLayer } from "@deck.gl/layers";
import { useAircraftStore } from "../store/useAircraftStore";
import { useMapStore } from "../store/useMapStore";
import { useViewportStore } from "../store/useViewportStore";
import { useLayerStore } from "../store/useLayerStore";
import { convertToCartesian } from "../lib/utils";
import { Aircraft } from "../lib/types";

const AdaptiveRadarCircles: React.FC = () => {
  const { aircraft, nodeId } = useAircraftStore();
  const { zoomLevel, centerMode } = useMapStore();
  const { viewState } = useViewportStore();
  const { addLayer, removeLayer } = useLayerStore();

  const centerAircraft = useMemo(() => {
    if (aircraft.size === 0) return null;
    const aircraftArray = Array.from(aircraft.values());
    if (centerMode === "mother") {
      return (
        aircraftArray.find((a: Aircraft) => a.aircraftType === "mother") ||
        aircraftArray[0]
      );
    }
    return aircraft.get(nodeId) || aircraftArray[0];
  }, [aircraft, centerMode, nodeId]);

  useEffect(() => {
    if (!centerAircraft) {
      removeLayer("radar-circles");
      return;
    }

    let maxDistance = 0;
    aircraft.forEach((ac: Aircraft, id: string) => {
      if (id === centerAircraft.id) return;

      const relativeLat = ac.lat - centerAircraft.lat;
      const relativeLng = ac.lng - centerAircraft.lng;
      const cartesianCoords = convertToCartesian(
        relativeLat,
        relativeLng,
        zoomLevel
      );

      const distance = Math.sqrt(
        cartesianCoords.x * cartesianCoords.x +
          cartesianCoords.y * cartesianCoords.y
      );
      maxDistance = Math.max(maxDistance, Math.abs(distance));
    });

    const ranges = [50, 100, 150, 200, 250, 300];
    const numCircles = 6;
    const minDimension = 400;
    const rangeRatio = maxDistance > 0 ? minDimension / (maxDistance * 2) : 1;

    const circlePaths: Array<{
      path: Array<[number, number]>;
      range: number;
    }> = [];

    ranges.forEach((rangeNM, i) => {
      const baseRadius =
        ((i + 1) * (minDimension * 0.35 * rangeRatio)) / numCircles;
      const zoomLevel = viewState.zoom || 7;
      const radius = baseRadius / zoomLevel;

      // Convert radius to degrees (approximate)
      const radiusDeg = radius / 111000; // rough conversion

      // Create circle path
      const path: Array<[number, number]> = [];
      const steps = 64;
      for (let j = 0; j <= steps; j++) {
        const angle = (j / steps) * 2 * Math.PI;
        const lat =
          centerAircraft.lat + radiusDeg * Math.cos(angle);
        const lng =
          centerAircraft.lng + radiusDeg * Math.sin(angle);
        path.push([lng, lat]);
      }

      circlePaths.push({ path, range: rangeNM });
    });

    const layer = new PathLayer({
      id: "radar-circles",
      data: circlePaths,
      getPath: (d: any) => d.path,
      getColor: [0, 255, 0, 180],
      getWidth: 2,
      widthMinPixels: 1,
      widthMaxPixels: 2,
      pickable: false,
    });

    addLayer(layer);

    return () => {
      removeLayer("radar-circles");
    };
  }, [centerAircraft, aircraft, zoomLevel, viewState.zoom, addLayer, removeLayer]);

  return null;
};

export default AdaptiveRadarCircles;
