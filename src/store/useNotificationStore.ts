import { create } from "zustand";

export interface NotificationState {
  message: string;
  subMessage: string;
  type: "lock" | "execute";
}

interface NotificationStore {
  notification: NotificationState | null;
  setNotification: (notification: NotificationState | null) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notification: null,
  setNotification: (notification) => set({ notification }),
}));
