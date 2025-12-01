import { create } from "zustand";
import { UDPDataPoint } from "../components/UDPNodesManager";
import { EngagementData } from "../components/EngagementManager";
import { GeoMessageData } from "../components/GeoMessageManager";
import { useNotificationStore } from "./useNotificationStore";

interface UDPStore {
  networkMembers: UDPDataPoint[];
  engagements: EngagementData[];
  geoMessages: GeoMessageData[];
  udpDataPoints: Map<number, UDPDataPoint>;
  hasInitialCentering: boolean;
  lockedNodeIds: Set<number>;
  threatLockStatus: Map<number, boolean>;
  dialogOpenForNodeId: number | null;
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
}

export const useUDPStore = create<UDPStore>((set, get) => ({
  networkMembers: [],
  engagements: [],
  geoMessages: [],
  udpDataPoints: new Map(),
  hasInitialCentering: false,
  lockedNodeIds: new Set(),
  threatLockStatus: new Map(),
  dialogOpenForNodeId: null,
  setNetworkMembers: (members) => set({ networkMembers: members }),
  setEngagements: (engagements) => set({ engagements }),
  setGeoMessages: (messages) => set({ geoMessages: messages }),
  setUdpDataPoints: (points) => set({ udpDataPoints: points }),
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
