import React, { useEffect, useRef, useMemo } from "react";
import { useStore } from "../store/useStore";

const AdaptiveRadarCircles: React.FC = () => {
  const { aircraft, zoomLevel, centerMode, nodeId, convertToCartesian } =
    useStore();
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!centerAircraft || !containerRef.current) return;

    // Clear existing circles
    containerRef.current.innerHTML = "";

    let maxDistance = 0;
    aircraft.forEach((ac, id) => {
      if (id === centerAircraft.id) return;

      const relativeLat = ac.lat - centerAircraft.lat;
      const relativeLng = ac.lng - centerAircraft.lng;
      const cartesianCoords = convertToCartesian(
        relativeLat,
        relativeLng,
        zoomLevel
      );

      const distance = Math.sqrt(
        cartesianCoords.x * cartesianCoords.x +
          cartesianCoords.y * cartesianCoords.y
      );
      maxDistance = Math.max(maxDistance, Math.abs(distance));
    });

    console.log(
      `📡 Maximum aircraft distance: ${maxDistance.toFixed(2)} units`
    );

    const minRadarRange = 20;
    const bufferFactor = 1.5;
    const adaptiveRange = Math.max(minRadarRange, maxDistance * bufferFactor);
    const viewportWidth = window.innerWidth - 60;
    const viewportHeight = window.innerHeight - 60;
    const minDimension = Math.min(viewportWidth, viewportHeight);

    const numCircles = 3;

    for (let i = 1; i <= numCircles; i++) {
      const circle = document.createElement("div");

      const rangeRatio = adaptiveRange / 50;
      const baseRadius = i * ((minDimension * 0.35 * rangeRatio) / numCircles);
      const radius = baseRadius / zoomLevel;

      const minRadius = 30;
      const maxRadius = minDimension * 0.4;
      const clampedRadius = Math.max(minRadius, Math.min(maxRadius, radius));

      circle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: ${clampedRadius * 2}px;
        height: ${clampedRadius * 2}px;
        margin-top: -${clampedRadius}px;
        margin-left: -${clampedRadius}px;
        border: 2px solid #00ff00;
        border-radius: 50%;
        pointer-events: none;
        box-sizing: border-box;
        opacity: 0.7;
      `;

      const rangeLabel = document.createElement("div");
      const estimatedNM = Math.round((clampedRadius / minDimension) * 400);
      rangeLabel.textContent = `${estimatedNM}NM`;
      rangeLabel.style.cssText = `
        position: absolute;
        top: 50%;
        left: ${50 + (clampedRadius / minDimension) * 100}%;
        color: #00ff00;
        font-family: monospace;
        font-size: 10px;
        background: rgba(0, 0, 0, 0.7);
        padding: 2px 4px;
        border-radius: 2px;
        transform: translateY(-50%);
        z-index: 2;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      `;

      containerRef.current.appendChild(circle);
      containerRef.current.appendChild(rangeLabel);

      console.log(
        `📡 Created radar circle ${i}: radius=${clampedRadius.toFixed(1)}px, range≈${estimatedNM}NM`
      );
    }
  }, [centerAircraft, aircraft, zoomLevel, convertToCartesian]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
};

export { AdaptiveRadarCircles };
export default AdaptiveRadarCircles;
