import { EngagementData } from "./EngagementManager";
import { UDPDataPoint } from "./UDPNodesManager";

export class Screen104Display {
  private container: HTMLElement | null = null;

  /**
   * Create the 104 screen display - Aircraft HUD style
   */
  public create(): void {
    console.log("🎯🎯🎯 Screen104Display.create() CALLED - Starting creation!");

    // Remove existing display
    const existing = document.getElementById("screen-104-display");
    if (existing) {
      console.log("🗑️ Removing existing display");
      existing.remove();
    }

    // Create main container
    const display = document.createElement("div");
    display.id = "screen-104-display";

    // CRITICAL: Use inline styles with !important to ensure visibility
    display.setAttribute(
      "style",
      `
      position: fixed !important;
      top: 0px !important;
      left: 0px !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: rgba(0, 0, 0, 0.98) !important;
      z-index: 99999 !important;
      font-family: 'Courier New', 'Monaco', monospace !important;
      color: rgb(0, 255, 0) !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      overflow-y: auto !important;
      padding: 40px !important;
      box-sizing: border-box !important;
    `
    );

    // Header section
    const header = document.createElement("div");
    header.setAttribute(
      "style",
      `
      width: 100% !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      margin-bottom: 40px !important;
      padding-bottom: 20px !important;
      border-bottom: 4px solid rgb(0, 255, 0) !important;
    `
    );

    const title = document.createElement("div");
    title.textContent = "SCREEN 104 - ENGAGEMENT DATA (OPCODE 103)";
    title.setAttribute(
      "style",
      `
      font-size: 32px !important;
      font-weight: bold !important;
      color: rgb(0, 255, 0) !important;
      text-shadow: 0px 0px 20px rgb(0, 255, 0), 0px 0px 40px rgba(0, 255, 0, 0.5) !important;
      letter-spacing: 4px !important;
    `
    );

    const timestamp = document.createElement("div");
    timestamp.id = "screen-104-timestamp";
    timestamp.textContent = this.getCurrentTime();
    timestamp.setAttribute(
      "style",
      `
      font-size: 18px !important;
      color: rgb(0, 255, 0) !important;
      font-weight: bold !important;
    `
    );

    header.appendChild(title);
    header.appendChild(timestamp);
    display.appendChild(header);

    // Content area
    const contentArea = document.createElement("div");
    contentArea.id = "screen-104-content";
    contentArea.setAttribute(
      "style",
      `
      width: 100% !important;
      min-height: 400px !important;
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(550px, 1fr)) !important;
      gap: 30px !important;
    `
    );

    // Add immediate test content to verify visibility
    const testDiv = document.createElement("div");
    testDiv.setAttribute(
      "style",
      `
      grid-column: 1 / -1 !important;
      text-align: center !important;
      color: rgb(0, 255, 0) !important;
      font-size: 28px !important;
      padding: 50px !important;
      background-color: rgba(0, 255, 0, 0.15) !important;
      border: 4px solid rgb(0, 255, 0) !important;
      border-radius: 8px !important;
      text-shadow: 0px 0px 15px rgb(0, 255, 0) !important;
      font-weight: bold !important;
      margin-bottom: 30px !important;
    `
    );
    testDiv.textContent = "SCREEN 104 ACTIVE - AWAITING ENGAGEMENT DATA";
    contentArea.appendChild(testDiv);

    display.appendChild(contentArea);

    // Append to body - CRITICAL STEP
    console.log("🎯🎯🎯 Appending display to document.body...");
    console.log("🎯 document.body exists:", !!document.body);
    console.log("🎯 display element:", display);
    console.log("🎯 display.style:", display.getAttribute("style"));

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
          display.style.setProperty("display", "block", "important");
          display.style.setProperty("width", "100vw", "important");
          display.style.setProperty("height", "100vh", "important");
          display.style.setProperty("position", "fixed", "important");
          display.style.setProperty("top", "0", "important");
          display.style.setProperty("left", "0", "important");
          display.style.setProperty("z-index", "999999", "important");
          display.style.setProperty(
            "background-color",
            "rgba(0, 0, 0, 0.98)",
            "important"
          );
        }
      }, 50);

      // Additional check - log all child elements to verify content exists
      setTimeout(() => {
        console.log("🔍 Display children count:", display.children.length);
        console.log(
          "🔍 Content area exists:",
          !!document.getElementById("screen-104-content")
        );
        const contentArea = document.getElementById("screen-104-content");
        if (contentArea) {
          console.log("🔍 Content area children:", contentArea.children.length);
          console.log(
            "🔍 Content area innerHTML length:",
            contentArea.innerHTML.length
          );
        }
      }, 100);
    } catch (error) {
      console.error("❌❌❌ CRITICAL ERROR appending to body:", error);
    }

    // Update timestamp every second
    if (!(window as any).screen104Timer) {
      (window as any).screen104Timer = setInterval(() => {
        const ts = document.getElementById("screen-104-timestamp");
        if (ts) {
          ts.textContent = this.getCurrentTime();
        }
      }, 1000);
    }

    console.log("✅✅✅ Screen104Display.create() COMPLETED!");
  }

  /**
   * Update with engagement data
   */
  public update(
    engagements: EngagementData[],
    nodesMap: Map<number, UDPDataPoint>
  ): void {
    console.log("🔄 Screen104Display.update() called", {
      engagementsCount: engagements.length,
      nodesMapSize: nodesMap.size,
    });

    const contentArea = document.getElementById("screen-104-content");
    if (!contentArea) {
      console.error("❌ screen-104-content not found! Recreating display...");
      this.create();
      const retryArea = document.getElementById("screen-104-content");
      if (!retryArea) {
        console.error("❌ Failed to create content area!");
        return;
      }
      // Continue with retryArea
      this.updateContent(retryArea, engagements, nodesMap);
      return;
    }

    this.updateContent(contentArea, engagements, nodesMap);
  }

  private updateContent(
    contentArea: HTMLElement,
    engagements: EngagementData[],
    nodesMap: Map<number, UDPDataPoint>
  ): void {
    // Clear existing content
    contentArea.innerHTML = "";

    if (engagements.length === 0) {
      const empty = document.createElement("div");
      empty.setAttribute(
        "style",
        `
        grid-column: 1 / -1 !important;
        text-align: center !important;
        color: rgb(0, 255, 0) !important;
        font-size: 40px !important;
        padding: 100px !important;
        text-shadow: 0px 0px 25px rgb(0, 255, 0) !important;
        font-weight: bold !important;
        background-color: rgba(0, 255, 0, 0.1) !important;
        border: 4px solid rgb(0, 255, 0) !important;
        border-radius: 10px !important;
      `
      );
      empty.textContent = "NO ACTIVE ENGAGEMENTS (OPCODE 103)";
      contentArea.appendChild(empty);
      console.log("✅ Displayed 'NO ACTIVE ENGAGEMENTS'");
      return;
    }

    // Create engagement cards
    engagements.forEach((eng, index) => {
      const card = this.createEngagementCard(eng, index, nodesMap);
      contentArea.appendChild(card);
    });

    console.log(`✅ Updated with ${engagements.length} engagement cards`);
  }

  /**
   * Create engagement card - Aircraft HUD style
   */
  private createEngagementCard(
    engagement: EngagementData,
    index: number,
    nodesMap: Map<number, UDPDataPoint>
  ): HTMLElement {
    const attacker = nodesMap.get(engagement.globalId);
    const target = nodesMap.get(engagement.engagementTargetGid);

    const attackerCallsign = attacker?.callsign || `ID${engagement.globalId}`;
    const targetCallsign =
      target?.callsign || `ID${engagement.engagementTargetGid}`;

    const card = document.createElement("div");
    card.setAttribute(
      "style",
      `
      background-color: rgba(0, 30, 0, 0.95) !important;
      border: 3px solid rgb(0, 255, 0) !important;
      border-radius: 8px !important;
      padding: 30px !important;
      box-shadow: 0px 0px 40px rgba(0, 255, 0, 0.6) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 25px !important;
    `
    );

    // Header
    const header = document.createElement("div");
    header.setAttribute(
      "style",
      `
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      border-bottom: 2px solid rgb(0, 255, 0) !important;
      padding-bottom: 15px !important;
    `
    );

    const engId = document.createElement("div");
    engId.textContent = `ENGAGEMENT #${index + 1}`;
    engId.setAttribute(
      "style",
      `
      font-size: 22px !important;
      font-weight: bold !important;
      color: rgb(0, 255, 0) !important;
      text-shadow: 0px 0px 10px rgb(0, 255, 0) !important;
    `
    );

    const status = document.createElement("div");
    const isLaunched = engagement.weaponLaunch === 1;
    const hasHangFire = engagement.hangFire === 1;
    const statusText = isLaunched
      ? "WEAPON LAUNCHED"
      : hasHangFire
        ? "HANG FIRE"
        : "READY";
    const statusColor = isLaunched
      ? "rgb(255, 0, 0)"
      : hasHangFire
        ? "rgb(255, 170, 0)"
        : "rgb(0, 255, 0)";

    status.textContent = statusText;
    status.setAttribute(
      "style",
      `
      font-size: 18px !important;
      font-weight: bold !important;
      color: ${statusColor} !important;
      text-shadow: 0px 0px 15px ${statusColor} !important;
      padding: 8px 20px !important;
      border: 2px solid ${statusColor} !important;
      border-radius: 4px !important;
      background-color: rgba(${isLaunched ? "255, 0, 0" : hasHangFire ? "255, 170, 0" : "0, 255, 0"}, 0.2) !important;
    `
    );

    header.appendChild(engId);
    header.appendChild(status);
    card.appendChild(header);

    // Participants
    const participants = document.createElement("div");
    participants.setAttribute(
      "style",
      `
      display: grid !important;
      grid-template-columns: 1fr auto 1fr !important;
      gap: 25px !important;
      align-items: center !important;
      padding: 20px !important;
      background-color: rgba(0, 0, 0, 0.4) !important;
      border-radius: 6px !important;
    `
    );

    const attackerDiv = document.createElement("div");
    attackerDiv.setAttribute(
      "style",
      `
      text-align: center !important;
      padding: 20px !important;
      background-color: rgba(0, 255, 0, 0.2) !important;
      border: 2px solid rgb(0, 255, 0) !important;
      border-radius: 6px !important;
    `
    );
    attackerDiv.innerHTML = `
      <div style="font-size: 13px; color: rgb(0, 255, 0); opacity: 0.9; margin-bottom: 10px; font-weight: bold;">ATTACKER</div>
      <div style="font-size: 26px; font-weight: bold; color: rgb(0, 255, 0); text-shadow: 0px 0px 10px rgb(0, 255, 0);">${attackerCallsign}</div>
      <div style="font-size: 12px; color: rgb(0, 255, 0); opacity: 0.7; margin-top: 8px;">ID: ${engagement.globalId}</div>
    `;

    const arrow = document.createElement("div");
    arrow.textContent = "→";
    arrow.setAttribute(
      "style",
      `
      font-size: 40px !important;
      color: rgb(255, 0, 0) !important;
      font-weight: bold !important;
      text-shadow: 0px 0px 20px rgb(255, 0, 0) !important;
    `
    );

    const targetDiv = document.createElement("div");
    targetDiv.setAttribute(
      "style",
      `
      text-align: center !important;
      padding: 20px !important;
      background-color: rgba(255, 0, 0, 0.2) !important;
      border: 2px solid rgb(255, 0, 0) !important;
      border-radius: 6px !important;
    `
    );
    targetDiv.innerHTML = `
      <div style="font-size: 13px; color: rgb(255, 0, 0); opacity: 0.9; margin-bottom: 10px; font-weight: bold;">TARGET</div>
      <div style="font-size: 26px; font-weight: bold; color: rgb(255, 0, 0); text-shadow: 0px 0px 10px rgb(255, 0, 0);">${targetCallsign}</div>
      <div style="font-size: 12px; color: rgb(255, 0, 0); opacity: 0.7; margin-top: 8px;">ID: ${engagement.engagementTargetGid}</div>
    `;

    participants.appendChild(attackerDiv);
    participants.appendChild(arrow);
    participants.appendChild(targetDiv);
    card.appendChild(participants);

    // Timing
    const timing = document.createElement("div");
    timing.setAttribute(
      "style",
      `
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 25px !important;
    `
    );

    const tthDiv = document.createElement("div");
    tthDiv.setAttribute(
      "style",
      `
      padding: 20px !important;
      background-color: rgba(255, 255, 0, 0.2) !important;
      border: 2px solid rgb(255, 255, 0) !important;
      border-radius: 6px !important;
      text-align: center !important;
    `
    );
    tthDiv.innerHTML = `
      <div style="font-size: 13px; color: rgb(255, 255, 0); opacity: 0.9; margin-bottom: 10px; font-weight: bold;">TIME TO HIT</div>
      <div style="font-size: 42px; font-weight: bold; color: rgb(255, 255, 0); text-shadow: 0px 0px 15px rgb(255, 255, 0);">${engagement.tth}</div>
      <div style="font-size: 12px; color: rgb(255, 255, 0); opacity: 0.8;">SECONDS</div>
    `;

    const ttaDiv = document.createElement("div");
    ttaDiv.setAttribute(
      "style",
      `
      padding: 20px !important;
      background-color: rgba(255, 255, 0, 0.2) !important;
      border: 2px solid rgb(255, 255, 0) !important;
      border-radius: 6px !important;
      text-align: center !important;
    `
    );
    ttaDiv.innerHTML = `
      <div style="font-size: 13px; color: rgb(255, 255, 0); opacity: 0.9; margin-bottom: 10px; font-weight: bold;">TIME TO ARRIVAL</div>
      <div style="font-size: 42px; font-weight: bold; color: rgb(255, 255, 0); text-shadow: 0px 0px 15px rgb(255, 255, 0);">${engagement.tta}</div>
      <div style="font-size: 12px; color: rgb(255, 255, 0); opacity: 0.8;">SECONDS</div>
    `;

    timing.appendChild(tthDiv);
    timing.appendChild(ttaDiv);
    card.appendChild(timing);

    // Ranges
    const ranges = document.createElement("div");
    ranges.setAttribute(
      "style",
      `
      display: grid !important;
      grid-template-columns: repeat(3, 1fr) !important;
      gap: 20px !important;
    `
    );

    [
      { label: "DMAX1", value: engagement.dMax1, unit: "NM" },
      { label: "DMAX2", value: engagement.dMax2, unit: "NM" },
      { label: "DMIN", value: engagement.dmin, unit: "NM" },
    ].forEach((range) => {
      const rangeDiv = document.createElement("div");
      rangeDiv.setAttribute(
        "style",
        `
        padding: 15px !important;
        background-color: rgba(0, 255, 255, 0.2) !important;
        border: 2px solid rgb(0, 255, 255) !important;
        border-radius: 6px !important;
        text-align: center !important;
      `
      );
      const value = isNaN(range.value) ? "N/A" : range.value.toFixed(2);
      rangeDiv.innerHTML = `
        <div style="font-size: 12px; color: rgb(0, 255, 255); opacity: 0.9; margin-bottom: 8px; font-weight: bold;">${range.label}</div>
        <div style="font-size: 24px; font-weight: bold; color: rgb(0, 255, 255); text-shadow: 0px 0px 10px rgb(0, 255, 255);">${value}</div>
        <div style="font-size: 11px; color: rgb(0, 255, 255); opacity: 0.8;">${range.unit}</div>
      `;
      ranges.appendChild(rangeDiv);
    });

    card.appendChild(ranges);

    // Weapon code
    if (engagement.engagementTargetWeaponCode !== undefined) {
      const weaponDiv = document.createElement("div");
      weaponDiv.setAttribute(
        "style",
        `
        padding: 15px !important;
        background-color: rgba(255, 0, 255, 0.2) !important;
        border: 2px solid rgb(255, 0, 255) !important;
        border-radius: 6px !important;
        text-align: center !important;
      `
      );
      weaponDiv.innerHTML = `
        <div style="font-size: 12px; color: rgb(255, 0, 255); opacity: 0.9; margin-bottom: 8px; font-weight: bold;">WEAPON CODE</div>
        <div style="font-size: 22px; font-weight: bold; color: rgb(255, 0, 255); text-shadow: 0px 0px 10px rgb(255, 0, 255);">${engagement.engagementTargetWeaponCode}</div>
      `;
      card.appendChild(weaponDiv);
    }

    // Opcode indicator
    const opcodeInfo = document.createElement("div");
    opcodeInfo.setAttribute(
      "style",
      `
      padding: 12px !important;
      background-color: rgba(0, 0, 0, 0.6) !important;
      border: 1px solid rgb(0, 255, 0) !important;
      border-radius: 4px !important;
      text-align: center !important;
      font-size: 12px !important;
      color: rgb(0, 255, 0) !important;
      opacity: 0.8 !important;
    `
    );
    opcodeInfo.textContent = `OPCODE 103 DATA`;
    card.appendChild(opcodeInfo);

    return card;
  }

  private getCurrentTime(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  public destroy(): void {
    console.log("🗑️ Screen104Display.destroy() called");
    const existing = document.getElementById("screen-104-display");
    if (existing) {
      console.log("🗑️ Removing display element from DOM");
      existing.remove();
      console.log("✅ Removed Screen104Display from DOM");
    } else {
      console.log("🗑️ No display element found to remove");
    }
    this.container = null;
  }
}
