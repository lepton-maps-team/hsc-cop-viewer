import { create } from "zustand";
import { Layer } from "@deck.gl/core";

export interface LayerStore {
  layers: Layer[];
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  clearLayers: () => void;
}

export const useLayerStore = create<LayerStore>((set) => ({
  layers: [],
  addLayer: (layer) =>
    set((state) => ({
      layers: [...state.layers.filter((l) => l.id !== layer.id), layer],
    })),
  removeLayer: (layerId) =>
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== layerId),
    })),
  clearLayers: () => set({ layers: [] }),
}));

