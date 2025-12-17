import { UDPNodesManager, UDPDataPoint } from "./UDPNodesManager";

export class AircraftLayoutDisplay {
  private layoutContainer: HTMLElement | null = null;
  private nodesListContainer: HTMLElement | null = null;
  private udpNodesManager: UDPNodesManager | null = null;
  private updateInterval: number | null = null;
  private selectedNodeId: number | null = null;

  constructor(udpNodesManager?: UDPNodesManager) {
    this.udpNodesManager = udpNodesManager || null;
  }

  public create(container: HTMLElement): HTMLElement {
    // Remove existing layout if any
    const existing = document.getElementById("aircraft-layout-display");
    if (existing) {
      existing.remove();
    }

    const layout = document.createElement("div");
    layout.id = "aircraft-layout-display";
    layout.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 50%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding-left: 20px;
      background: #000000;
      overflow: hidden;
    `;

    // Create image element for aircraft layout
    const img = document.createElement("img");
    // Try paths in order - start with root-relative, then try without leading slash
    const imagePaths = [
      "aircraft-layout.png",
      "/aircraft-layout.png",
      "./aircraft-layout.png"
    ];
    let currentPathIndex = 0;
    
    img.src = imagePaths[currentPathIndex];
    img.alt = "Aircraft Layout";
    img.style.cssText = `
      max-width: 95%;
      max-height: 95%;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
      opacity: 1;
    `;

    // Add error handling to try alternative paths
    img.onerror = () => {
      currentPathIndex++;
      if (currentPathIndex < imagePaths.length) {
        console.log(`Trying alternative path: ${imagePaths[currentPathIndex]}`);
        img.src = imagePaths[currentPathIndex];
      } else {
        console.error("Failed to load aircraft-layout.png from all attempted paths:", imagePaths);
      }
    };

    img.onload = () => {
      console.log(`Aircraft layout image loaded successfully from: ${img.src}`);
    };

    layout.appendChild(img);
    container.appendChild(layout);
    this.layoutContainer = layout;

    // Create right side panel for green nodes list
    this.createNodesList(container);

    // Start update loop to refresh the nodes list
    this.startUpdateLoop();

    return layout;
  }

  private createNodesList(container: HTMLElement): void {
    // Remove existing nodes list if any
    const existing = document.getElementById("aircraft-layout-nodes-list");
    if (existing) {
      existing.remove();
    }

    const nodesList = document.createElement("div");
    nodesList.id = "aircraft-layout-nodes-list";
    nodesList.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 50%;
      height: 100%;
      pointer-events: auto;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      padding-top: 20px;
      padding-bottom: 20px;
      padding-left: 20px;
      padding-right: 20px;
      background: #000000;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
    `;

    // Title
    const title = document.createElement("div");
    title.textContent = "Network Members";
    title.style.cssText = `
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      text-shadow: 0 0 5px rgba(0, 255, 0, 0.8);
      width: 100%;
      border-bottom: 2px solid #00ff00;
      padding-bottom: 10px;
    `;
    nodesList.appendChild(title);

    // Container for node items
    const nodesContainer = document.createElement("div");
    nodesContainer.id = "green-nodes-container";
    nodesContainer.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    nodesList.appendChild(nodesContainer);

    container.appendChild(nodesList);
    this.nodesListContainer = nodesList;

    // Initial update
    this.updateNodesList();
  }

  private updateNodesList(): void {
    const nodesContainer = document.getElementById("green-nodes-container");
    if (!nodesContainer || !this.udpNodesManager) {
      return;
    }

    // Remove compact detail view if no node selected
    if (this.selectedNodeId === null) {
      const existingDetail = document.getElementById("aircraft-layout-detail");
      if (existingDetail) {
        existingDetail.remove();
      }
    }

    // Get all nodes and filter for green nodes (opcode 101)
    const allNodes = this.udpNodesManager.getAllNodes();
    const greenNodes = allNodes.filter((node) => node.opcode === 101);

    // If a node is selected, update the compact detail view
    if (this.selectedNodeId !== null) {
      const selectedNode = allNodes.find((n) => n.globalId === this.selectedNodeId);
      if (selectedNode) {
        this.createCompactDetailView(this.selectedNodeId, selectedNode);
      }
    }

    // Clear existing nodes
    nodesContainer.innerHTML = "";

    if (greenNodes.length === 0) {
      const noNodesMsg = document.createElement("div");
      noNodesMsg.textContent = "No network members available";
      noNodesMsg.style.cssText = `
        color: #888888;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        padding: 10px;
      `;
      nodesContainer.appendChild(noNodesMsg);
      return;
    }

    // Sort by globalId
    greenNodes.sort((a, b) => a.globalId - b.globalId);

    // Create list items for each green node
    greenNodes.forEach((node) => {
      const nodeItem = this.createNodeItem(node);
      nodesContainer.appendChild(nodeItem);
    });
  }

  private createNodeItem(node: UDPDataPoint): HTMLElement {
    const isSelected = this.selectedNodeId === node.globalId;
    const item = document.createElement("div");
    item.style.cssText = `
      background: ${isSelected ? "rgba(0, 255, 0, 0.3)" : "rgba(0, 255, 0, 0.1)"};
      border: 2px solid ${isSelected ? "#00ff88" : "#00ff00"};
      border-radius: 4px;
      padding: 12px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      width: 100%;
      box-sizing: border-box;
      cursor: pointer;
      transition: all 0.2s ease;
      ${isSelected ? "box-shadow: 0 0 8px rgba(0, 255, 0, 0.6);" : ""}
    `;

    // Add hover effect
    item.addEventListener("mouseenter", () => {
      item.style.background = "rgba(0, 255, 0, 0.2)";
      item.style.borderColor = "#00ff88";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "rgba(0, 255, 0, 0.1)";
      item.style.borderColor = "#00ff00";
    });

    // Add click handler
    item.addEventListener("click", () => {
      this.selectedNodeId = node.globalId;
      this.updateNodesList();
    });

    const globalId = document.createElement("div");
    globalId.textContent = `ID: ${node.globalId}`;
    globalId.style.cssText = `
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 8px;
      color: #00ff00;
      text-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;
    item.appendChild(globalId);

    // Altitude
    if (node.altitude !== undefined) {
      const alt = document.createElement("div");
      alt.textContent = `Altitude: ${Math.round(node.altitude)} ft`;
      alt.style.cssText = `margin-bottom: 4px;`;
      item.appendChild(alt);
    }

    // Heading
    if (node.heading !== undefined || node.trueHeading !== undefined) {
      const heading = document.createElement("div");
      const headingValue = node.trueHeading !== undefined ? node.trueHeading : node.heading;
      heading.textContent = `Heading: ${Math.round(headingValue)}°`;
      heading.style.cssText = `margin-bottom: 4px;`;
      item.appendChild(heading);
    }

    // Ground Speed
    if (node.groundSpeed !== undefined) {
      const speed = document.createElement("div");
      speed.textContent = `Speed: ${Math.round(node.groundSpeed)} kts`;
      speed.style.cssText = `margin-bottom: 4px;`;
      item.appendChild(speed);
    }

    // Coordinates
    if (node.latitude !== undefined && node.longitude !== undefined) {
      const coords = document.createElement("div");
      coords.textContent = `Lat: ${node.latitude.toFixed(4)}, Lng: ${node.longitude.toFixed(4)}`;
      coords.style.cssText = `
        margin-top: 4px;
        font-size: 10px;
        color: #88ff88;
      `;
      item.appendChild(coords);
    }

    return item;
  }

  private showNodeDetail(globalId: number): void {
    const nodesContainer = document.getElementById("green-nodes-container");
    if (!nodesContainer || !this.udpNodesManager) {
      return;
    }

    // Get the node with opcode 102 data (or merged data)
    const allNodes = this.udpNodesManager.getAllNodes();
    const node = allNodes.find((n) => n.globalId === globalId);

    if (!node) {
      nodesContainer.innerHTML = `<div style="color: #ff0000; font-family: 'Courier New', monospace;">Node ${globalId} not found</div>`;
      return;
    }

    // Remove existing detail view if any
    const existingDetail = document.getElementById("aircraft-layout-detail");
    if (existingDetail) {
      existingDetail.remove();
    }


    // Don't clear the list - keep it visible
    // Just highlight the selected item and show compact detail near aircraft layout
    this.createCompactDetailView(globalId, node);
  }

  private createCompactDetailView(globalId: number, node: UDPDataPoint): void {
    // Remove existing compact detail view
    const existing = document.getElementById("aircraft-layout-detail");
    if (existing) {
      existing.remove();
    }

    // Get the layout container (left side where aircraft image is)
    const layoutContainer = document.getElementById("aircraft-layout-display");
    if (!layoutContainer) return;

    const node102 = node as any;

    // Create compact detail panel below/next to aircraft layout
    const detailPanel = document.createElement("div");
    detailPanel.id = "aircraft-layout-detail";
    detailPanel.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: calc(50% - 60px);
      max-height: 40%;
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid #00ff00;
      border-radius: 4px;
      padding: 12px;
      overflow-y: auto;
      overflow-x: hidden;
      pointer-events: auto;
      z-index: 1001;
      font-family: 'Courier New', monospace;
      font-size: 9px;
      box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
    `;

    // Close button
    const closeBtn = document.createElement("div");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      color: #00ff00;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #00ff00;
      border-radius: 3px;
      background: rgba(0, 255, 0, 0.1);
    `;
    closeBtn.addEventListener("click", () => {
      this.selectedNodeId = null;
      this.updateNodesList();
      detailPanel.remove();
    });
    detailPanel.appendChild(closeBtn);

    // Title
    const title = document.createElement("div");
    title.textContent = `Node ${globalId} - ${node102.callsign || "N/A"}`;
    title.style.cssText = `
      color: #00ff00;
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #00ff00;
      padding-right: 25px;
    `;
    detailPanel.appendChild(title);

    // Compact status indicators
    const bgd = node102.battleGroupData;
    const rd = node102.regionalData;
    const statusRow = document.createElement("div");
    statusRow.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    `;

    if (bgd?.fuel !== undefined) {
      const fuelBadge = document.createElement("span");
      fuelBadge.textContent = `FUEL:${bgd.fuel.toFixed(0)}%`;
      fuelBadge.style.cssText = `
        padding: 2px 5px;
        border-radius: 2px;
        font-size: 8px;
        background: ${this.getFuelColor(bgd.fuel)};
        color: #000;
        font-weight: bold;
      `;
      statusRow.appendChild(fuelBadge);
    }

    if (bgd?.acsStatus !== undefined) {
      const acsBadge = document.createElement("span");
      acsBadge.textContent = `ACS:${bgd.acsStatus}`;
      acsBadge.style.cssText = `
        padding: 2px 5px;
        border-radius: 2px;
        font-size: 8px;
        background: ${this.getACSColor(bgd.acsStatus)};
        color: ${this.getACSTextColor(bgd.acsStatus)};
        font-weight: bold;
      `;
      statusRow.appendChild(acsBadge);
    }

    if (bgd?.masterArmStatus !== undefined) {
      const armBadge = document.createElement("span");
      armBadge.textContent = bgd.masterArmStatus ? "ARM" : "SAFE";
      armBadge.style.cssText = `
        padding: 2px 5px;
        border-radius: 2px;
        font-size: 8px;
        background: ${bgd.masterArmStatus ? "#ff4400" : "#444"};
        color: #fff;
        font-weight: bold;
      `;
      statusRow.appendChild(armBadge);
    }

    if (bgd?.combatEmergency || rd?.recoveryEmergency) {
      const emergBadge = document.createElement("span");
      emergBadge.textContent = "EMERG";
      emergBadge.style.cssText = `
        padding: 2px 5px;
        border-radius: 2px;
        font-size: 8px;
        background: #ff0000;
        color: #fff;
        font-weight: bold;
        animation: blink 1s infinite;
      `;
      statusRow.appendChild(emergBadge);
    }

    if (statusRow.children.length > 0) {
      detailPanel.appendChild(statusRow);
    }

    // Compact data grid (2 columns)
    const dataGrid = document.createElement("div");
    dataGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
      font-size: 9px;
    `;

    // Add key fields in compact format
    // Basic Info
    if (node102.callsign) {
      dataGrid.appendChild(this.createCompactRow("Callsign", node102.callsign));
    }
    if (node102.callsignId !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Callsign ID", node102.callsignId.toString()));
    }
    if (rd?.acCategory !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Category", rd.acCategory.toString()));
    }
    if (rd?.acType !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Type", rd.acType.toString()));
    }
    if (rd?.role !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Role", rd.role.toString()));
    }
    
    // Position & Flight Data
    if (node.altitude !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Altitude", `${Math.round(node.altitude)}ft`));
    }
    if (rd?.metadata?.baroAltitude !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Baro Alt", `${Math.round(rd.metadata.baroAltitude)}ft`));
    }
    if (node.heading !== undefined || node.trueHeading !== undefined) {
      const hdg = node.trueHeading !== undefined ? node.trueHeading : node.heading;
      dataGrid.appendChild(this.createCompactRow("Heading", `${Math.round(hdg)}°`));
    }
    if (rd?.metadata?.groundSpeed !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Speed", `${Math.round(rd.metadata.groundSpeed)}kts`));
    }
    if (rd?.metadata?.mach !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Mach", rd.metadata.mach.toFixed(3)));
    }
    if (node.latitude !== undefined && node.longitude !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Lat", node.latitude.toFixed(4)));
      dataGrid.appendChild(this.createCompactRow("Lng", node.longitude.toFixed(4)));
    }
    
    // Fuel (prominent position)
    if (bgd?.fuel !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Fuel", `${bgd.fuel.toFixed(1)}%`));
    }
    if (bgd?.fuelState !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Fuel State", bgd.fuelState.toString()));
    }
    
    // Battle Group / Status
    if (bgd?.chaffRemaining !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Chaff", bgd.chaffRemaining.toString()));
    }
    if (bgd?.flareRemaining !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Flare", bgd.flareRemaining.toString()));
    }
    if (bgd?.combatEmergency !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Combat Emerg", bgd.combatEmergency ? "YES" : "NO"));
    }
    if (bgd?.masterArmStatus !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Master Arm", bgd.masterArmStatus ? "ARMED" : "SAFE"));
    }
    if (bgd?.acsStatus !== undefined) {
      dataGrid.appendChild(this.createCompactRow("ACS Status", bgd.acsStatus.toString()));
    }
    if (bgd?.numOfWeapons !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Weapons", bgd.numOfWeapons.toString()));
    }
    if (bgd?.numofSensors !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Sensors", bgd.numofSensors.toString()));
    }
    if (bgd?.q1LockGlobalId !== undefined && bgd.q1LockGlobalId !== 0) {
      dataGrid.appendChild(this.createCompactRow("Q1 Lock ID", bgd.q1LockGlobalId.toString()));
    }
    if (bgd?.q2LockGlobalId !== undefined && bgd.q2LockGlobalId !== 0) {
      dataGrid.appendChild(this.createCompactRow("Q2 Lock ID", bgd.q2LockGlobalId.toString()));
    }
    if (bgd?.radarLockGlobalId !== undefined && bgd.radarLockGlobalId !== 0) {
      dataGrid.appendChild(this.createCompactRow("Radar Lock ID", bgd.radarLockGlobalId.toString()));
    }
    
    // Regional Data
    if (rd?.isValid !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Valid", rd.isValid ? "YES" : "NO"));
    }
    if (rd?.isMissionLeader !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Mission Leader", rd.isMissionLeader ? "YES" : "NO"));
    }
    if (rd?.isRogue !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Rogue", rd.isRogue ? "YES" : "NO"));
    }
    if (rd?.isFormation !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Formation", rd.isFormation ? "YES" : "NO"));
    }
    if (rd?.recoveryEmergency !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Recovery Emerg", rd.recoveryEmergency ? "YES" : "NO"));
    }
    if (rd?.c2Critical !== undefined) {
      dataGrid.appendChild(this.createCompactRow("C2 Critical", rd.c2Critical ? "YES" : "NO"));
    }
    if (rd?.idnTag !== undefined) {
      dataGrid.appendChild(this.createCompactRow("IDN Tag", rd.idnTag.toString()));
    }
    if (rd?.displayId !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Display ID", rd.displayId.toString()));
    }
    if (rd?.controllingNodeId !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Control Node", rd.controllingNodeId.toString()));
    }
    
    // Internal Data
    if (node102.internalData?.isMotherAc !== undefined) {
      const isMother = node102.internalData.isMotherAc === 1 || node102.internalData.isMotherAc === true;
      dataGrid.appendChild(this.createCompactRow("Mother AC", isMother ? "YES" : "NO"));
    }
    if (node102.internalData?.trackId !== undefined) {
      dataGrid.appendChild(this.createCompactRow("Track ID", node102.internalData.trackId.toString()));
    }
    
    // Radio Data
    const radioData = node102.radioData;
    if (radioData) {
      if (radioData.legacyFreq1) {
        const freq1 = this.formatLegacyFreq(radioData.legacyFreq1);
        if (freq1) {
          dataGrid.appendChild(this.createCompactRow("Freq 1", freq1));
        }
      }
      if (radioData.legacyFreq2) {
        const freq2 = this.formatLegacyFreq(radioData.legacyFreq2);
        if (freq2) {
          dataGrid.appendChild(this.createCompactRow("Freq 2", freq2));
        }
      }
      if (radioData.manetLNetId !== undefined) {
        dataGrid.appendChild(this.createCompactRow("MANET L", radioData.manetLNetId.toString()));
      }
      if (radioData.manetU1NetId !== undefined) {
        dataGrid.appendChild(this.createCompactRow("MANET U1", radioData.manetU1NetId.toString()));
      }
      if (radioData.manetU2NetId !== undefined) {
        dataGrid.appendChild(this.createCompactRow("MANET U2", radioData.manetU2NetId.toString()));
      }
      if (radioData.satcomMode !== undefined) {
        dataGrid.appendChild(this.createCompactRow("SATCOM", radioData.satcomMode.toString()));
      }
      if (radioData.guardBand !== undefined) {
        dataGrid.appendChild(this.createCompactRow("Guard Band", radioData.guardBand.toString()));
      }
    }
    
    // Additional Metadata
    if (rd?.metadata) {
      Object.keys(rd.metadata).forEach((key) => {
        if (!["baroAltitude", "groundSpeed", "mach"].includes(key)) {
          const value = rd.metadata[key];
          if (value !== undefined && value !== null) {
            dataGrid.appendChild(this.createCompactRow(`Meta.${key}`, this.formatValue(value)));
          }
        }
      });
    }

    detailPanel.appendChild(dataGrid);
    layoutContainer.appendChild(detailPanel);
  }

  private createCompactRow(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      border-bottom: 1px solid rgba(0, 255, 0, 0.2);
    `;

    const labelEl = document.createElement("span");
    labelEl.textContent = label + ":";
    labelEl.style.cssText = `color: #88ff88; font-weight: bold;`;
    row.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    valueEl.style.cssText = `color: #00ff00; text-align: right;`;
    row.appendChild(valueEl);

    return row;
  }

  private createSection(title: string): { section: HTMLElement; content: HTMLElement } {
    const section = document.createElement("div");
    section.style.cssText = `
      background: rgba(0, 255, 0, 0.05);
      border: 1px solid #00ff00;
      border-radius: 4px;
      padding: 12px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
    `;

    const titleEl = document.createElement("div");
    titleEl.textContent = title;
    titleEl.style.cssText = `
      font-weight: bold;
      font-size: 13px;
      margin-bottom: 10px;
      color: #00ff88;
      text-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
      border-bottom: 1px solid rgba(0, 255, 0, 0.3);
      padding-bottom: 6px;
    `;
    section.appendChild(titleEl);

    const content = document.createElement("div");
    content.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;
    section.appendChild(content);

    return { section, content };
  }

  private createDetailRow(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 4px 0;
      font-size: 11px;
      border-bottom: 1px solid rgba(0, 255, 0, 0.1);
    `;

    const labelEl = document.createElement("div");
    labelEl.textContent = label;
    labelEl.style.cssText = `
      color: #88ff88;
      font-weight: bold;
      min-width: 150px;
      flex-shrink: 0;
    `;
    row.appendChild(labelEl);

    const valueEl = document.createElement("div");
    valueEl.textContent = value;
    valueEl.style.cssText = `
      color: #00ff00;
      text-align: right;
      flex-grow: 1;
      word-break: break-word;
      white-space: pre-wrap;
    `;
    row.appendChild(valueEl);

    return row;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return "N/A";
    }
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
      // Check if it's a float that should be formatted
      if (value % 1 !== 0) {
        return value.toFixed(3);
      }
      return value.toString();
    }
    return String(value);
  }

  private createStatusRow(label: string, value: string, color: string): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 4px 0;
      font-size: 11px;
      border-bottom: 1px solid rgba(0, 255, 0, 0.1);
    `;

    const labelEl = document.createElement("div");
    labelEl.textContent = label;
    labelEl.style.cssText = `
      color: #88ff88;
      font-weight: bold;
      min-width: 150px;
      flex-shrink: 0;
    `;
    row.appendChild(labelEl);

    const valueEl = document.createElement("div");
    valueEl.textContent = value;
    valueEl.style.cssText = `
      color: ${color};
      text-align: right;
      flex-grow: 1;
      font-weight: bold;
      text-shadow: 0 0 5px ${color};
    `;
    row.appendChild(valueEl);

    return row;
  }

  private formatLegacyFreq(freq: any): string {
    if (!freq) return "";
    // opcode102J has D1-D6 bytes
    const bytes = [];
    if (freq.D1 !== undefined) bytes.push(freq.D1);
    if (freq.D2 !== undefined) bytes.push(freq.D2);
    if (freq.D3 !== undefined) bytes.push(freq.D3);
    if (freq.D4 !== undefined) bytes.push(freq.D4);
    if (freq.D5 !== undefined) bytes.push(freq.D5);
    if (freq.D6 !== undefined) bytes.push(freq.D6);
    
    if (bytes.length === 0) {
      // Try as array
      if (Array.isArray(freq)) {
        return freq.slice(0, 6).join(".");
      }
      return "";
    }
    return bytes.join(".");
  }

  private getACSColor(status: number): string {
    // ACS status color coding (adjust based on actual status values)
    if (status === 0) return "rgba(100, 100, 100, 0.5)"; // Off/Inactive
    if (status === 1) return "rgba(0, 255, 0, 0.6)"; // Active/Good
    if (status === 2) return "rgba(255, 255, 0, 0.6)"; // Warning
    return "rgba(255, 0, 0, 0.6)"; // Error/Critical
  }

  private getACSTextColor(status: number): string {
    if (status === 0) return "#888";
    if (status === 1) return "#000";
    if (status === 2) return "#000";
    return "#fff";
  }

  private getFuelColor(fuel: number): string {
    if (fuel > 50) return "rgba(0, 255, 0, 0.6)";
    if (fuel > 25) return "rgba(255, 255, 0, 0.6)";
    return "rgba(255, 0, 0, 0.6)";
  }

  private startUpdateLoop(): void {
    // Clear any existing interval
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Update every 500ms
    this.updateInterval = window.setInterval(() => {
      this.updateNodesList();
    }, 500);
  }

  public destroy(): void {
    // Clear update interval
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.layoutContainer) {
      this.layoutContainer.remove();
      this.layoutContainer = null;
    }

    if (this.nodesListContainer) {
      this.nodesListContainer.remove();
      this.nodesListContainer = null;
    }
  }
}

