import { MapManager } from "../map";
import mapboxgl from "mapbox-gl";

// Type for UDP data points
export type UDPDataPoint = {
  globalId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  opcode?: number; // Track which opcode this came from (101 or 104)
  [key: string]: any; // For other fields like veIn, veIe, heading, groundSpeed, etc.
};

export class UDPNodesManager {
  private udpDataPoints: Map<number, UDPDataPoint> = new Map();
  private udpDotsContainer: HTMLElement | null = null;
  private connectionLinesContainer: HTMLElement | null = null;
  private radarCirclesContainer: HTMLElement | null = null;
  private lockedNodeCircles: Map<number, HTMLElement> = new Map(); // Track yellow circles for locked nodes
  private executedNodeCircles: Map<number, HTMLElement> = new Map(); // Track red circles for executed nodes
  private mapManager: MapManager | null = null;
  private hasInitialCentering: boolean = false; // Track if we've done initial centering
  private onLockNode: ((node: UDPDataPoint) => void) | null = null;
  private onExecuteNode: ((node: UDPDataPoint) => void) | null = null;
  private redNodeDialog: HTMLElement | null = null;
  private dialogOpenForNodeId: number | null = null; // Track which node has dialog open
  private lockedNodeIds: Set<number> = new Set(); // Track locked nodes
  private executedNodeIds: Set<number> = new Set(); // Track executed nodes
  private threatLockStatus: Map<number, boolean> = new Map(); // Track threat lock status by threatId (opcode 106)
  private dialogsEnabled: boolean = false; // Control whether red/green dialogs can be shown
  private radarCirclesEnabled: boolean = true; // Control whether radar circles are rendered
  private nodesVisible: boolean = true; // Control whether UDP nodes/lines are rendered

  constructor(mapManager: MapManager | null = null) {
    this.mapManager = mapManager;
  }

  setMapManager(mapManager: MapManager | null) {
    this.mapManager = mapManager;
    // Reset initial centering flag when map manager changes
    this.hasInitialCentering = false;
  }

  /**
   * Enable or disable dialogs for network nodes (green nodes).
   * Red node dialogs remain disabled.
   */
  setDialogsEnabled(enabled: boolean): void {
    // Only enable dialogs for green nodes (network nodes)
    // Red node dialogs stay disabled
    this.dialogsEnabled = enabled;
    // Close any open dialogs if disabling
    if (!enabled) {
      this.hideRedNodeDialog();
      this.hideGreenNodeDialog();
    }
  }

  /**
   * Set callbacks for red node actions
   */
  setRedNodeCallbacks(
    onLock: (node: UDPDataPoint) => void,
    onExecute: (node: UDPDataPoint) => void
  ): void {
    this.onLockNode = onLock;
    this.onExecuteNode = onExecute;
  }

  /**
   * Enable or disable display of UDP nodes (dots and connection lines).
   */
  setNodesVisible(visible: boolean): void {
    this.nodesVisible = visible;

    // When hiding nodes, clear existing dots and lines
    if (!visible) {
      if (this.udpDotsContainer) {
        this.udpDotsContainer.innerHTML = "";
      }
      if (this.connectionLinesContainer) {
        this.connectionLinesContainer.innerHTML = "";
      }
    }
  }

  /**
   * Enable or disable radar circles globally.
   */
  setRadarCirclesEnabled(enabled: boolean): void {
    this.radarCirclesEnabled = enabled;
    if (!enabled && this.radarCirclesContainer) {
      // Clear any existing circles when disabled
      this.radarCirclesContainer.innerHTML = "";
    }
  }

  /**
   * Calculate distance between two coordinates in nautical miles
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3440.065;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  }

  /**
   * Initialize UDP nodes containers
   */
  initializeContainers(visualizationArea: HTMLElement): void {
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
    this.udpDotsContainer = udpDotsContainer;

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
    this.connectionLinesContainer = connectionLinesContainer;

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
    this.radarCirclesContainer = radarCirclesContainer;
  }

  /**
   * Handle UDP data from main process
   */
  handleUDPData(data: UDPDataPoint[]): void {
    if (!Array.isArray(data)) return;

    // First, process opcode 106 (threat lock data) separately
    const threatLockData = data.filter((point) => point.opcode === 106);
    threatLockData.forEach((threatPoint) => {
      if (threatPoint.threatId !== undefined) {
        const isLocked = threatPoint.isLockOn === 1;
        // Store lock status by threatId (assuming threatId corresponds to globalId of opcode 104 threats)
        this.threatLockStatus.set(threatPoint.threatId, isLocked);
        console.log(
          `🔒 Threat ${threatPoint.threatId} lock status updated: ${isLocked ? "LOCKED" : "UNLOCKED"}`
        );
      }
    });

    // Update or add data points
    data.forEach((point) => {
      if (point.globalId !== undefined) {
        // For opcode 102 (network member data), just set the metadata for the globalId
        if (point.opcode === 102) {
          // Ensure we have a valid globalId
          if (point.globalId === undefined || point.globalId === null) {
            console.warn(`⚠️ Opcode 102 point missing globalId:`, point);
            return;
          }

          const existingNode = this.udpDataPoints.get(point.globalId);
          if (existingNode) {
            // Just set the metadata directly - don't merge anything else
            if (point.regionalData?.metadata) {
              existingNode.regionalData = existingNode.regionalData || {};
              existingNode.regionalData.metadata = point.regionalData.metadata;
            }
            // Also set callsign and internalData if they exist
            if (point.callsign) {
              existingNode.callsign = point.callsign;
            }
            if (point.internalData) {
              existingNode.internalData = {
                ...existingNode.internalData,
                ...point.internalData,
              };
            }
            this.udpDataPoints.set(point.globalId, existingNode);
            console.log(
              `📊 Set metadata for opcode 102 (globalId ${point.globalId}):`,
              {
                globalId: point.globalId,
                metadata: existingNode.regionalData?.metadata,
                baroAltitude: existingNode.regionalData?.metadata?.baroAltitude,
                groundSpeed: existingNode.regionalData?.metadata?.groundSpeed,
                mach: existingNode.regionalData?.metadata?.mach,
              }
            );
          } else {
            // Opcode 102 data without existing node - store it temporarily
            console.log(
              `⚠️ Opcode 102 data for globalId ${point.globalId} but no existing node found. Storing metadata.`
            );
            this.udpDataPoints.set(point.globalId, {
              ...point,
              opcode: 101, // Mark as green node type
              // No position yet - will be added when opcode 101 arrives
            });
          }
        } else if (
          point.latitude !== undefined &&
          point.longitude !== undefined
        ) {
          // For other opcodes (101, 104), require position data
          // Check if there's existing opcode 102 data to merge with (check for callsign or other opcode 102 fields)
          const existingNode = this.udpDataPoints.get(point.globalId);
          const hasOpcode102Data =
            existingNode &&
            (existingNode.callsign !== undefined ||
              existingNode.internalData !== undefined ||
              existingNode.regionalData !== undefined ||
              existingNode.battleGroupData !== undefined);

          if (hasOpcode102Data) {
            // Merge position data from opcode 101/104 with existing opcode 102 metadata
            this.udpDataPoints.set(point.globalId, {
              ...existingNode,
              ...point,
              // Use new position data
              latitude: point.latitude,
              longitude: point.longitude,
              // Preserve callsign from opcode 102
              callsign: existingNode.callsign || point.callsign,
              // Deep merge nested objects to preserve opcode 102 data
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
              opcode: point.opcode, // Use the new opcode (101 or 104)
            });
            console.log(
              `📍 Merged position data (opcode ${point.opcode}) with opcode 102 metadata for node ${point.globalId}: callsign=${existingNode.callsign || "N/A"}, hasMetadata=${!!existingNode.regionalData?.metadata}`
            );
            const mergedNode = this.udpDataPoints.get(point.globalId);
            if (mergedNode) {
              console.log(
                "📊 Metadata after merge (opcode 101/104 with 102):",
                {
                  globalId: point.globalId,
                  hasRegionalData: !!mergedNode.regionalData,
                  hasMetadata: !!mergedNode.regionalData?.metadata,
                  metadata: mergedNode.regionalData?.metadata,
                  baroAltitude: mergedNode.regionalData?.metadata?.baroAltitude,
                  groundSpeed: mergedNode.regionalData?.metadata?.groundSpeed,
                  mach: mergedNode.regionalData?.metadata?.mach,
                }
              );
            }
          } else {
            // Normal update/add for opcodes 101, 104
            // BUT: Check if there's existing metadata from opcode 102 that we need to preserve
            const existingNode = this.udpDataPoints.get(point.globalId);
            if (existingNode && existingNode.regionalData?.metadata) {
              // Preserve existing metadata when updating position
              this.udpDataPoints.set(point.globalId, {
                ...existingNode,
                ...point,
                latitude: point.latitude,
                longitude: point.longitude,
                // Preserve regionalData with metadata
                regionalData: existingNode.regionalData,
                opcode: point.opcode, // Preserve opcode (101 or 104)
              });
            } else {
              // Normal update/add for opcodes 101, 104
              // Coordinates are already converted in main.ts, use them directly
              // Update or add the point (preserve opcode if present)
              this.udpDataPoints.set(point.globalId, {
                ...point,
                latitude: point.latitude,
                longitude: point.longitude,
                opcode: point.opcode, // Preserve opcode (101 or 104)
              });
            }

            console.log(
              `📍 Updated node ${point.globalId} (opcode ${point.opcode}): lat=${point.latitude}, lng=${point.longitude}`
            );
          }
        }
      }
    });

    // Center map on the nodes
    this.centerMapOnNodes();

    // Update the dots on the map
    this.updateUDPDots();

    // Update connection lines
    this.updateConnectionLines();

    // Update radar circles
    this.updateRadarCircles();
  }

  /**
   * Convert U32 encoded coordinate to degrees
   * Assuming microdegrees format (divide by 1,000,000)
   */
  convertU32ToDegrees(value: number): number {
    // If value is very large (> 1e6), it's likely in microdegrees
    if (Math.abs(value) > 1e6) {
      return value / 1e6;
    }
    // Otherwise, assume it's already in degrees
    return value;
  }

  /**
   * Calculate the center point of provided nodes (falls back to all nodes)
   */
  calculateNodesCenter(
    preferredNodes?: UDPDataPoint[]
  ): { lat: number; lng: number } | null {
    const nodesToUse =
      preferredNodes && preferredNodes.length > 0
        ? preferredNodes
        : Array.from(this.udpDataPoints.values());

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
  }

  /**
   * Get the center green node (the one closest to the center of all nodes)
   */
  private getCenterGreenNode(): UDPDataPoint | null {
    const allNodes = Array.from(this.udpDataPoints.values());
    if (allNodes.length === 0) return null;

    // Get all green nodes (friendly, opcode 101)
    const greenNodes = allNodes.filter((point) => point.opcode === 101);
    if (greenNodes.length === 0) return null;

    // Find the green node closest to the center of all nodes
    const allNodesCenter = this.calculateNodesCenter(allNodes);
    if (!allNodesCenter) return greenNodes[0]; // Fallback to first green node

    let minDistance = Infinity;
    let centerGreenNode: UDPDataPoint | null = null;

    greenNodes.forEach((node) => {
      const distance = this.calculateDistance(
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
  }

  /**
   * Calculate bounding box for all nodes
   */
  private calculateNodesBounds(): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null {
    if (this.udpDataPoints.size === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    this.udpDataPoints.forEach((point) => {
      if (point.latitude !== undefined && point.longitude !== undefined) {
        minLat = Math.min(minLat, point.latitude);
        maxLat = Math.max(maxLat, point.latitude);
        minLng = Math.min(minLng, point.longitude);
        maxLng = Math.max(maxLng, point.longitude);
      }
    });

    if (minLat === Infinity) return null;

    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Calculate bounding box relative to a center node
   */
  private calculateNodesBoundsRelativeToCenter(centerNode: UDPDataPoint): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null {
    if (this.udpDataPoints.size === 0) return null;

    const centerLat = centerNode.latitude;
    const centerLng = centerNode.longitude;

    let maxLatOffset = 0;
    let maxLngOffset = 0;
    let minLatOffset = 0;
    let minLngOffset = 0;

    this.udpDataPoints.forEach((point) => {
      if (point.latitude !== undefined && point.longitude !== undefined) {
        const latOffset = point.latitude - centerLat;
        const lngOffset = point.longitude - centerLng;

        maxLatOffset = Math.max(maxLatOffset, latOffset);
        minLatOffset = Math.min(minLatOffset, latOffset);
        maxLngOffset = Math.max(maxLngOffset, lngOffset);
        minLngOffset = Math.min(minLngOffset, lngOffset);
      }
    });

    return {
      minLat: centerLat + minLatOffset,
      maxLat: centerLat + maxLatOffset,
      minLng: centerLng + minLngOffset,
      maxLng: centerLng + maxLngOffset,
    };
  }

  /**
   * Calculate appropriate zoom level to fit all nodes
   */
  private calculateZoomToFitNodes(centerNode?: UDPDataPoint): number {
    // If center node is provided, calculate bounds relative to that center
    const bounds = centerNode
      ? this.calculateNodesBoundsRelativeToCenter(centerNode)
      : this.calculateNodesBounds();
    if (!bounds) return 15;

    const mapboxMap = this.mapManager?.getMapboxMap();
    if (!mapboxMap) return 15;

    // Try to use Mapbox's fitBounds method for accurate zoom calculation
    try {
      // Create bounds object for fitBounds
      const sw = new mapboxgl.LngLat(bounds.minLng, bounds.minLat);
      const ne = new mapboxgl.LngLat(bounds.maxLng, bounds.maxLat);
      const lngLatBounds = new mapboxgl.LngLatBounds(sw, ne);

      // Get viewport dimensions for padding calculation
      const viewportWidth = window.innerWidth - 60;
      const viewportHeight = window.innerHeight - 60;

      // Calculate padding (as percentage of viewport, or pixels)
      // Use 15% padding on each side to ensure all nodes (green and red) are visible
      const paddingPixels = Math.min(viewportWidth, viewportHeight) * 0.15;

      // Temporarily fit bounds to get the zoom level
      const cameraOptions = mapboxMap.cameraForBounds(lngLatBounds, {
        padding: {
          top: paddingPixels,
          bottom: paddingPixels,
          left: paddingPixels,
          right: paddingPixels,
        },
        maxZoom: 13, // Respect maxZoom from map config
      });

      if (cameraOptions && cameraOptions.zoom !== undefined) {
        // Zoom out more to ensure all nodes (green and red) are visible with margin
        const targetZoom = cameraOptions.zoom - 0.5;
        return Math.max(1, Math.min(13, targetZoom));
      }
    } catch (error) {
      console.warn(
        "Could not use fitBounds, falling back to manual calculation:",
        error
      );
    }

    // Fallback to manual calculation if fitBounds is not available
    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    const maxSpan = Math.max(latSpan, lngSpan);

    // Get viewport dimensions
    const viewportWidth = window.innerWidth - 60;
    const viewportHeight = window.innerHeight - 60;
    const minDimension = Math.min(viewportWidth, viewportHeight);

    // Account for padding (15% on each side = 30% total reduction)
    const paddedDimension = minDimension * 0.7;

    let zoom = 15;

    if (maxSpan > 0) {
      // Calculate zoom based on Mercator projection
      // At equator: 1 degree longitude ≈ 111 km
      // At zoom level z: world width = 256 * 2^z pixels
      // World width in degrees = 360
      const worldWidthDegrees = 360;
      const worldWidthPixels = 256;

      // Calculate how many degrees should fit in our padded viewport
      const degreesPerPixel = maxSpan / paddedDimension;

      // Calculate zoom level
      // At zoom z: worldWidthPixels * 2^z pixels = 360 degrees
      // So: degreesPerPixel = 360 / (worldWidthPixels * 2^z)
      // Solving for z: 2^z = 360 / (worldWidthPixels * degreesPerPixel)
      // z = log2(360 / (worldWidthPixels * degreesPerPixel))
      zoom = Math.log2(
        worldWidthDegrees / (worldWidthPixels * degreesPerPixel)
      );

      // Add extra padding (zoom out more to ensure all nodes are visible)
      zoom = zoom - 0.8;

      // Clamp zoom between reasonable bounds (respecting map's maxZoom: 13)
      zoom = Math.max(1, Math.min(13, zoom));
    }

    return zoom;
  }

  /**
   * Center the map on a green node, preserving user's zoom level
   */
  private centerMapOnNodes(): void {
    if (!this.mapManager) return;

    // Get all nodes (both green and red)
    const allNodes = Array.from(this.udpDataPoints.values());
    if (allNodes.length === 0) return;

    // First, check for mother aircraft (isMotherAc = 1) from opcode 102 data
    const motherAircraft = allNodes.find(
      (node) => node.internalData && node.internalData.isMotherAc === 1
    );

    if (motherAircraft) {
      // Center on mother aircraft
      const mapboxMap = this.mapManager.getMapboxMap();
      const currentZoom = mapboxMap ? mapboxMap.getZoom() : null;

      if (!this.hasInitialCentering && currentZoom === null) {
        const targetZoom = this.calculateZoomToFitNodes(motherAircraft);
        this.mapManager.updateCenter(
          motherAircraft.latitude,
          motherAircraft.longitude,
          targetZoom
        );
        this.hasInitialCentering = true;
        console.log(
          `🎯 Initial centering on mother aircraft: center=(${motherAircraft.latitude.toFixed(4)}, ${motherAircraft.longitude.toFixed(4)}), zoom=${targetZoom.toFixed(2)}, globalId=${motherAircraft.globalId}, callsign=${motherAircraft.callsign || "N/A"}`
        );
      } else {
        // Preserve current zoom, only update center position
        this.mapManager.updateCenter(
          motherAircraft.latitude,
          motherAircraft.longitude,
          currentZoom || undefined
        );
      }
      return;
    }

    // Get the center green node
    const centerGreenNode = this.getCenterGreenNode();

    // Get current zoom level (preserve user's zoom preference)
    const mapboxMap = this.mapManager.getMapboxMap();
    const currentZoom = mapboxMap ? mapboxMap.getZoom() : null;

    if (!centerGreenNode) {
      // No green nodes, fall back to centering on all nodes center
      const nodesCenter = this.calculateNodesCenter(allNodes);
      if (!nodesCenter) return;

      // Only set zoom on initial centering, otherwise preserve user's zoom
      if (!this.hasInitialCentering && currentZoom === null) {
        const targetZoom = this.calculateZoomToFitNodes();
        this.mapManager.updateCenter(
          nodesCenter.lat,
          nodesCenter.lng,
          targetZoom
        );
        this.hasInitialCentering = true;
        console.log(
          `🗺️ Initial centering: center=(${nodesCenter.lat.toFixed(4)}, ${nodesCenter.lng.toFixed(4)}), zoom=${targetZoom.toFixed(2)}`
        );
      } else {
        // Preserve current zoom, only update center
        this.mapManager.updateCenter(
          nodesCenter.lat,
          nodesCenter.lng,
          currentZoom || undefined
        );
      }
      return;
    }

    // Count nodes for debugging
    const greenNodes = allNodes.filter((n) => n.opcode === 101);
    const redNodes = allNodes.filter((n) => n.opcode === 104);

    // Only set zoom on initial centering, otherwise preserve user's zoom
    if (!this.hasInitialCentering && currentZoom === null) {
      // Calculate zoom level to fit all nodes relative to the center green node (only on first load)
      const targetZoom = this.calculateZoomToFitNodes(centerGreenNode);
      this.mapManager.updateCenter(
        centerGreenNode.latitude,
        centerGreenNode.longitude,
        targetZoom
      );
      this.hasInitialCentering = true;
      console.log(
        `🎯 Initial centering on green node: center=(${centerGreenNode.latitude.toFixed(4)}, ${centerGreenNode.longitude.toFixed(4)}), zoom=${targetZoom.toFixed(2)}, nodeId=${centerGreenNode.globalId}`
      );
    } else {
      // Preserve current zoom, only update center position
      this.mapManager.updateCenter(
        centerGreenNode.latitude,
        centerGreenNode.longitude,
        currentZoom || undefined
      );
    }

    console.log(
      `📍 Centered on green node: (${centerGreenNode.latitude.toFixed(4)}, ${centerGreenNode.longitude.toFixed(4)}), zoom=${currentZoom?.toFixed(2) || "preserved"}, nodes: ${greenNodes.length} green, ${redNodes.length} red`
    );
  }

  /**
   * Update UDP symbols on the map
   */
  updateUDPDots(): void {
    if (!this.mapManager || !this.udpDotsContainer || !this.nodesVisible) {
      if (this.udpDotsContainer) {
        this.udpDotsContainer.innerHTML = "";
      }
      return;
    }

    const mapboxMap = this.mapManager.getMapboxMap();
    if (!mapboxMap) return;

    // Ensure map is properly sized (important when map visibility is toggled)
    try {
      mapboxMap.resize();
    } catch (e) {
      console.warn("Map resize failed:", e);
    }

    // Clear existing symbols
    this.udpDotsContainer.innerHTML = "";

    // Clear existing locked node circles (they'll be recreated if nodes are still locked)
    this.lockedNodeCircles.forEach((circle) => circle.remove());
    this.lockedNodeCircles.clear();

    // Clear existing executed node circles (they'll be recreated if nodes are still executed)
    this.executedNodeCircles.forEach((circle) => circle.remove());
    this.executedNodeCircles.clear();

    // Find the mother aircraft (middle node) for distance calculations
    const motherAircraft = Array.from(this.udpDataPoints.values()).find(
      (node) => node.internalData && node.internalData.isMotherAc === 1
    );

    // Get map bounds to filter visible points
    const bounds = mapboxMap.getBounds();

    // Update dialog position if it's open for a node
    if (this.redNodeDialog && this.dialogOpenForNodeId !== null) {
      const dialogNode = this.udpDataPoints.get(this.dialogOpenForNodeId);
      if (dialogNode) {
        const screenPoint = mapboxMap.project([
          dialogNode.longitude,
          dialogNode.latitude,
        ]);
        const container = this.udpDotsContainer;
        const containerRect = container?.getBoundingClientRect();
        const absoluteX = containerRect
          ? containerRect.left + screenPoint.x
          : screenPoint.x;
        const absoluteY = containerRect
          ? containerRect.top + screenPoint.y
          : screenPoint.y;
        this.updateDialogPosition({ x: absoluteX, y: absoluteY });
      } else {
        // Node no longer exists, close dialog
        this.hideRedNodeDialog();
      }
    }

    // Render symbols for all stored data points
    this.udpDataPoints.forEach((point, globalId) => {
      const lat = point.latitude;
      const lng = point.longitude;

      // Check if point is within visible bounds
      if (
        lng >= bounds.getWest() &&
        lng <= bounds.getEast() &&
        lat >= bounds.getSouth() &&
        lat <= bounds.getNorth()
      ) {
        // Project lat/lng to screen coordinates
        const screenPoint = mapboxMap.project([lng, lat]);

        // Determine icon based on opcode
        const isLocked = this.lockedNodeIds.has(globalId);

        // Check if this threat (opcode 104) is locked via opcode 106
        // threatId from opcode 106 should match globalId from opcode 104
        let isThreatLocked = false;
        if (point.opcode === 104) {
          isThreatLocked = this.threatLockStatus.get(globalId) === true;
        }

        // Use locked icon if either manually locked or threat-locked via opcode 106
        const useLockedIcon = isLocked || isThreatLocked;

        // Check if this is a mother aircraft
        const isMotherAc =
          point.internalData && point.internalData.isMotherAc === 1;

        // Determine icon file - prioritize mother aircraft icon
        let iconFile: string;
        if (isMotherAc) {
          iconFile = "mother-aircraft.svg";
        } else if (point.opcode === 104) {
          iconFile = "hostile_aircraft.svg"; // Same icon, but will have different glow/visual indicator
        } else {
          iconFile = "friendly_aircraft.svg";
        }

        // Use different glow color for locked nodes or mother aircraft
        let glowColor: string;
        if (useLockedIcon) {
          glowColor = "#ffaa00"; // Orange for locked (either manually or via opcode 106)
        } else if (isMotherAc) {
          glowColor = "#ffaa00"; // Orange/amber for mother aircraft
        } else if (point.opcode === 104) {
          glowColor = "#ff0000"; // Red for 104 (unlocked threats)
        } else {
          glowColor = "#00ff00"; // Green for 101
        }

        // Create icon element
        const iconElement = document.createElement("img");
        iconElement.src = `icons/${iconFile}`;
        iconElement.alt = `UDP node ${globalId} (opcode ${point.opcode})`;
        iconElement.className = "udp-node-icon";
        iconElement.setAttribute("data-global-id", globalId.toString());
        iconElement.setAttribute(
          "data-opcode",
          point.opcode?.toString() || "unknown"
        );

        const iconSize = 24; // Size of the icon in pixels
        const isRedNode = point.opcode === 104;
        const isGreenNode = point.opcode === 101; // Green nodes are network nodes

        // Create container for icon (to add lock indicator overlay and call sign label)
        const iconContainer = document.createElement("div");
        iconContainer.style.cssText = `
          position: absolute;
          left: ${screenPoint.x}px;
          top: ${screenPoint.y}px;
          width: ${iconSize}px;
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

        // Add "M-A/c" label below mother aircraft (middle node)
        if (isMotherAc) {
          const motherLabel = document.createElement("div");
          motherLabel.textContent = "M-A/c";
          motherLabel.style.cssText = `
            position: absolute;
            top: ${iconSize / 2 + 4}px;
            left: 50%;
            transform: translateX(-50%);
            color: #ffaa00;
            font-family: monospace;
            font-size: 10px;
            font-weight: bold;
            text-shadow: 0 0 3px black, 0 0 6px rgba(255, 170, 0, 0.8);
            white-space: nowrap;
            pointer-events: none;
            z-index: 4;
            background: rgba(0, 0, 0, 0.7);
            padding: 2px 4px;
            border-radius: 2px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          `;
          iconContainer.appendChild(motherLabel);
        }

        // Add call sign label below green nodes (network nodes) - but not if it's the mother aircraft
        if (isGreenNode && !isMotherAc) {
          const callsignLabel = document.createElement("div");
          callsignLabel.textContent = point.callsign || `ID${globalId}`;
          callsignLabel.style.cssText = `
            position: absolute;
            top: ${iconSize / 2 + 4}px;
            left: 50%;
            transform: translateX(-50%);
            color: #00ff00;
            font-family: monospace;
            font-size: 10px;
            font-weight: bold;
            text-shadow: 0 0 3px black, 0 0 6px rgba(0, 255, 0, 0.8);
            white-space: nowrap;
            pointer-events: none;
            z-index: 4;
            background: rgba(0, 0, 0, 0.7);
            padding: 2px 4px;
            border-radius: 2px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          `;
          iconContainer.appendChild(callsignLabel);
        }

        // Add yellow circle around locked red nodes
        if (isRedNode && useLockedIcon) {
          const circleRadius = 40; // Radius of the yellow circle
          const lockCircle = document.createElement("div");
          lockCircle.style.cssText = `
            position: absolute;
            left: ${screenPoint.x}px;
            top: ${screenPoint.y}px;
            width: ${circleRadius * 2}px;
            height: ${circleRadius * 2}px;
            margin-top: -${circleRadius}px;
            margin-left: -${circleRadius}px;
            border: 3px solid #ffff00;
            border-radius: 50%;
            pointer-events: none;
            box-sizing: border-box;
            z-index: 2;
            box-shadow: 0 0 8px rgba(255, 255, 0, 0.8), 0 0 16px rgba(255, 255, 0, 0.4);
          `;
          this.udpDotsContainer.appendChild(lockCircle);
          this.lockedNodeCircles.set(globalId, lockCircle);
        }

        // Add red circle around executed red nodes
        const isExecuted = this.executedNodeIds.has(globalId);
        if (isRedNode && isExecuted) {
          const circleRadius = 40; // Radius of the red circle
          const executeCircle = document.createElement("div");
          executeCircle.style.cssText = `
            position: absolute;
            left: ${screenPoint.x}px;
            top: ${screenPoint.y}px;
            width: ${circleRadius * 2}px;
            height: ${circleRadius * 2}px;
            margin-top: -${circleRadius}px;
            margin-left: -${circleRadius}px;
            border: 3px solid #ff0000;
            border-radius: 50%;
            pointer-events: none;
            box-sizing: border-box;
            z-index: 2;
            box-shadow: 0 0 8px rgba(255, 0, 0, 0.8), 0 0 16px rgba(255, 0, 0, 0.4);
          `;
          this.udpDotsContainer.appendChild(executeCircle);
          this.executedNodeCircles.set(globalId, executeCircle);
        }

        iconElement.onload = () => {
          console.log(
            `✅ Loaded UDP node icon: ${iconFile} for opcode ${point.opcode}`
          );
        };

        iconElement.onerror = () => {
          console.warn(
            `⚠️ Failed to load icon: ${iconFile} for opcode ${point.opcode}`
          );
        };

        // Add click handler for red nodes
        if (isRedNode) {
          iconContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            // Get the container's position to calculate absolute screen coordinates
            const container = this.udpDotsContainer;
            const containerRect = container?.getBoundingClientRect();
            const absoluteX = containerRect
              ? containerRect.left + screenPoint.x
              : screenPoint.x;
            const absoluteY = containerRect
              ? containerRect.top + screenPoint.y
              : screenPoint.y;
            this.showRedNodeDialog(point, { x: absoluteX, y: absoluteY });
          });
        }

        // Add click handler for green nodes (network nodes)
        if (isGreenNode) {
          iconContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            console.log(
              `🟢 Green node clicked: GID=${point.globalId}, dialogsEnabled=${this.dialogsEnabled}`
            );
            // Get the container's position to calculate absolute screen coordinates
            const container = this.udpDotsContainer;
            const containerRect = container?.getBoundingClientRect();
            const absoluteX = containerRect
              ? containerRect.left + screenPoint.x
              : screenPoint.x;
            const absoluteY = containerRect
              ? containerRect.top + screenPoint.y
              : screenPoint.y;
            // Get the latest node from udpDataPoints to ensure we have merged metadata
            const latestNode = this.udpDataPoints.get(point.globalId) || point;
            console.log("🔍 NODE RETRIEVED FOR DIALOG:", {
              globalId: point.globalId,
              hasLatestNode: !!this.udpDataPoints.get(point.globalId),
              latestNodeHasMetadata: !!latestNode.regionalData?.metadata,
              latestNodeMetadata: latestNode.regionalData?.metadata,
              pointHasMetadata: !!point.regionalData?.metadata,
              pointMetadata: point.regionalData?.metadata,
            });
            this.showGreenNodeDialog(latestNode, {
              x: absoluteX,
              y: absoluteY,
            });
          });
        }

        this.udpDotsContainer.appendChild(iconContainer);
      }
    });
  }

  /**
   * Update connection lines between friendly and enemy nodes, and between green nodes
   */
  updateConnectionLines(): void {
    // Connection lines are disabled - just clear the container
    if (this.connectionLinesContainer) {
      this.connectionLinesContainer.innerHTML = "";
    }
  }

  /**
   * Update radar circles centered on all nodes
   */
  updateRadarCircles(): void {
    if (!this.radarCirclesContainer || !this.radarCirclesEnabled) return;

    // Clear existing circles
    this.radarCirclesContainer.innerHTML = "";

    // Add center crosshairs (vertical and horizontal lines)
    // Vertical line (center)
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
    this.radarCirclesContainer.appendChild(verticalLine);

    // Horizontal line (center)
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
    this.radarCirclesContainer.appendChild(horizontalLine);

    // Always draw exactly 3 circles at equal spacing
    const numCircles = 3;

    // Use all nodes (both green and red) just to estimate an overall range
    const allNodes = Array.from(this.udpDataPoints.values());

    let maxDistanceNM = 50; // sensible default range
    if (allNodes.length > 1) {
      const center = this.calculateNodesCenter(allNodes);
      if (center) {
        allNodes.forEach((node) => {
          const distance = this.calculateDistance(
            center.lat,
            center.lng,
            node.latitude,
            node.longitude
          );
          maxDistanceNM = Math.max(maxDistanceNM, distance);
        });
      }
    }

    // Set total range and viewport size
    const minRangeNM = 30;
    const totalRangeNM = Math.max(minRangeNM, maxDistanceNM * 1.5);

    const viewportWidth = window.innerWidth - 60;
    const viewportHeight = window.innerHeight - 60;
    const minDimension = Math.min(viewportWidth, viewportHeight);

    for (let i = 0; i < numCircles; i++) {
      const circle = document.createElement("div");

      // Evenly spaced ranges
      const rangeNM = ((i + 1) * totalRangeNM) / numCircles;

      // Calculate radius based on range
      const baseRadius = (minDimension * 0.35 * (i + 1)) / numCircles;

      // Keep circles the same size regardless of zoom level
      const radius = baseRadius;

      const minRadius = 30;
      const maxRadius = minDimension * 0.4;
      let clampedRadius = Math.max(minRadius, Math.min(maxRadius, radius));

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

      this.radarCirclesContainer.appendChild(circle);
    }

    console.log(
      `📡 Created ${numCircles} radar circles with equal spacing, total range: ${totalRangeNM.toFixed(
        1
      )} NM`
    );
  }

  /**
   * Show dialog for red node with lock and execute options
   */
  private showRedNodeDialog(
    node: UDPDataPoint,
    screenPoint: { x: number; y: number }
  ): void {
    if (!this.dialogsEnabled) {
      return;
    }
    // Remove existing dialog if any
    if (this.redNodeDialog) {
      this.redNodeDialog.remove();
    }

    // Create dialog
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

    // Header
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
    header.textContent = `TARGET ${node.globalId}`;
    dialog.appendChild(header);

    // Node info
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

    // Buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      flex-direction: column;
    `;

    // Lock button
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
    lockBtn.textContent = "LOCK";
    lockBtn.addEventListener("mouseenter", () => {
      if (!lockBtn.disabled) {
        lockBtn.style.background = "#ffaa00";
        lockBtn.style.transform = "scale(1.05)";
      }
    });
    lockBtn.addEventListener("mouseleave", () => {
      if (!lockBtn.disabled) {
        lockBtn.style.background = "#ff8800";
        lockBtn.style.transform = "scale(1)";
      }
    });
    lockBtn.addEventListener("click", () => {
      // Mark node as locked
      this.lockedNodeIds.add(node.globalId);

      if (this.onLockNode) {
        this.onLockNode(node);
      }

      // Update the node icon to show locked state
      this.updateUDPDots();

      // Keep dialog open but update it to show locked status
      this.updateDialogLockStatus(true);

      console.log(`🔒 Locked on red node ${node.globalId}`);
    });

    // Execute button
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
    executeBtn.textContent = "EXECUTE";
    executeBtn.addEventListener("mouseenter", () => {
      executeBtn.style.background = "#ff3333";
      executeBtn.style.transform = "scale(1.05)";
    });
    executeBtn.addEventListener("mouseleave", () => {
      executeBtn.style.background = "#ff0000";
      executeBtn.style.transform = "scale(1)";
    });
    executeBtn.addEventListener("click", () => {
      // Mark node as executed
      this.executedNodeIds.add(node.globalId);

      if (this.onExecuteNode) {
        this.onExecuteNode(node);
      }

      // Update the dots to show the red circle around the executed node
      this.updateUDPDots();

      this.hideRedNodeDialog();
      console.log(`💥 Executed on red node ${node.globalId}`);
    });

    buttonsContainer.appendChild(lockBtn);
    buttonsContainer.appendChild(executeBtn);
    dialog.appendChild(buttonsContainer);

    // Close button
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
      this.hideRedNodeDialog();
    });
    dialog.appendChild(closeBtn);

    // Close dialog when clicking outside
    const closeOnOutsideClick = (e: MouseEvent) => {
      if (!dialog.contains(e.target as Node)) {
        this.hideRedNodeDialog();
        document.removeEventListener("click", closeOnOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeOnOutsideClick);
    }, 0);

    document.body.appendChild(dialog);
    this.redNodeDialog = dialog;
    this.dialogOpenForNodeId = node.globalId;

    // Adjust position if dialog goes off screen
    this.updateDialogPosition(screenPoint);
  }

  /**
   * Update dialog position
   */
  private updateDialogPosition(screenPoint: { x: number; y: number }): void {
    if (!this.redNodeDialog) return;

    this.redNodeDialog.style.left = `${screenPoint.x + 30}px`;
    this.redNodeDialog.style.top = `${screenPoint.y - 60}px`;

    // Adjust position if dialog goes off screen
    const rect = this.redNodeDialog.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.redNodeDialog.style.left = `${screenPoint.x - 230}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.redNodeDialog.style.top = `${screenPoint.y - rect.height - 10}px`;
    }
    if (rect.left < 0) {
      this.redNodeDialog.style.left = `${screenPoint.x + 30}px`;
    }
    if (rect.top < 0) {
      this.redNodeDialog.style.top = `${screenPoint.y + 30}px`;
    }
  }

  /**
   * Update dialog to show locked status
   */
  private updateDialogLockStatus(isLocked: boolean): void {
    if (!this.redNodeDialog) return;

    const lockBtn = this.redNodeDialog.querySelector(
      'button[data-action="lock"]'
    ) as HTMLButtonElement;
    if (lockBtn) {
      if (isLocked) {
        lockBtn.textContent = "LOCKED";
        lockBtn.style.background = "#44ff44";
        lockBtn.disabled = true;
        lockBtn.style.opacity = "0.7";
        lockBtn.style.cursor = "not-allowed";
      }
    }
  }

  /**
   * Hide the red node dialog
   */
  private hideRedNodeDialog(): void {
    if (this.redNodeDialog) {
      this.redNodeDialog.remove();
      this.redNodeDialog = null;
      this.dialogOpenForNodeId = null;
    }
  }

  /**
   * Show dialog for green node (network node) with lat/lng
   */
  private showGreenNodeDialog(
    node: UDPDataPoint,
    screenPoint: { x: number; y: number }
  ): void {
    console.log(
      `🔍 showGreenNodeDialog called: dialogsEnabled=${this.dialogsEnabled}, node=${node.globalId}`
    );
    if (!this.dialogsEnabled) {
      console.warn(
        `⚠️ Dialogs are disabled, cannot show dialog for node ${node.globalId}`
      );
      return;
    }
    // Remove existing dialog if any
    if (this.redNodeDialog) {
      this.redNodeDialog.remove();
    }

    // Get the latest node from storage to ensure we have merged data
    const storedNode = this.udpDataPoints.get(node.globalId);
    const nodeToUse = storedNode || node;

    // Get callsign from opcode 102 data
    const callsign = nodeToUse.callsign || null;
    const isMotherAc =
      nodeToUse.internalData && nodeToUse.internalData.isMotherAc === 1;

    // Get metadata from opcode 102 data (regionalData.metadata)
    // Also check if metadata exists directly on the node (fallback)
    const metadata =
      nodeToUse.regionalData?.metadata || nodeToUse.metadata || {};

    // Log the actual node structure to see what we have
    console.log("🔍 NODE STRUCTURE IN DIALOG:", {
      globalId: node.globalId,
      hasStoredNode: !!storedNode,
      storedNodeHasMetadata: !!storedNode?.regionalData?.metadata,
      storedNodeMetadata: storedNode?.regionalData?.metadata,
      hasRegionalData: !!node.regionalData,
      regionalData: node.regionalData,
      hasMetadataOnNode: !!node.metadata,
      metadataOnNode: node.metadata,
      metadata: metadata,
      metadataType: typeof metadata,
      metadataKeys: Object.keys(metadata),
      "metadata.baroAltitude": metadata.baroAltitude,
      "metadata.groundSpeed": metadata.groundSpeed,
      "metadata.mach": metadata.mach,
    });

    // Directly access from metadata - don't default to NaN
    const baroAltitude = metadata.baroAltitude;
    const groundSpeed = metadata.groundSpeed;
    const mach = metadata.mach;

    // If values are still undefined, try accessing from node directly
    const finalBaroAltitude =
      baroAltitude !== undefined ? baroAltitude : (node as any).baroAltitude;
    const finalGroundSpeed =
      groundSpeed !== undefined ? groundSpeed : (node as any).groundSpeed;
    const finalMach = mach !== undefined ? mach : (node as any).mach;

    // Log extracted values immediately
    console.log("🔍 EXTRACTED VALUES:", {
      baroAltitude: baroAltitude,
      baroAltitudeType: typeof baroAltitude,
      finalBaroAltitude: finalBaroAltitude,
      groundSpeed: groundSpeed,
      groundSpeedType: typeof groundSpeed,
      finalGroundSpeed: finalGroundSpeed,
      mach: mach,
      machType: typeof mach,
      finalMach: finalMach,
    });

    // Debug logging to see what data is available
    console.log(`🔍 Green node dialog for ${node.globalId}:`, {
      callsign: callsign,
      isMotherAc: isMotherAc,
      hasInternalData: !!node.internalData,
      internalData: node.internalData,
      hasRegionalData: !!node.regionalData,
      regionalData: node.regionalData,
      hasMetadata: !!metadata && Object.keys(metadata).length > 0,
      metadata: metadata,
      baroAltitude: baroAltitude,
      groundSpeed: groundSpeed,
      mach: mach,
      fullNode: node, // Log entire node to see structure
    });

    // Detailed metadata logging
    console.log("📊 METADATA EXTRACTION DETAILS:", {
      globalId: node.globalId,
      "node.regionalData exists": !!node.regionalData,
      "node.regionalData.metadata exists": !!node.regionalData?.metadata,
      "metadata object": metadata,
      "metadata keys": Object.keys(metadata),
      "metadata.baroAltitude": metadata.baroAltitude,
      "metadata.groundSpeed": metadata.groundSpeed,
      "metadata.mach": metadata.mach,
      "node.baroAltitude (direct)": node.baroAltitude,
      "node.groundSpeed (direct)": node.groundSpeed,
      "node.mach (direct)": node.mach,
      "extracted baroAltitude": baroAltitude,
      "extracted groundSpeed": groundSpeed,
      "extracted mach": mach,
      "baroAltitude isNaN": isNaN(baroAltitude),
      "groundSpeed isNaN": isNaN(groundSpeed),
      "mach isNaN": isNaN(mach),
    });

    // Create dialog
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

    // Header
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
    header.textContent = `NETWORK NODE ${node.globalId}`;
    dialog.appendChild(header);

    // Callsign display (from opcode 102)
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

    // Mother aircraft indicator
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
      motherIndicator.textContent = "MOTHER AIRCRAFT";
      dialog.appendChild(motherIndicator);
    }

    // Position info
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

    // Metadata section (baroAltitude, groundSpeed, mach) from opcode 102
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

    // Use final values (with fallback)
    const valuesToDisplay = {
      baroAltitude: finalBaroAltitude,
      groundSpeed: finalGroundSpeed,
      mach: finalMach,
    };

    // Log values right before formatting
    console.log("📊 VALUES BEFORE FORMATTING:", {
      baroAltitude: valuesToDisplay.baroAltitude,
      baroAltitudeType: typeof valuesToDisplay.baroAltitude,
      baroAltitudeIsNaN: isNaN(valuesToDisplay.baroAltitude as number),
      baroAltitudeEquals32767: valuesToDisplay.baroAltitude === 32767,
      groundSpeed: valuesToDisplay.groundSpeed,
      groundSpeedType: typeof valuesToDisplay.groundSpeed,
      groundSpeedIsNaN: isNaN(valuesToDisplay.groundSpeed as number),
      mach: valuesToDisplay.mach,
      machType: typeof valuesToDisplay.mach,
      machIsNaN: isNaN(valuesToDisplay.mach as number),
    });

    // Show raw values as-is, convert directly to string
    const baroAltitudeDisplay =
      valuesToDisplay.baroAltitude != null
        ? String(valuesToDisplay.baroAltitude)
        : "";
    const groundSpeedDisplay =
      valuesToDisplay.groundSpeed != null
        ? String(valuesToDisplay.groundSpeed)
        : "";
    const machDisplay =
      valuesToDisplay.mach != null ? String(valuesToDisplay.mach) : "";

    // Log formatted values
    console.log("📊 FORMATTED VALUES:", {
      baroAltitudeDisplay,
      groundSpeedDisplay,
      machDisplay,
    });

    metadataSection.innerHTML = `
      <div style="color: #00ff00; font-weight: bold; margin-bottom: 8px;">METADATA:</div>
      <div>Baro Altitude: ${baroAltitudeDisplay}</div>
      <div>Ground Speed: ${groundSpeedDisplay}</div>
      <div>Mach: ${machDisplay}</div>
    `;
    dialog.appendChild(metadataSection);

    // Close button
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
      this.hideGreenNodeDialog();
    });
    dialog.appendChild(closeBtn);

    // Close dialog when clicking outside
    const closeOnOutsideClick = (e: MouseEvent) => {
      if (!dialog.contains(e.target as Node)) {
        this.hideGreenNodeDialog();
        document.removeEventListener("click", closeOnOutsideClick);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeOnOutsideClick);
    }, 0);

    document.body.appendChild(dialog);
    this.redNodeDialog = dialog; // Reuse the same dialog reference
    this.dialogOpenForNodeId = node.globalId;

    // Adjust position if dialog goes off screen
    this.updateDialogPosition(screenPoint);
  }

  /**
   * Hide the green node dialog
   */
  private hideGreenNodeDialog(): void {
    if (this.redNodeDialog) {
      this.redNodeDialog.remove();
      this.redNodeDialog = null;
      this.dialogOpenForNodeId = null;
    }
  }

  /**
   * Check if there are UDP data points
   */
  hasDataPoints(): boolean {
    return this.udpDataPoints.size > 0;
  }

  /**
   * Get all network members (nodes with opcode 102 data)
   */
  getNetworkMembers(): UDPDataPoint[] {
    return Array.from(this.udpDataPoints.values()).filter(
      (point) =>
        point.callsign !== undefined ||
        point.internalData !== undefined ||
        point.regionalData !== undefined ||
        point.battleGroupData !== undefined
    );
  }

  /**
   * Get all UDP data points
   */
  getAllNodes(): UDPDataPoint[] {
    return Array.from(this.udpDataPoints.values());
  }

  /**
   * Get the UDP data points map (for sharing with other components)
   */
  getAllNodesMap(): Map<number, UDPDataPoint> {
    return this.udpDataPoints;
  }
}
