import { EngagementData } from "./EngagementManager";
import { UDPDataPoint } from "./UDPNodesManager";

export class EngagementDisplay {
  private container: HTMLElement | null = null;
  private engagementData: EngagementData[] = [];
  private nodesMap: Map<number, UDPDataPoint> = new Map();

  /**
   * Create the aircraft-style engagement display
   */
  public create(parentContainer: HTMLElement): void {
    console.log("🎯 EngagementDisplay.create() called", {
      parentContainer: parentContainer?.id || "unknown",
      parentExists: !!parentContainer,
    });

    // ALWAYS remove existing display first to prevent duplicates
    this.destroy();

    const display = document.createElement("div");
    display.id = "engagement-hud-display";
    display.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      z-index: 10000 !important;
      font-family: 'Courier New', monospace !important;
      color: #00ff00 !important;
      background: rgba(0, 0, 0, 0.9) !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 20px !important;
      overflow-y: auto !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;

    console.log("✅ Created engagement display element");

    // Header section
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #00ff00;
      padding-bottom: 10px;
    `;

    const title = document.createElement("div");
    title.textContent = "ENGAGEMENT STATUS (OPCODE 103)";
    title.style.cssText = `
      font-size: 24px;
      font-weight: bold;
      color: #00ff00;
      text-shadow: 0 0 10px #00ff00;
      letter-spacing: 2px;
    `;

    const timestamp = document.createElement("div");
    timestamp.id = "engagement-timestamp";
    timestamp.textContent = this.getCurrentTime();
    timestamp.style.cssText = `
      font-size: 14px;
      color: #00ff00;
      opacity: 0.8;
    `;

    header.appendChild(title);
    header.appendChild(timestamp);
    display.appendChild(header);

    // Main content area
    const contentArea = document.createElement("div");
    contentArea.id = "engagement-content-area";
    contentArea.style.cssText = `
      flex: 1 !important;
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)) !important;
      gap: 20px !important;
      overflow-y: auto !important;
      padding-right: 10px !important;
      width: 100% !important;
      min-height: 200px !important;
    `;

    // Add a test message immediately to verify visibility
    const testMsg = document.createElement("div");
    testMsg.textContent = "ENGAGEMENT DISPLAY ACTIVE - Loading data...";
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

    display.appendChild(contentArea);
    // Append to document.body to ensure it's always on top
    document.body.appendChild(display);
    this.container = display;

    // Force immediate visibility test
    setTimeout(() => {
      const computed = window.getComputedStyle(display);
      console.log("🔍 Display element check:", {
        exists: !!display,
        inDOM: document.body.contains(display),
        computedDisplay: computed.display,
        computedVisibility: computed.visibility,
        computedOpacity: computed.opacity,
        computedZIndex: computed.zIndex,
        offsetWidth: display.offsetWidth,
        offsetHeight: display.offsetHeight,
        clientWidth: display.clientWidth,
        clientHeight: display.clientHeight,
      });
    }, 100);

    // Update timestamp every second
    if (!(window as any).engagementDisplayTimer) {
      (window as any).engagementDisplayTimer = setInterval(() => {
        const ts = document.getElementById("engagement-timestamp");
        if (ts) {
          ts.textContent = this.getCurrentTime();
        }
      }, 1000);
    }

    // Don't call update here - it will be called separately with data
    console.log("✅ Engagement display created successfully");
  }

  /**
   * Update the display with current engagement data
   */
  public update(
    engagements: EngagementData[] = [],
    nodesMap: Map<number, UDPDataPoint> = new Map()
  ): void {
    console.log("🔄 EngagementDisplay.update() called", {
      engagementsCount: engagements.length,
      nodesMapSize: nodesMap.size,
    });

    this.engagementData = engagements;
    this.nodesMap = nodesMap;

    const contentArea = document.getElementById("engagement-content-area");
    if (!contentArea) {
      console.warn(
        "⚠️ engagement-content-area not found, display may not be created yet"
      );
      // Try to create the display if it doesn't exist
      const display = document.getElementById("engagement-hud-display");
      if (!display) {
        console.warn("⚠️ Engagement display not found, cannot update");
        return;
      }
      // If display exists but content area doesn't, something went wrong
      console.error("❌ Display exists but content area missing");
      return;
    }

    console.log(
      "✅ Found content area, updating with",
      engagements.length,
      "engagements"
    );

    // Clear existing content
    contentArea.innerHTML = "";

    if (engagements.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        color: #00ff00;
        font-size: 24px;
        padding: 40px;
        opacity: 1;
        text-shadow: 0 0 10px #00ff00;
        margin-top: 100px;
      `;
      empty.textContent = "NO ACTIVE ENGAGEMENTS";
      contentArea.appendChild(empty);
      return;
    }

    // Create engagement cards
    engagements.forEach((eng, index) => {
      const card = this.createEngagementCard(eng, index);
      contentArea.appendChild(card);
    });
  }

  /**
   * Create an individual engagement card
   */
  private createEngagementCard(
    engagement: EngagementData,
    index: number
  ): HTMLElement {
    const attacker = this.nodesMap.get(engagement.globalId);
    const target = this.nodesMap.get(engagement.engagementTargetGid);

    const attackerCallsign = attacker?.callsign || `ID${engagement.globalId}`;
    const targetCallsign =
      target?.callsign || `ID${engagement.engagementTargetGid}`;

    const card = document.createElement("div");
    card.style.cssText = `
      background: rgba(0, 20, 0, 0.85);
      border: 2px solid #00ff00;
      border-radius: 4px;
      padding: 20px;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 15px;
    `;

    // Engagement ID and status
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #00ff00;
      padding-bottom: 10px;
    `;

    const engId = document.createElement("div");
    engId.textContent = `ENG #${index + 1} (OPCODE 103)`;
    engId.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      color: #00ff00;
    `;

    const status = document.createElement("div");
    const isLaunched = engagement.weaponLaunch === 1;
    const hasHangFire = engagement.hangFire === 1;
    status.textContent = isLaunched
      ? "WEAPON LAUNCHED"
      : hasHangFire
        ? "HANG FIRE"
        : "READY";
    status.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      color: ${isLaunched ? "#ff0000" : hasHangFire ? "#ffaa00" : "#00ff00"};
      text-shadow: 0 0 10px ${isLaunched ? "#ff0000" : hasHangFire ? "#ffaa00" : "#00ff00"};
      padding: 4px 12px;
      border: 1px solid ${isLaunched ? "#ff0000" : hasHangFire ? "#ffaa00" : "#00ff00"};
      border-radius: 2px;
    `;

    header.appendChild(engId);
    header.appendChild(status);
    card.appendChild(header);

    // Participants section
    const participants = document.createElement("div");
    participants.style.cssText = `
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 15px;
      align-items: center;
    `;

    const attackerDiv = document.createElement("div");
    attackerDiv.style.cssText = `
      text-align: center;
      padding: 10px;
      background: rgba(0, 255, 0, 0.1);
      border: 1px solid #00ff00;
      border-radius: 2px;
    `;
    attackerDiv.innerHTML = `
      <div style="font-size: 11px; color: #00ff00; opacity: 0.7; margin-bottom: 5px;">ATTACKER</div>
      <div style="font-size: 18px; font-weight: bold; color: #00ff00;">${attackerCallsign}</div>
      <div style="font-size: 10px; color: #00ff00; opacity: 0.6; margin-top: 5px;">ID: ${engagement.globalId}</div>
    `;

    const arrow = document.createElement("div");
    arrow.textContent = "→";
    arrow.style.cssText = `
      font-size: 24px;
      color: #ff0000;
      font-weight: bold;
      text-shadow: 0 0 10px #ff0000;
    `;

    const targetDiv = document.createElement("div");
    targetDiv.style.cssText = `
      text-align: center;
      padding: 10px;
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid #ff0000;
      border-radius: 2px;
    `;
    targetDiv.innerHTML = `
      <div style="font-size: 11px; color: #ff0000; opacity: 0.7; margin-bottom: 5px;">TARGET</div>
      <div style="font-size: 18px; font-weight: bold; color: #ff0000;">${targetCallsign}</div>
      <div style="font-size: 10px; color: #ff0000; opacity: 0.6; margin-top: 5px;">ID: ${engagement.engagementTargetGid}</div>
    `;

    participants.appendChild(attackerDiv);
    participants.appendChild(arrow);
    participants.appendChild(targetDiv);
    card.appendChild(participants);

    // Timing information
    const timing = document.createElement("div");
    timing.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 10px;
    `;

    const tthDiv = document.createElement("div");
    tthDiv.style.cssText = `
      padding: 10px;
      background: rgba(255, 255, 0, 0.1);
      border: 1px solid #ffff00;
      border-radius: 2px;
      text-align: center;
    `;
    tthDiv.innerHTML = `
      <div style="font-size: 11px; color: #ffff00; opacity: 0.7; margin-bottom: 5px;">TIME TO HIT</div>
      <div style="font-size: 24px; font-weight: bold; color: #ffff00;">${engagement.tth}</div>
      <div style="font-size: 10px; color: #ffff00; opacity: 0.6;">SECONDS</div>
    `;

    const ttaDiv = document.createElement("div");
    ttaDiv.style.cssText = `
      padding: 10px;
      background: rgba(255, 255, 0, 0.1);
      border: 1px solid #ffff00;
      border-radius: 2px;
      text-align: center;
    `;
    ttaDiv.innerHTML = `
      <div style="font-size: 11px; color: #ffff00; opacity: 0.7; margin-bottom: 5px;">TIME TO ARRIVAL</div>
      <div style="font-size: 24px; font-weight: bold; color: #ffff00;">${engagement.tta}</div>
      <div style="font-size: 10px; color: #ffff00; opacity: 0.6;">SECONDS</div>
    `;

    timing.appendChild(tthDiv);
    timing.appendChild(ttaDiv);
    card.appendChild(timing);

    // Range information
    const ranges = document.createElement("div");
    ranges.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
    `;

    const rangeLabels = [
      { label: "DMAX1", value: engagement.dMax1, unit: "NM" },
      { label: "DMAX2", value: engagement.dMax2, unit: "NM" },
      { label: "DMIN", value: engagement.dmin, unit: "NM" },
    ];

    rangeLabels.forEach((range) => {
      const rangeDiv = document.createElement("div");
      rangeDiv.style.cssText = `
        padding: 8px;
        background: rgba(0, 255, 255, 0.1);
        border: 1px solid #00ffff;
        border-radius: 2px;
        text-align: center;
      `;
      const value = isNaN(range.value) ? "N/A" : range.value.toFixed(2);
      rangeDiv.innerHTML = `
        <div style="font-size: 10px; color: #00ffff; opacity: 0.7; margin-bottom: 3px;">${range.label}</div>
        <div style="font-size: 16px; font-weight: bold; color: #00ffff;">${value}</div>
        <div style="font-size: 9px; color: #00ffff; opacity: 0.6;">${range.unit}</div>
      `;
      ranges.appendChild(rangeDiv);
    });

    card.appendChild(ranges);

    // Weapon code
    if (engagement.engagementTargetWeaponCode !== undefined) {
      const weaponDiv = document.createElement("div");
      weaponDiv.style.cssText = `
        margin-top: 10px;
        padding: 8px;
        background: rgba(255, 0, 255, 0.1);
        border: 1px solid #ff00ff;
        border-radius: 2px;
        text-align: center;
      `;
      weaponDiv.innerHTML = `
        <div style="font-size: 10px; color: #ff00ff; opacity: 0.7; margin-bottom: 3px;">WEAPON CODE</div>
        <div style="font-size: 14px; font-weight: bold; color: #ff00ff;">${engagement.engagementTargetWeaponCode}</div>
      `;
      card.appendChild(weaponDiv);
    }

    return card;
  }

  /**
   * Get current time in HH:MM:SS format
   */
  private getCurrentTime(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Remove the display
   */
  public destroy(): void {
    console.log("🗑️ EngagementDisplay.destroy() called");
    const existing = document.getElementById("engagement-hud-display");
    if (existing) {
      existing.remove();
      console.log("✅ Removed engagement display from DOM");
    }
    // Also check for content area and remove it
    const contentArea = document.getElementById("engagement-content-area");
    if (contentArea && contentArea.parentElement) {
      contentArea.parentElement.remove();
    }
    if (this.container) {
      this.container = null;
    }
    // Clear the data
    this.engagementData = [];
    this.nodesMap.clear();
  }
}
