import React, { useState } from "react";
import { useStore } from "../store/useStore";

const AircraftDetailsDialog: React.FC = () => {
  const { selectedAircraft, setSelectedAircraft, lockThreat, executeThreat } =
    useStore();
  const [isClosing, setIsClosing] = useState(false);

  if (!selectedAircraft) return null;

  const aircraft = selectedAircraft;

  const typeColor =
    aircraft.aircraftType === "threat"
      ? "#ff4444"
      : aircraft.aircraftType === "mother"
        ? "#4488ff"
        : aircraft.aircraftType === "self"
          ? "#FFD700"
          : "#44ff44";

  const totalDistance = aircraft.totalDistanceCovered || 0;
  const distanceMach = aircraft.speed / 661.5;
  const isThreat = aircraft.aircraftType === "threat";

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => setSelectedAircraft(null), 200);
  };

  const handleLock = () => {
    lockThreat(aircraft);
    handleClose();
  };

  const handleExecute = () => {
    executeThreat(aircraft);
    handleClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "#222",
        border: "2px solid #555",
        borderRadius: "10px",
        padding: "20px",
        color: "white",
        fontFamily: "monospace",
        zIndex: 1000,
        minWidth: "350px",
        opacity: isClosing ? 0 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <h3 style={{ marginTop: 0, color: typeColor }}>Aircraft Details</h3>
      <div>
        <strong>Call Sign:</strong> {aircraft.callSign}
      </div>
      <div>
        <strong>Type:</strong>{" "}
        <span style={{ color: typeColor }}>
          {aircraft.aircraftType.toUpperCase()}
        </span>
      </div>
      <div>
        <strong>Status:</strong>{" "}
        <span
          style={{
            color: aircraft.status === "connected" ? "#4CAF50" : "#F44336",
          }}
        >
          {aircraft.status.toUpperCase()}
        </span>
      </div>
      <div>
        <strong>Aircraft:</strong> {aircraft.info}
      </div>
      <hr style={{ border: "1px solid #555", margin: "15px 0" }} />
      <div>
        <strong>Position:</strong>
      </div>
      <div style={{ marginLeft: "20px" }}>
        Latitude: {aircraft.lat.toFixed(6)}
      </div>
      <div style={{ marginLeft: "20px" }}>
        Longitude: {aircraft.lng.toFixed(6)}
      </div>
      <div>
        <strong>Altitude:</strong> {aircraft.altitude.toLocaleString()} ft
      </div>
      <div>
        <strong>Heading:</strong> {aircraft.heading}°
      </div>
      <div>
        <strong>Speed:</strong> {aircraft.speed} kts (Mach{" "}
        {distanceMach.toFixed(2)})
      </div>
      <hr style={{ border: "1px solid #555", margin: "15px 0" }} />
      <div>
        <strong style={{ color: "#ffaa00" }}>Total Distance Covered:</strong>
      </div>
      <div
        style={{
          marginLeft: "20px",
          color: "#ffaa00",
          fontSize: "16px",
          fontWeight: "bold",
        }}
      >
        {totalDistance.toFixed(2)} NM
      </div>

      {isThreat && (
        <>
          <hr style={{ border: "1px solid #555", margin: "15px 0" }} />
          <div
            style={{
              background: "rgba(255, 68, 68, 0.2)",
              padding: "10px",
              borderRadius: "5px",
              border: "1px solid #ff4444",
            }}
          >
            <div
              style={{
                color: "#ff4444",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              ⚠️ THREAT ACTIONS
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleLock}
                style={{
                  background: "#ff8800",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  flex: 1,
                }}
              >
                🎯 LOCK TARGET
              </button>
              <button
                onClick={handleExecute}
                style={{
                  background: "#ff0000",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  flex: 1,
                }}
              >
                💥 EXECUTE
              </button>
            </div>
          </div>
        </>
      )}

      <button
        onClick={handleClose}
        style={{
          background: "#555",
          color: "white",
          border: "none",
          padding: "8px 16px",
          borderRadius: "4px",
          cursor: "pointer",
          marginTop: "15px",
        }}
      >
        Close
      </button>
    </div>
  );
};

export default AircraftDetailsDialog;
