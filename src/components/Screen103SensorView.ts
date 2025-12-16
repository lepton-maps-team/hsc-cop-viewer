import { UDPDataPoint } from "./UDPNodesManager";

export class Screen103SensorView {
  private container: HTMLElement | null = null;
  private selectedNodeId: number | null = null;
  private nodes: UDPDataPoint[] = [];

  /**
   * Create the 103 screen sensor view
   */
  public create(parentContainer: HTMLElement, nodes: UDPDataPoint[]): void {
    console.log(
      "🎯🎯🎯 Screen103SensorView.create() called with",
      nodes.length,
      "nodes"
    );
    console.log("🎯 parentContainer:", parentContainer);
    console.log("🎯 document.body exists:", !!document.body);

    // Remove existing display
    this.destroy();

    this.nodes = nodes;

    const display = document.createElement("div");
    display.id = "screen-103-sensor-view";
    display.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.95) !important;
      z-index: 15000 !important;
      display: flex !important;
      font-family: 'Courier New', monospace !important;
      color: #00ff00 !important;
      pointer-events: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;

    // Left side - Airplane model
    const leftPanel = document.createElement("div");
    leftPanel.style.cssText = `
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 40px !important;
      border-right: 2px solid #00ff00 !important;
    `;

    const airplaneTitle = document.createElement("div");
    airplaneTitle.textContent = "AIRCRAFT VIEW";
    airplaneTitle.style.cssText = `
      font-size: 24px !important;
      font-weight: bold !important;
      color: #00ff00 !important;
      text-shadow: 0 0 20px #00ff00 !important;
      margin-bottom: 40px !important;
      letter-spacing: 3px !important;
    `;
    leftPanel.appendChild(airplaneTitle);

    const airplaneContainer = document.createElement("div");
    airplaneContainer.style.cssText = `
      width: 500px !important;
      height: 500px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;
    airplaneContainer.innerHTML = this.createAirplaneSVG();
    leftPanel.appendChild(airplaneContainer);

    // Right side - Sensor controls
    const rightPanel = document.createElement("div");
    rightPanel.style.cssText = `
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 40px !important;
      overflow-y: auto !important;
    `;

    const sensorTitle = document.createElement("div");
    sensorTitle.textContent = "SENSOR MANAGEMENT";
    sensorTitle.style.cssText = `
      font-size: 24px !important;
      font-weight: bold !important;
      color: #00ff00 !important;
      text-shadow: 0 0 20px #00ff00 !important;
      margin-bottom: 30px !important;
      letter-spacing: 3px !important;
    `;
    rightPanel.appendChild(sensorTitle);

    const contentArea = document.createElement("div");
    contentArea.id = "screen-103-content";
    contentArea.style.cssText = `
      flex: 1 !important;
      overflow-y: auto !important;
      min-height: 200px !important;
    `;

    // Add a test message immediately to verify visibility
    const testMsg = document.createElement("div");
    testMsg.textContent = "SCREEN 103 ACTIVE - Loading nodes...";
    testMsg.style.cssText = `
      color: #00ff00 !important;
      font-size: 20px !important;
      padding: 20px !important;
      text-align: center !important;
      background: rgba(0, 255, 0, 0.1) !important;
      border: 2px solid #00ff00 !important;
      margin-bottom: 20px !important;
    `;
    contentArea.appendChild(testMsg);

    // Initially show node list
    this.showNodeList(contentArea);

    rightPanel.appendChild(contentArea);

    display.appendChild(leftPanel);
    display.appendChild(rightPanel);

    // Append to document.body to ensure it's always on top
    console.log("🎯 Appending display to document.body...");
    console.log("🎯 display element:", display);
    console.log("🎯 display.style:", display.style.cssText);

    try {
      document.body.appendChild(display);
      this.container = display;
      console.log("✅✅✅ Display appended to body successfully!");
      console.log("✅ Display ID:", display.id);
      console.log("✅ Display in DOM:", document.body.contains(display));

      // Force a reflow to ensure rendering
      void display.offsetHeight;

      // Immediate visibility check
      setTimeout(() => {
        const rect = display.getBoundingClientRect();
        const computed = window.getComputedStyle(display);
        console.log("✅✅✅ Display created and in DOM:", {
          inBody: document.body.contains(display),
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          zIndex: computed.zIndex,
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity,
          backgroundColor: computed.backgroundColor,
          position: computed.position,
        });

        // If still not visible, try to force it
        if (rect.width === 0 || rect.height === 0) {
          console.error(
            "❌ Display has zero dimensions! Forcing visibility..."
          );
          display.style.setProperty("display", "flex", "important");
          display.style.setProperty("width", "100vw", "important");
          display.style.setProperty("height", "100vh", "important");
          display.style.setProperty("position", "fixed", "important");
          display.style.setProperty("top", "0", "important");
          display.style.setProperty("left", "0", "important");
          display.style.setProperty("z-index", "15000", "important");
          display.style.setProperty(
            "background-color",
            "rgba(0, 0, 0, 0.95)",
            "important"
          );
        }

        // Check children
        console.log("🔍 Display children count:", display.children.length);
        console.log("🔍 Left panel exists:", !!leftPanel);
        console.log("🔍 Right panel exists:", !!rightPanel);

        // Log all elements with high z-index that might be covering it
        const allElements = Array.from(document.body.getElementsByTagName("*"));
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
      }, 50);
    } catch (error) {
      console.error("❌❌❌ CRITICAL ERROR appending to body:", error);
    }

    console.log("✅✅✅ Screen103SensorView created successfully");
  }

  /**
   * Create airplane SVG
   */
  private createAirplaneSVG(): string {
    return `
      <svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Fuselage -->
        <ellipse cx="250" cy="250" rx="40" ry="120" fill="none" stroke="#00ff00" stroke-width="3" filter="url(#glow)"/>
        
        <!-- Nose -->
        <path d="M 250 130 L 240 150 L 260 150 Z" fill="#00ff00" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Cockpit -->
        <circle cx="250" cy="180" r="15" fill="none" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Main Wings -->
        <line x1="150" y1="250" x2="350" y2="250" stroke="#00ff00" stroke-width="4" filter="url(#glow)"/>
        <path d="M 150 250 L 130 240 L 130 260 Z" fill="#00ff00" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        <path d="M 350 250 L 370 240 L 370 260 Z" fill="#00ff00" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Tail Wings -->
        <line x1="200" y1="340" x2="300" y2="340" stroke="#00ff00" stroke-width="3" filter="url(#glow)"/>
        <path d="M 200 340 L 190 335 L 190 345 Z" fill="#00ff00" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        <path d="M 300 340 L 310 335 L 310 345 Z" fill="#00ff00" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Vertical Stabilizer -->
        <line x1="250" y1="350" x2="250" y2="390" stroke="#00ff00" stroke-width="3" filter="url(#glow)"/>
        <path d="M 250 390 L 240 410 L 260 410 Z" fill="#00ff00" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
        
        <!-- Sensor locations (labeled) -->
        <g id="sensor-locations">
          <!-- Nose sensor -->
          <circle cx="250" cy="135" r="6" fill="#ffff00" stroke="#ffff00" stroke-width="2" filter="url(#glow)">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <text x="270" y="140" fill="#ffff00" font-size="12" font-weight="bold">S1</text>
          
          <!-- Left wing sensor -->
          <circle cx="140" cy="250" r="6" fill="#ffff00" stroke="#ffff00" stroke-width="2" filter="url(#glow)">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <text x="110" y="255" fill="#ffff00" font-size="12" font-weight="bold">S2</text>
          
          <!-- Right wing sensor -->
          <circle cx="360" cy="250" r="6" fill="#ffff00" stroke="#ffff00" stroke-width="2" filter="url(#glow)">
            <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
          </circle>
          <text x="370" y="255" fill="#ffff00" font-size="12" font-weight="bold">S3</text>
          
          <!-- Belly sensor -->
          <circle cx="250" cy="300" r="6" fill="#ffff00" stroke="#ffff00" stroke-width="2" filter="url(#glow)">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/>
          </circle>
          <text x="260" y="305" fill="#ffff00" font-size="12" font-weight="bold">S4</text>
          
          <!-- Tail sensor -->
          <circle cx="250" cy="380" r="6" fill="#ffff00" stroke="#ffff00" stroke-width="2" filter="url(#glow)">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.7s" repeatCount="indefinite"/>
          </circle>
          <text x="260" y="385" fill="#ffff00" font-size="12" font-weight="bold">S5</text>
        </g>
        
        <!-- Center crosshair -->
        <circle cx="250" cy="250" r="8" fill="none" stroke="#ff0000" stroke-width="2" filter="url(#glow)"/>
        <line x1="240" y1="250" x2="260" y2="250" stroke="#ff0000" stroke-width="2"/>
        <line x1="250" y1="240" x2="250" y2="260" stroke="#ff0000" stroke-width="2"/>
      </svg>
    `;
  }

  /**
   * Show list of nodes
   */
  private showNodeList(container: HTMLElement): void {
    container.innerHTML = "";

    const header = document.createElement("div");
    header.textContent = `NETWORK NODES (${this.nodes.length})`;
    header.style.cssText = `
      font-size: 18px !important;
      font-weight: bold !important;
      color: #00ff00 !important;
      margin-bottom: 20px !important;
      padding-bottom: 10px !important;
      border-bottom: 2px solid #00ff00 !important;
    `;
    container.appendChild(header);

    if (this.nodes.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "NO NETWORK NODES AVAILABLE";
      empty.style.cssText = `
        text-align: center !important;
        color: #ff0000 !important;
        font-size: 18px !important;
        padding: 40px !important;
        text-shadow: 0 0 10px #ff0000 !important;
      `;
      container.appendChild(empty);
      return;
    }

    // Create node cards
    this.nodes.forEach((node) => {
      const nodeCard = this.createNodeCard(node);
      container.appendChild(nodeCard);
    });
  }

  /**
   * Create a node card
   */
  private createNodeCard(node: UDPDataPoint): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = `
      background: rgba(0, 50, 0, 0.5) !important;
      border: 2px solid #00ff00 !important;
      border-radius: 8px !important;
      padding: 15px !important;
      margin-bottom: 15px !important;
      cursor: pointer !important;
      transition: all 0.3s ease !important;
    `;

    const isMotherAc = node.internalData && node.internalData.isMotherAc === 1;
    const callsign = node.callsign || `NODE-${node.globalId}`;
    const battleData = node.battleGroupData || {};
    const numSensors = battleData.numOfSensors || 0;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
          <span style="font-size: 20px; font-weight: bold; color: #00ff00; text-shadow: 0 0 10px #00ff00;">
            ${callsign}
          </span>
          ${isMotherAc ? '<span style="color: #ffaa00; font-size: 12px; margin-left: 10px;">[MOTHER]</span>' : ""}
        </div>
        <div style="font-size: 14px; color: #ffff00;">
          GID: ${node.globalId}
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px; color: #cccccc;">
        <div><span style="color: #00ff00;">Lat:</span> ${node.latitude?.toFixed(6) || "N/A"}</div>
        <div><span style="color: #00ff00;">Lng:</span> ${node.longitude?.toFixed(6) || "N/A"}</div>
        <div><span style="color: #00ff00;">Alt:</span> ${node.altitude || "N/A"} ft</div>
        <div><span style="color: #00ff00;">Sensors:</span> ${numSensors}</div>
      </div>
      <div style="margin-top: 10px; text-align: center; padding: 8px; background: rgba(0, 255, 0, 0.2); border-radius: 4px; font-weight: bold;">
        CLICK TO VIEW SENSORS →
      </div>
    `;

    // Hover effects
    card.addEventListener("mouseenter", () => {
      card.style.background = "rgba(0, 100, 0, 0.7)";
      card.style.borderColor = "#00ff00";
      card.style.boxShadow = "0 0 30px rgba(0, 255, 0, 0.6)";
      card.style.transform = "scale(1.02)";
    });

    card.addEventListener("mouseleave", () => {
      card.style.background = "rgba(0, 50, 0, 0.5)";
      card.style.boxShadow = "none";
      card.style.transform = "scale(1)";
    });

    // Click to show sensors
    card.addEventListener("click", () => {
      this.selectedNodeId = node.globalId;
      const contentArea = document.getElementById("screen-103-content");
      if (contentArea) {
        this.showSensorView(contentArea, node);
      }
    });

    return card;
  }

  /**
   * Show sensor view for selected node
   */
  private showSensorView(container: HTMLElement, node: UDPDataPoint): void {
    container.innerHTML = "";

    const battleData = node.battleGroupData || {};
    const sensorsData = battleData.sensorsData || [];
    const numSensors = battleData.numOfSensors || 0;

    // Back button
    const backButton = document.createElement("div");
    backButton.textContent = "← BACK TO NODE LIST";
    backButton.style.cssText = `
      font-size: 16px !important;
      font-weight: bold !important;
      color: #ffaa00 !important;
      margin-bottom: 20px !important;
      padding: 10px !important;
      border: 2px solid #ffaa00 !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      text-align: center !important;
      transition: all 0.3s ease !important;
    `;
    backButton.addEventListener("mouseenter", () => {
      backButton.style.background = "rgba(255, 170, 0, 0.3)";
      backButton.style.boxShadow = "0 0 20px rgba(255, 170, 0, 0.5)";
    });
    backButton.addEventListener("mouseleave", () => {
      backButton.style.background = "transparent";
      backButton.style.boxShadow = "none";
    });
    backButton.addEventListener("click", () => {
      this.selectedNodeId = null;
      this.showNodeList(container);
    });
    container.appendChild(backButton);

    // Node header
    const header = document.createElement("div");
    const callsign = node.callsign || `NODE-${node.globalId}`;
    const isMotherAc = node.internalData && node.internalData.isMotherAc === 1;

    header.innerHTML = `
      <div style="margin-bottom: 20px; padding: 20px; background: rgba(0, 100, 0, 0.5); border: 2px solid #00ff00; border-radius: 8px;">
        <div style="font-size: 24px; font-weight: bold; color: #00ff00; text-shadow: 0 0 15px #00ff00; margin-bottom: 10px;">
          ${callsign}
          ${isMotherAc ? '<span style="color: #ffaa00; font-size: 16px; margin-left: 10px;">[MOTHER AIRCRAFT]</span>' : ""}
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 14px; color: #cccccc;">
          <div><span style="color: #00ff00;">Global ID:</span> ${node.globalId}</div>
          <div><span style="color: #00ff00;">Total Sensors:</span> ${numSensors}</div>
          <div><span style="color: #00ff00;">Latitude:</span> ${node.latitude?.toFixed(6) || "N/A"}°</div>
          <div><span style="color: #00ff00;">Longitude:</span> ${node.longitude?.toFixed(6) || "N/A"}°</div>
          <div><span style="color: #00ff00;">Altitude:</span> ${node.altitude || "N/A"} ft</div>
          <div><span style="color: #00ff00;">Active Sensors:</span> ${sensorsData.length}</div>
        </div>
      </div>
    `;
    container.appendChild(header);

    // Sensors title
    const sensorsTitle = document.createElement("div");
    sensorsTitle.textContent = "SENSOR STATUS";
    sensorsTitle.style.cssText = `
      font-size: 20px !important;
      font-weight: bold !important;
      color: #ffff00 !important;
      margin-bottom: 20px !important;
      padding-bottom: 10px !important;
      border-bottom: 2px solid #ffff00 !important;
      text-shadow: 0 0 15px #ffff00 !important;
    `;
    container.appendChild(sensorsTitle);

    // Sensor buttons grid
    const sensorGrid = document.createElement("div");
    sensorGrid.style.cssText = `
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)) !important;
      gap: 15px !important;
      margin-bottom: 30px !important;
    `;

    if (sensorsData.length > 0) {
      sensorsData.forEach((sensor: any, index: number) => {
        const sensorButton = this.createSensorButton(sensor, index + 1);
        sensorGrid.appendChild(sensorButton);
      });
    } else {
      const noSensors = document.createElement("div");
      noSensors.textContent = "NO SENSOR DATA AVAILABLE";
      noSensors.style.cssText = `
        grid-column: 1 / -1 !important;
        text-align: center !important;
        color: #ff0000 !important;
        font-size: 18px !important;
        padding: 40px !important;
        text-shadow: 0 0 10px #ff0000 !important;
      `;
      sensorGrid.appendChild(noSensors);
    }

    container.appendChild(sensorGrid);
  }

  /**
   * Create sensor button
   */
  private createSensorButton(sensor: any, sensorNumber: number): HTMLElement {
    const button = document.createElement("div");

    // Determine status color
    const statusValue = sensor.value || 0;
    let statusColor = "#00ff00"; // Green for active
    let statusText = "ACTIVE";

    if (statusValue === 0) {
      statusColor = "#888888"; // Gray for inactive
      statusText = "INACTIVE";
    } else if (statusValue > 200) {
      statusColor = "#ff0000"; // Red for error/warning
      statusText = "WARNING";
    } else if (statusValue > 100) {
      statusColor = "#ffaa00"; // Orange for degraded
      statusText = "DEGRADED";
    }

    button.style.cssText = `
      background: rgba(0, 0, 0, 0.6) !important;
      border: 3px solid ${statusColor} !important;
      border-radius: 8px !important;
      padding: 20px !important;
      cursor: pointer !important;
      transition: all 0.3s ease !important;
      position: relative !important;
    `;

    button.innerHTML = `
      <div style="font-size: 24px; font-weight: bold; color: ${statusColor}; text-shadow: 0 0 15px ${statusColor}; margin-bottom: 10px; text-align: center;">
        SENSOR ${sensorNumber}
      </div>
      <div style="margin-bottom: 8px;">
        <div style="font-size: 12px; color: #cccccc;">CODE: <span style="color: #ffff00; font-weight: bold;">${sensor.code || "N/A"}</span></div>
      </div>
      <div style="margin-bottom: 8px;">
        <div style="font-size: 12px; color: #cccccc;">VALUE: <span style="color: #00ffff; font-weight: bold;">${sensor.value || "N/A"}</span></div>
      </div>
      <div style="text-align: center; padding: 8px; background: rgba(${statusColor === "#00ff00" ? "0, 255, 0" : statusColor === "#ff0000" ? "255, 0, 0" : statusColor === "#ffaa00" ? "255, 170, 0" : "136, 136, 136"}, 0.3); border-radius: 4px; margin-top: 10px;">
        <div style="font-size: 14px; font-weight: bold; color: ${statusColor};">${statusText}</div>
      </div>
    `;

    // Hover effects
    button.addEventListener("mouseenter", () => {
      button.style.transform = "scale(1.05)";
      button.style.boxShadow = `0 0 30px ${statusColor}`;
      button.style.background = "rgba(0, 50, 0, 0.5)";
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "scale(1)";
      button.style.boxShadow = "none";
      button.style.background = "rgba(0, 0, 0, 0.6)";
    });

    // Click handler (can add more functionality)
    button.addEventListener("click", () => {
      console.log(`Sensor ${sensorNumber} clicked:`, sensor);
      // Could show detailed sensor info modal here
    });

    return button;
  }

  /**
   * Update with new node data
   */
  public update(nodes: UDPDataPoint[]): void {
    this.nodes = nodes;
    const contentArea = document.getElementById("screen-103-content");

    if (contentArea) {
      if (this.selectedNodeId !== null) {
        // Find the selected node in new data
        const selectedNode = nodes.find(
          (n) => n.globalId === this.selectedNodeId
        );
        if (selectedNode) {
          this.showSensorView(contentArea, selectedNode);
        } else {
          // Node no longer exists, go back to list
          this.selectedNodeId = null;
          this.showNodeList(contentArea);
        }
      } else {
        // Refresh node list
        this.showNodeList(contentArea);
      }
    }
  }

  /**
   * Destroy the view
   */
  public destroy(): void {
    const existing = document.getElementById("screen-103-sensor-view");
    if (existing) {
      existing.remove();
    }
    this.container = null;
    this.selectedNodeId = null;
  }
}
