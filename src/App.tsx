import React, { useEffect, useRef, useMemo } from "react";
import MapManager from "./components/MapManager";
import ThreatDialog from "./components/ThreatDialog";
import RightSidebar from "./components/RightSidebar";
import DebugInfo from "./components/DebugInfo";
import AdaptiveRadarCircles from "./components/AdaptiveRadarCircles";
import AircraftLayer from "./components/AircraftLayer";
import NetworkMembersTable from "./components/NetworkMembersTable";
import LocationDisplay from "./components/LocationDisplay";
import AircraftDetailsDialog from "./components/AircraftDetailsDialog";
import Notification from "./components/Notification";
import UDPNodesManager, {
  UDPDataPoint,
  getNetworkMembers,
} from "./components/UDPNodesManager";
import EngagementManager, {
  EngagementData,
} from "./components/EngagementManager";
import GeoMessageManager, {
  GeoMessageData,
} from "./components/GeoMessageManager";
import { useAircraftStore } from "./store/useAircraftStore";
import { useUIStore } from "./store/useUIStore";
import { useNotificationStore } from "./store/useNotificationStore";
import { useUDPStore } from "./store/useUDPStore";
import { useMapStore } from "./store/useMapStore";

const App: React.FC = () => {
  const { aircraft, nodeId } = useAircraftStore();
  const { centerMode, showThreatDialog, setZoomLevel } = useUIStore();
  const { selectedAircraft } = useAircraftStore();
  const { notification } = useNotificationStore();
  const { setNetworkMembers, setEngagements, setGeoMessages, processUDPData } =
    useUDPStore();
  const { getMapManager } = useMapStore();

  const visualizationAreaRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize components
  useEffect(() => {
    if (!containerRef.current) return;

    // Listen for UDP data from main process
    if (typeof window !== "undefined" && (window as any).udp) {
      (window as any).udp.onDataFromMain((data: UDPDataPoint[]) => {
        // Process UDP data through store
        processUDPData(data);

        // Update network members table (will be updated after processUDPData updates the store)
        setTimeout(() => {
          const currentPoints = useUDPStore.getState().udpDataPoints;
          const members = getNetworkMembers(currentPoints);
          setNetworkMembers(members);
        }, 0);

        // Handle opcode 103 engagement data
        const engagementData = data.filter(
          (point) => point.opcode === 103
        ) as unknown as EngagementData[];
        if (engagementData.length > 0) {
          setEngagements(engagementData);
        }

        // Handle opcode 122 geo-referenced messages
        const geoMessageData = data.filter(
          (point) => point.opcode === 122
        ) as GeoMessageData[];
        if (geoMessageData.length > 0) {
          setGeoMessages(geoMessageData);
        }
      });
    }

    // Handle window resize
    const handleResize = () => {
      const mapManager = getMapManager();
      if (mapManager) {
        mapManager.resize();
      }
    };
    window.addEventListener("resize", handleResize);

    // Listen for map center changes (UDPNodesManager component will handle updates via useEffect)
    const handleMapCenterChanged = () => {
      // UDPNodesManager component will handle updates via useEffect
    };
    window.addEventListener("map-center-changed", handleMapCenterChanged);

    // Listen for map zoom changes
    const handleMapZoomChanged = () => {
      const mapManager = getMapManager();
      const currentZoom = mapManager?.getZoom();
      if (typeof currentZoom === "number" && Number.isFinite(currentZoom)) {
        setZoomLevel(currentZoom);
      }
      // UDPNodesManager component will handle updates via useEffect
    };
    window.addEventListener("map-zoom-changed", handleMapZoomChanged);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("map-center-changed", handleMapCenterChanged);
      window.removeEventListener("map-zoom-changed", handleMapZoomChanged);
    };
  }, []);

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

  return (
    <div
      ref={containerRef}
      id="nodes-container"
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <RightSidebar />
      <DebugInfo />
      <LocationDisplay />
      <NetworkMembersTable />
      {centerAircraft && <ThreatDialog isVisible={showThreatDialog} />}
      {selectedAircraft && <AircraftDetailsDialog />}
      {notification && <Notification />}
      <div
        ref={visualizationAreaRef}
        id="visualization-area"
        style={{
          position: "relative",
          width: "calc(100% - 60px)",
          height: "calc(100vh - 60px)",
          background: "transparent",
          overflow: "hidden",
          margin: 0,
          padding: 0,
          marginRight: "60px",
          marginBottom: "60px",
          boxSizing: "border-box",
          cursor: "default",
          userSelect: "none",
        }}
      >
        {visualizationAreaRef.current && (
          <>
            <MapManager
              container={visualizationAreaRef.current}
              initialLat={20.5937}
              initialLng={78.9629}
              onMapReady={() => {
                // Map is ready, UDPNodesManager will handle updates via useEffect
              }}
            />
            <UDPNodesManager visualizationArea={visualizationAreaRef.current} />
          </>
        )}
        {centerAircraft && (
          <>
            <AdaptiveRadarCircles />
            <AircraftLayer />
            <EngagementManager />
            <GeoMessageManager />
          </>
        )}
      </div>
    </div>
  );
};

export default App;
