import mapboxgl from "mapbox-gl";
import { indianCitiesData } from "./text-layers";

export type Aircraft = {
  id: string;
  lat: number;
  lng: number;
  callSign: string;
  aircraftType: "mother" | "friendly" | "threat" | "self";
  isLocked?: boolean;
  isExecuted?: boolean;
};

/**
 * MapManager: Simple map manager for displaying map tiles.
 */
export class MapManager {
  private mapboxMap: mapboxgl.Map | null = null;
  private mapElement: HTMLElement | null = null;
  private labelsContainer: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private initialLat: number = 0;
  private initialLng: number = 0;
  private currentTileSource: string = "/tiles-map/{z}/{x}/{y}.png";

  /**
   * Constructor: Creates and adds the map to the document.
   */
  constructor(container: HTMLElement, lat: number, lng: number) {
    this.container = container;
    this.initialLat = lat;
    this.initialLng = lng;

    // Set Mapbox access token
    mapboxgl.accessToken =
      "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

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
    this.mapElement = mapContainer;

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
    this.labelsContainer = labelsContainer;

    // Ensure container has minimum dimensions
    if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
      mapContainer.style.width = "100%";
      mapContainer.style.height = "100%";
      mapContainer.style.minWidth = "100px";
      mapContainer.style.minHeight = "100px";
    }

    // Initialize map with default tile source
    this.currentTileSource = "/tiles-map/{z}/{x}/{y}.png";
    this.initializeMap(this.currentTileSource, lat, lng);
  }

  public updateCenter(lat: number, lng: number, zoom?: number): void {
    if (!this.mapboxMap) return;
    const jumpOptions: mapboxgl.CameraOptions = {
      center: [lng, lat],
    };
    if (typeof zoom === "number" && Number.isFinite(zoom)) {
      jumpOptions.zoom = zoom;
    }
    this.mapboxMap.jumpTo(jumpOptions);
  }

  /**
   * Get current center of the map.
   */
  public getCenter(): { lat: number; lng: number } | null {
    if (!this.mapboxMap) return null;
    const center = this.mapboxMap.getCenter();
    return {
      lat: center.lat,
      lng: center.lng,
    };
  }

  /**
   * Get current zoom level of the map.
   */
  public getZoom(): number | null {
    if (!this.mapboxMap) return null;
    return this.mapboxMap.getZoom();
  }

  /**
   * Set zoom level of the map.
   */
  public setZoom(zoom: number): void {
    if (!this.mapboxMap) return;
    this.mapboxMap.setZoom(zoom);
  }

  /**
   * Get the mapbox map instance (for resize, etc.).
   */
  public getMapboxMap(): mapboxgl.Map | null {
    return this.mapboxMap;
  }

  /**
   * Resize the map.
   */
  public resize(): void {
    this.mapboxMap?.resize();
  }

  /**
   * Check if map is currently visible.
   */
  public isMapVisible(): boolean {
    if (this.mapElement) {
      return (
        this.mapElement.style.visibility !== "hidden" &&
        this.mapElement.style.opacity !== "0"
      );
    }
    return false;
  }

  /**
   * Toggle map visibility.
   * Uses visibility: hidden instead of display: none to preserve map dimensions
   * so that node projections continue to work correctly.
   */
  public toggleMapVisibility(): boolean {
    if (this.mapElement) {
      const isVisible = this.isMapVisible();
      this.mapElement.style.visibility = isVisible ? "hidden" : "visible";
      this.mapElement.style.opacity = isVisible ? "0" : "1";
      // Ensure map can still calculate projections even when hidden
      if (this.mapboxMap) {
        // Trigger a resize to ensure map maintains dimensions
        setTimeout(() => {
          this.mapboxMap?.resize();
        }, 0);
      }
      return !isVisible;
    }
    return false;
  }

  /**
   * Add city labels as HTML overlays to the map (offline-compatible).
   */
  private addCityLabels(): void {
    if (!this.mapboxMap || !this.labelsContainer) return;
    this.updateCityLabels();
    console.log(`🏙️ Added ${indianCitiesData.length} city labels to map`);
  }

  /**
   * Update city labels position and visibility based on zoom level.
   */
  private updateCityLabels(): void {
    if (!this.mapboxMap || !this.labelsContainer) return;

    const zoom = this.mapboxMap.getZoom();
    const minZoom = 8; // Show labels at zoom 8 and above

    // Clear existing labels
    this.labelsContainer.innerHTML = "";

    // Only show labels at appropriate zoom level
    if (zoom < minZoom) {
      return;
    }

    // Calculate text size based on zoom
    const baseSize = 10;
    const sizeMultiplier = Math.max(1, (zoom - minZoom) / 2);
    const fontSize = Math.min(14, baseSize * sizeMultiplier);

    // Get map bounds to filter visible cities
    const bounds = this.mapboxMap.getBounds();
    const visibleCities = indianCitiesData.filter((city) => {
      return (
        city.longitude >= bounds.getWest() &&
        city.longitude <= bounds.getEast() &&
        city.latitude >= bounds.getSouth() &&
        city.latitude <= bounds.getNorth()
      );
    });

    // Create label elements for visible cities
    visibleCities.forEach((city) => {
      const point = this.mapboxMap!.project([city.longitude, city.latitude]);

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

      this.labelsContainer!.appendChild(label);
    });
  }

  /**
   * Initialize the map with a given tile source.
   * @param tileSource - The tile source URL pattern (e.g., "/tiles-map/{z}/{x}/{y}.png" or "maptiles://{z}/{x}/{y}.png")
   * @param lat - Initial latitude
   * @param lng - Initial longitude
   */
  private initializeMap(tileSource: string, lat: number, lng: number): void {
    if (!this.mapElement) {
      console.error("Cannot initialize map: map element not found");
      return;
    }

    this.mapboxMap = new mapboxgl.Map({
      container: this.mapElement,
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

    // Wait for map to load
    this.mapboxMap.on("load", () => {
      console.log("🗺️ Mapbox GL map loaded successfully");
      this.addCityLabels();
      // Resize and repaint immediately
      this.mapboxMap?.resize();
      this.mapboxMap?.triggerRepaint();
    });

    // Listen for map move events to update location display and labels
    this.mapboxMap.on("moveend", () => {
      const event = new CustomEvent("map-center-changed");
      window.dispatchEvent(event);
      this.updateCityLabels();
    });

    // Listen for map move events (including during movement)
    this.mapboxMap.on("move", () => {
      const event = new CustomEvent("map-center-changed");
      window.dispatchEvent(event);
    });

    // Listen for zoom changes to update zoom display and labels
    this.mapboxMap.on("zoomend", () => {
      const event = new CustomEvent("map-zoom-changed");
      window.dispatchEvent(event);
      this.updateCityLabels();
      // Force map re-render on zoom end
      if (this.mapboxMap) {
        this.mapboxMap.resize();
        this.mapboxMap.triggerRepaint();
      }
    });

    // Listen for zoom changes (including during zoom)
    this.mapboxMap.on("zoom", () => {
      const event = new CustomEvent("map-zoom-changed");
      window.dispatchEvent(event);
      // Force map re-render during zoom
      if (this.mapboxMap) {
        this.mapboxMap.triggerRepaint();
      }
    });

    // Suppress tile loading errors for missing tiles
    this.mapboxMap.on("error", (e: any) => {
      if (
        e.error &&
        e.error.message &&
        e.error.message.includes("Could not load image")
      ) {
        return; // Silently ignore missing tile errors
      }
      console.error("🗺️ Mapbox GL map error:", e);
    });

    // Disable all interactions
    this.mapboxMap.dragPan.disable();
    this.mapboxMap.scrollZoom.disable();
    this.mapboxMap.boxZoom.disable();
    this.mapboxMap.dragRotate.disable();
    this.mapboxMap.keyboard.disable();
    this.mapboxMap.doubleClickZoom.disable();
    this.mapboxMap.touchZoomRotate.disable();
  }

  /**
   * Update the map source and reinitialize the map.
   * @param tileSource - The new tile source URL pattern (e.g., "/tiles-map/{z}/{x}/{y}.png" or "maptiles://{z}/{x}/{y}.png")
   */
  public updateMapSource(tileSource: string): void {
    this.currentTileSource = tileSource;
    if (!this.mapElement) {
      console.error("Cannot update map source: map element not found");
      return;
    }

    // Save current map state before destroying
    let currentCenter: [number, number] | null = null;
    let currentZoom: number | null = null;

    if (this.mapboxMap) {
      const center = this.mapboxMap.getCenter();
      currentCenter = [center.lng, center.lat];
      currentZoom = this.mapboxMap.getZoom();

      // Remove all event listeners by removing the map
      this.mapboxMap.remove();
      this.mapboxMap = null;
    }

    // Clear the map container
    if (this.mapElement) {
      this.mapElement.innerHTML = "";
    }

    // Reinitialize map with new source, preserving position if available
    const lat = currentCenter ? currentCenter[1] : this.initialLat;
    const lng = currentCenter ? currentCenter[0] : this.initialLng;

    this.initializeMap(tileSource, lat, lng);

    // Restore zoom level if available
    if (currentZoom !== null && this.mapboxMap) {
      this.mapboxMap.setZoom(currentZoom);
    }

    console.log(`🗺️ Map reinitialized with new source: ${tileSource}`);
  }

  /**
   * Reinitialize the map in a new container.
   * This is useful when the container is recreated (e.g., when view mode changes).
   * @param newContainer - The new container element
   */
  public reinitializeInContainer(newContainer: HTMLElement): void {
    // Save current map state
    let currentCenter: [number, number] | null = null;
    let currentZoom: number | null = null;

    if (this.mapboxMap) {
      const center = this.mapboxMap.getCenter();
      currentCenter = [center.lng, center.lat];
      currentZoom = this.mapboxMap.getZoom();

      // Remove the old map
      this.mapboxMap.remove();
      this.mapboxMap = null;
    }

    // Update container reference
    this.container = newContainer;

    // Recreate map containers in new container
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
    this.mapElement = mapContainer;

    // Recreate labels container
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
    this.labelsContainer = labelsContainer;

    // Ensure container has minimum dimensions
    if (mapContainer.clientWidth === 0 || mapContainer.clientHeight === 0) {
      mapContainer.style.width = "100%";
      mapContainer.style.height = "100%";
      mapContainer.style.minWidth = "100px";
      mapContainer.style.minHeight = "100px";
    }

    // Reinitialize map with current source, preserving position
    const lat = currentCenter ? currentCenter[1] : this.initialLat;
    const lng = currentCenter ? currentCenter[0] : this.initialLng;

    this.initializeMap(this.currentTileSource, lat, lng);

    // Restore zoom level if available
    if (currentZoom !== null && this.mapboxMap) {
      this.mapboxMap.setZoom(currentZoom);
    }

    console.log(`🗺️ Map reinitialized in new container`);
  }
}
