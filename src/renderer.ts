import "./index.css";
import { MapManager } from "./map";
import { Aircraft, AircraftType } from "./types";
import { ThreatDialog } from "./components/ThreatDialog";
import { RightSidebar } from "./components/RightSidebar";
import { DebugInfo } from "./components/DebugInfo";
import { AdaptiveRadarCircles } from "./components/AdaptiveRadarCircles";
import { AircraftRenderer } from "./components/AircraftRenderer";
import { UDPNodesManager, UDPDataPoint } from "./components/UDPNodesManager";
import { NetworkMembersTable } from "./components/NetworkMembersTable";
import { EngagementManager } from "./components/EngagementManager";
import { EngagementDisplay } from "./components/EngagementDisplay";
import { Screen104Display } from "./components/Screen104Display";
import { GeoMessageManager } from "./components/GeoMessageManager";

class TacticalDisplayClient {
  private aircraft: Map<string, Aircraft> = new Map();
  private nodeId: string = "";
  private zoomLevel: number = 10;
  private showOtherNodes: boolean = true;
  private mapManager: MapManager | null = null;
  private centerMode: "mother" | "self" = "mother";
  private viewMode: "normal" | "self-only" | "network-103" | "engagement-104" =
    "normal";

  // UDP Nodes Manager
  private udpNodesManager: UDPNodesManager;

  // Components
  private threatDialog: ThreatDialog;
  private rightSidebar: RightSidebar;
  private debugInfo: DebugInfo;
  private adaptiveRadarCircles: AdaptiveRadarCircles;
  private aircraftRenderer: AircraftRenderer;
  private networkMembersTable: NetworkMembersTable;
  private engagementManager: EngagementManager;
  private engagementDisplay: EngagementDisplay;
  private screen104Display: Screen104Display;
  private geoMessageManager: GeoMessageManager;
  private simulationSystem: {
    isRunning: boolean;
    startTime: number;
    duration: number;
    phase: "warmup" | "engagement" | "maneuver" | "resolution";
    lastPhaseChange: number;
    threatSpawnTimer: number;
    lastThreatSpawn: number;
    activeThreats: Set<string>;
    engagementCount: number;
    lastMapJump: number;
    mapJumpInterval: number;
  } = {
    isRunning: false,
    startTime: 0,
    duration: 150000,
    phase: "warmup",
    lastPhaseChange: 0,
    threatSpawnTimer: 0,
    lastThreatSpawn: 0,
    activeThreats: new Set(),
    engagementCount: 0,
    lastMapJump: 0,
    mapJumpInterval: 20000,
  };
  private warningSystem: {
    threatProximityThreshold: number;
    motherDistanceThreshold: number;
    activeWarnings: Set<string>;
    lastWarningCheck: number;
  } = {
    threatProximityThreshold: 0.02,
    motherDistanceThreshold: 0.05,
    activeWarnings: new Set(),
    lastWarningCheck: 0,
  };

  constructor() {
    this.udpNodesManager = new UDPNodesManager(this.mapManager);
    this.threatDialog = new ThreatDialog(
      (aircraft) => this.lockThreat(aircraft),
      (aircraft) => this.executeThreat(aircraft)
    );
    this.rightSidebar = new RightSidebar();
    this.debugInfo = new DebugInfo();
    this.adaptiveRadarCircles = new AdaptiveRadarCircles();
    this.aircraftRenderer = new AircraftRenderer((aircraft) =>
      this.showAircraftDetails(aircraft)
    );
    this.networkMembersTable = new NetworkMembersTable();
    this.engagementManager = new EngagementManager(this.mapManager);
    this.engagementDisplay = new EngagementDisplay();
    this.screen104Display = new Screen104Display();
    this.geoMessageManager = new GeoMessageManager(this.mapManager);

    this.initialize();

    // Enable dialogs for network nodes on initialization (101 screen is default)
    this.udpNodesManager.setDialogsEnabled(true);
  }

  private initialize() {
    this.nodeId = this.generateId();

    // Handle window resize to update map
    window.addEventListener("resize", () => {
      if (this.mapManager) {
        this.mapManager.resize();
      }
    });

    // Listen for map center changes
    window.addEventListener("map-center-changed", () => {
      if (this.udpNodesManager.hasDataPoints() && this.mapManager) {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
        this.engagementManager.updateLines();
      }
      // Update map center display
      this.updateMapCenterDisplay();
    });

    // Listen for map zoom changes
    window.addEventListener("map-zoom-changed", () => {
      const currentZoom = this.mapManager?.getZoom();
      if (typeof currentZoom === "number" && Number.isFinite(currentZoom)) {
        this.zoomLevel = currentZoom;
      }
      this.updateZoomDisplay();
      if (this.udpNodesManager.hasDataPoints() && this.mapManager) {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
        this.engagementManager.updateLines();
      }
    });

    // Listen for UDP data from main process
    if (typeof window !== "undefined" && (window as any).udp) {
      (window as any).udp.onDataFromMain((data: UDPDataPoint[]) => {
        this.udpNodesManager.handleUDPData(data);
        // Update network members table
        const networkMembers = this.udpNodesManager.getNetworkMembers();
        this.networkMembersTable.update(networkMembers);

        // Handle opcode 103 engagement data
        const engagementData = data.filter((point) => point.opcode === 103);
        if (engagementData.length > 0) {
          // Update engagement manager with UDP data points for position lookup
          this.engagementManager.setUDPDataPoints(
            this.udpNodesManager.getAllNodesMap()
          );
          this.engagementManager.updateEngagements(engagementData as any);

          // Update 104 screen display ONLY if in 104 mode
          if (this.viewMode === "engagement-104") {
            const engagements = this.engagementManager.getEngagements();
            const allNodesMap = this.udpNodesManager.getAllNodesMap();
            // Only update if display exists
            const display = document.getElementById("screen-104-display");
            if (display) {
              this.screen104Display.update(engagements, allNodesMap);
            }
          }
        }

        // Handle opcode 122 geo-referenced messages
        const geoMessageData = data.filter((point) => point.opcode === 122);
        if (geoMessageData.length > 0) {
          this.geoMessageManager.updateMessages(geoMessageData as any);
        }
      });
    }

    this.updateUI();
  }

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

  private getNearestThreats(
    centerAircraft: Aircraft,
    maxThreats: number = 3
  ): Array<{ aircraft: Aircraft; distance: number; distanceNM: number }> {
    const threats: Array<{
      aircraft: Aircraft;
      distance: number;
      distanceNM: number;
    }> = [];

    this.aircraft.forEach((aircraft, id) => {
      if (aircraft.aircraftType === "threat") {
        const distance = this.calculateDistanceBetweenAircraft(
          centerAircraft,
          aircraft
        );
        const distanceNM = distance;
        threats.push({ aircraft, distance, distanceNM });
      }
    });

    return threats.sort((a, b) => a.distance - b.distance).slice(0, maxThreats);
  }

  private toggleThreatDialog() {
    // Dialogs are disabled globally; no-op.
    return;
  }

  private updateUI() {
    const container = document.getElementById("nodes-container");
    if (!container) return;

    container.innerHTML = "";

    let centerAircraft: Aircraft | null = null;

    this.rightSidebar.create(
      container,
      this.viewMode,
      this.zoomLevel,
      this.showOtherNodes,
      this.centerMode,
      this.mapManager,
      (mode) => this.setViewMode(mode),
      () => this.zoomIn(),
      () => this.zoomOut(),
      () => this.toggleOtherNodesVisibility(),
      () => {
        if (this.mapManager) {
          this.mapManager.toggleMapVisibility();
        }
      },
      () => this.toggleCenterMode(),
      () => this.toggleThreatDialog()
    );

    const visualizationArea = document.createElement("div");
    visualizationArea.id = "visualization-area";
    const visualizationBackground =
      this.viewMode === "normal" ? "#000000" : "transparent";
    visualizationArea.style.cssText = `
      position: relative;
      width: calc(100% - 60px);
      height: calc(100vh - 60px);
      background: ${visualizationBackground};
      overflow: hidden;
      margin: 0;
      padding: 0;
      margin-right: 60px;
      margin-bottom: 60px;
      box-sizing: border-box;
      cursor: default;
      user-select: none;
    `;

    container.appendChild(visualizationArea);

    // Create map center display in top left
    this.createMapCenterDisplay(visualizationArea);

    // Determine center aircraft (for rendering, not for map center)
    if (this.aircraft.size > 0) {
      const aircraftArray = Array.from(this.aircraft.values());
      if (this.centerMode === "mother") {
        centerAircraft =
          aircraftArray.find((a) => a.aircraftType === "mother") ||
          aircraftArray[0];
      } else {
        centerAircraft = this.aircraft.get(this.nodeId) || aircraftArray[0];
      }
    }

    // Create map using MapManager - center on nodes if available, otherwise center of India
    const defaultCenterLat = 20.5937; // Center of India
    const defaultCenterLng = 78.9629; // Center of India

    // Calculate center from UDP nodes if available
    const nodesCenter = this.udpNodesManager.calculateNodesCenter();
    const initialLat = nodesCenter ? nodesCenter.lat : defaultCenterLat;
    const initialLng = nodesCenter ? nodesCenter.lng : defaultCenterLng;

    if (!this.mapManager) {
      this.mapManager = new MapManager(
        visualizationArea,
        initialLat,
        initialLng
      );
      // Update map center display after map is created
      setTimeout(() => this.updateMapCenterDisplay(), 100);
      this.udpNodesManager.setMapManager(this.mapManager);
      this.networkMembersTable.setMapManager(this.mapManager);
      this.engagementManager.setMapManager(this.mapManager);
      this.geoMessageManager.setMapManager(this.mapManager);

      // Initialize engagement manager containers
      this.engagementManager.initializeContainers(visualizationArea);
      if (this.viewMode !== "network-103") {
        this.engagementManager.createEngagementList(container);
      }

      // Set callbacks for red node actions
      this.udpNodesManager.setRedNodeCallbacks(
        (node) => {
          // Handle lock action
          console.log(`🔒 Lock action triggered for node ${node.globalId}`);
          // TODO: Implement lock functionality
        },
        (node) => {
          // Handle execute action
          console.log(`💥 Execute action triggered for node ${node.globalId}`);
          // TODO: Implement execute functionality
        }
      );

      // Initialize UDP nodes containers
      this.udpNodesManager.initializeContainers(visualizationArea);

      // Update UDP dots when map loads
      this.mapManager.getMapboxMap()?.on("load", () => {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
        this.engagementManager.updateLines();
        // Re-update geo messages when map loads
        const allData = this.udpNodesManager.getAllNodes();
        const geoMessages = allData.filter((point) => point.opcode === 122);
        if (geoMessages.length > 0) {
          this.geoMessageManager.updateMessages(geoMessages as any);
        }
      });

      // Update connection lines on map move/zoom for smooth updates
      this.mapManager.getMapboxMap()?.on("move", () => {
        if (this.udpNodesManager.hasDataPoints()) {
          this.udpNodesManager.updateUDPDots();
          this.udpNodesManager.updateConnectionLines();
          this.udpNodesManager.updateRadarCircles();
          this.engagementManager.updateLines();
        }
      });

      this.mapManager.getMapboxMap()?.on("zoom", () => {
        if (this.udpNodesManager.hasDataPoints()) {
          this.udpNodesManager.updateUDPDots();
          this.udpNodesManager.updateConnectionLines();
          this.udpNodesManager.updateRadarCircles();
        }
      });

      // Also update immediately if map is already loaded
      if (this.mapManager.getMapboxMap()?.loaded) {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
      }

      // Map visibility per screen:
      // - 101 (normal) and 103 (network-103): map hidden
      // - 102 (self-only): map visible
      const shouldShowMap = this.viewMode === "self-only";
      const isVisible = this.mapManager.isMapVisible();
      if (shouldShowMap && !isVisible) {
        this.mapManager.toggleMapVisibility();
      } else if (!shouldShowMap && isVisible) {
        this.mapManager.toggleMapVisibility();
      }
    } else {
      this.mapManager.reinitializeInContainer(visualizationArea);

      // Reinitialize engagement manager containers and list
      this.engagementManager.initializeContainers(visualizationArea);
      if (this.viewMode !== "network-103") {
        this.engagementManager.createEngagementList(container);
        // Refresh engagement list display with current engagements
        this.engagementManager.refreshEngagementList();
      }

      // Re-setup event listeners for the reinitialized map
      this.mapManager.getMapboxMap()?.on("load", () => {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
        this.engagementManager.updateLines();
        // Re-update geo messages when map loads after reinitialization
        const allData = this.udpNodesManager.getAllNodes();
        const geoMessages = allData.filter((point) => point.opcode === 122);
        if (geoMessages.length > 0) {
          // Use UDP data if available
          this.geoMessageManager.updateMessages(geoMessages as any);
        } else {
          // Otherwise recreate from stored messages
          this.geoMessageManager.recreateMarkers();
        }
      });

      this.mapManager.getMapboxMap()?.on("move", () => {
        if (this.udpNodesManager.hasDataPoints()) {
          this.udpNodesManager.updateUDPDots();
          this.udpNodesManager.updateConnectionLines();
          this.udpNodesManager.updateRadarCircles();
          this.engagementManager.updateLines();
        }
      });

      this.mapManager.getMapboxMap()?.on("zoom", () => {
        if (this.udpNodesManager.hasDataPoints()) {
          this.udpNodesManager.updateUDPDots();
          this.udpNodesManager.updateConnectionLines();
          this.udpNodesManager.updateRadarCircles();
          this.engagementManager.updateLines();
        }
      });

      // Update UDP nodes manager with new container
      this.udpNodesManager.initializeContainers(visualizationArea);

      // Center map on nodes if available, otherwise keep current center
      if (nodesCenter) {
        const currentZoom = this.mapManager.getZoom() || 10;
        this.mapManager.updateCenter(
          nodesCenter.lat,
          nodesCenter.lng,
          currentZoom
        );
      }
      // If no nodes, keep the current map center (don't force it to a specific location)

      // Update immediately if map is already loaded
      if (this.mapManager.getMapboxMap()?.loaded) {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
        this.engagementManager.updateLines();

        // If in 102 screen, ensure compass is created and node is visible
        if (this.viewMode === "self-only") {
          setTimeout(() => {
            // Force update of nodes to ensure they're rendered
            this.udpNodesManager.updateUDPDots();
            // Recreate compass after containers are initialized
            this.udpNodesManager.recreateCompassIfNeeded();
          }, 200);
        }
        // Re-update geo messages if map is already loaded
        const allData = this.udpNodesManager.getAllNodes();
        const geoMessages = allData.filter((point) => point.opcode === 122);
        if (geoMessages.length > 0) {
          // Use UDP data if available
          this.geoMessageManager.updateMessages(geoMessages as any);
        } else {
          // Otherwise recreate from stored messages
          this.geoMessageManager.recreateMarkers();
        }
      }

      // Map visibility per screen:
      // - 101 (normal) and 103 (network-103): map hidden
      // - 102 (self-only): map visible
      const shouldShowMap = this.viewMode === "self-only";
      const isVisible = this.mapManager.isMapVisible();
      if (shouldShowMap && !isVisible) {
        this.mapManager.toggleMapVisibility();
      } else if (!shouldShowMap && isVisible) {
        this.mapManager.toggleMapVisibility();
      }
    }

    // Only create adaptive radar circles if UDP data is not available
    // UDP system provides its own radar circles via updateRadarCircles()
    if (centerAircraft && !this.udpNodesManager.hasDataPoints()) {
      this.adaptiveRadarCircles.create(
        visualizationArea,
        centerAircraft,
        this.aircraft,
        this.zoomLevel,
        (deltaLat, deltaLng) => this.convertToCartesian(deltaLat, deltaLng),
        (adaptiveRange, maxDistance) => {
          // Range info update removed
        }
      );
    }

    if (!centerAircraft) {
      // No center aircraft available, skip rendering
      this.debugInfo.create(container, this.aircraft, this.nodeId);
      return;
    }

    // Map center is managed by UDP nodes or user interaction

    const centerElement = this.aircraftRenderer.createAircraftElement(
      centerAircraft,
      true
    );

    const aircraftSize = 20;
    const halfSize = aircraftSize / 2;

    centerElement.style.cssText = `
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      margin-top: -${halfSize}px !important;
      margin-left: -${halfSize}px !important;
      z-index: 10;
      transform: none !important;
      transition: none;
    `;

    centerElement.setAttribute("data-aircraft-id", centerAircraft.id);
    visualizationArea.appendChild(centerElement);

    console.log(
      `🎯 Center aircraft positioned: ${centerAircraft.callSign} (${centerAircraft.aircraftType}) at screen center`
    );
    console.log(
      `🎯 Aircraft size: ${aircraftSize}px, half-size: ${halfSize}px`
    );
    console.log(
      `🎯 Positioning: top: 50%, left: 50%, margin-top: -${halfSize}px, margin-left: -${halfSize}px`
    );

    // In 102 (self-only) screen, render a central compass over the map
    if (this.viewMode === "self-only") {
      this.renderCompassOverlay(visualizationArea, centerAircraft.heading);
    }

    console.log(
      `🎨 Rendering ${this.aircraft.size} aircraft (center: ${centerAircraft.callSign})`
    );
    this.aircraft.forEach((aircraft, id) => {
      // In 102 screen (self-only view), show only the centered self node
      if (this.viewMode === "self-only") {
        return;
      }

      console.log(
        `🎨 Processing aircraft: ${aircraft.callSign} (${aircraft.aircraftType})`
      );
      if (id === centerAircraft.id) {
        return;
      }

      if (this.viewMode === "self-only" && aircraft.aircraftType !== "self") {
        console.log(
          `🎨 Skipping non-self aircraft in self-only mode: ${aircraft.callSign}`
        );
        return;
      }

      console.log(
        `🎨 Rendering aircraft: ${aircraft.callSign} (${aircraft.aircraftType}) with fixed 20px icon`
      );

      const aircraftElement = this.aircraftRenderer.createAircraftElement(
        aircraft,
        false
      );

      const relativeLat = aircraft.lat - centerAircraft.lat;
      const relativeLng = aircraft.lng - centerAircraft.lng;

      const cartesianCoords = this.convertToCartesian(relativeLat, relativeLng);
      const x = cartesianCoords.x + 50;
      const y = cartesianCoords.y + 50;

      console.log(
        `🎨 Aircraft ${aircraft.callSign} position: x=${x.toFixed(1)}%, y=${y.toFixed(1)}%`
      );

      aircraftElement.style.position = "absolute";
      aircraftElement.style.top = `${y}%`;
      aircraftElement.style.left = `${x}%`;
      aircraftElement.style.transform = "translate(-50%, -50%)";
      aircraftElement.setAttribute("data-aircraft-id", id);

      if (aircraft.aircraftType === "threat") {
        aircraftElement.style.filter = "brightness(1.5)";
        const iconContainer = aircraftElement.querySelector(
          '[data-icon-type="threat"]'
        ) as HTMLElement;
        if (iconContainer) {
          iconContainer.style.animation = "pulse 1s infinite";
        }
      }

      visualizationArea.appendChild(aircraftElement);
    });

    this.debugInfo.create(container, this.aircraft, this.nodeId);

    // 103 screen: show detailed network node info (same fields as green-node dialog)
    const existingDetailsPanel = document.getElementById(
      "network-details-panel"
    );
    if (existingDetailsPanel) {
      existingDetailsPanel.remove();
    }

    if (this.viewMode === "network-103") {
      const panel = document.createElement("div");
      panel.id = "network-details-panel";
      panel.style.cssText = `
        position: fixed;
        left: 10px;
        bottom: 10px;
        width: 360px;
        max-height: 60vh;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #00ff00;
        border-radius: 8px;
        padding: 10px 12px;
        color: #ffffff;
        font-family: monospace;
        font-size: 11px;
        z-index: 150;
        box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
        overflow-y: auto;
      `;

      const header = document.createElement("div");
      header.textContent = "NETWORK NODES (103)";
      header.style.cssText = `
        font-weight: bold;
        font-size: 13px;
        margin-bottom: 8px;
        text-align: center;
        color: #00ff00;
        border-bottom: 1px solid #00ff00;
        padding-bottom: 4px;
      `;
      panel.appendChild(header);

      if (networkMembers.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "No network nodes available";
        empty.style.cssText = `
          text-align: center;
          color: #cccccc;
          margin-top: 8px;
        `;
        panel.appendChild(empty);
      } else {
        networkMembers.forEach((node: UDPDataPoint) => {
          const callsign = node.callsign || "N/A";
          const isMotherAc =
            node.internalData && node.internalData.isMotherAc === 1;
          const metadata = node.regionalData?.metadata || {};
          const baroAltitude =
            metadata.baroAltitude !== undefined ? metadata.baroAltitude : NaN;
          const groundSpeed =
            metadata.groundSpeed !== undefined ? metadata.groundSpeed : NaN;
          const mach = metadata.mach !== undefined ? metadata.mach : NaN;

          const baroAltitudeDisplay = isNaN(baroAltitude)
            ? "NaN"
            : `${baroAltitude} ft`;
          const groundSpeedDisplay = isNaN(groundSpeed)
            ? "NaN"
            : `${groundSpeed} kt`;
          const machDisplay = isNaN(mach) ? "NaN" : `${mach}`;

          const nodeBlock = document.createElement("div");
          nodeBlock.style.cssText = `
            border: 1px solid rgba(0, 255, 0, 0.4);
            border-radius: 6px;
            padding: 6px 8px;
            margin-bottom: 6px;
            background: rgba(0, 0, 0, 0.7);
          `;

          nodeBlock.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="color: #00ff00; font-weight: bold;">GID: ${
                node.globalId ?? "N/A"
              }</span>
              <span style="color: ${
                isMotherAc ? "#ffaa00" : "#cccccc"
              }; font-size: 10px;">
                ${isMotherAc ? "MOTHER" : ""}
              </span>
            </div>
            <div style="margin-bottom: 4px;">
              <span style="color: #00ff00;">CALLSIGN:</span>
              <span style="margin-left: 4px;">${callsign}</span>
            </div>
            <div style="margin-bottom: 4px; color: #cccccc;">
              <div>Lat: ${node.latitude?.toFixed(6) ?? "N/A"}°</div>
              <div>Lng: ${node.longitude?.toFixed(6) ?? "N/A"}°</div>
              ${
                node.altitude !== undefined
                  ? `<div>Alt: ${node.altitude} ft</div>`
                  : ""
              }
            </div>
            <div style="color: #cccccc; font-size: 10px;">
              <div><span style="color:#00ff00;">Baro Alt:</span> ${baroAltitudeDisplay}</div>
              <div><span style="color:#00ff00;">GS:</span> ${groundSpeedDisplay}</div>
              <div><span style="color:#00ff00;">Mach:</span> ${machDisplay}</div>
            </div>
          `;

          panel.appendChild(nodeBlock);
        });
      }

      container.appendChild(panel);
    }

    // 104 screen: show opcode 103 engagement data using dedicated component
    if (this.viewMode === "engagement-104") {
      console.log("🎯🎯🎯 104 SCREEN MODE DETECTED - Creating display NOW!");
      console.log("🎯 screen104Display exists:", !!this.screen104Display);
      console.log("🎯 document.body exists:", !!document.body);
      console.log("🎯 Current view mode:", this.viewMode);

      const engagements = this.engagementManager.getEngagements();
      const allNodesMap = this.udpNodesManager.getAllNodesMap();

      console.log("🎯 104 Screen: Creating Screen104Display", {
        engagementsCount: engagements.length,
        nodesMapSize: allNodesMap.size,
        viewMode: this.viewMode,
        screen104DisplayExists: !!this.screen104Display,
      });
      console.log("🎯 Engagement data:", engagements);

      // Create the 104 screen display - FORCE IT
      if (!this.screen104Display) {
        console.error("❌ screen104Display is NULL! Recreating...");
        this.screen104Display = new Screen104Display();
      }

      try {
        console.log("🎯 Calling screen104Display.create()...");
        this.screen104Display.create();
        console.log("✅✅✅ Screen104Display.create() completed!");

        // Hide map and other elements that might cover the display
        const visualizationArea = document.getElementById("visualization-area");
        if (visualizationArea) {
          console.log("🗑️ Hiding visualization area for 104 screen");
          visualizationArea.style.opacity = "0.05";
          visualizationArea.style.pointerEvents = "none";
        }

        // Force immediate update
        console.log("🎯 Calling screen104Display.update() immediately...");
        this.screen104Display.update(engagements, allNodesMap);
        console.log("✅✅✅ Screen104Display.update() completed!");

        // Verify it's in DOM
        setTimeout(() => {
          const display = document.getElementById("screen-104-display");
          if (display) {
            const rect = display.getBoundingClientRect();
            console.log("✅✅✅ Display FOUND in DOM:", {
              id: display.id,
              offsetWidth: display.offsetWidth,
              offsetHeight: display.offsetHeight,
              top: rect.top,
              left: rect.left,
              zIndex: window.getComputedStyle(display).zIndex,
              display: window.getComputedStyle(display).display,
              visibility: window.getComputedStyle(display).visibility,
              opacity: window.getComputedStyle(display).opacity,
            });

            // Log all elements with high z-index that might be covering it
            const allElements = Array.from(
              document.body.getElementsByTagName("*")
            );
            const highZElements = allElements.filter((el) => {
              const zIndex = parseInt(
                window.getComputedStyle(el as HTMLElement).zIndex
              );
              return !isNaN(zIndex) && zIndex > 10000;
            });
            console.log(
              "🔍 Elements with z-index > 10000:",
              highZElements.map((el) => ({
                tag: el.tagName,
                id: el.id,
                zIndex: window.getComputedStyle(el as HTMLElement).zIndex,
              }))
            );
          } else {
            console.error("❌❌❌ Display NOT FOUND in DOM after creation!");
          }

          // Update again after delay
          this.screen104Display.update(engagements, allNodesMap);
        }, 300);
      } catch (error) {
        console.error(
          "❌❌❌ CRITICAL ERROR creating Screen104Display:",
          error
        );
        console.error("Error stack:", (error as Error).stack);
      }
    } else {
      // Remove 104 screen display when not in 104 mode
      console.log("🗑️ Not in 104 mode, destroying display");
      if (this.screen104Display) {
        this.screen104Display.destroy();
      }
      // Restore visualization area opacity when leaving 104 mode
      const visualizationArea = document.getElementById("visualization-area");
      if (visualizationArea) {
        visualizationArea.style.opacity = "1";
        visualizationArea.style.pointerEvents = "auto";
      }
    }

    this.checkWarnings();
  }

  private createMapCenterDisplay(container: HTMLElement): void {
    // Remove existing display if any
    const existing = document.getElementById("map-center-display");
    if (existing) {
      existing.remove();
    }

    const display = document.createElement("div");
    display.id = "map-center-display";
    display.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      border: 2px solid #00ff00;
      border-radius: 6px;
      padding: 8px 12px;
      color: #ffffff;
      font-family: monospace;
      font-size: 11px;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
    `;
    container.appendChild(display);
    this.updateMapCenterDisplay();
  }

  private updateMapCenterDisplay(): void {
    const display = document.getElementById("map-center-display");
    if (!display || !this.mapManager) return;

    // Hide map center display in 102 screen
    if (this.viewMode === "self-only") {
      display.style.display = "none";
      return;
    } else {
      display.style.display = "block";
    }

    const center = this.mapManager.getCenter();
    if (center) {
      display.innerHTML = `
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 4px; font-size: 12px;">MAP CENTER</div>
        <div style="color: #ffffff; line-height: 1.4;">
          <div>Lat: <span style="color: #00ff00; font-weight: bold;">${center.lat.toFixed(6)}°</span></div>
          <div>Lng: <span style="color: #00ff00; font-weight: bold;">${center.lng.toFixed(6)}°</span></div>
        </div>
      `;
    } else {
      display.innerHTML = `
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 4px; font-size: 12px;">MAP CENTER</div>
        <div style="color: #888888;">Initializing...</div>
      `;
    }
  }

  private setViewMode(
    mode: "normal" | "self-only" | "network-103" | "engagement-104"
  ) {
    const previousMode = this.viewMode;
    this.viewMode = mode;

    console.log("🔄 setViewMode called:", {
      previousMode,
      newMode: mode,
      isSwitchingTo104: mode === "engagement-104",
      isSwitchingAwayFrom104:
        previousMode === "engagement-104" && mode !== "engagement-104",
    });

    // Enable dialogs for network nodes (green nodes) on all screens
    this.udpNodesManager.setDialogsEnabled(true);

    // Enable radar circles only in 101 screen; hide them in 102/103
    this.udpNodesManager.setRadarCirclesEnabled(this.viewMode === "normal");

    // Show UDP nodes/lines: in 101 show all, in 102 show only mother aircraft (or globalId 10)
    if (this.viewMode === "normal") {
      this.udpNodesManager.setNodesVisible(true);
      this.udpNodesManager.setShowOnlyMotherAircraft(false);
    } else if (this.viewMode === "self-only") {
      // 102 screen: show only mother aircraft (or globalId 10)
      this.udpNodesManager.setNodesVisible(true);
      this.udpNodesManager.setShowOnlyMotherAircraft(true);
    } else {
      // 103 and 104 screens: hide nodes
      this.udpNodesManager.setNodesVisible(false);
      this.udpNodesManager.setShowOnlyMotherAircraft(false);
    }

    // Center logic:
    // 101 screen centered on mother, 102 centered on mother/globalId10, 103 & 104 screens centered on self
    this.centerMode =
      this.viewMode === "normal" || this.viewMode === "self-only"
        ? "mother"
        : ("self" as "self");

    // Hide map in 104 screen (show only engagement display)
    if (this.mapManager) {
      const mapElement = document.getElementById("map-background");
      if (mapElement) {
        if (mode === "engagement-104") {
          mapElement.style.opacity = "0.1"; // Dim the map
        } else {
          mapElement.style.opacity = "1"; // Show map normally
        }
      }
    }

    // IMPORTANT: Destroy 104 screen display ONLY if switching AWAY from 104 mode
    // previousMode was 104, but new mode is NOT 104
    if (previousMode === "engagement-104" && mode !== "engagement-104") {
      console.log(
        "🗑️ Switching away from 104 mode, destroying Screen104Display"
      );
      this.screen104Display.destroy();
    }

    this.updateUI();

    const button101 = document.querySelector(
      'button[data-view-mode="101"]'
    ) as HTMLElement;
    const button102 = document.querySelector(
      'button[data-view-mode="102"]'
    ) as HTMLElement;
    const button103 = document.querySelector(
      'button[data-view-mode="103"]'
    ) as HTMLElement;
    const button104 = document.querySelector(
      'button[data-view-mode="104"]'
    ) as HTMLElement;

    if (button101) {
      button101.style.background = mode === "normal" ? "#44ff44" : "#333";
    }
    if (button102) {
      button102.style.background = mode === "self-only" ? "#ff8844" : "#333";
    }
    if (button103) {
      button103.style.background = mode === "network-103" ? "#00c4ff" : "#333";
    }
    if (button104) {
      button104.style.background =
        mode === "engagement-104" ? "#ff4dff" : "#333";
    }
  }

  private zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel + 1, 13);
    if (this.mapManager) {
      const center = this.mapManager.getCenter();
      if (center) {
        this.mapManager.updateCenter(center.lat, center.lng, this.zoomLevel);
      } else {
        this.mapManager.setZoom(this.zoomLevel);
      }
    }
    this.updateZoomDisplay();
  }

  private zoomOut() {
    if (this.zoomLevel <= 1) {
      return;
    }
    this.zoomLevel = Math.max(this.zoomLevel - 1, 1);
    if (this.mapManager) {
      const center = this.mapManager.getCenter();
      if (center) {
        this.mapManager.updateCenter(center.lat, center.lng, this.zoomLevel);
      } else {
        this.mapManager.setZoom(this.zoomLevel);
      }
    }
    this.updateZoomDisplay();
  }

  private updateZoomDisplay() {
    this.rightSidebar.updateZoomDisplay(this.zoomLevel);
  }

  private toggleOtherNodesVisibility() {
    this.showOtherNodes = !this.showOtherNodes;
    console.log(
      `Other nodes visibility: ${this.showOtherNodes ? "SHOW" : "HIDE"}`
    );

    const buttons = document.querySelectorAll("button");
    buttons.forEach((button) => {
      if (button.textContent === "HIDE" || button.textContent === "SHOW") {
        button.textContent = this.showOtherNodes ? "HIDE" : "SHOW";
        button.style.background = this.showOtherNodes ? "#ff4444" : "#44ff44";
      }
    });

    this.updateUI();
  }

  private checkWarnings() {
    const selfAircraft = this.aircraft.get(this.nodeId);
    if (!selfAircraft) return;

    this.warningSystem.activeWarnings.clear();

    this.checkThreatProximity(selfAircraft);

    this.updateWarningDisplay();
  }

  private checkThreatProximity(selfAircraft: Aircraft) {
    this.aircraft.forEach((aircraft, id) => {
      if (id === this.nodeId || aircraft.aircraftType !== "threat") return;

      const distance = this.calculateDistanceBetweenAircraft(
        selfAircraft,
        aircraft
      );

      if (distance <= this.warningSystem.threatProximityThreshold * 54) {
        const warningId = `THREAT_PROXIMITY_${id}`;
        this.warningSystem.activeWarnings.add(warningId);
        console.log(
          `⚠️ THREAT WARNING: ${aircraft.callSign} at ${(distance * 54).toFixed(1)}NM`
        );
      }
    });
  }

  private calculateDistanceBetweenAircraft(
    aircraft1: Aircraft,
    aircraft2: Aircraft
  ): number {
    return this.calculateDistance(
      aircraft1.lat,
      aircraft1.lng,
      aircraft2.lat,
      aircraft2.lng
    );
  }

  private updateWarningDisplay() {
    const existingWarning = document.getElementById("warning-display");
    if (existingWarning) {
      existingWarning.remove();
    }

    if (this.warningSystem.activeWarnings.size > 0) {
      console.log(
        `⚠️ Active warnings: ${Array.from(this.warningSystem.activeWarnings).join(", ")}`
      );
    }
  }

  private toggleCenterMode() {
    this.centerMode = this.centerMode === "mother" ? "self" : "mother";
    const selfAircraft = this.aircraft.get(this.nodeId);
    if (this.centerMode === "self" && !selfAircraft) {
      console.warn(
        "⚠️ Cannot switch to self-centered mode: self aircraft not found"
      );
      this.centerMode = "mother";
      return;
    }

    const centerButtons = document.querySelectorAll("button");
    centerButtons.forEach((button) => {
      if (button.textContent === "MTR" || button.textContent === "SELF") {
        button.textContent = this.centerMode === "mother" ? "MTR" : "SELF";
        button.style.background =
          this.centerMode === "mother" ? "#4488ff" : "#ff8844";
        console.log(
          `🎯 Updated center button to: ${button.textContent} (${this.centerMode === "mother" ? "blue" : "orange"})`
        );
      }
    });
    this.updateUI();
  }

  private showAircraftDetails(aircraft: Aircraft) {
    // Aircraft details dialog is disabled globally; no-op.
    return;
  }

  private lockThreat(aircraft: Aircraft) {
    aircraft.isLocked = true;

    const lockButtons = document.querySelectorAll("button");
    lockButtons.forEach((button) => {
      if (button.textContent?.includes("LOCK")) {
        button.textContent = "LOCKED";
        button.style.background = "#00ff00";
        button.style.color = "#000000";
        button.style.fontWeight = "bold";

        // Button state will remain locked until next interaction
      }
    });

    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 136, 0, 0.95);
      color: white;
      padding: 20px 30px;
      border-radius: 8px;
      border: 2px solid #ffaa00;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      z-index: 2000;
      text-align: center;
      box-shadow: 0 0 20px rgba(255, 136, 0, 0.5);
    `;
    notification.innerHTML = `
      TARGET LOCKED<br>
      <span style="font-size: 14px;">${aircraft.callSign}</span><br>
      <span style="font-size: 12px; color: #ffff00;">Tracking active</span>
    `;
    document.body.appendChild(notification);

    const aircraftElement = document.querySelector(
      `[data-aircraft-id="${aircraft.id}"]`
    ) as HTMLElement;
    if (aircraftElement) {
      aircraftElement.style.boxShadow = "0 0 30px #ffaa00, 0 0 50px #ff8800";
      aircraftElement.style.border = "3px solid #ffaa00";

      this.aircraftRenderer.updateAircraftIcon(aircraftElement, aircraft);
    }

    // Notification will remain until user closes it or it's removed by other action
  }

  private executeThreat(aircraft: Aircraft) {
    aircraft.isExecuted = true;

    const executeButtons = document.querySelectorAll("button");
    executeButtons.forEach((button) => {
      if (button.textContent?.includes("EXECUTE")) {
        button.textContent = "EXECUTED";
        button.style.background = "#00ff00";
        button.style.color = "#000000";
        button.style.fontWeight = "bold";

        // Button state will remain executed until next interaction
      }
    });

    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.95);
      color: white;
      padding: 20px 30px;
      border-radius: 8px;
      border: 2px solid #ff0000;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      z-index: 2000;
      text-align: center;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
      animation: pulse 0.5s ease-in-out;
    `;
    notification.innerHTML = `
      TARGET ELIMINATED<br>
      <span style="font-size: 14px;">${aircraft.callSign}</span><br>
      <span style="font-size: 12px; color: #ffff00;">Threat neutralized</span>
    `;
    document.body.appendChild(notification);

    const aircraftElement = document.querySelector(
      `[data-aircraft-id="${aircraft.id}"]`
    ) as HTMLElement;
    if (aircraftElement) {
      aircraftElement.style.boxShadow = "0 0 30px #ff0000, 0 0 50px #ff0000";
      aircraftElement.style.border = "3px solid #ff0000";
      aircraftElement.style.background = "#ff0000";
      aircraftElement.style.opacity = "0.8";

      aircraftElement.remove();
    }

    this.aircraft.delete(aircraft.id);
    this.simulationSystem.activeThreats.delete(aircraft.id);
    this.simulationSystem.engagementCount++;

    this.updateUI();

    notification.remove();
  }

  private convertToCartesian(
    deltaLat: number,
    deltaLng: number
  ): { x: number; y: number } {
    const scale = 100;

    const rawX = deltaLng * scale;
    const rawY = -deltaLat * scale;

    const zoomedX = rawX * this.zoomLevel;
    const zoomedY = rawY * this.zoomLevel;

    return { x: zoomedX, y: zoomedY };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Render a compass overlay in the center of the visualization area (102 screen).
   * Heading in degrees, 0 = North, 90 = East.
   */
  private renderCompassOverlay(
    visualizationArea: HTMLElement,
    heading: number | undefined
  ): void {
    // Remove any existing compass overlay
    const existing = document.getElementById("compass-overlay");
    if (existing) {
      existing.remove();
    }

    const compass = document.createElement("div");
    compass.id = "compass-overlay";
    const size = 200;
    const half = size / 2;
    compass.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${size}px;
      height: ${size}px;
      margin-top: -${half}px;
      margin-left: -${half}px;
      border: 2px solid #00ff00;
      border-radius: 50%;
      box-sizing: border-box;
      pointer-events: none;
      background: transparent;
      box-shadow: 0 0 10px rgba(0, 255, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
    `;

    // Crosshair lines
    const vertical = document.createElement("div");
    vertical.style.cssText = `
      position: absolute;
      width: 2px;
      height: 100%;
      background: rgba(0, 255, 0, 0.4);
      left: 50%;
      top: 0;
      transform: translateX(-50%);
    `;
    const horizontal = document.createElement("div");
    horizontal.style.cssText = `
      position: absolute;
      width: 100%;
      height: 2px;
      background: rgba(0, 255, 0, 0.4);
      top: 50%;
      left: 0;
      transform: translateY(-50%);
    `;

    compass.appendChild(vertical);
    compass.appendChild(horizontal);

    // Cardinal labels
    const cardinal = (text: string, top: string, left: string) => {
      const label = document.createElement("div");
      label.textContent = text;
      label.style.cssText = `
        position: absolute;
        top: ${top};
        left: ${left};
        transform: translate(-50%, -50%);
        color: #00ff00;
        font-family: monospace;
        font-size: 14px;
        font-weight: bold;
      `;
      compass.appendChild(label);
    };

    cardinal("N", "8%", "50%");
    cardinal("S", "92%", "50%");
    cardinal("W", "50%", "8%");
    cardinal("E", "50%", "92%");

    // Heading pointer (triangle)
    const pointer = document.createElement("div");
    pointer.style.cssText = `
      position: absolute;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-bottom: 18px solid #00ff00;
      top: 14px;
      left: 50%;
      transform-origin: 50% 100%;
    `;

    const safeHeading =
      typeof heading === "number" && Number.isFinite(heading) ? heading : 0;
    // Default pointer points to North; rotate by heading degrees
    pointer.style.transform = `translateX(-50%) rotate(${safeHeading}deg)`;

    compass.appendChild(pointer);

    // Heading text
    const headingText = document.createElement("div");
    headingText.textContent = `${safeHeading.toFixed(0)}°`;
    headingText.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
    `;
    compass.appendChild(headingText);

    visualizationArea.appendChild(compass);
  }

  public sendMessage(message: string) {
    const messageData = {
      type: "message",
      payload: {
        id: this.nodeId,
        message: message,
      },
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const tacticalClient = new TacticalDisplayClient();
});
