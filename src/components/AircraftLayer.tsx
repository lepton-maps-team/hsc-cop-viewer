import React, { useMemo, useEffect } from "react";
import { IconLayer } from "@deck.gl/layers";
import { useAircraftStore } from "../store/useAircraftStore";
import { useMapStore } from "../store/useMapStore";
import { useViewportStore } from "../store/useViewportStore";
import { useLayerStore } from "../store/useLayerStore";
import { convertToCartesian } from "../lib/utils";
import { Aircraft } from "../lib/types";

const getAircraftIcon = (aircraftType: string): string => {
  switch (aircraftType) {
    case "mother":
      return "✈️";
    case "friendly":
      return "🛩️";
    case "threat":
      return "⚠️";
    case "self":
      return "🎯";
    default:
      return "✈️";
  }
};

const getAircraftColor = (aircraftType: string): [number, number, number, number] => {
  switch (aircraftType) {
    case "mother":
      return [255, 170, 0, 255];
    case "friendly":
      return [0, 255, 0, 255];
    case "threat":
      return [255, 0, 0, 255];
    case "self":
      return [0, 170, 255, 255];
    default:
      return [255, 255, 255, 255];
  }
};

const AircraftLayer: React.FC = () => {
  const { aircraft, nodeId } = useAircraftStore();
  const { viewMode, zoomLevel, centerMode } = useMapStore();
  const { viewState } = useViewportStore();
  const { addLayer, removeLayer } = useLayerStore();

  const centerAircraft = useMemo(() => {
    if (aircraft.size === 0) return null;
    const aircraftArray = Array.from(aircraft.values());
    if (centerMode === "mother") {
      return (
        aircraftArray.find((a) => a.aircraftType === "mother") ||
        aircraftArray[0]
      );
    }
    return aircraft.get(nodeId) || aircraftArray[0];
  }, [aircraft, centerMode, nodeId]);

  useEffect(() => {
    if (!centerAircraft) {
      removeLayer("aircraft-layer");
      return;
    }

    const aircraftData: Array<{
      position: [number, number];
      icon: string;
      color: [number, number, number, number];
      size: number;
      id: string;
    }> = [];

    // Add center aircraft at actual position
    aircraftData.push({
      position: [centerAircraft.lng, centerAircraft.lat],
      icon: getAircraftIcon(centerAircraft.aircraftType),
      color: getAircraftColor(centerAircraft.aircraftType),
      size: 30,
      id: centerAircraft.id,
    });

    // Add other aircraft relative to center
    aircraft.forEach((aircraftItem: Aircraft, id: string) => {
      if (id === centerAircraft.id) return;
      if (viewMode === "self-only" && aircraftItem.aircraftType !== "self")
        return;

      const relativeLat = aircraftItem.lat - centerAircraft.lat;
      const relativeLng = aircraftItem.lng - centerAircraft.lng;
      const cartesianCoords = convertToCartesian(
        relativeLat,
        relativeLng,
        zoomLevel
      );

      // Convert cartesian to lat/lng relative to center
      const scale = 100;
      const deltaLng = cartesianCoords.x / (scale * zoomLevel);
      const deltaLat = -cartesianCoords.y / (scale * zoomLevel);

      aircraftData.push({
        position: [
          centerAircraft.lng + deltaLng,
          centerAircraft.lat + deltaLat,
        ],
        icon: getAircraftIcon(aircraftItem.aircraftType),
        color: getAircraftColor(aircraftItem.aircraftType),
        size: 25,
        id,
      });
    });

    const layer = new IconLayer({
      id: "aircraft-layer",
      data: aircraftData,
      getIcon: (d: any) => ({
        url: `data:image/svg+xml;base64,${btoa(
          `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
            <text x="16" y="20" font-size="20" text-anchor="middle">${d.icon}</text>
          </svg>`
        )}`,
        width: 32,
        height: 32,
      }),
      getPosition: (d: any) => d.position,
      getColor: (d: any) => d.color,
      getSize: (d: any) => d.size,
      sizeScale: 1,
      sizeMinPixels: 20,
      sizeMaxPixels: 40,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) {
          const ac = aircraft.get(info.object.id);
          if (ac) {
            useAircraftStore.getState().showAircraftDetails(ac);
          }
        }
      },
    });

    addLayer(layer);

    return () => {
      removeLayer("aircraft-layer");
    };
  }, [
    aircraft,
    centerAircraft,
    viewMode,
    zoomLevel,
    addLayer,
    removeLayer,
  ]);

  return null;
};

export default AircraftLayer;
