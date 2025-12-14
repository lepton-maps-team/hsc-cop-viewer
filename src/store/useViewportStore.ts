import { create } from "zustand";
import { ViewState } from "../lib/types";

export interface ViewportStore {
  viewState: ViewState;
  setViewState: (viewState: ViewState) => void;
  updateCenter: (lat: number, lng: number, zoom?: number) => void;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  setZoom: (zoom: number) => void;
}

export const useViewportStore = create<ViewportStore>((set, get) => ({
  viewState: {
    longitude: 78.9629,
    latitude: 20.5937,
    zoom: 7,
    pitch: 0,
    bearing: 0,
  },
  setViewState: (viewState) => set({ viewState }),
  updateCenter: (lat, lng, zoom) => {
    set((state) => ({
      viewState: {
        ...state.viewState,
        latitude: lat,
        longitude: lng,
        ...(zoom !== undefined && { zoom }),
      },
    }));
  },
  getCenter: () => {
    const { viewState } = get();
    return { lat: viewState.latitude, lng: viewState.longitude };
  },
  getZoom: () => {
    return get().viewState.zoom;
  },
  setZoom: (zoom) => {
    set((state) => ({
      viewState: { ...state.viewState, zoom },
    }));
  },
}));

