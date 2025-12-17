import { UDPNodesManager } from "./UDPNodesManager";

export class HUDDisplay {
  private hudContainer: HTMLElement | null = null;
  private udpNodesManager: UDPNodesManager | null = null;
  private updateInterval: number | null = null;

  constructor(udpNodesManager?: UDPNodesManager) {
    this.udpNodesManager = udpNodesManager || null;
  }

  public create(container: HTMLElement): HTMLElement {
    // Remove existing HUD if any
    const existing = document.getElementById("hud-display");
    if (existing) {
      existing.remove();
    }

    // Clear any existing update interval
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    const hud = document.createElement("div");
    hud.id = "hud-display";
    hud.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      font-family: 'Courier New', monospace;
      color: #00ff00;
      overflow: hidden;
      background: transparent;
    `;

    // Get flight data from UDP nodes
    const flightData = this.getFlightData();

    // Top section
    this.createTopSection(hud, flightData);

    // Left airspeed tape
    this.createAirspeedTape(hud, flightData);

    // Right altitude tape
    this.createAltitudeTape(hud, flightData);

    // Central display with pitch ladder, horizon, and flight path marker
    this.createCentralDisplay(hud, flightData);

    // Vertical speed indicator (upper right)
    this.createVerticalSpeedIndicator(hud, flightData);

    // Bottom left data block
    this.createBottomLeftData(hud, flightData);

    // Bottom center compass rose (semi-circular)
    this.createCompassRose(hud, flightData);

    // Bottom right data block
    this.createBottomRightData(hud, flightData);

    container.appendChild(hud);
    this.hudContainer = hud;

    // Update HUD data periodically
    this.startUpdateLoop();

    return hud;
  }

  private getFlightData(): {
    airspeed: number;
    groundSpeed: number;
    altitude: number;
    radioAltitude: number;
    heading: number;
    course: number;
    verticalSpeed: number;
    dme: number;
    pitch: number;
    roll: number;
    bearing: number;
    latitude?: number;
    longitude?: number;
    metadata: {
      baroAltitude?: number;
      groundSpeed?: number;
      mach?: number;
    };
  } {
    // Default values
    let airspeed = 148;
    let groundSpeed = 150;
    let altitude = 600;
    let radioAltitude = 580;
    let heading = 274;
    let course = 283;
    let verticalSpeed = -700;
    let dme = 3.7;
    let pitch = 2.8; // degrees
    let roll = 0; // degrees
    let bearing = 0; // Bearing from north to node position
    let latitude: number | undefined;
    let longitude: number | undefined;
    let metadata: { baroAltitude?: number; groundSpeed?: number; mach?: number } = {};

    // Get node with global ID 10 specifically
    if (this.udpNodesManager) {
      const allNodes = this.udpNodesManager.getAllNodes();
      const nodeWithGlobalId10 = allNodes.find((node) => node.globalId === 10);

      if (nodeWithGlobalId10) {
        // Get lat/lng for bearing calculation
        latitude = nodeWithGlobalId10.latitude;
        longitude = nodeWithGlobalId10.longitude;
        
        // Calculate bearing from north to node position (similar to 102 screen)
        if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
          bearing = this.calculateBearingFromNorth(latitude, longitude);
          // Normalize bearing to 0-360 range
          bearing = bearing % 360;
          if (bearing < 0) bearing += 360;
        }
        // Get altitude from the node (could be from opcode 101, 102, or 104)
        if (nodeWithGlobalId10.opcode === 101) {
          // Opcode 101 has altitude field directly
          altitude = nodeWithGlobalId10.altitude || altitude;
          const node101 = nodeWithGlobalId10 as any;
          heading = (node101.trueHeading || heading) % 360;
          course = heading + 9;
        } else if (nodeWithGlobalId10.opcode === 102) {
          // Opcode 102 has altitude in regionalData.metadata.baroAltitude
          const node102 = nodeWithGlobalId10 as any;
          if (node102.regionalData?.metadata) {
            // Extract metadata
            metadata = {
              baroAltitude: node102.regionalData.metadata.baroAltitude,
              groundSpeed: node102.regionalData.metadata.groundSpeed,
              mach: node102.regionalData.metadata.mach,
            };
            
            if (node102.regionalData.metadata.baroAltitude !== undefined) {
              altitude = node102.regionalData.metadata.baroAltitude;
            } else {
              altitude = nodeWithGlobalId10.altitude || altitude;
            }
            if (node102.regionalData.metadata.groundSpeed !== undefined) {
              groundSpeed = node102.regionalData.metadata.groundSpeed;
            }
          } else {
            altitude = nodeWithGlobalId10.altitude || altitude;
          }
          // Try to get heading from opcode 101 for same global ID
          const opcode101Node = allNodes.find((n) => n.opcode === 101 && n.globalId === 10);
          if (opcode101Node) {
            const node101 = opcode101Node as any;
            heading = (node101.trueHeading || heading) % 360;
            course = heading + 9;
          }
        } else if (nodeWithGlobalId10.opcode === 104) {
          // Opcode 104 has altitude field directly
          altitude = nodeWithGlobalId10.altitude || altitude;
          const node104 = nodeWithGlobalId10 as any;
          if (node104.heading !== undefined) {
            heading = (node104.heading || heading) % 360;
          }
          if (node104.groundSpeed !== undefined) {
            groundSpeed = node104.groundSpeed;
          }
          course = heading + 9;
        } else {
          // Fallback: use altitude field if available
          altitude = nodeWithGlobalId10.altitude || altitude;
        }

        // Calculate radio altitude (approximate AGL)
        radioAltitude = Math.max(0, altitude - 20);
      }
    }

    return {
      airspeed,
      groundSpeed,
      altitude,
      radioAltitude,
      heading,
      course,
      verticalSpeed,
      dme,
      pitch,
      roll,
      bearing,
      latitude,
      longitude,
      metadata,
    };
  }

  /**
   * Calculate bearing from north (or map center) to a given lat/lng point
   * Returns bearing in degrees (0-360, where 0 is north)
   */
  private calculateBearingFromNorth(
    latitude: number,
    longitude: number
  ): number {
    // Get map center as reference point if available
    const mapManager = (this.udpNodesManager as any)?.mapManager;
    const mapCenter = mapManager?.getCenter();
    
    if (mapCenter) {
      return this.calculateBearing(
        mapCenter.lat,
        mapCenter.lng,
        latitude,
        longitude
      );
    }

    // Fallback: calculate bearing from equator/prime meridian (0, 0)
    return this.calculateBearing(0, 0, latitude, longitude);
  }

  /**
   * Calculate bearing between two lat/lng points
   * Returns bearing in degrees (0-360, where 0 is north)
   */
  private calculateBearing(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360

    return bearing;
  }

  private createTopSection(container: HTMLElement, data: any): void {
    const topSection = document.createElement("div");
    topSection.style.cssText = `
      position: absolute;
      top: 15px;
      left: 0;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 120px;
      font-size: 11px;
      font-weight: bold;
      text-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;

    topSection.innerHTML = `
      <div style="display: flex; gap: 30px;">
        <span>MCP SPD</span>
        <span>VOR/LOC 5</span>
        <span>G/S</span>
        <span>FD</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid #00ff00;"></div>
        <span>H ${Math.round(data.heading)}</span>
      </div>
    `;

    container.appendChild(topSection);
  }

  private createAirspeedTape(container: HTMLElement, data: any): void {
    const tape = document.createElement("div");
    tape.style.cssText = `
      position: absolute;
      left: 15px;
      top: 50%;
      transform: translateY(-50%);
      width: 70px;
      height: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 13px;
      font-weight: bold;
    `;

    // Get ground speed from metadata, fallback to data.groundSpeed
    const metadata = data.metadata || {};
    const currentSpeed = metadata.groundSpeed !== undefined 
      ? Math.round(metadata.groundSpeed) 
      : Math.round(data.groundSpeed || 150);
    
    // Generate speed values dynamically around current ground speed
    // Show values in 10-knot increments, centered on current speed
    const speedStep = 10;
    const numValues = 12; // Show 12 values total (6 above, 6 below)
    const centerValue = Math.round(currentSpeed / speedStep) * speedStep;
    
    // Generate speed array dynamically
    const speeds: number[] = [];
    for (let i = -numValues / 2; i <= numValues / 2; i++) {
      speeds.push(centerValue + (i * speedStep));
    }

    let tapeContent = `
      <div style="position: relative; width: 100%; height: 100%;">
    `;

    speeds.forEach((speed) => {
      // Calculate position based on difference from current speed
      const diff = speed - currentSpeed;
      const yPos = 50 + (diff / speedStep) * 6; // 6% per 10 knots
      const isCurrent = Math.abs(speed - currentSpeed) < 5;
      
      // Only show if within visible range (limit bottom to avoid collision with data block)
      if (yPos >= -10 && yPos <= 85) {
        tapeContent += `
          <div style="position: absolute; top: ${yPos}%; left: 0; width: 100%; display: flex; align-items: center; ${isCurrent ? 'background: rgba(0, 255, 0, 0.25); border: 2px solid #00ff00; padding: 2px 0;' : ''}">
            <div style="width: ${isCurrent ? '30px' : '20px'}; height: ${isCurrent ? '2px' : '1px'}; background: #00ff00; margin-right: 5px; box-shadow: ${isCurrent ? '0 0 3px rgba(0, 255, 0, 0.8)' : 'none'};"></div>
            <span style="${isCurrent ? 'font-size: 17px; font-weight: bold; text-shadow: 0 0 5px rgba(0, 255, 0, 1);' : 'font-size: 13px;'}">${speed >= 0 ? speed : 0}</span>
            ${isCurrent ? '<span style="margin-left: 5px; font-size: 10px;">UP</span>' : ''}
          </div>
        `;
      }
    });
    
    // Add prominent current ground speed display in center
    tapeContent += `
      <div style="position: absolute; top: 50%; left: 0; transform: translateY(-50%); width: 100%; text-align: left; font-size: 18px; font-weight: bold; color: #00ff00; text-shadow: 0 0 8px rgba(0, 255, 0, 1); background: rgba(0, 0, 0, 0.5); padding: 4px 8px; border: 2px solid #00ff00; box-shadow: 0 0 10px rgba(0, 255, 0, 0.6); z-index: 10;">
        ${currentSpeed >= 0 ? currentSpeed.toString() : "0"}
      </div>
    </div>`;

    tape.innerHTML = tapeContent;
    container.appendChild(tape);
  }

  private createAltitudeTape(container: HTMLElement, data: any): void {
    const tape = document.createElement("div");
    tape.style.cssText = `
      position: absolute;
      right: 15px;
      top: 50%;
      transform: translateY(-50%);
      width: 70px;
      height: 500px;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-size: 13px;
      font-weight: bold;
      overflow: hidden;
    `;

    const currentAlt = Math.round(data.altitude);
    
    // Generate altitude values dynamically around current altitude
    // Show values in 100-foot increments, centered on current altitude
    const altitudeStep = 100;
    const numValues = 10; // Show 10 values total (5 above, 5 below)
    const centerValue = Math.round(currentAlt / altitudeStep) * altitudeStep;
    
    // Generate altitude array dynamically
    const altitudes: number[] = [];
    for (let i = -numValues / 2; i <= numValues / 2; i++) {
      altitudes.push(centerValue + (i * altitudeStep));
    }

    let tapeContent = `
      <div style="position: relative; width: 100%; height: 100%;">
    `;

    altitudes.forEach((alt, index) => {
      // Calculate position based on difference from current altitude
      const diff = alt - currentAlt;
      const yPos = 50 + (diff / altitudeStep) * 8; // 8% per 100 feet
      const isCurrent = Math.abs(alt - currentAlt) < 50;
      
      // Only show if within visible range
      if (yPos >= -10 && yPos <= 110) {
        // Format altitude display (show thousands for values >= 1000)
        const displayAlt = alt >= 0 ? alt : 0;
        const displayText = displayAlt >= 1000 ? `${(displayAlt / 1000).toFixed(1)}` : displayAlt.toString();
        
        tapeContent += `
          <div style="position: absolute; top: ${yPos}%; right: 0; width: 100%; display: flex; align-items: center; justify-content: flex-end; ${isCurrent ? 'background: rgba(0, 255, 0, 0.25); border: 2px solid #00ff00; padding: 2px 0;' : ''}">
            <span style="${isCurrent ? 'font-size: 17px; font-weight: bold; text-shadow: 0 0 5px rgba(0, 255, 0, 1);' : 'font-size: 13px;'}">${displayText}</span>
            <div style="width: ${isCurrent ? '30px' : '20px'}; height: ${isCurrent ? '2px' : '1px'}; background: #00ff00; margin-left: 5px; box-shadow: ${isCurrent ? '0 0 3px rgba(0, 255, 0, 0.8)' : 'none'};"></div>
          </div>
        `;
      }
    });
    
    // Add prominent current altitude display in center
    tapeContent += `
      <div style="position: absolute; top: 50%; right: 0; transform: translateY(-50%); width: 100%; text-align: right; font-size: 18px; font-weight: bold; color: #00ff00; text-shadow: 0 0 8px rgba(0, 255, 0, 1); background: rgba(0, 0, 0, 0.5); padding: 4px 8px; border: 2px solid #00ff00; box-shadow: 0 0 10px rgba(0, 255, 0, 0.6); z-index: 10;">
        ${currentAlt >= 0 ? currentAlt.toString() : "0"}
      </div>
    `;

    // Decision height box (only show if near decision altitude)
    const decisionAlt = 600;
    if (Math.abs(currentAlt - decisionAlt) < 200) {
      const decisionYPos = 50 + ((decisionAlt - currentAlt) / altitudeStep) * 8;
      if (decisionYPos >= 0 && decisionYPos <= 100) {
        tapeContent += `
          <div style="position: absolute; top: ${decisionYPos}%; right: 0; width: 60px; height: 30px; border: 2px solid #00ff00; background: rgba(0, 255, 0, 0.15); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px;">
            <div>${decisionAlt}</div>
            <div>80</div>
          </div>
        `;
      }
    }

    tapeContent += `</div>`;

    tape.innerHTML = tapeContent;
    container.appendChild(tape);
  }

  private createCentralDisplay(container: HTMLElement, data: any): void {
    const central = document.createElement("div");
    central.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;

    // Horizon line
    const horizonY = 50 + (data.pitch * 5); // 5 pixels per degree of pitch
    const horizon = document.createElement("div");
    horizon.style.cssText = `
      position: absolute;
      top: ${horizonY}%;
      left: 0;
      width: 100%;
      height: 2px;
      background: #00ff00;
      box-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;
    central.appendChild(horizon);

    // Pitch ladder
    const pitchAngles = [-10, -5, 0, 5, 10, 15, 20, 25, 28, 29, 30];
    pitchAngles.forEach((angle) => {
      const yPos = 50 + ((data.pitch - angle) * 5);
      if (yPos >= 0 && yPos <= 100) {
        const line = document.createElement("div");
        const isMajor = angle % 10 === 0 || angle === 28 || angle === 29;
        line.style.cssText = `
          position: absolute;
          top: ${yPos}%;
          left: 50%;
          transform: translateX(-50%);
          width: ${isMajor ? '120px' : '60px'};
          height: 1px;
          background: #00ff00;
        `;
        
        if (isMajor) {
          const label = document.createElement("div");
          label.style.cssText = `
            position: absolute;
            top: 50%;
            ${angle >= 0 ? 'right' : 'left'}: -25px;
            transform: translateY(-50%);
            font-size: 11px;
            font-weight: bold;
          `;
          label.textContent = Math.abs(angle).toString();
          line.appendChild(label);
        }
        
        central.appendChild(line);
      }
    });

    // Roll indicator (inverted V at top)
    const rollIndicator = document.createElement("div");
    rollIndicator.style.cssText = `
      position: absolute;
      top: 15%;
      left: 50%;
      transform: translateX(-50%) rotate(${data.roll}deg);
      width: 0;
      height: 0;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-bottom: 20px solid #00ff00;
    `;
    central.appendChild(rollIndicator);

    // Flight path marker (circle with horizontal lines)
    const fpm = document.createElement("div");
    fpm.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50px;
      height: 50px;
    `;
    fpm.innerHTML = `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; border: 2px solid #00ff00; border-radius: 50%; box-shadow: 0 0 5px rgba(0, 255, 0, 0.8);"></div>
      <div style="position: absolute; top: 50%; left: 0; width: 100%; height: 2px; background: #00ff00; transform: translateY(-50%);"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 2px; height: 30px; background: #00ff00;"></div>
    `;
    central.appendChild(fpm);

    // Radio altimeter below flight path marker
    const radioAlt = document.createElement("div");
    radioAlt.style.cssText = `
      position: absolute;
      top: 55%;
      left: 50%;
      transform: translateX(-50%);
      font-size: 13px;
      font-weight: bold;
      text-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;
    radioAlt.textContent = Math.round(data.radioAltitude).toString();
    central.appendChild(radioAlt);

    container.appendChild(central);
  }

  private createVerticalSpeedIndicator(container: HTMLElement, data: any): void {
    const vsIndicator = document.createElement("div");
    vsIndicator.style.cssText = `
      position: absolute;
      top: 20%;
      right: 100px;
      width: 80px;
      height: 80px;
    `;

    // Semi-circular arc
    const arc = document.createElement("div");
    arc.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 80px;
      height: 40px;
      border: 2px solid #00ff00;
      border-bottom: none;
      border-radius: 80px 80px 0 0;
      box-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;
    vsIndicator.appendChild(arc);

    // Vertical speed value
    const vsValue = document.createElement("div");
    vsValue.style.cssText = `
      position: absolute;
      top: 45px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    `;
    vsValue.textContent = "5.0";
    vsIndicator.appendChild(vsValue);

    container.appendChild(vsIndicator);
  }

  private createBottomLeftData(container: HTMLElement, data: any): void {
    const dataBlock = document.createElement("div");
    dataBlock.style.cssText = `
      position: absolute;
      bottom: 100px;
      left: 20px;
      font-size: 11px;
      line-height: 1.5;
      font-weight: bold;
      text-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;

    // Show metadata from node with global ID 10
    const metadata = data.metadata || {};
    const gsValue = metadata.groundSpeed !== undefined ? Math.round(metadata.groundSpeed) : Math.round(data.groundSpeed);
    const baroAltValue = metadata.baroAltitude !== undefined ? Math.round(metadata.baroAltitude) : null;
    const machValue = metadata.mach !== undefined ? metadata.mach.toFixed(3) : null;

    let content = `
      <div>GS ${gsValue}</div>
      <div>DME ${data.dme.toFixed(1)}</div>
      <div>HDG ${Math.round(data.heading)}</div>
      <div>CRS ${Math.round(data.course)}</div>
      <div>ILS1</div>
    `;

    // Add metadata values if available
    if (baroAltValue !== null) {
      content += `<div>BARO ${baroAltValue}</div>`;
    }
    if (machValue !== null) {
      content += `<div>MACH ${machValue}</div>`;
    }

    dataBlock.innerHTML = content;

    container.appendChild(dataBlock);
  }

  private createCompassRose(container: HTMLElement, data: any): void {
    const compass = document.createElement("div");
    const radius = 120;
    const size = radius * 2 + 40; // padding for labels
    
    compass.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      width: ${size}px;
      height: ${size}px;
      pointer-events: none;
      z-index: 1001;
      transform-origin: center center;
    `;

    // Use bearing from lat/lng if available, otherwise use heading
    const bearing = data.bearing !== undefined ? data.bearing : (data.heading || 0);
    const rotation = -bearing; // Rotate compass card opposite to bearing

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", `${size}`);
    svg.setAttribute("height", `${size}`);
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
    `;

    const centerX = size / 2;
    const centerY = size / 2;

    // Outer compass circle
    const outerCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    outerCircle.setAttribute("cx", `${centerX}`);
    outerCircle.setAttribute("cy", `${centerY}`);
    outerCircle.setAttribute("r", `${radius}`);
    outerCircle.setAttribute("stroke", "#00ff00");
    outerCircle.setAttribute("stroke-width", "2");
    outerCircle.setAttribute("fill", "none");
    outerCircle.setAttribute("opacity", "0.95");
    outerCircle.style.filter =
      "drop-shadow(0 0 5px #00ff00) drop-shadow(0 0 10px rgba(0,255,0,0.5))";
    svg.appendChild(outerCircle);

    // Create rotating group for compass card with smooth transition
    const compassCard = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    compassCard.setAttribute("transform", `rotate(${rotation} ${centerX} ${centerY})`);
    compassCard.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";

    // Tick marks every 10°, longer every 30° with heading labels
    for (let deg = 0; deg < 360; deg += 10) {
      const angleRad = ((deg - 90) * Math.PI) / 180; // 0° at top
      const isMajor = deg % 30 === 0;
      const tickOuter = radius;
      const tickInner = radius - (isMajor ? 12 : 6);

      const x1 = centerX + Math.cos(angleRad) * tickOuter;
      const y1 = centerY + Math.sin(angleRad) * tickOuter;
      const x2 = centerX + Math.cos(angleRad) * tickInner;
      const y2 = centerY + Math.sin(angleRad) * tickInner;

      const tick = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      tick.setAttribute("x1", `${x1}`);
      tick.setAttribute("y1", `${y1}`);
      tick.setAttribute("x2", `${x2}`);
      tick.setAttribute("y2", `${y2}`);
      tick.setAttribute("stroke", "#00ff00");
      tick.setAttribute("stroke-width", isMajor ? "2" : "1.5");
      tick.setAttribute("opacity", isMajor ? "1" : "0.85");
      tick.style.filter = isMajor
        ? "drop-shadow(0 0 4px #00ff00)"
        : "drop-shadow(0 0 2px #00ff00)";
      compassCard.appendChild(tick);

      if (isMajor) {
        // Heading label at 30 degree intervals (000, 030, 060, 090, etc.)
        const headingLabel = deg.toString().padStart(3, "0");
        const labelRadius = radius + 15;
        const lx = centerX + Math.cos(angleRad) * labelRadius;
        const ly = centerY + Math.sin(angleRad) * labelRadius;

        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        text.setAttribute("x", `${lx}`);
        text.setAttribute("y", `${ly}`);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("fill", "#00ff00");
        text.setAttribute("font-family", "monospace");
        text.setAttribute("font-size", "12");
        text.setAttribute("font-weight", "bold");
        text.textContent = headingLabel;
        text.style.filter =
          "drop-shadow(0 0 5px #00ff00) drop-shadow(0 0 8px rgba(0,255,0,0.6))";
        compassCard.appendChild(text);
      }
    }

    svg.appendChild(compassCard);

    // Lubber line (fixed top reference) - shows current heading
    const lubber = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    lubber.setAttribute("x1", `${centerX}`);
    lubber.setAttribute("y1", `${centerY - radius}`);
    lubber.setAttribute("x2", `${centerX}`);
    lubber.setAttribute("y2", `${centerY - radius + 25}`);
    lubber.setAttribute("stroke", "#ffff00");
    lubber.setAttribute("stroke-width", "3");
    lubber.style.filter =
      "drop-shadow(0 0 6px #ffff00) drop-shadow(0 0 12px rgba(255,255,0,0.6))";
    svg.appendChild(lubber);

    // Aircraft symbol at center (triangle pointing up)
    const aircraft = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    const acSize = 12;
    const acPath = [
      `M ${centerX} ${centerY - acSize}`, // nose
      `L ${centerX - acSize * 0.6} ${centerY + acSize * 0.7}`, // left wing
      `L ${centerX} ${centerY + acSize * 0.3}`, // tail
      `L ${centerX + acSize * 0.6} ${centerY + acSize * 0.7}`, // right wing
      "Z",
    ].join(" ");
    aircraft.setAttribute("d", acPath);
    aircraft.setAttribute("fill", "#ffff00");
    aircraft.setAttribute("opacity", "1");
    aircraft.setAttribute("stroke", "#ffff00");
    aircraft.setAttribute("stroke-width", "1");
    aircraft.style.filter =
      "drop-shadow(0 0 6px #ffff00) drop-shadow(0 0 12px rgba(255,255,0,0.7))";
    svg.appendChild(aircraft);

    // Inner dashed range circle
    const innerCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    innerCircle.setAttribute("cx", `${centerX}`);
    innerCircle.setAttribute("cy", `${centerY}`);
    innerCircle.setAttribute("r", `${radius * 0.7}`);
    innerCircle.setAttribute("stroke", "rgba(0,255,255,0.75)");
    innerCircle.setAttribute("stroke-width", "1.5");
    innerCircle.setAttribute("fill", "none");
    innerCircle.setAttribute("stroke-dasharray", "6 4");
    innerCircle.style.filter =
      "drop-shadow(0 0 4px rgba(0,255,255,0.9)) drop-shadow(0 0 8px rgba(0,255,255,0.5))";
    svg.appendChild(innerCircle);

    compass.appendChild(svg);

    // Heading display at top of compass
    const headingDisplay = document.createElement("div");
    headingDisplay.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      color: #ffff00;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      text-shadow: 0 0 8px #ffff00, 0 0 12px rgba(255,255,0,0.8);
    `;
    const bearingStr = Math.round(bearing).toString().padStart(3, "0");
    headingDisplay.textContent = `${bearingStr}°`;
    compass.appendChild(headingDisplay);

    // Apply smooth transition for rotation
    compassCard.style.transition = "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)";

    container.appendChild(compass);
  }

  private createBottomRightData(container: HTMLElement, data: any): void {
    const dataBlock = document.createElement("div");
    dataBlock.style.cssText = `
      position: absolute;
      bottom: 100px;
      right: 20px;
      font-size: 11px;
      line-height: 1.5;
      font-weight: bold;
      text-align: right;
      text-shadow: 0 0 3px rgba(0, 255, 0, 0.8);
    `;

    dataBlock.innerHTML = `
      <div>${data.verticalSpeed < 0 ? '-' : '+'}${Math.abs(data.verticalSpeed)} VS</div>
      <div>30.22 IN</div>
    `;

    container.appendChild(dataBlock);
  }

  private startUpdateLoop(): void {
    this.updateInterval = window.setInterval(() => {
      if (this.hudContainer) {
        // Remove and recreate HUD to update data
        const container = this.hudContainer.parentElement;
        if (container) {
          this.create(container);
        }
      }
    }, 200); // Update every 200ms for smoother altitude tape scrolling
  }

  public destroy(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.hudContainer) {
      this.hudContainer.remove();
      this.hudContainer = null;
    }
  }
}
