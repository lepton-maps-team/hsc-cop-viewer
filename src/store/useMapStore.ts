import { create } from "zustand";
import { MapManagerInstance, MapStore } from "../lib/types";
import { convertToCartesian } from "../lib/utils";

// Store mapManager in globalThis (already declared in map.tsx)
// No need to redeclare here since it's already in map.tsx
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
