import React, { useCallback, useMemo, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import { BitmapLayer, TextLayer } from "@deck.gl/layers";
import { indianCitiesData } from "./lib/text-layers";
import { MapProps } from "./lib/types";
import { useViewportStore } from "./store/useViewportStore";
import { useLayerStore } from "./store/useLayerStore";

const Map: React.FC<MapProps> = ({
  container,
  initialLat,
  initialLng,
  onMapReady,
}) => {
  const { viewState, setViewState } = useViewportStore();

  useEffect(() => {
    setViewState({
      longitude: initialLng,
      latitude: initialLat,
      zoom: 7,
      pitch: 0,
      bearing: 0,
    });
  }, [initialLat, initialLng, setViewState]);

  const onViewStateChange = useCallback(
    ({ viewState }: { viewState: any }) => {
      setViewState(viewState);
      const event = new CustomEvent("map-center-changed", {
        detail: { lat: viewState.latitude, lng: viewState.longitude },
      });
      window.dispatchEvent(event);
      const zoomEvent = new CustomEvent("map-zoom-changed", {
        detail: { zoom: viewState.zoom },
      });
      window.dispatchEvent(zoomEvent);
    },
    [setViewState]
  );

  const tileLayer = useMemo(
    () =>
      new BitmapLayer({
        id: "tile-layer",
        bounds: [-180, -85, 180, 85],
        image: "/tiles-map/{z}/{x}/{y}.png",
        tileSize: 256,
        minZoom: 1,
        maxZoom: 13,
        updateTriggers: {
          image: { url: "/tiles-map/{z}/{x}/{y}.png" },
        },
      }),
    []
  );

  const cityLabelsLayer = useMemo(() => {
    if (viewState.zoom < 8) return null;

    const baseSize = 10;
    const sizeMultiplier = Math.max(1, (viewState.zoom - 8) / 2);
    const fontSize = Math.min(14, baseSize * sizeMultiplier);

    const visibleCities = indianCitiesData.map((city) => ({
      position: [city.longitude, city.latitude],
      text: city.city,
      size: fontSize,
    }));

    return new TextLayer({
      id: "city-labels",
      data: visibleCities,
      getPosition: (d: any) => d.position,
      getText: (d: any) => d.text,
      getSize: (d: any) => d.size,
      getColor: [255, 255, 255],
      getAngle: 0,
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      fontFamily: "Arial, sans-serif",
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [0, 0, 0],
      sizeScale: 1,
      sizeMinPixels: 10,
      sizeMaxPixels: 14,
    });
  }, [viewState.zoom]);

  const { layers: dynamicLayers } = useLayerStore();

  const layers = useMemo(() => {
    const layersArray = [tileLayer];
    if (cityLabelsLayer) {
      layersArray.push(cityLabelsLayer);
    }
    return [...layersArray, ...dynamicLayers];
  }, [tileLayer, cityLabelsLayer, dynamicLayers]);

  const { updateCenter, getCenter, getZoom, setZoom } = useViewportStore();

  useEffect(() => {
    if (onMapReady) {
      onMapReady({
        updateCenter,
        getCenter,
        getZoom,
        setZoom,
        getMapboxMap: () => null,
        resize: () => {},
        isMapVisible: () => true,
        toggleMapVisibility: () => true,
        updateMapSource: () => {},
        reinitializeInContainer: () => {},
      });
    }
  }, [onMapReady, updateCenter, getCenter, getZoom, setZoom]);

  if (!container) return null;

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={onViewStateChange}
      controller={false}
      layers={layers}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
};

export default Map;
