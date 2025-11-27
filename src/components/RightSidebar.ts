import { MapManager } from "../map";

export class RightSidebar {
  private zoomDisplay: HTMLElement | null = null;

  public create(
    container: HTMLElement,
    viewMode: "normal" | "self-only",
    zoomLevel: number,
    showOtherNodes: boolean,
    centerMode: "mother" | "self",
    mapManager: MapManager | null,
    onViewModeChange: (mode: "normal" | "self-only") => void,
    onZoomIn: () => void,
    onZoomOut: () => void,
    onToggleNodes: () => void,
    onToggleMap: () => void,
    onToggleCenterMode: () => void,
    onToggleThreatDialog: () => void
  ): HTMLElement {
    console.log("zoomLevel in right sidebar", zoomLevel);
    const sidebar = document.createElement("div");
    sidebar.style.cssText = `
      position: fixed;
      right: 0;
      top: 0;
      width: 60px;
      height: 100vh;
      background: rgba(20, 20, 30, 0.95);
      border-left: 2px solid rgba(100, 100, 120, 0.8);
      box-shadow: -2px 0 10px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
      gap: 10px;
      z-index: 100;
      transform: translateZ(0);
      isolation: isolate;
    `;

    const button101 = document.createElement("button");
    button101.textContent = "101";
    button101.style.cssText = `
      width: 40px;
      height: 30px;
      background: ${viewMode === "normal" ? "#44ff44" : "rgba(60, 60, 70, 0.9)"};
      color: white;
      border: 1.5px solid ${viewMode === "normal" ? "#66ff66" : "rgba(100, 100, 120, 0.6)"};
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 10px;
      font-weight: bold;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 5px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;
    button101.addEventListener("click", () => onViewModeChange("normal"));
    button101.addEventListener("mouseenter", () => {
      button101.style.opacity = "0.8";
    });
    button101.addEventListener("mouseleave", () => {
      button101.style.opacity = "1";
    });
    button101.setAttribute("data-view-mode", "101");

    const button102 = document.createElement("button");
    button102.textContent = "102";
    button102.style.cssText = `
      width: 40px;
      height: 30px;
      background: ${viewMode === "self-only" ? "#ff8844" : "rgba(60, 60, 70, 0.9)"};
      color: white;
      border: 1.5px solid ${viewMode === "self-only" ? "#ffaa66" : "rgba(100, 100, 120, 0.6)"};
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 10px;
      font-weight: bold;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;
    button102.addEventListener("click", () => onViewModeChange("self-only"));
    button102.addEventListener("mouseenter", () => {
      button102.style.opacity = "0.8";
    });
    button102.addEventListener("mouseleave", () => {
      button102.style.opacity = "1";
    });
    button102.setAttribute("data-view-mode", "102");

    const zoomOutButton = document.createElement("button");
    zoomOutButton.textContent = "−";
    zoomOutButton.style.cssText = `
      width: 40px;
      height: 30px;
      background: rgba(60, 60, 70, 0.9);
      color: white;
      border: 1.5px solid rgba(100, 100, 120, 0.6);
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;
    zoomOutButton.addEventListener("click", onZoomOut);
    zoomOutButton.addEventListener("mouseenter", () => {
      zoomOutButton.style.background = "rgba(80, 80, 90, 0.95)";
      zoomOutButton.style.borderColor = "rgba(120, 120, 140, 0.8)";
    });
    zoomOutButton.addEventListener("mouseleave", () => {
      zoomOutButton.style.background = "rgba(60, 60, 70, 0.9)";
      zoomOutButton.style.borderColor = "rgba(100, 100, 120, 0.6)";
    });

    const zoomDisplay = document.createElement("div");
    zoomDisplay.style.cssText = `
      color: #ffffff;
      font-family: monospace;
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      min-width: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      background: rgba(40, 40, 50, 0.5);
      padding: 4px 6px;
      border-radius: 4px;
    `;
    zoomDisplay.textContent = `${zoomLevel}`;
    this.zoomDisplay = zoomDisplay;

    const zoomInButton = document.createElement("button");
    zoomInButton.textContent = "+";
    zoomInButton.style.cssText = `
      width: 40px;
      height: 30px;
      background: rgba(60, 60, 70, 0.9);
      color: white;
      border: 1.5px solid rgba(100, 100, 120, 0.6);
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;
    zoomInButton.addEventListener("click", onZoomIn);
    zoomInButton.addEventListener("mouseenter", () => {
      zoomInButton.style.background = "rgba(80, 80, 90, 0.95)";
      zoomInButton.style.borderColor = "rgba(120, 120, 140, 0.8)";
    });
    zoomInButton.addEventListener("mouseleave", () => {
      zoomInButton.style.background = "rgba(60, 60, 70, 0.9)";
      zoomInButton.style.borderColor = "rgba(100, 100, 120, 0.6)";
    });

    const toggleMapButton = document.createElement("button");
    toggleMapButton.textContent = "MAP";
    toggleMapButton.style.cssText = `
      width: 40px;
      height: 30px;
      background: ${mapManager?.getMapboxMap() ? "#4488ff" : "rgba(60, 60, 70, 0.9)"};
      color: white;
      border: 1.5px solid ${mapManager?.getMapboxMap() ? "#66aaff" : "rgba(100, 100, 120, 0.6)"};
      border-radius: 4px;
      cursor: pointer;
      font-family: monospace;
      font-size: 8px;
      font-weight: bold;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 5px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;
    toggleMapButton.addEventListener("click", () => {
      onToggleMap();
      const isVisible = mapManager?.getMapboxMap() ? true : false;
      toggleMapButton.style.background = isVisible
        ? "#4488ff"
        : "rgba(60, 60, 70, 0.9)";
      toggleMapButton.style.borderColor = isVisible
        ? "#66aaff"
        : "rgba(100, 100, 120, 0.6)";
    });
    toggleMapButton.addEventListener("mouseenter", () => {
      toggleMapButton.style.opacity = "0.8";
    });
    toggleMapButton.addEventListener("mouseleave", () => {
      toggleMapButton.style.opacity = "1";
    });

    sidebar.appendChild(button101);
    sidebar.appendChild(button102);
    sidebar.appendChild(zoomOutButton);
    sidebar.appendChild(zoomDisplay);
    sidebar.appendChild(zoomInButton);
    sidebar.appendChild(toggleMapButton);

    container.appendChild(sidebar);
    return sidebar;
  }

  public updateZoomDisplay(zoomLevel: number): void {
    if (this.zoomDisplay) {
      this.zoomDisplay.textContent = `${zoomLevel}`;
    }
  }
}
