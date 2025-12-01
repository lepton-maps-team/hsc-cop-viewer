import { useEffect, useRef, useState } from "react";
import { MapManager } from "../map";

interface UseMapManagerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  defaultLat?: number;
  defaultLng?: number;
  onNodesCenterCalculated?: (
    center: { lat: number; lng: number } | null
  ) => void;
}

export const useMapManager = ({
  containerRef,
  defaultLat = 20.5937,
  defaultLng = 78.9629,
  onNodesCenterCalculated,
}: UseMapManagerProps) => {
  const mapManagerRef = useRef<MapManager | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(5);

  useEffect(() => {
    if (!containerRef.current) return;

    const calculateInitialCenter = () => {
      if (onNodesCenterCalculated) {
        // This will be called from parent when UDP nodes are available
        return null;
      }
      return { lat: defaultLat, lng: defaultLng };
    };

    const initialCenter = calculateInitialCenter();
    const lat = initialCenter?.lat || defaultLat;
    const lng = initialCenter?.lng || defaultLng;

    if (!mapManagerRef.current) {
      mapManagerRef.current = new MapManager(containerRef.current, lat, lng);

      // Listen for zoom changes
      mapManagerRef.current.getMapboxMap()?.on("zoom", () => {
        const currentZoom = mapManagerRef.current?.getZoom();
        if (typeof currentZoom === "number" && Number.isFinite(currentZoom)) {
          setZoomLevel(currentZoom);
        }
      });
    }

    return () => {
      // Cleanup if needed
    };
  }, [containerRef, defaultLat, defaultLng, onNodesCenterCalculated]);

  return { mapManagerRef, zoomLevel, setZoomLevel };
};
