import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { indianCitiesData } from "./text-layers";
import { MapManagerInstance, MapProps } from "./lib/types";

// Store mapManager in globalThis
declare global {
  interface Window {
    mapManager: MapManagerInstance | null;
    mapRef: mapboxgl.Map | null;
  }
}

const Map: React.FC<MapProps> = ({
  container,
  initialLat,
  initialLng,
  onMapReady,
}) => {
  const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const labelsContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const initialLatRef = useRef<number>(initialLat);
  const initialLngRef = useRef<number>(initialLng);
  const currentTileSourceRef = useRef<string>("/tiles-map/{z}/{x}/{y}.png");
  const mapManagerInstanceRef = useRef<MapManagerInstance | null>(null);

  const updateCityLabels = () => {
    if (!mapboxMapRef.current || !labelsContainerRef.current) return;

    const zoom = mapboxMapRef.current.getZoom();
    const minZoom = 8;

    labelsContainerRef.current.innerHTML = "";

    if (zoom < minZoom) {
      return;
    }

    const baseSize = 10;
    const sizeMultiplier = Math.max(1, (zoom - minZoom) / 2);
    const fontSize = Math.min(14, baseSize * sizeMultiplier);

    const bounds = mapboxMapRef.current.getBounds();
    const visibleCities = indianCitiesData.filter((city) => {
      return (
        city.longitude >= bounds.getWest() &&
        city.longitude <= bounds.getEast() &&
        city.latitude >= bounds.getSouth() &&
        city.latitude <= bounds.getNorth()
      );
    });

    visibleCities.forEach((city) => {
      const point = mapboxMapRef.current!.project([
        city.longitude,
        city.latitude,
      ]);

      const label = document.createElement("div");
      label.textContent = city.city;
      label.style.cssText = `
        position: absolute;
        left: ${point.x}px;
        top: ${point.y}px;
        color: #ffffff;
        font-family: Arial, sans-serif;
        font-size: ${fontSize}px;
        font-weight: 500;
        text-shadow: 
          -1px -1px 0 #000000,
          1px -1px 0 #000000,
          -1px 1px 0 #000000,
          1px 1px 0 #000000,
          0 0 2px #000000;
        white-space: nowrap;
        pointer-events: none;
        transform: translate(-50%, 0);
        z-index: 2;
      `;

      labelsContainerRef.current!.appendChild(label);
    });
  };

  const addCityLabels = () => {
    if (!mapboxMapRef.current || !labelsContainerRef.current) return;
    updateCityLabels();
    console.log(`🏙️ Added ${indianCitiesData.length} city labels to map`);
  };

  const initializeMap = (tileSource: string, lat: number, lng: number) => {
    if (!mapElementRef.current) {
      console.error("Cannot initialize map: map element not found");
      return;
    }

    // Set Mapbox access token
    mapboxgl.accessToken =
      "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

    mapboxMapRef.current = new mapboxgl.Map({
      container: mapElementRef.current,
      style: {
        version: 8,
        sources: {
          "local-tiles": {
            type: "raster",
            tiles: [tileSource],
            tileSize: 256,
            minzoom: 1,
            maxzoom: 13,
          },
        },
        layers: [
          {
            id: "local-tiles-layer",
            type: "raster",
            source: "local-tiles",
            paint: {
              "raster-opacity": 1.0,
            },
          },
        ],
      },
      center: [lng, lat],
      zoom: 7,
      maxZoom: 13,
      minZoom: 1,
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });

    // Expose mapRef in globalThis
    if (typeof window !== "undefined") {
      window.mapRef = mapboxMapRef.current;
    }

    mapboxMapRef.current.on("load", () => {
      console.log("🗺️ Mapbox GL map loaded successfully");
      addCityLabels();
      mapboxMapRef.current?.resize();
      mapboxMapRef.current?.triggerRepaint();
    });

    mapboxMapRef.current.on("moveend", () => {
      const event = new CustomEvent("map-center-changed");
      window.dispatchEvent(event);
      updateCityLabels();
    });

    mapboxMapRef.current.on("move", () => {
      const event = new CustomEvent("map-center-changed");
      window.dispatchEvent(event);
    });

    mapboxMapRef.current.on("zoomend", () => {
      const event = new CustomEvent("map-zoom-changed");
      window.dispatchEvent(event);
      updateCityLabels();
      if (mapboxMapRef.current) {
        mapboxMapRef.current.resize();
        mapboxMapRef.current.triggerRepaint();
      }
    });

    mapboxMapRef.current.on("zoom", () => {
      const event = new CustomEvent("map-zoom-changed");
      window.dispatchEvent(event);
      if (mapboxMapRef.current) {
        mapboxMapRef.current.triggerRepaint();
      }
    });

    mapboxMapRef.current.on("error", (e: any) => {
      if (
        e.error &&
        e.error.message &&
        e.error.message.includes("Could not load image")
      ) {
        return;
      }
      console.error("🗺️ Mapbox GL map error:", e);
    });

    mapboxMapRef.current.dragPan.disable();
    mapboxMapRef.current.scrollZoom.disable();
    mapboxMapRef.current.boxZoom.disable();
    mapboxMapRef.current.dragRotate.disable();
    mapboxMapRef.current.keyboard.disable();
    mapboxMapRef.current.doubleClickZoom.disable();
    mapboxMapRef.current.touchZoomRotate.disable();
  };

  useEffect(() => {
    if (!container) return;

    containerRef.current = container;

    // Create map container
    const mapContainer = document.createElement("div");
    mapContainer.id = "map-background";
    mapContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      opacity: 1;
      pointer-events: none;
      display: block;
      visibility: visible;
      transform: translateZ(0);
      will-change: transform;
      backface-visibility: hidden;
      -webkit-font-smoothing: antialiased;
    `;

    container.appendChild(mapContainer);
    mapElementRef.current = mapContainer;

    // Create container for HTML-based city labels
    const labelsContainer = document.createElement("div");
    labelsContainer.id = "city-labels-container";
    labelsContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    `;
    container.appendChild(labelsContainer);
    labelsContainerRef.current = labelsContainer;

    // Ensure container has minimum dimensions
    if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
      mapContainer.style.width = "100%";
      mapContainer.style.height = "100%";
      mapContainer.style.minWidth = "100px";
      mapContainer.style.minHeight = "100px";
    }

    // Initialize map
    currentTileSourceRef.current = "/tiles-map/{z}/{x}/{y}.png";
    initializeMap(
      currentTileSourceRef.current,
      initialLatRef.current,
      initialLngRef.current
    );

    // Create MapManager instance
    const mapManagerInstance: MapManagerInstance = {
      updateCenter: (lat: number, lng: number, zoom?: number) => {
        if (!mapboxMapRef.current) return;
        const jumpOptions: mapboxgl.CameraOptions = {
          center: [lng, lat],
        };
        if (typeof zoom === "number" && Number.isFinite(zoom)) {
          jumpOptions.zoom = zoom;
        }
        mapboxMapRef.current.jumpTo(jumpOptions);
      },
      getCenter: () => {
        if (!mapboxMapRef.current) return null;
        const center = mapboxMapRef.current.getCenter();
        return {
          lat: center.lat,
          lng: center.lng,
        };
      },
      getZoom: () => {
        if (!mapboxMapRef.current) return null;
        return mapboxMapRef.current.getZoom();
      },
      setZoom: (zoom: number) => {
        if (!mapboxMapRef.current) return;
        mapboxMapRef.current.setZoom(zoom);
      },
      getMapboxMap: () => mapboxMapRef.current,
      resize: () => {
        mapboxMapRef.current?.resize();
      },
      isMapVisible: () => {
        if (mapElementRef.current) {
          return (
            mapElementRef.current.style.visibility !== "hidden" &&
            mapElementRef.current.style.opacity !== "0"
          );
        }
        return false;
      },
      toggleMapVisibility: () => {
        if (mapElementRef.current) {
          const isVisible =
            mapManagerInstanceRef.current?.isMapVisible() || false;
          mapElementRef.current.style.visibility = isVisible
            ? "hidden"
            : "visible";
          mapElementRef.current.style.opacity = isVisible ? "0" : "1";
          if (mapboxMapRef.current) {
            setTimeout(() => {
              mapboxMapRef.current?.resize();
            }, 0);
          }
          return !isVisible;
        }
        return false;
      },
      updateMapSource: (tileSource: string) => {
        currentTileSourceRef.current = tileSource;
        if (!mapElementRef.current) {
          console.error("Cannot update map source: map element not found");
          return;
        }

        let currentCenter: [number, number] | null = null;
        let currentZoom: number | null = null;

        if (mapboxMapRef.current) {
          const center = mapboxMapRef.current.getCenter();
          currentCenter = [center.lng, center.lat];
          currentZoom = mapboxMapRef.current.getZoom();
          mapboxMapRef.current.remove();
          mapboxMapRef.current = null;
        }

        if (mapElementRef.current) {
          mapElementRef.current.innerHTML = "";
        }

        const lat = currentCenter ? currentCenter[1] : initialLatRef.current;
        const lng = currentCenter ? currentCenter[0] : initialLngRef.current;

        initializeMap(tileSource, lat, lng);

        if (currentZoom !== null && mapboxMapRef.current) {
          mapboxMapRef.current.setZoom(currentZoom);
        }

        console.log(`🗺️ Map reinitialized with new source: ${tileSource}`);
      },
      reinitializeInContainer: (newContainer: HTMLElement) => {
        let currentCenter: [number, number] | null = null;
        let currentZoom: number | null = null;

        if (mapboxMapRef.current) {
          const center = mapboxMapRef.current.getCenter();
          currentCenter = [center.lng, center.lat];
          currentZoom = mapboxMapRef.current.getZoom();
          mapboxMapRef.current.remove();
          mapboxMapRef.current = null;
        }

        containerRef.current = newContainer;

        const mapContainer = document.createElement("div");
        mapContainer.id = "map-background";
        mapContainer.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          opacity: 1;
          pointer-events: none;
          display: block;
          visibility: visible;
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
        `;

        newContainer.appendChild(mapContainer);
        mapElementRef.current = mapContainer;

        const labelsContainer = document.createElement("div");
        labelsContainer.id = "city-labels-container";
        labelsContainer.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 2;
        `;
        newContainer.appendChild(labelsContainer);
        labelsContainerRef.current = labelsContainer;

        if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
          mapContainer.style.width = "100%";
          mapContainer.style.height = "100%";
          mapContainer.style.minWidth = "100px";
          mapContainer.style.minHeight = "100px";
        }

        const lat = currentCenter ? currentCenter[1] : initialLatRef.current;
        const lng = currentCenter ? currentCenter[0] : initialLngRef.current;

        initializeMap(currentTileSourceRef.current, lat, lng);

        if (currentZoom !== null && mapboxMapRef.current) {
          mapboxMapRef.current.setZoom(currentZoom);
        }

        console.log(`🗺️ Map reinitialized in new container`);
      },
    };

    mapManagerInstanceRef.current = mapManagerInstance;

    // Store in globalThis
    if (typeof window !== "undefined") {
      window.mapManager = mapManagerInstance;
      window.mapRef = mapboxMapRef.current;
    }

    // Notify parent
    if (onMapReady) {
      onMapReady(mapManagerInstance);
    }

    return () => {
      if (mapboxMapRef.current) {
        mapboxMapRef.current.remove();
        mapboxMapRef.current = null;
      }
      if (mapElementRef.current && mapElementRef.current.parentNode) {
        mapElementRef.current.parentNode.removeChild(mapElementRef.current);
      }
      if (labelsContainerRef.current && labelsContainerRef.current.parentNode) {
        labelsContainerRef.current.parentNode.removeChild(
          labelsContainerRef.current
        );
      }
      // Clean up globalThis
      if (typeof window !== "undefined") {
        window.mapManager = null;
        window.mapRef = null;
      }
    };
  }, [container, onMapReady]);

  return null; // This component doesn't render anything directly
};

export default Map;
