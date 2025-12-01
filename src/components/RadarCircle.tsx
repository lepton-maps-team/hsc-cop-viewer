import React from "react";
import { RadarCircleProps } from "../lib/types";

const RadarCircle: React.FC<RadarCircleProps> = ({
  rangeNM,
  radius,
  minDimension,
}) => {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
          marginTop: `-${radius}px`,
          marginLeft: `-${radius}px`,
          border: "2px solid #00ff00",
          borderRadius: "50%",
          pointerEvents: "none",
          boxSizing: "border-box",
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${50 + (radius / minDimension) * 100}%`,
          color: "#00ff00",
          fontFamily: "monospace",
          fontSize: "10px",
          background: "rgba(0, 0, 0, 0.7)",
          padding: "2px 4px",
          borderRadius: "2px",
          transform: "translateY(-50%)",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {Math.round(rangeNM)}NM
      </div>
    </>
  );
};

export default RadarCircle;

