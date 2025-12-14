import { MapManager } from "../map";
import mapboxgl from "mapbox-gl";

export type GeoMessageData = {
  globalId: number;
  messageId: number;
  senderGid: number;
  latitude: number;
  longitude: number;
  altitude: number;
  missionId: number;
  source: number;
  geoType: number;
  action: number;
  nodeId: number;
  opcode: 122;
};

export class GeoMessageManager {
  private mapManager: MapManager | null = null;
  private messages: Map<number, GeoMessageData> = new Map(); // Key: messageId
  private markers: Map<number, mapboxgl.Marker> = new Map();
  private popups: Map<number, mapboxgl.Popup> = new Map();
  private pendingMessages: GeoMessageData[] = []; // Store messages until map is ready

  constructor(mapManager: MapManager | null = null) {
    this.mapManager = mapManager;
  }

  setMapManager(mapManager: MapManager | null): void {
    this.mapManager = mapManager;
    // If we have pending messages and map is now available, create markers
    if (mapManager && this.pendingMessages.length > 0) {
      console.log(
        `📍 GeoMessageManager: Map available, creating ${this.pendingMessages.length} pending markers`
      );
      this.updateMessages(this.pendingMessages);
      this.pendingMessages = [];
    }
  }

  updateMessages(messageData: GeoMessageData[]): void {
    if (!this.mapManager) {
      console.log(
        "⚠️ GeoMessageManager: MapManager not set, storing messages for later"
      );
      this.pendingMessages = messageData;
      return;
    }

    const mapboxMap = this.mapManager.getMapboxMap();
    if (!mapboxMap) {
      console.log(
        "⚠️ GeoMessageManager: Mapbox map not available, storing messages for later"
      );
      this.pendingMessages = messageData;
      return;
    }

    // Clear existing markers
    this.markers.forEach((marker) => marker.remove());
    this.markers.clear();
    this.popups.clear();

    // Store new messages
    this.messages.clear();
    messageData.forEach((message) => {
      if (
        message.messageId !== undefined &&
        message.latitude !== undefined &&
        message.longitude !== undefined
      ) {
        this.messages.set(message.messageId, message);
      }
    });

    console.log(
      `📍 GeoMessageManager: Creating ${this.messages.size} markers for opcode 122 messages`
    );

    // Create markers for each message
    this.messages.forEach((message) => {
      this.createMarker(message, mapboxMap);
    });
  }

  private createMarker(message: GeoMessageData, mapboxMap: mapboxgl.Map): void {
    const { color, icon, iconShape } = this.getColorAndIcon(
      message.action,
      message.geoType
    );

    // Create custom HTML element for marker with better visibility
    const el = document.createElement("div");
    el.className = "geo-message-marker";
    el.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: ${iconShape === "square" ? "4px" : "50%"};
      background: ${color};
      border: 3px solid white;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.7), 0 0 15px ${color}80;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 1000;
      position: relative;
    `;
    el.textContent = icon;
    el.addEventListener("mouseenter", () => {
      el.style.transform = "scale(1.3)";
      el.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.8), 0 0 20px ${color}`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "scale(1)";
      el.style.boxShadow = `0 3px 10px rgba(0, 0, 0, 0.7), 0 0 15px ${color}80`;
    });

    // Create marker
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: "center",
    })
      .setLngLat([message.longitude, message.latitude])
      .addTo(mapboxMap);

    // Create popup
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: true,
      closeOnClick: false,
    }).setHTML(this.createPopupHTML(message));

    marker.setPopup(popup);

    // Store references
    this.markers.set(message.messageId, marker);
    this.popups.set(message.messageId, popup);

    console.log(
      `📍 Created geo-message marker at [${message.latitude.toFixed(4)}, ${message.longitude.toFixed(4)}] with icon ${icon} and color ${color}`
    );
  }

  private createPopupHTML(message: GeoMessageData): string {
    const { color } = this.getColorAndIcon(message.action, message.geoType);
    const actionText = this.getActionText(message.action);
    const geoTypeText = this.getGeoTypeText(message.geoType);

    return `
      <div style="font-family: monospace; font-size: 11px; min-width: 200px;">
        <div style="color: ${color}; font-weight: bold; margin-bottom: 8px; font-size: 12px; text-align: center; border-bottom: 1px solid ${color}; padding-bottom: 5px;">
          📍 GEO MESSAGE
        </div>
        <div style="margin-bottom: 6px;">
          <span style="color: #ffaa00;">Message ID:</span>
          <span style="color: #00ff00; font-weight: bold;">${message.messageId}</span>
        </div>
        <div style="margin-bottom: 6px;">
          <span style="color: #ffaa00;">Mission ID:</span>
          <span style="color: #00ff00; font-weight: bold;">${message.missionId}</span>
        </div>
        <div style="margin-bottom: 6px;">
          <span style="color: #ffaa00;">Source:</span>
          <span style="color: #00ff00; font-weight: bold;">${message.source}</span>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
          <div style="margin-bottom: 4px;">
            <span style="color: #cccccc;">Action:</span>
            <span style="color: ${color}; font-weight: bold;">${actionText}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #cccccc;">Geo Type:</span>
            <span style="color: ${color}; font-weight: bold;">${geoTypeText}</span>
          </div>
          <div style="margin-bottom: 4px;">
            <span style="color: #cccccc;">Node ID:</span>
            <span style="color: #ffff00; font-weight: bold;">${message.nodeId}</span>
          </div>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
          <div style="margin-bottom: 2px; font-size: 10px; color: #888;">
            <div>Global ID: ${message.globalId}</div>
            <div>Sender GID: ${message.senderGid}</div>
            <div>Lat: ${message.latitude.toFixed(6)}°</div>
            <div>Lng: ${message.longitude.toFixed(6)}°</div>
            <div>Alt: ${message.altitude.toFixed(0)}ft</div>
          </div>
        </div>
      </div>
    `;
  }

  private getColorAndIcon(
    action: number,
    geoType: number
  ): { color: string; icon: string; iconShape: string } {
    // Color based on action
    let color = "#00ff00"; // Default green
    let icon = "●"; // Default circle
    let iconShape = "circle";

    // GeoType-based icons and colors (primary)
    switch (geoType) {
      case 0:
        icon = "◆"; // Waypoint - Diamond
        color = "#00ff00"; // Green
        iconShape = "square";
        break;
      case 1:
        icon = "▲"; // Alert - Triangle
        color = "#ffff00"; // Yellow
        iconShape = "square";
        break;
      case 2:
        icon = "■"; // Target - Square
        color = "#ff4400"; // Orange
        iconShape = "square";
        break;
      case 3:
        icon = "★"; // Event - Star
        color = "#ff00ff"; // Magenta
        iconShape = "square";
        break;
      case 4:
        icon = "◉"; // Beacon - Double circle
        color = "#00ffff"; // Cyan
        iconShape = "circle";
        break;
      default:
        icon = "●"; // Default circle
        color = "#00ff00";
        iconShape = "circle";
    }

    // Action-based color override (if action is more critical than geoType suggests)
    switch (action) {
      case 0:
        // Keep geoType color for INFO
        break;
      case 1:
        // Warning - use yellow if not already critical
        if (color === "#00ff00") color = "#ffff00";
        break;
      case 2:
        // Alert - use orange
        color = "#ff4400";
        break;
      case 3:
        // Critical - use red
        color = "#ff0000";
        break;
      default:
        break;
    }

    return { color, icon, iconShape };
  }

  private getActionText(action: number): string {
    const actions: { [key: number]: string } = {
      0: "INFO",
      1: "WARNING",
      2: "ALERT",
      3: "CRITICAL",
    };
    return actions[action] || `ACTION_${action}`;
  }

  private getGeoTypeText(geoType: number): string {
    const types: { [key: number]: string } = {
      0: "WAYPOINT",
      1: "ALERT",
      2: "TARGET",
      3: "EVENT",
      4: "BEACON",
    };
    return types[geoType] || `TYPE_${geoType}`;
  }

  /**
   * Recreate markers from stored messages (useful after map reinitialization)
   */
  public recreateMarkers(): void {
    if (!this.mapManager) return;

    const mapboxMap = this.mapManager.getMapboxMap();
    if (!mapboxMap) return;

    // Clear existing markers (handle case where map might have been reinitialized)
    this.markers.forEach((marker) => {
      try {
        marker.remove();
      } catch (e) {
        // Marker might already be removed if map was reinitialized
        console.log("⚠️ GeoMessageManager: Marker already removed, skipping");
      }
    });
    this.markers.clear();
    this.popups.clear();

    // Recreate markers from stored messages
    if (this.messages.size > 0) {
      console.log(
        `📍 GeoMessageManager: Recreating ${this.messages.size} markers after map reinitialization`
      );
      this.messages.forEach((message) => {
        this.createMarker(message, mapboxMap);
      });
    }
  }

  /**
   * Get all stored messages
   */
  public getStoredMessages(): GeoMessageData[] {
    return Array.from(this.messages.values());
  }

  public destroy(): void {
    this.markers.forEach((marker) => {
      try {
        marker.remove();
      } catch (e) {
        // Ignore errors if marker already removed
      }
    });
    this.markers.clear();
    this.popups.clear();
    this.messages.clear();
  }
}
