import { create } from "zustand";
import { useAircraftStore } from "./useAircraftStore";
import { UIStore } from "../lib/types";
  zoomLevel: number;
  showOtherNodes: boolean;
  centerMode: "mother" | "self";
  viewMode: "normal" | "self-only";
  showThreatDialog: boolean;
  setZoomLevel: (level: number) => void;
  setShowOtherNodes: (show: boolean) => void;
  setCenterMode: (mode: "mother" | "self") => void;
  setViewMode: (mode: "normal" | "self-only") => void;
  setShowThreatDialog: (show: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleCenterMode: () => void;
  toggleShowOtherNodes: () => void;
  toggleShowThreatDialog: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
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
