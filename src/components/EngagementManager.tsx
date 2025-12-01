import React, { useEffect, useRef, useState } from "react";
import { UDPDataPoint } from "./UDPNodesManager";
import mapboxgl from "mapbox-gl";
import { useStore } from "../store/useStore";

export type EngagementData = {
  globalId: number; // attacker
  engagementTargetGid: number; // target
  weaponLaunch: number;
  hangFire: number;
  tth: number; // time to hit
  tta: number; // time to arrival
  engagementTargetWeaponCode: number;
  dMax1: number; // max range 1
  dMax2: number; // max range 2
  dmin: number; // min range
  opcode: 103;
};

interface EngagementLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  engagement: EngagementData;
  attacker: UDPDataPoint;
  target: UDPDataPoint;
}

const EngagementManager: React.FC = () => {
  const { engagements, udpDataPoints, getMapManager } = useStore();
  const mapManager = getMapManager();
  const linesContainerRef = useRef<HTMLDivElement | null>(null);
  const [engagementLines, setEngagementLines] = useState<EngagementLine[]>([]);
  const [hoveredLineId, setHoveredLineId] = useState<string | null>(null);

  // Update engagement lines when engagements or map changes
  useEffect(() => {
    if (!mapManager || !linesContainerRef.current) return;

    const mapboxMap = mapManager.getMapboxMap();
    if (!mapboxMap) return;

    const updateLines = () => {
      const lines: EngagementLine[] = [];

      engagements.forEach((engagement) => {
        const attacker = udpDataPoints.get(engagement.globalId);
        const target = udpDataPoints.get(engagement.engagementTargetGid);

        if (
          !attacker ||
          !target ||
          !attacker.latitude ||
          !attacker.longitude ||
          !target.latitude ||
          !target.longitude
        ) {
          return;
        }

        const attackerPoint = mapboxMap.project([
          attacker.longitude,
          attacker.latitude,
        ]);
        const targetPoint = mapboxMap.project([
          target.longitude,
          target.latitude,
        ]);

        lines.push({
          id: `engagement-${engagement.globalId}-${engagement.engagementTargetGid}`,
          x1: attackerPoint.x,
          y1: attackerPoint.y,
          x2: targetPoint.x,
          y2: targetPoint.y,
          engagement,
          attacker,
          target,
        });
      });

      setEngagementLines(lines);
    };

    updateLines();

    // Update on map move/zoom
    const handleMove = () => updateLines();
    mapboxMap.on("move", handleMove);
    mapboxMap.on("zoom", handleMove);

    return () => {
      mapboxMap.off("move", handleMove);
      mapboxMap.off("zoom", handleMove);
    };
  }, [mapManager, engagements, udpDataPoints]);

  const createTooltip = (
    engagement: EngagementData,
    attacker: UDPDataPoint,
    target: UDPDataPoint
  ) => {
    const attackerCallsign = attacker.callsign || `ID${attacker.globalId}`;
    const targetCallsign = target.callsign || `ID${target.globalId}`;

    return (
      <div
        style={{
          position: "absolute",
          background: "rgba(0, 0, 0, 0.95)",
          border: "2px solid #ff4444",
          borderRadius: "6px",
          padding: "10px",
          color: "white",
          fontFamily: "monospace",
          fontSize: "11px",
          zIndex: 300,
          pointerEvents: "none",
          minWidth: "200px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.8)",
        }}
      >
        <div
          style={{
            color: "#ff4444",
            fontWeight: "bold",
            marginBottom: "8px",
            fontSize: "12px",
            textAlign: "center",
            borderBottom: "1px solid #ff4444",
            paddingBottom: "5px",
          }}
        >
          ⚔️ ENGAGEMENT
        </div>
        <div style={{ marginBottom: "6px" }}>
          <span style={{ color: "#ffaa00" }}>Attacker:</span>
          <span style={{ color: "#00ff00", fontWeight: "bold" }}>
            {attackerCallsign}
          </span>
          <span style={{ color: "#888" }}> ({attacker.globalId})</span>
        </div>
        <div style={{ marginBottom: "6px" }}>
          <span style={{ color: "#ffaa00" }}>Target:</span>
          <span style={{ color: "#ff4444", fontWeight: "bold" }}>
            {targetCallsign}
          </span>
          <span style={{ color: "#888" }}> ({target.globalId})</span>
        </div>
        <div
          style={{
            marginTop: "8px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#cccccc" }}>Weapon Launch:</span>
            <span
              style={{
                color: engagement.weaponLaunch ? "#00ff00" : "#888",
                fontWeight: "bold",
              }}
            >
              {engagement.weaponLaunch ? "YES" : "NO"}
            </span>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#cccccc" }}>Hang Fire:</span>
            <span
              style={{
                color: engagement.hangFire ? "#ff4400" : "#888",
                fontWeight: "bold",
              }}
            >
              {engagement.hangFire ? "YES" : "NO"}
            </span>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#cccccc" }}>TTH:</span>
            <span style={{ color: "#ffff00", fontWeight: "bold" }}>
              {engagement.tth}s
            </span>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#cccccc" }}>TTA:</span>
            <span style={{ color: "#ffff00", fontWeight: "bold" }}>
              {engagement.tta}s
            </span>
          </div>
          <div
            style={{
              marginTop: "6px",
              paddingTop: "6px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              style={{
                marginBottom: "2px",
                fontSize: "10px",
                color: "#888",
              }}
            >
              Ranges: dMax1=
              {isNaN(engagement.dMax1) ? "N/A" : engagement.dMax1.toFixed(2)}
              nm, dMax2=
              {isNaN(engagement.dMax2) ? "N/A" : engagement.dMax2.toFixed(2)}
              nm, dmin=
              {isNaN(engagement.dmin) ? "N/A" : engagement.dmin.toFixed(2)}nm
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={linesContainerRef}
      id="engagement-lines-container"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          {engagementLines.map((line) => (
            <marker
              key={`marker-${line.id}`}
              id={`arrow-${line.id}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#ff4444" />
            </marker>
          ))}
        </defs>
        {engagementLines.map((line) => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#ff4444"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.8"
            markerEnd={`url(#arrow-${line.id})`}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onMouseEnter={() => setHoveredLineId(line.id)}
            onMouseLeave={() => setHoveredLineId(null)}
          />
        ))}
      </svg>
      {engagementLines.map((line) => {
        if (hoveredLineId !== line.id) return null;
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;
        return (
          <div
            key={`tooltip-${line.id}`}
            style={{
              position: "absolute",
              left: `${midX}px`,
              top: `${midY - 60}px`,
            }}
          >
            {createTooltip(line.engagement, line.attacker, line.target)}
          </div>
        );
      })}
    </div>
  );
};

export default EngagementManager;
