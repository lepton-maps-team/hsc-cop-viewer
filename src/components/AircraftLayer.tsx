import React, { useMemo } from "react";
import { useAircraftStore } from "../store/useAircraftStore";
import { useUIStore } from "../store/useUIStore";
import { useMapStore } from "../store/useMapStore";
import { Aircraft } from "../lib/types";
import AircraftMarker from "./AircraftMarker";

const AircraftLayer: React.FC = () => {
  const { aircraft, nodeId } = useAircraftStore();
  const { viewMode, zoomLevel, centerMode } = useUIStore();
  const { convertToCartesian } = useMapStore();

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

  if (!centerAircraft) return null;

  const aircraftArray: Array<{
    id: string;
    aircraft: Aircraft;
    position?: { x: number; y: number };
  }> = [];

  // Add center aircraft
  aircraftArray.push({
    id: centerAircraft.id,
    aircraft: centerAircraft,
  });

  // Add other aircraft
  aircraft.forEach((aircraftItem, id) => {
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
    const x = cartesianCoords.x + 50;
    const y = cartesianCoords.y + 50;

    aircraftArray.push({
      id,
      aircraft: aircraftItem,
      position: { x, y },
    });
  });

  return (
    <>
      {aircraftArray.map(({ id, aircraft: aircraftItem, position }) => (
        <AircraftMarker
          key={id}
          aircraft={aircraftItem}
          isCenter={id === centerAircraft.id}
          position={position}
        />
      ))}
    </>
  );
};

export default AircraftLayer;
