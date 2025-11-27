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
  private viewMode: "normal" | "self-only" = "normal";

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
    this.threatDialog.toggle();
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
    visualizationArea.style.cssText = `
      position: relative;
      width: calc(100% - 60px);
      height: calc(100vh - 60px);
      background: transparent;
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
      this.engagementManager.createEngagementList(container);

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
    } else {
      this.mapManager.reinitializeInContainer(visualizationArea);

      // Re-setup event listeners for the reinitialized map
      this.mapManager.getMapboxMap()?.on("load", () => {
        this.udpNodesManager.updateUDPDots();
        this.udpNodesManager.updateConnectionLines();
      });

      this.mapManager.getMapboxMap()?.on("move", () => {
        if (this.udpNodesManager.hasDataPoints()) {
          this.udpNodesManager.updateUDPDots();
          this.udpNodesManager.updateConnectionLines();
          this.udpNodesManager.updateRadarCircles();
        }
      });

      this.mapManager.getMapboxMap()?.on("zoom", () => {
        if (this.udpNodesManager.hasDataPoints()) {
          this.udpNodesManager.updateUDPDots();
          this.udpNodesManager.updateConnectionLines();
          this.udpNodesManager.updateRadarCircles();
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
      }
    }

    if (centerAircraft) {
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
      this.networkMembersTable.create(container);

      // Update network members table with current data
      const networkMembers = this.udpNodesManager.getNetworkMembers();
      this.networkMembersTable.update(networkMembers);
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

    // Update network members table with current data
    const networkMembers = this.udpNodesManager.getNetworkMembers();
    this.networkMembersTable.update(networkMembers);

    this.checkWarnings();

    if (this.threatDialog.isVisible()) {
      this.threatDialog.create();
      let centerAircraft: Aircraft | null = null;
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
      if (centerAircraft) {
        const nearestThreats = this.getNearestThreats(centerAircraft, 5);
        this.threatDialog.update(nearestThreats);
      }
    }
  }

  private setViewMode(mode: "normal" | "self-only") {
    this.viewMode = mode;

    this.updateUI();

    const button101 = document.querySelector(
      'button[data-view-mode="101"]'
    ) as HTMLElement;
    const button102 = document.querySelector(
      'button[data-view-mode="102"]'
    ) as HTMLElement;

    if (button101) {
      button101.style.background = mode === "normal" ? "#44ff44" : "#333";
    }
    if (button102) {
      button102.style.background = mode === "self-only" ? "#ff8844" : "#333";
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
    const details = document.createElement("div");
    details.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #222;
      border: 2px solid #555;
      border-radius: 10px;
      padding: 20px;
      color: white;
      font-family: monospace;
      z-index: 1000;
      min-width: 350px;
    `;

    const typeColor =
      aircraft.aircraftType === "threat"
        ? "#ff4444"
        : aircraft.aircraftType === "mother"
          ? "#4488ff"
          : aircraft.aircraftType === "self"
            ? "#FFD700"
            : "#44ff44";

    const totalDistance = aircraft.totalDistanceCovered || 0;
    const distanceMach = aircraft.speed / 661.5;

    const threatActions =
      aircraft.aircraftType === "threat"
        ? `
      <hr style="border: 1px solid #555; margin: 15px 0;">
      <div style="background: rgba(255, 68, 68, 0.2); padding: 10px; border-radius: 5px; border: 1px solid #ff4444;">
        <div style="color: #ff4444; font-weight: bold; margin-bottom: 10px;">⚠️ THREAT ACTIONS</div>
        <div style="display: flex; gap: 10px;">
          <button id="lock-threat-btn" style="
            background: #ff8800;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            flex: 1;
            transition: all 0.3s;
          ">🎯 LOCK TARGET</button>
          <button id="execute-threat-btn" style="
            background: #ff0000;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            flex: 1;
            transition: all 0.3s;
          ">💥 EXECUTE</button>
        </div>
      </div>
    `
        : "";

    details.innerHTML = `
      <h3 style="margin-top: 0; color: ${typeColor};">Aircraft Details</h3>
      <div><strong>Call Sign:</strong> ${aircraft.callSign}</div>
      <div><strong>Type:</strong> <span style="color: ${typeColor}">${aircraft.aircraftType.toUpperCase()}</span></div>
      <div><strong>Status:</strong> <span style="color: ${aircraft.status === "connected" ? "#4CAF50" : "#F44336"}">${aircraft.status.toUpperCase()}</span></div>
      <div><strong>Aircraft:</strong> ${aircraft.info}</div>
      <hr style="border: 1px solid #555; margin: 15px 0;">
      <div><strong>Position:</strong></div>
      <div style="margin-left: 20px;">Latitude: ${aircraft.lat.toFixed(6)}</div>
      <div style="margin-left: 20px;">Longitude: ${aircraft.lng.toFixed(6)}</div>
      <div><strong>Altitude:</strong> ${aircraft.altitude.toLocaleString()} ft</div>
      <div><strong>Heading:</strong> ${aircraft.heading}°</div>
      <div><strong>Speed:</strong> ${aircraft.speed} kts (Mach ${distanceMach.toFixed(2)})</div>
      <hr style="border: 1px solid #555; margin: 15px 0;">
      <div><strong style="color: #ffaa00;">Total Distance Covered:</strong></div>
      <div style="margin-left: 20px; color: #ffaa00; font-size: 16px; font-weight: bold;">
        ${totalDistance.toFixed(2)} NM
      </div>
      <div style="margin-left: 20px; color: #aaa; font-size: 12px;">
        (${(totalDistance * 1.151).toFixed(2)} miles / ${(totalDistance * 1.852).toFixed(2)} km)
      </div>
      ${threatActions}
      <button onclick="this.parentElement.remove()" style="
        background: #555;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 15px;
      ">Close</button>
    `;

    document.body.appendChild(details);

    if (aircraft.aircraftType === "threat") {
      const lockBtn = document.getElementById("lock-threat-btn");
      const executeBtn = document.getElementById("execute-threat-btn");

      if (lockBtn) {
        lockBtn.addEventListener("mouseenter", () => {
          lockBtn.style.background = "#ffaa00";
          lockBtn.style.transform = "scale(1.05)";
        });
        lockBtn.addEventListener("mouseleave", () => {
          lockBtn.style.background = "#ff8800";
          lockBtn.style.transform = "scale(1)";
        });
        lockBtn.addEventListener("click", () => {
          this.lockThreat(aircraft);
          details.remove();
        });
      }

      if (executeBtn) {
        executeBtn.addEventListener("mouseenter", () => {
          executeBtn.style.background = "#ff3333";
          executeBtn.style.transform = "scale(1.05)";
        });
        executeBtn.addEventListener("mouseleave", () => {
          executeBtn.style.background = "#ff0000";
          executeBtn.style.transform = "scale(1)";
        });
        executeBtn.addEventListener("click", () => {
          this.executeThreat(aircraft);
          details.remove();
        });
      }
    }
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
