import { create } from "zustand";
import { MapStore } from "../lib/types";
import { useAircraftStore } from "./useAircraftStore";

export const useMapStore = create<MapStore>((set, get) => ({
  // UI state
  zoomLevel: 5,
  showOtherNodes: true,
  centerMode: "mother",
  viewMode: "normal",
  showThreatDialog: true,
  setZoomLevel: (level) => set({ zoomLevel: level }),
  setShowOtherNodes: (show) => set({ showOtherNodes: show }),
  setCenterMode: (mode) => set({ centerMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowThreatDialog: (show) => set({ showThreatDialog: show }),
  zoomIn: () => {
    const currentZoom = get().zoomLevel;
    const newZoom = Math.min(currentZoom + 1, 13);
    set({ zoomLevel: newZoom });
  },
  zoomOut: () => {
    const currentZoom = get().zoomLevel;
    if (currentZoom <= 1) return;
    const newZoom = Math.max(currentZoom - 1, 1);
    set({ zoomLevel: newZoom });
  },
  toggleCenterMode: () => {
    const { centerMode } = get();
    const { aircraft, nodeId } = useAircraftStore.getState();
    const newMode = centerMode === "mother" ? "self" : "mother";
    if (newMode === "self") {
      const selfAircraft = aircraft.get(nodeId);
      if (!selfAircraft) {
        console.warn(
          "⚠️ Cannot switch to self-centered mode: self aircraft not found"
        );
        return;
      }
    }
    set({ centerMode: newMode });
  },
  toggleShowOtherNodes: () => {
    set({ showOtherNodes: !get().showOtherNodes });
  },
  toggleShowThreatDialog: () => {
    set({ showThreatDialog: !get().showThreatDialog });
  },
}));
