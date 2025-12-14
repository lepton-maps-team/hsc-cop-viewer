import React, { useEffect, useMemo } from "react";
import { IconLayer, TextLayer } from "@deck.gl/layers";
import { useUDPStore } from "../store/useUDPStore";
import { useLayerStore } from "../store/useLayerStore";
import { GeoMessageData } from "../lib/types";

export type { GeoMessageData };

const GeoMessageManager: React.FC = () => {
  const { geoMessages } = useUDPStore();
  const { addLayer, removeLayer } = useLayerStore();

  const getColorAndIcon = (
    action: number,
    geoType: number
  ): { color: [number, number, number, number]; icon: string } => {
    let color: [number, number, number, number] = [0, 255, 0, 255];
    let icon = "●";

    switch (geoType) {
      case 0:
        icon = "◆";
        color = [0, 255, 0, 255];
        break;
      case 1:
        icon = "▲";
        color = [255, 255, 0, 255];
        break;
      case 2:
        icon = "■";
        color = [255, 68, 0, 255];
        break;
      case 3:
        icon = "★";
        color = [255, 0, 255, 255];
        break;
      case 4:
        icon = "◉";
        color = [0, 255, 255, 255];
        break;
      default:
        icon = "●";
        color = [0, 255, 0, 255];
    }

    return { color, icon };
  };

  const messageData = useMemo(() => {
    return geoMessages.map((message: GeoMessageData) => {
      const { color, icon } = getColorAndIcon(message.source, message.geoType);
      return {
        position: [message.longitude, message.latitude] as [number, number],
        icon,
        color,
        messageId: message.messageId,
        senderGid: message.senderGid,
        altitude: message.altitude,
      };
    });
  }, [geoMessages]);

  useEffect(() => {
    if (messageData.length === 0) {
      removeLayer("geo-messages-icons");
      removeLayer("geo-messages-labels");
      return;
    }

    const iconLayer = new IconLayer({
      id: "geo-messages-icons",
      data: messageData,
      getIcon: (d: any) => ({
        url: `data:image/svg+xml;base64,${btoa(
          `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <text x="12" y="18" font-size="16" text-anchor="middle" fill="${d.color.map((c: number) => c / 255).join(",")}">${d.icon}</text>
          </svg>`
        )}`,
        width: 24,
        height: 24,
      }),
      getPosition: (d: any) => d.position,
      getColor: (d: any) => d.color,
      getSize: 24,
      sizeScale: 1,
      sizeMinPixels: 20,
      sizeMaxPixels: 30,
      pickable: true,
    });

    const textLayer = new TextLayer({
      id: "geo-messages-labels",
      data: messageData,
      getPosition: (d: any) => d.position,
      getText: (d: any) => `MSG ${d.messageId}`,
      getColor: [255, 255, 255, 255],
      getSize: 10,
      getAngle: 0,
      getTextAnchor: "middle",
      getAlignmentBaseline: "top",
      fontFamily: "Arial, sans-serif",
      outlineWidth: 1,
      outlineColor: [0, 0, 0, 255],
      sizeScale: 1,
      sizeMinPixels: 8,
      sizeMaxPixels: 12,
    });

    addLayer(iconLayer);
    addLayer(textLayer);

    return () => {
      removeLayer("geo-messages-icons");
      removeLayer("geo-messages-labels");
    };
  }, [messageData, addLayer, removeLayer]);

  return null;
};

export default GeoMessageManager;
