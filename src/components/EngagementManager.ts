import { MapManager } from "../map";
import { UDPDataPoint } from "./UDPNodesManager";
import mapboxgl from "mapbox-gl";

export type EngagementData = {
  globalId: number; // attacker
  engagementTargetGid: number; // target
  weaponLaunch: number;
  hangFire: number;
  tth: number; // time to hit
  tta: number; // time to arrival
  engagementTargetWeaponCode: number;
  dMax1: number; // max range 1
  dMax2: number; // max range 2
  dmin: number; // min range
  opcode: 103;
};

export class EngagementManager {
  private mapManager: MapManager | null = null;
  private engagements: Map<number, EngagementData> = new Map(); // Key: attacker globalId
  private engagementLinesContainer: HTMLElement | null = null;
  private engagementListContainer: HTMLElement | null = null;
  private udpDataPoints: Map<number, UDPDataPoint> = new Map();

  constructor(mapManager: MapManager | null = null) {
    this.mapManager = mapManager;
  }

  setMapManager(mapManager: MapManager | null): void {
    this.mapManager = mapManager;
  }

  setUDPDataPoints(udpDataPoints: Map<number, UDPDataPoint>): void {
    this.udpDataPoints = udpDataPoints;
  }

  initializeContainers(visualizationArea: HTMLElement): void {
    // Create container for engagement lines
    const linesContainer = document.createElement("div");
    linesContainer.id = "engagement-lines-container";
    linesContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 4;
    `;
    visualizationArea.appendChild(linesContainer);
    this.engagementLinesContainer = linesContainer;
  }

  updateEngagements(engagementData: EngagementData[]): void {
    // Clear existing engagements
    this.engagements.clear();

    // Store new engagements
    engagementData.forEach((engagement) => {
      if (engagement.globalId && engagement.engagementTargetGid) {
        this.engagements.set(engagement.globalId, engagement);
      }
    });

    // Update display
    this.updateEngagementLines();
    this.updateEngagementList();
  }

  private updateEngagementLines(): void {
    if (!this.engagementLinesContainer || !this.mapManager) return;

    // Clear existing lines
    this.engagementLinesContainer.innerHTML = "";

    const mapboxMap = this.mapManager.getMapboxMap();
    if (!mapboxMap) return;

    this.engagements.forEach((engagement) => {
      const attacker = this.udpDataPoints.get(engagement.globalId);
      const target = this.udpDataPoints.get(engagement.engagementTargetGid);

      // Skip drawing line if positions not available
      if (
        !attacker ||
        !target ||
        !attacker.latitude ||
        !attacker.longitude ||
        !target.latitude ||
        !target.longitude
      ) {
        return; // Skip if positions not available
      }

      // Convert lat/lng to screen coordinates
      const attackerPoint = mapboxMap.project([
        attacker.longitude,
        attacker.latitude,
      ]);
      const targetPoint = mapboxMap.project([
        target.longitude,
        target.latitude,
      ]);

      // Create SVG line element (without tooltips/dialogs)
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      `;

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", attackerPoint.x.toString());
      line.setAttribute("y1", attackerPoint.y.toString());
      line.setAttribute("x2", targetPoint.x.toString());
      line.setAttribute("y2", targetPoint.y.toString());
      line.setAttribute("stroke", "#ff4444");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-dasharray", "5,5");
      line.setAttribute("opacity", "0.8");
      line.style.pointerEvents = "none";

      this.engagementLinesContainer.appendChild(svg);
      svg.appendChild(line);
    });
  }

  // Tooltips/dialogs removed per requirements

  public createEngagementList(parentContainer: HTMLElement): void {
    // Engagement list dialog is disabled globally; do not create any UI.
    if (this.engagementListContainer) {
      const parent = this.engagementListContainer.parentElement;
      if (parent) {
        parent.remove();
      }
      this.engagementListContainer = null;
    }
  }

  private updateEngagementList(): void {
    // Engagement list dialog is disabled globally; no-op.
    return;
  }

  public updateLines(): void {
    this.updateEngagementLines();
  }

  /**
   * Refresh the engagement list display (useful after recreating the container)
   */
  public refreshEngagementList(): void {
    this.updateEngagementList();
  }

  /**
   * Get current engagements as an array (for external views like 104 screen).
   */
  public getEngagements(): EngagementData[] {
    return Array.from(this.engagements.values());
  }

  public destroy(): void {
    if (this.engagementLinesContainer) {
      this.engagementLinesContainer.innerHTML = "";
    }
    if (this.engagementListContainer) {
      const container = this.engagementListContainer.parentElement;
      if (container) {
        container.remove();
      }
    }
    this.engagements.clear();
  }
}
