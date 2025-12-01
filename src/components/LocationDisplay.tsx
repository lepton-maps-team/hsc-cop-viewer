import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

const LocationDisplay: React.FC = () => {
  const { getMapManager } = useStore();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    null
  );

  useEffect(() => {
    const updateCenter = () => {
      const mapManager = getMapManager();
      const mapCenter = mapManager?.getCenter();
      if (mapCenter) {
        setCenter(mapCenter);
      }
    };

    // Initial update
    updateCenter();

    // Listen for map center changes
    window.addEventListener("map-center-changed", updateCenter);

    return () => {
      window.removeEventListener("map-center-changed", updateCenter);
    };
  }, [getMapManager]);

  return (
    <div
      id="location-display"
      style={{
        position: "fixed",
        top: "10px",
        left: "10px",
        background: "rgba(0, 0, 0, 0.9)",
        color: "#00ff00",
        fontFamily: "monospace",
        fontSize: "12px",
        padding: "10px 15px",
        borderRadius: "4px",
        border: "1px solid #00ff00",
        zIndex: 250,
        minWidth: "250px",
        boxShadow: "0 0 10px rgba(0, 255, 0, 0.3)",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          marginBottom: "5px",
          color: "#00ff00",
        }}
      >
        📍 MAP CENTER
      </div>
      {center ? (
        <>
          <div style={{ color: "#ffffff" }}>
            Lat:{" "}
            <span style={{ color: "#00ff00" }}>{center.lat.toFixed(6)}</span>
          </div>
          <div style={{ color: "#ffffff" }}>
            Lng:{" "}
            <span style={{ color: "#00ff00" }}>{center.lng.toFixed(6)}</span>
          </div>
        </>
      ) : (
        <div style={{ color: "#888888" }}>Initializing...</div>
      )}
    </div>
  );
};

export default LocationDisplay;
