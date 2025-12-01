import React, { useEffect, useRef } from "react";
import { UDPDataPoint } from "./UDPNodesManager";
import { useUDPStore } from "../store/useUDPStore";
import { useNotificationStore } from "../store/useNotificationStore";

interface RedNodeDialogProps {
  node: UDPDataPoint;
  position: { x: number; y: number };
  onClose: () => void;
}

const RedNodeDialog: React.FC<RedNodeDialogProps> = ({
  node,
  position,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const {
    lockedNodeIds,
    addLockedNodeId,
    setUdpDataPoints,
    udpDataPoints,
  } = useUDPStore();
  const { setNotification } = useNotificationStore();

  useEffect(() => {
    if (!dialogRef.current) return;

    // Adjust position if dialog goes off screen
    const rect = dialogRef.current.getBoundingClientRect();
    let adjustedX = position.x + 30;
    let adjustedY = position.y - 60;

    if (rect.right > window.innerWidth) {
      adjustedX = position.x - 230;
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

  const handleLock = () => {
    addLockedNodeId(node.globalId);
    setNotification({
      message: "🎯 TARGET LOCKED",
      subMessage: `Node ${node.globalId}`,
      type: "lock",
    });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleExecute = () => {
    const newPoints = new Map(udpDataPoints);
    newPoints.delete(node.globalId);
    setUdpDataPoints(newPoints);
    setNotification({
      message: "💥 TARGET ELIMINATED",
      subMessage: `Node ${node.globalId}`,
      type: "execute",
    });
    setTimeout(() => setNotification(null), 2000);
    onClose();
  };

  const isLocked = lockedNodeIds.has(node.globalId);

  return (
    <div
      ref={dialogRef}
      id="red-node-dialog"
      style={{
        position: "fixed",
        left: `${position.x + 30}px`,
        top: `${position.y - 60}px`,
        width: "200px",
        background: "rgba(0, 0, 0, 0.95)",
        border: "2px solid #ff0000",
        borderRadius: "8px",
        padding: "12px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 200,
        boxShadow: "0 0 20px rgba(255, 0, 0, 0.6)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          color: "#ff0000",
          fontWeight: "bold",
          fontSize: "14px",
          marginBottom: "10px",
          textAlign: "center",
          borderBottom: "1px solid #ff0000",
          paddingBottom: "6px",
        }}
      >
        🎯 TARGET {node.globalId}
      </div>

      <div
        style={{
          fontSize: "10px",
          color: "#cccccc",
          marginBottom: "12px",
          lineHeight: 1.4,
        }}
      >
        <div>Lat: {node.latitude.toFixed(4)}°</div>
        <div>Lng: {node.longitude.toFixed(4)}°</div>
        <div>Alt: {node.altitude}ft</div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexDirection: "column",
        }}
      >
        <button
          onClick={handleLock}
          disabled={isLocked}
          style={{
            background: isLocked ? "#44ff44" : "#ff8800",
            color: "white",
            border: "none",
            padding: "10px",
            borderRadius: "4px",
            cursor: isLocked ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: "bold",
            fontFamily: "monospace",
            transition: "all 0.2s",
            width: "100%",
            opacity: isLocked ? 0.7 : 1,
          }}
        >
          {isLocked ? "🔒 LOCKED" : "🎯 LOCK"}
        </button>
        <button
          onClick={handleExecute}
          style={{
            background: "#ff0000",
            color: "white",
            border: "none",
            padding: "10px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "bold",
            fontFamily: "monospace",
            transition: "all 0.2s",
            width: "100%",
          }}
        >
          💥 EXECUTE
        </button>
      </div>

      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          background: "transparent",
          color: "#ff0000",
          border: "1px solid #ff0000",
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

export default RedNodeDialog;
