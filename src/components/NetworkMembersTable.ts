import { UDPDataPoint } from "./UDPNodesManager";
import { MapManager } from "../map";

export class NetworkMembersTable {
  private container: HTMLElement | null = null;
  private expandedRows: Set<number> = new Set();
  private mapManager: MapManager | null = null;

  public setMapManager(mapManager: MapManager | null): void {
    this.mapManager = mapManager;
  }

  public create(parentContainer: HTMLElement): void {
    // Create main container
    const container = document.createElement("div");
    container.id = "network-members-table";
    container.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 380px;
      max-height: calc(100vh - 20px);
      background: rgba(10, 10, 20, 0.95);
      border: 2px solid rgba(0, 255, 0, 0.6);
      border-radius: 8px;
      padding: 10px;
      margin: 10px;
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 200;
      font-family: 'Courier New', monospace;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
    `;

    // Map Center Display
    const mapCenterDiv = document.createElement("div");
    mapCenterDiv.id = "network-table-map-center";
    mapCenterDiv.style.cssText = `
      background: rgba(0, 0, 0, 0.5);
      padding: 8px;
      margin-bottom: 10px;
      border-radius: 4px;
      border: 1px solid rgba(0, 255, 0, 0.3);
      font-size: 11px;
    `;
    container.appendChild(mapCenterDiv);

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      color: #00ff00;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 2px solid rgba(0, 255, 0, 0.3);
    `;
    header.textContent = "NETWORK MEMBERS";
    container.appendChild(header);

    // Table container
    const tableContainer = document.createElement("div");
    tableContainer.id = "network-table-content";
    container.appendChild(tableContainer);

    parentContainer.appendChild(container);
    this.container = container;

    // Update map center display
    this.updateMapCenter();

    // Listen for map center changes
    window.addEventListener("map-center-changed", () => {
      this.updateMapCenter();
    });
  }

  private updateMapCenter(): void {
    const mapCenterDiv = document.getElementById("network-table-map-center");
    if (!mapCenterDiv) return;

    const center = this.mapManager?.getCenter();
    if (center) {
      mapCenterDiv.innerHTML = `
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 4px; font-size: 12px;">📍 MAP CENTER</div>
        <div style="color: #cccccc; display: flex; justify-content: space-between;">
          <span>Lat: <span style="color: #00ff00; font-weight: bold;">${center.lat.toFixed(6)}</span></span>
          <span>Lng: <span style="color: #00ff00; font-weight: bold;">${center.lng.toFixed(6)}</span></span>
        </div>
      `;
    } else {
      mapCenterDiv.innerHTML = `
        <div style="color: #00ff00; font-weight: bold; margin-bottom: 4px; font-size: 12px;">📍 MAP CENTER</div>
        <div style="color: #888888;">Initializing...</div>
      `;
    }
  }

  public update(networkMembers: UDPDataPoint[]): void {
    const tableContainer = document.getElementById("network-table-content");
    if (!tableContainer) return;

    // Filter to only show nodes with opcode 102 data (have callsign or other opcode 102 fields)
    const membersWith102Data = networkMembers.filter(
      (member) =>
        member.callsign !== undefined ||
        member.internalData !== undefined ||
        member.regionalData !== undefined ||
        member.battleGroupData !== undefined
    );

    if (membersWith102Data.length === 0) {
      tableContainer.innerHTML = `
        <div style="color: #888; text-align: center; padding: 20px;">
          No network members available
        </div>
      `;
      return;
    }

    // Create table
    const table = document.createElement("table");
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      table-layout: fixed;
    `;

    // Table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.style.cssText = `
      background: rgba(0, 255, 0, 0.1);
      border-bottom: 2px solid rgba(0, 255, 0, 0.3);
    `;

    const headers = ["Callsign", "ID", "Type", "Status", "Details"];
    headers.forEach((headerText) => {
      const th = document.createElement("th");
      th.textContent = headerText;
      th.style.cssText = `
        padding: 6px 3px;
        text-align: left;
        color: #00ff00;
        font-weight: bold;
        font-size: 10px;
      `;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement("tbody");
    membersWith102Data.forEach((member) => {
      const row = this.createMemberRow(member);
      tbody.appendChild(row);
      // Create and insert detail row after main row
      const detailRow = this.createDetailRow(member);
      detailRow.style.display = this.expandedRows.has(member.globalId)
        ? "table-row"
        : "none";
      tbody.appendChild(detailRow);
    });
    table.appendChild(tbody);

    tableContainer.innerHTML = "";
    tableContainer.appendChild(table);
  }

  private createMemberRow(member: UDPDataPoint): HTMLElement {
    const row = document.createElement("tr");
    row.style.cssText = `
      border-bottom: 1px solid rgba(100, 100, 100, 0.2);
      cursor: pointer;
      transition: background 0.2s;
    `;

    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(0, 255, 0, 0.1)";
    });
    row.addEventListener("mouseleave", () => {
      if (!this.expandedRows.has(member.globalId)) {
        row.style.background = "transparent";
      }
    });

    // Callsign
    const callsignCell = document.createElement("td");
    callsignCell.textContent = member.callsign || `ID${member.globalId}`;
    callsignCell.style.cssText = `
      padding: 6px 3px;
      color: #00ff00;
      font-weight: bold;
      font-size: 10px;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    if (member.internalData?.isMotherAc) {
      callsignCell.textContent += " ✈️";
      callsignCell.style.color = "#ffaa00";
    }
    row.appendChild(callsignCell);

    // ID
    const idCell = document.createElement("td");
    idCell.textContent = member.globalId.toString();
    idCell.style.cssText = `
      padding: 6px 3px;
      color: #cccccc;
      font-size: 10px;
    `;
    row.appendChild(idCell);

    // Type/Category
    const typeCell = document.createElement("td");
    const acCategory = member.regionalData?.acCategory || "Unknown";
    const acType = member.regionalData?.acType || "";
    typeCell.textContent = `${acCategory}${acType ? `/${acType}` : ""}`;
    typeCell.style.cssText = `
      padding: 6px 3px;
      color: #cccccc;
      font-size: 9px;
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    row.appendChild(typeCell);

    // Status indicators
    const statusCell = document.createElement("td");
    statusCell.style.cssText = `
      padding: 6px 3px;
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
      max-width: 100px;
    `;

    // ACS Status
    const acsStatus = member.battleGroupData?.acsStatus;
    if (acsStatus !== undefined) {
      const acsIndicator = document.createElement("span");
      acsIndicator.textContent = "ACS";
      acsIndicator.style.cssText = `
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: bold;
        background: ${this.getACSColor(acsStatus)};
        color: ${this.getACSTextColor(acsStatus)};
      `;
      statusCell.appendChild(acsIndicator);
    }

    // Fuel Status
    const fuel = member.battleGroupData?.fuel;
    if (fuel !== undefined) {
      const fuelIndicator = document.createElement("span");
      fuelIndicator.textContent = `FUEL:${fuel.toFixed(0)}%`;
      fuelIndicator.style.cssText = `
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: bold;
        background: ${this.getFuelColor(fuel)};
        color: #000;
      `;
      statusCell.appendChild(fuelIndicator);
    }

    // Emergency Status
    const combatEmergency = member.battleGroupData?.combatEmergency;
    const recoveryEmergency = member.regionalData?.recoveryEmergency;
    if (combatEmergency || recoveryEmergency) {
      const emergencyIndicator = document.createElement("span");
      emergencyIndicator.textContent = "EMERG";
      emergencyIndicator.style.cssText = `
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: bold;
        background: #ff0000;
        color: #fff;
        animation: blink 1s infinite;
      `;
      statusCell.appendChild(emergencyIndicator);
    }

    // Master Arm Status
    const masterArm = member.battleGroupData?.masterArmStatus;
    if (masterArm !== undefined) {
      const armIndicator = document.createElement("span");
      armIndicator.textContent = masterArm ? "ARM" : "SAFE";
      armIndicator.style.cssText = `
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: bold;
        background: ${masterArm ? "#ff4400" : "#444"};
        color: #fff;
      `;
      statusCell.appendChild(armIndicator);
    }

    row.appendChild(statusCell);

    // Details toggle
    const detailsCell = document.createElement("td");
    const expandBtn = document.createElement("button");
    expandBtn.textContent = this.expandedRows.has(member.globalId) ? "−" : "+";
    expandBtn.style.cssText = `
      width: 24px;
      height: 24px;
      background: rgba(0, 255, 0, 0.2);
      border: 1px solid rgba(0, 255, 0, 0.5);
      color: #00ff00;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
    `;
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleDetails(member.globalId, row);
      expandBtn.textContent = this.expandedRows.has(member.globalId)
        ? "−"
        : "+";
    });
    detailsCell.appendChild(expandBtn);
    detailsCell.style.cssText = `
      padding: 6px 3px;
      text-align: center;
    `;
    row.appendChild(detailsCell);

    // Add click handler to toggle details
    row.addEventListener("click", () => {
      this.toggleDetails(member.globalId, row);
      expandBtn.textContent = this.expandedRows.has(member.globalId)
        ? "−"
        : "+";
    });

    return row;
  }

  private createDetailRow(member: UDPDataPoint): HTMLElement {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.style.cssText = `
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid rgba(0, 255, 0, 0.3);
      width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
    `;

    const detailsContainer = document.createElement("div");
    detailsContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      font-size: 10px;
      width: 100%;
      box-sizing: border-box;
    `;

    // Radio Frequencies and Network IDs
    const radioSection = this.createRadioSection(member);
    detailsContainer.appendChild(radioSection);

    // Weapon Loadout
    const weaponSection = this.createWeaponSection(member);
    detailsContainer.appendChild(weaponSection);

    // Sensor Status
    const sensorSection = this.createSensorSection(member);
    detailsContainer.appendChild(sensorSection);

    // Radar Overlay Info
    const radarSection = this.createRadarSection(member);
    detailsContainer.appendChild(radarSection);

    cell.appendChild(detailsContainer);
    row.appendChild(cell);
    return row;
  }

  private createRadioSection(member: UDPDataPoint): HTMLElement {
    const section = document.createElement("div");
    section.style.cssText = `
      background: rgba(0, 50, 0, 0.3);
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 255, 0, 0.2);
      width: 100%;
      box-sizing: border-box;
    `;

    const title = document.createElement("div");
    title.textContent = "RADIO / NETWORK";
    title.style.cssText = `
      color: #00ff00;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 11px;
    `;
    section.appendChild(title);

    const radioData = member.radioData || {};

    // Helper function to format legacy frequency objects
    // D1-D6 represent digits of a frequency (e.g., 123.456 MHz)
    const formatLegacyFreq = (freq: any): string => {
      if (!freq || typeof freq !== "object") return "N/A";
      const digits = [freq.D1, freq.D2, freq.D3, freq.D4, freq.D5, freq.D6].map(
        (v) => (v !== undefined && v !== null ? v : 0)
      );

      // Check if all digits are zero
      if (digits.every((d) => d === 0)) return "N/A";

      // Format as frequency: D1D2D.D3D4D5D6 (e.g., 123.456)
      // Or if it's a 6-digit number, format as D1D2D.D3D4D5D6
      const freqStr = digits.map((d) => d.toString()).join("");
      if (freqStr.length >= 3) {
        return `${freqStr.slice(0, 3)}.${freqStr.slice(3)} MHz`;
      }
      return freqStr || "N/A";
    };

    const items = [
      { label: "Legacy Freq 1", value: radioData.legacyFreq1, isObject: true },
      { label: "Legacy Freq 2", value: radioData.legacyFreq2, isObject: true },
      { label: "MANET L Net ID", value: radioData.manetLNetId },
      { label: "MANET U1 Net ID", value: radioData.manetU1NetId },
      { label: "MANET U2 Net ID", value: radioData.manetU2NetId },
      { label: "SATCOM Mode", value: radioData.satcomMode },
      { label: "Guard Band", value: radioData.guardBand },
    ];

    items.forEach((item) => {
      if (item.value !== undefined) {
        const div = document.createElement("div");
        div.style.cssText = `
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          color: #cccccc;
        `;

        // Format the value - handle objects for legacy frequencies
        let displayValue: string;
        if (item.isObject && typeof item.value === "object") {
          displayValue = formatLegacyFreq(item.value);
        } else {
          displayValue = item.value?.toString() || "N/A";
        }

        div.innerHTML = `
          <span>${item.label}:</span>
          <span style="color: #00ff00; font-weight: bold;">${displayValue}</span>
        `;
        section.appendChild(div);
      }
    });

    return section;
  }

  private createWeaponSection(member: UDPDataPoint): HTMLElement {
    const section = document.createElement("div");
    section.style.cssText = `
      background: rgba(50, 0, 0, 0.3);
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(255, 0, 0, 0.2);
      width: 100%;
      box-sizing: border-box;
    `;

    const title = document.createElement("div");
    title.textContent = "WEAPON LOADOUT";
    title.style.cssText = `
      color: #ff4444;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 11px;
    `;
    section.appendChild(title);

    const battleData = member.battleGroupData || {};
    const numWeapons = battleData.numOfWeapons || 0;
    const weaponsData = battleData.weaponsData || [];

    const countDiv = document.createElement("div");
    countDiv.textContent = `Total Weapons: ${numWeapons}`;
    countDiv.style.cssText = `
      color: #cccccc;
      margin-bottom: 8px;
      font-weight: bold;
    `;
    section.appendChild(countDiv);

    if (weaponsData.length > 0) {
      weaponsData.forEach((weapon: any, index: number) => {
        const weaponDiv = document.createElement("div");
        weaponDiv.style.cssText = `
          background: rgba(0, 0, 0, 0.3);
          padding: 6px;
          margin-bottom: 4px;
          border-radius: 3px;
          border-left: 3px solid ${this.getWeaponStatusColor(weapon)};
        `;
        weaponDiv.innerHTML = `
          <div style="color: #ffaa00; font-weight: bold; font-size: 10px;">
            Weapon ${index + 1}
          </div>
          <div style="color: #cccccc; font-size: 9px; margin-top: 2px;">
            Type: ${weapon.weaponType || "N/A"} | 
            Status: ${weapon.status || "N/A"} | 
            Qty: ${weapon.quantity || 0}
          </div>
        `;
        section.appendChild(weaponDiv);
      });
    } else {
      const noWeapons = document.createElement("div");
      noWeapons.textContent = "No weapons data";
      noWeapons.style.cssText = `
        color: #888;
        font-style: italic;
        font-size: 9px;
      `;
      section.appendChild(noWeapons);
    }

    // Chaff/Flare
    if (
      battleData.chaffRemaining !== undefined ||
      battleData.flareRemaining !== undefined
    ) {
      const counterDiv = document.createElement("div");
      counterDiv.style.cssText = `
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      `;
      if (battleData.chaffRemaining !== undefined) {
        counterDiv.innerHTML += `
          <div style="color: #cccccc; font-size: 9px;">
            Chaff: <span style="color: #00ff00;">${battleData.chaffRemaining}</span>
          </div>
        `;
      }
      if (battleData.flareRemaining !== undefined) {
        counterDiv.innerHTML += `
          <div style="color: #cccccc; font-size: 9px;">
            Flare: <span style="color: #ff4400;">${battleData.flareRemaining}</span>
          </div>
        `;
      }
      section.appendChild(counterDiv);
    }

    return section;
  }

  private createSensorSection(member: UDPDataPoint): HTMLElement {
    const section = document.createElement("div");
    section.style.cssText = `
      background: rgba(0, 0, 50, 0.3);
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 100, 255, 0.2);
      width: 100%;
      box-sizing: border-box;
    `;

    const title = document.createElement("div");
    title.textContent = "SENSOR STATUS";
    title.style.cssText = `
      color: #4488ff;
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 11px;
    `;
    section.appendChild(title);

    const battleData = member.battleGroupData || {};
    const numSensors = battleData.numOfSensors || 0;
    const sensorsData = battleData.sensorsData || [];

    const countDiv = document.createElement("div");
    countDiv.textContent = `Total Sensors: ${numSensors}`;
    countDiv.style.cssText = `
      color: #cccccc;
      margin-bottom: 8px;
      font-weight: bold;
    `;
    section.appendChild(countDiv);

    if (sensorsData.length > 0) {
      sensorsData.forEach((sensor: any, index: number) => {
        const sensorDiv = document.createElement("div");
        sensorDiv.style.cssText = `
          background: rgba(0, 0, 0, 0.3);
          padding: 6px;
          margin-bottom: 4px;
          border-radius: 3px;
          border-left: 3px solid ${this.getSensorStatusColor(sensor)};
        `;
        sensorDiv.innerHTML = `
          <div style="color: #4488ff; font-weight: bold; font-size: 10px;">
            Sensor ${index + 1}
          </div>
          <div style="color: #cccccc; font-size: 9px; margin-top: 2px;">
            Type: ${sensor.sensorType || "N/A"} | 
            Status: ${sensor.status || "N/A"} | 
            Range: ${sensor.range || "N/A"}
          </div>
        `;
        section.appendChild(sensorDiv);
      });
    } else {
      const noSensors = document.createElement("div");
      noSensors.textContent = "No sensors data";
      noSensors.style.cssText = `
        color: #888;
        font-style: italic;
        font-size: 9px;
      `;
      section.appendChild(noSensors);
    }

    return section;
  }

  private createRadarSection(member: UDPDataPoint): HTMLElement {
    const section = document.createElement("div");
    section.style.cssText = `
      background: rgba(50, 50, 0, 0.3);
      padding: 3px;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 0, 0.2);
      width: 100%;
      max-height: 90px;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
    `;

    const title = document.createElement("div");
    title.textContent = "RADAR OVERLAY";
    title.style.cssText = `
      color: #ffff00;
      font-weight: bold;
      margin-bottom: 1px;
      font-size: 8px;
    `;
    section.appendChild(title);

    const battleData = member.battleGroupData || {};
    const regionalData = member.regionalData || {};

    // Heading (from metadata or other sources)
    const heading = member.trueHeading || member.heading;

    // Coverage zones
    const coverageAz = battleData.radarZoneCoverageAz;
    const coverageEl = battleData.radarZoneCoverageEl;
    const centerAz = battleData.radarZoneCenterAz;
    const centerEl = battleData.radarZoneCenterEl;

    // Create radar visualization canvas
    if (
      heading !== undefined ||
      coverageAz !== undefined ||
      centerAz !== undefined
    ) {
      const radarCanvas = document.createElement("canvas");
      radarCanvas.width = 50;
      radarCanvas.height = 50;
      radarCanvas.style.cssText = `
        width: 50px;
        height: 50px;
        margin: 1px auto;
        display: block;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 0, 0.3);
        border-radius: 50%;
        max-width: 100%;
      `;
      this.drawRadarOverlay(
        radarCanvas,
        heading,
        coverageAz,
        coverageEl,
        centerAz,
        centerEl
      );
      section.appendChild(radarCanvas);
    }

    // Text information - combine into compact format
    const infoDiv = document.createElement("div");
    infoDiv.style.cssText = `
      color: #cccccc;
      margin-top: 1px;
      font-size: 7px;
      text-align: center;
      line-height: 1.1;
    `;
    const infoParts: string[] = [];
    if (heading !== undefined) {
      infoParts.push(
        `H: <span style="color: #ffff00;">${heading.toFixed(1)}°</span>`
      );
    }
    if (coverageAz !== undefined || coverageEl !== undefined) {
      const az = coverageAz !== undefined ? coverageAz.toFixed(1) + "°" : "N/A";
      const el = coverageEl !== undefined ? coverageEl.toFixed(1) + "°" : "N/A";
      infoParts.push(
        `Cov: <span style="color: #ffff00;">Az${az} El${el}</span>`
      );
    }
    if (centerAz !== undefined || centerEl !== undefined) {
      const az = centerAz !== undefined ? centerAz.toFixed(1) + "°" : "N/A";
      const el = centerEl !== undefined ? centerEl.toFixed(1) + "°" : "N/A";
      infoParts.push(
        `Ctr: <span style="color: #ffff00;">Az${az} El${el}</span>`
      );
    }
    if (infoParts.length > 0) {
      infoDiv.innerHTML = infoParts.join(" | ");
      section.appendChild(infoDiv);
    }

    // Circle Ranges from opcode102J
    const circleRanges = member.circleRanges;
    if (circleRanges) {
      const ranges: number[] = [];
      if (circleRanges.D1 !== undefined && circleRanges.D1 !== 0)
        ranges.push(circleRanges.D1);
      if (circleRanges.D2 !== undefined && circleRanges.D2 !== 0)
        ranges.push(circleRanges.D2);
      if (circleRanges.D3 !== undefined && circleRanges.D3 !== 0)
        ranges.push(circleRanges.D3);
      if (circleRanges.D4 !== undefined && circleRanges.D4 !== 0)
        ranges.push(circleRanges.D4);
      if (circleRanges.D5 !== undefined && circleRanges.D5 !== 0)
        ranges.push(circleRanges.D5);
      if (circleRanges.D6 !== undefined && circleRanges.D6 !== 0)
        ranges.push(circleRanges.D6);

      if (ranges.length > 0) {
        const rangesDiv = document.createElement("div");
        rangesDiv.style.cssText = `
          color: #cccccc;
          margin-top: 1px;
          padding-top: 1px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 7px;
          text-align: center;
          line-height: 1.1;
        `;
        rangesDiv.innerHTML = `
          <span style="color: #ffff00; font-weight: bold;">Ranges:</span> ${ranges.map((r, idx) => `<span style="color: #ffff00;">C${idx + 1}:${r}NM</span>`).join(" ")}
        `;
        section.appendChild(rangesDiv);
      }
    }

    // Locks
    const q1Lock = battleData.q1LockGlobalId;
    const q2Lock = battleData.q2LockGlobalId;
    const radarLock = battleData.radarLockGlobalId;
    if (q1Lock || q2Lock || radarLock) {
      const locksDiv = document.createElement("div");
      locksDiv.style.cssText = `
        margin-top: 1px;
        padding-top: 1px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        color: #ff4444;
        font-size: 7px;
        font-weight: bold;
        text-align: center;
        line-height: 1.1;
      `;
      locksDiv.textContent = `LOCKS: Q1:${q1Lock || "N/A"} Q2:${q2Lock || "N/A"} Radar:${radarLock || "N/A"}`;
      section.appendChild(locksDiv);
    }

    return section;
  }

  private drawRadarOverlay(
    canvas: HTMLCanvasElement,
    heading: number | undefined,
    coverageAz: number | undefined,
    coverageEl: number | undefined,
    centerAz: number | undefined,
    centerEl: number | undefined
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw radar circles
    ctx.strokeStyle = "rgba(255, 255, 0, 0.3)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw cardinal directions
    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
    ctx.lineWidth = 1;
    const directions = [
      { label: "N", angle: -90 },
      { label: "E", angle: 0 },
      { label: "S", angle: 90 },
      { label: "W", angle: 180 },
    ];
    directions.forEach((dir) => {
      const angle = (dir.angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      );
      ctx.stroke();
      // Draw labels
      ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        dir.label,
        centerX + Math.cos(angle) * (radius + 8),
        centerY + Math.sin(angle) * (radius + 8)
      );
    });

    // Draw heading line
    if (heading !== undefined) {
      const headingRad = ((heading - 90) * Math.PI) / 180; // Convert to canvas coordinates
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(headingRad) * radius * 0.8,
        centerY + Math.sin(headingRad) * radius * 0.8
      );
      ctx.stroke();
      // Draw heading label
      ctx.fillStyle = "#00ff00";
      ctx.font = "9px monospace";
      ctx.fillText(
        `${heading.toFixed(0)}°`,
        centerX + Math.cos(headingRad) * (radius * 0.6),
        centerY + Math.sin(headingRad) * (radius * 0.6) - 5
      );
    }

    // Draw coverage zone (azimuth arc)
    if (coverageAz !== undefined && centerAz !== undefined) {
      const centerAzRad = ((centerAz - 90) * Math.PI) / 180;
      const halfCoverage = (coverageAz * Math.PI) / 180 / 2;
      ctx.strokeStyle = "rgba(255, 255, 0, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius * 0.7,
        centerAzRad - halfCoverage,
        centerAzRad + halfCoverage
      );
      ctx.stroke();
    }

    // Draw center zone indicator
    if (centerAz !== undefined) {
      const centerAzRad = ((centerAz - 90) * Math.PI) / 180;
      ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
      ctx.beginPath();
      ctx.arc(
        centerX + Math.cos(centerAzRad) * radius * 0.5,
        centerY + Math.sin(centerAzRad) * radius * 0.5,
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  private toggleDetails(globalId: number, row: HTMLElement): void {
    if (this.expandedRows.has(globalId)) {
      this.expandedRows.delete(globalId);
      row.style.background = "transparent";
      // Find and hide detail row (should be the next row)
      const nextRow = row.nextElementSibling as HTMLElement;
      if (nextRow && nextRow.tagName === "TR") {
        nextRow.style.display = "none";
      }
    } else {
      this.expandedRows.add(globalId);
      row.style.background = "rgba(0, 255, 0, 0.15)";
      // Find and show detail row (should be the next row)
      const nextRow = row.nextElementSibling as HTMLElement;
      if (nextRow && nextRow.tagName === "TR") {
        nextRow.style.display = "table-row";
      }
    }
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

  private getWeaponStatusColor(weapon: any): string {
    const status = weapon.status;
    if (status === "READY" || status === 1) return "#00ff00";
    if (status === "LOADING" || status === 2) return "#ffff00";
    if (status === "EMPTY" || status === 0) return "#888888";
    return "#ff4400";
  }

  private getSensorStatusColor(sensor: any): string {
    const status = sensor.status;
    if (status === "ACTIVE" || status === 1) return "#00ff00";
    if (status === "STANDBY" || status === 2) return "#ffff00";
    if (status === "OFFLINE" || status === 0) return "#888888";
    return "#4488ff";
  }

  public destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.expandedRows.clear();
  }
}
