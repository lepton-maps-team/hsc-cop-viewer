import React from "react";
import { useStore } from "../store/useStore";

const DebugInfo: React.FC = () => {
  const { aircraft, nodeId } = useStore();
  const selfAircraft = aircraft.get(nodeId);
  const threatCount = Array.from(aircraft.values()).filter(
    (a) => a.aircraftType === "threat"
  ).length;
  const motherCount = Array.from(aircraft.values()).filter(
    (a) => a.aircraftType === "mother"
  ).length;
  const friendlyCount = Array.from(aircraft.values()).filter(
    (a) => a.aircraftType === "friendly"
  ).length;

  return (
    <div
      id="debug-info"
      style={{
        position: "fixed",
        top: "10px",
        left: "70px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "12px",
        background: "rgba(0, 0, 0, 0.7)",
        padding: "5px 10px",
        borderRadius: "4px",
        zIndex: 200,
      }}
    >
      <div>Node ID: {nodeId}</div>
      <div>Aircraft: {aircraft.size}</div>
      <div>Threats: {threatCount}</div>
      <div>Mother: {motherCount}</div>
      <div>Friendly: {friendlyCount}</div>
      {selfAircraft && (
        <div>
          Self: {selfAircraft.callSign} ({selfAircraft.lat.toFixed(4)},{" "}
          {selfAircraft.lng.toFixed(4)})
        </div>
      )}
    </div>
  );
};

export { DebugInfo };
export default DebugInfo;
