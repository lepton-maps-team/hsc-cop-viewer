import React, { useMemo } from "react";
import { useAircraftStore } from "../store/useAircraftStore";
import { useUIStore } from "../store/useUIStore";
import { useThreatStore } from "../store/useThreatStore";
import { getNearestThreats } from "../lib/utils";
import { ThreatWithDistance, ThreatDialogProps } from "../lib/types";

// Re-export for backward compatibility
export type { ThreatWithDistance };

const ThreatDialog: React.FC<ThreatDialogProps> = ({ isVisible }) => {
  const { aircraft, nodeId } = useAircraftStore();
  const { showThreatDialog, centerMode } = useUIStore();
  const { lockThreat, executeThreat } = useThreatStore();

  const centerAircraft = useMemo(() => {
    if (aircraft.size === 0) return null;
    const aircraftArray = Array.from(aircraft.values());
    if (centerMode === "mother") {
      return (
        aircraftArray.find((a) => a.aircraftType === "mother") ||
        aircraftArray[0]
      );
    }
    return aircraft.get(nodeId) || aircraftArray[0];
  }, [aircraft, centerMode, nodeId]);

  const nearestThreats = useMemo(() => {
    if (!centerAircraft) return [];
    return getNearestThreats(centerAircraft, aircraft, 5);
  }, [centerAircraft, aircraft]);

  if (!isVisible || !showThreatDialog) return null;

  return (
    <div
      id="threat-dialog"
      style={{
        position: "fixed",
        top: "50px",
        right: "80px",
        width: "280px",
        background: "rgba(0, 0, 0, 0.9)",
        border: "2px solid #ff4444",
        borderRadius: "8px",
        padding: "12px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 150,
        boxShadow: "0 0 20px rgba(255, 68, 68, 0.5)",
      }}
    >
      <div
        style={{
          color: "#ff4444",
          fontWeight: "bold",
          fontSize: "14px",
          marginBottom: "8px",
          textAlign: "center",
          borderBottom: "1px solid #ff4444",
          paddingBottom: "4px",
        }}
      >
        ⚠️ NEAREST THREATS ({nearestThreats.length})
      </div>

      <div
        id="threat-list"
        style={{
          maxHeight: "200px",
          overflowY: "auto",
        }}
      >
        {nearestThreats.length === 0 ? (
          <div
            style={{
              color: "#44ff44",
              textAlign: "center",
              padding: "10px",
              fontStyle: "italic",
            }}
          >
            ✅ NO THREATS DETECTED
          </div>
        ) : (
          nearestThreats.map((threat) => (
            <div
              key={threat.aircraft.id}
              style={{
                padding: "8px",
                margin: "4px 0",
                background: "rgba(255, 68, 68, 0.1)",
                borderLeft: "3px solid #ff4444",
                borderRadius: "3px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#ff4444",
                  }}
                >
                  {threat.aircraft.callSign}
                </div>
                <div
                  style={{
                    fontWeight: "bold",
                    color: "#ffaa44",
                    fontSize: "14px",
                  }}
                >
                  {threat.distanceNM.toFixed(1)}NM
                </div>
              </div>

              <div
                style={{
                  fontSize: "10px",
                  color: "#cccccc",
                  marginBottom: "6px",
                }}
              >
                {threat.aircraft.altitude}ft | {threat.aircraft.speed}kts | Hdg{" "}
                {threat.aircraft.heading}°
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "5px",
                }}
              >
                <button
                  onClick={() => lockThreat(threat.aircraft)}
                  style={{
                    background: "#ff8800",
                    color: "white",
                    border: "none",
                    padding: "5px 10px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: "bold",
                    flex: 1,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ffaa00";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ff8800";
                  }}
                >
                  🎯 LOCK
                </button>
                <button
                  onClick={() => executeThreat(threat.aircraft)}
                  style={{
                    background: "#ff0000",
                    color: "white",
                    border: "none",
                    padding: "5px 10px",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "10px",
                    fontWeight: "bold",
                    flex: 1,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ff3333";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ff0000";
                  }}
                >
                  💥 EXECUTE
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export { ThreatDialog };
export default ThreatDialog;
