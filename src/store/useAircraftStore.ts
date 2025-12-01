import { create } from "zustand";
import { Aircraft, AircraftStore } from "../lib/types";
  aircraft: Map<string, Aircraft>;
  nodeId: string;
  selectedAircraft: Aircraft | null;
  setAircraft: (aircraft: Map<string, Aircraft>) => void;
  updateAircraft: (id: string, aircraft: Aircraft) => void;
  deleteAircraft: (id: string) => void;
  setSelectedAircraft: (aircraft: Aircraft | null) => void;
  showAircraftDetails: (aircraft: Aircraft) => void;
}

export const useAircraftStore = create<AircraftStore>((set, get) => ({
  aircraft: new Map(),
  nodeId: Math.random().toString(36).substr(2, 9),
  selectedAircraft: null,
  setAircraft: (aircraft) => set({ aircraft }),
  updateAircraft: (id, aircraft) => {
    const newAircraft = new Map(get().aircraft);
    newAircraft.set(id, aircraft);
    set({ aircraft: newAircraft });
  },
  deleteAircraft: (id) => {
    const newAircraft = new Map(get().aircraft);
    newAircraft.delete(id);
    set({ aircraft: newAircraft });
  },
  setSelectedAircraft: (aircraft) => set({ selectedAircraft: aircraft }),
  showAircraftDetails: (aircraft) => set({ selectedAircraft: aircraft }),
}));
