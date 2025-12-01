import { create } from "zustand";
import { NotificationState, NotificationStore } from "../lib/types";

// Re-export for backward compatibility
export type { NotificationState };
  notification: NotificationState | null;
  setNotification: (notification: NotificationState | null) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notification: null,
  setNotification: (notification) => set({ notification }),
}));
