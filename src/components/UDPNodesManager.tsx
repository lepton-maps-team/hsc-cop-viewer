import React, { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { useStore } from "../store/useStore";
import { calculateDistance } from "../lib/utils";

// Type for UDP data points
export type UDPDataPoint = {
  globalId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  opcode?: number; // Track which opcode this came from (101 or 104)
  [key: string]: any; // For other fields like veIn, veIe, heading, groundSpeed, etc.
};

// Helper functions exported for use elsewhere
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

interface UDPNodesManagerProps {
  visualizationArea: HTMLElement | null;
}

const UDPNodesManager: React.FC<UDPNodesManagerProps> = ({
  visualizationArea,
}) => {
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
    getMapManager,
    setNotification,
  } = useStore();

  // Refs for DOM containers
  const udpDotsContainerRef = useRef<HTMLDivElement | null>(null);
  const connectionLinesContainerRef = useRef<HTMLDivElement | null>(null);
  const radarCirclesContainerRef = useRef<HTMLDivElement | null>(null);
  const redNodeDialogRef = useRef<HTMLElement | null>(null);

  // Initialize containers
  useEffect(() => {
    if (!visualizationArea) return;

    // Create container for UDP dots
    const udpDotsContainer = document.createElement("div");
    udpDotsContainer.id = "udp-dots-container";
    udpDotsContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 3;
    `;
    visualizationArea.appendChild(udpDotsContainer);
    udpDotsContainerRef.current = udpDotsContainer;

    // Create container for connection lines
    const connectionLinesContainer = document.createElement("div");
    connectionLinesContainer.id = "connection-lines-container";
    connectionLinesContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    `;
    visualizationArea.appendChild(connectionLinesContainer);
    connectionLinesContainerRef.current = connectionLinesContainer;

    // Create container for radar circles
    const radarCirclesContainer = document.createElement("div");
    radarCirclesContainer.id = "radar-circles-container";
    radarCirclesContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `;
    visualizationArea.appendChild(radarCirclesContainer);
    radarCirclesContainerRef.current = radarCirclesContainer;

    return () => {
      // Cleanup
      if (udpDotsContainer.parentNode) {
        udpDotsContainer.parentNode.removeChild(udpDotsContainer);
      }
      if (connectionLinesContainer.parentNode) {
        connectionLinesContainer.parentNode.removeChild(
          connectionLinesContainer
        );
      }
      if (radarCirclesContainer.parentNode) {
        radarCirclesContainer.parentNode.removeChild(radarCirclesContainer);
      }
    };
  }, [visualizationArea]);

  // Helper function to get center green node
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

  // Calculate zoom to fit nodes
  const calculateZoomToFitNodes = useCallback(
    (centerNode?: UDPDataPoint): number => {
      const mapManager = getMapManager();
      const mapboxMap = mapManager?.getMapboxMap();
      if (!mapboxMap) return 15;

      const allNodes = Array.from(udpDataPoints.values());
      if (allNodes.length === 0) return 15;

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;

      allNodes.forEach((point) => {
        if (point.latitude !== undefined && point.longitude !== undefined) {
          minLat = Math.min(minLat, point.latitude);
          maxLat = Math.max(maxLat, point.latitude);
          minLng = Math.min(minLng, point.longitude);
          maxLng = Math.max(maxLng, point.longitude);
        }
      });

      if (minLat === Infinity) return 15;

      try {
        const sw = new mapboxgl.LngLat(minLng, minLat);
        const ne = new mapboxgl.LngLat(maxLng, maxLat);
        const lngLatBounds = new mapboxgl.LngLatBounds(sw, ne);

        const viewportWidth = window.innerWidth - 60;
        const viewportHeight = window.innerHeight - 60;
        const paddingPixels = Math.min(viewportWidth, viewportHeight) * 0.15;

        const cameraOptions = mapboxMap.cameraForBounds(lngLatBounds, {
          padding: {
            top: paddingPixels,
            bottom: paddingPixels,
            left: paddingPixels,
            right: paddingPixels,
          },
          maxZoom: 13,
        });

        if (cameraOptions && cameraOptions.zoom !== undefined) {
          const targetZoom = cameraOptions.zoom - 0.5;
          return Math.max(1, Math.min(13, targetZoom));
        }
      } catch (error) {
        console.warn("Could not use fitBounds:", error);
      }

      return 15;
    },
    [udpDataPoints, getMapManager]
  );

  // Center map on nodes
  const centerMapOnNodes = useCallback(() => {
    const mapManager = getMapManager();
    if (!mapManager) return;

    const allNodes = Array.from(udpDataPoints.values());
    if (allNodes.length === 0) return;

    // Check for mother aircraft first
    const motherAircraft = allNodes.find(
      (node) => node.internalData && node.internalData.isMotherAc === 1
    );

    if (motherAircraft) {
      const mapboxMap = mapManager.getMapboxMap();
      const currentZoom = mapboxMap ? mapboxMap.getZoom() : null;

      if (!hasInitialCentering && currentZoom === null) {
        const targetZoom = calculateZoomToFitNodes(motherAircraft);
        mapManager.updateCenter(
          motherAircraft.latitude,
          motherAircraft.longitude,
          targetZoom
        );
        setHasInitialCentering(true);
      } else {
        mapManager.updateCenter(
          motherAircraft.latitude,
          motherAircraft.longitude,
          currentZoom || undefined
        );
      }
      return;
    }

    const centerGreenNode = getCenterGreenNode();
    const mapboxMap = mapManager.getMapboxMap();
    const currentZoom = mapboxMap ? mapboxMap.getZoom() : null;

    if (!centerGreenNode) {
      const nodesCenter = calculateNodesCenter(udpDataPoints, allNodes);
      if (!nodesCenter) return;

      if (!hasInitialCentering && currentZoom === null) {
        const targetZoom = calculateZoomToFitNodes();
        mapManager.updateCenter(nodesCenter.lat, nodesCenter.lng, targetZoom);
        setHasInitialCentering(true);
      } else {
        mapManager.updateCenter(
          nodesCenter.lat,
          nodesCenter.lng,
          currentZoom || undefined
        );
      }
      return;
    }

    if (!hasInitialCentering && currentZoom === null) {
      const targetZoom = calculateZoomToFitNodes(centerGreenNode);
      mapManager.updateCenter(
        centerGreenNode.latitude,
        centerGreenNode.longitude,
        targetZoom
      );
      setHasInitialCentering(true);
    } else {
      mapManager.updateCenter(
        centerGreenNode.latitude,
        centerGreenNode.longitude,
        currentZoom || undefined
      );
    }
  }, [
    udpDataPoints,
    hasInitialCentering,
    getMapManager,
    calculateZoomToFitNodes,
    getCenterGreenNode,
    setHasInitialCentering,
  ]);

  // Update UDP dots on the map
  const updateUDPDots = useCallback(() => {
    const mapManager = getMapManager();
    if (!mapManager || !udpDotsContainerRef.current) return;

    const mapboxMap = mapManager.getMapboxMap();
    if (!mapboxMap) return;

    try {
      mapboxMap.resize();
    } catch (e) {
      console.warn("Map resize failed:", e);
    }

    // Clear existing symbols
    if (udpDotsContainerRef.current) {
      udpDotsContainerRef.current.innerHTML = "";
    }

    const bounds = mapboxMap.getBounds();

    // Update dialog position if it's open
    if (redNodeDialogRef.current && dialogOpenForNodeId !== null) {
      const dialogNode = udpDataPoints.get(dialogOpenForNodeId);
      if (dialogNode) {
        const screenPoint = mapboxMap.project([
          dialogNode.longitude,
          dialogNode.latitude,
        ]);
        const container = udpDotsContainerRef.current;
        const containerRect = container?.getBoundingClientRect();
        const absoluteX = containerRect
          ? containerRect.left + screenPoint.x
          : screenPoint.x;
        const absoluteY = containerRect
          ? containerRect.top + screenPoint.y
          : screenPoint.y;
        // Update dialog position (will be implemented in dialog functions)
      } else {
        // Node no longer exists, close dialog
        if (redNodeDialogRef.current) {
          redNodeDialogRef.current.remove();
          redNodeDialogRef.current = null;
        }
        setDialogOpenForNodeId(null);
      }
    }

    // Render symbols for all stored data points
    udpDataPoints.forEach((point, globalId) => {
      const lat = point.latitude;
      const lng = point.longitude;

      if (
        lng >= bounds.getWest() &&
        lng <= bounds.getEast() &&
        lat >= bounds.getSouth() &&
        lat <= bounds.getNorth()
      ) {
        const screenPoint = mapboxMap.project([lng, lat]);

        const isLocked = lockedNodeIds.has(globalId);
        let isThreatLocked = false;
        if (point.opcode === 104) {
          isThreatLocked = threatLockStatus.get(globalId) === true;
        }

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

        let glowColor: string;
        if (useLockedIcon) {
          glowColor = "#ffaa00";
        } else if (isMotherAc) {
          glowColor = "#ffaa00";
        } else if (point.opcode === 104) {
          glowColor = "#ff0000";
        } else {
          glowColor = "#00ff00";
        }

        const iconElement = document.createElement("img");
        iconElement.src = `icons/${iconFile}`;
        iconElement.alt = `UDP node ${globalId} (opcode ${point.opcode})`;
        iconElement.className = "udp-node-icon";
        iconElement.setAttribute("data-global-id", globalId.toString());
        iconElement.setAttribute(
          "data-opcode",
          point.opcode?.toString() || "unknown"
        );

        const iconSize = 24;
        const isRedNode = point.opcode === 104;
        const isGreenNode = point.opcode === 101;

        const iconContainer = document.createElement("div");
        iconContainer.style.cssText = `
          position: absolute;
          left: ${screenPoint.x}px;
          top: ${screenPoint.y}px;
          width: ${iconSize}px;
          height: ${iconSize}px;
          transform: translate(-50%, -50%);
          pointer-events: ${isRedNode || isGreenNode ? "auto" : "none"};
          z-index: 3;
          cursor: ${isRedNode || isGreenNode ? "pointer" : "default"};
        `;

        iconElement.style.cssText = `
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 4px ${glowColor}) drop-shadow(0 0 8px ${glowColor});
          object-fit: contain;
        `;

        iconContainer.appendChild(iconElement);

        if (useLockedIcon) {
          const lockIndicator = document.createElement("div");
          lockIndicator.style.cssText = `
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            background: #ffaa00;
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            z-index: 4;
            box-shadow: 0 0 4px rgba(255, 170, 0, 0.8);
            pointer-events: none;
          `;
          lockIndicator.textContent = "🔒";
          iconContainer.appendChild(lockIndicator);
        }

        // Add click handlers
        if (isRedNode || isGreenNode) {
          iconContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            const container = udpDotsContainerRef.current;
            const containerRect = container?.getBoundingClientRect();
            const absoluteX = containerRect
              ? containerRect.left + screenPoint.x
              : screenPoint.x;
            const absoluteY = containerRect
              ? containerRect.top + screenPoint.y
              : screenPoint.y;

            if (isRedNode) {
              showRedNodeDialog(point, { x: absoluteX, y: absoluteY });
            } else {
              showGreenNodeDialog(point, { x: absoluteX, y: absoluteY });
            }
          });
        }

        if (udpDotsContainerRef.current) {
          udpDotsContainerRef.current.appendChild(iconContainer);
        }
      }
    });
  }, [
    udpDataPoints,
    lockedNodeIds,
    threatLockStatus,
    dialogOpenForNodeId,
    getMapManager,
    setDialogOpenForNodeId,
  ]);

  // Update connection lines
  const updateConnectionLines = useCallback(() => {
    const mapManager = getMapManager();
    if (!mapManager || !connectionLinesContainerRef.current) return;

    const mapboxMap = mapManager.getMapboxMap();
    if (!mapboxMap) return;

    try {
      mapboxMap.resize();
    } catch (e) {
      console.warn("Map resize failed:", e);
    }

    if (connectionLinesContainerRef.current) {
      connectionLinesContainerRef.current.innerHTML = "";
    }

    const friendlyNodes: UDPDataPoint[] = [];
    const enemyNodes: UDPDataPoint[] = [];

    udpDataPoints.forEach((point) => {
      if (point.opcode === 101) {
        friendlyNodes.push(point);
      } else if (point.opcode === 104) {
        enemyNodes.push(point);
      }
    });

    const bounds = mapboxMap.getBounds();

    // Draw lines between green nodes
    if (friendlyNodes.length > 1) {
      for (let i = 0; i < friendlyNodes.length; i++) {
        for (let j = i + 1; j < friendlyNodes.length; j++) {
          const node1 = friendlyNodes[i];
          const node2 = friendlyNodes[j];

          const point1 = mapboxMap.project([node1.longitude, node1.latitude]);
          const point2 = mapboxMap.project([node2.longitude, node2.latitude]);

          const node1Visible =
            node1.longitude >= bounds.getWest() &&
            node1.longitude <= bounds.getEast() &&
            node1.latitude >= bounds.getSouth() &&
            node1.latitude <= bounds.getNorth();
          const node2Visible =
            node2.longitude >= bounds.getWest() &&
            node2.longitude <= bounds.getEast() &&
            node2.latitude >= bounds.getSouth() &&
            node2.latitude <= bounds.getNorth();

          if (node1Visible || node2Visible) {
            const distanceNM = calculateDistance(
              node1.latitude,
              node1.longitude,
              node2.latitude,
              node2.longitude
            );

            const dx = point2.x - point1.x;
            const dy = point2.y - point1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

            const line = document.createElement("div");
            line.style.cssText = `
              position: absolute;
              left: ${point1.x}px;
              top: ${point1.y}px;
              width: ${length}px;
              height: 4px;
              background-image: repeating-linear-gradient(
                to right,
                #00ff00 0px,
                #00ff00 12px,
                transparent 12px,
                transparent 24px
              );
              background-color: rgba(0, 255, 0, 0.3);
              opacity: 1;
              transform-origin: 0 50%;
              transform: rotate(${angle}deg);
              pointer-events: none;
              z-index: 2;
              box-shadow: 0 0 4px rgba(0, 255, 0, 1), 0 0 8px rgba(0, 255, 0, 0.6);
            `;

            if (connectionLinesContainerRef.current) {
              connectionLinesContainerRef.current.appendChild(line);
            }

            const midX = (point1.x + point2.x) / 2;
            const midY = (point1.y + point2.y) / 2;

            const text = document.createElement("div");
            text.style.cssText = `
              position: absolute;
              left: ${midX}px;
              top: ${midY - 20}px;
              transform: translateX(-50%);
              color: #ffffff;
              font-size: 14px;
              font-weight: bold;
              font-family: monospace;
              pointer-events: none;
              text-align: center;
              white-space: nowrap;
              text-shadow: 
                0 0 6px rgba(0, 0, 0, 1),
                0 0 10px rgba(0, 0, 0, 0.9),
                0 0 14px rgba(0, 0, 0, 0.8),
                0 2px 4px rgba(0, 0, 0, 1),
                2px 2px 4px rgba(0, 0, 0, 1),
                -2px 2px 4px rgba(0, 0, 0, 1),
                2px -2px 4px rgba(0, 0, 0, 1),
                -2px -2px 4px rgba(0, 0, 0, 1);
              letter-spacing: 0.5px;
            `;
            text.textContent = `${distanceNM.toFixed(1)} NM`;

            if (connectionLinesContainerRef.current) {
              connectionLinesContainerRef.current.appendChild(text);
            }
          }
        }
      }
    }

    // Draw lines between friendly and enemy nodes
    if (friendlyNodes.length > 0 && enemyNodes.length > 0) {
      friendlyNodes.forEach((friendly) => {
        enemyNodes.forEach((enemy) => {
          if (
            friendly.longitude >= bounds.getWest() &&
            friendly.longitude <= bounds.getEast() &&
            friendly.latitude >= bounds.getSouth() &&
            friendly.latitude <= bounds.getNorth() &&
            enemy.longitude >= bounds.getWest() &&
            enemy.longitude <= bounds.getEast() &&
            enemy.latitude >= bounds.getSouth() &&
            enemy.latitude <= bounds.getNorth()
          ) {
            const friendlyPoint = mapboxMap.project([
              friendly.longitude,
              friendly.latitude,
            ]);
            const enemyPoint = mapboxMap.project([
              enemy.longitude,
              enemy.latitude,
            ]);

            const distanceNM = calculateDistance(
              friendly.latitude,
              friendly.longitude,
              enemy.latitude,
              enemy.longitude
            );

            const dx = enemyPoint.x - friendlyPoint.x;
            const dy = enemyPoint.y - friendlyPoint.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

            const line = document.createElement("div");
            line.style.cssText = `
              position: absolute;
              left: ${friendlyPoint.x}px;
              top: ${friendlyPoint.y}px;
              width: ${length}px;
              height: 3px;
              background-image: repeating-linear-gradient(
                to right,
                #ff8800 0px,
                #ff8800 10px,
                transparent 10px,
                transparent 20px
              );
              opacity: 0.9;
              transform-origin: 0 50%;
              transform: rotate(${angle}deg);
              pointer-events: none;
              z-index: 2;
              box-shadow: 0 0 3px rgba(255, 136, 0, 0.9);
            `;

            if (connectionLinesContainerRef.current) {
              connectionLinesContainerRef.current.appendChild(line);
            }

            const midX = (friendlyPoint.x + enemyPoint.x) / 2;
            const midY = (friendlyPoint.y + enemyPoint.y) / 2;

            const text = document.createElement("div");
            text.style.cssText = `
              position: absolute;
              left: ${midX}px;
              top: ${midY - 20}px;
              transform: translateX(-50%);
              color: #ffffff;
              font-size: 14px;
              font-weight: bold;
              font-family: monospace;
              pointer-events: none;
              text-align: center;
              white-space: nowrap;
              text-shadow: 
                0 0 6px rgba(0, 0, 0, 1),
                0 0 10px rgba(0, 0, 0, 0.9),
                0 0 14px rgba(0, 0, 0, 0.8),
                0 2px 4px rgba(0, 0, 0, 1),
                2px 2px 4px rgba(0, 0, 0, 1),
                -2px 2px 4px rgba(0, 0, 0, 1),
                2px -2px 4px rgba(0, 0, 0, 1),
                -2px -2px 4px rgba(0, 0, 0, 1);
              letter-spacing: 0.5px;
            `;
            text.textContent = `${distanceNM.toFixed(1)} NM`;

            if (connectionLinesContainerRef.current) {
              connectionLinesContainerRef.current.appendChild(text);
            }
          }
        });
      });
    }
  }, [udpDataPoints, getMapManager]);

  // Update radar circles
  const updateRadarCircles = useCallback(() => {
    if (!radarCirclesContainerRef.current) return;

    if (radarCirclesContainerRef.current) {
      radarCirclesContainerRef.current.innerHTML = "";
    }

    // Add center crosshairs
    const verticalLine = document.createElement("div");
    verticalLine.style.cssText = `
      position: absolute;
      top: 0;
      left: 50%;
      width: 1px;
      height: 100%;
      background: #00ff00;
      opacity: 0.6;
      pointer-events: none;
      transform: translateX(-50%);
      z-index: 2;
    `;
    if (radarCirclesContainerRef.current) {
      radarCirclesContainerRef.current.appendChild(verticalLine);
    }

    const horizontalLine = document.createElement("div");
    horizontalLine.style.cssText = `
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 1px;
      background: #00ff00;
      opacity: 0.6;
      pointer-events: none;
      transform: translateY(-50%);
      z-index: 2;
    `;
    if (radarCirclesContainerRef.current) {
      radarCirclesContainerRef.current.appendChild(horizontalLine);
    }

    const allNodes = Array.from(udpDataPoints.values());
    if (allNodes.length === 0) return;

    const centerGreenNode = getCenterGreenNode();
    let maxDistanceNM = 0;

    if (!centerGreenNode) {
      const nodesCenter = calculateNodesCenter(udpDataPoints, allNodes);
      if (!nodesCenter) return;

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

    const viewportWidth = window.innerWidth - 60;
    const viewportHeight = window.innerHeight - 60;
    const minDimension = Math.min(viewportWidth, viewportHeight);

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

    for (let i = 0; i < numCircles; i++) {
      const circle = document.createElement("div");

      let rangeNM: number;
      if (useOpcodeRanges) {
        rangeNM = circleRanges[i];
      } else {
        rangeNM = ((i + 1) * adaptiveRangeNM) / numCircles;
      }

      const rangeRatio = rangeNM / 50;
      const baseRadius =
        ((i + 1) * (minDimension * 0.35 * rangeRatio)) / numCircles;

      const mapManager = getMapManager();
      const zoomLevel = mapManager?.getZoom() || 15;
      const radius = baseRadius / zoomLevel;

      const minRadius = 30;
      const maxRadius = minDimension * 0.4;
      const clampedRadius = Math.max(minRadius, Math.min(maxRadius, radius));

      circle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: ${clampedRadius * 2}px;
        height: ${clampedRadius * 2}px;
        margin-top: -${clampedRadius}px;
        margin-left: -${clampedRadius}px;
        border: 2px solid #00ff00;
        border-radius: 50%;
        pointer-events: none;
        box-sizing: border-box;
        opacity: 0.7;
      `;

      const rangeLabel = document.createElement("div");
      rangeLabel.textContent = `${Math.round(rangeNM)}NM`;
      rangeLabel.style.cssText = `
        position: absolute;
        top: 50%;
        left: ${50 + (clampedRadius / minDimension) * 100}%;
        color: #00ff00;
        font-family: monospace;
        font-size: 10px;
        background: rgba(0, 0, 0, 0.7);
        padding: 2px 4px;
        border-radius: 2px;
        transform: translateY(-50%);
        z-index: 2;
        pointer-events: none;
      `;

      if (radarCirclesContainerRef.current) {
        radarCirclesContainerRef.current.appendChild(circle);
        radarCirclesContainerRef.current.appendChild(rangeLabel);
      }
    }
  }, [udpDataPoints, getCenterGreenNode, getMapManager]);

  // Update when UDP data points change
  useEffect(() => {
    if (udpDataPoints.size === 0) return;

    // Center map on nodes
    centerMapOnNodes();

    // Update the dots on the map
    updateUDPDots();

    // Update connection lines
    updateConnectionLines();

    // Update radar circles
    updateRadarCircles();
  }, [
    udpDataPoints,
    centerMapOnNodes,
    updateUDPDots,
    updateConnectionLines,
    updateRadarCircles,
  ]);

  // Show red node dialog
  const showRedNodeDialog = useCallback(
    (node: UDPDataPoint, screenPoint: { x: number; y: number }) => {
      // Remove existing dialog if any
      if (redNodeDialogRef.current) {
        redNodeDialogRef.current.remove();
      }

      const dialog = document.createElement("div");
      dialog.id = "red-node-dialog";
      dialog.style.cssText = `
        position: fixed;
        left: ${screenPoint.x + 30}px;
        top: ${screenPoint.y - 60}px;
        width: 200px;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #ff0000;
        border-radius: 8px;
        padding: 12px;
        color: white;
        font-family: monospace;
        font-size: 12px;
        z-index: 200;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.6);
        pointer-events: auto;
      `;

      const header = document.createElement("div");
      header.style.cssText = `
        color: #ff0000;
        font-weight: bold;
        font-size: 14px;
        margin-bottom: 10px;
        text-align: center;
        border-bottom: 1px solid #ff0000;
        padding-bottom: 6px;
      `;
      header.textContent = `🎯 TARGET ${node.globalId}`;
      dialog.appendChild(header);

      const info = document.createElement("div");
      info.style.cssText = `
        font-size: 10px;
        color: #cccccc;
        margin-bottom: 12px;
        line-height: 1.4;
      `;
      info.innerHTML = `
        <div>Lat: ${node.latitude.toFixed(4)}°</div>
        <div>Lng: ${node.longitude.toFixed(4)}°</div>
        <div>Alt: ${node.altitude}ft</div>
      `;
      dialog.appendChild(info);

      const buttonsContainer = document.createElement("div");
      buttonsContainer.style.cssText = `
        display: flex;
        gap: 8px;
        flex-direction: column;
      `;

      const lockBtn = document.createElement("button");
      lockBtn.setAttribute("data-action", "lock");
      lockBtn.style.cssText = `
        background: #ff8800;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        font-family: monospace;
        transition: all 0.2s;
        width: 100%;
      `;
      lockBtn.textContent = lockedNodeIds.has(node.globalId)
        ? "🔒 LOCKED"
        : "🎯 LOCK";
      if (lockedNodeIds.has(node.globalId)) {
        lockBtn.disabled = true;
        lockBtn.style.opacity = "0.7";
        lockBtn.style.cursor = "not-allowed";
      }
      lockBtn.addEventListener("click", () => {
        addLockedNodeId(node.globalId);
        setNotification({
          message: "🎯 TARGET LOCKED",
          subMessage: `Node ${node.globalId}`,
          type: "lock",
        });
        setTimeout(() => setNotification(null), 2000);
        updateUDPDots();
        lockBtn.textContent = "🔒 LOCKED";
        lockBtn.style.background = "#44ff44";
        lockBtn.disabled = true;
        lockBtn.style.opacity = "0.7";
        lockBtn.style.cursor = "not-allowed";
      });

      const executeBtn = document.createElement("button");
      executeBtn.style.cssText = `
        background: #ff0000;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        font-family: monospace;
        transition: all 0.2s;
        width: 100%;
      `;
      executeBtn.textContent = "💥 EXECUTE";
      executeBtn.addEventListener("click", () => {
        const newPoints = new Map(udpDataPoints);
        newPoints.delete(node.globalId);
        setUdpDataPoints(newPoints);
        setNotification({
          message: "💥 TARGET ELIMINATED",
          subMessage: `Node ${node.globalId}`,
          type: "execute",
        });
        setTimeout(() => setNotification(null), 2000);
        hideRedNodeDialog();
      });

      buttonsContainer.appendChild(lockBtn);
      buttonsContainer.appendChild(executeBtn);
      dialog.appendChild(buttonsContainer);

      const closeBtn = document.createElement("button");
      closeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        background: transparent;
        color: #ff0000;
        border: 1px solid #ff0000;
        border-radius: 4px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      `;
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", () => {
        hideRedNodeDialog();
      });
      dialog.appendChild(closeBtn);

      const closeOnOutsideClick = (e: MouseEvent) => {
        if (!dialog.contains(e.target as Node)) {
          hideRedNodeDialog();
          document.removeEventListener("click", closeOnOutsideClick);
        }
      };
      setTimeout(() => {
        document.addEventListener("click", closeOnOutsideClick);
      }, 0);

      document.body.appendChild(dialog);
      redNodeDialogRef.current = dialog;
      setDialogOpenForNodeId(node.globalId);

      // Adjust position if dialog goes off screen
      const rect = dialog.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        dialog.style.left = `${screenPoint.x - 230}px`;
      }
      if (rect.bottom > window.innerHeight) {
        dialog.style.top = `${screenPoint.y - rect.height - 10}px`;
      }
      if (rect.left < 0) {
        dialog.style.left = `${screenPoint.x + 30}px`;
      }
      if (rect.top < 0) {
        dialog.style.top = `${screenPoint.y + 30}px`;
      }
    },
    [
      lockedNodeIds,
      addLockedNodeId,
      setNotification,
      setUdpDataPoints,
      udpDataPoints,
      updateUDPDots,
      setDialogOpenForNodeId,
    ]
  );

  // Hide red node dialog
  const hideRedNodeDialog = useCallback(() => {
    if (redNodeDialogRef.current) {
      redNodeDialogRef.current.remove();
      redNodeDialogRef.current = null;
    }
    setDialogOpenForNodeId(null);
  }, [setDialogOpenForNodeId]);

  // Show green node dialog
  const showGreenNodeDialog = useCallback(
    (node: UDPDataPoint, screenPoint: { x: number; y: number }) => {
      if (redNodeDialogRef.current) {
        redNodeDialogRef.current.remove();
      }

      const callsign = node.callsign || null;
      const isMotherAc =
        node.internalData && node.internalData.isMotherAc === 1;
      const metadata = node.regionalData?.metadata || {};
      const baroAltitude =
        metadata.baroAltitude !== undefined ? metadata.baroAltitude : NaN;
      const groundSpeed =
        metadata.groundSpeed !== undefined ? metadata.groundSpeed : NaN;
      const mach = metadata.mach !== undefined ? metadata.mach : NaN;

      const dialog = document.createElement("div");
      dialog.id = "green-node-dialog";
      dialog.style.cssText = `
        position: fixed;
        left: ${screenPoint.x + 30}px;
        top: ${screenPoint.y - 60}px;
        width: 280px;
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #00ff00;
        border-radius: 8px;
        padding: 12px;
        color: white;
        font-family: monospace;
        font-size: 12px;
        z-index: 200;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.6);
        pointer-events: auto;
      `;

      const header = document.createElement("div");
      header.style.cssText = `
        color: #00ff00;
        font-weight: bold;
        font-size: 14px;
        margin-bottom: 10px;
        text-align: center;
        border-bottom: 1px solid #00ff00;
        padding-bottom: 6px;
      `;
      header.textContent = `🟢 NETWORK NODE ${node.globalId}`;
      dialog.appendChild(header);

      if (callsign) {
        const callsignDiv = document.createElement("div");
        callsignDiv.style.cssText = `
          font-size: 14px;
          color: #00ff00;
          font-weight: bold;
          margin-bottom: 12px;
          text-align: center;
          padding: 8px;
          background: rgba(0, 255, 0, 0.1);
          border-radius: 4px;
        `;
        callsignDiv.textContent = `CALLSIGN: ${callsign}`;
        dialog.appendChild(callsignDiv);
      }

      if (isMotherAc) {
        const motherIndicator = document.createElement("div");
        motherIndicator.style.cssText = `
          font-size: 12px;
          color: #ffaa00;
          font-weight: bold;
          margin-bottom: 8px;
          text-align: center;
          padding: 4px;
          background: rgba(255, 170, 0, 0.2);
          border-radius: 4px;
        `;
        motherIndicator.textContent = "✈️ MOTHER AIRCRAFT";
        dialog.appendChild(motherIndicator);
      }

      const positionInfo = document.createElement("div");
      positionInfo.style.cssText = `
        font-size: 12px;
        color: #cccccc;
        margin-bottom: 12px;
        line-height: 1.6;
        padding: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      `;
      positionInfo.innerHTML = `
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 8px;">POSITION:</div>
        <div>Latitude: ${node.latitude.toFixed(6)}°</div>
        <div>Longitude: ${node.longitude.toFixed(6)}°</div>
        ${node.altitude !== undefined ? `<div>Altitude: ${node.altitude}ft</div>` : ""}
      `;
      dialog.appendChild(positionInfo);

      const metadataSection = document.createElement("div");
      metadataSection.style.cssText = `
        font-size: 12px;
        color: #cccccc;
        margin-bottom: 12px;
        line-height: 1.6;
        padding: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      `;
      const baroAltitudeDisplay = isNaN(baroAltitude)
        ? "NaN"
        : `${baroAltitude}ft`;
      const groundSpeedDisplay = isNaN(groundSpeed)
        ? "NaN"
        : `${groundSpeed}kt`;
      const machDisplay = isNaN(mach) ? "NaN" : `${mach}`;

      metadataSection.innerHTML = `
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 8px;">METADATA:</div>
        <div>Baro Altitude: ${baroAltitudeDisplay}</div>
        <div>Ground Speed: ${groundSpeedDisplay}</div>
        <div>Mach: ${machDisplay}</div>
      `;
      dialog.appendChild(metadataSection);

      const closeBtn = document.createElement("button");
      closeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        background: transparent;
        color: #00ff00;
        border: 1px solid #00ff00;
        border-radius: 4px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      `;
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", () => {
        hideRedNodeDialog();
      });
      dialog.appendChild(closeBtn);

      const closeOnOutsideClick = (e: MouseEvent) => {
        if (!dialog.contains(e.target as Node)) {
          hideRedNodeDialog();
          document.removeEventListener("click", closeOnOutsideClick);
        }
      };
      setTimeout(() => {
        document.addEventListener("click", closeOnOutsideClick);
      }, 0);

      document.body.appendChild(dialog);
      redNodeDialogRef.current = dialog;
      setDialogOpenForNodeId(node.globalId);

      // Adjust position if dialog goes off screen
      const rect = dialog.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        dialog.style.left = `${screenPoint.x - 310}px`;
      }
      if (rect.bottom > window.innerHeight) {
        dialog.style.top = `${screenPoint.y - rect.height - 10}px`;
      }
      if (rect.left < 0) {
        dialog.style.left = `${screenPoint.x + 30}px`;
      }
      if (rect.top < 0) {
        dialog.style.top = `${screenPoint.y + 30}px`;
      }
    },
    [setDialogOpenForNodeId, hideRedNodeDialog]
  );

  // Update on map move/zoom
  useEffect(() => {
    const handleMapMove = () => {
      if (udpDataPoints.size > 0) {
        updateUDPDots();
        updateConnectionLines();
        updateRadarCircles();
      }
    };

    const handleMapZoom = () => {
      if (udpDataPoints.size > 0) {
        updateUDPDots();
        updateConnectionLines();
        updateRadarCircles();
      }
    };

    window.addEventListener("map-center-changed", handleMapMove);
    window.addEventListener("map-zoom-changed", handleMapZoom);

    return () => {
      window.removeEventListener("map-center-changed", handleMapMove);
      window.removeEventListener("map-zoom-changed", handleMapZoom);
    };
  }, [udpDataPoints, updateUDPDots, updateConnectionLines, updateRadarCircles]);

  return null; // This component doesn't render anything visible
};

export default UDPNodesManager;
