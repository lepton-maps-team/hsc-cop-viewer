import React from "react";
import { calculateDistance } from "../lib/utils";
import { UDPDataPoint } from "./UDPNodesManager";

interface ConnectionLineProps {
  node1: UDPDataPoint;
  node2: UDPDataPoint;
  point1: { x: number; y: number };
  point2: { x: number; y: number };
  color: string;
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({
  node1,
  node2,
  point1,
  point2,
  color,
}) => {
  const distanceNM = calculateDistance(
    node1.latitude,
    node1.longitude,
    node2.latitude,
    node2.longitude
  );

  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  const midX = (point1.x + point2.x) / 2;
  const midY = (point1.y + point2.y) / 2;

  const isGreen = color === "#00ff00";

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: `${point1.x}px`,
          top: `${point1.y}px`,
          width: `${length}px`,
          height: isGreen ? "4px" : "3px",
          backgroundImage: isGreen
            ? "repeating-linear-gradient(to right, #00ff00 0px, #00ff00 12px, transparent 12px, transparent 24px)"
            : "repeating-linear-gradient(to right, #ff8800 0px, #ff8800 10px, transparent 10px, transparent 20px)",
          backgroundColor: isGreen
            ? "rgba(0, 255, 0, 0.3)"
            : "transparent",
          opacity: isGreen ? 1 : 0.9,
          transformOrigin: "0 50%",
          transform: `rotate(${angle}deg)`,
          pointerEvents: "none",
          zIndex: 2,
          boxShadow: isGreen
            ? "0 0 4px rgba(0, 255, 0, 1), 0 0 8px rgba(0, 255, 0, 0.6)"
            : "0 0 3px rgba(255, 136, 0, 0.9)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${midX}px`,
          top: `${midY - 20}px`,
          transform: "translateX(-50%)",
          color: "#ffffff",
          fontSize: "14px",
          fontWeight: "bold",
          fontFamily: "monospace",
          pointerEvents: "none",
          textAlign: "center",
          whiteSpace: "nowrap",
          textShadow:
            "0 0 6px rgba(0, 0, 0, 1), 0 0 10px rgba(0, 0, 0, 0.9), 0 0 14px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 1), 2px 2px 4px rgba(0, 0, 0, 1), -2px 2px 4px rgba(0, 0, 0, 1), 2px -2px 4px rgba(0, 0, 0, 1), -2px -2px 4px rgba(0, 0, 0, 1)",
          letterSpacing: "0.5px",
        }}
      >
        {distanceNM.toFixed(1)} NM
      </div>
    </>
  );
};

export default ConnectionLine;

