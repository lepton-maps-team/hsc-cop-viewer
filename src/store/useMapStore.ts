import { create } from "zustand";
import { MapManagerInstance } from "../components/MapManager";
import { convertToCartesian } from "../lib/utils";

// Store mapManager in globalThis
declare global {
  interface Window {
    mapManager: MapManagerInstance | null;
  }
}

interface MapStore {
  convertToCartesian: (
    deltaLat: number,
    deltaLng: number,
    zoom: number
  ) => { x: number; y: number };
  getMapManager: () => MapManagerInstance | null;
  toggleMapVisibility: () => void;
}

export const useMapStore = create<MapStore>(() => ({
  convertToCartesian: (deltaLat, deltaLng, zoom) => {
    return convertToCartesian(deltaLat, deltaLng, zoom);
  },
  getMapManager: () => {
    return typeof window !== "undefined" ? window.mapManager : null;
  },
  toggleMapVisibility: () => {
    const mapManager = typeof window !== "undefined" ? window.mapManager : null;
    if (mapManager) {
      mapManager.toggleMapVisibility();
    }
  },
}));
