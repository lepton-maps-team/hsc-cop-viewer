import React, { useState } from "react";
import { Aircraft, AircraftType } from "../types";
import { useStore } from "../store/useStore";

interface AircraftMarkerProps {
  aircraft: Aircraft;
  isCenter: boolean;
  position?: { x: number; y: number };
}

const AircraftMarker: React.FC<AircraftMarkerProps> = ({
  aircraft,
  isCenter,
  position,
}) => {
  const { showAircraftDetails } = useStore();
  const [imageError, setImageError] = useState(false);
  const fixedSize = aircraft.aircraftType === "threat" ? 24 : 20;

  const getAircraftColor = (aircraftType: AircraftType): string => {
    switch (aircraftType) {
      case "mother":
        return "#0080ff";
      case "self":
        return "#FFD700";
      case "friendly":
        return "#00ff00";
      case "threat":
        return "#ff0000";
      default:
        return "#ffff00";
    }
  };

  const getIconFile = (
    aircraftType: AircraftType,
    isLocked?: boolean
  ): string => {
    if (isLocked) {
      return "icons/alert.svg";
    }
    switch (aircraftType) {
      case "mother":
        return "icons/mother-aircraft.svg";
      case "self":
        return "icons/friendly_aircraft.svg";
      case "friendly":
        return "icons/friendly_aircraft.svg";
      case "threat":
        return "icons/hostile_aircraft.svg";
      default:
        return "icons/unknown_aircraft.svg";
    }
  };

  const getGlowFilter = (
    aircraftType: AircraftType,
    isLocked?: boolean
  ): string => {
    if (isLocked) {
      return `drop-shadow(0 0 8px #ffaa00) drop-shadow(0 0 16px #ff8800)`;
    }
    switch (aircraftType) {
      case "mother":
        return `drop-shadow(0 0 6px #0080ff) drop-shadow(0 0 12px #0080ff)`;
      case "self":
        return `drop-shadow(0 0 6px #FFD700) drop-shadow(0 0 12px #FFA500)`;
      case "threat":
        return `drop-shadow(0 0 6px #ff0000) drop-shadow(0 0 12px #ff0000)`;
      default:
        return `drop-shadow(0 0 5px rgba(0, 255, 0, 1)) drop-shadow(0 0 10px rgba(0, 255, 0, 0.8))`;
    }
  };

  const getFallbackSymbol = (aircraftType: AircraftType): string => {
    switch (aircraftType) {
      case "mother":
        return "M";
      case "self":
        return "★";
      case "friendly":
        return "F";
      case "threat":
        return "⚠";
      default:
        return "?";
    }
  };

  const color = getAircraftColor(aircraft.aircraftType);
  const iconFile = getIconFile(aircraft.aircraftType, aircraft.isLocked);
  const glowFilter = getGlowFilter(aircraft.aircraftType, aircraft.isLocked);

  const markerStyle: React.CSSProperties = isCenter
    ? {
        position: "absolute",
        top: "50%",
        left: "50%",
        marginTop: `-${fixedSize / 2}px`,
        marginLeft: `-${fixedSize / 2}px`,
        width: `${fixedSize}px`,
        height: `${fixedSize}px`,
        cursor: "pointer",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }
    : {
        position: "absolute",
        top: position ? `${position.y}%` : "50%",
        left: position ? `${position.x}%` : "50%",
        transform: "translate(-50%, -50%)",
        width: `${fixedSize}px`,
        height: `${fixedSize}px`,
        cursor: "pointer",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        filter:
          aircraft.aircraftType === "threat" ? "brightness(1.5)" : undefined,
      };

  return (
    <div
      className="aircraft-marker"
      style={markerStyle}
      data-aircraft-id={aircraft.id}
      onClick={() => showAircraftDetails(aircraft)}
    >
      {/* Fallback icon */}
      <div
        data-icon-type={aircraft.isLocked ? "locked" : aircraft.aircraftType}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${fixedSize}px`,
          height: `${fixedSize}px`,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: color,
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: `${Math.max(10, fixedSize * 0.5)}px`,
          pointerEvents: "none",
          zIndex: 5,
          textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 1px 1px 3px rgba(0, 0, 0, 1)`,
        }}
      >
        {aircraft.isLocked ? null : getFallbackSymbol(aircraft.aircraftType)}
      </div>

      {/* SVG Icon */}
      {!imageError && (
        <img
          src={iconFile}
          alt={`${aircraft.aircraftType} aircraft`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${fixedSize}px`,
            height: `${fixedSize}px`,
            pointerEvents: "none",
            filter: glowFilter,
            display: "block",
            zIndex: 6,
            objectFit: "contain",
          }}
          onError={() => setImageError(true)}
          onLoad={() => {
            console.log(
              `✅ Loaded SVG aircraft icon: ${iconFile} for ${aircraft.aircraftType}`
            );
          }}
        />
      )}

      {/* Call sign label */}
      <div
        style={{
          position: "absolute",
          top: `${fixedSize + 2}px`,
          left: "50%",
          transform: "translateX(-50%)",
          color: "white",
          fontFamily: "monospace",
          fontSize: "10px",
          fontWeight: "bold",
          textShadow: "0 0 3px black",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          textRendering: "optimizeLegibility",
        }}
      >
        {aircraft.callSign}
      </div>

      {/* Threat animation */}
      {aircraft.aircraftType === "threat" && (
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            [data-aircraft-id="${aircraft.id}"] [data-icon-type="threat"] {
              animation: pulse 1s infinite;
            }
          `}
        </style>
      )}
    </div>
  );
};

export default AircraftMarker;
