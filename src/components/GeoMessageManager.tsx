import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useStore } from "../store/useStore";

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

const GeoMessageManager: React.FC = () => {
  const { geoMessages, getMapManager } = useStore();
  const mapManager = getMapManager();
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const popupsRef = useRef<Map<number, mapboxgl.Popup>>(new Map());

  const getColorAndIcon = (
    action: number,
    geoType: number
  ): { color: string; icon: string; iconShape: string } => {
    let color = "#00ff00";
    let icon = "●";
    let iconShape = "circle";

    switch (geoType) {
      case 0:
        icon = "◆";
        color = "#00ff00";
        iconShape = "square";
        break;
      case 1:
        icon = "▲";
        color = "#ffff00";
        iconShape = "square";
        break;
      case 2:
        icon = "■";
        color = "#ff4400";
        iconShape = "square";
        break;
      case 3:
        icon = "★";
        color = "#ff00ff";
        iconShape = "square";
        break;
      case 4:
        icon = "◉";
        color = "#00ffff";
        iconShape = "circle";
        break;
      default:
        icon = "●";
        color = "#00ff00";
        iconShape = "circle";
    }

    switch (action) {
      case 0:
        break;
      case 1:
        if (color === "#00ff00") color = "#ffff00";
        break;
      case 2:
        color = "#ff4400";
        break;
      case 3:
        color = "#ff0000";
        break;
      default:
        break;
    }

    return { color, icon, iconShape };
  };

  const getActionText = (action: number): string => {
    const actions: { [key: number]: string } = {
      0: "INFO",
      1: "WARNING",
      2: "ALERT",
      3: "CRITICAL",
    };
    return actions[action] || `ACTION_${action}`;
  };

  const getGeoTypeText = (geoType: number): string => {
    const types: { [key: number]: string } = {
      0: "WAYPOINT",
      1: "ALERT",
      2: "TARGET",
      3: "EVENT",
      4: "BEACON",
    };
    return types[geoType] || `TYPE_${geoType}`;
  };

  const createPopupHTML = (message: GeoMessageData): string => {
    const { color } = getColorAndIcon(message.action, message.geoType);
    const actionText = getActionText(message.action);
    const geoTypeText = getGeoTypeText(message.geoType);

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
  };

  // Update markers when messages or map changes
  useEffect(() => {
    if (!mapManager) return;

    const mapboxMap = mapManager.getMapboxMap();
    if (!mapboxMap) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    popupsRef.current.clear();

    // Create markers for each message
    geoMessages.forEach((message) => {
      if (
        message.messageId === undefined ||
        message.latitude === undefined ||
        message.longitude === undefined
      ) {
        return;
      }

      const { color, icon, iconShape } = getColorAndIcon(
        message.action,
        message.geoType
      );

      // Create custom HTML element for marker
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
      }).setHTML(createPopupHTML(message));

      marker.setPopup(popup);

      // Store references
      markersRef.current.set(message.messageId, marker);
      popupsRef.current.set(message.messageId, popup);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      popupsRef.current.clear();
    };
  }, [mapManager, geoMessages]);

  return null; // This component doesn't render anything directly
};

export default GeoMessageManager;
