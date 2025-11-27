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

      // Create SVG line element
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
      line.style.pointerEvents = "auto";
      line.style.cursor = "pointer";

      // Add arrow marker at target end
      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs"
      );
      const marker = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "marker"
      );
      marker.setAttribute("id", `arrow-${engagement.globalId}`);
      marker.setAttribute("markerWidth", "10");
      marker.setAttribute("markerHeight", "10");
      marker.setAttribute("refX", "9");
      marker.setAttribute("refY", "3");
      marker.setAttribute("orient", "auto");
      marker.setAttribute("markerUnits", "strokeWidth");

      const arrowPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      arrowPath.setAttribute("d", "M0,0 L0,6 L9,3 z");
      arrowPath.setAttribute("fill", "#ff4444");
      marker.appendChild(arrowPath);
      defs.appendChild(marker);
      svg.appendChild(defs);

      line.setAttribute("marker-end", `url(#arrow-${engagement.globalId})`);

      // Add tooltip on hover
      const tooltip = this.createTooltip(engagement, attacker, target);
      let tooltipVisible = false;

      line.addEventListener("mouseenter", (e) => {
        if (!tooltipVisible) {
          const rect = this.engagementLinesContainer!.getBoundingClientRect();
          const midX = (attackerPoint.x + targetPoint.x) / 2;
          const midY = (attackerPoint.y + targetPoint.y) / 2;
          tooltip.style.left = `${midX}px`;
          tooltip.style.top = `${midY - 60}px`;
          this.engagementLinesContainer!.appendChild(tooltip);
          tooltipVisible = true;
        }
      });

      line.addEventListener("mouseleave", () => {
        if (tooltipVisible && tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
          tooltipVisible = false;
        }
      });

      svg.appendChild(line);
      this.engagementLinesContainer.appendChild(svg);
    });
  }

  private createTooltip(
    engagement: EngagementData,
    attacker: UDPDataPoint,
    target: UDPDataPoint
  ): HTMLElement {
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #ff4444;
      border-radius: 6px;
      padding: 10px;
      color: white;
      font-family: monospace;
      font-size: 11px;
      z-index: 300;
      pointer-events: none;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
    `;

    const attackerCallsign = attacker.callsign || `ID${attacker.globalId}`;
    const targetCallsign = target.callsign || `ID${target.globalId}`;

    tooltip.innerHTML = `
      <div style="color: #ff4444; font-weight: bold; margin-bottom: 8px; font-size: 12px; text-align: center; border-bottom: 1px solid #ff4444; padding-bottom: 5px;">
        ⚔️ ENGAGEMENT
      </div>
      <div style="margin-bottom: 6px;">
        <span style="color: #ffaa00;">Attacker:</span>
        <span style="color: #00ff00; font-weight: bold;">${attackerCallsign}</span>
        <span style="color: #888;">(${attacker.globalId})</span>
      </div>
      <div style="margin-bottom: 6px;">
        <span style="color: #ffaa00;">Target:</span>
        <span style="color: #ff4444; font-weight: bold;">${targetCallsign}</span>
        <span style="color: #888;">(${target.globalId})</span>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
        <div style="margin-bottom: 4px;">
          <span style="color: #cccccc;">Weapon Launch:</span>
          <span style="color: ${engagement.weaponLaunch ? "#00ff00" : "#888"}; font-weight: bold;">${engagement.weaponLaunch ? "YES" : "NO"}</span>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #cccccc;">Hang Fire:</span>
          <span style="color: ${engagement.hangFire ? "#ff4400" : "#888"}; font-weight: bold;">${engagement.hangFire ? "YES" : "NO"}</span>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #cccccc;">TTH:</span>
          <span style="color: #ffff00; font-weight: bold;">${engagement.tth}s</span>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #cccccc;">TTA:</span>
          <span style="color: #ffff00; font-weight: bold;">${engagement.tta}s</span>
        </div>
         <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
           <div style="margin-bottom: 2px; font-size: 10px; color: #888;">
             Ranges: dMax1=${isNaN(engagement.dMax1) ? "N/A" : engagement.dMax1.toFixed(2)}nm, dMax2=${isNaN(engagement.dMax2) ? "N/A" : engagement.dMax2.toFixed(2)}nm, dmin=${isNaN(engagement.dmin) ? "N/A" : engagement.dmin.toFixed(2)}nm
           </div>
         </div>
      </div>
    `;

    return tooltip;
  }

  public createEngagementList(parentContainer: HTMLElement): void {
    const container = document.createElement("div");
    container.id = "engagement-list";
    container.style.cssText = `
      position: fixed;
      right: 70px;
      top: 0;
      width: 350px;
      max-height: calc(100vh - 20px);
      background: rgba(10, 10, 20, 0.95);
      border: 2px solid rgba(255, 68, 68, 0.6);
      border-radius: 8px;
      padding: 10px;
      margin: 10px;
      overflow-y: auto;
      z-index: 200;
      font-family: 'Courier New', monospace;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      color: #ff4444;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 2px solid rgba(255, 68, 68, 0.3);
    `;
    header.textContent = " ENGAGEMENTS";
    container.appendChild(header);

    // Content container
    const contentContainer = document.createElement("div");
    contentContainer.id = "engagement-list-content";
    container.appendChild(contentContainer);

    parentContainer.appendChild(container);
    this.engagementListContainer = contentContainer;
  }

  private updateEngagementList(): void {
    const contentContainer = document.getElementById("engagement-list-content");
    if (!contentContainer) return;

    if (this.engagements.size === 0) {
      contentContainer.innerHTML = `
        <div style="color: #888; text-align: center; padding: 20px;">
          No active engagements
        </div>
      `;
      return;
    }

    // Create list
    const list = document.createElement("div");
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    this.engagements.forEach((engagement) => {
      const attacker = this.udpDataPoints.get(engagement.globalId);
      const target = this.udpDataPoints.get(engagement.engagementTargetGid);

      // Show engagement in list even if positions aren't available
      const attackerCallsign = attacker?.callsign || `ID${engagement.globalId}`;
      const targetCallsign =
        target?.callsign || `ID${engagement.engagementTargetGid}`;

      const item = document.createElement("div");
      item.style.cssText = `
        background: rgba(255, 68, 68, 0.1);
        border: 1px solid rgba(255, 68, 68, 0.3);
        border-radius: 4px;
        padding: 10px;
        cursor: pointer;
        transition: background 0.2s;
      `;

      item.addEventListener("mouseenter", () => {
        item.style.background = "rgba(255, 68, 68, 0.2)";
      });

      item.addEventListener("mouseleave", () => {
        item.style.background = "rgba(255, 68, 68, 0.1)";
      });

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="color: #ffaa00; font-weight: bold; font-size: 12px;">
            ${attackerCallsign}
          </div>
          <div style="color: #ff4444; font-size: 16px;">→</div>
          <div style="color: #ff4444; font-weight: bold; font-size: 12px;">
            ${targetCallsign}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #cccccc; margin-top: 6px;">
          <div>
            <span style="color: #888;">Weapon:</span>
            <span style="color: ${engagement.weaponLaunch ? "#00ff00" : "#888"}; font-weight: bold;">${engagement.weaponLaunch ? "LAUNCHED" : "READY"}</span>
          </div>
          <div>
            <span style="color: #888;">Hang Fire:</span>
            <span style="color: ${engagement.hangFire ? "#ff4400" : "#888"}; font-weight: bold;">${engagement.hangFire ? "YES" : "NO"}</span>
          </div>
          <div>
            <span style="color: #888;">TTH:</span>
            <span style="color: #ffff00; font-weight: bold;">${engagement.tth}s</span>
          </div>
          <div>
            <span style="color: #888;">TTA:</span>
            <span style="color: #ffff00; font-weight: bold;">${engagement.tta}s</span>
          </div>
        </div>
         <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 9px; color: #888;">
           Ranges: dMax1=${isNaN(engagement.dMax1) ? "N/A" : engagement.dMax1.toFixed(2)}nm | dMax2=${isNaN(engagement.dMax2) ? "N/A" : engagement.dMax2.toFixed(2)}nm | dmin=${isNaN(engagement.dmin) ? "N/A" : engagement.dmin.toFixed(2)}nm
         </div>
      `;

      list.appendChild(item);
    });

    contentContainer.innerHTML = "";
    contentContainer.appendChild(list);
  }

  public updateLines(): void {
    this.updateEngagementLines();
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
