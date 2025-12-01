import React, { useEffect, useRef } from "react";
import { UDPDataPoint } from "./UDPNodesManager";
import { useUDPStore } from "../store/useUDPStore";

interface GreenNodeDialogProps {
  node: UDPDataPoint;
  position: { x: number; y: number };
  onClose: () => void;
}

const GreenNodeDialog: React.FC<GreenNodeDialogProps> = ({
  node,
  position,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { setDialogOpenForNodeId } = useUDPStore();

  useEffect(() => {
    if (!dialogRef.current) return;

    // Adjust position if dialog goes off screen
    const rect = dialogRef.current.getBoundingClientRect();
    let adjustedX = position.x + 30;
    let adjustedY = position.y - 60;

    if (rect.right > window.innerWidth) {
      adjustedX = position.x - 310;
    }
    if (rect.bottom > window.innerHeight) {
      adjustedY = position.y - rect.height - 10;
    }
    if (adjustedX < 0) {
      adjustedX = position.x + 30;
    }
    if (adjustedY < 0) {
      adjustedY = position.y + 30;
    }

    dialogRef.current.style.left = `${adjustedX}px`;
    dialogRef.current.style.top = `${adjustedY}px`;
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [onClose]);

  const callsign = node.callsign || null;
  const isMotherAc = node.internalData && node.internalData.isMotherAc === 1;
  const metadata = node.regionalData?.metadata || {};
  const baroAltitude =
    metadata.baroAltitude !== undefined ? metadata.baroAltitude : NaN;
  const groundSpeed =
    metadata.groundSpeed !== undefined ? metadata.groundSpeed : NaN;
  const mach = metadata.mach !== undefined ? metadata.mach : NaN;

  const baroAltitudeDisplay = isNaN(baroAltitude) ? "NaN" : `${baroAltitude}ft`;
  const groundSpeedDisplay = isNaN(groundSpeed) ? "NaN" : `${groundSpeed}kt`;
  const machDisplay = isNaN(mach) ? "NaN" : `${mach}`;

  return (
    <div
      ref={dialogRef}
      id="green-node-dialog"
      style={{
        position: "fixed",
        left: `${position.x + 30}px`,
        top: `${position.y - 60}px`,
        width: "280px",
        background: "rgba(0, 0, 0, 0.95)",
        border: "2px solid #00ff00",
        borderRadius: "8px",
        padding: "12px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 200,
        boxShadow: "0 0 20px rgba(0, 255, 0, 0.6)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          color: "#00ff00",
          fontWeight: "bold",
          fontSize: "14px",
          marginBottom: "10px",
          textAlign: "center",
          borderBottom: "1px solid #00ff00",
          paddingBottom: "6px",
        }}
      >
        🟢 NETWORK NODE {node.globalId}
      </div>

      {callsign && (
        <div
          style={{
            fontSize: "14px",
            color: "#00ff00",
            fontWeight: "bold",
            marginBottom: "12px",
            textAlign: "center",
            padding: "8px",
            background: "rgba(0, 255, 0, 0.1)",
            borderRadius: "4px",
          }}
        >
          CALLSIGN: {callsign}
        </div>
      )}

      {isMotherAc && (
        <div
          style={{
            fontSize: "12px",
            color: "#ffaa00",
            fontWeight: "bold",
            marginBottom: "8px",
            textAlign: "center",
            padding: "4px",
            background: "rgba(255, 170, 0, 0.2)",
            borderRadius: "4px",
          }}
        >
          ✈️ MOTHER AIRCRAFT
        </div>
      )}

      <div
        style={{
          fontSize: "12px",
          color: "#cccccc",
          marginBottom: "12px",
          lineHeight: 1.6,
          padding: "8px",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "4px",
        }}
      >
        <div
          style={{
            color: "#00ff00",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          POSITION:
        </div>
        <div>Latitude: {node.latitude.toFixed(6)}°</div>
        <div>Longitude: {node.longitude.toFixed(6)}°</div>
        {node.altitude !== undefined && <div>Altitude: {node.altitude}ft</div>}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#cccccc",
          marginBottom: "12px",
          lineHeight: 1.6,
          padding: "8px",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "4px",
        }}
      >
        <div
          style={{
            color: "#00ff00",
            fontWeight: "bold",
            marginBottom: "8px",
          }}
        >
          METADATA:
        </div>
        <div>Baro Altitude: {baroAltitudeDisplay}</div>
        <div>Ground Speed: {groundSpeedDisplay}</div>
        <div>Mach: {machDisplay}</div>
      </div>

      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          background: "transparent",
          color: "#00ff00",
          border: "1px solid #00ff00",
          borderRadius: "4px",
          width: "24px",
          height: "24px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
};

export default GreenNodeDialog;

