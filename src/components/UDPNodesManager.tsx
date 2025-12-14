import React, { useEffect, useMemo, useCallback, useState } from "react";
import { IconLayer, LineLayer, PathLayer, TextLayer } from "@deck.gl/layers";
import { useUDPStore } from "../store/useUDPStore";
import { useNotificationStore } from "../store/useNotificationStore";
import { useViewportStore } from "../store/useViewportStore";
import { useLayerStore } from "../store/useLayerStore";
import { calculateDistance } from "../lib/utils";
import { UDPDataPoint, UDPNodesManagerProps } from "../lib/types";
import RedNodeDialog from "./RedNodeDialog";
import GreenNodeDialog from "./GreenNodeDialog";

export type { UDPDataPoint, UDPNodesManagerProps };

export const calculateNodesCenter = (
  udpDataPoints: Map<number, UDPDataPoint>,
  preferredNodes?: UDPDataPoint[]
): { lat: number; lng: number } | null => {
  const nodesToUse =
    preferredNodes && preferredNodes.length > 0
      ? preferredNodes
      : Array.from(udpDataPoints.values());

  if (nodesToUse.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  nodesToUse.forEach((point) => {
    if (point.latitude !== undefined && point.longitude !== undefined) {
      sumLat += point.latitude;
      sumLng += point.longitude;
      count++;
    }
  });

  if (count === 0) return null;

  return {
    lat: sumLat / count,
    lng: sumLng / count,
  };
};

export const getNetworkMembers = (
  udpDataPoints: Map<number, UDPDataPoint>
): UDPDataPoint[] => {
  return Array.from(udpDataPoints.values()).filter(
    (point) =>
      point.callsign !== undefined ||
      point.internalData !== undefined ||
      point.regionalData !== undefined ||
      point.battleGroupData !== undefined
  );
};

const UDPNodesManager: React.FC<UDPNodesManagerProps> = () => {
  const {
    udpDataPoints,
    hasInitialCentering,
    lockedNodeIds,
    threatLockStatus,
    dialogOpenForNodeId,
    setUdpDataPoints,
    setHasInitialCentering,
    setDialogOpenForNodeId,
    addLockedNodeId,
  } = useUDPStore();
  const { setNotification } = useNotificationStore();
  const { updateCenter, getZoom, viewState } = useViewportStore();
  const { addLayer, removeLayer } = useLayerStore();
  const [clickedNode, setClickedNode] = useState<{
    node: UDPDataPoint;
    position: { x: number; y: number };
  } | null>(null);

  const getCenterGreenNode = useCallback((): UDPDataPoint | null => {
    const allNodes = Array.from(udpDataPoints.values());
    if (allNodes.length === 0) return null;

    const greenNodes = allNodes.filter((point) => point.opcode === 101);
    if (greenNodes.length === 0) return null;

    const allNodesCenter = calculateNodesCenter(udpDataPoints, allNodes);
    if (!allNodesCenter) return greenNodes[0];

    let minDistance = Infinity;
    let centerGreenNode: UDPDataPoint | null = null;

    greenNodes.forEach((node) => {
      const distance = calculateDistance(
        allNodesCenter.lat,
        allNodesCenter.lng,
        node.latitude,
        node.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        centerGreenNode = node;
      }
    });

    return centerGreenNode || greenNodes[0];
  }, [udpDataPoints]);

  const centerMapOnNodes = useCallback(() => {
    const allNodes = Array.from(udpDataPoints.values());
    if (allNodes.length === 0) return;

    const motherAircraft = allNodes.find(
      (node) => node.internalData && node.internalData.isMotherAc === 1
    );

    if (motherAircraft) {
      const currentZoom = getZoom();
      if (!hasInitialCentering) {
        const targetZoom = Math.min(13, Math.max(7, currentZoom));
        updateCenter(
          motherAircraft.latitude,
          motherAircraft.longitude,
          targetZoom
        );
        setHasInitialCentering(true);
      } else {
        updateCenter(
          motherAircraft.latitude,
          motherAircraft.longitude,
          currentZoom
        );
      }
      return;
    }

    const centerGreenNode = getCenterGreenNode();
    const currentZoom = getZoom();

    if (!centerGreenNode) {
      const nodesCenter = calculateNodesCenter(udpDataPoints, allNodes);
      if (!nodesCenter) return;

      if (!hasInitialCentering) {
        const targetZoom = Math.min(13, Math.max(7, currentZoom));
        updateCenter(nodesCenter.lat, nodesCenter.lng, targetZoom);
        setHasInitialCentering(true);
      } else {
        updateCenter(nodesCenter.lat, nodesCenter.lng, currentZoom);
      }
      return;
    }

    if (!hasInitialCentering) {
      const targetZoom = Math.min(13, Math.max(7, currentZoom));
      updateCenter(
        centerGreenNode.latitude,
        centerGreenNode.longitude,
        targetZoom
      );
      setHasInitialCentering(true);
    } else {
      updateCenter(
        centerGreenNode.latitude,
        centerGreenNode.longitude,
        currentZoom
      );
    }
  }, [
    udpDataPoints,
    hasInitialCentering,
    getCenterGreenNode,
    setHasInitialCentering,
    updateCenter,
    getZoom,
  ]);

  // Prepare UDP nodes data for IconLayer
  const udpNodesData = useMemo(() => {
    return Array.from(udpDataPoints.values()).map((point) => {
      const isLocked = lockedNodeIds.has(point.globalId);
      const isThreatLocked =
        point.opcode === 104 && threatLockStatus.get(point.globalId) === true;
      const useLockedIcon = isLocked || isThreatLocked;
      const isMotherAc =
        point.internalData && point.internalData.isMotherAc === 1;

      let iconFile: string;
      if (isMotherAc) {
        iconFile = "mother-aircraft.svg";
      } else if (point.opcode === 104) {
        iconFile = "hostile_aircraft.svg";
      } else {
        iconFile = "friendly_aircraft.svg";
      }

      let glowColor: [number, number, number, number];
      if (useLockedIcon) {
        glowColor = [255, 170, 0, 255];
      } else if (isMotherAc) {
        glowColor = [255, 170, 0, 255];
      } else if (point.opcode === 104) {
        glowColor = [255, 0, 0, 255];
      } else {
        glowColor = [0, 255, 0, 255];
      }

      return {
        position: [point.longitude, point.latitude] as [number, number],
        icon: iconFile,
        color: glowColor,
        globalId: point.globalId,
        opcode: point.opcode,
        point,
        isClickable: point.opcode === 104 || point.opcode === 101,
      };
    });
  }, [udpDataPoints, lockedNodeIds, threatLockStatus]);

  // Prepare connection lines data
  const connectionLinesData = useMemo(() => {
    const lines: Array<{
      sourcePosition: [number, number];
      targetPosition: [number, number];
      distance: number;
      color: [number, number, number, number];
      isFriendlyToEnemy: boolean;
    }> = [];

    const friendlyNodes: UDPDataPoint[] = [];
    const enemyNodes: UDPDataPoint[] = [];

    udpDataPoints.forEach((point) => {
      if (point.opcode === 101) {
        friendlyNodes.push(point);
      } else if (point.opcode === 104) {
        enemyNodes.push(point);
      }
    });

    // Lines between friendly nodes
    if (friendlyNodes.length > 1) {
      for (let i = 0; i < friendlyNodes.length; i++) {
        for (let j = i + 1; j < friendlyNodes.length; j++) {
          const node1 = friendlyNodes[i];
          const node2 = friendlyNodes[j];

          const distanceNM = calculateDistance(
            node1.latitude,
            node1.longitude,
            node2.latitude,
            node2.longitude
          );

          lines.push({
            sourcePosition: [node1.longitude, node1.latitude],
            targetPosition: [node2.longitude, node2.latitude],
            distance: distanceNM,
            color: [0, 255, 0, 200],
            isFriendlyToEnemy: false,
          });
        }
      }
    }

    // Lines between friendly and enemy nodes
    if (friendlyNodes.length > 0 && enemyNodes.length > 0) {
      friendlyNodes.forEach((friendly) => {
        enemyNodes.forEach((enemy) => {
          const distanceNM = calculateDistance(
            friendly.latitude,
            friendly.longitude,
            enemy.latitude,
            enemy.longitude
          );

          lines.push({
            sourcePosition: [friendly.longitude, friendly.latitude],
            targetPosition: [enemy.longitude, enemy.latitude],
            distance: distanceNM,
            color: [255, 136, 0, 230],
            isFriendlyToEnemy: true,
          });
        });
      });
    }

    return lines;
  }, [udpDataPoints]);

  // Prepare radar circles data
  const radarCirclesData = useMemo(() => {
    const allNodes = Array.from(udpDataPoints.values());
    if (allNodes.length === 0) return [];

    const centerGreenNode = getCenterGreenNode();
    let maxDistanceNM = 0;

    if (!centerGreenNode) {
      const nodesCenter = calculateNodesCenter(udpDataPoints, allNodes);
      if (!nodesCenter) return [];

      allNodes.forEach((node) => {
        const distance = calculateDistance(
          nodesCenter.lat,
          nodesCenter.lng,
          node.latitude,
          node.longitude
        );
        maxDistanceNM = Math.max(maxDistanceNM, distance);
      });
    } else {
      allNodes.forEach((node) => {
        const distance = calculateDistance(
          centerGreenNode.latitude,
          centerGreenNode.longitude,
          node.latitude,
          node.longitude
        );
        maxDistanceNM = Math.max(maxDistanceNM, distance);
      });
    }

    const minRangeNM = 10;
    const bufferFactor = 1.5;
    const adaptiveRangeNM = Math.max(minRangeNM, maxDistanceNM * bufferFactor);

    const center = centerGreenNode
      ? { lat: centerGreenNode.latitude, lng: centerGreenNode.longitude }
      : calculateNodesCenter(udpDataPoints, allNodes);
    if (!center) return [];

    let circleRanges: number[] = [];
    if (centerGreenNode?.circleRanges) {
      const ranges = centerGreenNode.circleRanges;
      if (ranges.D1 !== undefined && ranges.D1 !== 0)
        circleRanges.push(ranges.D1);
      if (ranges.D2 !== undefined && ranges.D2 !== 0)
        circleRanges.push(ranges.D2);
      if (ranges.D3 !== undefined && ranges.D3 !== 0)
        circleRanges.push(ranges.D3);
      if (ranges.D4 !== undefined && ranges.D4 !== 0)
        circleRanges.push(ranges.D4);
      if (ranges.D5 !== undefined && ranges.D5 !== 0)
        circleRanges.push(ranges.D5);
      if (ranges.D6 !== undefined && ranges.D6 !== 0)
        circleRanges.push(ranges.D6);
    }

    const numCircles = circleRanges.length > 0 ? circleRanges.length : 3;
    const useOpcodeRanges = circleRanges.length > 0;

    const circles: Array<{
      path: Array<[number, number]>;
      range: number;
    }> = [];

    for (let i = 0; i < numCircles; i++) {
      let rangeNM: number;
      if (useOpcodeRanges) {
        rangeNM = circleRanges[i];
      } else {
        rangeNM = ((i + 1) * adaptiveRangeNM) / numCircles;
      }

      // Convert NM to degrees (approximate: 1 NM ≈ 0.0167 degrees at equator)
      const radiusDeg =
        (rangeNM * 0.0167) / Math.cos((center.lat * Math.PI) / 180);

      const path: Array<[number, number]> = [];
      const steps = 64;
      for (let j = 0; j <= steps; j++) {
        const angle = (j / steps) * 2 * Math.PI;
        const lat = center.lat + radiusDeg * Math.cos(angle);
        const lng = center.lng + radiusDeg * Math.sin(angle);
        path.push([lng, lat]);
      }

      circles.push({ path, range: rangeNM });
    }

    return circles;
  }, [udpDataPoints, getCenterGreenNode]);

  // Create and update UDP nodes layer
  useEffect(() => {
    if (udpNodesData.length === 0) {
      removeLayer("udp-nodes");
      return;
    }

    const layer = new IconLayer({
      id: "udp-nodes",
      data: udpNodesData,
      getIcon: (d: any) => ({
        url: `icons/${d.icon}`,
        width: 24,
        height: 24,
      }),
      getPosition: (d: any) => d.position,
      getColor: (d: any) => d.color,
      getSize: 24,
      sizeScale: 1,
      sizeMinPixels: 20,
      sizeMaxPixels: 30,
      pickable: true,
      onClick: (info: any) => {
        if (info.object && info.object.isClickable) {
          const screenPoint = {
            x: info.x || window.innerWidth / 2,
            y: info.y || window.innerHeight / 2,
          };
          setClickedNode({ node: info.object.point, position: screenPoint });
          setDialogOpenForNodeId(info.object.globalId);
        }
      },
    });

    addLayer(layer);

    return () => {
      removeLayer("udp-nodes");
    };
  }, [udpNodesData, addLayer, removeLayer, setDialogOpenForNodeId]);

  // Create and update connection lines layer
  useEffect(() => {
    if (connectionLinesData.length === 0) {
      removeLayer("udp-connection-lines");
      removeLayer("udp-connection-labels");
      return;
    }

    const lineLayer = new LineLayer({
      id: "udp-connection-lines",
      data: connectionLinesData,
      getSourcePosition: (d: any) => d.sourcePosition,
      getTargetPosition: (d: any) => d.targetPosition,
      getColor: (d: any) => d.color,
      getWidth: (d: any) => (d.isFriendlyToEnemy ? 3 : 4),
      widthMinPixels: 2,
      widthMaxPixels: 4,
      pickable: false,
    });

    const labelData = connectionLinesData.map((line) => {
      const midLng = (line.sourcePosition[0] + line.targetPosition[0]) / 2;
      const midLat = (line.sourcePosition[1] + line.targetPosition[1]) / 2;
      return {
        position: [midLng, midLat] as [number, number],
        text: `${line.distance.toFixed(1)} NM`,
      };
    });

    const labelLayer = new TextLayer({
      id: "udp-connection-labels",
      data: labelData,
      getPosition: (d: any) => d.position,
      getText: (d: any) => d.text,
      getColor: [255, 255, 255, 255],
      getSize: 12,
      getAngle: 0,
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      fontFamily: "monospace",
      fontWeight: "bold",
      outlineWidth: 2,
      outlineColor: [0, 0, 0, 255],
      sizeScale: 1,
      sizeMinPixels: 10,
      sizeMaxPixels: 14,
    });

    addLayer(lineLayer);
    addLayer(labelLayer);

    return () => {
      removeLayer("udp-connection-lines");
      removeLayer("udp-connection-labels");
    };
  }, [connectionLinesData, addLayer, removeLayer]);

  // Create and update radar circles layer
  useEffect(() => {
    if (radarCirclesData.length === 0) {
      removeLayer("udp-radar-circles");
      removeLayer("udp-radar-labels");
      return;
    }

    const circleLayer = new PathLayer({
      id: "udp-radar-circles",
      data: radarCirclesData,
      getPath: (d: any) => d.path,
      getColor: [0, 255, 0, 180],
      getWidth: 2,
      widthMinPixels: 1,
      widthMaxPixels: 2,
      pickable: false,
    });

    const labelData = radarCirclesData.map((circle, i) => {
      const firstPoint = circle.path[0];
      const angle = Math.PI / 4; // 45 degrees
      const rangeNM = circle.range;
      const radiusDeg =
        (rangeNM * 0.0167) / Math.cos((firstPoint[1] * Math.PI) / 180);
      const labelLng = firstPoint[0] + radiusDeg * Math.cos(angle);
      const labelLat = firstPoint[1] + radiusDeg * Math.sin(angle);

      return {
        position: [labelLng, labelLat] as [number, number],
        text: `${Math.round(rangeNM)}NM`,
      };
    });

    const labelLayer = new TextLayer({
      id: "udp-radar-labels",
      data: labelData,
      getPosition: (d: any) => d.position,
      getText: (d: any) => d.text,
      getColor: [0, 255, 0, 255],
      getSize: 10,
      getAngle: 0,
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      fontFamily: "monospace",
      outlineWidth: 1,
      outlineColor: [0, 0, 0, 255],
      sizeScale: 1,
      sizeMinPixels: 8,
      sizeMaxPixels: 12,
    });

    addLayer(circleLayer);
    addLayer(labelLayer);

    return () => {
      removeLayer("udp-radar-circles");
      removeLayer("udp-radar-labels");
    };
  }, [radarCirclesData, addLayer, removeLayer]);

  // Center map on nodes when data changes
  useEffect(() => {
    if (udpDataPoints.size > 0 && !hasInitialCentering) {
      centerMapOnNodes();
    }
  }, [udpDataPoints.size, hasInitialCentering, centerMapOnNodes]);

  const handleCloseDialog = useCallback(() => {
    setClickedNode(null);
    setDialogOpenForNodeId(null);
  }, [setDialogOpenForNodeId]);

  return (
    <>
      {clickedNode && clickedNode.node.opcode === 104 && (
        <RedNodeDialog
          node={clickedNode.node}
          position={clickedNode.position}
          onClose={handleCloseDialog}
        />
      )}
      {clickedNode && clickedNode.node.opcode === 101 && (
        <GreenNodeDialog
          node={clickedNode.node}
          position={clickedNode.position}
          onClose={handleCloseDialog}
        />
      )}
    </>
  );
};

export default UDPNodesManager;
