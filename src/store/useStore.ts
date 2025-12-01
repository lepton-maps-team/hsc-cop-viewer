import { create } from "zustand";
import { Aircraft } from "../types";
import { UDPDataPoint } from "../components/UDPNodesManager";
import { EngagementData } from "../components/EngagementManager";
import { GeoMessageData } from "../components/GeoMessageManager";
import { MapManagerInstance } from "../components/MapManager";
import { convertToCartesian } from "../lib/utils";

// Store mapManager in globalThis
declare global {
  interface Window {
    mapManager: MapManagerInstance | null;
  }
}

interface NotificationState {
  message: string;
  subMessage: string;
  type: "lock" | "execute";
}

interface AppStore {
  // State
  aircraft: Map<string, Aircraft>;
  nodeId: string;
  zoomLevel: number;
  showOtherNodes: boolean;
  centerMode: "mother" | "self";
  viewMode: "normal" | "self-only";
  showThreatDialog: boolean;
  selectedAircraft: Aircraft | null;
  notification: NotificationState | null;
  networkMembers: UDPDataPoint[];
  engagements: EngagementData[];
  geoMessages: GeoMessageData[];
  udpDataPoints: Map<number, UDPDataPoint>;
  hasInitialCentering: boolean;
  lockedNodeIds: Set<number>;
  threatLockStatus: Map<number, boolean>;
  dialogOpenForNodeId: number | null;

  // Actions
  setAircraft: (aircraft: Map<string, Aircraft>) => void;
  updateAircraft: (id: string, aircraft: Aircraft) => void;
  deleteAircraft: (id: string) => void;
  setZoomLevel: (level: number) => void;
  setShowOtherNodes: (show: boolean) => void;
  setCenterMode: (mode: "mother" | "self") => void;
  setViewMode: (mode: "normal" | "self-only") => void;
  setShowThreatDialog: (show: boolean) => void;
  setSelectedAircraft: (aircraft: Aircraft | null) => void;
  setNotification: (notification: NotificationState | null) => void;
  setNetworkMembers: (members: UDPDataPoint[]) => void;
  setEngagements: (engagements: EngagementData[]) => void;
  setGeoMessages: (messages: GeoMessageData[]) => void;
  setUdpDataPoints: (points: Map<number, UDPDataPoint>) => void;
  setHasInitialCentering: (has: boolean) => void;
  setLockedNodeIds: (ids: Set<number>) => void;
  addLockedNodeId: (id: number) => void;
  removeLockedNodeId: (id: number) => void;
  setThreatLockStatus: (threatId: number, isLocked: boolean) => void;
  setDialogOpenForNodeId: (nodeId: number | null) => void;
  processUDPData: (data: UDPDataPoint[]) => void;
  lockThreat: (aircraft: Aircraft) => void;
  executeThreat: (aircraft: Aircraft) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleCenterMode: () => void;
  toggleShowOtherNodes: () => void;
  toggleShowThreatDialog: () => void;
  showAircraftDetails: (aircraft: Aircraft) => void;
  toggleMapVisibility: () => void;
  convertToCartesian: (
    deltaLat: number,
    deltaLng: number,
    zoom: number
  ) => { x: number; y: number };
  getMapManager: () => MapManagerInstance | null;
}

export const useStore = create<AppStore>((set, get) => ({
  // Initial state
  aircraft: new Map(),
  nodeId: Math.random().toString(36).substr(2, 9),
  zoomLevel: 5,
  showOtherNodes: true,
  centerMode: "mother",
  viewMode: "normal",
  showThreatDialog: true,
  selectedAircraft: null,
  notification: null,
  networkMembers: [],
  engagements: [],
  geoMessages: [],
  udpDataPoints: new Map(),
  hasInitialCentering: false,
  lockedNodeIds: new Set(),
  threatLockStatus: new Map(),
  dialogOpenForNodeId: null,

  // Actions
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
  setZoomLevel: (level) => set({ zoomLevel: level }),
  setShowOtherNodes: (show) => set({ showOtherNodes: show }),
  setCenterMode: (mode) => set({ centerMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setShowThreatDialog: (show) => set({ showThreatDialog: show }),
  setSelectedAircraft: (aircraft) => set({ selectedAircraft: aircraft }),
  setNotification: (notification) => set({ notification }),
  setNetworkMembers: (members) => set({ networkMembers: members }),
  setEngagements: (engagements) => set({ engagements }),
  setGeoMessages: (messages) => set({ geoMessages: messages }),
  setUdpDataPoints: (points) => set({ udpDataPoints: points }),
  lockThreat: (aircraft) => {
    aircraft.isLocked = true;
    const newAircraft = new Map(get().aircraft);
    newAircraft.set(aircraft.id, aircraft);
    set({
      aircraft: newAircraft,
      notification: {
        message: "🎯 TARGET LOCKED",
        subMessage: aircraft.callSign,
        type: "lock",
      },
    });
    setTimeout(() => set({ notification: null }), 2000);
  },
  executeThreat: (aircraft) => {
    const newAircraft = new Map(get().aircraft);
    newAircraft.delete(aircraft.id);
    set({
      aircraft: newAircraft,
      notification: {
        message: "💥 TARGET ELIMINATED",
        subMessage: aircraft.callSign,
        type: "execute",
      },
    });
    setTimeout(() => set({ notification: null }), 2000);
  },
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
    const { centerMode, aircraft, nodeId } = get();
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
  showAircraftDetails: (aircraft) => {
    set({ selectedAircraft: aircraft });
  },
  toggleMapVisibility: () => {
    const mapManager = typeof window !== "undefined" ? window.mapManager : null;
    if (mapManager) {
      mapManager.toggleMapVisibility();
    }
  },
  convertToCartesian: (deltaLat, deltaLng, zoom) => {
    return convertToCartesian(deltaLat, deltaLng, zoom);
  },
  getMapManager: () => {
    return typeof window !== "undefined" ? window.mapManager : null;
  },
  setHasInitialCentering: (has) => set({ hasInitialCentering: has }),
  setLockedNodeIds: (ids) => set({ lockedNodeIds: ids }),
  addLockedNodeId: (id) => {
    const newSet = new Set(get().lockedNodeIds);
    newSet.add(id);
    set({ lockedNodeIds: newSet });
  },
  removeLockedNodeId: (id) => {
    const newSet = new Set(get().lockedNodeIds);
    newSet.delete(id);
    set({ lockedNodeIds: newSet });
  },
  setThreatLockStatus: (threatId, isLocked) => {
    const newMap = new Map(get().threatLockStatus);
    newMap.set(threatId, isLocked);
    set({ threatLockStatus: newMap });
  },
  setDialogOpenForNodeId: (nodeId) => set({ dialogOpenForNodeId: nodeId }),
  processUDPData: (data) => {
    if (!Array.isArray(data)) return;

    const currentPoints = new Map(get().udpDataPoints);
    const currentThreatStatus = new Map(get().threatLockStatus);

    // First, process opcode 106 (threat lock data) separately
    const threatLockData = data.filter((point) => point.opcode === 106);
    threatLockData.forEach((threatPoint) => {
      if (threatPoint.threatId !== undefined) {
        const isLocked = threatPoint.isLockOn === 1;
        currentThreatStatus.set(threatPoint.threatId, isLocked);
        console.log(
          `🔒 Threat ${threatPoint.threatId} lock status updated: ${isLocked ? "LOCKED" : "UNLOCKED"}`
        );
      }
    });

    // Update or add data points
    data.forEach((point) => {
      if (point.globalId !== undefined) {
        // For opcode 102 (network member data), merge with existing node if it exists
        if (point.opcode === 102) {
          const existingNode = currentPoints.get(point.globalId);
          if (existingNode) {
            // Merge opcode 102 data with existing node (preserve position from opcode 101)
            const mergedNode = {
              ...existingNode,
              ...point,
              latitude: existingNode.latitude,
              longitude: existingNode.longitude,
              altitude:
                point.altitude !== undefined
                  ? point.altitude
                  : existingNode.altitude,
              callsign: point.callsign || existingNode.callsign,
              internalData: point.internalData
                ? {
                    ...existingNode.internalData,
                    ...point.internalData,
                  }
                : existingNode.internalData,
              regionalData: point.regionalData
                ? {
                    ...existingNode.regionalData,
                    ...point.regionalData,
                    metadata: {
                      ...existingNode.regionalData?.metadata,
                      ...point.regionalData?.metadata,
                    },
                  }
                : existingNode.regionalData,
              battleGroupData: point.battleGroupData
                ? {
                    ...existingNode.battleGroupData,
                    ...point.battleGroupData,
                  }
                : existingNode.battleGroupData,
              radioData: point.radioData
                ? {
                    ...existingNode.radioData,
                    ...point.radioData,
                  }
                : existingNode.radioData,
              opcode: existingNode.opcode || 101,
            };
            currentPoints.set(point.globalId, mergedNode);
            console.log(
              `📍 Merged opcode 102 data with node ${point.globalId}: callsign=${mergedNode.callsign || "N/A"}`
            );
          } else {
            // Store it temporarily - it will be merged when opcode 101 arrives
            console.log(
              `⚠️ Opcode 102 data for globalId ${point.globalId} but no existing node found. Waiting for opcode 101 position data.`
            );
            currentPoints.set(point.globalId, {
              ...point,
              opcode: 101,
            });
          }
        } else if (
          point.latitude !== undefined &&
          point.longitude !== undefined
        ) {
          // For other opcodes (101, 104), require position data
          const existingNode = currentPoints.get(point.globalId);
          const hasOpcode102Data =
            existingNode &&
            (existingNode.callsign !== undefined ||
              existingNode.internalData !== undefined ||
              existingNode.regionalData !== undefined ||
              existingNode.battleGroupData !== undefined);

          if (hasOpcode102Data) {
            // Merge position data from opcode 101/104 with existing opcode 102 metadata
            currentPoints.set(point.globalId, {
              ...existingNode,
              ...point,
              latitude: point.latitude,
              longitude: point.longitude,
              callsign: existingNode.callsign || point.callsign,
              internalData: existingNode.internalData
                ? {
                    ...existingNode.internalData,
                    ...point.internalData,
                  }
                : point.internalData,
              regionalData: existingNode.regionalData
                ? {
                    ...existingNode.regionalData,
                    ...point.regionalData,
                    metadata: {
                      ...existingNode.regionalData?.metadata,
                      ...point.regionalData?.metadata,
                    },
                  }
                : point.regionalData,
              battleGroupData: existingNode.battleGroupData
                ? {
                    ...existingNode.battleGroupData,
                    ...point.battleGroupData,
                  }
                : point.battleGroupData,
              radioData: existingNode.radioData
                ? {
                    ...existingNode.radioData,
                    ...point.radioData,
                  }
                : point.radioData,
              opcode: point.opcode,
            });
            console.log(
              `📍 Merged position data (opcode ${point.opcode}) with opcode 102 metadata for node ${point.globalId}`
            );
          } else {
            // Normal update/add for opcodes 101, 104
            currentPoints.set(point.globalId, {
              ...point,
              latitude: point.latitude,
              longitude: point.longitude,
              opcode: point.opcode,
            });
            console.log(
              `📍 Updated node ${point.globalId} (opcode ${point.opcode}): lat=${point.latitude}, lng=${point.longitude}`
            );
          }
        }
      }
    });

    set({
      udpDataPoints: currentPoints,
      threatLockStatus: currentThreatStatus,
    });
  },
}));
