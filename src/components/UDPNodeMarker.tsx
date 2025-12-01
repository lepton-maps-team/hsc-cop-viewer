import React from "react";
import { UDPNodeMarkerProps } from "../lib/types";

const UDPNodeMarker: React.FC<UDPNodeMarkerProps> = ({
  node,
  position,
  isLocked,
  isThreatLocked,
  onClick,
}) => {
  const useLockedIcon = isLocked || isThreatLocked;
  const isMotherAc = node.internalData && node.internalData.isMotherAc === 1;

  let iconFile: string;
  if (isMotherAc) {
    iconFile = "mother-aircraft.svg";
  } else if (node.opcode === 104) {
    iconFile = "hostile_aircraft.svg";
  } else {
    iconFile = "friendly_aircraft.svg";
  }

  let glowColor: string;
  if (useLockedIcon) {
    glowColor = "#ffaa00";
  } else if (isMotherAc) {
    glowColor = "#ffaa00";
  } else if (node.opcode === 104) {
    glowColor = "#ff0000";
  } else {
    glowColor = "#00ff00";
  }

  const iconSize = 24;
  const isClickable = node.opcode === 104 || node.opcode === 101;

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: isClickable ? "auto" : "none",
        zIndex: 3,
        cursor: isClickable ? "pointer" : "default",
      }}
      onClick={isClickable ? onClick : undefined}
    >
      <img
        src={`icons/${iconFile}`}
        alt={`UDP node ${node.globalId} (opcode ${node.opcode})`}
        className="udp-node-icon"
        data-global-id={node.globalId.toString()}
        data-opcode={node.opcode?.toString() || "unknown"}
        style={{
          width: "100%",
          height: "100%",
          filter: `drop-shadow(0 0 4px ${glowColor}) drop-shadow(0 0 8px ${glowColor})`,
          objectFit: "contain",
        }}
      />
      {useLockedIcon && (
        <div
          style={{
            position: "absolute",
            top: "-4px",
            right: "-4px",
            width: "12px",
            height: "12px",
            background: "#ffaa00",
            border: "2px solid #ffffff",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            zIndex: 4,
            boxShadow: "0 0 4px rgba(255, 170, 0, 0.8)",
            pointerEvents: "none",
          }}
        >
          🔒
        </div>
      )}
    </div>
  );
};

export default UDPNodeMarker;

