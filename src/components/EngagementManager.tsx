import React, { useEffect, useMemo } from "react";
import { LineLayer } from "@deck.gl/layers";
import { useUDPStore } from "../store/useUDPStore";
import { useLayerStore } from "../store/useLayerStore";
import { EngagementData, UDPDataPoint } from "../lib/types";

export type { EngagementData };

const EngagementManager: React.FC = () => {
  const { engagements, udpDataPoints } = useUDPStore();
  const { addLayer, removeLayer } = useLayerStore();

  const engagementLines = useMemo(() => {
    const lines: Array<{
      sourcePosition: [number, number];
      targetPosition: [number, number];
      engagement: EngagementData;
      attacker: UDPDataPoint;
      target: UDPDataPoint;
    }> = [];

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

      lines.push({
        sourcePosition: [attacker.longitude, attacker.latitude],
        targetPosition: [target.longitude, target.latitude],
        engagement,
        attacker,
        target,
      });
    });

    return lines;
  }, [engagements, udpDataPoints]);

  useEffect(() => {
    if (engagementLines.length === 0) {
      removeLayer("engagement-lines");
      return;
    }

    const layer = new LineLayer({
      id: "engagement-lines",
      data: engagementLines,
      getSourcePosition: (d: any) => d.sourcePosition,
      getTargetPosition: (d: any) => d.targetPosition,
      getColor: [255, 68, 68, 200],
      getWidth: 2,
      widthMinPixels: 2,
      widthMaxPixels: 4,
      pickable: true,
      onClick: (info: any) => {
        if (info.object) {
          const { engagement, attacker, target } = info.object;
          const attackerCallsign =
            attacker.callsign || `ID${attacker.globalId}`;
          const targetCallsign = target.callsign || `ID${target.globalId}`;
          console.log(`Engagement: ${attackerCallsign} -> ${targetCallsign}`);
        }
      },
    });

    addLayer(layer);

    return () => {
      removeLayer("engagement-lines");
    };
  }, [engagementLines, addLayer, removeLayer]);

  return null;
};

export default EngagementManager;
