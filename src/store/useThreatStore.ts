import { create } from "zustand";
import { Aircraft } from "../types";
import { useAircraftStore } from "./useAircraftStore";
import { useNotificationStore } from "./useNotificationStore";

interface ThreatStore {
  lockThreat: (aircraft: Aircraft) => void;
  executeThreat: (aircraft: Aircraft) => void;
}

export const useThreatStore = create<ThreatStore>(() => ({
  lockThreat: (aircraft) => {
    aircraft.isLocked = true;
    const newAircraft = new Map(useAircraftStore.getState().aircraft);
    newAircraft.set(aircraft.id, aircraft);
    useAircraftStore.setState({ aircraft: newAircraft });
    useNotificationStore.setState({
      notification: {
        message: "🎯 TARGET LOCKED",
        subMessage: aircraft.callSign,
        type: "lock",
      },
    });
    setTimeout(
      () => useNotificationStore.setState({ notification: null }),
      2000
    );
  },
  executeThreat: (aircraft) => {
    const newAircraft = new Map(useAircraftStore.getState().aircraft);
    newAircraft.delete(aircraft.id);
    useAircraftStore.setState({ aircraft: newAircraft });
    useNotificationStore.setState({
      notification: {
        message: "💥 TARGET ELIMINATED",
        subMessage: aircraft.callSign,
        type: "execute",
      },
    });
    setTimeout(
      () => useNotificationStore.setState({ notification: null }),
      2000
    );
  },
}));
