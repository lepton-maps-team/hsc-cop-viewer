import React from "react";
import { useStore } from "../store/useStore";

const RightSidebar: React.FC = () => {
  const {
    viewMode,
    zoomLevel,
    showOtherNodes,
    centerMode,
    setViewMode,
    toggleShowOtherNodes,
    toggleCenterMode,
    toggleShowThreatDialog,
    toggleMapVisibility,
    getMapManager,
  } = useStore();

  const mapManager = getMapManager();
  const isMapVisible = mapManager?.getMapboxMap() ? true : false;

  const zoomIn = () => {
    const currentZoom = useStore.getState().zoomLevel;
    const newZoom = Math.min(currentZoom + 1, 13);
    useStore.getState().zoomIn();
    const mapMgr = getMapManager();
    if (mapMgr) {
      const center = mapMgr.getCenter();
      if (center) {
        mapMgr.updateCenter(center.lat, center.lng, newZoom);
      } else {
        mapMgr.setZoom(newZoom);
      }
    }
  };

  const zoomOut = () => {
    const currentZoom = useStore.getState().zoomLevel;
    if (currentZoom <= 1) return;
    const newZoom = Math.max(currentZoom - 1, 1);
    useStore.getState().zoomOut();
    const mapMgr = getMapManager();
    if (mapMgr) {
      const center = mapMgr.getCenter();
      if (center) {
        mapMgr.updateCenter(center.lat, center.lng, newZoom);
      } else {
        mapMgr.setZoom(newZoom);
      }
    }
  };

  const buttonStyle = {
    width: "40px",
    height: "30px",
    color: "white",
    border: "1.5px solid rgba(100, 100, 120, 0.6)",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: "10px",
    fontWeight: "bold",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
  } as React.CSSProperties;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: "60px",
        height: "100vh",
        background: "rgba(20, 20, 30, 0.95)",
        borderLeft: "2px solid rgba(100, 100, 120, 0.8)",
        boxShadow: "-2px 0 10px rgba(0, 0, 0, 0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 0",
        gap: "10px",
        zIndex: 100,
        transform: "translateZ(0)",
        isolation: "isolate",
      }}
    >
      <button
        data-view-mode="101"
        onClick={() => setViewMode("normal")}
        style={{
          ...buttonStyle,
          background:
            viewMode === "normal" ? "#44ff44" : "rgba(60, 60, 70, 0.9)",
          borderColor:
            viewMode === "normal" ? "#66ff66" : "rgba(100, 100, 120, 0.6)",
          marginBottom: "5px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        101
      </button>

      <button
        data-view-mode="102"
        onClick={() => setViewMode("self-only")}
        style={{
          ...buttonStyle,
          background:
            viewMode === "self-only" ? "#ff8844" : "rgba(60, 60, 70, 0.9)",
          borderColor:
            viewMode === "self-only" ? "#ffaa66" : "rgba(100, 100, 120, 0.6)",
          marginBottom: "10px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        102
      </button>

      <button
        onClick={zoomOut}
        style={{
          ...buttonStyle,
          background: "rgba(60, 60, 70, 0.9)",
          fontSize: "16px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(80, 80, 90, 0.95)";
          e.currentTarget.style.borderColor = "rgba(120, 120, 140, 0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(60, 60, 70, 0.9)";
          e.currentTarget.style.borderColor = "rgba(100, 100, 120, 0.6)";
        }}
      >
        −
      </button>

      <div
        style={{
          color: "#ffffff",
          fontFamily: "monospace",
          fontSize: "10px",
          fontWeight: "bold",
          textAlign: "center",
          minWidth: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
          background: "rgba(40, 40, 50, 0.5)",
          padding: "4px 6px",
          borderRadius: "4px",
        }}
      >
        {zoomLevel}
      </div>

      <button
        onClick={zoomIn}
        style={{
          ...buttonStyle,
          background: "rgba(60, 60, 70, 0.9)",
          fontSize: "16px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(80, 80, 90, 0.95)";
          e.currentTarget.style.borderColor = "rgba(120, 120, 140, 0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(60, 60, 70, 0.9)";
          e.currentTarget.style.borderColor = "rgba(100, 100, 120, 0.6)";
        }}
      >
        +
      </button>

      <button
        onClick={toggleMapVisibility}
        style={{
          ...buttonStyle,
          background: isMapVisible ? "#4488ff" : "rgba(60, 60, 70, 0.9)",
          borderColor: isMapVisible ? "#66aaff" : "rgba(100, 100, 120, 0.6)",
          fontSize: "8px",
          marginTop: "5px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        MAP
      </button>

      <button
        onClick={toggleCenterMode}
        style={{
          ...buttonStyle,
          background: centerMode === "mother" ? "#4488ff" : "#ff8844",
          borderColor: centerMode === "mother" ? "#66aaff" : "#ffaa66",
          fontSize: "8px",
          marginTop: "5px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        {centerMode === "mother" ? "MTR" : "SELF"}
      </button>

      <button
        onClick={toggleShowThreatDialog}
        style={{
          ...buttonStyle,
          background: "rgba(60, 60, 70, 0.9)",
          fontSize: "8px",
          marginTop: "5px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        THRT
      </button>

      <button
        onClick={toggleShowOtherNodes}
        style={{
          ...buttonStyle,
          background: showOtherNodes ? "#ff4444" : "#44ff44",
          borderColor: showOtherNodes ? "#ff6666" : "#66ff66",
          fontSize: "8px",
          marginTop: "5px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        {showOtherNodes ? "HIDE" : "SHOW"}
      </button>
    </div>
  );
};

export { RightSidebar };
export default RightSidebar;
