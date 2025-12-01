import mapboxgl from "mapbox-gl";

// ============================================================================
// Aircraft Types
// ============================================================================
export type AircraftType = "mother" | "friendly" | "threat" | "self";

export type Aircraft = {
  id: string;
  status: string;
  info: string;
  lat: number;
  lng: number;
  aircraftType: AircraftType;
  callSign: string;
  altitude: number;
  heading: number;
  speed: number;
  totalDistanceCovered?: number;
  lastPosition?: { lat: number; lng: number };
  isLocked?: boolean;
  isExecuted?: boolean;
};

// ============================================================================
// Map Types
// ============================================================================
export interface MapManagerInstance {
  updateCenter: (lat: number, lng: number, zoom?: number) => void;
  getCenter: () => { lat: number; lng: number } | null;
  getZoom: () => number | null;
  setZoom: (zoom: number) => void;
  getMapboxMap: () => mapboxgl.Map | null;
  resize: () => void;
  isMapVisible: () => boolean;
  toggleMapVisibility: () => boolean;
  updateMapSource: (tileSource: string) => void;
  reinitializeInContainer: (newContainer: HTMLElement) => void;
}

export interface MapProps {
  container: HTMLElement | null;
  initialLat: number;
  initialLng: number;
  onMapReady?: (mapManager: MapManagerInstance) => void;
}

// ============================================================================
// UDP/Network Types
// ============================================================================
export type UDPDataPoint = {
  globalId: number;
  latitude: number;
  longitude: number;
  altitude: number;
  opcode?: number; // Track which opcode this came from (101 or 104)
  [key: string]: any; // For other fields like veIn, veIe, heading, groundSpeed, etc.
};

// ============================================================================
// Engagement Types
// ============================================================================
export type EngagementData = {
  globalId: number; // attacker
  engagementTargetGid: number; // target
  weaponLaunch: number;
  hangFire: number;
  tth: number; // time to hit
  tta: number; // time to arrival
  engagementTargetWeaponCode: number;
  dMax1: number; // max range 1
  dMax2: number; // max range 2
  dmin: number; // min range
  opcode: 103;
};

export interface EngagementLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  engagement: EngagementData;
  attacker: UDPDataPoint;
  target: UDPDataPoint;
}

// ============================================================================
// GeoMessage Types
// ============================================================================
export type GeoMessageData = {
  globalId: number;
  messageId: number;
  senderGid: number;
  latitude: number;
  longitude: number;
  altitude: number;
  missionId: number;
  source: number;
  geoType: number;
  action: number;
  nodeId: number;
  opcode: 122;
};

// ============================================================================
// Notification Types
// ============================================================================
export interface NotificationState {
  message: string;
  subMessage: string;
  type: "lock" | "execute";
}

// ============================================================================
// Threat Types
// ============================================================================
export type ThreatWithDistance = {
  aircraft: Aircraft;
  distance: number;
  distanceNM: number;
};

// ============================================================================
// Component Prop Types
// ============================================================================
export interface AircraftMarkerProps {
  aircraft: Aircraft;
  isCenter: boolean;
  position?: { x: number; y: number };
}

export interface ThreatDialogProps {
  isVisible: boolean;
}

export interface RedNodeDialogProps {
  node: UDPDataPoint;
  position: { x: number; y: number };
  onClose: () => void;
}

export interface GreenNodeDialogProps {
  node: UDPDataPoint;
  position: { x: number; y: number };
  onClose: () => void;
}

export interface ConnectionLineProps {
  node1: UDPDataPoint;
  node2: UDPDataPoint;
  point1: { x: number; y: number };
  point2: { x: number; y: number };
  color: string;
}

export interface RadarCircleProps {
  rangeNM: number;
  radius: number;
  minDimension: number;
}

export interface UDPNodeMarkerProps {
  node: UDPDataPoint;
  position: { x: number; y: number };
  isLocked: boolean;
  isThreatLocked: boolean;
  onClick: () => void;
}

export interface UDPNodesManagerProps {
  visualizationArea: HTMLElement | null;
}

// ============================================================================
// Store Types
// ============================================================================
export interface AircraftStore {
  aircraft: Map<string, Aircraft>;
  nodeId: string;
  selectedAircraft: Aircraft | null;
  setAircraft: (aircraft: Map<string, Aircraft>) => void;
  updateAircraft: (id: string, aircraft: Aircraft) => void;
  deleteAircraft: (id: string) => void;
  setSelectedAircraft: (aircraft: Aircraft | null) => void;
  showAircraftDetails: (aircraft: Aircraft) => void;
}

export interface UIStore {
  zoomLevel: number;
  showOtherNodes: boolean;
  centerMode: "mother" | "self";
  viewMode: "normal" | "self-only";
  showThreatDialog: boolean;
  setZoomLevel: (level: number) => void;
  setShowOtherNodes: (show: boolean) => void;
  setCenterMode: (mode: "mother" | "self") => void;
  setViewMode: (mode: "normal" | "self-only") => void;
  setShowThreatDialog: (show: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleCenterMode: () => void;
  toggleShowOtherNodes: () => void;
  toggleShowThreatDialog: () => void;
}

export interface NotificationStore {
  notification: NotificationState | null;
  setNotification: (notification: NotificationState | null) => void;
}

export interface ThreatStore {
  lockThreat: (aircraft: Aircraft) => void;
  executeThreat: (aircraft: Aircraft) => void;
}

export interface MapStore {
  convertToCartesian: (
    deltaLat: number,
    deltaLng: number,
    zoom: number
  ) => { x: number; y: number };
  getMapManager: () => MapManagerInstance | null;
  toggleMapVisibility: () => void;
}

export interface UDPStore {
  networkMembers: UDPDataPoint[];
  engagements: EngagementData[];
  geoMessages: GeoMessageData[];
  udpDataPoints: Map<number, UDPDataPoint>;
  hasInitialCentering: boolean;
  lockedNodeIds: Set<number>;
  threatLockStatus: Map<number, boolean>;
  dialogOpenForNodeId: number | null;
  setNetworkMembers: (members: UDPDataPoint[]) => void;
  setEngagements: (engagements: EngagementData[]) => void;
  setGeoMessages: (messages: GeoMessageData[]) => void;
  setUdpDataPoints: (points: Map<number, UDPDataPoint>) => void;
  setHasInitialCentering: (has: boolean) => void;
  setLockedNodeIds: (ids: Set<number>) => void;
  addLockedNodeId: (id: number) => void;
  removeLockedNodeId: (id: number) => void;
  setThreatLockStatus: (threatId: number, isLocked: boolean) => void;
  setDialogOpenForNodeId: (nodeId: number | null) => void;
  processUDPData: (data: UDPDataPoint[]) => void;
}

// ============================================================================
// Hook Types
// ============================================================================
export interface UseMapManagerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  defaultLat?: number;
  defaultLng?: number;
  onNodesCenterCalculated?: (
    center: { lat: number; lng: number } | null
  ) => void;
}

// ============================================================================
// UDP Parser Types
// ============================================================================
export type ReadBitsFn = (start: number, len: number) => number;
export type ReadI16Fn = (start: number) => number;
export type ReadU32Fn = (start: number) => number;

