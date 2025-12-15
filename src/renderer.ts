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
import { GeoMessageManager } from "./components/GeoMessageManager";

class TacticalDisplayClient {
  private aircraft: Map<string, Aircraft> = new Map();
  private nodeId: string = "";
  private zoomLevel: number = 5;
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
    this.geoMessageManager = new GeoMessageManager(this.mapManager);

    this.initialize();
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
        const currentZoom = this.mapManager.getZoom() || 7;
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
                ${isMotherAc ? "✈ MOTHER" : ""}
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

    // 104 screen: show detailed engagements info (no dialogs/tooltips)
    const existingEngPanel = document.getElementById(
      "engagement-details-panel"
    );
    if (existingEngPanel) {
      existingEngPanel.remove();
    }

    if (this.viewMode === "engagement-104") {
      const engagements = this.engagementManager.getEngagements();
      const allNodesMap = this.udpNodesManager.getAllNodesMap();

      const panel = document.createElement("div");
      panel.id = "engagement-details-panel";
      panel.style.cssText = `
        position: fixed;
        right: 10px;
        bottom: 10px;
        width: 380px;
        max-height: 60vh;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #ff4444;
        border-radius: 8px;
        padding: 10px 12px;
        color: #ffffff;
        font-family: monospace;
        font-size: 11px;
        z-index: 150;
        box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
        overflow-y: auto;
      `;

      const header = document.createElement("div");
      header.textContent = "ENGAGEMENTS (104)";
      header.style.cssText = `
        font-weight: bold;
        font-size: 13px;
        margin-bottom: 8px;
        text-align: center;
        color: #ff4444;
        border-bottom: 1px solid #ff4444;
        padding-bottom: 4px;
      `;
      panel.appendChild(header);

      if (engagements.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "No active engagements";
        empty.style.cssText = `
          text-align: center;
          color: #cccccc;
          margin-top: 8px;
        `;
        panel.appendChild(empty);
      } else {
        engagements.forEach((eng) => {
          const attacker = allNodesMap.get(eng.globalId);
          const target = allNodesMap.get(eng.engagementTargetGid);

          const attackerCallsign =
            attacker?.callsign || `ID${eng.globalId ?? "N/A"}`;
          const targetCallsign =
            target?.callsign || `ID${eng.engagementTargetGid ?? "N/A"}`;

          const block = document.createElement("div");
          block.style.cssText = `
            border: 1px solid rgba(255, 68, 68, 0.6);
            border-radius: 6px;
            padding: 6px 8px;
            margin-bottom: 6px;
            background: rgba(30, 0, 0, 0.7);
          `;

          block.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="color:#ffaa00;font-weight:bold;">${attackerCallsign}</span>
              <span style="color:#ff4444;font-weight:bold;">→</span>
              <span style="color:#ff6666;font-weight:bold;">${targetCallsign}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10px;color:#cccccc;margin-bottom:4px;">
              <div>Weapon: <span style="color:${
                eng.weaponLaunch ? "#00ff00" : "#888888"
              };">${eng.weaponLaunch ? "LAUNCHED" : "READY"}</span></div>
              <div>Hang Fire: <span style="color:${
                eng.hangFire ? "#ff4444" : "#888888"
              };">${eng.hangFire ? "YES" : "NO"}</span></div>
              <div>TTH: <span style="color:#ffff00;">${eng.tth}s</span></div>
              <div>TTA: <span style="color:#ffff00;">${eng.tta}s</span></div>
            </div>
            <div style="font-size:10px;color:#aaaaaa;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;">
              Ranges: dMax1=${
                isNaN(eng.dMax1) ? "N/A" : eng.dMax1.toFixed(2)
              } nm, dMax2=${
                isNaN(eng.dMax2) ? "N/A" : eng.dMax2.toFixed(2)
              } nm, dmin=${
                isNaN(eng.dmin) ? "N/A" : eng.dmin.toFixed(2)
              } nm
            </div>
          `;

          panel.appendChild(block);
        });
      }

      container.appendChild(panel);
    }

    this.checkWarnings();
  }

  private setViewMode(
    mode: "normal" | "self-only" | "network-103" | "engagement-104"
  ) {
    this.viewMode = mode;

    // Disable UDP node dialogs on all screens
    this.udpNodesManager.setDialogsEnabled(false);

    // Enable radar circles only in 101 screen; hide them in 102/103
    this.udpNodesManager.setRadarCirclesEnabled(this.viewMode === "normal");

    // Show UDP nodes/lines only in 101; hide them in 102 and 103
    this.udpNodesManager.setNodesVisible(this.viewMode === "normal");

    // Center logic:
    // 101 screen centered on mother, 102 & 103 screens centered on self
    this.centerMode =
      this.viewMode === "normal" ? "mother" : ("self" as "self");

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
        button.textContent = "🔒 LOCKED";
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
      🎯 TARGET LOCKED<br>
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
        button.textContent = "✅ EXECUTED";
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
      💥 TARGET ELIMINATED<br>
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
