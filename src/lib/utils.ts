import { Aircraft } from "./types";

export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const convertToCartesian = (
  deltaLat: number,
  deltaLng: number,
  zoom: number
): { x: number; y: number } => {
  const scale = 100;
  const rawX = deltaLng * scale;
  const rawY = -deltaLat * scale;
  const zoomedX = rawX * zoom;
  const zoomedY = rawY * zoom;
  return { x: zoomedX, y: zoomedY };
};

export const getNearestThreats = (
  centerAircraft: Aircraft,
  aircraft: Map<string, Aircraft>,
  maxThreats: number = 3
): Array<{
  aircraft: Aircraft;
  distance: number;
  distanceNM: number;
}> => {
  const threats: Array<{
    aircraft: Aircraft;
    distance: number;
    distanceNM: number;
  }> = [];
  aircraft.forEach((aircraftItem, id) => {
    if (aircraftItem.aircraftType === "threat") {
      const distance = calculateDistance(
        centerAircraft.lat,
        centerAircraft.lng,
        aircraftItem.lat,
        aircraftItem.lng
      );
      threats.push({
        aircraft: aircraftItem,
        distance,
        distanceNM: distance,
      });
    }
  });
  return threats.sort((a, b) => a.distance - b.distance).slice(0, maxThreats);
};
