import React, { useState, useEffect } from "react";
import { useUDPStore } from "../store/useUDPStore";
import { useMapStore } from "../store/useMapStore";

const NetworkMembersTable: React.FC = () => {
  const { networkMembers } = useUDPStore();
  const { getMapManager } = useMapStore();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    const updateMapCenter = () => {
      const mapManager = getMapManager();
      const center = mapManager?.getCenter();
      if (center) {
        setMapCenter(center);
      }
    };

    updateMapCenter();
    window.addEventListener("map-center-changed", updateMapCenter);

      return () => {
        window.removeEventListener("map-center-changed", updateMapCenter);
      };
    }, []);

  const toggleDetails = (globalId: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(globalId)) {
        newSet.delete(globalId);
      } else {
        newSet.add(globalId);
      }
      return newSet;
    });
  };

  const getACSColor = (status: number): string => {
    if (status === 0) return "#444";
    if (status === 1) return "#ffaa00";
    if (status === 2) return "#00ff00";
    return "#ff0000";
  };

  const getACSTextColor = (status: number): string => {
    return status === 0 ? "#888" : "#000";
  };

  const getFuelColor = (fuel: number): string => {
    if (fuel > 50) return "#00ff00";
    if (fuel > 25) return "#ffaa00";
    return "#ff0000";
  };

  const formatLegacyFreq = (freq: any): string => {
    if (!freq || typeof freq !== "object") return "N/A";
    const digits = [freq.D1, freq.D2, freq.D3, freq.D4, freq.D5, freq.D6].map(
      (v) => (v !== undefined && v !== null ? v : 0)
    );
    if (digits.every((d) => d === 0)) return "N/A";
    const freqStr = digits.map((d) => d.toString()).join("");
    if (freqStr.length >= 3) {
      return `${freqStr.slice(0, 3)}.${freqStr.slice(3)} MHz`;
    }
    return freqStr || "N/A";
  };

  const membersWith102Data = networkMembers.filter(
    (member) =>
      member.callsign !== undefined ||
      member.internalData !== undefined ||
      member.regionalData !== undefined ||
      member.battleGroupData !== undefined
  );

  if (membersWith102Data.length === 0) {
    return (
      <div
        id="network-members-table"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "380px",
          maxHeight: "calc(100vh - 20px)",
          background: "rgba(10, 10, 20, 0.95)",
          border: "2px solid rgba(0, 255, 0, 0.6)",
          borderRadius: "8px",
          padding: "10px",
          margin: "10px",
          overflowY: "auto",
          overflowX: "hidden",
          zIndex: 200,
          fontFamily: "'Courier New', monospace",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
        }}
      >
        <div style={{ color: "#888", textAlign: "center", padding: "20px" }}>
          No network members available
        </div>
      </div>
    );
  }

  return (
    <div
      id="network-members-table"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "380px",
        maxHeight: "calc(100vh - 20px)",
        background: "rgba(10, 10, 20, 0.95)",
        border: "2px solid rgba(0, 255, 0, 0.6)",
        borderRadius: "8px",
        padding: "10px",
        margin: "10px",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 200,
        fontFamily: "'Courier New', monospace",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
      }}
    >
      {/* Map Center Display */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.5)",
          padding: "8px",
          marginBottom: "10px",
          borderRadius: "4px",
          border: "1px solid rgba(0, 255, 0, 0.3)",
          fontSize: "11px",
        }}
      >
        <div
          style={{
            color: "#00ff00",
            fontWeight: "bold",
            marginBottom: "4px",
            fontSize: "12px",
          }}
        >
          📍 MAP CENTER
        </div>
        {mapCenter ? (
          <div
            style={{
              color: "#cccccc",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>
              Lat:{" "}
              <span style={{ color: "#00ff00", fontWeight: "bold" }}>
                {mapCenter.lat.toFixed(6)}
              </span>
            </span>
            <span>
              Lng:{" "}
              <span style={{ color: "#00ff00", fontWeight: "bold" }}>
                {mapCenter.lng.toFixed(6)}
              </span>
            </span>
          </div>
        ) : (
          <div style={{ color: "#888888" }}>Initializing...</div>
        )}
      </div>

      {/* Header */}
      <div
        style={{
          color: "#00ff00",
          fontSize: "18px",
          fontWeight: "bold",
          marginBottom: "15px",
          textAlign: "center",
          paddingBottom: "10px",
          borderBottom: "2px solid rgba(0, 255, 0, 0.3)",
        }}
      >
        NETWORK MEMBERS
      </div>

      {/* Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "10px",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr
            style={{
              background: "rgba(0, 255, 0, 0.1)",
              borderBottom: "2px solid rgba(0, 255, 0, 0.3)",
            }}
          >
            {["Callsign", "ID", "Type", "Status", "Details"].map((header) => (
              <th
                key={header}
                style={{
                  padding: "6px 3px",
                  textAlign: "left",
                  color: "#00ff00",
                  fontWeight: "bold",
                  fontSize: "10px",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {membersWith102Data.map((member) => {
            const isExpanded = expandedRows.has(member.globalId);
            const acCategory = member.regionalData?.acCategory || "Unknown";
            const acType = member.regionalData?.acType || "";
            const acsStatus = member.battleGroupData?.acsStatus;
            const fuel = member.battleGroupData?.fuel;
            const combatEmergency = member.battleGroupData?.combatEmergency;
            const recoveryEmergency = member.regionalData?.recoveryEmergency;
            const masterArm = member.battleGroupData?.masterArmStatus;

            return (
              <React.Fragment key={member.globalId}>
                <tr
                  style={{
                    borderBottom: "1px solid rgba(100, 100, 100, 0.2)",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    background: isExpanded
                      ? "rgba(0, 255, 0, 0.1)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.background = "rgba(0, 255, 0, 0.1)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                  onClick={() => toggleDetails(member.globalId)}
                >
                  {/* Callsign */}
                  <td
                    style={{
                      padding: "6px 3px",
                      color: member.internalData?.isMotherAc
                        ? "#ffaa00"
                        : "#00ff00",
                      fontWeight: "bold",
                      fontSize: "10px",
                      maxWidth: "100px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {member.callsign || `ID${member.globalId}`}
                    {member.internalData?.isMotherAc && " ✈️"}
                  </td>

                  {/* ID */}
                  <td
                    style={{
                      padding: "6px 3px",
                      color: "#cccccc",
                      fontSize: "10px",
                    }}
                  >
                    {member.globalId}
                  </td>

                  {/* Type */}
                  <td
                    style={{
                      padding: "6px 3px",
                      color: "#cccccc",
                      fontSize: "9px",
                      maxWidth: "80px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {acCategory}
                    {acType ? `/${acType}` : ""}
                  </td>

                  {/* Status */}
                  <td
                    style={{
                      padding: "6px 3px",
                      display: "flex",
                      gap: "3px",
                      flexWrap: "wrap",
                      maxWidth: "100px",
                    }}
                  >
                    {acsStatus !== undefined && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "9px",
                          fontWeight: "bold",
                          background: getACSColor(acsStatus),
                          color: getACSTextColor(acsStatus),
                        }}
                      >
                        ACS
                      </span>
                    )}
                    {fuel !== undefined && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "9px",
                          fontWeight: "bold",
                          background: getFuelColor(fuel),
                          color: "#000",
                        }}
                      >
                        FUEL:{fuel.toFixed(0)}%
                      </span>
                    )}
                    {(combatEmergency || recoveryEmergency) && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "9px",
                          fontWeight: "bold",
                          background: "#ff0000",
                          color: "#fff",
                        }}
                      >
                        EMERG
                      </span>
                    )}
                    {masterArm !== undefined && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "9px",
                          fontWeight: "bold",
                          background: masterArm ? "#ff4400" : "#444",
                          color: "#fff",
                        }}
                      >
                        {masterArm ? "ARM" : "SAFE"}
                      </span>
                    )}
                  </td>

                  {/* Details Toggle */}
                  <td style={{ padding: "6px 3px", textAlign: "center" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDetails(member.globalId);
                      }}
                      style={{
                        width: "24px",
                        height: "24px",
                        background: "rgba(0, 255, 0, 0.2)",
                        border: "1px solid rgba(0, 255, 0, 0.5)",
                        color: "#00ff00",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: "14px",
                      }}
                    >
                      {isExpanded ? "−" : "+"}
                    </button>
                  </td>
                </tr>

                {/* Detail Row */}
                {isExpanded && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "12px",
                        background: "rgba(0, 0, 0, 0.3)",
                        borderTop: "1px solid rgba(0, 255, 0, 0.3)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr",
                          gap: "12px",
                          fontSize: "10px",
                        }}
                      >
                        {/* Radio Section */}
                        {member.radioData && (
                          <div
                            style={{
                              background: "rgba(0, 50, 0, 0.3)",
                              padding: "8px",
                              borderRadius: "4px",
                              border: "1px solid rgba(0, 255, 0, 0.2)",
                            }}
                          >
                            <div
                              style={{
                                color: "#00ff00",
                                fontWeight: "bold",
                                marginBottom: "8px",
                                fontSize: "11px",
                              }}
                            >
                              RADIO / NETWORK
                            </div>
                            {member.radioData.legacyFreq1 && (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: "4px",
                                  color: "#cccccc",
                                }}
                              >
                                <span>Legacy Freq 1:</span>
                                <span
                                  style={{
                                    color: "#00ff00",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {formatLegacyFreq(
                                    member.radioData.legacyFreq1
                                  )}
                                </span>
                              </div>
                            )}
                            {member.radioData.manetLNetId !== undefined && (
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginBottom: "4px",
                                  color: "#cccccc",
                                }}
                              >
                                <span>MANET L Net ID:</span>
                                <span
                                  style={{
                                    color: "#00ff00",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {member.radioData.manetLNetId}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Weapon Section */}
                        {member.battleGroupData?.weaponsData &&
                          member.battleGroupData.weaponsData.length > 0 && (
                            <div
                              style={{
                                background: "rgba(50, 0, 0, 0.3)",
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid rgba(255, 0, 0, 0.2)",
                              }}
                            >
                              <div
                                style={{
                                  color: "#ff4444",
                                  fontWeight: "bold",
                                  marginBottom: "8px",
                                  fontSize: "11px",
                                }}
                              >
                                WEAPON LOADOUT (
                                {member.battleGroupData.weaponsData.length})
                              </div>
                              {member.battleGroupData.weaponsData.map(
                                (weapon: any, idx: number) => (
                                  <div
                                    key={idx}
                                    style={{
                                      color: "#cccccc",
                                      fontSize: "9px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Weapon {idx + 1}: Code {weapon.code}, Value{" "}
                                    {weapon.value}
                                  </div>
                                )
                              )}
                            </div>
                          )}

                        {/* Sensor Section */}
                        {member.battleGroupData?.sensorsData &&
                          member.battleGroupData.sensorsData.length > 0 && (
                            <div
                              style={{
                                background: "rgba(0, 0, 50, 0.3)",
                                padding: "8px",
                                borderRadius: "4px",
                                border: "1px solid rgba(0, 0, 255, 0.2)",
                              }}
                            >
                              <div
                                style={{
                                  color: "#4488ff",
                                  fontWeight: "bold",
                                  marginBottom: "8px",
                                  fontSize: "11px",
                                }}
                              >
                                SENSORS (
                                {member.battleGroupData.sensorsData.length})
                              </div>
                              {member.battleGroupData.sensorsData.map(
                                (sensor: any, idx: number) => (
                                  <div
                                    key={idx}
                                    style={{
                                      color: "#cccccc",
                                      fontSize: "9px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    Sensor {idx + 1}: Code {sensor.code}, Value{" "}
                                    {sensor.value}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export { NetworkMembersTable };
export default NetworkMembersTable;
