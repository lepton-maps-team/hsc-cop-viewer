import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { indianCitiesData } from "./lib/text-layers";
import { MapManagerInstance, MapProps } from "./lib/types";

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
  const mapElementRef = useRef<HTMLDivElement | null>(null);

  const updateCityLabels = () => {
    const mapboxMap = window.mapRef;
    if (!mapboxMap) return;

    const zoom = mapboxMap.getZoom();
    const minZoom = 8;

    // Remove all existing markers from the map
    const markers = mapboxMap
      .getContainer()
      .querySelectorAll(".mapboxgl-marker");
    markers.forEach((marker) => marker.remove());

    if (zoom < minZoom) {
      return;
    }

    const baseSize = 10;
    const sizeMultiplier = Math.max(1, (zoom - minZoom) / 2);
    const fontSize = Math.min(14, baseSize * sizeMultiplier);

    const bounds = mapboxMap.getBounds();
    const visibleCities = indianCitiesData.filter((city) => {
      return (
        city.longitude >= bounds.getWest() &&
        city.longitude <= bounds.getEast() &&
        city.latitude >= bounds.getSouth() &&
        city.latitude <= bounds.getNorth()
      );
    });

    visibleCities.forEach((city) => {
      const el = document.createElement("div");
      el.textContent = city.city;
      el.style.cssText = `
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
      `;

      new mapboxgl.Marker({
        element: el,
        anchor: "left",
      })
        .setLngLat([city.longitude, city.latitude])
        .addTo(mapboxMap);
    });
  };

  const addCityLabels = () => {
    if (!window.mapRef) return;
    updateCityLabels();
    console.log(`🏙️ Added city labels to map`);
  };

  const initializeMap = (tileSource: string, lat: number, lng: number) => {
    if (!mapElementRef.current) {
      console.error("Cannot initialize map: map element not found");
      return;
    }

    // Set Mapbox access token
    mapboxgl.accessToken =
      "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

    // Create map and store in globalThis
    window.mapRef = new mapboxgl.Map({
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

    window.mapRef.on("load", () => {
      console.log("🗺️ Mapbox GL map loaded successfully");
      addCityLabels();
      window.mapRef?.resize();
      window.mapRef?.triggerRepaint();
    });

    window.mapRef.on("moveend", () => {
      const event = new CustomEvent("map-center-changed");
      window.dispatchEvent(event);
      updateCityLabels();
    });

    window.mapRef.on("move", () => {
      const event = new CustomEvent("map-center-changed");
      window.dispatchEvent(event);
    });

    window.mapRef.on("zoomend", () => {
      const event = new CustomEvent("map-zoom-changed");
      window.dispatchEvent(event);
      updateCityLabels();
      if (window.mapRef) {
        window.mapRef.resize();
        window.mapRef.triggerRepaint();
      }
    });

    window.mapRef.on("zoom", () => {
      const event = new CustomEvent("map-zoom-changed");
      window.dispatchEvent(event);
      if (window.mapRef) {
        window.mapRef.triggerRepaint();
      }
    });

    window.mapRef.on("error", (e: any) => {
      if (
        e.error &&
        e.error.message &&
        e.error.message.includes("Could not load image")
      ) {
        return;
      }
      console.error("🗺️ Mapbox GL map error:", e);
    });

    window.mapRef.dragPan.disable();
    window.mapRef.scrollZoom.disable();
    window.mapRef.boxZoom.disable();
    window.mapRef.dragRotate.disable();
    window.mapRef.keyboard.disable();
    window.mapRef.doubleClickZoom.disable();
    window.mapRef.touchZoomRotate.disable();
  };

  useEffect(() => {
    if (!container || !mapElementRef.current) return;

    // Ensure container has minimum dimensions
    if (
      mapElementRef.current.clientWidth === 0 ||
      mapElementRef.current.clientHeight === 0
    ) {
      mapElementRef.current.style.width = "100%";
      mapElementRef.current.style.height = "100%";
      mapElementRef.current.style.minWidth = "100px";
      mapElementRef.current.style.minHeight = "100px";
    }

    // Initialize map
    const tileSource = "/tiles-map/{z}/{x}/{y}.png";
    initializeMap(tileSource, initialLat, initialLng);

    // Create MapManager instance
    const mapManagerInstance: MapManagerInstance = {
      updateCenter: (lat: number, lng: number, zoom?: number) => {
        if (!window.mapRef) return;
        const jumpOptions: mapboxgl.CameraOptions = {
          center: [lng, lat],
        };
        if (typeof zoom === "number" && Number.isFinite(zoom)) {
          jumpOptions.zoom = zoom;
        }
        window.mapRef.jumpTo(jumpOptions);
      },
      getCenter: () => {
        if (!window.mapRef) return null;
        const center = window.mapRef.getCenter();
        return {
          lat: center.lat,
          lng: center.lng,
        };
      },
      getZoom: () => {
        if (!window.mapRef) return null;
        return window.mapRef.getZoom();
      },
      setZoom: (zoom: number) => {
        if (!window.mapRef) return;
        window.mapRef.setZoom(zoom);
      },
      getMapboxMap: () => window.mapRef,
      resize: () => {
        window.mapRef?.resize();
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
            mapElementRef.current.style.visibility !== "hidden" &&
            mapElementRef.current.style.opacity !== "0";
          mapElementRef.current.style.visibility = isVisible
            ? "hidden"
            : "visible";
          mapElementRef.current.style.opacity = isVisible ? "0" : "1";
          if (window.mapRef) {
            setTimeout(() => {
              window.mapRef?.resize();
            }, 0);
          }
          return !isVisible;
        }
        return false;
      },
      updateMapSource: (tileSource: string) => {
        if (!mapElementRef.current) {
          console.error("Cannot update map source: map element not found");
          return;
        }

        let currentCenter: [number, number] | null = null;
        let currentZoom: number | null = null;

        if (window.mapRef) {
          const center = window.mapRef.getCenter();
          currentCenter = [center.lng, center.lat];
          currentZoom = window.mapRef.getZoom();
          window.mapRef.remove();
          window.mapRef = null;
        }

        if (mapElementRef.current) {
          mapElementRef.current.innerHTML = "";
        }

        const lat = currentCenter ? currentCenter[1] : initialLat;
        const lng = currentCenter ? currentCenter[0] : initialLng;

        initializeMap(tileSource, lat, lng);

        if (currentZoom !== null && window.mapRef) {
          window.mapRef.setZoom(currentZoom);
        }

        console.log(`🗺️ Map reinitialized with new source: ${tileSource}`);
      },
      reinitializeInContainer: (newContainer: HTMLElement) => {
        let currentCenter: [number, number] | null = null;
        let currentZoom: number | null = null;

        if (window.mapRef) {
          const center = window.mapRef.getCenter();
          currentCenter = [center.lng, center.lat];
          currentZoom = window.mapRef.getZoom();
          window.mapRef.remove();
          window.mapRef = null;
        }

        // Note: This function is kept for backward compatibility
        // but the map container is now managed by React
        if (mapElementRef.current && newContainer !== container) {
          // If container changed, we'd need to handle it differently
          // For now, we'll just reinitialize in the current container
          console.warn(
            "reinitializeInContainer: Container change not fully supported with React refs"
          );
        }

        const lat = currentCenter ? currentCenter[1] : initialLat;
        const lng = currentCenter ? currentCenter[0] : initialLng;

        if (mapElementRef.current) {
          const tileSource = "/tiles-map/{z}/{x}/{y}.png";
          initializeMap(tileSource, lat, lng);

          if (currentZoom !== null && window.mapRef) {
            window.mapRef.setZoom(currentZoom);
          }
        }

        console.log(`🗺️ Map reinitialized in new container`);
      },
    };

    // Store in globalThis
    if (typeof window !== "undefined") {
      window.mapManager = mapManagerInstance;
    }

    // Notify parent
    if (onMapReady) {
      onMapReady(mapManagerInstance);
    }

    return () => {
      // Remove city labels
      if (window.mapRef) {
        const markers = window.mapRef
          .getContainer()
          .querySelectorAll(".mapboxgl-marker");
        markers.forEach((marker) => marker.remove());

        window.mapRef.remove();
        window.mapRef = null;
      }
      // Clean up globalThis
      if (typeof window !== "undefined") {
        window.mapManager = null;
      }
    };
  }, [container, onMapReady]);

  if (!container) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        opacity: 1,
        pointerEvents: "none",
        display: "block",
        visibility: "visible",
        transform: "translateZ(0)",
        willChange: "transform",
        backfaceVisibility: "hidden",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        ref={mapElementRef}
        id="map-background"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      />
    </div>
  );
};

export default Map;
